import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import BotaoSair from "./sair";
import { MODELOS } from "@/lib/modelos";

export const dynamic = "force-dynamic";


export default async function Inicio() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data: perfil } = await sb.from("profissionais").select("nome").eq("id", user!.id).maybeSingle();
  const { data: registros } = await sb
    .from("registros")
    .select("id, created_at, modelo, paciente_nome, retorno_data, corrigido_pelo_medico")
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

      <Link href="/novo" className="btn gravar">Novo registro</Link>
      <Link href="/dia" className="btn btn-sec" style={{ display: "block", marginTop: 10 }}>PDF dos atendimentos do dia</Link>

      <h2>Resultados</h2>
      <div className="grid">
        <div className="card"><div className="muted">Registros</div><div className="numero">{total}</div></div>
        <div className="card"><div className="muted">Aprovados sem correção</div><div className="numero">{precisao}%</div></div>
        <div className="card"><div className="muted">Retornos agendados</div><div className="numero">{retornos30}</div></div>
      </div>

      <h2>Últimos pacientes</h2>
      {total === 0 && <p className="muted">Nenhum registro ainda. Toque em “Novo registro por voz”.</p>}
      {lista.map((r) => (
        <Link href={`/registro/${r.id}`} className="card" key={r.id} style={{ display: "block", color: "inherit", textDecoration: "none" }}>
          <div className="row">
            <b>{r.paciente_nome}</b>
            <span className="muted">{new Date(r.created_at).toLocaleDateString("pt-BR")}</span>
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            {MODELOS[r.modelo]?.nome ?? r.modelo}
            {r.retorno_data && <> · Retorno {new Date(r.retorno_data + "T12:00").toLocaleDateString("pt-BR")}</>}
            {" · Ver ficha / PDF →"}
          </div>
        </Link>
      ))}
    </>
  );
}
