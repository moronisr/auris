import { supabaseAdmin } from "@/lib/admin";
import { renovar } from "@/lib/mpOauth";

/**
 * Mercado Pago do profissional: o dinheiro do paciente cai direto na conta dele.
 * A confirmação vem sempre do Mercado Pago, consultada pelo servidor com a chave do profissional;
 * nada que o navegador do paciente diga confirma um pagamento.
 */
const API = "https://api.mercadopago.com";

export type Metodo = "pix" | "credito" | "debito";

export function modoDaChave(token: string): "teste" | "producao" | null {
  if (/^TEST-/.test(token)) return "teste";
  if (/^APP_USR-/.test(token)) return "producao";
  return null;
}

async function mp<T>(token: string, caminho: string, init?: RequestInit): Promise<T> {
  const r = await fetch(API + caminho, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers || {}) },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Mercado Pago ${r.status}: ${JSON.stringify(corpo).slice(0, 300)}`);
  return corpo as T;
}

/** Confere se a chave é válida, consultando os dados da própria conta. */
export async function validarChave(token: string): Promise<{ id: number; email?: string }> {
  return mp(token, "/users/me");
}

/** Chave do Mercado Pago do profissional. Conexões pelo botão vencem em 6 meses: renova sozinho antes de vencer. */
export async function chaveDoProfissional(profissionalId: string): Promise<string | null> {
  const admin = supabaseAdmin();
  const { data } = await admin.from("profissionais_segredos").select("mp_access_token, mp_refresh_token, mp_expira_em").eq("profissional_id", profissionalId).maybeSingle();
  if (!data?.mp_access_token) return null;
  const venceEm = data.mp_expira_em ? new Date(data.mp_expira_em).getTime() - Date.now() : Infinity;
  if (data.mp_refresh_token && venceEm < 20 * 864e5) {
    try {
      const t = await renovar(data.mp_refresh_token);
      await admin.from("profissionais_segredos").update({
        mp_access_token: t.access_token, mp_refresh_token: t.refresh_token,
        mp_expira_em: new Date(Date.now() + (t.expires_in || 15552000) * 1000).toISOString(), ...(t.public_key ? { mp_public_key: t.public_key } : {}), atualizado_em: new Date().toISOString(),
      }).eq("profissional_id", profissionalId);
      return t.access_token;
    } catch (e) {
      console.error("mp renovar", e);
    }
  }
  return data.mp_access_token;
}

/**
 * Chave pública da conta conectada, usada no formulário de cartão seguro do Mercado Pago (os dados do cartão
 * vão direto para o Mercado Pago, sem passar pelo Auris). Se ainda não estiver guardada, renova a conexão para obtê-la.
 */
export async function chavePublicaDoProfissional(profissionalId: string): Promise<string | null> {
  const admin = supabaseAdmin();
  const { data } = await admin.from("profissionais_segredos").select("mp_public_key, mp_refresh_token").eq("profissional_id", profissionalId).maybeSingle();
  if (data?.mp_public_key) return data.mp_public_key;
  if (!data?.mp_refresh_token) return null;
  try {
    const t = await renovar(data.mp_refresh_token);
    await admin.from("profissionais_segredos").update({
      mp_access_token: t.access_token, mp_refresh_token: t.refresh_token, mp_public_key: t.public_key || null,
      mp_expira_em: new Date(Date.now() + (t.expires_in || 15552000) * 1000).toISOString(), atualizado_em: new Date().toISOString(),
    }).eq("profissional_id", profissionalId);
    return t.public_key || null;
  } catch (e) {
    console.error("mp chave publica", e);
    return null;
  }
}

/** Cancela um Pix ainda não pago, para o paciente nunca ter dois códigos válidos para a mesma consulta. */
export async function cancelarPixPendente(token: string, pagamentoId: string): Promise<void> {
  if (!/^\d+$/.test(pagamentoId)) return;
  try {
    const pg = await mp<{ status: string; payment_type_id: string }>(token, `/v1/payments/${pagamentoId}`);
    if (pg.payment_type_id === "bank_transfer" && (pg.status === "pending" || pg.status === "in_process")) {
      await mp(token, `/v1/payments/${pagamentoId}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) });
    }
  } catch (e) {
    console.error("cancelar pix anterior", e);
  }
}

