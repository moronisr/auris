import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { transcrever } from "@/lib/transcricao";
import { extrairFicha } from "@/lib/extracao";
import { validarFicha } from "@/lib/validacao";
import { MODELOS } from "@/lib/modelos";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Faça login novamente." }, { status: 401 });

  const inicio = Date.now();
  try {
    const form = await req.formData();
    const audio = form.get("audio");
    const modeloPedido = String(form.get("modelo") || "geral");
    const modelo = MODELOS[modeloPedido] ? modeloPedido : "geral";
    const consulta = form.get("modo") === "consulta";
    if (consulta && form.get("consentimento") !== "sim")
      return NextResponse.json({ erro: "Confirme que o paciente autorizou a gravação da consulta." }, { status: 400 });
    if (!(audio instanceof Blob) || audio.size === 0)
      return NextResponse.json({ erro: "Nenhum áudio recebido." }, { status: 400 });
    if (audio.size > 25 * 1024 * 1024)
      return NextResponse.json({ erro: "Áudio muito longo (máx. 25 MB)." }, { status: 413 });

    const { data: perfil } = await supabase
      .from("profissionais").select("preferencias").eq("id", user.id).maybeSingle();

    const transcricao = await transcrever(audio, consulta);
    const ficha = await extrairFicha(transcricao, modelo, perfil?.preferencias, consulta);
    const avisos = validarFicha(ficha, modelo);

    return NextResponse.json({ transcricao, ficha, avisos, modelo, modo: consulta ? "consulta" : "ditado", tempo_processamento_ms: Date.now() - inicio });
  } catch (e) {
    console.error("processar:", e);
    const msg = e instanceof Error ? e.message : "";
    // Mensagem amigável para o profissional; o detalhe técnico fica nos logs da Vercel.
    const amigavel = msg.startsWith("A IA") || msg.startsWith("Não foi possível entender")
      ? msg
      : msg.includes("transcrição")
        ? "Não consegui transcrever o áudio. Verifique o microfone e grave novamente."
        : "Ocorreu uma falha ao organizar a ficha. Tente gravar novamente em alguns segundos.";
    return NextResponse.json({ erro: amigavel }, { status: 500 });
  }
}
