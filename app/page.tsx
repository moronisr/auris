import Link from "next/link";
import { horariosLivres, limparAgenda, limparExcecoes } from "@/lib/agenda";
import { supabaseServer } from "@/lib/supabase/server";
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
    // Sem diferenciar acento nem maiúscula: "joao" encontra "João".
    const sem = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const termos = sem(busca).split(/\s+/).filter(Boolean);
    const { data } = await sb.from("registros")
      .select("id, created_at, modelo, paciente_nome, retorno_data, corrigido_pelo_medico")
      .order("created_at", { ascending: false })
      .limit(3000);
    encontrados = (data ?? []).filter((r) => { const n = sem(r.paciente_nome || ""); return termos.every((t) => n.includes(t)); }).slice(0, 100);
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

  const SETA = <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
  return (
    <div className="inicio-auris">
      <div className="saudacao">Olá{perfil?.nome ? `, ${perfil.nome.split(" ")[0]}` : ""}</div>
      <h1 className="titulo-grande">Como vai ser o atendimento?</h1>

      {perfil && (() => {
        // Lembrete da agenda online: sem horários abertos, os pacientes não conseguem marcar.
        const livres = perfil.agenda_ativa ? horariosLivres({ agenda: limparAgenda(perfil.agenda), excecoes: limparExcecoes(perfil.agenda_excecoes), duracao: perfil.duracao_consulta ?? 30, ocupados: [], dias: 7, antecedenciaHoras: perfil.antecedencia_horas ?? 2 }).length : 0;
        if (perfil.agenda_ativa && livres > 0) return null;
        return (
          <div className="aviso" style={{ marginBottom: 14 }}>
            {perfil.agenda_ativa
              ? "Sua agenda online não tem horários abertos nos próximos 7 dias. "
              : "Abra a sua agenda online: o paciente marca, paga e recebe o link sozinho. "}
            <Link href="/perfil#agenda-online">{perfil.agenda_ativa ? "Ajustar horários" : "Configurar"}</Link>
          </div>
        );
      })()}
      <AjudaConvite novato={total === 0} />

      <div className="escolhas">
        <Link href="/presencial" className="escolha" data-ajuda="novo">
          <span className="escolha-icone"><svg aria-hidden="true" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg></span>
          <b>Consulta presencial</b>
          <span>No consultório. Grave a conversa ou dite depois.</span>
          <span className="escolha-seguir">Começar {SETA}</span>
        </Link>
        <Link href="/teleconsultas" className="escolha">
          <span className="escolha-icone"><svg aria-hidden="true" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="13" height="12" rx="3" /><path d="m16 10 5-3v10l-5-3" /></svg></span>
          <b>Teleconsulta</b>
          <span>{proximas.length ? `${proximas.length} nas próximas 24 horas` : "Por vídeo. Agende, envie o link e atenda."}</span>
          <span className="escolha-seguir">Começar {SETA}</span>
        </Link>
      </div>
      <div style={{ textAlign: "center", marginBottom: 6 }}><AjudaLink /></div>

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
      {total === 0 && <p className="muted">Nenhum registro ainda. Comece por Consulta presencial.</p>}
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
        </Link>
      ))}
    </div>
  );
}
