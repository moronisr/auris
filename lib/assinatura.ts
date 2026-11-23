import { supabaseAdmin } from "@/lib/admin";
import { planoPorId } from "@/lib/planos";
import { asaas, asaasConfigurado, bandeiraCurta, diaBR, ErroAsaas, statusCobranca } from "@/lib/asaas";

/**
 * Assinatura do Auris paga pelo profissional: cartão de crédito recorrente pelo Asaas, recebido na conta do Auris.
 * O cartão fica guardado no Asaas; o Auris guarda só a bandeira e os 4 últimos números.
 * Os dados do cartão passam pelo servidor do Auris apenas para serem enviados ao Asaas e nunca são gravados nem registrados.
 */
export const cobrancaConfigurada = () => asaasConfigurado();

export type Acesso = "liberado" | "teste" | "ativa" | "aviso" | "bloqueado";

export async function acessoDe(uid: string): Promise<Acesso> {
  const { data } = await supabaseAdmin().rpc("auris_acesso", { uid });
  return (data as Acesso) || "liberado";
}

/** Cartão digitado no formulário do Auris, com os dados do titular que o Asaas pede. */
export type CartaoInformado = {
  nome: string; numero: string; mes: string; ano: string; cvv: string;
  titular: { nome: string; email: string; cpf: string; cep: string; numeroEndereco: string; celular: string };
  /** CPF do profissional, quando o cartão é de outra pessoa. */
  cpfProfissional?: string;
};

const soDigitos = (s: unknown) => String(s ?? "").replace(/\D/g, "");

/** Confere o formato antes de enviar ao Asaas. Devolve a mensagem do primeiro problema ou null. */
export function validarCartao(c: CartaoInformado | null | undefined): string | null {
  if (!c) return "Informe os dados do cartão.";
  const n = soDigitos(c.numero);
  if (n.length < 13 || n.length > 19) return "Confira o número do cartão.";
  const mes = Number(c.mes), ano = Number(soDigitos(c.ano).length === 2 ? `20${soDigitos(c.ano)}` : soDigitos(c.ano));
  if (!(mes >= 1 && mes <= 12) || !(ano >= 2024 && ano <= 2060)) return "Confira a validade do cartão.";
  if (!/^\d{3,4}$/.test(soDigitos(c.cvv))) return "Confira o código de segurança do cartão.";
  if ((c.nome || "").trim().length < 3) return "Informe o nome como está no cartão.";
  if (soDigitos(c.titular?.cpf).length !== 11 && soDigitos(c.titular?.cpf).length !== 14) return "Confira o CPF do titular do cartão.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((c.titular?.email || "").trim())) return "Confira o e-mail do titular do cartão.";
  if (soDigitos(c.titular?.cep).length !== 8) return "Confira o CEP do titular do cartão.";
  if (!(c.titular?.numeroEndereco || "").trim()) return "Informe o número do endereço do titular.";
  if (soDigitos(c.titular?.celular).length < 10) return "Confira o celular do titular do cartão, com DDD.";
  if (c.cpfProfissional !== undefined && soDigitos(c.cpfProfissional).length !== 11) return "Confira o seu CPF.";
  return null;
}

function corpoCartao(c: CartaoInformado, ip: string) {
  const ano = soDigitos(c.ano).length === 2 ? `20${soDigitos(c.ano)}` : soDigitos(c.ano);
  return {
    creditCard: { holderName: c.nome.trim(), number: soDigitos(c.numero), expiryMonth: String(Number(c.mes)).padStart(2, "0"), expiryYear: ano, ccv: soDigitos(c.cvv) },
    creditCardHolderInfo: {
      name: (c.titular.nome || c.nome).trim(), email: c.titular.email.trim().toLowerCase(), cpfCnpj: soDigitos(c.titular.cpf),
      postalCode: soDigitos(c.titular.cep), addressNumber: c.titular.numeroEndereco.trim().slice(0, 20), mobilePhone: soDigitos(c.titular.celular),
    },
    remoteIp: ip,
  };
}

