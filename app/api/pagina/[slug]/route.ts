import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/admin";
import { horariosLivres, limparAgenda, limparExcecoes, ocupaHorario } from "@/lib/agenda";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Dados públicos da página do profissional e os horários livres dos próximos 14 dias. */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const sb = supabaseAdmin();
  const { data: p } = await sb.from("profissionais")
    .select("id, nome, especialidade, conselho, apresentacao, valor_consulta, duracao_consulta, antecedencia_horas, agenda, agenda_excecoes, agenda_ativa, mp_conectado")
    .ilike("slug", slug).maybeSingle();
  if (!p) return NextResponse.json({ erro: "Página não encontrada." }, { status: 404 });
  const aceitando = p.agenda_ativa && p.mp_conectado && Number(p.valor_consulta) > 0;
  let horarios: string[] = [];
  if (aceitando) {
    const agora = new Date();
    const ate = new Date(agora.getTime() + 16 * 864e5).toISOString();
    const { data: tele } = await sb.from("teleconsultas").select("inicio, duracao_min, status, pagamento_status, reserva_expira_em")
      .eq("profissional_id", p.id).gte("inicio", new Date(agora.getTime() - 4 * 3600e3).toISOString()).lte("inicio", ate);
    horarios = horariosLivres({
      agenda: limparAgenda(p.agenda), excecoes: limparExcecoes(p.agenda_excecoes), duracao: p.duracao_consulta,
      ocupados: (tele || []).filter((t) => ocupaHorario(t, agora)), agora, dias: 14, antecedenciaHoras: p.antecedencia_horas,
    });
  }
  return NextResponse.json({
    nome: p.nome, especialidade: p.especialidade, conselho: p.conselho, apresentacao: p.apresentacao,
    valor: Number(p.valor_consulta) || null, duracao: p.duracao_consulta, aceitando, horarios,
  }, { headers: { "Cache-Control": "no-store" } });
}
