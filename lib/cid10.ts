import tabela from "@/public/cid10.json";

/** Tabela CID-10 (DATASUS) — [código, descrição]. */
const MAPA = new Map<string, string>(tabela as [string, string][]);

/**
 * Normaliza o campo CID-10: aceita "J45.9", "j459", "J45.9 asma" ou vários separados por ; ou ,
 * Mantém só códigos que existem na tabela oficial e devolve "J45.9 Asma não especificada; I10 Hipertensão…".
 */
export function normalizarCid(valor: unknown): string | null {
  if (valor == null) return null;
  const partes = String(valor).split(/[;,\n]+/).map((p) => p.trim()).filter(Boolean);
  const saida: string[] = [];
  for (const p of partes) {
    const m = p.toUpperCase().match(/^([A-Z])\s*(\d{2})(?:\.?(\d))?/);
    if (!m) continue;
    const comSub = m[3] ? `${m[1]}${m[2]}.${m[3]}` : null;
    const cat = `${m[1]}${m[2]}`;
    const codigo = comSub && MAPA.has(comSub) ? comSub : MAPA.has(cat) ? cat : null;
    if (codigo && !saida.some((x) => x.startsWith(codigo + " "))) saida.push(`${codigo} ${MAPA.get(codigo)}`);
  }
  return saida.length ? saida.join("; ") : null;
}
