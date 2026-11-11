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
  evolucao: {
    id: "evolucao",
    nome: "Evolução / retorno (SOAP)",
    descricao: "Consulta de retorno ou acompanhamento, no formato SOAP.",
    instrucoes: "Organize no formato SOAP: Subjetivo (o que o paciente relata), Objetivo (exame e resultados), Avaliação (impressão do profissional) e Plano.",
    campos: [
      { chave: "subjetivo", rotulo: "S — Subjetivo (relato do paciente)", tipo: "longo", grupo: "SOAP" },
      { chave: "objetivo", rotulo: "O — Objetivo (exame, sinais vitais, resultados)", tipo: "longo", grupo: "SOAP" },
      { chave: "avaliacao", rotulo: "A — Avaliação do profissional", tipo: "longo", grupo: "SOAP" },
      { chave: "plano", rotulo: "P — Plano", tipo: "longo", grupo: "SOAP" },
      RETORNO,
    ],
  },
  pediatria: {
    id: "pediatria",
    nome: "Pediatria (puericultura)",
    descricao: "Crescimento, desenvolvimento, vacinas e alimentação.",
    instrucoes: "Registro pediátrico. Peso em kg, altura e perímetro cefálico em cm. Registre o responsável que acompanha a criança quando dito.",
    campos: [
      { chave: "responsavel", rotulo: "Responsável / acompanhante", tipo: "texto", grupo: "Identificação" },
      { chave: "queixa_principal", rotulo: "Queixa / motivo da consulta", tipo: "longo", grupo: "Anamnese" },
      { chave: "historia_atual", rotulo: "História atual", tipo: "longo", grupo: "Anamnese" },
      { chave: "peso_kg", rotulo: "Peso (kg)", tipo: "numero", grupo: "Crescimento" },
      { chave: "altura_cm", rotulo: "Altura / comprimento (cm)", tipo: "numero", grupo: "Crescimento" },
      { chave: "perimetro_cefalico_cm", rotulo: "Perímetro cefálico (cm)", tipo: "numero", grupo: "Crescimento" },
      { chave: "desenvolvimento", rotulo: "Desenvolvimento neuropsicomotor", tipo: "longo", grupo: "Desenvolvimento" },
      { chave: "alimentacao", rotulo: "Alimentação / aleitamento", tipo: "longo", grupo: "Desenvolvimento" },
      { chave: "vacinacao", rotulo: "Situação vacinal", tipo: "longo", grupo: "Desenvolvimento" },
      { chave: "exame_fisico", rotulo: "Exame físico", tipo: "longo", grupo: "Exame" },
      { chave: "impressao_profissional", rotulo: "Impressão do profissional", tipo: "longo", grupo: "Avaliação" },
      { chave: "conduta", rotulo: "Conduta e orientações", tipo: "longo", grupo: "Plano" },
      RETORNO,
    ],
  },
  pre_natal: {
    id: "pre_natal",
    nome: "Pré-natal (obstetrícia)",
    descricao: "Acompanhamento da gestação.",
    instrucoes: "Registro de pré-natal. DUM e DPP em DD/MM/AAAA; idade gestacional em semanas e dias; PA em mmHg; altura uterina em cm; BCF em bpm.",
    campos: [
      { chave: "dum", rotulo: "DUM (data da última menstruação)", tipo: "texto", grupo: "Gestação" },
      { chave: "idade_gestacional", rotulo: "Idade gestacional", tipo: "texto", grupo: "Gestação" },
      { chave: "dpp", rotulo: "DPP (data provável do parto)", tipo: "texto", grupo: "Gestação" },
      { chave: "gestacoes_partos", rotulo: "Gestações / partos / abortos", tipo: "texto", grupo: "Gestação" },
      { chave: "queixas", rotulo: "Queixas", tipo: "longo", grupo: "Consulta" },
      { chave: "pressao_arterial", rotulo: "Pressão arterial", tipo: "texto", grupo: "Exame" },
      { chave: "peso_kg", rotulo: "Peso (kg)", tipo: "numero", grupo: "Exame" },
      { chave: "altura_uterina_cm", rotulo: "Altura uterina (cm)", tipo: "numero", grupo: "Exame" },
      { chave: "bcf", rotulo: "BCF (batimentos cardíacos fetais)", tipo: "texto", grupo: "Exame" },
      { chave: "movimentos_fetais", rotulo: "Movimentos fetais", tipo: "texto", grupo: "Exame" },
      { chave: "exames", rotulo: "Exames solicitados / resultados", tipo: "longo", grupo: "Plano" },
      { chave: "conduta", rotulo: "Conduta e orientações", tipo: "longo", grupo: "Plano" },
      RETORNO,
    ],
  },
  psiquiatria: {
    id: "psiquiatria",
    nome: "Psiquiatria (exame do estado mental)",
    descricao: "Consulta psiquiátrica com exame do estado mental.",
    instrucoes: "Registro psiquiátrico. Use linguagem técnica e respeitosa; resuma falas sensíveis, não transcreva na íntegra.",
    campos: [
      { chave: "queixa_principal", rotulo: "Queixa principal", tipo: "longo", grupo: "Anamnese" },
      { chave: "historia_atual", rotulo: "História da doença atual", tipo: "longo", grupo: "Anamnese" },
      { chave: "antecedentes_psiquiatricos", rotulo: "Antecedentes psiquiátricos e familiares", tipo: "longo", grupo: "Anamnese" },
      { chave: "medicamentos_em_uso", rotulo: "Medicamentos em uso", tipo: "longo", grupo: "Anamnese" },
      { chave: "exame_estado_mental", rotulo: "Exame do estado mental (aparência, humor, afeto, pensamento, sensopercepção, juízo, crítica)", tipo: "longo", grupo: "Exame" },
      { chave: "risco", rotulo: "Avaliação de risco (conforme o profissional)", tipo: "longo", grupo: "Exame" },
      { chave: "impressao_profissional", rotulo: "Impressão / hipótese do profissional", tipo: "longo", grupo: "Avaliação" },
      { chave: "conduta", rotulo: "Conduta e prescrições", tipo: "longo", grupo: "Plano" },
      RETORNO,
    ],
  },
  odontologia: {
    id: "odontologia",
    nome: "Odontologia",
    descricao: "Atendimento odontológico com dentes e procedimentos.",
    instrucoes: "Registro odontológico. Dentes na numeração FDI (ex.: 16, 36). Liste procedimentos realizados e planejados com o dente correspondente.",
    campos: [
      { chave: "queixa_principal", rotulo: "Queixa principal", tipo: "longo", grupo: "Anamnese" },
      { chave: "historico_medico", rotulo: "Histórico médico relevante (doenças, alergias, medicamentos)", tipo: "longo", grupo: "Anamnese" },
      { chave: "exame_clinico", rotulo: "Exame clínico intra e extraoral", tipo: "longo", grupo: "Exame" },
      { chave: "dentes_afetados", rotulo: "Dentes / regiões envolvidas", tipo: "texto", grupo: "Exame" },
      { chave: "procedimentos_realizados", rotulo: "Procedimentos realizados", tipo: "longo", grupo: "Tratamento" },
      { chave: "plano_tratamento", rotulo: "Plano de tratamento", tipo: "longo", grupo: "Tratamento" },
      { chave: "prescricoes", rotulo: "Prescrições", tipo: "longo", grupo: "Tratamento" },
      { chave: "orientacoes", rotulo: "Orientações ao paciente", tipo: "longo", grupo: "Tratamento" },
      RETORNO,
    ],
  },
  fisioterapia: {
    id: "fisioterapia",
    nome: "Fisioterapia",
    descricao: "Avaliação funcional e plano terapêutico.",
    instrucoes: "Registro fisioterapêutico. Dor na escala de 0 a 10 quando dita. Registre testes, amplitude de movimento e força quando citados.",
    campos: [
      { chave: "queixa_principal", rotulo: "Queixa principal", tipo: "longo", grupo: "Avaliação" },
      { chave: "diagnostico_clinico", rotulo: "Diagnóstico clínico / encaminhamento", tipo: "texto", grupo: "Avaliação" },
      { chave: "escala_dor", rotulo: "Dor (0 a 10)", tipo: "inteiro", grupo: "Avaliação" },
      { chave: "avaliacao_funcional", rotulo: "Avaliação funcional (ADM, força, testes)", tipo: "longo", grupo: "Avaliação" },
      { chave: "diagnostico_fisioterapeutico", rotulo: "Diagnóstico fisioterapêutico", tipo: "longo", grupo: "Avaliação" },
      { chave: "objetivos", rotulo: "Objetivos do tratamento", tipo: "longo", grupo: "Plano" },
      { chave: "condutas_sessao", rotulo: "Condutas realizadas na sessão", tipo: "longo", grupo: "Plano" },
      { chave: "plano_terapeutico", rotulo: "Plano terapêutico (frequência, nº de sessões)", tipo: "longo", grupo: "Plano" },
      { chave: "orientacoes", rotulo: "Orientações domiciliares", tipo: "longo", grupo: "Plano" },
      RETORNO,
    ],
  },
  nutricao: {
    id: "nutricao",
    nome: "Nutrição",
    descricao: "Avaliação nutricional e plano alimentar.",
    instrucoes: "Registro nutricional. Peso em kg, altura em m ou cm, circunferências em cm. Calcule o IMC somente se peso e altura forem ditos.",
    campos: [
      { chave: "objetivo_paciente", rotulo: "Objetivo do paciente", tipo: "longo", grupo: "Anamnese" },
      { chave: "historico_saude", rotulo: "Histórico de saúde e exames", tipo: "longo", grupo: "Anamnese" },
      { chave: "habitos_alimentares", rotulo: "Hábitos alimentares / recordatório", tipo: "longo", grupo: "Anamnese" },
      { chave: "atividade_fisica", rotulo: "Atividade física", tipo: "texto", grupo: "Anamnese" },
      { chave: "peso_kg", rotulo: "Peso (kg)", tipo: "numero", grupo: "Antropometria" },
      { chave: "altura_cm", rotulo: "Altura (cm)", tipo: "numero", grupo: "Antropometria" },
      { chave: "imc", rotulo: "IMC", tipo: "numero", grupo: "Antropometria" },
      { chave: "circunferencias", rotulo: "Circunferências (cintura, quadril…)", tipo: "texto", grupo: "Antropometria" },
      { chave: "diagnostico_nutricional", rotulo: "Diagnóstico nutricional", tipo: "longo", grupo: "Plano" },
      { chave: "plano_alimentar", rotulo: "Plano alimentar / condutas", tipo: "longo", grupo: "Plano" },
      { chave: "suplementacao", rotulo: "Suplementação", tipo: "texto", grupo: "Plano" },
      RETORNO,
    ],
  },
  enfermagem: {
    id: "enfermagem",
    nome: "Enfermagem (SAE)",
    descricao: "Sistematização da assistência de enfermagem.",
    instrucoes: "Registro de enfermagem no formato SAE: histórico, sinais vitais, diagnósticos de enfermagem, intervenções e avaliação.",
    campos: [
      { chave: "historico_enfermagem", rotulo: "Histórico de enfermagem", tipo: "longo", grupo: "Coleta" },
      { chave: "sinais_vitais", rotulo: "Sinais vitais (PA, FC, FR, T, SatO2, dor)", tipo: "texto", grupo: "Coleta" },
      { chave: "exame_fisico", rotulo: "Exame físico", tipo: "longo", grupo: "Coleta" },
      { chave: "diagnosticos_enfermagem", rotulo: "Diagnósticos de enfermagem", tipo: "longo", grupo: "Planejamento" },
      { chave: "intervencoes", rotulo: "Intervenções / procedimentos", tipo: "longo", grupo: "Implementação" },
      { chave: "avaliacao", rotulo: "Avaliação / resultados", tipo: "longo", grupo: "Avaliação" },
      { chave: "orientacoes", rotulo: "Orientações", tipo: "longo", grupo: "Avaliação" },
      RETORNO,
    ],
  },
  fonoaudiologia: {
    id: "fonoaudiologia",
    nome: "Fonoaudiologia",
    descricao: "Avaliação e terapia fonoaudiológica.",
    instrucoes: "Registro fonoaudiológico: linguagem, fala, voz, audição, motricidade orofacial e deglutição, conforme o que for dito.",
    campos: [
      { chave: "queixa_principal", rotulo: "Queixa principal", tipo: "longo", grupo: "Anamnese" },
      { chave: "historico", rotulo: "Histórico relevante", tipo: "longo", grupo: "Anamnese" },
      { chave: "avaliacao", rotulo: "Avaliação (linguagem, fala, voz, audição, deglutição)", tipo: "longo", grupo: "Avaliação" },
      { chave: "hipotese_fonoaudiologica", rotulo: "Hipótese fonoaudiológica", tipo: "longo", grupo: "Avaliação" },
      { chave: "condutas_sessao", rotulo: "Condutas da sessão", tipo: "longo", grupo: "Terapia" },
      { chave: "plano_terapeutico", rotulo: "Plano terapêutico", tipo: "longo", grupo: "Terapia" },
      { chave: "orientacoes", rotulo: "Orientações à família / paciente", tipo: "longo", grupo: "Terapia" },
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
  const mapa: Record<string, string> = {
    "Oftalmologia": "oftalmologia", "Optometrista": "oftalmologia",
    "Psicólogo(a)": "psicologia", "Psicanalista": "psicologia", "Psicopedagogo(a)": "psicologia",
    "Psiquiatria": "psiquiatria",
    "Pediatria": "pediatria",
    "Ginecologia e obstetrícia": "pre_natal",
    "Dentista": "odontologia",
    "Fisioterapeuta": "fisioterapia", "Medicina física e reabilitação": "fisioterapia",
    "Nutricionista": "nutricao", "Nutrologia": "nutricao",
    "Enfermeiro(a)": "enfermagem", "Técnico(a) de enfermagem": "enfermagem",
    "Fonoaudiólogo(a)": "fonoaudiologia",
  };
  return mapa[area] ?? "geral";
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
