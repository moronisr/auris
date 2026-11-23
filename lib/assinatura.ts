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

async function dadosDoCartao(cardToken: string): Promise<{ final: string | null; bandeira: string | null; titular: string | null }> {
  try {
    const c = await mp<{ last_four_digits?: string; payment_method?: { id?: string }; cardholder?: { name?: string } }>(`/v1/card_tokens/${encodeURIComponent(cardToken)}`);
    return { final: c.last_four_digits || null, bandeira: c.payment_method?.id || null, titular: c.cardholder?.name?.trim() || null };
  } catch { return { final: null, bandeira: null, titular: null }; }
}

/** Nome do titular do cartão separado em nome e sobrenome, como o Mercado Pago pede no pagador. */
function nomeDoTitular(nome: string | null) {
  const partes = (nome || "").split(/\s+/).filter(Boolean);
  if (!partes.length) return {};
  return { first_name: partes[0], ...(partes.length > 1 ? { last_name: partes.slice(1).join(" ") } : {}) };
}

const NADA_COBRADO = " Nenhum valor foi cobrado.";
const MSG_SEGURANCA = "O Mercado Pago recusou o pagamento pelos controles de segurança dele. Isso costuma acontecer quando o cartão está no nome de outra pessoa ou quando os dados não batem. Use um cartão no seu nome ou, se o cartão for de outra pessoa, marque \"O cartão está no nome de outra pessoa\" e informe o e-mail do titular." + NADA_COBRADO;

/** Mensagem clara para cada motivo de recusa do Mercado Pago, dizendo o que fazer. */
export function motivoRecusa(detalhe: string | undefined | null): string {
  const d = String(detalhe || "");
  if (/high_risk|CC_VAL_433|blacklist|fraud/i.test(d)) return MSG_SEGURANCA;
  if (/insufficient_amount/i.test(d)) return "O cartão não tem limite disponível para este valor. Use outro cartão ou fale com o seu banco." + NADA_COBRADO;
  if (/bad_filled_security_code/i.test(d)) return "O código de segurança (CVV) não confere. Confira os 3 ou 4 números no verso do cartão e tente de novo." + NADA_COBRADO;
  if (/bad_filled_date/i.test(d)) return "A validade do cartão não confere. Confira o mês e o ano e tente de novo." + NADA_COBRADO;
  if (/bad_filled/i.test(d)) return "Algum dado do cartão não confere. Confira o número, a validade, o código de segurança, o nome e o CPF do titular." + NADA_COBRADO;
  if (/call_for_authorize/i.test(d)) return "O banco pediu para você autorizar este pagamento. Ligue para o banco ou abra o app dele, autorize o pagamento ao Mercado Pago e tente de novo." + NADA_COBRADO;
  if (/card_disabled/i.test(d)) return "O cartão não está ativo para compras online. Ative no app do banco ou use outro cartão." + NADA_COBRADO;
  if (/duplicated_payment/i.test(d)) return "Já houve um pagamento igual há poucos minutos. Confira o histórico de cobranças antes de tentar de novo." + NADA_COBRADO;
  if (/max_attempts/i.test(d)) return "Foram muitas tentativas com este cartão. Espere algumas horas ou use outro cartão." + NADA_COBRADO;
  return "O banco recusou o cartão. Use outro cartão ou fale com o seu banco." + NADA_COBRADO;
}

const motivoMp = (e: unknown): string => {
  const t = String(e);
  if (/card_token|invalid.*token/i.test(t)) return "Os dados do cartão expiraram. Digite o cartão de novo.";
  if (/high_risk|security|fraud|CC_VAL_433/i.test(t)) return MSG_SEGURANCA;
  if (/cc_rejected_\w+/i.test(t)) return motivoRecusa(t.match(/cc_rejected_\w+/i)![0]);
  if (/rejected|insufficient/i.test(t)) return "O banco recusou o cartão. Use outro cartão ou fale com o seu banco." + NADA_COBRADO;
  if (/payer_email|email/i.test(t)) return "Confira o e-mail do titular do cartão informado no formulário.";
  return "Não foi possível concluir com o Mercado Pago agora. Tente de novo em alguns minutos.";
};

