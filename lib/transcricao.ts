type Palavra = { text: string; type?: string; speaker_id?: string };

/**
 * Envia o áudio à ElevenLabs e devolve o texto. O áudio não é guardado em lugar nenhum.
 * No modo consulta, separa quem fala (diarização) e devolve o diálogo com "Locutor 1/2".
 */
export async function transcrever(audio: Blob, consulta = false): Promise<string> {
  const form = new FormData();
  form.append("file", audio, "audio.webm");
  form.append("model_id", process.env.ELEVENLABS_STT_MODEL || "scribe_v2");
  form.append("language_code", "por");
  if (consulta) {
    form.append("diarize", "true");
    form.append("num_speakers", "2");
  }

  const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY || "" },
    body: form,
  });
  if (!r.ok) throw new Error(`Falha na transcrição (${r.status}): ${await r.text()}`);
  const data = (await r.json()) as { text?: string; words?: Palavra[] };
  if (!data.text?.trim()) throw new Error("Não foi possível entender o áudio. Grave novamente.");
  if (!consulta || !data.words?.length) return data.text.trim();

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
