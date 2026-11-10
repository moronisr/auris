/** Envia o áudio à ElevenLabs e devolve o texto. O áudio não é guardado em lugar nenhum. */
export async function transcrever(audio: Blob): Promise<string> {
  const form = new FormData();
  form.append("file", audio, "ditado.webm");
  form.append("model_id", process.env.ELEVENLABS_STT_MODEL || "scribe_v2");
  form.append("language_code", "por");

  const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY || "" },
    body: form,
  });
  if (!r.ok) throw new Error(`Falha na transcrição (${r.status}): ${await r.text()}`);
  const data = (await r.json()) as { text?: string };
  if (!data.text?.trim()) throw new Error("Não foi possível entender o áudio. Grave novamente.");
  return data.text.trim();
}
