/**
 * Pix estático (padrão BR Code do Banco Central): o paciente paga direto na conta do profissional.
 * O Auris não recebe nem guarda dinheiro. A confirmação do pagamento é feita pelo profissional.
 */
export type TipoChave = "cpf_cnpj" | "telefone" | "email" | "aleatoria";

export const TIPOS_CHAVE: { id: TipoChave; nome: string }[] = [
  { id: "cpf_cnpj", nome: "CPF ou CNPJ" },
  { id: "telefone", nome: "Telefone" },
  { id: "email", nome: "E-mail" },
  { id: "aleatoria", nome: "Chave aleatória" },
];

/** Deixa a chave no formato que os bancos aceitam. Devolve null se estiver inválida. */
export function normalizarChave(tipo: TipoChave, chave: string): string | null {
  const c = chave.trim();
  if (tipo === "cpf_cnpj") {
    const d = c.replace(/\D/g, "");
    return d.length === 11 || d.length === 14 ? d : null;
  }
  if (tipo === "telefone") {
    let d = c.replace(/\D/g, "");
    if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
    return d.length === 10 || d.length === 11 ? `+55${d}` : null;
  }
  if (tipo === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) ? c.toLowerCase() : null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c) ? c.toLowerCase() : null;
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 ]/g, "").trim();
const campo = (id: string, valor: string) => `${id}${String(valor.length).padStart(2, "0")}${valor}`;

function crc16(texto: string): string {
  let crc = 0xffff;
  for (let i = 0; i < texto.length; i++) {
    crc ^= texto.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Código "Pix copia e cola" com valor fixo. */
export function codigoPix(o: { chave: string; nome: string; cidade: string; valor: number; identificador?: string }): string {
  const conta = campo("00", "br.gov.bcb.pix") + campo("01", o.chave);
  const txid = (o.identificador ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  const corpo =
    campo("00", "01") +
    campo("26", conta) +
    campo("52", "0000") +
    campo("53", "986") +
    campo("54", o.valor.toFixed(2)) +
    campo("58", "BR") +
    campo("59", semAcento(o.nome).toUpperCase().slice(0, 25) || "PROFISSIONAL") +
    campo("60", semAcento(o.cidade).toUpperCase().slice(0, 15) || "BRASIL") +
    campo("62", campo("05", txid)) +
    "6304";
  return corpo + crc16(corpo);
}

/** Aceita só endereço https; devolve o link limpo ou null. */
export function linkPagamentoValido(link: string): string | null {
  const l = link.trim();
  if (!l) return null;
  try {
    const u = new URL(l);
    return u.protocol === "https:" && u.hostname.includes(".") ? u.toString() : null;
  } catch {
    return null;
  }
}

export const hostDoLink = (link: string) => { try { return new URL(link).hostname.replace(/^www\./, ""); } catch { return ""; } };

export const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
