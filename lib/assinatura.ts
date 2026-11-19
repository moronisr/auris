import { supabaseAdmin } from "@/lib/admin";
import { planoPorId } from "@/lib/planos";

/**
 * Assinatura do Auris paga pelo profissional: cartão recorrente pelo Mercado Pago (Assinaturas / preapproval),
 * recebido na conta do Auris. O cartão fica guardado no Mercado Pago; o Auris guarda só bandeira e 4 últimos dígitos.
 */
const API = "https://api.mercadopago.com";
const token = () => process.env.MP_AURIS_ACCESS_TOKEN || "";
export const cobrancaConfigurada = () => !!process.env.MP_AURIS_ACCESS_TOKEN && !!process.env.MP_AURIS_PUBLIC_KEY;

async function mp<T>(caminho: string, init?: RequestInit): Promise<T> {
  const r = await fetch(API + caminho, {
    ...init,
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...(init?.headers || {}) },
    signal: AbortSignal.timeout(20_000), cache: "no-store",
  });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Mercado Pago ${r.status}: ${JSON.stringify(corpo).slice(0, 300)}`);
  return corpo as T;
}

export type Acesso = "liberado" | "teste" | "ativa" | "aviso" | "bloqueado";

export async function acessoDe(uid: string): Promise<Acesso> {
  const { data } = await supabaseAdmin().rpc("auris_acesso", { uid });
  return (data as Acesso) || "liberado";
}

async function dadosDoCartao(cardToken: string): Promise<{ final: string | null; bandeira: string | null }> {
  try {
    const c = await mp<{ last_four_digits?: string; payment_method?: { id?: string } }>(`/v1/card_tokens/${encodeURIComponent(cardToken)}`);
    return { final: c.last_four_digits || null, bandeira: c.payment_method?.id || null };
  } catch { return { final: null, bandeira: null }; }
}

const motivoMp = (e: unknown): string => {
  const t = String(e);
  if (/card_token|invalid.*token/i.test(t)) return "Os dados do cartão expiraram. Digite o cartão de novo.";
  if (/high_risk|security|fraud/i.test(t)) return "O pagamento foi recusado pelos controles de segurança do Mercado Pago. Use outro cartão de crédito.";
  if (/rejected|insufficient|cc_rejected/i.test(t)) return "O cartão foi recusado pelo banco. Use outro cartão ou fale com o seu banco.";
  if (/payer_email|email/i.test(t)) return "Confira o e-mail informado no formulário do cartão.";
  return "Não foi possível concluir com o Mercado Pago agora. Tente de novo em alguns minutos.";
};

type Preapproval = {
  id: string; status: string; reason?: string; next_payment_date?: string;
  auto_recurring?: { transaction_amount?: number; start_date?: string };
  summarized?: { last_charged_date?: string; semaphore?: string };
};

/** Cria a assinatura com o cartão. Durante o teste grátis, a primeira cobrança é só no fim do teste. */
export async function assinar(o: { uid: string; email: string; planoId: string; cardToken: string; payerEmail?: string; fimTeste: Date | null; base: string }) {
  const plano = planoPorId(o.planoId);
  if (!plano) return { ok: false as const, erro: "Plano inválido." };
  const { data: atual } = await supabaseAdmin().from("assinaturas").select("pago_ate").eq("profissional_id", o.uid).maybeSingle();
  const pagoAte = atual?.pago_ate ? new Date(atual.pago_ate) : null;
  const candidatos = [o.fimTeste, pagoAte].filter((d): d is Date => !!d && d.getTime() > Date.now() + 60_000);
  // Sem cobrar duas vezes: a renovação começa no fim do teste grátis ou do período que já foi pago.
  const inicio = candidatos.length ? new Date(Math.max(...candidatos.map((d) => d.getTime()))) : null;
  try {
    const cartao = await dadosDoCartao(o.cardToken);
    const pa = await mp<Preapproval>("/preapproval", {
      method: "POST",
      headers: { "X-Idempotency-Key": `assinar-${o.uid}-${o.cardToken.slice(0, 16)}` },
      body: JSON.stringify({
        reason: `Auris - plano ${plano.nome}`,
        external_reference: o.uid,
        payer_email: o.payerEmail || o.email,
        card_token_id: o.cardToken,
        back_url: `${o.base}/financas`,
        status: "authorized",
        auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: plano.valor, currency_id: "BRL", ...(inicio ? { start_date: inicio.toISOString() } : {}) },
      }),
    });
    await supabaseAdmin().from("assinaturas").upsert({
      profissional_id: o.uid, plano: plano.id, status: "ativa", mp_assinatura_id: pa.id, valor: plano.valor,
      cartao_final: cartao.final, cartao_bandeira: cartao.bandeira, teste_ate: o.fimTeste?.toISOString() ?? null,
      // No teste, o acesso já está garantido até o fim dele; fora do teste, até a confirmação da primeira cobrança.
      pago_ate: inicio ? inicio.toISOString() : new Date(Date.now() + 2 * 864e5).toISOString(),
      falha_desde: null, falha_motivo: null, cancelada_em: null, renovacao_automatica: true,
      proxima_cobranca: pa.next_payment_date || (inicio ? inicio.toISOString() : null), atualizado_em: new Date().toISOString(),
    });
    if (!inicio) await sincronizar(o.uid).catch(() => {});
    return { ok: true as const };
  } catch (e) {
    console.error("assinar", String(e).slice(0, 300));
    return { ok: false as const, erro: motivoMp(e) };
  }
}

/** Paga só um mês, sem guardar o cartão para as próximas cobranças. */
export async function pagarAvulso(o: {
  uid: string; email: string; planoId: string; fimTeste: Date | null;
  cartao: { token: string; payment_method_id: string; issuer_id?: string | number; payer?: { email?: string; identification?: { type: string; number: string } }; aparelho?: string };
}) {
  const plano = planoPorId(o.planoId);
  if (!plano) return { ok: false as const, erro: "Plano inválido." };
  try {
    const cartao = await dadosDoCartao(o.cartao.token);
    const pg = await mp<{ id: number; status: string; status_detail: string; date_approved?: string }>("/v1/payments", {
      method: "POST",
      headers: { "X-Idempotency-Key": `avulso-${o.uid}-${o.cartao.token.slice(0, 16)}`, ...(o.cartao.aparelho ? { "X-meli-session-id": o.cartao.aparelho } : {}) },
      body: JSON.stringify({
        transaction_amount: plano.valor, token: o.cartao.token, installments: 1, description: `Auris - plano ${plano.nome} (1 mês)`,
        payment_method_id: o.cartao.payment_method_id, ...(o.cartao.issuer_id ? { issuer_id: Number(o.cartao.issuer_id) } : {}),
        payer: { email: o.cartao.payer?.email || o.email, ...(o.cartao.payer?.identification?.number ? { identification: o.cartao.payer.identification } : {}) },
        external_reference: `auris-${o.uid}`, statement_descriptor: "AURIS", binary_mode: true,
        additional_info: { items: [{ id: `plano-${plano.id}`, title: `Auris - plano ${plano.nome}`, description: "Assinatura mensal de software", category_id: "services", quantity: 1, unit_price: plano.valor }] },
      }),
    });
    const sb = supabaseAdmin();
    await sb.from("auris_cobrancas").upsert({ profissional_id: o.uid, mp_pagamento_id: String(pg.id), origem: "avulso", plano: plano.id, valor: plano.valor, status: pg.status, data: new Date().toISOString() }, { onConflict: "mp_pagamento_id" });
    if (pg.status !== "approved") return { ok: false as const, erro: "O cartão foi recusado pelo banco. Nenhum valor foi cobrado. Use outro cartão ou fale com o seu banco." };
    const { data: atual } = await sb.from("assinaturas").select("pago_ate, mp_assinatura_id").eq("profissional_id", o.uid).maybeSingle();
    const base = Math.max(Date.now(), o.fimTeste?.getTime() || 0, atual?.pago_ate ? new Date(atual.pago_ate).getTime() : 0);
    const ate = new Date(base); ate.setMonth(ate.getMonth() + 1);
    await sb.from("assinaturas").upsert({
      profissional_id: o.uid, plano: plano.id, valor: plano.valor, status: "ativa", renovacao_automatica: !!atual?.mp_assinatura_id,
      pago_ate: ate.toISOString(), ultimo_pagamento_em: new Date().toISOString(), ultimo_pagamento_id: String(pg.id),
      ...(atual?.mp_assinatura_id ? {} : { cartao_final: cartao.final, cartao_bandeira: cartao.bandeira, proxima_cobranca: null }),
      falha_desde: null, falha_motivo: null, cancelada_em: null, atualizado_em: new Date().toISOString(),
    });
    return { ok: true as const, ate: ate.toISOString() };
  } catch (e) {
    console.error("avulso", String(e).slice(0, 300));
    return { ok: false as const, erro: motivoMp(e) };
  }
}

/** Remove o cartão: a renovação automática para. O acesso continua até o fim do período já pago. */
export async function removerCartao(uid: string) {
  const sb = supabaseAdmin();
  const { data: a } = await sb.from("assinaturas").select("mp_assinatura_id").eq("profissional_id", uid).maybeSingle();
  if (!a) return { ok: false as const, erro: "Não há cartão cadastrado." };
  try {
    if (a.mp_assinatura_id) await mp(`/preapproval/${a.mp_assinatura_id}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) });
    await sb.from("assinaturas").update({ mp_assinatura_id: null, cartao_final: null, cartao_bandeira: null, renovacao_automatica: false, proxima_cobranca: null, atualizado_em: new Date().toISOString() }).eq("profissional_id", uid);
    return { ok: true as const };
  } catch (e) {
    console.error("remover cartao", String(e).slice(0, 300));
    return { ok: false as const, erro: motivoMp(e) };
  }
}

