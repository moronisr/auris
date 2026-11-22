import { NextResponse } from "next/server";
import { ehAdmin, supabaseAdmin } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { PLANOS } from "@/lib/planos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Painel do dono do Auris. Só números do negócio: nenhum dado clínico, nenhum nome de paciente.
 * Quem não é administrador recebe 404, como se a página não existisse.
 */
async function dono() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  return ehAdmin(user?.id) ? user : null;
}
const naoExiste = () => NextResponse.json({ erro: "Não encontrado." }, { status: 404 });

export async function GET() {
  const user = await dono();
  if (!user) return naoExiste();
  const sb = supabaseAdmin();
  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
  const trintaDias = new Date(Date.now() - 30 * 864e5).toISOString();

  const [usuarios, { data: profs }, { data: assin }, { data: cfg }, { data: cobr }, { data: regs }, { data: teles }, { data: alertas }] = await Promise.all([
    sb.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    sb.from("profissionais").select("id, nome, profissao, especialidade, created_at, plano_teste"),
    sb.from("assinaturas").select("profissional_id, plano, status, valor, pago_ate, falha_desde, falha_motivo, cancelada_em, cancelamento_motivo, cortesia_ate, cortesia_motivo, mp_assinatura_id"),
    sb.from("auris_config").select("cobranca_ativa, cobranca_desde").eq("id", 1).maybeSingle(),
    sb.from("auris_cobrancas").select("profissional_id, valor, status, data, origem").gte("data", new Date(agora.getFullYear(), agora.getMonth() - 5, 1).toISOString()).order("data", { ascending: false }).limit(1000),
    sb.from("registros").select("profissional_id, created_at").gte("created_at", trintaDias).limit(20000),
    sb.from("teleconsultas").select("profissional_id, inicio, status").gte("inicio", trintaDias).limit(20000),
    sb.from("teleconsultas").select("profissional_id, pagamento_alerta").not("pagamento_alerta", "is", null).limit(1000),
  ]);

  const acessos = await Promise.all((profs || []).map(async (p) => [p.id, (await sb.rpc("auris_acesso", { uid: p.id })).data as string] as const));
  const acessoDe = new Map(acessos);
  const contar = (lista: { profissional_id: string }[] | null) => {
    const m = new Map<string, number>();
    for (const r of lista || []) m.set(r.profissional_id, (m.get(r.profissional_id) || 0) + 1);
    return m;
  };
  const fichas30 = contar(regs), teles30 = contar((teles || []).filter((t) => t.status !== "cancelada"));
  const assinDe = new Map((assin || []).map((a) => [a.profissional_id, a]));
  const contas = new Map((usuarios.data?.users || []).map((u) => [u.id, u]));

  const profissionais = (profs || []).map((p) => {
    const a = assinDe.get(p.id);
    const u = contas.get(p.id);
    const cortesia = a?.cortesia_ate && new Date(a.cortesia_ate) > agora ? a.cortesia_ate : null;
    return {
      id: p.id, nome: p.nome, email: u?.email || "", profissao: p.profissao, especialidade: p.especialidade,
      cadastro: p.created_at, ultimoAcesso: u?.last_sign_in_at || null, emailConfirmado: !!u?.email_confirmed_at,
      plano: a?.plano || null, valor: a?.valor ? Number(a.valor) : null, status: a?.status || null, recorrente: !!a?.mp_assinatura_id,
      pagoAte: a?.pago_ate || null, planoTeste: !!(p as { plano_teste?: boolean }).plano_teste, cortesiaAte: cortesia, cortesiaMotivo: cortesia ? a?.cortesia_motivo || null : null,
      acesso: acessoDe.get(p.id) || "liberado", fichas30: fichas30.get(p.id) || 0, teleconsultas30: teles30.get(p.id) || 0,
      alertasPagamento: (alertas || []).filter((x) => x.profissional_id === p.id).length,
      admin: ehAdmin(p.id),
    };
  }).sort((x, y) => +new Date(y.cadastro) - +new Date(x.cadastro));

  // Receita: assinaturas ativas e pagas (cortesia não entra), excluindo as contas de dono.
  const pagantes = profissionais.filter((p) => !p.admin && !p.cortesiaAte && p.recorrente && (p.acesso === "ativa" || p.acesso === "aviso"));
  const mrr = pagantes.reduce((s, p) => s + (p.valor || 0), 0);
  const aprovadas = (cobr || []).filter((c) => c.status === "approved" && !ehAdmin(c.profissional_id));
  const recebidoMes = aprovadas.filter((c) => c.data >= inicioMes).reduce((s, c) => s + Number(c.valor || 0), 0);
  const meses = Array.from({ length: 6 }, (_, i) => {
    const de = new Date(agora.getFullYear(), agora.getMonth() - 5 + i, 1), ate = new Date(agora.getFullYear(), agora.getMonth() - 4 + i, 1);
    return { nome: de.toLocaleDateString("pt-BR", { month: "short", timeZone: "America/Sao_Paulo" }).replace(".", ""), valor: aprovadas.filter((c) => new Date(c.data) >= de && new Date(c.data) < ate).reduce((s, c) => s + Number(c.valor || 0), 0) };
  });
  const clientes = profissionais.filter((p) => !p.admin);
  const motivos = new Map<string, number>();
  for (const a of assin || []) if (a.cancelamento_motivo && !ehAdmin(a.profissional_id)) motivos.set(a.cancelamento_motivo, (motivos.get(a.cancelamento_motivo) || 0) + 1);

  return NextResponse.json({
    cobrancaAtiva: !!cfg?.cobranca_ativa, cobrancaDesde: cfg?.cobranca_desde || null,
    resumo: {
      mrr, recebidoMes, profissionais: clientes.length,
      pagantes: pagantes.length,
      teste: clientes.filter((p) => p.acesso === "teste").length,
      cortesia: clientes.filter((p) => p.cortesiaAte).length,
      aviso: clientes.filter((p) => p.acesso === "aviso").length,
      bloqueados: clientes.filter((p) => p.acesso === "bloqueado").length,
      cancelados: clientes.filter((p) => p.status === "cancelada").length,
      novos30: clientes.filter((p) => p.cadastro >= trintaDias).length,
      fichas30: clientes.reduce((s, p) => s + p.fichas30, 0),
      teleconsultas30: clientes.reduce((s, p) => s + p.teleconsultas30, 0),
      semUso30: clientes.filter((p) => p.fichas30 === 0 && p.teleconsultas30 === 0).length,
      falhasCobranca: (cobr || []).filter((c) => c.status !== "approved" && c.data >= inicioMes && !ehAdmin(c.profissional_id)).length,
      contestacoes: (cobr || []).filter((c) => c.status === "charged_back" || c.status === "in_mediation").length,
      alertasPagamento: (alertas || []).length,
    },
    meses, profissionais,
    motivosCancelamento: [...motivos.entries()].map(([motivo, n]) => ({ motivo, n })).sort((a, b) => b.n - a.n),
    planos: PLANOS.filter((p) => !p.oculto).map((p) => ({ id: p.id, nome: p.nome, valor: p.valor })),
  });
}

