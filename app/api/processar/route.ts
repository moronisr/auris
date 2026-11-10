import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { transcrever } from "@/lib/transcricao";
import { extrairFicha } from "@/lib/extracao";
import { validarFicha } from "@/lib/validacao";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Faça login novamente." }, { status: 401 });

  const inicio = Date.now();
  try {
    const form = await req.formData();
    const audio = form.get("audio");
    if (!(audio instanceof Blob) || audio.size === 0)
      return NextResponse.json({ erro: "Nenhum áudio recebido." }, { status: 400 });
    if (audio.size > 20 * 1024 * 1024)
      return NextResponse.json({ erro: "Áudio muito longo (máx. 20 MB)." }, { status: 413 });

    const transcricao = await transcrever(audio);
    const ficha = await extrairFicha(transcricao);
    const avisos = validarFicha(ficha);

    return NextResponse.json({
      transcricao,
      ficha,
      avisos,
      tempo_processamento_ms: Date.now() - inicio,
    });
  } catch (e) {
    console.error("processar:", e);
    const msg = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
