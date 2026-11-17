import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

/**
 * Documentos gerados a partir da ficha já aprovada pelo profissional.
 * Nenhum texto é criado por IA aqui: os modelos usam somente o que está na ficha
 * e o profissional revisa e edita tudo antes de gerar o PDF.
 */
export type TipoDocumento = "atestado" | "exames" | "encaminhamento" | "resumo";
export type Dados = Record<string, string | number | null | undefined>;

export const DOCUMENTOS: { id: TipoDocumento; nome: string; titulo: string; descricao: string }[] = [
  { id: "resumo", nome: "Resumo para o paciente", titulo: "ORIENTAÇÕES DA CONSULTA", descricao: "O que foi combinado, em texto simples, para o paciente levar." },
  { id: "atestado", nome: "Atestado", titulo: "ATESTADO", descricao: "Comparecimento ou afastamento." },
  { id: "exames", nome: "Pedido de exames", titulo: "SOLICITAÇÃO DE EXAMES", descricao: "Lista de exames solicitados na consulta." },
  { id: "encaminhamento", nome: "Encaminhamento", titulo: "ENCAMINHAMENTO", descricao: "Para outro profissional ou serviço." },
];

const txt = (v: unknown) => (v == null ? "" : String(v).trim());
const hoje = () => new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

/** Texto inicial de cada documento, montado só com o que está na ficha. O profissional edita antes de gerar. */
export function textoInicial(tipo: TipoDocumento, d: Dados, opcoes: { dias?: string; destino?: string } = {}): string {
  const nome = txt(d.paciente_nome) || "[nome do paciente]";
  if (tipo === "atestado") {
    const dias = txt(opcoes.dias);
    return dias
      ? `Atesto, para os devidos fins, que ${nome} foi atendido(a) por mim em ${hoje()} e necessita de ${dias} dia(s) de afastamento de suas atividades, a contar desta data.`
      : `Atesto, para os devidos fins, que ${nome} compareceu a atendimento comigo em ${hoje()}.`;
  }
  if (tipo === "exames") {
    const exames = txt(d.exames_solicitados);
    return exames ? `Solicito os seguintes exames:\n\n${exames}` : "Solicito os seguintes exames:\n\n";
  }
  if (tipo === "encaminhamento") {
    const partes = [
      `Encaminho ${nome} para avaliação${txt(opcoes.destino) ? ` com ${txt(opcoes.destino)}` : ""}.`,
      txt(d.queixa_principal) && `Queixa principal: ${txt(d.queixa_principal)}`,
      txt(d.historia_atual) && `História: ${txt(d.historia_atual)}`,
      txt(d.impressao_profissional) && `Impressão do profissional: ${txt(d.impressao_profissional)}`,
      txt(d.conduta) && `Conduta até o momento: ${txt(d.conduta)}`,
      "Agradeço a atenção.",
    ];
    return partes.filter(Boolean).join("\n\n");
  }
  const partes = [
    txt(d.orientacoes) && `Orientações:\n${txt(d.orientacoes)}`,
    txt(d.prescricoes) && `Medicamentos:\n${txt(d.prescricoes)}`,
    txt(d.exames_solicitados) && `Exames a fazer:\n${txt(d.exames_solicitados)}`,
    txt(d.retorno_meses) && `Retorno: em ${txt(d.retorno_meses)} ${Number(d.retorno_meses) === 1 ? "mês" : "meses"}.`,
  ].filter(Boolean);
  return partes.length ? partes.join("\n\n") : "";
}

const limpar = (s: string) => s.replace(/[^\x09\x0A\x20-\x7E\xA0-\xFF]/g, (c) => ({ "–": "-", "—": "-", "“": '"', "”": '"', "’": "'", "•": "-", "…": "..." }[c] ?? "?"));

function quebrar(texto: string, fonte: PDFFont, tam: number, largura: number): string[] {
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

export type DadosDocumento = {
  titulo: string; profissional: string; registro: string; especialidade: string; enderecoConsultorio: string;
  paciente: string; cidade: string; corpo: string;
};

/** Gera o documento em PDF (A4), com o mesmo visual da receita, pronto para assinatura eletrônica. */
export async function gerarPdfDocumento(d: DadosDocumento): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(limpar(`${d.titulo} - ${d.paciente}`));
  pdf.setAuthor(limpar(d.profissional));
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const verde = rgb(0.06, 0.37, 0.35), cinza = rgb(0.34, 0.38, 0.37), tinta = rgb(0.06, 0.09, 0.09);
  const M = 56, L = 595.28 - 2 * M;
  let pag = pdf.addPage([595.28, 841.89]);
  let y = 841.89 - M;
  const escrever = (t: string, o: { fonte?: PDFFont; tam?: number; cor?: ReturnType<typeof rgb>; depois?: number } = {}) => {
    const fonte = o.fonte ?? normal, tam = o.tam ?? 11.5;
    for (const linha of quebrar(t, fonte, tam, L)) {
      if (y < 150) { pag = pdf.addPage([595.28, 841.89]); y = 841.89 - M; }
      pag.drawText(linha, { x: M, y, size: tam, font: fonte, color: o.cor ?? tinta });
      y -= tam * 1.5;
    }
    y -= o.depois ?? 0;
  };

  escrever(d.profissional, { fonte: negrito, tam: 16 });
  const linhaProf = [d.especialidade, d.registro].filter(Boolean).join(", ");
  if (linhaProf) escrever(linhaProf, { cor: cinza, tam: 10.5 });
  if (d.enderecoConsultorio) escrever(d.enderecoConsultorio, { cor: cinza, tam: 10.5 });
  y -= 6;
  pag.drawLine({ start: { x: M, y }, end: { x: M + L, y }, thickness: 1, color: verde });
  y -= 30;
  escrever(d.titulo, { fonte: negrito, tam: 12, cor: verde, depois: 10 });
  escrever(`Paciente: ${d.paciente}`, { tam: 12, depois: 16 });
  escrever(d.corpo);

  const data = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
  const ult = pdf.getPages().at(-1)!;
  ult.drawText(limpar(`${d.cidade ? d.cidade + ", " : ""}${data}`), { x: M, y: 128, size: 11, font: normal, color: tinta });
  ult.drawLine({ start: { x: M, y: 104 }, end: { x: M + L, y: 104 }, thickness: 0.5, color: cinza });
  ult.drawText(limpar(`${d.profissional}${d.registro ? ", " + d.registro : ""}`), { x: M, y: 88, size: 10.5, font: negrito, color: tinta });
  ult.drawText("Documento revisado e emitido pelo profissional responsável.", { x: M, y: 72, size: 9, font: normal, color: cinza });
  return pdf.save();
}

/** Texto da ficha para colar em outro prontuário: um campo por linha, agrupado. */
export function textoProntuario(grupos: { grupo: string; linhas: { rotulo: string; valor: string }[] }[], cabecalho: string): string {
  const corpo = grupos.map((g) => `${g.grupo.toUpperCase()}\n${g.linhas.map((l) => `${l.rotulo}: ${l.valor}`).join("\n")}`).join("\n\n");
  return `${cabecalho}\n\n${corpo}`;
}
