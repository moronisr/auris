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
  { chave: "paciente_data_nascimento", rotulo: "Data de nascimento", tipo: "texto", grupo: "Paciente" },
  { chave: "paciente_sexo", rotulo: "Sexo", tipo: "texto", grupo: "Paciente" },
  { chave: "paciente_cpf", rotulo: "CPF", tipo: "texto", grupo: "Paciente" },
  { chave: "paciente_telefone", rotulo: "Telefone", tipo: "texto", grupo: "Paciente" },
  { chave: "paciente_email", rotulo: "E-mail", tipo: "texto", grupo: "Paciente" },
  { chave: "paciente_profissao", rotulo: "Profissão do paciente", tipo: "texto", grupo: "Paciente" },
  { chave: "endereco_rua", rotulo: "Rua / logradouro", tipo: "texto", grupo: "Endereço" },
  { chave: "endereco_numero", rotulo: "Número", tipo: "texto", grupo: "Endereço" },
  { chave: "endereco_complemento", rotulo: "Complemento", tipo: "texto", grupo: "Endereço" },
  { chave: "endereco_bairro", rotulo: "Bairro", tipo: "texto", grupo: "Endereço" },
  { chave: "endereco_cidade", rotulo: "Cidade", tipo: "texto", grupo: "Endereço" },
  { chave: "endereco_uf", rotulo: "UF", tipo: "texto", grupo: "Endereço" },
  { chave: "endereco_cep", rotulo: "CEP", tipo: "texto", grupo: "Endereço" },
];

/** Observações gerais: presentes em todos os modelos, ao final da ficha. */
export const CAMPOS_FINAIS: Campo[] = [
  { chave: "observacoes_gerais", rotulo: "Observações gerais do atendimento", tipo: "longo", grupo: "Observações" },
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
  "Médico(a)", "Psicólogo(a)", "Psicanalista", "Psicopedagogo(a)", "Dentista", "Fisioterapeuta",
  "Nutricionista", "Fonoaudiólogo(a)", "Enfermeiro(a)", "Técnico(a) de enfermagem", "Terapeuta ocupacional",
  "Farmacêutico(a)", "Biomédico(a)", "Profissional de educação física", "Optometrista", "Podólogo(a)",
  "Quiropraxista", "Acupunturista", "Terapeuta holístico(a)", "Assistente social", "Outro profissional de saúde",
];

/** As 55 especialidades médicas reconhecidas pelo Conselho Federal de Medicina (CFM). */
export const ESPECIALIDADES_MEDICAS = [
  "Clínica médica",
  "Acupuntura", "Alergia e imunologia", "Anestesiologia", "Angiologia", "Cardiologia",
  "Cirurgia cardiovascular", "Cirurgia da mão", "Cirurgia de cabeça e pescoço", "Cirurgia do aparelho digestivo",
  "Cirurgia geral", "Cirurgia oncológica", "Cirurgia pediátrica", "Cirurgia plástica", "Cirurgia torácica",
  "Cirurgia vascular", "Coloproctologia", "Dermatologia", "Endocrinologia e metabologia", "Endoscopia",
  "Gastroenterologia", "Genética médica", "Geriatria", "Ginecologia e obstetrícia", "Hematologia e hemoterapia",
  "Homeopatia", "Infectologia", "Mastologia", "Medicina de emergência", "Medicina de família e comunidade",
  "Medicina do trabalho", "Medicina de tráfego", "Medicina esportiva", "Medicina física e reabilitação",
  "Medicina intensiva", "Medicina legal e perícia médica", "Medicina nuclear", "Medicina preventiva e social",
  "Nefrologia", "Neurocirurgia", "Neurologia", "Nutrologia", "Oftalmologia", "Oncologia clínica",
  "Ortopedia e traumatologia", "Otorrinolaringologia", "Patologia", "Patologia clínica / medicina laboratorial",
  "Pediatria", "Pneumologia", "Psiquiatria", "Radiologia e diagnóstico por imagem", "Radioterapia",
  "Reumatologia", "Urologia",
  "Sem especialidade (médico generalista)", "Outra",
];

/** Lista única para o seletor do registro: especialidades médicas + demais profissões de saúde. */
export const AREAS_ATENDIMENTO: { grupo: string; itens: string[] }[] = [
  { grupo: "Medicina — especialidades (CFM)", itens: ESPECIALIDADES_MEDICAS.filter((e) => e !== "Outra") },
  { grupo: "Outras profissões de saúde", itens: PROFISSOES.filter((p) => p !== "Médico(a)") },
];

/** Modelo de campos para uma área de atendimento escolhida no registro. */
export function modeloDaArea(area: string): string {
  if (area === "Oftalmologia" || area === "Optometrista") return "oftalmologia";
  if (["Psicólogo(a)", "Psicanalista", "Psicopedagogo(a)"].includes(area)) return "psicologia";
  return "geral";
}

/** Escolhe o modelo padrão a partir do perfil do profissional. */
export function modeloPadrao(profissao?: string | null, especialidade?: string | null): string {
  if (especialidade === "Oftalmologia") return "oftalmologia";
  if (["Psicólogo(a)", "Psicanalista", "Psicopedagogo(a)"].includes(profissao ?? "")) return "psicologia";
  return "geral";
}

export function camposDoModelo(id: string): Campo[] {
  return [...CAMPOS_PACIENTE, ...(MODELOS[id] ?? MODELOS.geral).campos, ...CAMPOS_FINAIS];
}

export type Ficha = Record<string, string | number | null>;
