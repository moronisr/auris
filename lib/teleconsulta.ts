/** Textos e utilidades da teleconsulta, usados pelo profissional e pelo paciente. */

export const TERMO_TELECONSULTA = `Termo de consentimento para teleconsulta

1. A consulta será feita por vídeo, pela internet, conforme a Resolução CFM nº 2.314/2022 e a Lei nº 14.510/2022.
2. A teleconsulta tem limites: não há exame físico presencial. Se o profissional achar necessário, ele pode pedir uma consulta presencial.
3. A chamada de vídeo não é gravada. O áudio da conversa é usado apenas para montar o registro clínico, que o profissional revisa antes de salvar. O áudio é apagado depois da transcrição.
4. O registro do atendimento fica no prontuário eletrônico, com sigilo profissional e proteção de dados conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
5. Você pode desistir da teleconsulta a qualquer momento e pedir atendimento presencial.
6. Para a consulta, use um lugar reservado, com boa conexão, e tenha à mão a lista dos remédios que você usa.`;

export type StatusTele = "agendada" | "confirmada" | "em_andamento" | "encerrada" | "cancelada";
export type PagamentoTele = "pendente" | "informado" | "confirmado" | "isento";

export type Teleconsulta = {
  id: string; created_at: string; paciente_nome: string; paciente_telefone: string | null;
  inicio: string; duracao_min: number; valor: number | null; codigo: string; status: StatusTele;
  confirmada_em: string | null; consentimento_em: string | null; pagamento_status: PagamentoTele;
  pagamento_informado_em: string | null; pagamento_confirmado_em: string | null; pagamento_metodo?: string | null; cartao_link?: string | null; origem?: string; reserva_expira_em?: string | null;
  preconsulta: { motivo?: string; medicamentos?: string; alergias?: string } | null;
  paciente_na_espera_em: string | null; iniciada_em: string | null; encerrada_em: string | null; registro_id: string | null;
};

const TZ = "America/Sao_Paulo";
export const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit", timeZone: TZ });
export const dataCurta = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: TZ });
export const horaDe = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });

/** Código aleatório e impossível de adivinhar para os links do paciente. */
export function novoCodigo(): string {
  const b = new Uint8Array(18);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sha256(texto: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** Link do WhatsApp com a mensagem pronta. O profissional confere e envia do próprio aparelho. */
export function linkWhatsApp(telefone: string | null, mensagem: string): string {
  let d = (telefone ?? "").replace(/\D/g, "");
  if (d && !d.startsWith("55")) d = "55" + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(mensagem)}`;
}

export function mensagemConvite(t: Pick<Teleconsulta, "paciente_nome" | "inicio" | "valor">, profissional: string, link: string): string {
  const nome = t.paciente_nome.split(" ")[0];
  const pagamento = t.valor && t.valor > 0 ? " confirmar a consulta, fazer o pagamento" : " confirmar a consulta";
  return `Olá, ${nome}. Sua teleconsulta com ${profissional} está marcada para ${dataHora(t.inicio)}.\n\nPelo link abaixo você consegue${pagamento} e entrar na sala no horário:\n${link}`;
}

export function mensagemLembrete(t: Pick<Teleconsulta, "paciente_nome" | "inicio">, profissional: string, link: string): string {
  const nome = t.paciente_nome.split(" ")[0];
  return `Olá, ${nome}. Passando para lembrar da sua teleconsulta com ${profissional}, ${dataHora(t.inicio)}.\n\nNo horário, é só abrir este link e entrar na sala de espera:\n${link}`;
}

/** Converte "DD/MM/AAAA" em "AAAA-MM-DD"; devolve null se a data for inválida. */
export function nascimentoIso(br: string): string | null {
  const m = br.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(`${m[3]}-${m[2]}-${m[1]}T12:00:00Z`);
  if (isNaN(d.getTime()) || d.getUTCDate() !== Number(m[1])) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function mascaraData(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join("/");
}
