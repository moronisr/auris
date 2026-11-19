"use client";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { DIAS, criarSlug, horariosLivres, limparAgenda, limparExcecoes, slugValido, type Excecao, type Intervalo } from "@/lib/agenda";

const DURACOES = [20, 30, 40, 45, 50, 60, 90];
const ANTECEDENCIAS = [1, 2, 4, 12, 24, 48];

type Estado = {
  slug: string; agenda_ativa: boolean; valor: string; duracao: number; antecedencia: number;
  agenda: Intervalo[]; excecoes: Excecao[]; apresentacao: string; mp_conectado: boolean; mp_modo: string | null;
};

const dataBR = (iso: string) => new Date(`${iso}T12:00:00-03:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });

/** Agenda online do profissional: link público, valor, horários da semana, ajustes por data e Mercado Pago. */
export default function AgendaOnline({ nome }: { nome: string }) {
  const [id, setId] = useState<string | null>(null);
  const [e, setE] = useState<Estado | null>(null);
  const [token, setToken] = useState("");
  const [msg, setMsg] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [msgMp, setMsgMp] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [conectando, setConectando] = useState(false);
  const [nova, setNova] = useState<Excecao>({ data: "", tipo: "bloqueio", inicio: "08:00", fim: "12:00" });
  const [origem, setOrigem] = useState("");
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    setOrigem(window.location.origin);
    (async () => {
      const sb = supabaseBrowser();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      setId(user.id);
      const { data: d } = await sb.from("profissionais")
        .select("slug, agenda_ativa, valor_consulta, duracao_consulta, antecedencia_horas, agenda, agenda_excecoes, apresentacao, mp_conectado, mp_modo, nome")
        .eq("id", user.id).maybeSingle();
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
      });
    })();
  }, [nome]);

  const livres7 = useMemo(() => e ? horariosLivres({ agenda: e.agenda, excecoes: e.excecoes, duracao: e.duracao, ocupados: [], dias: 7, antecedenciaHoras: e.antecedencia }).length : 0, [e]);

  if (!e) return null;
  const set = (p: Partial<Estado>) => { setE({ ...e, ...p }); setMsg(null); };
  const doDia = (d: number) => e.agenda.filter((i) => i.dia === d);
  const mudarDia = (d: number, lista: Intervalo[]) => set({ agenda: [...e.agenda.filter((i) => i.dia !== d), ...lista].sort((a, b) => a.dia - b.dia || a.inicio.localeCompare(b.inicio)) });
  const link = `${origem}/${e.slug}`;

  async function conectar() {
    setConectando(true); setMsgMp(null);
    const r = await fetch("/api/pagamento/conta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
    const d = await r.json().catch(() => ({}));
    setConectando(false);
    if (!r.ok) return setMsgMp({ tipo: "erro", texto: d.erro || "Não foi possível conectar." });
    setToken("");
    setE({ ...e!, mp_conectado: true, mp_modo: d.modo });
    setMsgMp({ tipo: "ok", texto: d.modo === "teste" ? "Mercado Pago conectado em modo de teste. Nenhum dinheiro real é cobrado." : "Mercado Pago conectado. Os pagamentos caem direto na sua conta." });
  }

  async function desconectar() {
    const r = await fetch("/api/pagamento/conta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ desconectar: true }) });
    if (r.ok) { setE({ ...e!, mp_conectado: false, mp_modo: null, agenda_ativa: false }); setMsgMp({ tipo: "ok", texto: "Mercado Pago desconectado. A agenda online foi pausada." }); }
  }

  async function salvar() {
    if (!id) return;
    const slug = e!.slug.trim().toLowerCase();
    const valor = e!.valor.trim() ? Number(e!.valor.replace(/\./g, "").replace(",", ".")) : null;
    if (!slugValido(slug)) return setMsg({ tipo: "erro", texto: "O link precisa ter de 3 a 60 letras ou números, separados por hífen. Ex.: dra-gabriela-bastos" });
    if (valor !== null && (isNaN(valor) || valor <= 0)) return setMsg({ tipo: "erro", texto: "Valor inválido. Use o formato 150,00." });
    if (e!.agenda_ativa) {
      if (!e!.mp_conectado) return setMsg({ tipo: "erro", texto: "Para aceitar agendamentos online, conecte primeiro o Mercado Pago (acima). É ele que confirma o pagamento sozinho." });
      if (!valor) return setMsg({ tipo: "erro", texto: "Informe o valor da consulta." });
      if (e!.agenda.length === 0 && !e!.excecoes.some((x) => x.tipo === "extra")) return setMsg({ tipo: "erro", texto: "Marque pelo menos um dia e horário de atendimento." });
    }
    setSalvando(true);
    const { error } = await supabaseBrowser().from("profissionais").update({
      slug, agenda_ativa: e!.agenda_ativa, valor_consulta: valor, duracao_consulta: e!.duracao, antecedencia_horas: e!.antecedencia,
      agenda: e!.agenda, agenda_excecoes: e!.excecoes.filter((x) => x.data >= new Date().toISOString().slice(0, 10)), apresentacao: e!.apresentacao.trim() || null,
    }).eq("id", id);
    setSalvando(false);
    if (error) return setMsg({ tipo: "erro", texto: error.code === "23505" ? "Esse link já está em uso por outro profissional. Escolha outro." : "Não foi possível salvar: " + error.message });
    setE({ ...e!, slug });
    setMsg({ tipo: "ok", texto: e!.agenda_ativa ? "Agenda salva. Sua página já está recebendo agendamentos." : "Agenda salva. Ative \"Aceitar agendamentos online\" quando quiser abrir a página." });
  }

  function addExcecao() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nova.data)) return setMsg({ tipo: "erro", texto: "Escolha a data do ajuste." });
    if (nova.tipo === "extra" && (!nova.inicio || !nova.fim || nova.fim <= nova.inicio)) return setMsg({ tipo: "erro", texto: "No horário extra, o fim precisa ser depois do início." });
    set({ excecoes: [...e!.excecoes, (nova.tipo === "bloqueio" ? { data: nova.data, tipo: "bloqueio" } : { ...nova }) as Excecao].sort((a, b) => a.data.localeCompare(b.data)) });
    setNova({ ...nova, data: "" });
  }

  return (
    <div className="card" id="agenda-online">
      <h2 style={{ marginTop: 0 }}>Agenda online e pagamento automático</h2>
      <p className="muted" style={{ marginTop: -4 }}>O paciente abre o seu link, escolhe um horário livre, paga por Pix, crédito ou débito e recebe o link da teleconsulta. Sem ninguém precisar aprovar. Você só entra na hora da consulta.</p>

      <h3 className="sub">1. Pagamento online (Mercado Pago)</h3>
      {e.mp_conectado ? (
        <div className="ok" style={{ marginBottom: 8 }}>
          Mercado Pago conectado{e.mp_modo === "teste" ? " em modo de teste (nenhum dinheiro real é cobrado)" : ""}. O pagamento é confirmado automaticamente, e o paciente só entra na consulta depois de pagar.
          <div style={{ marginTop: 8 }}><button type="button" className="link" onClick={desconectar}>Desconectar</button></div>
        </div>
      ) : (
        <>
          <p className="muted">Conecte a sua conta do Mercado Pago. O dinheiro cai direto nela; o Auris não recebe nem guarda valores.</p>
          <ol className="muted passos-lista">
            <li>Entre em <b>mercadopago.com.br/developers/panel/app</b> com a sua conta e toque em <b>Criar aplicação</b> (qualquer nome, por exemplo &quot;Auris&quot;; tipo de pagamento: Checkout Pro).</li>
            <li>Abra a aplicação e vá em <b>Credenciais de produção</b> (ou <b>Credenciais de teste</b>, para testar sem dinheiro real).</li>
            <li>Copie o <b>Access Token</b> e cole abaixo.</li>
          </ol>
          <label htmlFor="mp-token">Access Token do Mercado Pago</label>
          <input id="mp-token" type="password" autoComplete="off" placeholder="APP_USR-... ou TEST-..." value={token} onChange={(x) => setToken(x.target.value)} />
          <button type="button" disabled={!token.trim() || conectando} style={{ width: "100%", marginTop: 8 }} onClick={conectar}>{conectando ? "Conferindo com o Mercado Pago" : "Conectar Mercado Pago"}</button>
        </>
      )}
      {msgMp && <div className={msgMp.tipo} style={{ marginTop: 8 }}>{msgMp.texto}</div>}

      <h3 className="sub">2. Sua página de agendamento</h3>
      <label htmlFor="ag-slug">Seu link</label>
      <div className="link-prefixo">
        <span>{origem.replace(/^https?:\/\//, "")}/</span>
        <input id="ag-slug" value={e.slug} onChange={(x) => set({ slug: x.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} />
      </div>
      <p className="muted">Coloque este link no Instagram, no WhatsApp e no Google.</p>
      <div className="grid">
        <div>
          <label htmlFor="ag-valor">Valor da teleconsulta</label>
          <input id="ag-valor" inputMode="decimal" placeholder="150,00" value={e.valor} onChange={(x) => set({ valor: x.target.value })} />
        </div>
        <div>
          <label htmlFor="ag-dur">Duração de cada consulta</label>
          <select id="ag-dur" value={e.duracao} onChange={(x) => set({ duracao: Number(x.target.value) })}>
            {DURACOES.map((d) => <option key={d} value={d}>{d} minutos</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ag-ant">Antecedência mínima</label>
          <select id="ag-ant" value={e.antecedencia} onChange={(x) => set({ antecedencia: Number(x.target.value) })}>
            {ANTECEDENCIAS.map((h) => <option key={h} value={h}>{h < 24 ? `${h} hora${h > 1 ? "s" : ""}` : `${h / 24} dia${h > 24 ? "s" : ""}`} antes</option>)}
          </select>
        </div>
      </div>
      <label htmlFor="ag-apres" style={{ marginTop: 10 }}>Apresentação (opcional)</label>
      <textarea id="ag-apres" rows={2} maxLength={400} placeholder="Ex.: Atendo adultos e crianças. Retornos em até 30 dias." value={e.apresentacao} onChange={(x) => set({ apresentacao: x.target.value })} />

      <h3 className="sub">3. Horários fixos da semana</h3>
      <p className="muted" style={{ marginTop: -4 }}>Valem para todas as semanas. Ajuste datas específicas no passo 4.</p>
      <div className="semana">
        {[1, 2, 3, 4, 5, 6, 0].map((d) => {
          const lista = doDia(d);
          return (
            <div className="dia-agenda" key={d}>
              <label className="dia-nome">
                <input type="checkbox" checked={lista.length > 0} onChange={(x) => mudarDia(d, x.target.checked ? [{ dia: d, inicio: "14:00", fim: "18:00" }] : [])} />
                <span>{DIAS[d]}</span>
              </label>
              <div className="faixas">
                {lista.length === 0 && <span className="muted">Sem atendimento</span>}
                {lista.map((i, k) => (
                  <div className="faixa" key={k}>
                    <input type="time" aria-label={`${DIAS[d]} início`} value={i.inicio} onChange={(x) => mudarDia(d, lista.map((y, j) => j === k ? { ...y, inicio: x.target.value } : y))} />
                    <span className="muted">até</span>
                    <input type="time" aria-label={`${DIAS[d]} fim`} value={i.fim} onChange={(x) => mudarDia(d, lista.map((y, j) => j === k ? { ...y, fim: x.target.value } : y))} />
                    <button type="button" className="link" onClick={() => mudarDia(d, lista.filter((_, j) => j !== k))}>Remover</button>
                  </div>
                ))}
                {lista.length > 0 && lista.length < 3 && (
                  <button type="button" className="link" onClick={() => mudarDia(d, [...lista, { dia: d, inicio: "19:00", fim: "21:00" }])}>Adicionar outro horário neste dia</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <h3 className="sub">4. Ajustes em datas específicas</h3>
      <p className="muted" style={{ marginTop: -4 }}>Feche um dia (feriado, viagem) ou abra um horário a mais só naquela data.</p>
      <div className="grid">
        <div>
          <label htmlFor="ex-data">Data</label>
          <input id="ex-data" type="date" value={nova.data} min={new Date().toISOString().slice(0, 10)} onChange={(x) => setNova({ ...nova, data: x.target.value })} />
        </div>
        <div>
          <label htmlFor="ex-tipo">Ajuste</label>
          <select id="ex-tipo" value={nova.tipo} onChange={(x) => setNova({ ...nova, tipo: x.target.value as Excecao["tipo"] })}>
            <option value="bloqueio">Fechar o dia inteiro</option>
            <option value="extra">Abrir horário extra</option>
          </select>
        </div>
        {nova.tipo === "extra" && (
          <div className="faixa">
            <input type="time" aria-label="Início do horário extra" value={nova.inicio} onChange={(x) => setNova({ ...nova, inicio: x.target.value })} />
            <span className="muted">até</span>
            <input type="time" aria-label="Fim do horário extra" value={nova.fim} onChange={(x) => setNova({ ...nova, fim: x.target.value })} />
          </div>
        )}
      </div>
      <button type="button" className="btn-sec" style={{ marginTop: 8 }} onClick={addExcecao}>Adicionar ajuste</button>
      {e.excecoes.length > 0 && (
        <ul className="lista-ajustes">
          {e.excecoes.map((x, k) => (
            <li key={k}>
              <span><b>{dataBR(x.data)}</b>: {x.tipo === "bloqueio" ? "dia fechado" : `horário extra das ${x.inicio} às ${x.fim}`}</span>
              <button type="button" className="link" onClick={() => set({ excecoes: e.excecoes.filter((_, j) => j !== k) })}>Remover</button>
            </li>
          ))}
        </ul>
      )}

      <h3 className="sub">5. Abrir a agenda</h3>
      <label className="aceite">
        <input type="checkbox" checked={e.agenda_ativa} onChange={(x) => set({ agenda_ativa: x.target.checked })} />
        <span>Aceitar agendamentos online pela minha página</span>
      </label>
      <p className="muted">{livres7 > 0 ? `Com esses horários, a sua página mostra ${livres7} horários nos próximos 7 dias.` : "Com os horários de agora, a sua página não mostra nenhum horário nos próximos 7 dias."}</p>
      {msg && <div className={msg.tipo} style={{ marginBottom: 10 }}>{msg.texto}</div>}
      <button type="button" disabled={salvando} style={{ width: "100%" }} onClick={salvar}>{salvando ? "Salvando" : "Salvar agenda"}</button>
      {e.slug && slugValido(e.slug) && (
        <div className="acoes-ficha" style={{ marginTop: 10 }}>
          <a className="btn btn-sec" href={`/${e.slug}`} target="_blank" rel="noreferrer">Ver minha página</a>
          <button type="button" className="btn-sec" onClick={() => { navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 1800); }}>{copiado ? "Link copiado" : "Copiar meu link"}</button>
        </div>
      )}
    </div>
  );
}
