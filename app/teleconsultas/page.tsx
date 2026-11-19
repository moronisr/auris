"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { linkPagamentoValido, reais } from "@/lib/pix";
import {
  dataCurta, linkWhatsApp, mensagemConvite, mensagemLembrete, novoCodigo, type Teleconsulta,
} from "@/lib/teleconsulta";

type Prof = { nome: string; pix_chave: string | null; cartao_link: string | null };

function Selo({ ok, texto, alerta }: { ok: boolean; texto: string; alerta?: boolean }) {
  return <span className={ok ? "selo selo-ok" : alerta ? "selo selo-alerta" : "selo"}>{texto}</span>;
}

export default function Teleconsultas() {
  const [lista, setLista] = useState<Teleconsulta[]>([]);
  const [prof, setProf] = useState<Prof | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [form, setForm] = useState({ nome: "", telefone: "", data: "", hora: "", duracao: "30", valor: "", cartao: "" });
  const [erro, setErro] = useState("");
  const [criada, setCriada] = useState<Teleconsulta | null>(null);
  const [copiado, setCopiado] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [origem, setOrigem] = useState("");
  const [whats, setWhats] = useState(false);
  const [envio, setEnvio] = useState<Record<string, string>>({});

  async function enviarWhats(tipo: "convite" | "lembrete", t: Teleconsulta) {
    setEnvio((e) => ({ ...e, [t.id]: "Enviando" }));
    const r = await fetch("/api/whatsapp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tipo, teleconsultaId: t.id }) });
    const d = await r.json().catch(() => ({}));
    setEnvio((e) => ({ ...e, [t.id]: r.ok ? (tipo === "convite" ? "Convite enviado pelo WhatsApp" : "Lembrete enviado pelo WhatsApp") : "O envio automático pelo WhatsApp não está disponível agora. Use o botão abaixo para enviar pelo seu WhatsApp." }));
    if (!r.ok) console.warn("WhatsApp automático:", d.erro);
    return r.ok;
  }

  const carregar = useCallback(async () => {
    const sb = supabaseBrowser();
    const desde = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
    const { data } = await sb.from("teleconsultas").select("*").gte("inicio", desde).neq("status", "cancelada").order("inicio");
    setLista((data as Teleconsulta[]) ?? []);
    setCarregando(false);
  }, []);

  useEffect(() => {
    setOrigem(window.location.origin);
    fetch("/api/whatsapp").then((r) => r.json()).then((d) => setWhats(!!d.ativo)).catch(() => setWhats(false));
    (async () => {
      const sb = supabaseBrowser();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      const { data } = await sb.from("profissionais").select("nome, pix_chave, cartao_link").eq("id", user.id).maybeSingle();
      setProf((data as Prof) ?? { nome: "", pix_chave: null, cartao_link: null });
    })();
    carregar();
    const t = setInterval(carregar, 10000);
    return () => clearInterval(t);
  }, [carregar]);

  const link = (t: Teleconsulta) => `${origem}/t/${t.codigo}`;
  const nomeProf = prof?.nome || "o profissional";

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro(""); setCriada(null);
    if (!form.nome.trim()) return setErro("Informe o nome do paciente.");
    if (!form.data || !form.hora) return setErro("Informe a data e a hora da consulta.");
    const inicio = new Date(`${form.data}T${form.hora}:00-03:00`);
    if (isNaN(inicio.getTime())) return setErro("Data ou hora inválida.");
    const valor = form.valor.trim() ? Number(form.valor.replace(/\./g, "").replace(",", ".")) : null;
    if (valor !== null && (isNaN(valor) || valor < 0)) return setErro("Valor inválido. Use o formato 150,00.");
    const cartao = form.cartao.trim() ? linkPagamentoValido(form.cartao) : null;
    if (form.cartao.trim() && !cartao) return setErro("O link de pagamento por cartão precisa começar com https://");
    // Teleconsulta paga oferece sempre as três formas: Pix, crédito e débito.
    if (valor && !prof?.pix_chave) return setErro("Para cobrar antes da consulta, cadastre a sua chave Pix em Perfil.");
    if (valor && !prof?.cartao_link && !cartao) return setErro("Para o paciente poder pagar no cartão de crédito ou de débito, cadastre o seu link de pagamento por cartão em Perfil (ou cole um link no campo abaixo do valor).");
    setSalvando(true);
    const { data, error } = await supabaseBrowser().from("teleconsultas").insert({
      paciente_nome: form.nome.trim(),
      paciente_telefone: form.telefone.replace(/\D/g, "") || null,
      inicio: inicio.toISOString(),
      duracao_min: Number(form.duracao) || 30,
      valor: valor || null,
      pagamento_status: valor ? "pendente" : "isento",
      cartao_link: valor ? cartao : null,
      codigo: novoCodigo(),
    }).select("*").single();
    setSalvando(false);
    if (error) return setErro("Não foi possível agendar: " + error.message);
    setCriada(data as Teleconsulta);
    if (whats && (data as Teleconsulta).paciente_telefone) enviarWhats("convite", data as Teleconsulta);
    setForm({ nome: "", telefone: "", data: "", hora: "", duracao: "30", valor: "", cartao: "" });
    carregar();
  }

  async function copiar(t: Teleconsulta) {
    try { await navigator.clipboard.writeText(link(t)); setCopiado(t.id); setTimeout(() => setCopiado(""), 3000); } catch { /* sem permissão */ }
  }
  async function confirmarPagamento(t: Teleconsulta) {
    await supabaseBrowser().from("teleconsultas").update({ pagamento_status: "confirmado", pagamento_confirmado_em: new Date().toISOString() }).eq("id", t.id);
    carregar();
  }
  async function cancelar(t: Teleconsulta) {
    await supabaseBrowser().from("teleconsultas").update({ status: "cancelada" }).eq("id", t.id);
    carregar();
  }

  const proximas = lista.filter((t) => t.status !== "encerrada");
  const encerradas = lista.filter((t) => t.status === "encerrada");

  return (
    <>
      <div className="row">
        <h1>Teleconsultas</h1>
        <a className="btn btn-sec" href="/">Voltar</a>
      </div>

      {prof && (!prof.pix_chave || !prof.cartao_link) && (
        <div className="aviso">Para o paciente pagar antes da consulta por Pix, cartão de crédito ou cartão de débito, cadastre {!prof.pix_chave && !prof.cartao_link ? "a sua chave Pix e o seu link de pagamento por cartão" : !prof.pix_chave ? "a sua chave Pix" : "o seu link de pagamento por cartão"} em <Link href="/perfil">Perfil</Link>. O pagamento vai direto para a sua conta.</div>
      )}

      {whats && <p className="muted" style={{ marginTop: -6 }}>WhatsApp automático ligado: convite ao agendar e lembretes um dia antes e uma hora antes.</p>}

      <form className="card" onSubmit={criar}>
        <h2 style={{ marginTop: 0 }}>Agendar teleconsulta</h2>
        <div className="grid">
          <div style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="tc-nome">Nome do paciente</label>
            <input id="tc-nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div>
            <label htmlFor="tc-tel">WhatsApp do paciente</label>
            <input id="tc-tel" inputMode="tel" placeholder="(91) 99999-9999" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          </div>
          <div>
            <label htmlFor="tc-data">Data</label>
            <input id="tc-data" type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
          </div>
          <div>
            <label htmlFor="tc-hora">Hora</label>
            <input id="tc-hora" type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} />
          </div>
          <div>
            <label htmlFor="tc-dur">Duração</label>
            <select id="tc-dur" value={form.duracao} onChange={(e) => setForm({ ...form, duracao: e.target.value })}>
              {["20", "30", "40", "60"].map((m) => <option key={m} value={m}>{m} minutos</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="tc-valor">Valor (vazio = sem cobrança)</label>
            <input id="tc-valor" inputMode="decimal" placeholder="150,00" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
          </div>
          {form.valor.trim() && (
            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="tc-cartao">Link de pagamento por cartão (crédito e débito) para este valor</label>
              <input id="tc-cartao" inputMode="url" placeholder={prof?.cartao_link ? "Vazio = usar o link do seu perfil" : "https://"} value={form.cartao} onChange={(e) => setForm({ ...form, cartao: e.target.value })} />
            </div>
          )}
        </div>
        {erro && <div className="erro" style={{ marginTop: 12 }}>{erro}</div>}
        <button type="submit" disabled={salvando} style={{ width: "100%", marginTop: 14 }}>{salvando ? "Agendando" : "Agendar e gerar o link do paciente"}</button>
      </form>

      {criada && (
        <div className="card ok-card">
          <b>Teleconsulta agendada para {dataCurta(criada.inicio)}.</b>
          <p className="muted" style={{ margin: "6px 0 12px" }}>Pelo link, o paciente aceita o termo, paga (se houver valor), responde a pré-consulta e entra na sala.{whats && criada.paciente_telefone ? " O convite sai automaticamente pelo WhatsApp do Auris, e os lembretes vão um dia antes e uma hora antes." : ""}</p>
          {envio[criada.id] && <p className={/enviado/.test(envio[criada.id]) ? "ok" : envio[criada.id] === "Enviando" ? "muted" : "erro"} style={{ marginTop: 0 }}>{envio[criada.id]}</p>}
          <div className="acoes-ficha">
            {(!whats || !criada.paciente_telefone || (envio[criada.id] && !/enviado|Enviando/.test(envio[criada.id]))) && (
              <a className="btn" href={linkWhatsApp(criada.paciente_telefone, mensagemConvite(criada, nomeProf, link(criada)))} target="_blank" rel="noreferrer">Enviar convite pelo meu WhatsApp</a>
            )}
            <button type="button" className="btn-sec" onClick={() => copiar(criada)}>{copiado === criada.id ? "Link copiado" : "Copiar link"}</button>
          </div>
        </div>
      )}

      <h2>Próximas</h2>
      {carregando && <p className="muted">Carregando.</p>}
      {!carregando && proximas.length === 0 && <p className="muted">Nenhuma teleconsulta agendada.</p>}
      {proximas.map((t) => (
        <div className="card" key={t.id}>
          <div className="row" style={{ alignItems: "flex-start" }}>
            <div>
              <b>{t.paciente_nome}</b>
              <div className="muted">{dataCurta(t.inicio)}, {t.duracao_min} min{t.valor ? `, ${reais(Number(t.valor))}` : ""}</div>
            </div>
            {t.paciente_na_espera_em && t.status !== "em_andamento" && <span className="selo selo-alerta">Na sala de espera</span>}
            {t.status === "em_andamento" && <span className="selo selo-ok">Em andamento</span>}
          </div>
          <div className="selos">
            <Selo ok={!!t.consentimento_em} texto={t.consentimento_em ? "Termo aceito" : "Termo pendente"} />
            {t.pagamento_status !== "isento" && (
              <Selo ok={t.pagamento_status === "confirmado"} alerta={t.pagamento_status === "informado"}
                texto={t.pagamento_status === "confirmado" ? "Pagamento confirmado" : t.pagamento_status === "informado" ? `Paciente informou o pagamento (${t.pagamento_metodo === "credito" ? "crédito" : t.pagamento_metodo === "debito" ? "débito" : t.pagamento_metodo === "cartao" ? "cartão" : "Pix"})` : "Pagamento pendente"} />
            )}
            <Selo ok={!!t.preconsulta} texto={t.preconsulta ? "Pré-consulta respondida" : "Pré-consulta pendente"} />
          </div>
          {envio[t.id] && t.id !== criada?.id && <p className={/enviado/.test(envio[t.id]) ? "ok" : envio[t.id] === "Enviando" ? "muted" : "erro"} style={{ margin: "10px 0 0" }}>{envio[t.id]}</p>}
          {t.pagamento_status === "informado" && (
            <div className="aviso" style={{ marginTop: 10 }}>
              Confira no aplicativo do seu banco ou da sua conta de pagamentos se o valor de {t.valor ? reais(Number(t.valor)) : ""} entrou, e confirme aqui.
              <div style={{ marginTop: 8 }}><button type="button" onClick={() => confirmarPagamento(t)}>Confirmar pagamento recebido</button></div>
            </div>
          )}
          <div className="acoes-ficha" style={{ marginTop: 12 }}>
            <Link className="btn" href={`/teleconsultas/${t.id}`}>Abrir a sala</Link>
            {whats && t.paciente_telefone && (
              <button type="button" className="btn-sec" onClick={() => enviarWhats("lembrete", t)} disabled={envio[t.id] === "Enviando"}>Enviar lembrete agora</button>
            )}
            {/* Pelo WhatsApp do próprio profissional: sempre disponível sem o automático e quando o envio automático falha. */}
            {(!whats || !t.paciente_telefone || (envio[t.id] && !/enviado|Enviando/.test(envio[t.id]))) && (
              <a className="btn btn-sec" href={linkWhatsApp(t.paciente_telefone, mensagemLembrete(t, nomeProf, link(t)))} target="_blank" rel="noreferrer">Enviar lembrete pelo meu WhatsApp</a>
            )}
            <button type="button" className="btn-sec" onClick={() => copiar(t)}>{copiado === t.id ? "Link copiado" : "Copiar link"}</button>
            <button type="button" className="link" onClick={() => cancelar(t)}>Cancelar</button>
          </div>
        </div>
      ))}

      {encerradas.length > 0 && (
        <>
          <h2>Encerradas hoje</h2>
          {encerradas.map((t) => (
            <div className="card" key={t.id}>
              <div className="row">
                <div><b>{t.paciente_nome}</b><div className="muted">{dataCurta(t.inicio)}</div></div>
                {t.registro_id ? <Link className="btn btn-sec" href={`/registro/${t.registro_id}`}>Ver ficha</Link> : <span className="muted">Ficha não salva</span>}
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}
