import { NextResponse } from "next/server";
import { sincronizarPorAssinatura, sincronizarPorFatura } from "@/lib/assinatura";

export const runtime = "nodejs";

/** Aviso do Mercado Pago sobre assinaturas. Só serve de gatilho: o servidor consulta o Mercado Pago antes de mudar qualquer coisa. */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const b = (await req.json().catch(() => ({}))) as { type?: string; topic?: string; data?: { id?: string }; id?: string };
  const tipo = b.type || b.topic || url.searchParams.get("type") || url.searchParams.get("topic") || "";
  const id = String(b.data?.id || url.searchParams.get("data.id") || url.searchParams.get("id") || "");
  try {
    if (id && /preapproval$/.test(tipo)) await sincronizarPorAssinatura(id);
    else if (id && /authorized_payment/.test(tipo)) await sincronizarPorFatura(id);
  } catch (e) {
    console.error("webhook assinatura", tipo, String(e).slice(0, 200));
  }
  return NextResponse.json({ ok: true });
}
