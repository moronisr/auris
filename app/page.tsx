import Link from "next/link";
import { horariosLivres, limparAgenda, limparExcecoes } from "@/lib/agenda";
import { supabaseServer } from "@/lib/supabase/server";
import BotaoSair from "./sair";
import { MODELOS } from "@/lib/modelos";
import { AjudaConvite, AjudaLink } from "@/components/AjudaInicio";

export const dynamic = "force-dynamic";


export default async function Inicio({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const busca = String((await searchParams)?.q || "").trim().slice(0, 80);
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data: perfil } = await sb.from("profissionais").select("nome, slug, agenda_ativa, agenda, agenda_excecoes, duracao_consulta, antecedencia_horas, mp_conectado").eq("id", user!.id).maybeSingle();
  const { data: registros } = await sb
    .from("registros")
    .select("id, created_at, modelo, paciente_nome, retorno_data, corrigido_pelo_medico")
    .order("created_at", { ascending: false })
    .limit(100);

  const lista = registros ?? [];
  // Busca de pacientes pelo nome (só nas fichas do próprio profissional; a regra de acesso do banco garante isso).
  let encontrados = lista;
  if (busca) {
    const termo = busca.replace(/[%_\\,()]/g, " ").trim();
    const { data } = await sb.from("registros")
      .select("id, created_at, modelo, paciente_nome, retorno_data, corrigido_pelo_medico")
      .ilike("paciente_nome", `%${termo}%`)
      .order("created_at", { ascending: false })
      .limit(100);
    encontrados = data ?? [];
  }
  const total = lista.length;
  const semCorrecao = lista.filter((r) => !r.corrigido_pelo_medico).length;
  const precisao = total ? Math.round((semCorrecao / total) * 100) : 0;
  const hoje = new Date().toISOString().slice(0, 10);
  const retornos30 = lista.filter((r) => r.retorno_data && r.retorno_data >= hoje).length;
  const agora = new Date();
  const fimDoDia = new Date(agora.getTime() + 24 * 3600 * 1000).toISOString();
  const { data: teles } = await sb.from("teleconsultas").select("id, paciente_nome, inicio, paciente_na_espera_em, status")
    .gte("inicio", new Date(agora.getTime() - 2 * 3600 * 1000).toISOString()).lte("inicio", fimDoDia)
    .in("status", ["agendada", "confirmada", "em_andamento"]).order("inicio").limit(5);
  const proximas = teles ?? [];

  return (
    <>
      <div className="row">
        <h1>Olá{perfil?.nome ? `, ${perfil.nome.split(" ")[0]}` : ""}</h1>
        <BotaoSair />
      </div>

      {perfil && (() => {
        // Lembrete da agenda online: sem horários abertos, os pacientes não conseguem marcar.
        const livres = perfil.agenda_ativa ? horariosLivres({ agenda: limparAgenda(perfil.agenda), excecoes: limparExcecoes(perfil.agenda_excecoes), duracao: perfil.duracao_consulta ?? 30, ocupados: [], dias: 7, antecedenciaHoras: perfil.antecedencia_horas ?? 2 }).length : 0;
        if (perfil.agenda_ativa && livres > 0) return null;
        return (
          <div className="aviso" style={{ marginBottom: 14 }}>
            {perfil.agenda_ativa
              ? "Sua agenda online não tem horários abertos nos próximos 7 dias, então os pacientes não conseguem marcar. "
              : "Abra a sua agenda online: o paciente escolhe o horário, paga e recebe o link da teleconsulta sozinho, sem ninguém aprovar. "}
            <Link href="/perfil#agenda-online">{perfil.agenda_ativa ? "Ajustar meus horários" : "Configurar agora"}</Link>
          </div>
        );
      })()}
      <AjudaConvite novato={total === 0} />
      <Link href="/novo" className="btn gravar" data-ajuda="novo">Novo registro</Link>
      <Link href="/teleconsultas" className="btn btn-sec" style={{ display: "block", marginTop: 10 }}>Teleconsultas</Link>
      <Link href="/dia" className="btn btn-sec" style={{ display: "block", marginTop: 10 }}>PDF dos atendimentos do dia</Link>
      <div style={{ textAlign: "center", marginTop: 12 }}><AjudaLink /></div>

      {proximas.length > 0 && (
        <>
          <h2>Próximas teleconsultas</h2>
          {proximas.map((t) => (
            <Link key={t.id} href={`/teleconsultas/${t.id}`} className="card" style={{ display: "block", color: "inherit", textDecoration: "none" }}>
              <div className="row">
                <b>{t.paciente_nome}</b>
                <span className="muted">{new Date(t.inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}</span>
              </div>
              {t.paciente_na_espera_em && <div className="selo selo-alerta" style={{ marginTop: 8 }}>Paciente na sala de espera</div>}
            </Link>
          ))}
        </>
      )}

      <h2>Resultados</h2>
      <div className="grid">
        <div className="card"><div className="muted">Registros</div><div className="numero">{total}</div></div>
        <div className="card"><div className="muted">Aprovados sem correção</div><div className="numero">{precisao}%</div></div>
        <div className="card"><div className="muted">Retornos agendados</div><div className="numero">{retornos30}</div></div>
      </div>

      <h2 id="ultimos-pacientes">{busca ? "Pacientes encontrados" : "Últimos pacientes"}</h2>
      {total > 0 && (
        <form method="get" action="/#ultimos-pacientes" className="busca-pacientes" role="search">
          <input name="q" defaultValue={busca} placeholder="Buscar paciente pelo nome" aria-label="Buscar paciente pelo nome" />
          <button type="submit">Buscar</button>
          {busca && <Link href="/#ultimos-pacientes" className="btn btn-sec">Limpar</Link>}
        </form>
      )}
      {busca && encontrados.length === 0 && <p className="muted">Nenhum paciente com &quot;{busca}&quot;. Confira a grafia ou busque só pelo primeiro nome.</p>}
      {total > 0 && <p className="muted" style={{ marginTop: -4, marginBottom: 10 }}>Para emitir uma receita com assinatura gov.br, abra a ficha do paciente.</p>}
      {total === 0 && <p className="muted">Nenhum registro ainda. Toque em “Novo registro por voz”.</p>}
      {encontrados.map((r) => (
        <Link href={`/registro/${r.id}`} className="card" key={r.id} style={{ display: "block", color: "inherit", textDecoration: "none" }}>
          <div className="row">
            <b>{r.paciente_nome}</b>
            <span className="muted">{new Date(r.created_at).toLocaleDateString("pt-BR")}</span>
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            {MODELOS[r.modelo]?.nome ?? r.modelo}
            {r.retorno_data && <>, retorno em {new Date(r.retorno_data + "T12:00").toLocaleDateString("pt-BR")}</>}
          </div>
          <div className="muted" style={{ marginTop: 2 }}>
            Abrir a ficha para ver, baixar o PDF, emitir receita gov.br e outros documentos
          </div>
        </Link>
      ))}
    </>
  );
}