export type ResultadoCartao = { status: string; detalhe: string; pagamentoId: string };

/** Cobra o cartão (crédito ou débito) com o token gerado pelo formulário seguro do Mercado Pago. Valor sempre do servidor. */
export async function cobrarCartaoMercadoPago(o: {
  token: string; teleId: string; valor: number; titulo: string; base: string; chave: string;
  cartao: { token: string; payment_method_id: string; issuer_id?: string | number; payer: { email: string; identification?: { type: string; number: string } } };
}): Promise<ResultadoCartao> {
  const pg = await mp<{ id: number; status: string; status_detail: string }>(o.token, "/v1/payments", {
    method: "POST",
    headers: { "X-Idempotency-Key": `${o.teleId}-cartao-${o.chave}` },
    body: JSON.stringify({
      transaction_amount: Number(o.valor.toFixed(2)),
      token: o.cartao.token,
      description: o.titulo.slice(0, 120),
      installments: 1,
      payment_method_id: o.cartao.payment_method_id,
      ...(o.cartao.issuer_id ? { issuer_id: Number(o.cartao.issuer_id) } : {}),
      payer: { email: o.cartao.payer.email, ...(o.cartao.payer.identification?.number ? { identification: o.cartao.payer.identification } : {}) },
      external_reference: o.teleId,
      notification_url: `${o.base}/api/pagamento/webhook?t=${o.teleId}`,
      statement_descriptor: "AURIS CONSULTA",
      binary_mode: true,
      capture: true,
    }),
  });
  return { status: pg.status, detalhe: pg.status_detail, pagamentoId: String(pg.id) };
}

const EXCLUIR: Record<Metodo, string[]> = {
  pix: ["credit_card", "debit_card", "ticket", "atm", "prepaid_card"],
  credito: ["debit_card", "ticket", "bank_transfer", "atm", "prepaid_card"],
  debito: ["credit_card", "ticket", "bank_transfer", "atm"],
};

export async function criarCobranca(opts: {
  token: string; teleId: string; codigo: string; valor: number; titulo: string; metodo: Metodo; expira: Date; base: string; email?: string | null;
}): Promise<{ url: string; preferenciaId: string }> {
  const volta = `${opts.base}/t/${opts.codigo}?pg=1`;
  const pref = await mp<{ id: string; init_point: string; sandbox_init_point: string }>(opts.token, "/checkout/preferences", {
    method: "POST",
    headers: { "X-Idempotency-Key": `${opts.teleId}-${opts.metodo}-${Math.floor(Date.now() / 60000)}` },
    body: JSON.stringify({
      items: [{ id: opts.teleId, title: opts.titulo.slice(0, 120), quantity: 1, unit_price: Number(opts.valor.toFixed(2)), currency_id: "BRL" }],
      external_reference: opts.teleId,
      notification_url: `${opts.base}/api/pagamento/webhook?t=${opts.teleId}`,
      back_urls: { success: volta, pending: volta, failure: volta },
      auto_return: "approved",
      expires: true,
      expiration_date_to: opts.expira.toISOString(),
      date_of_expiration: opts.expira.toISOString(),
      payment_methods: { excluded_payment_types: EXCLUIR[opts.metodo].map((id) => ({ id })), installments: 1 },
      statement_descriptor: "AURIS CONSULTA",
      ...(opts.email ? { payer: { email: opts.email } } : {}),
    }),
  });
  const url = modoDaChave(opts.token) === "teste" ? pref.sandbox_init_point || pref.init_point : pref.init_point;
  return { url, preferenciaId: pref.id };
}

/**
 * Pix direto pela API de pagamentos: o Auris mostra o QR Code e o copia e cola na própria página,
 * e o paciente paga pelo app de qualquer banco, sem conta no Mercado Pago.
 */
