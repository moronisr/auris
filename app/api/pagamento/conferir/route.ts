import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { confirmarPagamento } from "@/lib/pagamentos";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Conferência de pagamentos: consulta de novo a instituição para toda consulta com cobrança online
 * ainda não confirmada (e as confirmadas recentes, para achar duplicidade). Não confia em nada do navegador.
 * POST: do profissional logado (roda quando ele abre a agenda). GET: rotina diária para todos.
 */
async function conferir(profissionalId?: string) {
  const sb = supabaseAdmin();
  let q = sb.from("teleconsultas").select("id")
    .in("pagamento_status", ["pendente", "informado", "confirmado"])
    .not("pg_provedor", "is", null)
    .gte("inicio", new Date(Date.now() - 3 * 864e5).toISOString())
    .order("inicio", { ascending: false }).limit(40);
  if (profissionalId) q = q.eq("profissional_id", profissionalId);
  const { data } = await q;
  let confirmadas = 0;
  for (const t of data || []) {
    try { if ((await confirmarPagamento(t.id)) === "confirmado") confirmadas++; } catch (e) { console.error("conferir", t.id, String(e).slice(0, 200)); }
  }
  return { conferidas: (data || []).length, confirmadas };
}

export async function POST() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Entre na sua conta." }, { status: 401 });
  return NextResponse.json(await conferir(user.id));
}

export async function GET() {
  return NextResponse.json(await conferir());
}
