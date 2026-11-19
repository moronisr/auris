import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

export type ItemReceita = { medicamento: string; quantidade: string; posologia: string };
export type DadosReceita = {
  profissional: string; registro: string; especialidade: string; enderecoConsultorio: string;
  paciente: string; cidade: string; itens: ItemReceita[]; orientacoes: string;
};

/**
 * Nomes comuns de medicamentos que NÃO podem sair por este fluxo (assinatura gov.br):
 * controle especial (Portaria 344/98) exige certificado ICP-Brasil; antimicrobianos e
 * agonistas de GLP-1 exigem serviço integrado ao SNCR (RDC Anvisa 1.000/2025).
 * A lista é um apoio, não é completa: a conferência final é do prescritor.
 */
const RESTRITOS: [RegExp, string][] = [
  [/clonazepam|rivotril|diazepam|alprazolam|bromazepam|lorazepam|midazolam|zolpidem|zopiclona|fenobarbital/i, "controle especial"],
  [/metilfenidato|ritalina|concerta|lisdexanfetamina|venvanse|sibutramina/i, "controle especial"],
  [/tramadol|code[ií]na|morfina|oxicodona|metadona|fentanil|tapentadol/i, "controle especial"],
  [/fluoxetina|sertralina|escitalopram|citalopram|paroxetina|venlafaxina|desvenlafaxina|duloxetina|amitriptilina|nortriptilina|bupropiona|trazodona|mirtazapina/i, "controle especial"],
  [/quetiapina|risperidona|olanzapina|aripiprazol|haloperidol|clorpromazina|l[ií]tio|carbamazepina|valpro|topiramato|lamotrigina|pregabalina|gabapentina/i, "controle especial"],
  [/isotretino[ií]na|roacutan|talidomida|testosterona|oxandrolona|nandrolona|canabidiol|cannabis/i, "controle especial"],
  [/amoxicilina|azitromicina|cefalexina|ciprofloxacino|levofloxacino|claritromicina|doxiciclina|sulfametoxazol|nitrofuranto[ií]na|metronidazol|clindamicina|ceftriaxona|norfloxacino|penicilina|ampicilina|cefadroxila|moxifloxacino|fosfomicina/i, "antimicrobiano"],
  [/semaglutida|ozempic|wegovy|rybelsus|liraglutida|saxenda|victoza|tirzepatida|mounjaro|dulaglutida|trulicity/i, "agonista de GLP-1"],
];

export function restricoes(itens: ItemReceita[]): string[] {
  const achados: string[] = [];
  for (const it of itens) for (const [re, tipo] of RESTRITOS) {
    const m = it.medicamento.match(re);
    if (m) achados.push(`${m[0]} (${tipo})`);
  }
  return [...new Set(achados)];
}

export const limpar = (s: string) => s.replace(/[^\x09\x0A\x20-\x7E -ÿ]/g, (c) => ({ "–": "-", "—": "-", "“": '"', "”": '"', "’": "'", "•": "-" }[c] ?? "?"));

export function quebrar(texto: string, fonte: PDFFont, tam: number, largura: number): string[] {
  const linhas: string[] = [];
  for (const par of limpar(texto).split("\n")) {
    let atual = "";
    for (const p of par.split(/\s+/)) {
      const t = atual ? atual + " " + p : p;
      if (fonte.widthOfTextAtSize(t, tam) > largura && atual) { linhas.push(atual); atual = p; } else atual = t;
    }
    linhas.push(atual);
  }
  return linhas;
}

/** Gera a receita simples em PDF (A4), pronta para ser assinada no Portal de Assinatura gov.br. */
export async function gerarPdfReceita(d: DadosReceita): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Receita - ${limpar(d.paciente)}`);
  pdf.setAuthor(limpar(d.profissional));
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const verde = rgb(0.06, 0.37, 0.35), cinza = rgb(0.34, 0.38, 0.37), tinta = rgb(0.06, 0.09, 0.09);
  const M = 56, L = 595.28 - 2 * M;
  let pag = pdf.addPage([595.28, 841.89]);
  let y = 841.89 - M;
  const escrever = (t: string, o: { fonte?: PDFFont; tam?: number; cor?: ReturnType<typeof rgb>; recuo?: number; depois?: number } = {}) => {
    const fonte = o.fonte ?? normal, tam = o.tam ?? 11, recuo = o.recuo ?? 0;
    for (const linha of quebrar(t, fonte, tam, L - recuo)) {
      if (y < 150) { pag = pdf.addPage([595.28, 841.89]); y = 841.89 - M; }
      pag.drawText(linha, { x: M + recuo, y, size: tam, font: fonte, color: o.cor ?? tinta });
      y -= tam * 1.45;
    }
    y -= o.depois ?? 0;
  };

  escrever(d.profissional, { fonte: negrito, tam: 16 });
  escrever([d.especialidade, d.registro].filter(Boolean).join(", "), { cor: cinza, tam: 10.5 });
  if (d.enderecoConsultorio) escrever(d.enderecoConsultorio, { cor: cinza, tam: 10.5 });
  y -= 6;
  pag.drawLine({ start: { x: M, y }, end: { x: M + L, y }, thickness: 1, color: verde });
  y -= 30;
  escrever("RECEITUÁRIO", { fonte: negrito, tam: 12, cor: verde, depois: 10 });
  escrever(`Paciente: ${d.paciente}`, { tam: 12, depois: 16 });

  d.itens.forEach((it, i) => {
    const titulo = `${i + 1}. ${it.medicamento}`;
    escrever(it.quantidade ? `${titulo}  -  ${it.quantidade}` : titulo, { fonte: negrito, tam: 12 });
    escrever(it.posologia, { recuo: 16, depois: 12 });
  });
  if (d.orientacoes.trim()) {
    y -= 4;
    escrever("Orientações", { fonte: negrito, tam: 11, cor: verde });
    escrever(d.orientacoes, { depois: 8 });
  }

  const data = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
  const ult = pdf.getPages().at(-1)!;
  ult.drawText(limpar(`${d.cidade ? d.cidade + ", " : ""}${data}`), { x: M, y: 128, size: 11, font: normal, color: tinta });
  ult.drawLine({ start: { x: M, y: 104 }, end: { x: M + L, y: 104 }, thickness: 0.5, color: cinza });
  ult.drawText(limpar(`${d.profissional}${d.registro ? " - " + d.registro : ""}`), { x: M, y: 88, size: 10.5, font: negrito, color: tinta });
  ult.drawText("Documento com assinatura eletrônica. A validade depende da assinatura do prescritor.", { x: M, y: 72, size: 9, font: normal, color: cinza });
  ult.drawText("Confira a assinatura em validar.iti.gov.br", { x: M, y: 60, size: 9, font: normal, color: cinza });
  return pdf.save();
}
