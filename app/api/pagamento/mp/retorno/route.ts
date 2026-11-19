import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/admin";
import { trocarCodigo } from "@/lib/mpOauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Volta do Mercado Pago: confere que o pedido saiu daqui, troca o código pela chave e guarda só no servidor. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = url.origin;
  const fim = (r: string) => {
    const res = NextResponse.redirect(`${base}/perfil?mp=${r}#agenda-online`);
    res.cookies.set("mp_estado", "", { maxAge: 0, path: "/api/pagamento/mp" });
    return res;
  };
  const code = url.searchParams.get("code");
  const estado = url.searchParams.get("state");
  const [estadoSalvo, idSalvo] = (req.headers.get("cookie")?.match(/(?:^|;\s*)mp_estado=([^;]+)/)?.[1] || "").split(".");
  if (!code) return fim("cancelado");
  if (!estado || estado !== estadoSalvo) return fim("erro");
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user || user.id !== idSalvo) return fim("erro");
  try {
    const t = await trocarCodigo(code, base);
    const admin = supabaseAdmin();
    const { error } = await admin.from("profissionais_segredos").upsert({
      profissional_id: user.id, mp_access_token: t.access_token, mp_refresh_token: t.refresh_token,
      mp_expira_em: new Date(Date.now() + (t.expires_in || 15552000) * 1000).toISOString(), mp_user_id: String(t.user_id), mp_public_key: t.public_key || null, pagbank_token: null, atualizado_em: new Date().toISOString(),
    });
    if (error) throw error;
    await admin.from("profissionais").update({ mp_conectado: true, mp_modo: t.live_mode === false ? "teste" : "producao", pg_provedor: "mercadopago" }).eq("id", user.id);
    return fim("ok");
  } catch (e) {
    console.error("mp oauth", e);
    return fim("erro");
  }
}