export async function criarPixMercadoPago(opts: {
  token: string; teleId: string; codigo: string; valor: number; titulo: string; expira: Date; base: string; email?: string | null;
}): Promise<{ pagamentoId: string; codigo: string; imagem: string; expira: string }> {
  const minimo = Date.now() + 31 * 60_000;
  const expira = new Date(Math.max(opts.expira.getTime(), minimo));
  const email = opts.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(opts.email) ? opts.email : `aurismedical2+${opts.teleId.slice(0, 8)}@gmail.com`;
  const pg = await mp<{ id: number; point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string } } }>(opts.token, "/v1/payments", {
    method: "POST",
    headers: { "X-Idempotency-Key": `${opts.teleId}-pix-${Math.floor(Date.now() / 60000)}` },
    body: JSON.stringify({
      transaction_amount: Number(opts.valor.toFixed(2)),
      description: opts.titulo.slice(0, 120),
      payment_method_id: "pix",
      payer: { email },
      external_reference: opts.teleId,
      notification_url: `${opts.base}/api/pagamento/webhook?t=${opts.teleId}`,
      date_of_expiration: expira.toISOString(),
      statement_descriptor: "AURIS CONSULTA",
    }),
  });
  const td = pg.point_of_interaction?.transaction_data;
  if (!td?.qr_code) throw new Error(`Mercado Pago Pix sem QR Code (pagamento ${pg.id})`);
  return { pagamentoId: String(pg.id), codigo: td.qr_code, imagem: td.qr_code_base64 ? `data:image/png;base64,${td.qr_code_base64}` : "", expira: expira.toISOString() };
}

type Pagamento = { id: number; status: string; transaction_amount: number; payment_type_id: string; external_reference: string | null; date_approved: string | null };

const metodoDoTipo = (tipo: string): string => (tipo === "credit_card" ? "credito" : tipo === "debit_card" ? "debito" : "pix");

/**
 * Consulta o Mercado Pago e, se houver pagamento aprovado e com o valor certo para esta teleconsulta,
 * marca como confirmado. Retorna o status final de pagamento da teleconsulta.
 */
export async function confirmarPeloMercadoPago(teleId: string, pagamentoId?: string): Promise<string> {
  const sb = supabaseAdmin();
  const { data: t } = await sb.from("teleconsultas").select("id, profissional_id, valor, pagamento_status, status, mp_pagamento_id, pagamento_alerta").eq("id", teleId).maybeSingle();
  if (!t) return "nao_encontrada";
  if (t.pagamento_status === "isento") return t.pagamento_status;
  const token = await chaveDoProfissional(t.profissional_id);
  if (!token) return t.pagamento_status;

  // Sempre a lista completa de pagamentos desta consulta, para achar também pagamentos em duplicidade.
  const r = await mp<{ results: Pagamento[] }>(token, `/v1/payments/search?external_reference=${encodeURIComponent(teleId)}&sort=date_created&criteria=asc`);
  let candidatos = r.results || [];
  if (pagamentoId && /^\d+$/.test(pagamentoId) && !candidatos.some((p) => String(p.id) === pagamentoId)) {
    candidatos = [...candidatos, await mp<Pagamento>(token, `/v1/payments/${pagamentoId}`)];
  }
  const aprovados = candidatos.filter((p) => p.status === "approved" && p.external_reference === teleId && Number(p.transaction_amount) + 0.001 >= Number(t.valor || 0));
  if (!aprovados.length) return t.pagamento_status;

  const alerta = aprovados.length > 1 ? "duplicado" : t.status === "cancelada" ? "pago_cancelada" : null;
  if (t.pagamento_status === "confirmado") {
    if (alerta && t.pagamento_alerta !== alerta) await sb.from("teleconsultas").update({ pagamento_alerta: alerta }).eq("id", teleId);
    return "confirmado";
  }
  const ok = aprovados[0];
  await sb.from("teleconsultas").update({
    pagamento_status: "confirmado",
    pagamento_confirmado_em: ok.date_approved || new Date().toISOString(),
    pagamento_metodo: metodoDoTipo(ok.payment_type_id),
    mp_pagamento_id: String(ok.id),
    reserva_expira_em: null,
    pagamento_alerta: alerta,
    status: t.status === "agendada" ? "confirmada" : t.status,
  }).eq("id", teleId).neq("pagamento_status", "confirmado");
  return "confirmado";
}
