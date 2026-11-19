import { supabaseAdmin } from "@/lib/admin";
import { cancelarPixPendente, chaveDoProfissional, confirmarPeloMercadoPago, criarCobranca, criarPixMercadoPago, type Metodo } from "@/lib/mercadopago";
import { criarCobrancaPagBank, pagamentoPagBank } from "@/lib/pagbank";

/** Pagamento online do profissional, pela instituição que ele conectou (Mercado Pago ou PagBank). */
export type Provedor = "mercadopago" | "pagbank";
export const NOME_PROVEDOR: Record<Provedor, string> = { mercadopago: "Mercado Pago", pagbank: "PagBank" };

async function credencial(profissionalId: string) {
  const sb = supabaseAdmin();
  const { data: p } = await sb.from("profissionais").select("pg_provedor, mp_conectado").eq("id", profissionalId).maybeSingle();
  if (!p?.mp_conectado) return null;
  if (p.pg_provedor === "pagbank") {
    const { data: s } = await sb.from("profissionais_segredos").select("pagbank_token, pagbank_sandbox").eq("profissional_id", profissionalId).maybeSingle();
    return s?.pagbank_token ? { provedor: "pagbank" as const, token: s.pagbank_token, sandbox: !!s.pagbank_sandbox } : null;
  }
  const token = await chaveDoProfissional(profissionalId);
  return token ? { provedor: "mercadopago" as const, token, sandbox: false } : null;
}

/** Pix direto (QR Code na página do Auris). Hoje só pelo Mercado Pago; nos outros casos retorna null. */
export async function criarPixOnline(o: {
  profissionalId: string; teleId: string; codigo: string; valor: number; titulo: string; expira: Date; base: string; email?: string | null; anterior?: string | null;
}): Promise<{ pagamentoId: string; codigo: string; imagem: string; expira: string } | null> {
  const c = await credencial(o.profissionalId);
  if (!c || c.provedor !== "mercadopago") return null;
  if (o.anterior) await cancelarPixPendente(c.token, o.anterior);
  return criarPixMercadoPago({ token: c.token, ...o });
}

export async function criarCobrancaOnline(o: {
  profissionalId: string; teleId: string; codigo: string; valor: number; titulo: string; metodo: Metodo; expira: Date; base: string; email?: string | null;
}): Promise<{ url: string; cobrancaId: string; provedor: Provedor } | null> {
  const c = await credencial(o.profissionalId);
  if (!c) return null;
  if (c.provedor === "pagbank") {
    const r = await criarCobrancaPagBank({ token: c.token, sandbox: c.sandbox, ...o });
    return { ...r, provedor: "pagbank" };
  }
  const r = await criarCobranca({ token: c.token, ...o });
  return { url: r.url, cobrancaId: r.preferenciaId, provedor: "mercadopago" };
}

/**
 * Confirma o pagamento consultando a instituição em que a cobrança foi criada.
 * Nada que venha do navegador ou do corpo de um aviso confirma pagamento.
 */
export async function confirmarPagamento(teleId: string, dica?: string): Promise<string> {
  const sb = supabaseAdmin();
  const { data: t } = await sb.from("teleconsultas").select("id, profissional_id, valor, pagamento_status, status, pg_provedor, mp_preferencia_id").eq("id", teleId).maybeSingle();
  if (!t) return "nao_encontrada";
  if (t.pagamento_status === "confirmado" || t.pagamento_status === "isento") return t.pagamento_status;
  if (t.pg_provedor !== "pagbank") return confirmarPeloMercadoPago(teleId, dica);
  if (!t.mp_preferencia_id) return t.pagamento_status;
  const { data: s } = await sb.from("profissionais_segredos").select("pagbank_token, pagbank_sandbox").eq("profissional_id", t.profissional_id).maybeSingle();
  if (!s?.pagbank_token) return t.pagamento_status;
  const pago = await pagamentoPagBank(s.pagbank_token, !!s.pagbank_sandbox, t.mp_preferencia_id, Number(t.valor || 0));
  if (!pago) return t.pagamento_status;
  await sb.from("teleconsultas").update({
    pagamento_status: "confirmado", pagamento_confirmado_em: pago.em, pagamento_metodo: pago.metodo, mp_pagamento_id: pago.id,
    reserva_expira_em: null, status: t.status === "agendada" ? "confirmada" : t.status,
  }).eq("id", teleId).neq("pagamento_status", "confirmado");
  return "confirmado";
}
