/**
 * Envio pela API oficial do WhatsApp Business (Meta Cloud API). Só roda no servidor.
 * As mensagens que o Auris inicia precisam de modelos aprovados pela Meta, com estes nomes.
 */
export const MODELOS_WHATSAPP = {
  convite: "auris_convite_teleconsulta",
  lembrete: "auris_lembrete_teleconsulta",
  documentos: "auris_documentos_consulta",
  cancelamento: "auris_cancelamento_teleconsulta",
} as const;
export type ModeloWhatsApp = keyof typeof MODELOS_WHATSAPP;

export const whatsappAtivo = () => !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);

export function numeroWhatsApp(telefone: string | null | undefined): string | null {
  let d = (telefone ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (!d.startsWith("55")) d = "55" + d;
  return d.length === 12 || d.length === 13 ? d : null;
}

const TZ = "America/Sao_Paulo";
export const dataParaMensagem = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit", timeZone: TZ });

/**
 * Envia um modelo aprovado. `textos` preenche {{1}}, {{2}}... do corpo;
 * `sufixoLink` completa o botão de link do modelo (o código da consulta ou da página).
 */
export async function enviarModelo(
  modelo: ModeloWhatsApp, telefone: string, textos: string[], sufixoLink: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (!whatsappAtivo()) return { ok: false, erro: "WhatsApp automático ainda não configurado." };
  const para = numeroWhatsApp(telefone);
  if (!para) return { ok: false, erro: "Número de WhatsApp inválido. Use DDD e número." };
  const versao = process.env.WHATSAPP_API_VERSION || "v23.0";
  try {
    const r = await fetch(`https://graph.facebook.com/${versao}/${process.env.WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: para,
        type: "template",
        template: {
          name: MODELOS_WHATSAPP[modelo],
          language: { code: "pt_BR" },
          components: [
            { type: "body", parameters: textos.map((t) => ({ type: "text", text: t.slice(0, 200) })) },
            { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: sufixoLink }] },
          ],
        },
      }),
    });
    if (r.ok) return { ok: true };
    const corpo = await r.json().catch(() => null);
    const msg: string = corpo?.error?.error_data?.details || corpo?.error?.message || `código ${r.status}`;
    if (/template/i.test(msg)) return { ok: false, erro: "O modelo de mensagem ainda não foi aprovado pela Meta." };
    return { ok: false, erro: `O WhatsApp recusou o envio: ${msg}` };
  } catch {
    return { ok: false, erro: "Não consegui falar com o WhatsApp agora. Tente de novo." };
  }
}
