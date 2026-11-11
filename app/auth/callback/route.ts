import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** Recebe o link de confirmação de e-mail do Supabase, ativa a sessão e leva o profissional para o início. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/", url.origin));
  }
  return NextResponse.redirect(new URL("/login?confirmacao=erro", url.origin));
}
