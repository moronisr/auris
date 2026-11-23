import { createHash } from "crypto";

/**
 * Cliente da API do Asaas (cobrança do plano do Auris).
 * A chave fica só no servidor (ASAAS_API_KEY). O ambiente sai da própria chave:
 * chaves de produção começam com $aact_prod_; as demais usam o sandbox.
 */
const chave = () => (process.env.ASAAS_API_KEY || "").trim();
export const asaasConfigurado = () => !!chave();
export const asaasProducao = () => chave().startsWith("$aact_prod_");
const base = () => (asaasProducao() ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3");

export class ErroAsaas extends Error {
  status: number;
  corpo: { errors?: { code?: string; description?: string }[] } | null;
  constructor(status: number, corpo: ErroAsaas["corpo"]) {
    super(`Asaas ${status}: ${JSON.stringify(corpo).slice(0, 400)}`);
    this.status = status;
    this.corpo = corpo;
  }
  /** Mensagem do Asaas para o usuário (já vem em português). */
  get descricao(): string {
    return (this.corpo?.errors || []).map((e) => e.description || "").filter(Boolean).join(" ");
  }
  get codigo(): string {
    return this.corpo?.errors?.[0]?.code || "";
  }
}

export async function asaas<T>(caminho: string, init?: RequestInit): Promise<T> {
  const r = await fetch(base() + caminho, {
    ...init,
    headers: { access_token: chave(), "Content-Type": "application/json", "User-Agent": "Auris (aurismed.com.br)", ...(init?.headers || {}) },
    signal: AbortSignal.timeout(50_000),
    cache: "no-store",
  });
  const corpo = await r.json().catch(() => null);
  if (!r.ok) throw new ErroAsaas(r.status, corpo);
  return corpo as T;
}

/** Token que o Asaas envia no cabeçalho asaas-access-token dos avisos. Derivado da chave: nenhum segredo a mais para guardar. */
export const tokenWebhookAsaas = () => createHash("sha256").update(`auris-webhook:${chave()}`).digest("hex");

/** Data de hoje (ou de um momento) no fuso de Brasília, no formato AAAA-MM-DD que o Asaas usa. */
export const diaBR = (d: Date = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);

/** Bandeira do Asaas (VISA, MASTERCARD...) no código curto usado nas telas do Auris. */
export function bandeiraCurta(b?: string | null): string | null {
  const m: Record<string, string> = { VISA: "visa", MASTERCARD: "master", AMEX: "amex", ELO: "elo", HIPERCARD: "hipercard" };
  return b ? m[b.toUpperCase()] || b.toLowerCase() : null;
}

/** Situação da cobrança no Asaas traduzida para o vocabulário que o Auris já usa no histórico. */
export function statusCobranca(s: string): string {
  if (/^(CONFIRMED|RECEIVED|RECEIVED_IN_CASH)$/.test(s)) return "approved";
  if (s === "AWAITING_RISK_ANALYSIS") return "in_process";
  if (s === "PENDING") return "pending";
  if (s === "OVERDUE") return "rejected";
  if (/REFUND/.test(s)) return "refunded";
  if (s === "CHARGEBACK_DISPUTE") return "in_mediation";
  if (/CHARGEBACK/.test(s)) return "charged_back";
  return s.toLowerCase();
}
