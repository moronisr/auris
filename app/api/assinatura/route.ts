import { NextResponse } from "next/server";
import { idsAdmin, supabaseAdmin } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { PLANOS } from "@/lib/planos";
import { acessoDe, assinar, cancelarAssinatura, cobrancaConfigurada, pagarAvulso, removerCartao, sincronizar, trocarCartao, trocarPlano, validarCartao, type CartaoInformado } from "@/lib/assinatura";

export const runtime = "nodejs";
export const maxDuration = 60;

/** IP de quem está pagando (o Asaas usa na análise antifraude). */
const ipDe = (req: Request) => (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "0.0.0.0";

const admins = idsAdmin;

/** Plano interno de R$ 5: só o dono e as contas que ele liberar no Painel (teste de cobrança). */
async function podeVerTeste(uid: string) {
  const { data } = await supabaseAdmin().from("profissionais").select("plano_teste").eq("id", uid).maybeSingle();
  return !!data?.plano_teste;
}

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
  let { data: a } = await sb.from("assinaturas").select("plano, status, cartao_final, cartao_bandeira, valor, pago_ate, ultimo_pagamento_em, falha_desde, falha_motivo, proxima_cobranca, cancelada_em, atualizado_em, gateway_assinatura_id, renovacao_automatica, cortesia_ate").eq("profissional_id", user.id).maybeSingle();
  // Confere no Asaas se faz mais de 6 horas, ou se o período pago venceu.
  if (a?.gateway_assinatura_id && (Date.now() - new Date(a.atualizado_em).getTime() > 6 * 3600e3 || (a.pago_ate && new Date(a.pago_ate) < new Date()))) {
    await sincronizar(user.id).catch(() => {});
    ({ data: a } = await sb.from("assinaturas").select("plano, status, cartao_final, cartao_bandeira, valor, pago_ate, ultimo_pagamento_em, falha_desde, falha_motivo, proxima_cobranca, cancelada_em, atualizado_em, gateway_assinatura_id, renovacao_automatica, cortesia_ate").eq("profissional_id", user.id).maybeSingle());
  }
  const [{ data: cfg }, { data: fimTeste }, acesso] = await Promise.all([
    sb.from("auris_config").select("cobranca_ativa").eq("id", 1).maybeSingle(),
    sb.rpc("auris_fim_teste", { uid: user.id }),
    acessoDe(user.id),
  ]);
  const admin = admins().includes(user.id);
  const testeLiberado = admin || (await podeVerTeste(user.id));
  const { data: cobrancas } = await sb.from("auris_cobrancas").select("data, valor, status, origem, plano").eq("profissional_id", user.id).order("data", { ascending: false }).limit(24);
  return NextResponse.json({
    acesso, cobrancaAtiva: !!cfg?.cobranca_ativa, configurada: cobrancaConfigurada(), fimTeste,
    assinatura: a ? { ...a, gateway_assinatura_id: undefined, atualizado_em: undefined, recorrente: !!a.gateway_assinatura_id } : null,
    cobrancas: cobrancas || [],
    planos: PLANOS.filter((p) => !p.oculto || testeLiberado), admin, email: user.email,
  });
}

export async function POST(req: Request) {
  const user = await usuario();
  if (!user) return NextResponse.json({ erro: "Entre na sua conta." }, { status: 401 });
  if (!cobrancaConfigurada()) return NextResponse.json({ erro: "A assinatura ainda não está disponível. Tente mais tarde." }, { status: 503 });
  const b = (await req.json().catch(() => null)) as { acao?: string; plano?: string; motivo?: string; cartao?: CartaoInformado } | null;
  const plano = PLANOS.find((p) => p.id === b?.plano);
  if (plano?.oculto && !admins().includes(user.id) && !(await podeVerTeste(user.id))) return NextResponse.json({ erro: "Plano inválido." }, { status: 400 });
  const precisaCartao = b?.acao === "assinar" || b?.acao === "pagar_avulso" || b?.acao === "trocar_cartao";
  if (precisaCartao) {
    const erroCartao = validarCartao(b?.cartao);
    if (erroCartao) return NextResponse.json({ erro: erroCartao }, { status: 400 });
  }
  const sb = supabaseAdmin();
  const fimTesteAtual = async () => {
    const [{ data: fim }, { data: cfg }] = await Promise.all([sb.rpc("auris_fim_teste", { uid: user.id }), sb.from("auris_config").select("cobranca_ativa").eq("id", 1).maybeSingle()]);
    // Com a cobrança ainda desligada (fase de testes), cobra na hora; com ela ligada, só no fim do teste grátis.
    return cfg?.cobranca_ativa && fim ? new Date(fim as string) : null;
  };
  let r: { ok: boolean; erro?: string };
  if (b?.acao === "assinar") {
    if (!plano) return NextResponse.json({ erro: "Escolha o plano." }, { status: 400 });
    const { data: atual } = await sb.from("assinaturas").select("status, gateway_assinatura_id").eq("profissional_id", user.id).maybeSingle();
    if (atual?.gateway_assinatura_id) return NextResponse.json({ erro: "Você já tem um cartão cadastrado. Use Trocar cartão ou Mudar de plano." }, { status: 409 });
    const fimTeste = await fimTesteAtual();
    r = await assinar({ uid: user.id, email: user.email || "", planoId: plano.id, cartao: b.cartao!, ip: ipDe(req), fimTeste: atual?.status === "cancelada" ? null : fimTeste });
  } else if (b?.acao === "pagar_avulso") {
    if (!plano) return NextResponse.json({ erro: "Escolha o plano." }, { status: 400 });
    r = await pagarAvulso({ uid: user.id, email: user.email || "", planoId: plano.id, cartao: b.cartao!, ip: ipDe(req), fimTeste: await fimTesteAtual() });
  } else if (b?.acao === "remover_cartao") {
    r = await removerCartao(user.id);
  } else if (b?.acao === "trocar_cartao") {
    r = await trocarCartao(user.id, b.cartao!, ipDe(req));
  } else if (b?.acao === "trocar_plano") {
    if (!plano) return NextResponse.json({ erro: "Plano inválido." }, { status: 400 });
    r = await trocarPlano(user.id, plano.id);
  } else if (b?.acao === "cancelar") {
    r = await cancelarAssinatura(user.id);
    const motivo = String(b.motivo || "").slice(0, 120);
    if (r.ok && motivo) await sb.from("assinaturas").update({ cancelamento_motivo: motivo }).eq("profissional_id", user.id);
  } else {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ erro: r.erro }, { status: 402 });
}
