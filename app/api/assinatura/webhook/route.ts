import { NextResponse } from "next/server";
import { timingSafeEqual, createHash } from "crypto";
import { atualizarCobrancaAvulsa, sincronizarPorAssinatura } from "@/lib/assinatura";
import { asaas, asaasConfigurado, tokenWebhookAsaas } from "@/lib/asaas";

export const runtime = "nodejs";
export const maxDuration = 60;

const igual = (a: string, b: string) => timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

/**
 * Aviso do Asaas sobre cobranças do plano. Só serve de gatilho: o servidor consulta o Asaas antes de mudar qualquer coisa.
 * Só aceita avisos com o token combinado no cabeçalho asaas-access-token.
 */
export async function POST(req: Request) {
  if (!asaasConfigurado() || !igual(req.headers.get("asaas-access-token") || "", tokenWebhookAsaas())) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }
  const b = (await req.json().catch(() => ({}))) as { event?: string; payment?: { id?: string; subscription?: string | null } };
  try {
    if (b.payment?.subscription) await sincronizarPorAssinatura(b.payment.subscription);
    else if (b.payment?.id) await atualizarCobrancaAvulsa(await asaas(`/payments/${encodeURIComponent(b.payment.id)}`));
  } catch (e) {
    console.error("webhook asaas", b.event, String(e).slice(0, 200));
  }
  return NextResponse.json({ ok: true });
}
