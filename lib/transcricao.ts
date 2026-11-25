import { comTentativas, ErroHttp } from "@/lib/tentativas";

const MODELO_CLINICO = "scribe_v2_medical";

type Palavra = { text: string; type?: string; speaker_id?: string; channel_index?: number };

/**
 * Envia o áudio à ElevenLabs e devolve o texto. O áudio não é guardado em lugar nenhum.
 * No modo consulta, separa quem fala (diarização) e devolve o diálogo com "Locutor 1/2".
 */
export async function transcrever(audio: Blob, consulta = false, doisCanais = false): Promise<string> {
  const tipo = audio.type || "audio/webm";
  const ext = tipo.includes("mp4") || tipo.includes("m4a") || tipo.includes("aac") ? "m4a" : tipo.includes("ogg") ? "ogg" : tipo.includes("wav") ? "wav" : "webm";
  const montar = (modelo: string) => {
    const form = new FormData();
    form.append("file", audio, `audio.${ext}`);
    form.append("model_id", modelo);
    form.append("language_code", "por");
    if (consulta && doisCanais) {
      // Teleconsulta: cada voz chega em um canal próprio, então não é preciso adivinhar quem falou.
      form.append("use_multi_channel", "true");
      form.append("multichannel_output_style", "combined");
      form.append("diarize", "false");
    } else if (consulta) {
      form.append("diarize", "true");
      form.append("num_speakers", "2");
    }
    return form;
  };

  // Modelo treinado para áudio clínico (nomes de remédios, doenças, exames), mesmo preço do Scribe v2.
  // Se ele recusar o pedido, usa o modelo geral, para o médico nunca ficar sem transcrição.
  const modelos = [...new Set([MODELO_CLINICO, process.env.ELEVENLABS_STT_MODEL || "scribe_v2"])];
  let data: { text?: string; words?: Palavra[] } | null = null;
  for (const [i, modelo] of modelos.entries()) {
    try {
      // Se a ElevenLabs falhar por instabilidade, tenta de novo sozinho (até 3 vezes) sem perder o áudio.
      data = await comTentativas(async () => {
        const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
          method: "POST",
          headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY || "" },
          body: montar(modelo),
          signal: AbortSignal.timeout(180_000),
        });
        if (!r.ok) throw new ErroHttp(`Falha na transcrição (${r.status}): ${await r.text()}`, r.status);
        return (await r.json()) as { text?: string; words?: Palavra[] };
      }, { nome: `transcrição (${modelo})` });
      break;
    } catch (e) {
      const recusado = e instanceof ErroHttp && e.status >= 400 && e.status < 500 && e.status !== 401 && e.status !== 429;
      if (i < modelos.length - 1 && recusado) { console.warn(`transcrição: ${modelo} recusou o pedido, usando o modelo geral.`); continue; }
      throw e;
    }
  }
  if (!data) throw new Error("Não foi possível entender o áudio. Grave novamente.");
  if (!data.text?.trim()) throw new Error("Não foi possível entender o áudio. Grave novamente.");
  if (!consulta || !data.words?.length) return data.text.trim();

  if (doisCanais && data.words.some((w) => typeof w.channel_index === "number")) {
    const rotulo = (c?: number) => (c === 1 ? "Paciente" : "Profissional");
    const linhas: string[] = [];
    let atual: number | undefined;
    let buffer = "";
    for (const w of data.words) {
      if (w.type === "audio_event") continue;
      const c = w.channel_index ?? 0;
      if (c !== atual && buffer.trim()) { linhas.push(`${rotulo(atual)}: ${buffer.trim()}`); buffer = ""; }
      atual = c;
      buffer += w.text;
    }
    if (buffer.trim()) linhas.push(`${rotulo(atual)}: ${buffer.trim()}`);
    return linhas.join("\n");
  }

  // Monta o diálogo por locutor.
  const nomes = new Map<string, string>();
  const linhas: string[] = [];
  let atual = "";
  let buffer = "";
  for (const w of data.words) {
    if (w.type === "audio_event") continue;
    const id = w.speaker_id ?? "speaker_0";
    if (!nomes.has(id)) nomes.set(id, `Locutor ${nomes.size + 1}`);
    if (id !== atual && buffer.trim()) {
      linhas.push(`${nomes.get(atual)}: ${buffer.trim()}`);
      buffer = "";
    }
    atual = id;
    buffer += w.text;
  }
  if (buffer.trim()) linhas.push(`${nomes.get(atual)}: ${buffer.trim()}`);
  return linhas.join("\n");
}
