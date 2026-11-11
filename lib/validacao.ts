import type { Ficha } from "./modelos";

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

const n = (v: unknown) => (typeof v === "number" ? v : null);

/** Avisos para o profissional revisar. Não bloqueiam: quem decide é ele. */
export function validarFicha(f: Ficha, modelo: string): string[] {
  const avisos: string[] = [];
  if (!f.paciente_nome) avisos.push("Nome do paciente não identificado.");
  if (typeof f.paciente_cpf === "string" && f.paciente_cpf && !cpfValido(f.paciente_cpf))
    avisos.push("CPF inválido: confira os números.");
  const idade = n(f.paciente_idade);
  if (idade != null && (idade < 0 || idade > 120)) avisos.push("Idade fora do esperado.");
  if (typeof f.paciente_email === "string" && f.paciente_email && !/^\S+@\S+\.\S+$/.test(f.paciente_email))
    avisos.push("E-mail do paciente parece inválido.");

  if (modelo === "oftalmologia") {
    const passo = (v: number) => Math.abs(Math.round(v * 100) % 25) > 0;
    for (const olho of ["od", "oe"]) {
      const O = olho.toUpperCase();
      const esf = n(f[`${olho}_esferico`]), cil = n(f[`${olho}_cilindrico`]), eixo = n(f[`${olho}_eixo`]);
      if (esf != null && (esf < -30 || esf > 30)) avisos.push(`Esférico ${O} fora da faixa (-30 a +30).`);
      if (esf != null && passo(esf)) avisos.push(`Esférico ${O} não é múltiplo de 0,25.`);
      if (cil != null && (cil < -10 || cil > 10)) avisos.push(`Cilíndrico ${O} fora da faixa (-10 a +10).`);
      if (cil != null && passo(cil)) avisos.push(`Cilíndrico ${O} não é múltiplo de 0,25.`);
      if (eixo != null && (eixo < 0 || eixo > 180)) avisos.push(`Eixo ${O} deve estar entre 0 e 180.`);
      if (cil != null && cil !== 0 && eixo == null) avisos.push(`Há cilíndrico ${O} sem eixo informado.`);
    }
    const ad = n(f.adicao);
    if (ad != null && (ad < 0.75 || ad > 4)) avisos.push("Adição fora da faixa (+0,75 a +4,00).");
  }
  return avisos;
}
