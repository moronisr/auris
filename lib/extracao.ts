import Anthropic from "@anthropic-ai/sdk";
import type { Ficha } from "./validacao";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const num = { type: ["number", "null"] } as const;
const txt = { type: ["string", "null"] } as const;

const SISTEMA = `Você é um assistente de registro clínico para oftalmologia no Brasil.
Recebe a transcrição de um ditado do médico e preenche a ficha usando a ferramenta "registrar_ficha".

Regras:
- Preencha SOMENTE o que foi dito. Se algo não foi dito ou ficou ambíguo, use null. Nunca invente.
- Graus em dioptrias, com sinal: "menos dois" = -2.00; "mais um e meio" = 1.50; "plano" = 0.
- OD = olho direito, OE = olho esquerdo. "Ambos os olhos" vale para os dois.
- Eixo em graus inteiros (0 a 180).
- CPF: apenas os 11 dígitos, sem pontuação.
- retorno_meses: converta "retorno em um ano" = 12; "em seis meses" = 6.
- observacoes: outras informações clínicas relevantes ditas pelo médico, em texto curto.`;

export async function extrairFicha(transcricao: string): Promise<Ficha> {
  const resp = await anthropic.messages.create({
    model: process.env.CLAUDE_MODEL || "claude-sonnet-5-5",
    max_tokens: 1024,
    system: SISTEMA,
    tools: [
      {
        name: "registrar_ficha",
        description: "Registra a ficha do paciente extraída do ditado.",
        input_schema: {
          type: "object",
          properties: {
            paciente_nome: txt,
            paciente_idade: { type: ["integer", "null"] },
            paciente_cpf: txt,
            paciente_telefone: txt,
            od_esferico: num,
            od_cilindrico: num,
            od_eixo: { type: ["integer", "null"] },
            oe_esferico: num,
            oe_cilindrico: num,
            oe_eixo: { type: ["integer", "null"] },
            adicao: num,
            dnp: txt,
            observacoes: txt,
            retorno_meses: { type: ["integer", "null"] },
          },
          required: [
            "paciente_nome", "paciente_idade", "paciente_cpf", "paciente_telefone",
            "od_esferico", "od_cilindrico", "od_eixo", "oe_esferico", "oe_cilindrico", "oe_eixo",
            "adicao", "dnp", "observacoes", "retorno_meses",
          ],
        },
      },
    ],
    tool_choice: { type: "tool", name: "registrar_ficha" },
    messages: [{ role: "user", content: `Transcrição do ditado:\n"""${transcricao}"""` }],
  });

  const bloco = resp.content.find((b) => b.type === "tool_use");
  if (!bloco || bloco.type !== "tool_use") throw new Error("A IA não retornou a ficha.");
  return bloco.input as Ficha;
}
