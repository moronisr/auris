/**
 * Modelos de registro por área. Cada profissão nova = um modelo novo, sem mudar o resto do sistema.
 * Campos do paciente são comuns a todos os modelos.
 */
export type TipoCampo = "texto" | "longo" | "numero" | "inteiro";
export type Campo = { chave: string; rotulo: string; tipo: TipoCampo; grupo: string };
export type Modelo = { id: string; nome: string; descricao: string; instrucoes: string; campos: Campo[] };

export const CAMPOS_PACIENTE: Campo[] = [
  { chave: "paciente_nome", rotulo: "Nome", tipo: "texto", grupo: "Paciente" },
  { chave: "paciente_idade", rotulo: "Idade", tipo: "inteiro", grupo: "Paciente" },
  { chave: "paciente_cpf", rotulo: "CPF", tipo: "texto", grupo: "Paciente" },
  { chave: "paciente_telefone", rotulo: "Telefone", tipo: "texto", grupo: "Paciente" },
  { chave: "paciente_email", rotulo: "E-mail", tipo: "texto", grupo: "Paciente" },
];

const RETORNO: Campo = { chave: "retorno_meses", rotulo: "Retorno (meses)", tipo: "inteiro", grupo: "Retorno" };

export const MODELOS: Record<string, Modelo> = {
  geral: {
    id: "geral",
    nome: "Atendimento clínico (geral)",
    descricao: "Para qualquer profissional de saúde.",
    instrucoes:
      "Organize o atendimento no formato clínico: queixa, história, antecedentes, exame, impressão do profissional, conduta e orientações.",
    campos: [
      { chave: "queixa_principal", rotulo: "Queixa principal", tipo: "longo", grupo: "Anamnese" },
      { chave: "historia_atual", rotulo: "História da doença atual", tipo: "longo", grupo: "Anamnese" },
      { chave: "antecedentes", rotulo: "Antecedentes pessoais e familiares", tipo: "longo", grupo: "Anamnese" },
      { chave: "medicamentos_em_uso", rotulo: "Medicamentos em uso", tipo: "longo", grupo: "Anamnese" },
      { chave: "alergias", rotulo: "Alergias", tipo: "texto", grupo: "Anamnese" },
      { chave: "sinais_vitais", rotulo: "Sinais vitais", tipo: "texto", grupo: "Exame" },
      { chave: "exame_fisico", rotulo: "Exame físico", tipo: "longo", grupo: "Exame" },
      { chave: "impressao_profissional", rotulo: "Impressão / hipótese do profissional", tipo: "longo", grupo: "Avaliação" },
      { chave: "conduta", rotulo: "Conduta", tipo: "longo", grupo: "Plano" },
      { chave: "prescricoes", rotulo: "Prescrições", tipo: "longo", grupo: "Plano" },
      { chave: "exames_solicitados", rotulo: "Exames solicitados", tipo: "longo", grupo: "Plano" },
      { chave: "orientacoes", rotulo: "Orientações ao paciente", tipo: "longo", grupo: "Plano" },
      RETORNO,
    ],
  },
  oftalmologia: {
    id: "oftalmologia",
    nome: "Oftalmologia (refração)",
    descricao: "Cadastro e grau de cada olho.",
    instrucoes:
      "Graus em dioptrias, com sinal: 'menos dois' = -2.00; 'mais um e meio' = 1.50; 'plano' = 0. OD = olho direito, OE = olho esquerdo; 'ambos os olhos' vale para os dois. Eixo em graus inteiros de 0 a 180.",
    campos: [
      { chave: "od_esferico", rotulo: "OD esférico", tipo: "numero", grupo: "Olho direito (OD)" },
      { chave: "od_cilindrico", rotulo: "OD cilíndrico", tipo: "numero", grupo: "Olho direito (OD)" },
      { chave: "od_eixo", rotulo: "OD eixo (°)", tipo: "inteiro", grupo: "Olho direito (OD)" },
      { chave: "oe_esferico", rotulo: "OE esférico", tipo: "numero", grupo: "Olho esquerdo (OE)" },
      { chave: "oe_cilindrico", rotulo: "OE cilíndrico", tipo: "numero", grupo: "Olho esquerdo (OE)" },
      { chave: "oe_eixo", rotulo: "OE eixo (°)", tipo: "inteiro", grupo: "Olho esquerdo (OE)" },
      { chave: "adicao", rotulo: "Adição", tipo: "numero", grupo: "Outros" },
      { chave: "dnp", rotulo: "DNP", tipo: "texto", grupo: "Outros" },
      { chave: "observacoes", rotulo: "Observações", tipo: "longo", grupo: "Outros" },
      RETORNO,
    ],
  },
  psicologia: {
    id: "psicologia",
    nome: "Psicologia / Psicanálise (evolução de sessão)",
    descricao: "Registro de sessão ditado pelo profissional após o atendimento.",
    instrucoes:
      "Registro de evolução de sessão. Use linguagem técnica, objetiva e respeitosa. Registre apenas o essencial ao acompanhamento; não transcreva falas íntimas do paciente na íntegra, resuma.",
    campos: [
      { chave: "demanda", rotulo: "Demanda / motivo do acompanhamento", tipo: "longo", grupo: "Sessão" },
      { chave: "sintese_sessao", rotulo: "Síntese da sessão", tipo: "longo", grupo: "Sessão" },
      { chave: "observacoes_clinicas", rotulo: "Observações clínicas", tipo: "longo", grupo: "Sessão" },
      { chave: "intervencoes", rotulo: "Intervenções realizadas", tipo: "longo", grupo: "Sessão" },
      { chave: "evolucao", rotulo: "Evolução", tipo: "longo", grupo: "Acompanhamento" },
      { chave: "plano", rotulo: "Plano / próximos passos", tipo: "longo", grupo: "Acompanhamento" },
      { chave: "encaminhamentos", rotulo: "Encaminhamentos", tipo: "longo", grupo: "Acompanhamento" },
      RETORNO,
    ],
  },
};

export const PROFISSOES = [
  "Médico(a)", "Psicólogo(a)", "Psicanalista", "Dentista", "Fisioterapeuta",
  "Nutricionista", "Fonoaudiólogo(a)", "Enfermeiro(a)", "Terapeuta ocupacional", "Outro profissional de saúde",
];

export const ESPECIALIDADES_MEDICAS = [
  "Clínica geral", "Oftalmologia", "Cardiologia", "Pediatria", "Ginecologia e obstetrícia", "Dermatologia",
  "Ortopedia", "Psiquiatria", "Neurologia", "Endocrinologia", "Gastroenterologia", "Otorrinolaringologia",
  "Urologia", "Geriatria", "Medicina de família", "Outra",
];

/** Escolhe o modelo padrão a partir do perfil do profissional. */
export function modeloPadrao(profissao?: string | null, especialidade?: string | null): string {
  if (especialidade === "Oftalmologia") return "oftalmologia";
  if (profissao === "Psicólogo(a)" || profissao === "Psicanalista") return "psicologia";
  return "geral";
}

export function camposDoModelo(id: string): Campo[] {
  return [...CAMPOS_PACIENTE, ...(MODELOS[id] ?? MODELOS.geral).campos];
}

export type Ficha = Record<string, string | number | null>;