type Preapproval = {
  id: string; status: string; reason?: string; next_payment_date?: string;
  auto_recurring?: { transaction_amount?: number; start_date?: string };
  summarized?: { last_charged_date?: string; semaphore?: string };
};

/** Cria a assinatura com o cartão. Durante o teste grátis, a primeira cobrança é só no fim do teste. */
export async function assinar(o: { uid: string; email: string; planoId: string; cardToken: string; payerEmail?: string; aparelho?: string; fimTeste: Date | null; base: string }) {
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
      // Identificação do aparelho (antifraude): sem ela, o Mercado Pago recusa a validação do cartão com frequência.
      headers: { "X-Idempotency-Key": `assinar-${o.uid}-${o.cardToken.slice(0, 16)}`, ...(o.aparelho ? { "X-meli-session-id": o.aparelho } : {}) },
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
    // Validação do cartão para renovação recusada: o pagamento de 1 mês segue outro caminho no Mercado Pago.
    if (/CC_VAL_433|high_risk|security|fraud/i.test(String(e))) return { ok: false as const, erro: "O Mercado Pago não aprovou salvar este cartão para a renovação automática. Nenhum valor foi cobrado. Desmarque \"Salvar este cartão\" acima e pague 1 mês com o mesmo cartão." };
    return { ok: false as const, erro: motivoMp(e) };
  }
}

/** Plano de assinatura no Mercado Pago (um por plano e valor do Auris), guardado em auris_config.mp_planos. */
async function planoMp(planoId: string, base: string): Promise<{ id: string; link: string } | null> {
  const plano = planoPorId(planoId);
  if (!plano) return null;
  const sb = supabaseAdmin();
  const { data: cfg } = await sb.from("auris_config").select("mp_planos").eq("id", 1).maybeSingle();
  const mapa = ((cfg?.mp_planos as Record<string, { id: string; link: string }>) || {});
  const chave = `${plano.id}:${plano.valor}`;
  if (mapa[chave]?.id) return mapa[chave];
  const pp = await mp<{ id: string; init_point: string }>("/preapproval_plan", {
    method: "POST",
    body: JSON.stringify({
      reason: `Auris - plano ${plano.nome}`,
      auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: plano.valor, currency_id: "BRL" },
      back_url: `${base}/financas?aba=plano`,
    }),
  });
  mapa[chave] = { id: pp.id, link: pp.init_point };
  await sb.from("auris_config").update({ mp_planos: mapa }).eq("id", 1);
  return mapa[chave];
}

export async function linkCheckoutMp(planoId: string, base: string): Promise<string | null> {
  return (await planoMp(planoId, base))?.link || null;
}

/**
 * Volta da página do Mercado Pago com ?preapproval_id=…: confere a assinatura no Mercado Pago e liga ao profissional.
 * Só aceita assinatura de um plano do Auris, ativa, e que ainda não esteja ligada a outra pessoa.
 */
export async function vincularAssinaturaMp(uid: string, preapprovalId: string) {
  const sb = supabaseAdmin();
  try {
    const pa = await mp<Preapproval & { preapproval_plan_id?: string; payer_id?: number }>(`/preapproval/${encodeURIComponent(preapprovalId)}`);
    const { data: cfg } = await sb.from("auris_config").select("mp_planos").eq("id", 1).maybeSingle();
    const mapa = ((cfg?.mp_planos as Record<string, { id: string }>) || {});
    const achado = Object.entries(mapa).find(([, v]) => v.id === pa.preapproval_plan_id);
    if (!achado) return { ok: false as const, erro: "Assinatura não reconhecida." };
    if (pa.status !== "authorized" && pa.status !== "pending") return { ok: false as const, erro: "A assinatura no Mercado Pago não foi concluída. Tente de novo." };
    const { data: outro } = await sb.from("assinaturas").select("profissional_id").eq("mp_assinatura_id", pa.id).maybeSingle();
    if (outro && outro.profissional_id !== uid) return { ok: false as const, erro: "Esta assinatura já está ligada a outra conta." };
    if (outro) { await sincronizar(uid).catch(() => {}); return { ok: true as const }; }
    const planoId = achado[0].split(":")[0];
    const plano = planoPorId(planoId);
    const { data: atual } = await sb.from("assinaturas").select("pago_ate").eq("profissional_id", uid).maybeSingle();
    const pagoAte = atual?.pago_ate && new Date(atual.pago_ate) > new Date(Date.now() + 2 * 864e5) ? atual.pago_ate : new Date(Date.now() + 2 * 864e5).toISOString();
    await sb.from("assinaturas").upsert({
      profissional_id: uid, plano: planoId, status: "ativa", mp_assinatura_id: pa.id, valor: plano?.valor ?? pa.auto_recurring?.transaction_amount ?? null,
      pago_ate: pagoAte, falha_desde: null, falha_motivo: null, cancelada_em: null, renovacao_automatica: true,
      proxima_cobranca: pa.next_payment_date || null, atualizado_em: new Date().toISOString(),
    });
    await sincronizar(uid).catch(() => {});
    await cartaoDaPrimeiraCobranca(uid).catch(() => {});
    return { ok: true as const };
  } catch (e) {
    console.error("vincular assinatura", String(e).slice(0, 300));
    return { ok: false as const, erro: "Não foi possível confirmar a assinatura agora. Recarregue a página em alguns minutos." };
  }
}

