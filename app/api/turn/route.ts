import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/admin";

/**
 * Credenciais TURN de curta duração (Cloudflare Realtime) para a teleconsulta.
 * O TURN repassa o vídeo quando a rede (hospital, 4G, empresa) bloqueia a conexão direta.
 * A chave fica só no servidor; o navegador recebe uma credencial que expira em 4 horas.
 * Só é entregue para uma sala de teleconsulta que existe e não foi encerrada.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const codigo = new URL(req.url).searchParams.get("sala")?.trim() ?? "";
  const id = process.env.CLOUDFLARE_TURN_KEY_ID?.trim();
  const token = process.env.CLOUDFLARE_TURN_API_TOKEN?.trim();
  if (!id || !token || !/^[A-Za-z0-9_-]{4,64}$/.test(codigo)) return NextResponse.json({ iceServers: [] });

  const { data: t } = await supabaseAdmin().from("teleconsultas").select("status").eq("codigo", codigo).maybeSingle();
  if (!t || t.status === "encerrada" || t.status === "cancelada") return NextResponse.json({ iceServers: [] });

  try {
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${id}/credentials/generate-ice-servers`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl: 4 * 60 * 60 }),
      cache: "no-store",
    });
    if (!r.ok) { console.error("turn", r.status, (await r.text()).slice(0, 200)); return NextResponse.json({ iceServers: [] }); }
    const d = (await r.json()) as { iceServers?: RTCIceServer[] | RTCIceServer };
    const lista = Array.isArray(d.iceServers) ? d.iceServers : d.iceServers ? [d.iceServers] : [];
    // A porta 53 costuma ser bloqueada e só atrasa a conexão.
    const limpa = lista.map((s) => ({ ...s, urls: (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u) => !/:53(\?|$)/.test(u)) }));
    return NextResponse.json({ iceServers: limpa }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("turn", String(e).slice(0, 200));
    return NextResponse.json({ iceServers: [] });
  }
}
