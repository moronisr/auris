import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Destino dos links enviados por e-mail (confirmação de cadastro e redefinição de senha).
 * Aceita os dois formatos do Supabase:
 *  - token_hash (funciona em qualquer aparelho)
 *  - code (PKCE): se o e-mail foi aberto em outro aparelho, a conta já fica confirmada,
 *    mas a sessão não pode ser criada; então o profissional é levado ao login com aviso amigável.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token_hash = url.searchParams.get("token_hash");
  const type = (url.searchParams.get("type") as EmailOtpType | null) ?? "email";
  const code = url.searchParams.get("code");
  const vaiPara = (p: string) => NextResponse.redirect(new URL(p, url.origin));
  const supabase = await supabaseServer();

  if (token_hash) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) return vaiPara(type === "recovery" ? "/nova-senha" : "/");
    return vaiPara("/login?link=expirado");
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return vaiPara(type === "recovery" ? "/nova-senha" : "/");
    return vaiPara(type === "recovery" ? "/login?link=outro-aparelho-senha" : "/login?confirmado=1");
  }

  return vaiPara("/login?link=expirado");
}