/** Bandeira e 4 últimos números a partir da primeira cobrança aprovada (assinaturas feitas na página do Mercado Pago). */
async function cartaoDaPrimeiraCobranca(uid: string) {
  const sb = supabaseAdmin();
  const { data: c } = await sb.from("auris_cobrancas").select("mp_pagamento_id").eq("profissional_id", uid).eq("origem", "assinatura").eq("status", "approved").order("data", { ascending: false }).limit(1).maybeSingle();
  if (!c?.mp_pagamento_id) return;
  const pg = await mp<{ payment_method_id?: string; card?: { last_four_digits?: string } }>(`/v1/payments/${c.mp_pagamento_id}`);
  if (pg.card?.last_four_digits) await sb.from("assinaturas").update({ cartao_final: pg.card.last_four_digits, cartao_bandeira: pg.payment_method_id || null }).eq("profissional_id", uid);
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
        payer: { email: o.cartao.payer?.email || o.email, ...nomeDoTitular(cartao.titular), ...(o.cartao.payer?.identification?.number ? { identification: o.cartao.payer.identification } : {}) },
        external_reference: `auris-${o.uid}`, statement_descriptor: "AURIS", binary_mode: true,
        additional_info: { payer: nomeDoTitular(cartao.titular), items: [{ id: `plano-${plano.id}`, title: `Auris - plano ${plano.nome}`, description: "Assinatura mensal de software", category_id: "services", quantity: 1, unit_price: plano.valor }] },
      }),
    });
    const sb = supabaseAdmin();
    await sb.from("auris_cobrancas").upsert({ profissional_id: o.uid, mp_pagamento_id: String(pg.id), origem: "avulso", plano: plano.id, valor: plano.valor, status: pg.status, data: new Date().toISOString() }, { onConflict: "mp_pagamento_id" });
    if (pg.status !== "approved") console.error("avulso recusado", pg.id, pg.status, pg.status_detail);
    if (pg.status !== "approved") return { ok: false as const, erro: motivoRecusa(pg.status_detail) };
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
  // Contestação no cartão (chargeback): o mês daquela cobrança deixa de contar como pago.
  // Entra na tolerância de 7 dias, como uma cobrança recusada; os prontuários continuam acessíveis.
  const estornada = lista.find((f) => f.payment?.status === "charged_back" && f.payment.status_detail !== "reimbursed");
  const posterior = estornada && aprovada && new Date(aprovada.debit_date || aprovada.date_created || 0) > new Date(estornada.debit_date || estornada.date_created || 0);
  if (estornada && !posterior) {
    const desde = new Date(estornada.debit_date || estornada.date_created || Date.now());
    if (!a.pago_ate || new Date(a.pago_ate) > desde) upd.pago_ate = desde.toISOString();
    if (pa.status !== "cancelled") upd.status = "falha";
    upd.falha_desde = a.falha_desde || new Date().toISOString();
    upd.falha_motivo = "chargeback";
    if (a.falha_motivo !== "chargeback") console.error("CHARGEBACK assinatura", uid, estornada.payment?.id);
  }
  await sb.from("assinaturas").update(upd).eq("profissional_id", uid);
  if (!a.cartao_final && aprovada) await cartaoDaPrimeiraCobranca(uid).catch(() => {});
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
