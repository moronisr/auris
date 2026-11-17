import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { dataParaMensagem, enviarModelo, whatsappAtivo } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lembretes automáticos: um dia antes e uma hora antes de cada teleconsulta.
 * Chamado a cada 10 minutos pelo agendador do banco (pg_cron), com o segredo CRON_SECRET.
 */
export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }
  if (!whatsappAtivo() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ erro: "WhatsApp ou chave de serviço não configurados." }, { status: 503 });
  }
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const agora = Date.now();
  const iso = (ms: number) => new Date(agora + ms).toISOString();
  const H = 3600 * 1000;

  const janelas = [
    { coluna: "lembrete_24h_em", de: iso(23 * H), ate: iso(25 * H) },
    { coluna: "lembrete_1h_em", de: iso(0.5 * H), ate: iso(1.25 * H) },
  ] as const;

  const resultado = { enviados: 0, falhas: [] as string[] };
  const nomes = new Map<string, string>();

  for (const j of janelas) {
    const { data: lista } = await sb.from("teleconsultas")
      .select("id, profissional_id, paciente_nome, paciente_telefone, inicio, codigo")
      .in("status", ["agendada", "confirmada"]).not("paciente_telefone", "is", null)
      .is(j.coluna, null).gte("inicio", j.de).lte("inicio", j.ate).limit(200);

    for (const t of lista ?? []) {
      if (!nomes.has(t.profissional_id)) {
        const { data: p } = await sb.from("profissionais").select("nome").eq("id", t.profissional_id).maybeSingle();
        nomes.set(t.profissional_id, p?.nome || "o profissional");
      }
      // Marca antes de enviar para nunca mandar o mesmo lembrete duas vezes.
      const { data: marcado } = await sb.from("teleconsultas").update({ [j.coluna]: new Date().toISOString() }).eq("id", t.id).is(j.coluna, null).select("id");
      if (!marcado?.length) continue;
      const r = await enviarModelo("lembrete", t.paciente_telefone!, [t.paciente_nome.split(" ")[0], nomes.get(t.profissional_id)!, dataParaMensagem(t.inicio)], t.codigo);
      if (r.ok) resultado.enviados++;
      else resultado.falhas.push(`${t.id}: ${r.erro}`);
    }
  }
  return NextResponse.json(resultado);
}