/** Bandeira pelo início do número, para quando o Asaas não devolver. */
function bandeiraPeloNumero(n: string): string | null {
  if (/^4/.test(n)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(n)) return "master";
  if (/^3[47]/.test(n)) return "amex";
  if (/^(606282|3841)/.test(n)) return "hipercard";
  if (/^(4011|4312|4389|4514|4576|5041|5066|5067|509|6277|6362|6363|650|6516|6550)/.test(n)) return "elo";
  return null;
}

const NADA_COBRADO = " Nenhum valor foi cobrado.";

/** Mensagem clara para o profissional a partir do erro do Asaas. */
function motivoAsaas(e: unknown): string {
  if (e instanceof ErroAsaas) {
    const d = e.descricao;
    if (e.status === 401) return "A cobrança do Auris está em manutenção. Tente de novo em alguns minutos.";
    if (/cpf|cnpj/i.test(d)) return "Confira o CPF do titular do cartão." + NADA_COBRADO;
    if (/cep|postal/i.test(d)) return "Confira o CEP do titular do cartão." + NADA_COBRADO;
    if (/telefone|celular|phone/i.test(d)) return "Confira o celular do titular do cartão, com DDD." + NADA_COBRADO;
    if (/validade|expir/i.test(d)) return "Confira a validade do cartão." + NADA_COBRADO;
    if (/seguran|ccv|cvv/i.test(d)) return "Confira o código de segurança do cartão." + NADA_COBRADO;
    if (d) return (/[.!]$/.test(d) ? d : `${d}.`) + NADA_COBRADO;
    if (e.status >= 500) return "O Asaas não respondeu agora. Tente de novo em alguns minutos." + NADA_COBRADO;
  }
  if (/timeout|abort/i.test(String(e))) return "A confirmação demorou mais que o normal. Confira o histórico de cobranças antes de tentar de novo.";
  return "Não foi possível concluir o pagamento agora. Tente de novo em alguns minutos." + NADA_COBRADO;
}

type Cliente = { id: string };
type Assinatura = { id: string; status: string; nextDueDate?: string; deleted?: boolean; value?: number; creditCard?: { creditCardNumber?: string; creditCardBrand?: string } };
type Cobranca = {
  id: string; status: string; value: number; dueDate: string; paymentDate?: string | null; confirmedDate?: string | null; dateCreated?: string; deleted?: boolean;
  creditCard?: { creditCardNumber?: string; creditCardBrand?: string };
};

/** Cliente do profissional no Asaas: criado uma vez e guardado em assinaturas.asaas_cliente_id. */
async function clienteDoProfissional(uid: string, email: string, cpf: string): Promise<string> {
  const sb = supabaseAdmin();
  const { data: a } = await sb.from("assinaturas").select("asaas_cliente_id").eq("profissional_id", uid).maybeSingle();
  if (a?.asaas_cliente_id) return a.asaas_cliente_id;
  const { data: prof } = await sb.from("profissionais").select("nome").eq("id", uid).maybeSingle();
  const c = await asaas<Cliente>("/customers", {
    method: "POST",
    body: JSON.stringify({ name: (prof?.nome || email).slice(0, 100), email, cpfCnpj: cpf, externalReference: uid, notificationDisabled: true }),
  });
  await sb.from("assinaturas").upsert({ profissional_id: uid, asaas_cliente_id: c.id, atualizado_em: new Date().toISOString() }, { onConflict: "profissional_id" });
  return c.id;
}

