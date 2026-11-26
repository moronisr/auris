import { NextResponse } from "next/server";
import { avisarCancelamento } from "@/lib/avisoCancelamento";
import { supabaseAdmin } from "@/lib/admin";
import { chaveDoProfissional, devolverMercadoPago, pagamentosAprovados } from "@/lib/mercadopago";
import { podeCancelarComDevolucao, prazoTexto } from "@/lib/cancelamento";
import { devolverPeloPagBank } from "@/lib/pagamentos";

export const runtime = "nodejs";

/** O próprio paciente cancela pelo link da consulta. Dentro do prazo da política, o valor volta automaticamente. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { codigo?: string; motivo?: string } | null;
  if (!b?.codigo || !b.motivo?.trim()) return NextResponse.json({ erro: "Escolha o motivo do cancelamento." }, { status: 400 });
  const motivo = b.motivo.trim().slice(0, 120);
  const sb = supabaseAdmin();
  const { data: t } = await sb.from("teleconsultas").select("id, profissional_id, inicio, status, pagamento_status, pg_provedor, mp_pagamento_id, valor").eq("codigo", b.codigo).maybeSingle();
  if (!t) return NextResponse.json({ erro: "Consulta não encontrada." }, { status: 404 });
  if (t.status === "cancelada") return NextResponse.json({ ok: true });
  if (t.status === "encerrada" || t.status === "em_andamento") return NextResponse.json({ erro: "Esta consulta já começou e não pode mais ser cancelada pelo link." }, { status: 409 });
  const { data: p } = await sb.from("profissionais").select("cancelamento_horas").eq("id", t.profissional_id).maybeSingle();
  const horas = p?.cancelamento_horas ?? 24;

  if (t.pagamento_status === "informado") return NextResponse.json({ erro: "Seu pagamento ainda está em conferência. Para cancelar, fale com o consultório." }, { status: 409 });
  if (t.pagamento_status !== "confirmado") {
    // Sem pagamento aprovado: só libera o horário.
    await sb.from("teleconsultas").update({ status: "cancelada", cancelado_por: "paciente", cancelamento_motivo: motivo }).eq("id", t.id); await avisarCancelamento(t.id);
    return NextResponse.json({ ok: true, devolvido: false });
  }
  if (!podeCancelarComDevolucao(t.inicio, horas)) {
    return NextResponse.json({ erro: `O cancelamento com devolução era possível ${prazoTexto(horas)}. Para remarcar ou combinar outra solução, fale com o consultório.` }, { status: 409 });
  }
  if (t.pg_provedor === "pagbank") {
    const r = await devolverPeloPagBank(t.profissional_id, t.mp_pagamento_id, Number(t.valor || 0));
    if (!r.ok) {
      await sb.from("teleconsultas").update({ pagamento_alerta: "devolucao_pendente" }).eq("id", t.id);
      return NextResponse.json({ erro: "Não foi possível devolver automaticamente agora. O consultório foi avisado e vai resolver. Sua consulta continua marcada." }, { status: 502 });
    }
    await sb.from("teleconsultas").update({
      status: "cancelada", cancelado_por: "paciente", cancelamento_motivo: motivo, pagamento_status: "devolvido",
      devolvido_em: new Date().toISOString(), devolucao_valor: r.valor, devolucao_id: r.id, pagamento_alerta: null,
    }).eq("id", t.id); await avisarCancelamento(t.id);
    return NextResponse.json({ ok: true, devolvido: true, valor: r.valor });
  }
  const token = await chaveDoProfissional(t.profissional_id);
  if (!token) return NextResponse.json({ erro: "Não foi possível devolver automaticamente agora. Fale com o consultório." }, { status: 409 });
  const aprovados = await pagamentosAprovados(token, t.id);
  let total = 0; let ultimo = "";
  for (const pg of aprovados) {
    const r = await devolverMercadoPago(token, pg.id);
    if (!r.ok) {
      // A consulta não é cancelada se a devolução falhar: o paciente nunca fica sem consulta e sem dinheiro.
      await sb.from("teleconsultas").update({ pagamento_alerta: "devolucao_pendente" }).eq("id", t.id);
      return NextResponse.json({ erro: "Não foi possível devolver automaticamente agora. O consultório foi avisado e vai resolver. Sua consulta continua marcada." }, { status: 502 });
    }
    total += r.valor; ultimo = r.id;
  }
  await sb.from("teleconsultas").update({
    status: "cancelada", cancelado_por: "paciente", cancelamento_motivo: motivo, pagamento_status: aprovados.length ? "devolvido" : t.pagamento_status,
    devolvido_em: aprovados.length ? new Date().toISOString() : null, devolucao_valor: aprovados.length ? total : null, devolucao_id: ultimo || null, pagamento_alerta: null,
  }).eq("id", t.id); await avisarCancelamento(t.id);
  return NextResponse.json({ ok: true, devolvido: aprovados.length > 0, valor: total });
}
