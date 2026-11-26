"use client";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { juntarObs, separarObs } from "@/lib/cancelamento";
import { mascaraTelefone } from "@/lib/telefone";
import { buscarSituacao } from "@/lib/useAcesso";
import { criarSlug, horariosLivres, limparAgenda, limparExcecoes, slugValido, type Excecao, type Intervalo } from "@/lib/agenda";

const DURACOES = [20, 30, 40, 45, 50, 60, 90];
const ANTECEDENCIAS = [1, 2, 4, 12, 24, 48];

type Estado = {
  slug: string; agenda_ativa: boolean; valor: string; duracao: number; antecedencia: number;
  agenda: Intervalo[]; excecoes: Excecao[]; apresentacao: string; mp_conectado: boolean; mp_modo: string | null; pg_provedor: string | null; cancelamento_horas: number; cancelamento_obs: string;
};


/** Agenda online do profissional: link público, valor, horários da semana, ajustes por data e Mercado Pago. */
export type ParteAgenda = "pagamento" | "pagina" | "horarios";

/** Uma parte da agenda online por vez (Recebimento, Minha página, Horários), para o médico não se confundir. */
export default function AgendaOnline({ nome, parte }: { nome: string; parte: ParteAgenda }) {
  const [id, setId] = useState<string | null>(null);
  const [e, setE] = useState<Estado | null>(null);
  const [token, setToken] = useState("");
  const [msg, setMsg] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [msgMp, setMsgMp] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [conectando, setConectando] = useState(false);
  const [origem, setOrigem] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [slugSalvo, setSlugSalvo] = useState<string | null>(null);
  const [botaoMp, setBotaoMp] = useState(false);
  const [inst, setInst] = useState<"mercadopago" | "pagbank">("mercadopago");
  // PagBank: em teste. Aparece para os administradores do Auris (ou para todos com NEXT_PUBLIC_PAGBANK=1).
  const [verPagBank, setVerPagBank] = useState(process.env.NEXT_PUBLIC_PAGBANK === "1");
  useEffect(() => { buscarSituacao().then((x) => { if (x?.admin) setVerPagBank(true); }).catch(() => {}); }, []);
  const [pbToken, setPbToken] = useState("");
  const [pbTeste, setPbTeste] = useState(false);
  const [diaSel, setDiaSel] = useState<string | null>(null);
  const [mesDesloc, setMesDesloc] = useState(0);
  const [verRecado, setVerRecado] = useState(false);
  const [whatsCampo, setWhatsCampo] = useState<string | null>(null);

  useEffect(() => {
    setOrigem(window.location.origin);
    fetch("/api/pagamento/conta").then((r) => r.json()).then((d) => setBotaoMp(!!d.botao)).catch(() => {});
    const retornoMp = new URLSearchParams(window.location.search).get("mp");
    if (retornoMp) {
      setMsgMp(retornoMp === "ok" ? { tipo: "ok", texto: "Mercado Pago conectado. Os pagamentos caem direto na sua conta e são confirmados automaticamente." }
        : retornoMp === "cancelado" ? { tipo: "erro", texto: "A conexão foi cancelada no Mercado Pago. Toque no botão de novo quando quiser conectar." }
        : retornoMp === "indisponivel" ? { tipo: "erro", texto: "A conexão pelo botão ainda está sendo configurada. Use a opção com Access Token abaixo." }
        : { tipo: "erro", texto: "Não foi possível concluir a conexão com o Mercado Pago. Tente de novo." });
      window.history.replaceState(null, "", "/perfil#recebimento");
    }
    (async () => {
      const sb = supabaseBrowser();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      setId(user.id);
      const { data: d } = await sb.from("profissionais")
        .select("slug, agenda_ativa, valor_consulta, duracao_consulta, antecedencia_horas, agenda, agenda_excecoes, apresentacao, mp_conectado, mp_modo, pg_provedor, nome, cancelamento_horas, cancelamento_obs")
        .eq("id", user.id).maybeSingle();
      setSlugSalvo(d?.slug || null);
      setE({
        slug: d?.slug || criarSlug(d?.nome || nome || ""),
        agenda_ativa: !!d?.agenda_ativa,
        valor: d?.valor_consulta ? String(d.valor_consulta).replace(".", ",") : "",
        duracao: d?.duracao_consulta || 30,
        antecedencia: d?.antecedencia_horas ?? 2,
        agenda: limparAgenda(d?.agenda),
        excecoes: limparExcecoes(d?.agenda_excecoes),
        apresentacao: d?.apresentacao || "",
        mp_conectado: !!d?.mp_conectado,
        mp_modo: d?.mp_modo || null,
        pg_provedor: d?.pg_provedor || null,
        cancelamento_horas: d?.cancelamento_horas ?? 24,
        cancelamento_obs: d?.cancelamento_obs || "",
      });
    })();
  }, [nome]);

  const livres7 = useMemo(() => e ? horariosLivres({ agenda: e.agenda, excecoes: e.excecoes, duracao: e.duracao, ocupados: [], dias: 7, antecedenciaHoras: e.antecedencia }).length : 0, [e]);

  if (!e) return null;
  const set = (p: Partial<Estado>) => { setE({ ...e, ...p }); setMsg(null); };
  const doDia = (d: number) => e.agenda.filter((i) => i.dia === d);
  const mudarDia = (d: number, lista: Intervalo[]) => set({ agenda: [...e.agenda.filter((i) => i.dia !== d), ...lista].sort((a, b) => a.dia - b.dia || a.inicio.localeCompare(b.inicio)) });

  async function conectar(provedor: "mercadopago" | "pagbank") {
    setConectando(true); setMsgMp(null);
    const corpo = provedor === "pagbank" ? { provedor, token: pbToken, sandbox: pbTeste } : { provedor, token };
    const r = await fetch("/api/pagamento/conta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
    const d = await r.json().catch(() => ({}));
    setConectando(false);
    if (!r.ok) return setMsgMp({ tipo: "erro", texto: d.erro || "Não foi possível conectar." });
    setToken(""); setPbToken("");
    setE({ ...e!, mp_conectado: true, mp_modo: d.modo, pg_provedor: provedor });
    const nome = provedor === "pagbank" ? "PagBank" : "Mercado Pago";
    setMsgMp({ tipo: "ok", texto: d.modo === "teste" ? `${nome} conectado em modo de teste. Nenhum dinheiro real é cobrado.` : `${nome} conectado. Os pagamentos caem direto na sua conta.` });
  }

  async function desconectar() {
    const r = await fetch("/api/pagamento/conta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ desconectar: true }) });
    if (r.ok) { setE({ ...e!, mp_conectado: false, mp_modo: null, pg_provedor: null, agenda_ativa: false }); setMsgMp({ tipo: "ok", texto: "Pagamento online desconectado. A agenda online foi pausada." }); }
  }

  async function salvar() {
    if (!id) return;
    const slug = e!.slug.trim().toLowerCase();
    const valor = e!.valor.trim() ? Number(e!.valor.replace(/\./g, "").replace(",", ".")) : null;
    if (!slugValido(slug)) return setMsg({ tipo: "erro", texto: "O link precisa ter de 3 a 60 letras ou números, separados por hífen. Ex.: dra-gabriela-bastos" });
    if (valor !== null && (isNaN(valor) || valor <= 0)) return setMsg({ tipo: "erro", texto: "Valor inválido. Use o formato 150,00." });
    if (e!.agenda_ativa) {
      if (!e!.mp_conectado) return setMsg({ tipo: "erro", texto: "Para aceitar agendamentos, conecte antes a sua conta de pagamento, em Recebimento." });
      if (!valor) return setMsg({ tipo: "erro", texto: "Informe o valor da consulta." });
      if (e!.agenda.length === 0 && !e!.excecoes.some((x) => x.tipo === "extra")) return setMsg({ tipo: "erro", texto: "Abra pelo menos um dia de atendimento, em Horários." });
    }
    setSalvando(true);
    const { error } = await supabaseBrowser().from("profissionais").update({
      slug, agenda_ativa: e!.agenda_ativa, valor_consulta: valor, duracao_consulta: e!.duracao, antecedencia_horas: e!.antecedencia,
      agenda: e!.agenda, agenda_excecoes: e!.excecoes.filter((x) => x.data >= new Date().toISOString().slice(0, 10)), apresentacao: e!.apresentacao.trim() || null,
      cancelamento_horas: e!.cancelamento_horas, cancelamento_obs: e!.cancelamento_obs.trim().slice(0, 500) || null,
    }).eq("id", id);
    setSalvando(false);
    if (error) return setMsg({ tipo: "erro", texto: error.code === "23505" ? "Esse link já está em uso por outro profissional. Escolha outro." : "Não foi possível salvar: " + error.message });
    setE({ ...e!, slug });
    setSlugSalvo(slug);
    setMsg({ tipo: "ok", texto: e!.agenda_ativa ? "Salvo. Sua página está recebendo agendamentos." : "Salvo. Para abrir a página, marque \"Aceitar agendamentos\" em Minha página." });
  }


  // ===== Calendário (Horários) =====
  const hojeISO = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const isoDe = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const base = new Date(`${hojeISO}T12:00:00`);
  const mesBase = new Date(base.getFullYear(), base.getMonth() + (mesDesloc), 1);
  const nomeMes = mesBase.toLocaleDateString("pt-BR", { month: "long" });
  const primeiroDia = mesBase.getDay();
  const diasNoMes = new Date(mesBase.getFullYear(), mesBase.getMonth() + 1, 0).getDate();
  const celulas: (string | null)[] = [...Array(primeiroDia).fill(null), ...Array.from({ length: diasNoMes }, (_, i) => isoDe(new Date(mesBase.getFullYear(), mesBase.getMonth(), i + 1)))];
  const diaSemana = (iso: string) => new Date(`${iso}T12:00:00`).getDay();
  const exDo = (iso: string) => e.excecoes.filter((x) => x.data === iso);
  const folga = (iso: string) => exDo(iso).some((x) => x.tipo === "bloqueio");
  const extras = (iso: string) => exDo(iso).filter((x) => x.tipo === "extra");
  const atende = (iso: string) => (doDia(diaSemana(iso)).length > 0 && !folga(iso)) || extras(iso).length > 0;
  const nomeDiaLongo = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const plural = (d: number) => ["todo domingo", "toda segunda", "toda terça", "toda quarta", "toda quinta", "toda sexta", "todo sábado"][d];
  const trocarExcecoes = (iso: string, novas: Excecao[]) => set({ excecoes: [...e.excecoes.filter((x) => x.data !== iso), ...novas].sort((a, b) => a.data.localeCompare(b.data)) });

  const botaoSalvar = (rotulo: string, alvo: string) => (
    <>
      {msg && <div className={msg.tipo} style={{ margin: "12px 0 10px" }}>{msg.texto}</div>}
      <button type="button" data-ajuda={alvo} disabled={salvando} style={{ width: "100%", marginTop: msg ? 0 : 14 }} onClick={salvar}>{salvando ? "Salvando" : rotulo}</button>
    </>
  );

  if (parte === "pagamento") return (
    <div className="card" id="agenda-online">
      <h3 className="sub" style={{ marginTop: 0 }} data-ajuda="pf-online">Confirmação automática do pagamento</h3>
      {e.mp_conectado ? (
        <div className="ok">
          <b>{e.pg_provedor === "pagbank" ? "PagBank" : "Mercado Pago"} conectado{e.mp_modo === "teste" ? ", em modo de teste" : ""}.</b> O paciente só entra depois de pagar.
          {e.pg_provedor !== "pagbank" && <p className="muted" style={{ margin: "6px 0 0" }}>Mantenha uma chave Pix cadastrada no Mercado Pago.</p>}
          <div style={{ marginTop: 6 }}><button type="button" className="link" onClick={desconectar}>Desconectar ou trocar</button></div>
        </div>
      ) : (
        <>
          <p className="muted" style={{ marginTop: 0 }}>Conecte sua conta e o pagamento é confirmado sozinho. O dinheiro cai direto nela.</p>
          {verPagBank && (
            <div className="opcoes" role="group" aria-label="Instituição de pagamento" style={{ marginBottom: 12 }}>
              <button type="button" aria-pressed={inst === "mercadopago"} className={inst === "mercadopago" ? "opcao ativa" : "opcao"} onClick={() => { setInst("mercadopago"); setMsgMp(null); }}>Mercado Pago</button>
              <button type="button" aria-pressed={inst === "pagbank"} className={inst === "pagbank" ? "opcao ativa" : "opcao"} onClick={() => { setInst("pagbank"); setMsgMp(null); }}>PagBank</button>
            </div>
          )}
          {inst === "mercadopago" ? (
            <>
              {botaoMp && (
                <>
                  <a className="btn" href="/api/pagamento/mp/conectar" style={{ display: "flex", width: "100%" }}>Conectar com Mercado Pago</a>
                  <p className="muted">Antes, cadastre uma chave Pix no app do Mercado Pago.</p>
                </>
              )}
              <details className="avancado" open={!botaoMp}>
                <summary>{botaoMp ? "Outra forma: colar o Access Token" : "Conectar com o Access Token"}</summary>
                <ol className="muted passos-lista">
                  <li>Em <b>mercadopago.com.br/developers</b>, abra <b>Suas integrações</b>.</li>
                  <li>Crie uma aplicação (nome: Auris; Checkout Pro).</li>
                  <li>Em <b>Credenciais de produção</b>, copie o <b>Access Token</b>.</li>
                </ol>
                <label htmlFor="mp-token">Access Token do Mercado Pago</label>
                <input id="mp-token" type="password" autoComplete="off" placeholder="APP_USR-... ou TEST-..." value={token} onChange={(x) => setToken(x.target.value)} />
                <button type="button" className={botaoMp ? "btn-sec" : ""} disabled={!token.trim() || conectando} style={{ width: "100%", marginTop: 8 }} onClick={() => conectar("mercadopago")}>{conectando ? "Conferindo" : "Conectar Mercado Pago"}</button>
              </details>
            </>
          ) : (
            <>
              <ol className="muted passos-lista">
                <li>Em <b>pagbank.com.br</b>, abra <b>Vendas</b> e depois <b>Integrações</b>.</li>
                <li>Toque em <b>Gerar token</b> e copie.</li>
              </ol>
              <label htmlFor="pb-token">Token do PagBank</label>
              <input id="pb-token" type="password" autoComplete="off" placeholder="Cole o token" value={pbToken} onChange={(x) => setPbToken(x.target.value)} />
              <label className="aceite" style={{ marginTop: 10 }}>
                <input type="checkbox" checked={pbTeste} onChange={(x) => setPbTeste(x.target.checked)} />
                <span>Token de teste (sem dinheiro real)</span>
              </label>
              <button type="button" disabled={pbToken.trim().length < 20 || conectando} style={{ width: "100%", marginTop: 10 }} onClick={() => conectar("pagbank")}>{conectando ? "Conferindo" : "Conectar PagBank"}</button>
            </>
          )}
        </>
      )}
      {msgMp && <div className={msgMp.tipo} style={{ marginTop: 8 }}>{msgMp.texto}</div>}
    </div>
  );

  if (parte === "pagina") return (
    <div className="card" id="agenda-online">
      <label htmlFor="ag-slug" style={{ marginTop: 0 }}>Link da sua página</label>
      <div className="link-prefixo">
        <span>{origem.replace(/^https?:\/\//, "")}/</span>
        <input id="ag-slug" data-ajuda="pf-link" value={e.slug} onChange={(x) => set({ slug: x.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} />
      </div>
      <p className="muted">Divulgue no Instagram e no WhatsApp.</p>
      <div className="grid">
        <div>
          <label htmlFor="ag-valor">Valor</label>
          <input id="ag-valor" data-ajuda="pf-valor" inputMode="decimal" placeholder="150,00" value={e.valor} onChange={(x) => set({ valor: x.target.value })} />
        </div>
        <div>
          <label htmlFor="ag-dur">Duração</label>
          <select id="ag-dur" value={e.duracao} onChange={(x) => set({ duracao: Number(x.target.value) })}>
            {DURACOES.map((d) => <option key={d} value={d}>{d} minutos</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ag-ant">Marcar com antecedência de</label>
          <select id="ag-ant" value={e.antecedencia} onChange={(x) => set({ antecedencia: Number(x.target.value) })}>
            {ANTECEDENCIAS.map((h) => <option key={h} value={h}>{h < 24 ? `${h} hora${h > 1 ? "s" : ""}` : `${h / 24} dia${h > 24 ? "s" : ""}`}</option>)}
          </select>
        </div>
      </div>
      <label htmlFor="ag-apres" style={{ marginTop: 12 }}>Apresentação (opcional)</label>
      <textarea id="ag-apres" rows={2} maxLength={400} placeholder="Ex.: Atendo adultos e crianças." value={e.apresentacao} onChange={(x) => set({ apresentacao: x.target.value })} />
      <div className="grid" style={{ marginTop: 12 }} data-ajuda="pf-cancelar">
        <div>
          <label htmlFor="ag-cancel">Cancelamento com devolução até</label>
          <select id="ag-cancel" value={e.cancelamento_horas} onChange={(x) => set({ cancelamento_horas: Number(x.target.value) })}>
            {[2, 12, 24, 48, 72].map((h) => <option key={h} value={h}>{h} horas antes</option>)}
          </select>
        </div>
      </div>
      {(() => {
        const { whats, recado } = separarObs(e.cancelamento_obs);
        return (
          <>
            <label htmlFor="ag-whats" style={{ marginTop: 12 }}>WhatsApp para o paciente remarcar</label>
            <input id="ag-whats" inputMode="tel" placeholder="(91) 99999-9999" value={whatsCampo ?? mascaraTelefone(whats)} onChange={(x) => { setWhatsCampo(mascaraTelefone(x.target.value)); set({ cancelamento_obs: juntarObs(x.target.value, recado) || "" }); }} />
            {verRecado || recado ? (
              <>
                <label htmlFor="ag-cancel-obs" style={{ marginTop: 12 }}>Recado aos pacientes (opcional)</label>
                <textarea id="ag-cancel-obs" rows={2} maxLength={400} placeholder="Ex.: atendemos remarcações em até 7 dias." value={recado} onChange={(x) => set({ cancelamento_obs: juntarObs(whats, x.target.value) || "" })} />
              </>
            ) : (
              <button type="button" className="link" onClick={() => setVerRecado(true)}>Adicionar recado aos pacientes (opcional)</button>
            )}
          </>
        );
      })()}
      <label className="aceite" data-ajuda="pf-abrir">
        <input type="checkbox" checked={e.agenda_ativa} onChange={(x) => set({ agenda_ativa: x.target.checked })} />
        <span>Aceitar agendamentos pela minha página</span>
      </label>
      <p className="muted">{livres7 > 0 ? `${livres7} horários livres nos próximos 7 dias.` : "Nenhum horário livre nos próximos 7 dias. Abra dias em Horários."}</p>
      {botaoSalvar("Salvar", "pf-salvar-agenda")}
      {slugSalvo && slugSalvo === e.slug && (
        <div className="acoes-ficha" data-ajuda="pf-divulgar" style={{ marginTop: 10 }}>
          <a className="btn btn-sec" href={`/${slugSalvo}?previa=1`} target="_blank" rel="noreferrer">Ver minha página</a>
          <button type="button" className="btn-sec" onClick={() => { navigator.clipboard.writeText(`${origem}/${slugSalvo}`); setCopiado(true); setTimeout(() => setCopiado(false), 1800); }}>{copiado ? "Link copiado" : "Copiar meu link"}</button>
        </div>
      )}
    </div>
  );

  // Horários: calendário do mês; tocar num dia abre as opções daquele dia.
  const sel = diaSel && diaSel >= hojeISO ? diaSel : null;
  const dSel = sel ? diaSemana(sel) : 0;
  const semanal = sel ? doDia(dSel) : [];
  return (
    <div className="card" id="agenda-online">
      <div className="calendario" data-ajuda="pf-calendario">
        <div className="cal-topo">
          <button type="button" className="cal-seta" aria-label="Mês anterior" disabled={mesDesloc <= 0} onClick={() => setMesDesloc(mesDesloc - 1)}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <div className="cal-mes"><span>{nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)}</span> <small>{mesBase.getFullYear()}</small></div>
          <button type="button" className="cal-seta" aria-label="Próximo mês" disabled={mesDesloc >= 5} onClick={() => setMesDesloc(mesDesloc + 1)}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m9 18 6-6-6-6" /></svg>
          </button>
        </div>
        <div className="cal-grade" role="grid" aria-label="Calendário de atendimento">
          {["D", "S", "T", "Q", "Q", "S", "S"].map((l, i) => <span key={i} className="cal-sem" aria-hidden="true">{l}</span>)}
          {celulas.map((iso, i) => iso === null ? <span key={`v${i}`} /> : (
            <button key={iso} type="button" disabled={iso < hojeISO}
              className={`cal-dia${iso === sel ? " sel" : ""}${iso === hojeISO ? " hoje" : ""}${atende(iso) ? " aberto" : ""}`}
              aria-pressed={iso === sel} aria-label={`${nomeDiaLongo(iso)}${atende(iso) ? ", com atendimento" : ""}`}
              onClick={() => { setDiaSel(iso); setMsg(null); }}>
              {Number(iso.slice(8))}
            </button>
          ))}
        </div>
        <div className="cal-legenda"><span><i className="ponto-aberto" /> com atendimento</span><span><i className="ponto-passado" /> já passou</span></div>
      </div>

      {sel ? (
        <div className="cal-painel" data-ajuda="pf-dia">
          <b className="cal-painel-titulo">{nomeDiaLongo(sel)}</b>
          <label className="aceite" style={{ marginTop: 10 }}>
            <input type="checkbox" checked={semanal.length > 0}
              onChange={(x) => mudarDia(dSel, x.target.checked ? [{ dia: dSel, inicio: "14:00", fim: "18:00" }] : [])} />
            <span>Atender {plural(dSel)}</span>
          </label>
          {semanal.map((iv, k) => (
            <div className="faixa" key={k} style={{ marginTop: 8 }}>
              <input type="time" aria-label="Início" value={iv.inicio} onChange={(x) => mudarDia(dSel, semanal.map((y, j) => j === k ? { ...y, inicio: x.target.value } : y))} />
              <span className="muted">até</span>
              <input type="time" aria-label="Fim" value={iv.fim} onChange={(x) => mudarDia(dSel, semanal.map((y, j) => j === k ? { ...y, fim: x.target.value } : y))} />
              {semanal.length > 1 && <button type="button" className="link" onClick={() => mudarDia(dSel, semanal.filter((_, j) => j !== k))}>Remover</button>}
            </div>
          ))}
          {semanal.length > 0 && semanal.length < 3 && <button type="button" className="link" onClick={() => mudarDia(dSel, [...semanal, { dia: dSel, inicio: "19:00", fim: "21:00" }])}>Mais um horário</button>}
          {semanal.length > 0 && (
            <label className="aceite" style={{ marginTop: 10, background: "rgba(255,255,255,.05)" }}>
              <input type="checkbox" checked={folga(sel)} onChange={(x) => trocarExcecoes(sel, x.target.checked ? [...extras(sel), { data: sel, tipo: "bloqueio" }] : extras(sel))} />
              <span>Folga só neste dia</span>
            </label>
          )}
          <div style={{ marginTop: 14 }}>
            <span className="rotulo">Horário extra só neste dia</span>
            {extras(sel).map((x, k) => (
              <div className="faixa" key={k} style={{ marginTop: 6 }}>
                <input type="time" aria-label="Início do extra" value={x.inicio} onChange={(v) => trocarExcecoes(sel, [...exDo(sel).filter((y) => y.tipo === "bloqueio"), ...extras(sel).map((y, j) => j === k ? { ...y, inicio: v.target.value } : y)])} />
                <span className="muted">até</span>
                <input type="time" aria-label="Fim do extra" value={x.fim} onChange={(v) => trocarExcecoes(sel, [...exDo(sel).filter((y) => y.tipo === "bloqueio"), ...extras(sel).map((y, j) => j === k ? { ...y, fim: v.target.value } : y)])} />
                <button type="button" className="link" onClick={() => trocarExcecoes(sel, exDo(sel).filter((y) => y !== x))}>Remover</button>
              </div>
            ))}
            {extras(sel).length < 2 && <button type="button" className="link" onClick={() => trocarExcecoes(sel, [...exDo(sel), { data: sel, tipo: "extra", inicio: "08:00", fim: "12:00" }])}>Adicionar horário extra</button>}
          </div>
        </div>
      ) : (
        <p className="muted" style={{ textAlign: "center", margin: "14px 0 0" }}>Toque num dia para abrir ou fechar horários.</p>
      )}
      <p className="muted" style={{ marginBottom: 0 }}>{livres7 > 0 ? `${livres7} horários livres nos próximos 7 dias.` : "Nenhum horário livre nos próximos 7 dias."}</p>
      {botaoSalvar("Salvar horários", "pf-salvar-horarios")}
    </div>
  );
}