const cpfDoCliente = (c: CartaoInformado) => soDigitos(c.cpfProfissional || c.titular.cpf);
const pago = (s: string) => /^(CONFIRMED|RECEIVED|RECEIVED_IN_CASH)$/.test(s);
/** Datas do Asaas vêm sem hora (AAAA-MM-DD): lidas ao meio-dia de Brasília, para não virar o dia anterior. */
const dataBR = (d?: string | null) => (d ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T12:00:00-03:00` : d) : new Date());

async function registrarCobranca(uid: string, c: Cobranca, origem: "assinatura" | "avulso", plano: string | null) {
  await supabaseAdmin().from("auris_cobrancas").upsert({
    profissional_id: uid, gateway_pagamento_id: c.id, origem, plano, valor: c.value,
    status: c.deleted ? "cancelled" : statusCobranca(c.status), data: dataBR(c.confirmedDate || c.paymentDate || c.dueDate).toISOString(),
  }, { onConflict: "gateway_pagamento_id" });
}

/** Cria a assinatura com o cartão. Durante o teste grátis, a primeira cobrança é só no fim do teste. */
export async function assinar(o: { uid: string; email: string; planoId: string; cartao: CartaoInformado; ip: string; fimTeste: Date | null }) {
  const plano = planoPorId(o.planoId);
  if (!plano) return { ok: false as const, erro: "Plano inválido." };
  const sb = supabaseAdmin();
  const { data: atual } = await sb.from("assinaturas").select("pago_ate").eq("profissional_id", o.uid).maybeSingle();
  const pagoAte = atual?.pago_ate ? new Date(atual.pago_ate) : null;
  const candidatos = [o.fimTeste, pagoAte].filter((d): d is Date => !!d && diaBR(d) > diaBR());
  // Sem cobrar duas vezes: a renovação começa no fim do teste grátis ou do período que já foi pago.
  const inicio = candidatos.length ? new Date(Math.max(...candidatos.map((d) => d.getTime()))) : null;
  let assinaturaId: string | null = null;
  try {
    const cliente = await clienteDoProfissional(o.uid, o.email, cpfDoCliente(o.cartao));
    const s = await asaas<Assinatura>("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        customer: cliente, billingType: "CREDIT_CARD", value: plano.valor, cycle: "MONTHLY",
        nextDueDate: diaBR(inicio || new Date()), description: `Auris - plano ${plano.nome}`, externalReference: o.uid,
        ...corpoCartao(o.cartao, o.ip),
      }),
    });
    assinaturaId = s.id;
    const numero = soDigitos(o.cartao.numero);
    const base = {
      profissional_id: o.uid, plano: plano.id, status: "ativa", gateway_assinatura_id: s.id, valor: plano.valor,
      cartao_final: s.creditCard?.creditCardNumber || numero.slice(-4), cartao_bandeira: bandeiraCurta(s.creditCard?.creditCardBrand) || bandeiraPeloNumero(numero),
      teste_ate: o.fimTeste?.toISOString() ?? null, falha_desde: null, falha_motivo: null, cancelada_em: null, renovacao_automatica: true,
      proxima_cobranca: s.nextDueDate ? new Date(`${s.nextDueDate}T12:00:00-03:00`).toISOString() : null, atualizado_em: new Date().toISOString(),
    };
    if (inicio) {
      await sb.from("assinaturas").upsert({ ...base, pago_ate: inicio.toISOString() }, { onConflict: "profissional_id" });
      return { ok: true as const };
    }
    // Vencimento hoje: o Asaas cobra na hora. Confere a primeira cobrança antes de dar o plano como ativo.
    let primeira: Cobranca | undefined;
    for (let i = 0; i < 4 && !(primeira && primeira.status !== "PENDING"); i++) {
      if (i) await new Promise((r) => setTimeout(r, 2500));
      primeira = (await asaas<{ data: Cobranca[] }>(`/subscriptions/${s.id}/payments?limit=1`)).data?.[0];
    }
    if (primeira) await registrarCobranca(o.uid, primeira, "assinatura", plano.id);
    if (primeira && (primeira.status === "OVERDUE" || primeira.status === "REFUNDED")) {
      await asaas(`/subscriptions/${s.id}`, { method: "DELETE" }).catch(() => {});
      return { ok: false as const, erro: "O banco recusou o cartão. Use outro cartão ou fale com o seu banco." + NADA_COBRADO };
    }
    const ate = new Date(); ate.setMonth(ate.getMonth() + 1);
    await sb.from("assinaturas").upsert({
      ...base, pago_ate: primeira && pago(primeira.status) ? ate.toISOString() : new Date(Date.now() + 2 * 864e5).toISOString(),
      ...(primeira && pago(primeira.status) ? { ultimo_pagamento_em: new Date().toISOString(), ultimo_pagamento_id: primeira.id } : {}),
    }, { onConflict: "profissional_id" });
    return { ok: true as const };
  } catch (e) {
    console.error("assinar", String(e).slice(0, 400));
    if (assinaturaId) await asaas(`/subscriptions/${assinaturaId}`, { method: "DELETE" }).catch(() => {});
    return { ok: false as const, erro: motivoAsaas(e) };
  }
}

/** Paga só um mês, sem guardar o cartão para as próximas cobranças. */
export async function pagarAvulso(o: { uid: string; email: string; planoId: string; cartao: CartaoInformado; ip: string; fimTeste: Date | null }) {
  const plano = planoPorId(o.planoId);
  if (!plano) return { ok: false as const, erro: "Plano inválido." };
  const sb = supabaseAdmin();
  try {
    const cliente = await clienteDoProfissional(o.uid, o.email, cpfDoCliente(o.cartao));
    const pg = await asaas<Cobranca>("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: cliente, billingType: "CREDIT_CARD", value: plano.valor, dueDate: diaBR(),
        description: `Auris - plano ${plano.nome} (1 mês)`, externalReference: `avulso-${o.uid}`, ...corpoCartao(o.cartao, o.ip),
      }),
    });
    await registrarCobranca(o.uid, pg, "avulso", plano.id);
    if (!pago(pg.status)) {
      console.error("avulso nao confirmado", pg.id, pg.status);
      if (pg.status === "AWAITING_RISK_ANALYSIS") return { ok: false as const, erro: "O pagamento está em análise pelo Asaas. Você recebe a confirmação aqui em até algumas horas." };
      return { ok: false as const, erro: "O banco recusou o cartão. Use outro cartão ou fale com o seu banco." + NADA_COBRADO };
    }
    const { data: atual } = await sb.from("assinaturas").select("pago_ate, gateway_assinatura_id").eq("profissional_id", o.uid).maybeSingle();
    const base = Math.max(Date.now(), o.fimTeste?.getTime() || 0, atual?.pago_ate ? new Date(atual.pago_ate).getTime() : 0);
    const ate = new Date(base); ate.setMonth(ate.getMonth() + 1);
    const numero = soDigitos(o.cartao.numero);
    await sb.from("assinaturas").upsert({
      profissional_id: o.uid, plano: plano.id, valor: plano.valor, status: "ativa", renovacao_automatica: !!atual?.gateway_assinatura_id,
      pago_ate: ate.toISOString(), ultimo_pagamento_em: new Date().toISOString(), ultimo_pagamento_id: pg.id,
      ...(atual?.gateway_assinatura_id ? {} : { cartao_final: pg.creditCard?.creditCardNumber || numero.slice(-4), cartao_bandeira: bandeiraCurta(pg.creditCard?.creditCardBrand) || bandeiraPeloNumero(numero), proxima_cobranca: null }),
      falha_desde: null, falha_motivo: null, cancelada_em: null, atualizado_em: new Date().toISOString(),
    }, { onConflict: "profissional_id" });
    return { ok: true as const, ate: ate.toISOString() };
  } catch (e) {
    console.error("avulso", String(e).slice(0, 400));
    return { ok: false as const, erro: motivoAsaas(e) };
  }
}

/** Remove o cartão: a renovação automática para. O acesso continua até o fim do período já pago. */
export async function removerCartao(uid: string) {
  const sb = supabaseAdmin();
  const { data: a } = await sb.from("assinaturas").select("gateway_assinatura_id").eq("profissional_id", uid).maybeSingle();
  if (!a) return { ok: false as const, erro: "Não há cartão cadastrado." };
  try {
    if (a.gateway_assinatura_id) await asaas(`/subscriptions/${a.gateway_assinatura_id}`, { method: "DELETE" });
    await sb.from("assinaturas").update({ gateway_assinatura_id: null, cartao_final: null, cartao_bandeira: null, renovacao_automatica: false, proxima_cobranca: null, atualizado_em: new Date().toISOString() }).eq("profissional_id", uid);
    return { ok: true as const };
  } catch (e) {
    console.error("remover cartao", String(e).slice(0, 300));
    return { ok: false as const, erro: motivoAsaas(e) };
  }
}

/** Troca o cartão da assinatura sem cobrar na hora. Cobranças pendentes passam a usar o novo cartão. */
export async function trocarCartao(uid: string, cartao: CartaoInformado, ip: string) {
  const sb = supabaseAdmin();
  const { data: a } = await sb.from("assinaturas").select("gateway_assinatura_id, status").eq("profissional_id", uid).maybeSingle();
  if (!a?.gateway_assinatura_id) return { ok: false as const, erro: "Você ainda não tem assinatura." };
  try {
    const s = await asaas<Assinatura>(`/subscriptions/${a.gateway_assinatura_id}/creditCard`, { method: "PUT", body: JSON.stringify(corpoCartao(cartao, ip)) });
    const numero = soDigitos(cartao.numero);
    await sb.from("assinaturas").update({
      cartao_final: s.creditCard?.creditCardNumber || numero.slice(-4), cartao_bandeira: bandeiraCurta(s.creditCard?.creditCardBrand) || bandeiraPeloNumero(numero), atualizado_em: new Date().toISOString(),
    }).eq("profissional_id", uid);
    await sincronizar(uid).catch(() => {});
    return { ok: true as const };
  } catch (e) {
    console.error("trocar cartao", String(e).slice(0, 300));
    return { ok: false as const, erro: motivoAsaas(e) };
  }
}

/** Muda o plano: o novo valor vale a partir da próxima cobrança. */
export async function trocarPlano(uid: string, planoId: string) {
  const plano = planoPorId(planoId);
  const { data: a } = await supabaseAdmin().from("assinaturas").select("gateway_assinatura_id").eq("profissional_id", uid).maybeSingle();
  if (!plano || !a?.gateway_assinatura_id) return { ok: false as const, erro: "Assinatura ou plano não encontrado." };
  try {
    await asaas(`/subscriptions/${a.gateway_assinatura_id}`, { method: "PUT", body: JSON.stringify({ value: plano.valor, description: `Auris - plano ${plano.nome}`, updatePendingPayments: true }) });
    await supabaseAdmin().from("assinaturas").update({ plano: plano.id, valor: plano.valor, atualizado_em: new Date().toISOString() }).eq("profissional_id", uid);
    return { ok: true as const };
  } catch (e) {
    console.error("trocar plano", String(e).slice(0, 300));
    return { ok: false as const, erro: motivoAsaas(e) };
  }
}

/** Cancela a renovação. O acesso continua até o fim do período já pago. */
export async function cancelarAssinatura(uid: string) {
  const sb = supabaseAdmin();
  const { data: a } = await sb.from("assinaturas").select("gateway_assinatura_id").eq("profissional_id", uid).maybeSingle();
  try {
    if (a?.gateway_assinatura_id) await asaas(`/subscriptions/${a.gateway_assinatura_id}`, { method: "DELETE" });
    await sb.from("assinaturas").update({ status: "cancelada", gateway_assinatura_id: null, renovacao_automatica: false, cancelada_em: new Date().toISOString(), proxima_cobranca: null, atualizado_em: new Date().toISOString() }).eq("profissional_id", uid);
    return { ok: true as const };
  } catch (e) {
    console.error("cancelar", String(e).slice(0, 300));
    return { ok: false as const, erro: motivoAsaas(e) };
  }
}

/**
 * Atualiza a assinatura consultando o Asaas (nunca confia no aviso recebido).
 * Cobrança paga: acesso até um mês depois do vencimento dela. Atrasada (cartão recusado): começa a contagem de 7 dias de tolerância.
 */
export async function sincronizar(uid: string): Promise<void> {
  const sb = supabaseAdmin();
  const { data: a } = await sb.from("assinaturas").select("*").eq("profissional_id", uid).maybeSingle();
  if (!a?.gateway_assinatura_id || !asaasConfigurado()) return;
  const s = await asaas<Assinatura>(`/subscriptions/${a.gateway_assinatura_id}`);
  const lista = (await asaas<{ data: Cobranca[] }>(`/subscriptions/${a.gateway_assinatura_id}/payments?limit=10`).catch(() => ({ data: [] as Cobranca[] }))).data || [];
  lista.sort((x, y) => (y.dueDate || "").localeCompare(x.dueDate || ""));
  for (const c of lista) await registrarCobranca(uid, c, "assinatura", a.plano);
  const aprovada = lista.find((c) => pago(c.status) && !c.deleted);
  const ultima = lista.find((c) => !c.deleted && c.status !== "PENDING" && c.status !== "AWAITING_RISK_ANALYSIS");
  const upd: Record<string, unknown> = {
    proxima_cobranca: s.nextDueDate ? new Date(`${s.nextDueDate}T12:00:00-03:00`).toISOString() : null, atualizado_em: new Date().toISOString(),
  };
  if (aprovada) {
    const ate = new Date(`${aprovada.dueDate}T12:00:00-03:00`); ate.setMonth(ate.getMonth() + 1);
    if (!a.pago_ate || new Date(a.pago_ate) < ate) upd.pago_ate = ate.toISOString();
    upd.ultimo_pagamento_em = dataBR(aprovada.confirmedDate || aprovada.paymentDate || aprovada.dueDate).toISOString();
    upd.ultimo_pagamento_id = aprovada.id;
  }
  if (s.deleted || s.status === "INACTIVE" || s.status === "EXPIRED") {
    upd.status = "cancelada"; upd.proxima_cobranca = null;
  } else if (ultima && ultima.status === "OVERDUE" && (!aprovada || ultima.dueDate > aprovada.dueDate)) {
    upd.status = "falha"; upd.falha_desde = a.falha_desde || new Date(`${ultima.dueDate}T12:00:00-03:00`).toISOString(); upd.falha_motivo = "recusado";
  } else {
    upd.status = "ativa"; upd.falha_desde = null; upd.falha_motivo = null;
  }
  // Contestação no cartão (chargeback): o mês daquela cobrança deixa de contar como pago e entra na tolerância de 7 dias.
  const estornada = lista.find((c) => /CHARGEBACK/.test(c.status));
  const posterior = estornada && aprovada && aprovada.dueDate > estornada.dueDate;
  if (estornada && !posterior) {
    const desde = new Date(`${estornada.dueDate}T12:00:00-03:00`);
    if (!a.pago_ate || new Date(a.pago_ate) > desde) upd.pago_ate = desde.toISOString();
    if (upd.status !== "cancelada") upd.status = "falha";
    upd.falha_desde = a.falha_desde || new Date().toISOString();
    upd.falha_motivo = "chargeback";
    if (a.falha_motivo !== "chargeback") console.error("CHARGEBACK assinatura", uid, estornada.id);
  }
  await sb.from("assinaturas").update(upd).eq("profissional_id", uid);
}

export async function sincronizarPorAssinatura(id: string) {
  const { data } = await supabaseAdmin().from("assinaturas").select("profissional_id").eq("gateway_assinatura_id", id).maybeSingle();
  if (data) await sincronizar(data.profissional_id);
}

/** Aviso de uma cobrança avulsa (fora da assinatura): só atualiza o histórico. */
export async function atualizarCobrancaAvulsa(c: Cobranca) {
  const { data } = await supabaseAdmin().from("auris_cobrancas").select("profissional_id, plano").eq("gateway_pagamento_id", c.id).maybeSingle();
  if (data) await registrarCobranca(data.profissional_id, c, "avulso", data.plano);
}

/** Rotina diária: todas as assinaturas ativas, com falha ou canceladas que ainda têm assinatura no Asaas. */
export async function sincronizarTodas(): Promise<number> {
  const { data } = await supabaseAdmin().from("assinaturas").select("profissional_id").in("status", ["ativa", "falha", "cancelada"]).not("gateway_assinatura_id", "is", null).limit(200);
  let n = 0;
  for (const a of data || []) { try { await sincronizar(a.profissional_id); n++; } catch (e) { console.error("sync assinatura", String(e).slice(0, 200)); } }
  return n;
}
