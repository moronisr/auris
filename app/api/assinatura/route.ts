import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { PLANOS } from "@/lib/planos";
import { acessoDe, assinar, cancelarAssinatura, cobrancaConfigurada, pagarAvulso, removerCartao, sincronizar, trocarCartao, trocarPlano } from "@/lib/assinatura";

export const runtime = "nodejs";

const admins = () => (process.env.AURIS_ADMINS || "").split(",").map((s) => s.trim()).filter(Boolean);

async function usuario() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

/** Situação da assinatura do profissional logado. */
export async function GET() {
  const user = await usuario();
  if (!user) return NextResponse.json({ erro: "Entre na sua conta." }, { status: 401 });
  const sb = supabaseAdmin();
  let { data: a } = await sb.from("assinaturas").select("plano, status, cartao_final, cartao_bandeira, valor, pago_ate, ultimo_pagamento_em, falha_desde, proxima_cobranca, cancelada_em, atualizado_em, mp_assinatura_id, renovacao_automatica").eq("profissional_id", user.id).maybeSingle();
  // Confere no Mercado Pago se faz mais de 6 horas, ou se o período pago venceu.
  if (a?.mp_assinatura_id && (Date.now() - new Date(a.atualizado_em).getTime() > 6 * 3600e3 || (a.pago_ate && new Date(a.pago_ate) < new Date()))) {
    await sincronizar(user.id).catch(() => {});
    ({ data: a } = await sb.from("assinaturas").select("plano, status, cartao_final, cartao_bandeira, valor, pago_ate, ultimo_pagamento_em, falha_desde, proxima_cobranca, cancelada_em, atualizado_em, mp_assinatura_id, renovacao_automatica").eq("profissional_id", user.id).maybeSingle());
  }
  const [{ data: cfg }, { data: fimTeste }, acesso] = await Promise.all([
    sb.from("auris_config").select("cobranca_ativa").eq("id", 1).maybeSingle(),
    sb.rpc("auris_fim_teste", { uid: user.id }),
    acessoDe(user.id),
  ]);
  const admin = admins().includes(user.id);
  const { data: cobrancas } = await sb.from("auris_cobrancas").select("data, valor, status, origem, plano").eq("profissional_id", user.id).order("data", { ascending: false }).limit(24);
  return NextResponse.json({
    acesso, cobrancaAtiva: !!cfg?.cobranca_ativa, configurada: cobrancaConfigurada(), fimTeste,
    assinatura: a ? { ...a, mp_assinatura_id: undefined, atualizado_em: undefined, recorrente: !!a.mp_assinatura_id } : null,
    cobrancas: cobrancas || [],
    planos: PLANOS.filter((p) => !p.oculto || admin), publicKey: process.env.MP_AURIS_PUBLIC_KEY || null, email: user.email,
  });
}

export async function POST(req: Request) {
  const user = await usuario();
  if (!user) return NextResponse.json({ erro: "Entre na sua conta." }, { status: 401 });
  if (!cobrancaConfigurada()) return NextResponse.json({ erro: "A assinatura ainda não está disponível. Tente mais tarde." }, { status: 503 });
  const b = (await req.json().catch(() => null)) as { acao?: string; plano?: string; cartao?: { token?: string; payment_method_id?: string; issuer_id?: string; payer?: { email?: string; identification?: { type: string; number: string } }; aparelho?: string } } | null;
  const plano = PLANOS.find((p) => p.id === b?.plano);
  if (plano?.oculto && !admins().includes(user.id)) return NextResponse.json({ erro: "Plano inválido." }, { status: 400 });
  let r: { ok: boolean; erro?: string };
  if (b?.acao === "assinar") {
    if (!plano || !b.cartao?.token) return NextResponse.json({ erro: "Escolha o plano e informe o cartão." }, { status: 400 });
    const { data: atual } = await supabaseAdmin().from("assinaturas").select("status, mp_assinatura_id").eq("profissional_id", user.id).maybeSingle();
    if (atual?.mp_assinatura_id) return NextResponse.json({ erro: "Você já tem um cartão cadastrado. Use Trocar cartão ou Mudar de plano." }, { status: 409 });
    const { data: fim } = await supabaseAdmin().rpc("auris_fim_teste", { uid: user.id });
    const { data: cfg } = await supabaseAdmin().from("auris_config").select("cobranca_ativa").eq("id", 1).maybeSingle();
    // Com a cobrança ainda desligada (fase de testes), cobra na hora; com ela ligada, só no fim do teste grátis.
    const fimTeste = cfg?.cobranca_ativa && fim ? new Date(fim as string) : null;
    r = await assinar({ uid: user.id, email: user.email || "", planoId: plano.id, cardToken: b.cartao.token, payerEmail: b.cartao.payer?.email, fimTeste: atual?.status === "cancelada" ? null : fimTeste, base: new URL(req.url).origin });
  } else if (b?.acao === "pagar_avulso") {
    if (!plano || !b.cartao?.token || !b.cartao.payment_method_id) return NextResponse.json({ erro: "Escolha o plano e informe o cartão." }, { status: 400 });
    const { data: fim } = await supabaseAdmin().rpc("auris_fim_teste", { uid: user.id });
    const { data: cfg } = await supabaseAdmin().from("auris_config").select("cobranca_ativa").eq("id", 1).maybeSingle();
    r = await pagarAvulso({ uid: user.id, email: user.email || "", planoId: plano.id, fimTeste: cfg?.cobranca_ativa && fim ? new Date(fim as string) : null,
      cartao: { token: b.cartao.token, payment_method_id: b.cartao.payment_method_id, issuer_id: b.cartao.issuer_id, payer: b.cartao.payer, aparelho: /^[\w-]{8,100}$/.test(b.cartao.aparelho || "") ? b.cartao.aparelho : undefined } });
  } else if (b?.acao === "remover_cartao") {
    r = await removerCartao(user.id);
  } else if (b?.acao === "trocar_cartao") {
    if (!b.cartao?.token) return NextResponse.json({ erro: "Informe o novo cartão." }, { status: 400 });
    r = await trocarCartao(user.id, b.cartao.token);
  } else if (b?.acao === "trocar_plano") {
    if (!plano) return NextResponse.json({ erro: "Plano inválido." }, { status: 400 });
    r = await trocarPlano(user.id, plano.id);
  } else if (b?.acao === "cancelar") {
    r = await cancelarAssinatura(user.id);
    const motivo = String((b as { motivo?: string }).motivo || "").slice(0, 120);
    if (r.ok && motivo) await supabaseAdmin().from("assinaturas").update({ cancelamento_motivo: motivo }).eq("profissional_id", user.id);
  } else {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ erro: r.erro }, { status: 402 });
}
