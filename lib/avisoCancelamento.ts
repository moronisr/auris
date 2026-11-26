import { supabaseAdmin } from "@/lib/admin";
import { dataParaMensagem, enviarModelo, whatsappAtivo } from "@/lib/whatsapp";

/**
 * Mensagem automática ao paciente quando a teleconsulta é cancelada (por ele ou pelo profissional),
 * com o caminho para remarcar: a página de agendamento do profissional, se a agenda estiver aberta,
 * ou o link da própria consulta (que mostra o WhatsApp do consultório).
 * Funciona para todos os profissionais. Enquanto o WhatsApp do Auris não estiver liberado, não faz nada.
 *
 * Modelo a cadastrar na Meta: auris_cancelamento_teleconsulta (pt_BR, categoria Utilidade)
 * Corpo: "Olá, {{1}}. Sua teleconsulta com {{2}}, de {{3}}, foi cancelada {{4}}. Para remarcar, toque no botão abaixo."
 * Botão de link: "Remarcar consulta", URL https://www.aurismed.com.br/{{1}}
 */
export async function avisarCancelamento(teleId: string): Promise<void> {
  if (!whatsappAtivo()) return;
  try {
    const sb = supabaseAdmin();
    const { data: t } = await sb.from("teleconsultas")
      .select("paciente_nome, paciente_telefone, inicio, codigo, cancelado_por, pagamento_status, profissional_id")
      .eq("id", teleId).maybeSingle();
    if (!t?.paciente_telefone) return;
    const { data: p } = await sb.from("profissionais").select("nome, slug, agenda_ativa").eq("id", t.profissional_id).maybeSingle();
    const quem = t.cancelado_por === "paciente" ? "a seu pedido" : "pelo consultório";
    // Cancelada pelo consultório e paga: o pagamento fica guardado e o paciente escolhe na página da consulta.
    const guardado = t.cancelado_por === "profissional" && t.pagamento_status === "confirmado";
    const devolucao = t.pagamento_status === "devolvido" ? ". O valor pago foi devolvido"
      : guardado ? ". Seu pagamento está guardado: remarque sem pagar de novo ou peça a devolução" : "";
    const destino = guardado ? `t/${t.codigo}` : p?.agenda_ativa && p.slug ? p.slug : `t/${t.codigo}`;
    await enviarModelo("cancelamento", t.paciente_telefone,
      [String(t.paciente_nome || "").split(" ")[0] || "paciente", p?.nome || "o profissional", dataParaMensagem(t.inicio), quem + devolucao], destino);
  } catch (e) {
    console.error("aviso de cancelamento", String(e).slice(0, 200));
  }
}
