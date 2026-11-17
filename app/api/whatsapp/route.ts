import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { dataParaMensagem, enviarModelo, whatsappAtivo } from "@/lib/whatsapp";

export const runtime = "nodejs";

/** Diz à interface se o envio automático está ligado. */
export async function GET() {
  return NextResponse.json({ ativo: whatsappAtivo() });
}

type Pedido =
  | { tipo: "convite" | "lembrete"; teleconsultaId: string }
  | { tipo: "documentos"; codigo: string; codigoHash: string; telefone: string; paciente: string };

/** Envio feito pelo profissional logado. Só alcança as teleconsultas e entregas dele (RLS). */
export async function POST(req: Request) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Sessão expirada. Entre de novo." }, { status: 401 });
  if (!whatsappAtivo()) return NextResponse.json({ erro: "WhatsApp automático ainda não configurado." }, { status: 503 });

  const p = (await req.json().catch(() => null)) as Pedido | null;
  if (!p) return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  const { data: prof } = await sb.from("profissionais").select("nome").eq("id", user.id).maybeSingle();
  const profissional = prof?.nome || "o profissional";

  if (p.tipo === "convite" || p.tipo === "lembrete") {
    const { data: t } = await sb.from("teleconsultas").select("id, paciente_nome, paciente_telefone, inicio, codigo, status").eq("id", p.teleconsultaId).maybeSingle();
    if (!t) return NextResponse.json({ erro: "Teleconsulta não encontrada." }, { status: 404 });
    if (t.status === "cancelada" || t.status === "encerrada") return NextResponse.json({ erro: "Esta teleconsulta não está mais ativa." }, { status: 409 });
    if (!t.paciente_telefone) return NextResponse.json({ erro: "Cadastre o WhatsApp do paciente." }, { status: 400 });
    const r = await enviarModelo(p.tipo, t.paciente_telefone, [t.paciente_nome.split(" ")[0], profissional, dataParaMensagem(t.inicio)], t.codigo);
    if (!r.ok) return NextResponse.json({ erro: r.erro }, { status: 502 });
    await sb.from("teleconsultas").update(p.tipo === "convite" ? { convite_whatsapp_em: new Date().toISOString() } : { lembrete_manual_em: new Date().toISOString() }).eq("id", t.id);
    return NextResponse.json({ ok: true });
  }

  if (p.tipo === "documentos") {
    const { data: e } = await sb.from("entregas").select("id").eq("codigo_hash", p.codigoHash).maybeSingle();
    if (!e) return NextResponse.json({ erro: "Link do paciente não encontrado." }, { status: 404 });
    const r = await enviarModelo("documentos", p.telefone, [p.paciente.split(" ")[0] || "paciente", profissional], p.codigo);
    if (!r.ok) return NextResponse.json({ erro: r.erro }, { status: 502 });
    await sb.from("entregas").update({ whatsapp_em: new Date().toISOString() }).eq("id", e.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ erro: "Tipo de envio desconhecido." }, { status: 400 });
}