export async function trocarCartao(uid: string, cardToken: string) {
  const { data: a } = await supabaseAdmin().from("assinaturas").select("mp_assinatura_id, status").eq("profissional_id", uid).maybeSingle();
  if (!a?.mp_assinatura_id) return { ok: false as const, erro: "Você ainda não tem assinatura." };
  try {
    const cartao = await dadosDoCartao(cardToken);
    await mp(`/preapproval/${a.mp_assinatura_id}`, { method: "PUT", body: JSON.stringify({ card_token_id: cardToken, ...(a.status === "falha" ? { status: "authorized" } : {}) }) });
    await supabaseAdmin().from("assinaturas").update({ cartao_final: cartao.final, cartao_bandeira: cartao.bandeira, atualizado_em: new Date().toISOString() }).eq("profissional_id", uid);
    await sincronizar(uid).catch(() => {});
    return { ok: true as const };
  } catch (e) {
    console.error("trocar cartao", String(e).slice(0, 300));
    return { ok: false as const, erro: motivoMp(e) };
  }
}

export async function trocarPlano(uid: string, planoId: string) {
  const plano = planoPorId(planoId);
  const { data: a } = await supabaseAdmin().from("assinaturas").select("mp_assinatura_id").eq("profissional_id", uid).maybeSingle();
  if (!plano || !a?.mp_assinatura_id) return { ok: false as const, erro: "Assinatura ou plano não encontrado." };
  try {
    await mp(`/preapproval/${a.mp_assinatura_id}`, { method: "PUT", body: JSON.stringify({ reason: `Auris - plano ${plano.nome}`, auto_recurring: { transaction_amount: plano.valor, currency_id: "BRL" } }) });
    await supabaseAdmin().from("assinaturas").update({ plano: plano.id, valor: plano.valor, atualizado_em: new Date().toISOString() }).eq("profissional_id", uid);
    return { ok: true as const };
  } catch (e) {
    console.error("trocar plano", String(e).slice(0, 300));
    return { ok: false as const, erro: motivoMp(e) };
  }
}

