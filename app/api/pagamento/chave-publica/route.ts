import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/admin";
import { chavePublicaDoProfissional } from "@/lib/mercadopago";

export const runtime = "nodejs";

/** Chave pública (não secreta) da conta do Mercado Pago do consultório, para o formulário seguro de cartão. */
export async function GET(req: Request) {
  const codigo = new URL(req.url).searchParams.get("codigo") || "";
  const sb = supabaseAdmin();
  const { data: t } = await sb.from("teleconsultas").select("profissional_id, pg_provedor").eq("codigo", codigo).maybeSingle();
  if (!t) return NextResponse.json({ publicKey: null }, { status: 404 });
  const { data: p } = await sb.from("profissionais").select("pg_provedor, mp_conectado").eq("id", t.profissional_id).maybeSingle();
  if (!p?.mp_conectado || p.pg_provedor === "pagbank") return NextResponse.json({ publicKey: null });
  return NextResponse.json({ publicKey: await chavePublicaDoProfissional(t.profissional_id) });
}
