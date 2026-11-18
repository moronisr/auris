/** Erro com o código HTTP, para decidir se vale tentar de novo. */
export class ErroHttp extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Falhas passageiras: serviço fora do ar, limite de uso, tempo esgotado ou queda de rede. */
export function falhaPassageira(e: unknown): boolean {
  if (e instanceof ErroHttp) return e.status === 408 || e.status === 409 || e.status === 429 || e.status >= 500;
  const msg = e instanceof Error ? e.message : String(e);
  return /fetch failed|network|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|timeout|overloaded/i.test(msg);
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Executa a função e, se a falha for passageira, tenta de novo com espera crescente.
 * Ex.: 3 tentativas = imediata, depois de 2 s e depois de 6 s.
 */
export async function comTentativas<T>(
  fn: (tentativa: number) => Promise<T>,
  opcoes: { tentativas?: number; esperaMs?: number; repetirSe?: (e: unknown) => boolean; nome?: string } = {},
): Promise<T> {
  const { tentativas = 3, esperaMs = 2000, repetirSe = falhaPassageira, nome = "operação" } = opcoes;
  let ultimo: unknown;
  for (let i = 1; i <= tentativas; i++) {
    try {
      return await fn(i);
    } catch (e) {
      ultimo = e;
      if (i === tentativas || !repetirSe(e)) break;
      console.warn(`${nome}: falha passageira na tentativa ${i}, tentando de novo.`, e instanceof Error ? e.message : e);
      await esperar(esperaMs * (i === 1 ? 1 : 3 ** (i - 1)));
    }
  }
  throw ultimo;
}
