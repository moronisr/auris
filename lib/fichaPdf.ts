import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { limpar, quebrar } from "@/lib/receita";

export type DadosFichaPdf = {
  profissional: string; detalhes: string; modelo: string; quando: string; modalidade?: string;
  grupos: { grupo: string; linhas: { rotulo: string; valor: string }[] }[];
  linhaIA: string; registroId: string;
};

/** Ficha clínica em PDF (A4), pronta para assinatura digital (gov.br ou certificado ICP-Brasil). */
export async function gerarPdfFicha(d: DadosFichaPdf): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(limpar(`Ficha - ${d.modelo} - ${d.quando}`));
  pdf.setAuthor(limpar(d.profissional));
  pdf.setCreator("Auris");
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const verde = rgb(0.06, 0.37, 0.35), cinza = rgb(0.34, 0.38, 0.37), tinta = rgb(0.06, 0.09, 0.09);
  const W = 595.28, H = 841.89, M = 56, L = W - 2 * M;
  let pag = pdf.addPage([W, H]);
  let y = H - M;
  const espaco = (alt: number) => { if (y - alt < M + 40) { pag = pdf.addPage([W, H]); y = H - M; } };
  const escrever = (texto: string, tam: number, fonte = normal, cor = tinta, entre = 4) => {
    for (const linha of quebrar(texto, fonte, tam, L)) {
      espaco(tam + entre);
      pag.drawText(linha, { x: M, y: y - tam, size: tam, font: fonte, color: cor });
      y -= tam + entre;
    }
  };

  escrever(d.profissional, 15, negrito);
  if (d.detalhes) escrever(d.detalhes, 10, normal, cinza);
  y -= 4;
  escrever(`${d.modelo}  |  ${d.quando}`, 10, normal, cinza);
  y -= 6;
  pag.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.8, color: verde });
  y -= 14;
  if (d.modalidade) { escrever("MODALIDADE", 9, negrito, verde, 3); escrever(d.modalidade, 10.5); y -= 8; }
  for (const g of d.grupos) {
    espaco(30);
    escrever(g.grupo.toUpperCase(), 9, negrito, verde, 3);
    for (const l of g.linhas) {
      escrever(l.rotulo, 9.5, negrito, cinza, 2);
      escrever(l.valor, 10.5);
      y -= 4;
    }
    y -= 6;
  }
  y -= 6;
  escrever(d.linhaIA, 8.5, normal, cinza);
  escrever(`Identificador do registro: ${d.registroId}`, 8, normal, cinza);
  return pdf.save();
}

/** Confere se o arquivo parece um PDF com assinatura digital embutida. */
export function pareceAssinado(bytes: Uint8Array): boolean {
  if (bytes.length < 1000) return false;
  const cab = new TextDecoder("latin1").decode(bytes.slice(0, 5));
  if (cab !== "%PDF-") return false;
  const texto = new TextDecoder("latin1").decode(bytes);
  return /\/ByteRange\s*\[/.test(texto) && /\/(Sig|DocTimeStamp)\b/.test(texto);
}
