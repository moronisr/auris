import { supabaseAdmin } from "@/lib/admin";

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

export async function chaveDoProfissional(profissionalId: string): Promise<string | null> {
  const { data } = await supabaseAdmin().from("profissionais_segredos").select("mp_access_token").eq("profissional_id", profissionalId).maybeSingle();
  return data?.mp_access_token || null;
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

type Pagamento = { id: number; status: string; transaction_amount: number; payment_type_id: string; external_reference: string | null; date_approved: string | null };

const metodoDoTipo = (tipo: string): string => (tipo === "credit_card" ? "credito" : tipo === "debit_card" ? "debito" : "pix");

/**
 * Consulta o Mercado Pago e, se houver pagamento aprovado e com o valor certo para esta teleconsulta,
 * marca como confirmado. Retorna o status final de pagamento da teleconsulta.
 */
export async function confirmarPeloMercadoPago(teleId: string, pagamentoId?: string): Promise<string> {
  const sb = supabaseAdmin();
  const { data: t } = await sb.from("teleconsultas").select("id, profissional_id, valor, pagamento_status, status").eq("id", teleId).maybeSingle();
  if (!t) return "nao_encontrada";
  if (t.pagamento_status === "confirmado" || t.pagamento_status === "isento") return t.pagamento_status;
  const token = await chaveDoProfissional(t.profissional_id);
  if (!token) return t.pagamento_status;

  let candidatos: Pagamento[] = [];
  if (pagamentoId && /^\d+$/.test(pagamentoId)) {
    candidatos = [await mp<Pagamento>(token, `/v1/payments/${pagamentoId}`)];
  } else {
    const r = await mp<{ results: Pagamento[] }>(token, `/v1/payments/search?external_reference=${encodeURIComponent(teleId)}&sort=date_created&criteria=desc`);
    candidatos = r.results || [];
  }
  const ok = candidatos.find((p) => p.status === "approved" && p.external_reference === teleId && Number(p.transaction_amount) + 0.001 >= Number(t.valor || 0));
  if (!ok) return t.pagamento_status;

  await sb.from("teleconsultas").update({
    pagamento_status: "confirmado",
    pagamento_confirmado_em: ok.date_approved || new Date().toISOString(),
    pagamento_metodo: metodoDoTipo(ok.payment_type_id),
    mp_pagamento_id: String(ok.id),
    reserva_expira_em: null,
    status: t.status === "agendada" ? "confirmada" : t.status,
  }).eq("id", teleId).neq("pagamento_status", "confirmado");
  return "confirmado";
}
