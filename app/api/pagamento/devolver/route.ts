import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { chaveDoProfissional, devolverMercadoPago, pagamentosAprovados } from "@/lib/mercadopago";

export const runtime = "nodejs";

/**
 * Ações do profissional sobre uma consulta paga:
 * - cancelar: só cancela (sem devolver);
 * - cancelar_devolver: cancela e devolve o valor integral ao paciente;
 * - devolver: devolve o valor de uma consulta já cancelada que foi paga;
 * - devolver_extra: devolve os pagamentos em duplicidade, mantendo o primeiro.
 */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { teleId?: string; acao?: string } | null;
  if (!b?.teleId || !["cancelar", "cancelar_devolver", "devolver", "devolver_extra"].includes(b.acao || "")) return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Entre na sua conta." }, { status: 401 });
  const admin = supabaseAdmin();
  const { data: t } = await admin.from("teleconsultas").select("id, profissional_id, status, pagamento_status, pg_provedor, mp_pagamento_id, valor, pagamento_alerta").eq("id", b.teleId).maybeSingle();
  if (!t || t.profissional_id !== user.id) return NextResponse.json({ erro: "Consulta não encontrada." }, { status: 404 });

  if (b.acao === "cancelar") {
    await admin.from("teleconsultas").update({ status: "cancelada", cancelado_por: "profissional" }).eq("id", t.id);
    return NextResponse.json({ ok: true, mensagem: "Consulta cancelada." });
  }
  if (t.pg_provedor === "pagbank") return NextResponse.json({ erro: "Pagamentos pelo PagBank são devolvidos no app do PagBank (Vendas, abrir a venda, Estornar)." }, { status: 409 });
  const token = await chaveDoProfissional(t.profissional_id);
  if (!token) return NextResponse.json({ erro: "A conta do Mercado Pago não está conectada. Conecte de novo no Perfil para devolver pelo Auris." }, { status: 409 });

  if (b.acao === "devolver_extra") {
    const aprovados = await pagamentosAprovados(token, t.id);
    const principal = t.mp_pagamento_id && aprovados.some((p) => p.id === t.mp_pagamento_id) ? t.mp_pagamento_id : aprovados[0]?.id;
    const extras = aprovados.filter((p) => p.id !== principal);
    let total = 0;
    for (const p of extras) {
      const r = await devolverMercadoPago(token, p.id);
      if (!r.ok) return NextResponse.json({ erro: r.erro }, { status: 502 });
      total += r.valor;
    }
    await admin.from("teleconsultas").update({ pagamento_alerta: null }).eq("id", t.id);
    return NextResponse.json({ ok: true, mensagem: extras.length ? `Pagamento em duplicidade devolvido ao paciente (${total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}).` : "Não há pagamento em duplicidade para devolver." });
  }

  // cancelar_devolver ou devolver: devolve todos os pagamentos aprovados desta consulta.
  const aprovados = await pagamentosAprovados(token, t.id);
  if (!aprovados.length) {
    if (b.acao === "cancelar_devolver") await admin.from("teleconsultas").update({ status: "cancelada", cancelado_por: "profissional" }).eq("id", t.id);
    return NextResponse.json({ ok: true, mensagem: b.acao === "cancelar_devolver" ? "Consulta cancelada. Não havia pagamento aprovado para devolver." : "Não há pagamento aprovado para devolver." });
  }
  let total = 0; let ultimo = "";
  for (const p of aprovados) {
    const r = await devolverMercadoPago(token, p.id);
    if (!r.ok) return NextResponse.json({ erro: r.erro }, { status: 502 });
    total += r.valor; ultimo = r.id;
  }
  await admin.from("teleconsultas").update({
    status: "cancelada", cancelado_por: t.status === "cancelada" ? undefined : "profissional",
    pagamento_status: "devolvido", devolvido_em: new Date().toISOString(), devolucao_valor: total, devolucao_id: ultimo, pagamento_alerta: null,
  }).eq("id", t.id);
  return NextResponse.json({ ok: true, mensagem: `Consulta cancelada e ${total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} devolvido ao paciente.` });
}
