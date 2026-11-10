export type Ficha = {
  paciente_nome: string | null;
  paciente_idade: number | null;
  paciente_cpf: string | null;
  paciente_telefone: string | null;
  od_esferico: number | null;
  od_cilindrico: number | null;
  od_eixo: number | null;
  oe_esferico: number | null;
  oe_cilindrico: number | null;
  oe_eixo: number | null;
  adicao: number | null;
  dnp: string | null;
  observacoes: string | null;
  retorno_meses: number | null;
};

export function cpfValido(cpf: string): boolean {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

export function formatarCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, "");
  return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : cpf;
}

/** Retorna avisos para o médico revisar. Não bloqueia: quem decide é ele. */
export function validarFicha(f: Ficha): string[] {
  const avisos: string[] = [];
  if (!f.paciente_nome) avisos.push("Nome do paciente não identificado.");
  if (f.paciente_cpf && !cpfValido(f.paciente_cpf)) avisos.push("CPF inválido: confira os números.");
  if (f.paciente_idade != null && (f.paciente_idade < 0 || f.paciente_idade > 120))
    avisos.push("Idade fora do esperado.");

  const esf = (v: number | null, olho: string) => {
    if (v == null) return;
    if (v < -30 || v > 30) avisos.push(`Esférico ${olho} fora da faixa (-30 a +30).`);
    if (Math.abs((v * 100) % 25) > 0.01) avisos.push(`Esférico ${olho} não é múltiplo de 0,25.`);
  };
  const cil = (v: number | null, olho: string) => {
    if (v == null) return;
    if (v < -10 || v > 10) avisos.push(`Cilíndrico ${olho} fora da faixa (-10 a +10).`);
    if (Math.abs((v * 100) % 25) > 0.01) avisos.push(`Cilíndrico ${olho} não é múltiplo de 0,25.`);
  };
  const eixo = (v: number | null, c: number | null, olho: string) => {
    if (v != null && (v < 0 || v > 180)) avisos.push(`Eixo ${olho} deve estar entre 0 e 180.`);
    if (c != null && c !== 0 && v == null) avisos.push(`Há cilíndrico ${olho} sem eixo informado.`);
  };
  esf(f.od_esferico, "OD"); cil(f.od_cilindrico, "OD"); eixo(f.od_eixo, f.od_cilindrico, "OD");
  esf(f.oe_esferico, "OE"); cil(f.oe_cilindrico, "OE"); eixo(f.oe_eixo, f.oe_cilindrico, "OE");
  if (f.adicao != null && (f.adicao < 0.75 || f.adicao > 4)) avisos.push("Adição fora da faixa (+0,75 a +4,00).");
  return avisos;
}
