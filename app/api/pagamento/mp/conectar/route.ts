import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { supabaseServer } from "@/lib/supabase/server";
import { oauthDisponivel, urlAutorizacao } from "@/lib/mpOauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Leva o médico logado para a tela de autorização do Mercado Pago. */
export async function GET(req: Request) {
  const base = new URL(req.url).origin;
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.redirect(`${base}/login`);
  if (!oauthDisponivel()) return NextResponse.redirect(`${base}/perfil?mp=indisponivel#agenda-online`);
  const estado = randomBytes(24).toString("hex");
  const res = NextResponse.redirect(urlAutorizacao(base, estado));
  res.cookies.set("mp_estado", `${estado}.${user.id}`, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 900, path: "/api/pagamento/mp" });
  return res;
}
