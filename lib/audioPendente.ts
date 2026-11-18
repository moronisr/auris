/**
 * Guarda a última gravação neste aparelho (IndexedDB) até a ficha ficar pronta.
 * Se a internet cair, o servidor falhar ou o navegador fechar, o profissional envia de novo sem regravar.
 * A gravação é apagada assim que a ficha é montada, ou após 24 horas.
 */
export type ConfigEnvio = { area: string; modelo: string; modo: "ditado" | "consulta"; consentimento: boolean };
export type AudioPendente = ConfigEnvio & { audio: Blob; em: number };

const BANCO = "auris";
const LOJA = "audio_pendente";
const CHAVE = "ultimo";
const VALIDADE_MS = 24 * 60 * 60 * 1000;

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, falha) => {
    if (typeof indexedDB === "undefined") return falha(new Error("sem IndexedDB"));
    const req = indexedDB.open(BANCO, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(LOJA);
    req.onsuccess = () => ok(req.result);
    req.onerror = () => falha(req.error);
  });
}

async function operar<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  try {
    const db = await abrir();
    return await new Promise<T | undefined>((ok) => {
      const req = fn(db.transaction(LOJA, modo).objectStore(LOJA));
      req.onsuccess = () => ok(req.result as T);
      req.onerror = () => ok(undefined);
    });
  } catch {
    return undefined; // modo privado ou navegador sem suporte: segue sem a cópia local
  }
}

export const guardarPendente = (p: AudioPendente) => operar("readwrite", (s) => s.put(p, CHAVE));
export const apagarPendente = () => operar("readwrite", (s) => s.delete(CHAVE));

export async function lerPendente(): Promise<AudioPendente | null> {
  const p = await operar<AudioPendente>("readonly", (s) => s.get(CHAVE));
  if (!p?.audio || Date.now() - p.em > VALIDADE_MS) {
    if (p) await apagarPendente();
    return null;
  }
  return p;
}
