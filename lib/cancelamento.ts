/** Política de cancelamento mostrada ao paciente antes de pagar e no link da consulta. */
export function prazoTexto(horas: number): string {
  if (horas <= 0) return "até o horário da consulta";
  if (horas % 24 === 0) { const d = horas / 24; return `até ${d === 1 ? "24 horas" : `${d} dias`} antes do horário`; }
  return `até ${horas} horas antes do horário`;
}

/** O recado do cancelamento guarda o WhatsApp para remarcar numa marca no início: [[whats:91999999999]]. */
const MARCA = /^\[\[whats:(\d{10,13})\]\]\n?/;
export function separarObs(obs?: string | null): { whats: string; recado: string } {
  const t = obs || "";
  const m = t.match(MARCA);
  return { whats: m ? m[1] : "", recado: t.replace(MARCA, "").trim() };
}
export function juntarObs(whats: string, recado: string): string | null {
  const d = whats.replace(/\D/g, "");
  const r = recado.trim();
  const tudo = (d.length >= 10 ? `[[whats:${d}]]` + (r ? "\n" : "") : "") + r;
  return tudo ? tudo.slice(0, 500) : null;
}
const foneBR = (d: string) => (d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`);

/** pagina: onde o paciente remarca sozinho (link da página do profissional ou "nesta página"); quando houver, vem antes do WhatsApp. */
export function politicaCancelamento(horas: number, obsBruto?: string | null, pagina?: string | null): string[] {
  const { whats, recado: obs } = separarObs(obsBruto);
  const linhas = [
    `Você pode cancelar pelo próprio link da consulta ${prazoTexto(horas)} e recebe o valor integral de volta, automaticamente.`,
    "Depois desse prazo, ou se você não entrar na consulta, o valor não é devolvido.",
    "Se o consultório precisar cancelar, você escolhe: remarcar sem pagar de novo ou receber o valor integral de volta.",
    "Devolução no Pix: o valor volta para a conta que pagou, em geral em poucos minutos. No cartão: o estorno aparece na fatura em até duas faturas, conforme o banco.",
  ];
  if (pagina) linhas.push(`Para remarcar ou reagendar, escolha um novo horário ${pagina}.${whats ? ` Se preferir, chame o consultório no WhatsApp ${foneBR(whats)}.` : ""}`);
  else linhas.push(whats ? `Para remarcar ou reagendar, chame o consultório no WhatsApp ${foneBR(whats)}.` : "Para remarcar ou reagendar, fale com o consultório.");
  if (obs) linhas.push(obs);
  return linhas;
}

/** O paciente ainda pode cancelar com devolução? */
export function podeCancelarComDevolucao(inicio: string, horas: number, agora = new Date()): boolean {
  return agora.getTime() <= new Date(inicio).getTime() - Math.max(0, horas) * 3600e3;
}
