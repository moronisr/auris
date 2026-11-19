import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/admin";
import { modoDaChave, validarChave } from "@/lib/mercadopago";

export const runtime = "nodejs";

/** Conecta (ou desconecta) o Mercado Pago do profissional logado. A chave nunca volta para o navegador. */
export async function POST(req: Request) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Sessão expirada. Entre de novo." }, { status: 401 });
  const b = (await req.json().catch(() => null)) as { token?: string; desconectar?: boolean } | null;
  const admin = supabaseAdmin();
  if (b?.desconectar) {
    await admin.from("profissionais_segredos").upsert({ profissional_id: user.id, mp_access_token: null, atualizado_em: new Date().toISOString() });
    await admin.from("profissionais").update({ mp_conectado: false, mp_modo: null }).eq("id", user.id);
    return NextResponse.json({ conectado: false });
  }
  const token = (b?.token || "").trim();
  const modo = modoDaChave(token);
  if (!modo) return NextResponse.json({ erro: "A chave precisa começar com APP_USR- (conta real) ou TEST- (modo de teste)." }, { status: 400 });
  try {
    await validarChave(token);
  } catch {
    return NextResponse.json({ erro: "O Mercado Pago não aceitou essa chave. Confira se copiou o Access Token completo." }, { status: 400 });
  }
  await admin.from("profissionais_segredos").upsert({ profissional_id: user.id, mp_access_token: token, atualizado_em: new Date().toISOString() });
  await admin.from("profissionais").update({ mp_conectado: true, mp_modo: modo }).eq("id", user.id);
  return NextResponse.json({ conectado: true, modo });
}
