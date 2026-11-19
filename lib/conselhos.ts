/**
 * Regras por profissão: cada conselho tem normas próprias para atendimento online.
 * Medicina: Res. CFM 2.314/2022 (telemedicina) e 2.454/2026 (IA). Odontologia: Res. CFO-278/2025.
 * Psicologia: Res. CFP 09/2024 (o cadastro e-Psi deixou de existir; basta a inscrição ativa no CRP).
 */
export type Grupo = "medicina" | "odontologia" | "psicologia" | "saude";

export function grupoProfissao(profissao?: string | null): Grupo {
  if (profissao === "Médico(a)") return "medicina";
  if (profissao === "Dentista") return "odontologia";
  if (["Psicólogo(a)", "Psicanalista", "Psicopedagogo(a)"].includes(profissao ?? "")) return "psicologia";
  return "saude";
}

export const SIGLA_CONSELHO: Record<Grupo, string> = { medicina: "CRM", odontologia: "CRO", psicologia: "CRP", saude: "conselho profissional" };

const BASE: Record<Grupo, string> = {
  medicina: "1. A consulta será feita por vídeo, pela internet, conforme a Resolução CFM nº 2.314/2022 e a Lei nº 14.510/2022.\n2. A teleconsulta tem limites: não há exame físico presencial. Se o profissional achar necessário, ele pode pedir uma consulta presencial.",
  odontologia: "1. O atendimento será feito por vídeo, pela internet, conforme a Resolução CFO nº 278/2025 (teleodontologia) e a Lei nº 14.510/2022.\n2. Limitações da teleodontologia: não há exame clínico da boca e da face, nem exames de imagem feitos na hora, e nenhum procedimento é realizado a distância. Avaliações e procedimentos estéticos, como a harmonização orofacial, exigem consulta presencial. O que for orientado por vídeo pode mudar depois do exame presencial.",
  psicologia: "1. O atendimento será feito por vídeo, pela internet, conforme a Resolução CFP nº 09/2024 e o Código de Ética Profissional do Psicólogo.\n2. O atendimento online não é indicado para situações de urgência e emergência, nem para pessoas em situação de violência ou violação de direitos. Nesses casos, procure atendimento presencial ou ligue 188 (CVV), 192 (SAMU) ou 190.",
  saude: "1. O atendimento será feito por vídeo, pela internet, conforme a Lei nº 14.510/2022 e as normas do conselho do profissional.\n2. O atendimento a distância tem limites: não há exame físico presencial. Se o profissional achar necessário, ele pode pedir um atendimento presencial.",
};

/** Termo de consentimento da teleconsulta, com o texto certo para o conselho do profissional. */
export function termoTeleconsulta(grupo: Grupo): string {
  const ia = grupo === "medicina"
    ? "3. Uso de inteligência artificial (Resolução CFM nº 2.454/2026): se você autorizar, o áudio da conversa é transcrito por IA apenas para montar o registro clínico, que o médico revisa antes de salvar. A IA não faz diagnóstico nem decide o tratamento. A chamada de vídeo não é gravada, e o áudio é apagado depois da transcrição. Você pode recusar o uso de IA sem nenhum prejuízo ao atendimento."
    : `3. Uso de inteligência artificial: se você autorizar, o áudio da conversa é transcrito por IA apenas para montar o registro do atendimento, que o profissional revisa antes de salvar. A IA não avalia nem decide nada sobre o seu ${grupo === "psicologia" ? "acompanhamento" : "tratamento"}. A chamada de vídeo não é gravada, e o áudio é apagado depois da transcrição. Você pode recusar o uso de IA sem nenhum prejuízo ao atendimento.`;
  const sigilo = grupo === "psicologia"
    ? "4. Tudo o que for dito é protegido pelo sigilo profissional. O registro fica no prontuário psicológico, com proteção de dados conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), e você tem direito de acesso a ele."
    : "4. O registro do atendimento fica no prontuário eletrônico, com sigilo profissional e proteção de dados conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).";
  const lugar = grupo === "psicologia"
    ? "6. Para o atendimento, use um lugar reservado, onde ninguém possa ouvir a conversa, com boa conexão."
    : grupo === "odontologia"
      ? "6. Para o atendimento, use um lugar reservado e bem iluminado, com boa conexão. Se possível, tenha à mão fotos ou exames recentes."
      : "6. Para a consulta, use um lugar reservado, com boa conexão, e tenha à mão a lista dos remédios que você usa.";
  return [
    `Termo de consentimento para ${grupo === "medicina" ? "teleconsulta" : "atendimento online"}`,
    "",
    BASE[grupo],
    ia,
    sigilo,
    "5. Você pode desistir do atendimento online a qualquer momento e pedir atendimento presencial.",
    lugar,
  ].join("\n");
}

/** Linha que vai em toda ficha: o uso de IA fica registrado no prontuário. */
export function linhaIA(grupo: Grupo): string {
  return grupo === "medicina"
    ? "Registro elaborado com apoio de inteligência artificial (Auris) e revisado e aprovado pelo médico responsável, conforme a Resolução CFM nº 2.454/2026."
    : "Registro elaborado com apoio de inteligência artificial (Auris) e revisado e aprovado pelo profissional responsável.";
}
