import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/admin";
import { chaveDoProfissional, cobrarCartaoMercadoPago, confirmarPeloMercadoPago } from "@/lib/mercadopago";

export const runtime = "nodejs";

/** Mensagens claras para o paciente quando o banco recusa o cartão (status_detail do Mercado Pago). */
const RECUSA: Record<string, string> = {
  cc_rejected_insufficient_amount: "O cartão não tem saldo ou limite suficiente.",
  cc_rejected_bad_filled_security_code: "O código de segurança (CVV) está incorreto.",
  cc_rejected_bad_filled_date: "A data de validade está incorreta.",
  cc_rejected_bad_filled_card_number: "O número do cartão está incorreto.",
  cc_rejected_bad_filled_other: "Algum dado do cartão está incorreto. Confira e tente de novo.",
  cc_rejected_call_for_authorize: "O banco pede que você autorize este pagamento. Ligue para o banco ou use outro cartão.",
  cc_rejected_card_disabled: "O cartão está bloqueado ou inativo. Fale com o banco ou use outro cartão.",
  cc_rejected_duplicated_payment: "Já existe um pagamento igual feito agora. Confira o extrato antes de tentar de novo.",
  cc_rejected_high_risk: "O pagamento foi recusado por segurança. Use outro cartão ou pague com Pix.",
  cc_rejected_max_attempts: "Muitas tentativas com este cartão. Use outro cartão ou pague com Pix.",
};

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as {
    codigo?: string; metodo?: string; chave?: string;
    cartao?: { token?: string; payment_method_id?: string; issuer_id?: string | number; payer?: { email?: string; identification?: { type: string; number: string } } };
  } | null;
  const c = b?.cartao;
  if (!b?.codigo || !["credito", "debito"].includes(b.metodo || "") || !c?.token || !c.payment_method_id || !c.payer?.email || !/^[\w-]{6,64}$/.test(b.chave || "")) {
    return NextResponse.json({ erro: "Dados do pagamento incompletos." }, { status: 400 });
  }
  const sb = supabaseAdmin();
  const { data: t } = await sb.from("teleconsultas").select("id, profissional_id, valor, status, pagamento_status, consentimento_em, reserva_expira_em").eq("codigo", b.codigo).maybeSingle();
  if (!t || t.status === "cancelada" || t.status === "encerrada") return NextResponse.json({ erro: "Consulta não encontrada ou cancelada." }, { status: 404 });
  if (t.pagamento_status === "confirmado") return NextResponse.json({ status: "approved" });
  if (!(Number(t.valor) > 0)) return NextResponse.json({ erro: "Esta consulta não tem pagamento pendente." }, { status: 409 });
  if (!t.consentimento_em) return NextResponse.json({ erro: "Aceite o termo antes de pagar." }, { status: 409 });
  if (t.reserva_expira_em && new Date(t.reserva_expira_em) < new Date()) return NextResponse.json({ erro: "O prazo para pagar este horário terminou. Volte à página do profissional e escolha um novo horário." }, { status: 410 });
  const token = await chaveDoProfissional(t.profissional_id);
  if (!token) return NextResponse.json({ erro: "O consultório ainda não conectou o pagamento online." }, { status: 409 });
  const { data: p } = await sb.from("profissionais").select("nome").eq("id", t.profissional_id).maybeSingle();
  try {
    const r = await cobrarCartaoMercadoPago({
      token, teleId: t.id, valor: Number(t.valor), titulo: `Teleconsulta com ${p?.nome || "profissional"}`, base: new URL(req.url).origin, chave: b.chave!,
      cartao: { token: c.token, payment_method_id: c.payment_method_id, issuer_id: c.issuer_id, payer: { email: c.payer.email, identification: c.payer.identification } },
    });
    await sb.from("teleconsultas").update({ pg_provedor: "mercadopago", pagamento_metodo: b.metodo }).eq("id", t.id).neq("pagamento_status", "confirmado");
    if (r.status === "approved") {
      await confirmarPeloMercadoPago(t.id, r.pagamentoId);
      return NextResponse.json({ status: "approved" });
    }
    return NextResponse.json({ status: r.status, erro: RECUSA[r.detalhe] || "O banco recusou o pagamento. Confira os dados, use outro cartão ou pague com Pix." }, { status: 402 });
  } catch (e) {
    console.error("cartao", String(e).slice(0, 300));
    return NextResponse.json({ erro: "Não foi possível confirmar o cartão agora. Antes de tentar de novo, confira o extrato do cartão: se o valor aparecer, esta página confirma a consulta sozinha em instantes." }, { status: 502 });
  }
}
