import type { Metodo } from "@/lib/mercadopago";

/**
 * PagBank (PagSeguro) do profissional, pelo Checkout PagBank: Pix, crédito e débito na página do PagBank.
 * A confirmação é sempre uma consulta do servidor ao PagBank com o token do profissional.
 */
const base = (sandbox: boolean) => (sandbox ? "https://sandbox.api.pagseguro.com" : "https://api.pagseguro.com");

async function pb<T>(token: string, sandbox: boolean, caminho: string, init?: RequestInit): Promise<{ status: number; corpo: T }> {
  const r = await fetch(base(sandbox) + caminho, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json", ...(init?.headers || {}) },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  return { status: r.status, corpo: (await r.json().catch(() => ({}))) as T };
}

/** Confere o token: o PagBank responde 401/403 para token inválido. */
export async function validarTokenPagBank(token: string, sandbox: boolean): Promise<boolean> {
  const { status } = await pb(token, sandbox, "/checkouts/CHEC_00000000-0000-0000-0000-000000000000");
  return status !== 401 && status !== 403;
}

const TIPO: Record<Metodo, string> = { pix: "PIX", credito: "CREDIT_CARD", debito: "DEBIT_CARD" };

export async function criarCobrancaPagBank(o: {
  token: string; sandbox: boolean; teleId: string; codigo: string; valor: number; titulo: string; metodo: Metodo; expira: Date; base: string;
}): Promise<{ url: string; cobrancaId: string }> {
  const volta = `${o.base}/t/${o.codigo}?pg=1`;
  const aviso = `${o.base}/api/pagamento/webhook?t=${o.teleId}`;
  const { status, corpo } = await pb<{ id?: string; links?: { rel: string; href: string }[] }>(o.token, o.sandbox, "/checkouts", {
    method: "POST",
    headers: { "x-idempotency-key": `${o.teleId}-${o.metodo}-${Math.floor(Date.now() / 60000)}` },
    body: JSON.stringify({
      reference_id: o.teleId,
      expiration_date: o.expira.toISOString(),
      customer_modifiable: true,
      items: [{ reference_id: o.teleId, name: o.titulo.slice(0, 64), quantity: 1, unit_amount: Math.round(o.valor * 100) }],
      payment_methods: [{ type: TIPO[o.metodo] }],
      payment_methods_configs: o.metodo === "credito" ? [{ type: "CREDIT_CARD", config_options: [{ option: "INSTALLMENTS_LIMIT", value: "1" }] }] : undefined,
      soft_descriptor: "AURIS",
      redirect_url: volta,
      return_url: volta,
      notification_urls: [aviso],
      payment_notification_urls: [aviso],
    }),
  });
  const url = corpo.links?.find((l) => l.rel === "PAY")?.href;
  if (status >= 300 || !corpo.id || !url) throw new Error(`PagBank ${status}: ${JSON.stringify(corpo).slice(0, 300)}`);
  return { url, cobrancaId: corpo.id };
}

type Cobranca = { id: string; status: string; paid_at?: string; amount?: { value?: number; summary?: { paid?: number } }; payment_method?: { type?: string } };

/** Procura, nos pedidos gerados por este checkout, uma cobrança paga com o valor certo. */
export async function pagamentoPagBank(token: string, sandbox: boolean, checkoutId: string, valor: number):
  Promise<{ id: string; metodo: string; em: string } | null> {
  const ck = await pb<{ orders?: { id: string }[] }>(token, sandbox, `/checkouts/${encodeURIComponent(checkoutId)}`);
  if (ck.status >= 300) throw new Error(`PagBank ${ck.status}`);
  const centavos = Math.round(valor * 100);
  for (const o of ck.corpo.orders || []) {
    const pedido = await pb<{ charges?: Cobranca[] }>(token, sandbox, `/orders/${encodeURIComponent(o.id)}`);
    const c = (pedido.corpo.charges || []).find((x) => x.status === "PAID" && Number(x.amount?.summary?.paid ?? x.amount?.value ?? 0) >= centavos);
    if (c) {
      const t = c.payment_method?.type;
      return { id: c.id, metodo: t === "CREDIT_CARD" ? "credito" : t === "DEBIT_CARD" ? "debito" : "pix", em: c.paid_at || new Date().toISOString() };
    }
  }
  return null;
}

/**
 * Devolve (estorna) uma cobrança paga no PagBank: Pix volta para a conta do pagador, cartão é estornado.
 * Usa o valor guardado no Auris, nunca um valor vindo do navegador.
 */
export async function devolverPagBank(token: string, sandbox: boolean, cobrancaId: string, valor: number):
  Promise<{ ok: true; id: string; valor: number } | { ok: false; erro: string }> {
  if (!/^CHAR_[0-9A-Za-z-]+$/.test(cobrancaId)) return { ok: false, erro: "Pagamento não encontrado no PagBank." };
  const atual = await pb<Cobranca>(token, sandbox, `/charges/${encodeURIComponent(cobrancaId)}`);
  if (atual.corpo.status === "CANCELED") return { ok: true, id: cobrancaId, valor };
  if (atual.corpo.status !== "PAID" && atual.corpo.status !== "AUTHORIZED") return { ok: false, erro: "Este pagamento não está pago no PagBank, então não há valor para devolver." };
  const { status, corpo } = await pb<{ id?: string; status?: string; error_messages?: { description?: string }[] }>(token, sandbox, `/charges/${encodeURIComponent(cobrancaId)}/cancel`, {
    method: "POST", headers: { "x-idempotency-key": `devolucao-${cobrancaId}` },
    body: JSON.stringify({ amount: { value: Math.round(valor * 100) } }),
  });
  if (status < 300 && (corpo.status === "CANCELED" || corpo.status === "PAID")) return { ok: true, id: corpo.id || cobrancaId, valor };
  console.error("pagbank devolver", status, JSON.stringify(corpo).slice(0, 300));
  const texto = (corpo.error_messages || []).map((e) => e.description || "").join(" ");
  if (/saldo|balance|insufficient/i.test(texto)) return { ok: false, erro: "O PagBank não tem saldo suficiente na conta para devolver agora. Deixe saldo no PagBank e tente de novo." };
  return { ok: false, erro: "O PagBank não conseguiu devolver agora. Tente de novo em alguns minutos ou devolva pelo app do PagBank (Vendas, abrir a venda, Estornar)." };
}
