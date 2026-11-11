import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Link dos e-mails (confirmação de cadastro e redefinição de senha).
 * Usa token_hash, que funciona mesmo se o e-mail for aberto em outro aparelho ou navegador.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  if (token_hash && type) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) {
      const destino = type === "recovery" ? "/nova-senha" : "/?bemvindo=1";
      return NextResponse.redirect(new URL(destino, url.origin));
    }
  }
  return NextResponse.redirect(new URL("/login?link=expirado", url.origin));
}
