import Anthropic from "@anthropic-ai/sdk";
import { MODELOS, camposDoModelo, type Ficha } from "./modelos";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BASE = `Você é um assistente de registro clínico para profissionais de saúde no Brasil.
Recebe a transcrição do que o profissional ditou e preenche a ficha usando a ferramenta "registrar_ficha".

Regras obrigatórias:
- Preencha SOMENTE o que foi dito. O que não foi dito ou ficou ambíguo = null. Nunca invente.
- Não faça diagnóstico próprio. Em campos de impressão/hipótese, registre apenas o que o PROFISSIONAL disse.
- Use português correto e terminologia técnica da área.
- CPF: apenas os 11 dígitos, sem pontuação.
- retorno_meses: "retorno em um ano" = 12; "em seis meses" = 6; "em 15 dias" = null e anote nas orientações/plano.`;

function tipoJson(t: string) {
  if (t === "numero") return { type: ["number", "null"] };
  if (t === "inteiro") return { type: ["integer", "null"] };
  return { type: ["string", "null"] };
}

export async function extrairFicha(transcricao: string, modeloId: string, preferencias?: string | null): Promise<Ficha> {
  const modelo = MODELOS[modeloId] ?? MODELOS.geral;
  const campos = camposDoModelo(modelo.id);
  const properties = Object.fromEntries(
    campos.map((c) => [c.chave, { ...tipoJson(c.tipo), description: c.rotulo }])
  );

  const sistema = [
    BASE,
    `Modelo: ${modelo.nome}. ${modelo.instrucoes}`,
    preferencias ? `Preferências deste profissional (siga sempre): ${preferencias}` : "",
  ].filter(Boolean).join("\n\n");

  const resp = await anthropic.messages.create({
    model: process.env.CLAUDE_MODEL || "claude-sonnet-5-5",
    max_tokens: 2048,
    system: sistema,
    tools: [
      {
        name: "registrar_ficha",
        description: "Registra a ficha do atendimento extraída do ditado.",
        input_schema: { type: "object", properties, required: campos.map((c) => c.chave) },
      },
    ],
    tool_choice: { type: "tool", name: "registrar_ficha" },
    messages: [{ role: "user", content: `Transcrição do ditado:\n"""${transcricao}"""` }],
  });

  const bloco = resp.content.find((b) => b.type === "tool_use");
  if (!bloco || bloco.type !== "tool_use") throw new Error("A IA não retornou a ficha.");
  return bloco.input as Ficha;
}
