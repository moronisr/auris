import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/admin";
import type { Metodo } from "@/lib/mercadopago";
import { criarCobrancaOnline, criarPixOnline } from "@/lib/pagamentos";

export const runtime = "nodejs";

/** Gera a cobrança na instituição de pagamento do profissional para a teleconsulta do link do paciente. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { codigo?: string; metodo?: Metodo } | null;
  if (!b?.codigo || !["pix", "credito", "debito"].includes(b.metodo || "")) return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  const sb = supabaseAdmin();
  const { data: t } = await sb.from("teleconsultas").select("id, profissional_id, codigo, valor, status, pagamento_status, consentimento_em, reserva_expira_em, inicio, paciente_email, mp_pagamento_id")
    .eq("codigo", b.codigo).maybeSingle();
  if (!t || t.status === "cancelada" || t.status === "encerrada") return NextResponse.json({ erro: "Consulta não encontrada ou cancelada." }, { status: 404 });
  if (!(Number(t.valor) > 0) || t.pagamento_status === "confirmado") return NextResponse.json({ erro: "Esta consulta não tem pagamento pendente." }, { status: 409 });
  if (!t.consentimento_em) return NextResponse.json({ erro: "Aceite o termo antes de pagar." }, { status: 409 });
  if (t.reserva_expira_em && new Date(t.reserva_expira_em) < new Date()) return NextResponse.json({ erro: "O prazo para pagar este horário terminou. Volte à página do profissional e escolha um novo horário." }, { status: 410 });
  const { data: p } = await sb.from("profissionais").select("nome").eq("id", t.profissional_id).maybeSingle();
  const expira = t.reserva_expira_em ? new Date(t.reserva_expira_em) : new Date(Math.min(new Date(t.inicio).getTime(), Date.now() + 24 * 3600e3));
  const base = new URL(req.url).origin;
  try {
    if (b.metodo === "pix") {
      // Pix: QR Code e copia e cola na própria página, pago por qualquer banco, sem conta no Mercado Pago.
      const px = await criarPixOnline({
        profissionalId: t.profissional_id, teleId: t.id, codigo: t.codigo, valor: Number(t.valor), titulo: `Teleconsulta com ${p?.nome || "profissional"}`,
        expira, base, email: t.paciente_email, anterior: t.mp_pagamento_id,
      });
      if (px) {
        // A reserva do horário dura até o código Pix vencer: quem paga dentro do prazo nunca perde o horário.
        const reserva = t.reserva_expira_em && new Date(px.expira) > new Date(t.reserva_expira_em) ? px.expira : t.reserva_expira_em;
        await sb.from("teleconsultas").update({ mp_pagamento_id: px.pagamentoId, pg_provedor: "mercadopago", pagamento_metodo: "pix", reserva_expira_em: reserva }).eq("id", t.id);
        return NextResponse.json({ pix: { codigo: px.codigo, imagem: px.imagem } });
      }
    }
    const r = await criarCobrancaOnline({
      profissionalId: t.profissional_id, teleId: t.id, codigo: t.codigo, valor: Number(t.valor), titulo: `Teleconsulta com ${p?.nome || "profissional"}`,
      metodo: b.metodo as Metodo, expira, base, email: t.paciente_email,
    });
    if (!r) return NextResponse.json({ erro: "O consultório ainda não conectou o pagamento online." }, { status: 409 });
    await sb.from("teleconsultas").update({ mp_preferencia_id: r.cobrancaId, pg_provedor: r.provedor, pagamento_metodo: b.metodo }).eq("id", t.id);
    return NextResponse.json({ url: r.url });
  } catch (e) {
    console.error("criar cobrança", e);
    return NextResponse.json({ erro: "Não foi possível abrir o pagamento agora. Tente de novo em instantes." }, { status: 502 });
  }
}
