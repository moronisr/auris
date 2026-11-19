import { valorCampo, type Registro } from "@/components/FichaConteudo";
import { MODELOS, camposDoModelo, type Ficha } from "@/lib/modelos";

const TZ = "America/Sao_Paulo";
const hm = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ }) : "");
const dh = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: TZ });

export type Tele = { iniciada_em: string | null; encerrada_em: string | null; consentimento_em: string | null; ia_autorizada?: boolean | null } | null;

export function dadosDaFicha(reg: Registro): Ficha {
  return reg.dados && Object.keys(reg.dados).length ? reg.dados : (reg as unknown as Ficha);
}

/** Linha de modalidade da ficha, com o registro do consentimento e do uso de IA. */
export function modalidadeDaFicha(reg: Registro, tele: Tele): string | undefined {
  const d = dadosDaFicha(reg);
  if (tele) {
    return `Teleconsulta por vídeo${tele.iniciada_em ? `, das ${hm(tele.iniciada_em)}` : ""}${tele.encerrada_em ? ` às ${hm(tele.encerrada_em)}` : ""}. Termo de consentimento aceito pelo paciente${tele.consentimento_em ? ` em ${dh(tele.consentimento_em)}` : ""}${tele.ia_autorizada === false ? "; o paciente optou por não usar o assistente de IA." : ", com autorização para o apoio de IA no registro."}`;
  }
  if (d._ia_paciente_informado_em) return `Atendimento presencial. Paciente informado do uso de apoio de IA no registro em ${dh(String(d._ia_paciente_informado_em))}.`;
  if (d._atendimento === "ditado") return "Atendimento presencial. Registro ditado pelo profissional após o atendimento.";
  return undefined;
}

export function gruposDaFicha(reg: Registro) {
  const dados = dadosDaFicha(reg);
  const modelo = MODELOS[reg.modelo] ?? MODELOS.geral;
  const campos = camposDoModelo(modelo.id).filter((c) => valorCampo(c.chave, dados[c.chave]) !== "");
  const grupos = [...new Set(campos.map((c) => c.grupo))].map((g) => ({
    grupo: g,
    linhas: campos.filter((c) => c.grupo === g).map((c) => ({ rotulo: c.rotulo, valor: valorCampo(c.chave, dados[c.chave]) })),
  }));
  return { modelo, grupos, quando: dh(reg.created_at) };
}
