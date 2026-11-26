import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/admin";
import { chaveDoProfissional, devolverMercadoPago, pagamentosAprovados } from "@/lib/mercadopago";
import { devolverPeloPagBank } from "@/lib/pagamentos";
import { horariosLivres, limparAgenda, limparExcecoes, ocupaHorario } from "@/lib/agenda";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O consultório cancelou uma consulta paga: o pagamento fica guardado e o paciente escolhe.
 * GET  ?codigo=  -> horários livres para remarcar (quando a agenda online do profissional está aberta)
 * POST { codigo, acao: "remarcar", inicio } -> a mesma consulta passa para o novo horário, já paga
 * POST { codigo, acao: "devolver" }         -> devolve o valor integral (sem prazo, porque quem cancelou foi o consultório)
 */
async function carregar(codigo: string) {
  const sb = supabaseAdmin();
  const { data: t } = await sb.from("teleconsultas")
    .select("id, profissional_id, inicio, duracao_min, status, cancelado_por, pagamento_status, pg_provedor, mp_pagamento_id, valor, pagamento_alerta")
    .eq("codigo", codigo).maybeSingle();
  const pendente = !!t && t.status === "cancelada" && t.cancelado_por === "profissional" && t.pagamento_status === "confirmado" && t.pagamento_alerta !== "devolucao_pendente";
  return { sb, t, pendente };
}

async function livres(sb: ReturnType<typeof supabaseAdmin>, profissionalId: string) {
  const { data: p } = await sb.from("profissionais").select("agenda, agenda_excecoes, agenda_ativa, duracao_consulta, antecedencia_horas").eq("id", profissionalId).maybeSingle();
  if (!p?.agenda_ativa) return null;
  const agora = new Date();
  const { data: tele } = await sb.from("teleconsultas").select("inicio, duracao_min, status, pagamento_status, reserva_expira_em")
    .eq("profissional_id", profissionalId).gte("inicio", new Date(agora.getTime() - 4 * 3600e3).toISOString()).lte("inicio", new Date(agora.getTime() + 31 * 864e5).toISOString());
  return horariosLivres({
    agenda: limparAgenda(p.agenda), excecoes: limparExcecoes(p.agenda_excecoes), duracao: p.duracao_consulta ?? 30,
    ocupados: (tele || []).filter((x) => ocupaHorario(x, agora)), agora, dias: 30, antecedenciaHoras: p.antecedencia_horas ?? 2,
  });
}

export async function GET(req: Request) {
  const codigo = new URL(req.url).searchParams.get("codigo") || "";
  const { sb, t, pendente } = await carregar(codigo);
  if (!t || !pendente) return NextResponse.json({ pendente: false, devolucaoPedida: t?.pagamento_alerta === "devolucao_pendente" });
  const horarios = await livres(sb, t.profissional_id);
  return NextResponse.json({ pendente: true, agendaAberta: horarios !== null, horarios: horarios ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { codigo?: string; acao?: string; inicio?: string } | null;
  if (!b?.codigo || !["remarcar", "devolver"].includes(b.acao || "")) return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  const { sb, t, pendente } = await carregar(b.codigo);
  if (!t) return NextResponse.json({ erro: "Consulta não encontrada." }, { status: 404 });
  if (!pendente) return NextResponse.json({ erro: "Esta consulta não está aguardando a sua escolha. Atualize a página." }, { status: 409 });

  if (b.acao === "remarcar") {
    const horarios = await livres(sb, t.profissional_id);
    if (!horarios) return NextResponse.json({ erro: "A agenda online deste profissional está fechada. Combine o novo horário pelo WhatsApp." }, { status: 409 });
    const novo = String(b.inicio || "");
    if (!horarios.includes(novo)) return NextResponse.json({ erro: "Esse horário acabou de ser ocupado. Escolha outro." }, { status: 409 });
    // Só muda se ainda estiver aguardando (evita duas escolhas ao mesmo tempo).
    const { data: feito } = await sb.from("teleconsultas").update({
      inicio: novo, status: "confirmada", cancelado_por: null, pagamento_alerta: null,
      lembrete_24h_em: null, lembrete_1h_em: null,
    }).eq("id", t.id).eq("status", "cancelada").select("id");
    if (!feito?.length) return NextResponse.json({ erro: "Esta consulta já foi resolvida. Atualize a página." }, { status: 409 });
    return NextResponse.json({ ok: true, inicio: novo });
  }

  // Pago fora do Auris (Pix na chave do consultório): o consultório devolve pelo banco dele.
  const online = (t.pg_provedor === "mercadopago" || t.pg_provedor === "pagbank") && !!t.mp_pagamento_id;
  if (!online) {
    await sb.from("teleconsultas").update({ pagamento_alerta: "devolucao_pendente" }).eq("id", t.id);
    return NextResponse.json({ ok: true, manual: true, valor: Number(t.valor || 0) });
  }
  // Devolução integral pelo mesmo caminho das outras devoluções.
  if (t.pg_provedor === "pagbank") {
    const r = await devolverPeloPagBank(t.profissional_id, t.mp_pagamento_id, Number(t.valor || 0));
    if (!r.ok) {
      await sb.from("teleconsultas").update({ pagamento_alerta: "devolucao_pendente" }).eq("id", t.id);
      return NextResponse.json({ erro: "Não foi possível devolver agora. O consultório foi avisado e vai resolver." }, { status: 502 });
    }
    await sb.from("teleconsultas").update({ pagamento_status: "devolvido", devolvido_em: new Date().toISOString(), devolucao_valor: r.valor, devolucao_id: r.id, pagamento_alerta: null }).eq("id", t.id);
    return NextResponse.json({ ok: true, valor: r.valor });
  }
  const token = await chaveDoProfissional(t.profissional_id);
  if (!token) return NextResponse.json({ erro: "Não foi possível devolver agora. Fale com o consultório." }, { status: 409 });
  const aprovados = await pagamentosAprovados(token, t.id);
  let total = 0; let ultimo = "";
  for (const pg of aprovados) {
    const r = await devolverMercadoPago(token, pg.id);
    if (!r.ok) {
      await sb.from("teleconsultas").update({ pagamento_alerta: "devolucao_pendente" }).eq("id", t.id);
      return NextResponse.json({ erro: "Não foi possível devolver agora. O consultório foi avisado e vai resolver." }, { status: 502 });
    }
    total += r.valor; ultimo = r.id;
  }
  if (!aprovados.length) return NextResponse.json({ erro: "Não encontramos o pagamento para devolver. O consultório foi avisado." }, { status: 409 });
  await sb.from("teleconsultas").update({ pagamento_status: "devolvido", devolvido_em: new Date().toISOString(), devolucao_valor: total, devolucao_id: ultimo, pagamento_alerta: null }).eq("id", t.id);
  return NextResponse.json({ ok: true, valor: total });
}
