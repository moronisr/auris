import Anthropic from "@anthropic-ai/sdk";
import { MODELOS, camposDoModelo, type Ficha } from "./modelos";
import { normalizarCid } from "./cid10";

// O SDK já repete sozinho quando a API está sobrecarregada ou fora do ar.
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 4 });

const BASE = `Sempre responda chamando a ferramenta "registrar_ficha" (nunca em texto livre).
Você é um assistente de registro clínico para profissionais de saúde no Brasil.
Recebe a transcrição do que o profissional ditou e preenche a ficha usando a ferramenta "registrar_ficha".

Regras obrigatórias:
- Preencha SOMENTE o que foi dito. O que não foi dito ou ficou ambíguo = null. Nunca invente.
- Não faça diagnóstico próprio. Em campos de impressão/hipótese, registre apenas o que o PROFISSIONAL disse.
- Use português correto e terminologia técnica da área. Corrija em silêncio ortografia, acentuação e termos médicos que a transcrição escreveu errado (ex.: "cafeleia" = "cefaleia", nome de remédio com letra trocada), sem mudar o sentido do que foi dito.
- Os campos vão para o prontuário assinado. Nunca escreva neles comentários sobre a transcrição, o áudio, a gravação ou a IA (ex.: "na transcrição, o trecho X foi interpretado como Y"), nem notas de que algo "não foi informado" ou "não foi dito": se não foi dito, deixe null.
- CPF: apenas os 11 dígitos, sem pontuação.
- cid10: código(s) CID-10 da impressão/hipótese/avaliação que o PROFISSIONAL disse (ex.: "J45.9"; vários separados por "; "). Se ele ditou o código, use exatamente esse. Se ele disse o diagnóstico sem o código, use o código CID-10 mais específico que corresponda exatamente ao que ele disse. Se não houve impressão/hipótese dita, null. Nunca sugira diagnóstico que o profissional não disse.
- retorno_meses: "retorno em um ano" = 12; "em seis meses" = 6; "em 15 dias" = null e anote nas orientações/plano.`;

function tipoJson(t: string) {
  if (t === "numero") return { type: ["number", "null"] };
  if (t === "inteiro") return { type: ["integer", "null"] };
  return { type: ["string", "null"] };
}

/** Garante que todos os campos existam (null quando não ditados). O CID-10 só fica se existir na tabela oficial. */
function completar(f: Ficha, chaves: string[]): Ficha {
  const out: Ficha = {};
  for (const k of chaves) out[k] = k === "cid10" ? normalizarCid(f?.[k]) : limparNotasInternas(f?.[k] ?? null);
  return out;
}

/** Comentário técnico da IA sobre a transcrição não pode ir para o prontuário: retira essas frases. */
const NOTA_INTERNA = /(transcri[çc][ãa]o|foi interpretad[oa] como|foi transcrit[oa]|interpretei|no [áa]udio|na grava[çc][ãa]o)/i;
function limparNotasInternas<T>(valor: T): T | null {
  if (typeof valor !== "string") return valor;
  const frases = valor.split(/(?<=[.!?])\s+/);
  const limpas = frases.filter((fr) => !NOTA_INTERNA.test(fr));
  if (limpas.length === frases.length) return valor;
  const texto = limpas.join(" ").trim();
  return (texto || null) as T | null;
}

const TELECONSULTA = `TELECONSULTA POR VÍDEO: as falas já vêm identificadas com certeza como "Profissional" e "Paciente" (cada voz foi gravada em um canal próprio).
- Use esses rótulos como verdade; não troque quem falou.
- Não houve exame físico presencial. Registre em exame/achados apenas o que o profissional disser que observou pelo vídeo ou o que o paciente relatar (ex.: medida feita em casa), deixando claro que foi relatado ou observado por vídeo.
- A captação e a extração devem ter a mesma precisão de uma consulta presencial: aproveite todas as informações clínicas e cadastrais ditas, formais ou informais.`;

const CONSULTA = `MODO CONSULTA: a transcrição é uma conversa (possivelmente informal) entre o profissional e o paciente, separada por locutores.
- Identifique pelo contexto quem é o profissional (quem pergunta, examina, orienta) e quem é o paciente (quem responde sobre si).
- Extraia os dados que o PACIENTE informar: nome, idade, data de nascimento, telefone, e-mail, profissão e endereço completo (rua, número, complemento, bairro, cidade, UF, CEP), além de queixas, histórico, hábitos e medicamentos.
- Ignore cumprimentos e conversa social que não tenham relevância clínica ou cadastral.
- Em "observacoes_gerais", registre de forma breve informações relevantes que não couberem em outro campo (ex.: preocupações do paciente, contexto familiar, adesão ao tratamento).
- Datas no formato DD/MM/AAAA. UF com 2 letras. CEP com 8 dígitos.`;

export async function extrairFicha(transcricao: string, modeloId: string, preferencias?: string | null, consulta = false, area?: string | null, teleconsulta = false): Promise<Ficha> {
  const modelo = MODELOS[modeloId] ?? MODELOS.geral;
  const campos = camposDoModelo(modelo.id);
  const properties = Object.fromEntries(
    campos.map((c) => [c.chave, { ...tipoJson(c.tipo), description: c.rotulo }])
  );

  const sistema = [
    BASE,
    `Modelo: ${modelo.nome}. ${modelo.instrucoes}`,
    area ? `Área do atendimento: ${area}. Use a terminologia e o raciocínio de registro próprios dessa área.` : "",
    consulta ? CONSULTA : "MODO DITADO: o profissional ditou o atendimento sozinho, após a consulta.",
    teleconsulta ? TELECONSULTA : "",
    preferencias ? `Preferências deste profissional (siga sempre): ${preferencias}` : "",
  ].filter(Boolean).join("\n\n");

  const resp = await anthropic.messages.create({
    model: process.env.CLAUDE_MODEL || "claude-sonnet-5-5",
    max_tokens: consulta ? 4096 : 2048,
    system: sistema,
    tools: [
      {
        name: "registrar_ficha",
        description: "Registra a ficha do atendimento extraída do ditado.",
        input_schema: { type: "object", properties, required: campos.map((c) => c.chave) },
      },
    ],
    // Alguns modelos não aceitam forçar a ferramenta; usamos "auto" e exigimos o uso nas instruções.
    tool_choice: { type: "auto" },
    messages: [
      {
        role: "user",
        content: `${consulta ? "Transcrição da consulta" : "Transcrição do ditado"}:\n"""${transcricao}"""\n\nResponda SOMENTE chamando a ferramenta registrar_ficha.`,
      },
    ],
  });

  const bloco = resp.content.find((b) => b.type === "tool_use");
  if (bloco && bloco.type === "tool_use") return completar(bloco.input as Ficha, campos.map((c) => c.chave));

  // Plano B: se o modelo respondeu em texto, extrai o JSON da resposta.
  const texto = resp.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const json = texto.match(/\{[\s\S]*\}/);
  if (json) {
    try {
      return completar(JSON.parse(json[0]) as Ficha, campos.map((c) => c.chave));
    } catch {
      /* cai no erro abaixo */
    }
  }
  throw new Error("A IA não conseguiu organizar a ficha. Grave novamente, falando de forma pausada.");
}
