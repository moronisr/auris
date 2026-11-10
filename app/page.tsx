import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import BotaoSair from "./sair";

export const dynamic = "force-dynamic";

const fmt = (v: number | null) => (v == null ? "—" : (v > 0 ? "+" : "") + v.toFixed(2).replace(".", ","));

export default async function Inicio() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data: perfil } = await sb.from("profissionais").select("nome").eq("id", user!.id).maybeSingle();
  const { data: registros } = await sb
    .from("registros")
    .select("id, created_at, paciente_nome, od_esferico, od_cilindrico, od_eixo, oe_esferico, oe_cilindrico, oe_eixo, retorno_data, corrigido_pelo_medico, tempo_processamento_ms")
    .order("created_at", { ascending: false })
    .limit(100);

  const lista = registros ?? [];
  const total = lista.length;
  const semCorrecao = lista.filter((r) => !r.corrigido_pelo_medico).length;
  const precisao = total ? Math.round((semCorrecao / total) * 100) : 0;
  const hoje = new Date().toISOString().slice(0, 10);
  const retornos30 = lista.filter((r) => r.retorno_data && r.retorno_data >= hoje).length;

  return (
    <>
      <div className="row">
        <h1>Olá{perfil?.nome ? `, ${perfil.nome.split(" ")[0]}` : ""}</h1>
        <BotaoSair />
      </div>

      <Link href="/novo" className="btn gravar">🎙️ Novo registro por voz</Link>

      <h2>Resultados</h2>
      <div className="grid">
        <div className="card"><div className="muted">Registros</div><b style={{ fontSize: 22 }}>{total}</b></div>
        <div className="card"><div className="muted">Aprovados sem correção</div><b style={{ fontSize: 22 }}>{precisao}%</b></div>
        <div className="card"><div className="muted">Retornos agendados</div><b style={{ fontSize: 22 }}>{retornos30}</b></div>
      </div>

      <h2>Últimos pacientes</h2>
      {total === 0 && <p className="muted">Nenhum registro ainda. Toque em “Novo registro por voz”.</p>}
      {lista.map((r) => (
        <div className="card" key={r.id}>
          <div className="row">
            <b>{r.paciente_nome}</b>
            <span className="muted">{new Date(r.created_at).toLocaleDateString("pt-BR")}</span>
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            OD {fmt(r.od_esferico)} {fmt(r.od_cilindrico)} × {r.od_eixo ?? "—"}° · OE {fmt(r.oe_esferico)} {fmt(r.oe_cilindrico)} × {r.oe_eixo ?? "—"}°
            {r.retorno_data && <> · Retorno {new Date(r.retorno_data + "T12:00").toLocaleDateString("pt-BR")}</>}
          </div>
        </div>
      ))}
    </>
  );
}
