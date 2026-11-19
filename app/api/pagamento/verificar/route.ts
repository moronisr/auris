import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/admin";
import { confirmarPagamento } from "@/lib/pagamentos";

export const runtime = "nodejs";

/** O paciente voltou do Mercado Pago: o servidor consulta o Mercado Pago e confirma se houver pagamento aprovado. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { codigo?: string } | null;
  if (!b?.codigo) return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  const { data: t } = await supabaseAdmin().from("teleconsultas").select("id").eq("codigo", b.codigo).maybeSingle();
  if (!t) return NextResponse.json({ erro: "Consulta não encontrada." }, { status: 404 });
  try {
    return NextResponse.json({ pagamento: await confirmarPagamento(t.id) });
  } catch (e) {
    console.error("verificar pagamento", e);
    return NextResponse.json({ pagamento: "pendente" });
  }
}
