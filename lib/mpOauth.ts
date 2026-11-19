/**
 * Conexão do Mercado Pago pelo botão "Conectar com Mercado Pago" (OAuth).
 * Usa a aplicação Auris (MP_CLIENT_ID / MP_CLIENT_SECRET, só no servidor).
 * O médico entra na conta dele no site do Mercado Pago e autoriza; o Auris recebe uma chave em nome dele.
 */
const AUTH = "https://auth.mercadopago.com.br/authorization";
const TOKEN = "https://api.mercadopago.com/oauth/token";

export const oauthDisponivel = () => !!(process.env.MP_CLIENT_ID && process.env.MP_CLIENT_SECRET);
export const urlRetorno = (base: string) => `${base}/api/pagamento/mp/retorno`;

export function urlAutorizacao(base: string, estado: string) {
  const q = new URLSearchParams({ client_id: process.env.MP_CLIENT_ID!, response_type: "code", platform_id: "mp", state: estado, redirect_uri: urlRetorno(base) });
  return `${AUTH}?${q}`;
}

export type TokensMp = { access_token: string; refresh_token: string; expires_in: number; user_id: number; live_mode: boolean };

async function pedirToken(corpo: Record<string, string>): Promise<TokensMp> {
  const r = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: process.env.MP_CLIENT_ID, client_secret: process.env.MP_CLIENT_SECRET, ...corpo }),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) throw new Error(`Mercado Pago OAuth ${r.status}: ${JSON.stringify(d).slice(0, 200)}`);
  return d as TokensMp;
}

export const trocarCodigo = (code: string, base: string) => pedirToken({ grant_type: "authorization_code", code, redirect_uri: urlRetorno(base) });
export const renovar = (refresh: string) => pedirToken({ grant_type: "refresh_token", refresh_token: refresh });
