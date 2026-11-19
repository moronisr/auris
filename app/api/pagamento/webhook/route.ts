import { NextResponse } from "next/server";
import { confirmarPeloMercadoPago } from "@/lib/mercadopago";

export const runtime = "nodejs";

/**
 * Aviso do Mercado Pago. O conteúdo do aviso não é confiável: só serve para dizer qual pagamento olhar.
 * A confirmação é feita consultando o pagamento direto no Mercado Pago, com a chave do profissional.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const teleId = url.searchParams.get("t") || "";
  const corpo = (await req.json().catch(() => ({}))) as { type?: string; data?: { id?: string | number } };
  const pagamentoId = String(corpo?.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");
  const tipo = corpo?.type || url.searchParams.get("type") || url.searchParams.get("topic");
  if (/^[0-9a-f-]{36}$/.test(teleId) && (tipo === "payment" || !tipo)) {
    try {
      await confirmarPeloMercadoPago(teleId, pagamentoId || undefined);
    } catch (e) {
      console.error("webhook mercado pago", e);
      return NextResponse.json({ ok: false }, { status: 500 }); // o Mercado Pago tenta de novo
    }
  }
  return NextResponse.json({ ok: true });
}

export const GET = POST;