export async function POST(req: Request) {
  const user = await dono();
  if (!user) return naoExiste();
  const b = (await req.json().catch(() => null)) as { acao?: string; uid?: string; dias?: number; motivo?: string; ativa?: boolean } | null;
  const sb = supabaseAdmin();

  if (b?.acao === "cobranca") {
    const ativa = !!b.ativa;
    const { data: atual } = await sb.from("auris_config").select("cobranca_desde").eq("id", 1).maybeSingle();
    await sb.from("auris_config").update({ cobranca_ativa: ativa, ...(ativa && !atual?.cobranca_desde ? { cobranca_desde: new Date().toISOString() } : {}) }).eq("id", 1);
    return NextResponse.json({ ok: true, mensagem: ativa ? "Cobrança dos planos ligada. Os profissionais sem plano entram nos 10 dias de teste." : "Cobrança dos planos desligada. Todos usam o Auris liberado." });
  }

  if (!b?.uid || !/^[0-9a-f-]{36}$/.test(b.uid)) return NextResponse.json({ erro: "Profissional não encontrado." }, { status: 400 });
  const { data: prof } = await sb.from("profissionais").select("id, nome").eq("id", b.uid).maybeSingle();
  if (!prof) return NextResponse.json({ erro: "Profissional não encontrado." }, { status: 404 });

  if (b.acao === "cortesia") {
    const dias = Math.round(Number(b.dias));
    if (!dias || dias < 1 || dias > 366) return NextResponse.json({ erro: "Escolha um prazo entre 1 e 366 dias." }, { status: 400 });
    const ate = new Date(Date.now() + dias * 864e5).toISOString();
    const motivo = (b.motivo || "").trim().slice(0, 120) || null;
    const { data: existe } = await sb.from("assinaturas").select("profissional_id").eq("profissional_id", b.uid).maybeSingle();
    const dados = { cortesia_ate: ate, cortesia_motivo: motivo, atualizado_em: new Date().toISOString() };
    const r = existe ? await sb.from("assinaturas").update(dados).eq("profissional_id", b.uid) : await sb.from("assinaturas").insert({ profissional_id: b.uid, status: "teste", ...dados });
    if (r.error) return NextResponse.json({ erro: "Não foi possível liberar agora. Tente de novo." }, { status: 500 });
    return NextResponse.json({ ok: true, mensagem: `Cortesia liberada para ${prof.nome} até ${new Date(ate).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.` });
  }

  if (b.acao === "plano_teste") {
    const liberar = !!b.ativa;
    const r = await sb.from("profissionais").update({ plano_teste: liberar }).eq("id", b.uid);
    if (r.error) return NextResponse.json({ erro: "Não foi possível salvar agora. Tente de novo." }, { status: 500 });
    return NextResponse.json({ ok: true, mensagem: liberar ? `Plano de teste de R$ 5 liberado para ${prof.nome}. Ele aparece em Finanças, Plano do Auris.` : `Plano de teste retirado de ${prof.nome}.` });
  }

  if (b.acao === "remover_cortesia") {
    await sb.from("assinaturas").update({ cortesia_ate: null, cortesia_motivo: null, atualizado_em: new Date().toISOString() }).eq("profissional_id", b.uid);
    return NextResponse.json({ ok: true, mensagem: `Cortesia de ${prof.nome} encerrada.` });
  }

  return NextResponse.json({ erro: "Ação inválida." }, { status: 400 });
}
