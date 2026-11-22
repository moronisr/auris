import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { confirmarPagamento } from "@/lib/pagamentos";
import { sincronizarTodas } from "@/lib/assinatura";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Conferência de pagamentos: consulta de novo a instituição para toda consulta com cobrança online
 * ainda não confirmada (e as confirmadas recentes, para achar duplicidade). Não confia em nada do navegador.
 * POST: do profissional logado (roda quando ele abre a agenda). GET: rotina diária para todos.
 */
async function conferir(profissionalId?: string) {
  const sb = supabaseAdmin();
  let q = sb.from("teleconsultas").select("id")
    .in("pagamento_status", ["pendente", "informado", "confirmado"])
    .not("pg_provedor", "is", null)
    .gte("inicio", new Date(Date.now() - 3 * 864e5).toISOString())
    .order("inicio", { ascending: false }).limit(40);
  if (profissionalId) q = q.eq("profissional_id", profissionalId);
  const { data } = await q;
  let confirmadas = 0;
  for (const t of data || []) {
    try { if ((await confirmarPagamento(t.id)) === "confirmado") confirmadas++; } catch (e) { console.error("conferir", t.id, String(e).slice(0, 200)); }
  }
  return { conferidas: (data || []).length, confirmadas };
}

/**
 * Contestações chegam semanas depois do pagamento. Uma vez por dia, revisa os pagamentos online
 * confirmados nos últimos 120 dias (e os que já têm alerta), em lotes, para achar contestação,
 * estorno do cartão ou devolução feita fora do Auris.
 */
async function vigiarContestacoes() {
  const sb = supabaseAdmin();
  const { data } = await sb.from("teleconsultas").select("id")
    .eq("pg_provedor", "mercadopago").eq("pagamento_status", "confirmado").not("mp_pagamento_id", "is", null)
    .gte("pagamento_confirmado_em", new Date(Date.now() - 120 * 864e5).toISOString())
    .order("pagamento_confirmado_em", { ascending: false }).limit(120);
  const ids = (data || []).map((t) => t.id);
  let alertas = 0;
  for (let i = 0; i < ids.length; i += 8) {
    await Promise.all(ids.slice(i, i + 8).map(async (id) => {
      try { await confirmarPagamento(id); } catch (e) { console.error("vigiar", id, String(e).slice(0, 200)); }
    }));
  }
  const { count } = await sb.from("teleconsultas").select("id", { count: "exact", head: true }).in("pagamento_alerta", ["contestacao", "chargeback"]);
  alertas = count || 0;
  return { revisadas: ids.length, contestacoes: alertas };
}

export async function POST() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Entre na sua conta." }, { status: 401 });
  return NextResponse.json(await conferir(user.id));
}

export async function GET() {
  const pagamentos = await conferir();
  const vigia = await vigiarContestacoes().catch(() => ({ revisadas: 0, contestacoes: 0 }));
  const assinaturas = await sincronizarTodas().catch(() => 0);
  return NextResponse.json({ ...pagamentos, ...vigia, assinaturas });
}
