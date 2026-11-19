import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/admin";
import { modoDaChave, validarChave } from "@/lib/mercadopago";
import { oauthDisponivel } from "@/lib/mpOauth";
import { validarTokenPagBank } from "@/lib/pagbank";

/** Diz à tela se o botão "Conectar com Mercado Pago" já está configurado. */
export async function GET() {
  return NextResponse.json({ botao: oauthDisponivel() });
}

export const runtime = "nodejs";

/** Conecta (ou desconecta) o Mercado Pago do profissional logado. A chave nunca volta para o navegador. */
export async function POST(req: Request) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Sessão expirada. Entre de novo." }, { status: 401 });
  const b = (await req.json().catch(() => null)) as { token?: string; desconectar?: boolean; provedor?: string; sandbox?: boolean } | null;
  const admin = supabaseAdmin();
  if (b?.desconectar) {
    await admin.from("profissionais_segredos").upsert({ profissional_id: user.id, mp_access_token: null, mp_refresh_token: null, mp_expira_em: null, mp_user_id: null, pagbank_token: null, pagbank_sandbox: false, atualizado_em: new Date().toISOString() });
    await admin.from("profissionais").update({ mp_conectado: false, mp_modo: null, pg_provedor: null, agenda_ativa: false }).eq("id", user.id);
    return NextResponse.json({ conectado: false });
  }
  const token = (b?.token || "").trim();
  if (b?.provedor === "pagbank") {
    if (token.length < 20) return NextResponse.json({ erro: "Cole o token completo gerado no PagBank." }, { status: 400 });
    const sandbox = !!b.sandbox;
    let valido = false;
    try { valido = await validarTokenPagBank(token, sandbox); } catch { valido = false; }
    if (!valido) return NextResponse.json({ erro: sandbox ? "O PagBank não aceitou esse token de teste. Confira se é o token do ambiente de testes (sandbox)." : "O PagBank não aceitou esse token. Confira se copiou o token completo e se ele é da conta real (não de testes)." }, { status: 400 });
    await admin.from("profissionais_segredos").upsert({ profissional_id: user.id, pagbank_token: token, pagbank_sandbox: sandbox, mp_access_token: null, mp_refresh_token: null, mp_expira_em: null, atualizado_em: new Date().toISOString() });
    await admin.from("profissionais").update({ mp_conectado: true, mp_modo: sandbox ? "teste" : "producao", pg_provedor: "pagbank" }).eq("id", user.id);
    return NextResponse.json({ conectado: true, modo: sandbox ? "teste" : "producao", provedor: "pagbank" });
  }
  const modo = modoDaChave(token);
  if (!modo) return NextResponse.json({ erro: "A chave precisa começar com APP_USR- (conta real) ou TEST- (modo de teste)." }, { status: 400 });
  try {
    await validarChave(token);
  } catch {
    return NextResponse.json({ erro: "O Mercado Pago não aceitou essa chave. Confira se copiou o Access Token completo." }, { status: 400 });
  }
  await admin.from("profissionais_segredos").upsert({ profissional_id: user.id, mp_access_token: token, mp_refresh_token: null, mp_expira_em: null, pagbank_token: null, atualizado_em: new Date().toISOString() });
  await admin.from("profissionais").update({ mp_conectado: true, mp_modo: modo, pg_provedor: "mercadopago" }).eq("id", user.id);
  return NextResponse.json({ conectado: true, modo, provedor: "mercadopago" });
}
