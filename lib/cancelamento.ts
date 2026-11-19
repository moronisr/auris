/** Política de cancelamento mostrada ao paciente antes de pagar e no link da consulta. */
export function prazoTexto(horas: number): string {
  if (horas <= 0) return "até o horário da consulta";
  if (horas % 24 === 0) { const d = horas / 24; return `até ${d === 1 ? "24 horas" : `${d} dias`} antes do horário`; }
  return `até ${horas} horas antes do horário`;
}

export function politicaCancelamento(horas: number, obs?: string | null): string[] {
  const linhas = [
    `Você pode cancelar pelo próprio link da consulta ${prazoTexto(horas)} e recebe o valor integral de volta, automaticamente.`,
    "Depois desse prazo, ou se você não entrar na consulta, o valor não é devolvido.",
    "Se o consultório precisar cancelar, você recebe o valor integral de volta.",
    "Devolução no Pix: o valor volta para a conta que pagou, em geral em poucos minutos. No cartão: o estorno aparece na fatura em até duas faturas, conforme o banco.",
  ];
  if (obs?.trim()) linhas.push(obs.trim());
  return linhas;
}

/** O paciente ainda pode cancelar com devolução? */
export function podeCancelarComDevolucao(inicio: string, horas: number, agora = new Date()): boolean {
  return agora.getTime() <= new Date(inicio).getTime() - Math.max(0, horas) * 3600e3;
}
