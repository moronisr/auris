import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/admin";
import { horariosLivres, limparAgenda, limparExcecoes, ocupaHorario } from "@/lib/agenda";
import { novoCodigo } from "@/lib/teleconsulta";

export const runtime = "nodejs";

const RESERVA_MIN = 30;

/** Paciente escolhe um horário na página pública: cria a teleconsulta com a reserva de 30 minutos para pagar. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { slug?: string; inicio?: string; nome?: string; telefone?: string; email?: string } | null;
  const nome = (b?.nome || "").trim().replace(/\s+/g, " ");
  const tel = (b?.telefone || "").replace(/\D/g, "");
  const email = (b?.email || "").trim().toLowerCase();
  if (!b?.slug || !b.inicio) return NextResponse.json({ erro: "Escolha um horário." }, { status: 400 });
  if (nome.split(" ").length < 2 || nome.length < 5) return NextResponse.json({ erro: "Informe o seu nome completo." }, { status: 400 });
  if (tel.length < 10 || tel.length > 13) return NextResponse.json({ erro: "Informe um WhatsApp válido, com DDD." }, { status: 400 });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ erro: "E-mail inválido." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: p } = await sb.from("profissionais")
    .select("id, valor_consulta, duracao_consulta, antecedencia_horas, agenda, agenda_excecoes, agenda_ativa, mp_conectado")
    .ilike("slug", b.slug).maybeSingle();
  if (!p || !p.agenda_ativa || !p.mp_conectado || !(Number(p.valor_consulta) > 0))
    return NextResponse.json({ erro: "Este profissional não está aceitando agendamentos online no momento." }, { status: 409 });

  const agora = new Date();
  const inicio = new Date(b.inicio);
  if (isNaN(inicio.getTime())) return NextResponse.json({ erro: "Horário inválido." }, { status: 400 });

  // Libera reservas vencidas e não pagas, para não travar horários.
  await sb.from("teleconsultas").update({ status: "cancelada" })
    .eq("profissional_id", p.id).eq("origem", "pagina").eq("pagamento_status", "pendente").lt("reserva_expira_em", agora.toISOString()).neq("status", "cancelada");

  const { data: tele } = await sb.from("teleconsultas").select("inicio, duracao_min, status, pagamento_status, reserva_expira_em")
    .eq("profissional_id", p.id).gte("inicio", new Date(agora.getTime() - 4 * 3600e3).toISOString()).lte("inicio", new Date(agora.getTime() + 16 * 864e5).toISOString());
  const livres = horariosLivres({
    agenda: limparAgenda(p.agenda), excecoes: limparExcecoes(p.agenda_excecoes), duracao: p.duracao_consulta,
    ocupados: (tele || []).filter((t) => ocupaHorario(t, agora)), agora, dias: 14, antecedenciaHoras: p.antecedencia_horas,
  });
  if (!livres.includes(inicio.toISOString())) return NextResponse.json({ erro: "Esse horário acabou de ser ocupado. Escolha outro." }, { status: 409 });

  const codigo = novoCodigo();
  const { error } = await sb.from("teleconsultas").insert({
    profissional_id: p.id, paciente_nome: nome, paciente_telefone: tel, paciente_email: email || null,
    inicio: inicio.toISOString(), duracao_min: p.duracao_consulta, valor: Number(p.valor_consulta),
    codigo, origem: "pagina", pagamento_status: "pendente", reserva_expira_em: new Date(agora.getTime() + RESERVA_MIN * 60e3).toISOString(),
  });
  // O índice único impede dois pacientes no mesmo horário, mesmo que cliquem ao mesmo tempo.
  if (error) return NextResponse.json({ erro: error.code === "23505" ? "Esse horário acabou de ser ocupado. Escolha outro." : "Não foi possível agendar agora. Tente de novo." }, { status: 409 });
  return NextResponse.json({ codigo });
}
