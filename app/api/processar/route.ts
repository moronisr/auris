import { NextResponse } from "next/server";
import { acessoDe } from "@/lib/assinatura";
import { supabaseServer } from "@/lib/supabase/server";
import { transcrever } from "@/lib/transcricao";
import { extrairFicha } from "@/lib/extracao";
import { validarFicha } from "@/lib/validacao";
import { MODELOS } from "@/lib/modelos";
import { comTentativas } from "@/lib/tentativas";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Faça login novamente." }, { status: 401 });
  if ((await acessoDe(user.id)) === "bloqueado") return NextResponse.json({ erro: "Sua assinatura do Auris está inativa. Você pode consultar e exportar suas fichas; para registrar novas, ative um plano em Perfil, Plano e pagamento." }, { status: 402 });

  const inicio = Date.now();
  try {
    const form = await req.formData();
    let audio: FormDataEntryValue | Blob | null = form.get("audio");
    // Teleconsulta: o áudio chega pelo armazenamento privado (sem limite de 20 minutos) e é apagado após a transcrição.
    const caminho = String(form.get("audio_caminho") || "");
    const teleconsulta = form.get("teleconsulta") === "sim";
    const doisCanais = form.get("canais") === "2";
    if (caminho) {
      if (!caminho.startsWith(`${user.id}/`)) return NextResponse.json({ erro: "Áudio não pertence a esta conta." }, { status: 403 });
      const { data: arquivo, error } = await supabase.storage.from("audios").download(caminho);
      if (error || !arquivo) return NextResponse.json({ erro: "Não encontrei o áudio enviado. Tente de novo." }, { status: 400 });
      audio = arquivo;
    }
    const modeloPedido = String(form.get("modelo") || "geral");
    const modelo = MODELOS[modeloPedido] ? modeloPedido : "geral";
    const consulta = form.get("modo") === "consulta";
    const area = String(form.get("area") || "") || null;
    if (consulta && form.get("consentimento") !== "sim")
      return NextResponse.json({ erro: "Confirme que o paciente foi informado do registro do atendimento." }, { status: 400 });
    if (!(audio instanceof Blob) || audio.size === 0)
      return NextResponse.json({ erro: "Nenhum áudio recebido." }, { status: 400 });
    if (audio.size > (caminho ? 100 : 25) * 1024 * 1024)
      return NextResponse.json({ erro: "Áudio muito longo." }, { status: 413 });

    const { data: perfil } = await supabase
      .from("profissionais").select("preferencias").eq("id", user.id).maybeSingle();

    let transcricao: string;
    try {
      transcricao = await transcrever(audio, consulta, doisCanais);
    } finally {
      if (caminho) await supabase.storage.from("audios").remove([caminho]).catch(() => {});
    }
    // Se a IA não devolver a ficha no formato certo, pede de novo uma vez antes de mostrar erro.
    const ficha = await comTentativas(
      () => extrairFicha(transcricao, modelo, perfil?.preferencias, consulta, area, teleconsulta),
      { tentativas: 2, esperaMs: 1000, nome: "ficha", repetirSe: (e) => e instanceof Error && e.message.startsWith("A IA") },
    );
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