/** Cancela a renovação. O acesso continua até o fim do período já pago. */
export async function cancelarAssinatura(uid: string) {
  const { data: a } = await supabaseAdmin().from("assinaturas").select("mp_assinatura_id").eq("profissional_id", uid).maybeSingle();
  if (!a?.mp_assinatura_id) return { ok: false as const, erro: "Você ainda não tem assinatura." };
  try {
    await mp(`/preapproval/${a.mp_assinatura_id}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) });
    await supabaseAdmin().from("assinaturas").update({ status: "cancelada", mp_assinatura_id: null, renovacao_automatica: false, cancelada_em: new Date().toISOString(), proxima_cobranca: null, atualizado_em: new Date().toISOString() }).eq("profissional_id", uid);
    return { ok: true as const };
  } catch (e) {
    console.error("cancelar assinatura", String(e).slice(0, 300));
    return { ok: false as const, erro: motivoMp(e) };
  }
}

type Fatura = { id: number; status: string; debit_date?: string; date_created?: string; transaction_amount?: number; payment?: { id?: number; status?: string; status_detail?: string }; rejection_code?: string };

/**
 * Atualiza a assinatura consultando o Mercado Pago (nunca confia no aviso recebido).
 * Pagamento aprovado: acesso por mais um mês. Recusado: começa a contagem de 7 dias de tolerância.
 */
export async function sincronizar(uid: string): Promise<void> {
  const sb = supabaseAdmin();
  const { data: a } = await sb.from("assinaturas").select("*").eq("profissional_id", uid).maybeSingle();
  if (!a?.mp_assinatura_id || !token()) return;
  const pa = await mp<Preapproval>(`/preapproval/${a.mp_assinatura_id}`);
  const faturas = await mp<{ results?: Fatura[] }>(`/authorized_payments/search?preapproval_id=${encodeURIComponent(a.mp_assinatura_id)}&sort=date_created&criteria=desc&limit=10`).catch(() => ({ results: [] as Fatura[] }));
  const lista = faturas.results || [];
  for (const f of lista) {
    if (!f.payment?.id) continue;
    await sb.from("auris_cobrancas").upsert({
      profissional_id: uid, mp_pagamento_id: String(f.payment.id), origem: "assinatura", plano: a.plano, valor: f.transaction_amount ?? a.valor,
      status: f.payment.status || f.status, data: f.debit_date || f.date_created || new Date().toISOString(),
    }, { onConflict: "mp_pagamento_id" });
  }
  const aprovada = lista.find((f) => f.payment?.status === "approved");
  const ultima = lista[0];
  const upd: Record<string, unknown> = { proxima_cobranca: pa.next_payment_date || null, atualizado_em: new Date().toISOString() };
  if (aprovada) {
    const quando = new Date(aprovada.debit_date || aprovada.date_created || Date.now());
    const ate = new Date(quando); ate.setMonth(ate.getMonth() + 1);
    if (!a.pago_ate || new Date(a.pago_ate) < ate) upd.pago_ate = ate.toISOString();
    upd.ultimo_pagamento_em = quando.toISOString();
  }
  if (pa.status === "cancelled") {
    upd.status = "cancelada"; upd.proxima_cobranca = null;
  } else if (ultima && ultima.payment?.status && ultima.payment.status !== "approved" && ultima.payment.status !== "in_process" && ultima.payment.status !== "pending" && (!aprovada || ultima.id !== aprovada.id)) {
    upd.status = "falha"; upd.falha_desde = a.falha_desde || new Date(ultima.date_created || Date.now()).toISOString();
    upd.falha_motivo = ultima.payment.status_detail || ultima.rejection_code || "recusado";
  } else if (pa.status === "authorized") {
    upd.status = "ativa"; upd.falha_desde = null; upd.falha_motivo = null;
  }
  await sb.from("assinaturas").update(upd).eq("profissional_id", uid);
}

export async function sincronizarPorAssinatura(mpId: string) {
  const { data } = await supabaseAdmin().from("assinaturas").select("profissional_id").eq("mp_assinatura_id", mpId).maybeSingle();
  if (data) await sincronizar(data.profissional_id);
}

export async function sincronizarPorFatura(faturaId: string) {
  const f = await mp<{ preapproval_id?: string }>(`/authorized_payments/${encodeURIComponent(faturaId)}`);
  if (f.preapproval_id) await sincronizarPorAssinatura(f.preapproval_id);
}

/** Rotina diária: todas as assinaturas ativas ou com falha. */
export async function sincronizarTodas(): Promise<number> {
  const { data } = await supabaseAdmin().from("assinaturas").select("profissional_id").in("status", ["ativa", "falha", "cancelada"]).not("mp_assinatura_id", "is", null).limit(200);
  let n = 0;
  for (const a of data || []) { try { await sincronizar(a.profissional_id); n++; } catch (e) { console.error("sync assinatura", String(e).slice(0, 200)); } }
  return n;
}
