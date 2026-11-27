"use client";
import LinkPainel from "@/components/LinkPainel";
import { AjudaLink } from "@/components/AjudaInicio";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { PROFISSOES, ESPECIALIDADES_MEDICAS } from "@/lib/modelos";
import { TIPOS_CHAVE, linkPagamentoValido, normalizarChave, type TipoChave } from "@/lib/pix";
import AgendaOnline, { type ParteAgenda } from "@/components/AgendaOnline";
import ExportarProntuario from "@/components/ExportarProntuario";
import { SIGLA_CONSELHO, grupoProfissao } from "@/lib/conselhos";

export default function Perfil() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [profissao, setProfissao] = useState(PROFISSOES[0]);
  const [especialidade, setEspecialidade] = useState("Clínica médica");
  const [conselho, setConselho] = useState("");
  const [preferencias, setPreferencias] = useState("");
  const [pixTipo, setPixTipo] = useState<TipoChave>("cpf_cnpj");
  const [pixChave, setPixChave] = useState("");
  const [pixNome, setPixNome] = useState("");
  const [pixCidade, setPixCidade] = useState("");
  const [cartaoLink, setCartaoLink] = useState("");
  const [msg, setMsg] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [id, setId] = useState<string | null>(null);
  type Aba = "dados" | "recebimento" | "pagina" | "horarios";
  const [aba, setAba] = useState<Aba>("dados");
  // A aba fica no endereço (#recebimento, #pagina, #horarios), para links e para a volta do Mercado Pago.
  useEffect(() => {
    const ler = () => {
      const h = window.location.hash.replace("#", "");
      if (h === "agenda-online" || h === "pagina") setAba("pagina");
      else if (h === "recebimento" || new URLSearchParams(window.location.search).get("mp")) setAba("recebimento");
      else if (h === "horarios") setAba("horarios");
    };
    ler();
    window.addEventListener("hashchange", ler);
    return () => window.removeEventListener("hashchange", ler);
  }, []);
  const irPara = (a: Aba) => { setAba(a); setMsg(null); window.history.replaceState(null, "", a === "dados" ? "/perfil" : `/perfil#${a}`); };

  useEffect(() => {
    (async () => {
      const sb = supabaseBrowser();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      setId(user.id);
      const { data } = await sb.from("profissionais").select("*").eq("id", user.id).maybeSingle();
      if (data) {
        setNome(data.nome ?? "");
        setProfissao(data.profissao ?? PROFISSOES[0]);
        setEspecialidade(data.especialidade ?? "");
        setConselho(data.conselho ?? "");
        setPreferencias(data.preferencias ?? "");
        setPixTipo((data.pix_tipo as TipoChave) ?? "cpf_cnpj");
        setPixChave(data.pix_chave ?? "");
        setPixNome(data.pix_nome ?? "");
        setPixCidade(data.pix_cidade ?? "");
        setCartaoLink(data.cartao_link ?? "");
      }
    })();
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    let chave: string | null = null;
    if (pixChave.trim()) {
      chave = normalizarChave(pixTipo, pixChave);
      if (!chave) return setMsg({ tipo: "erro", texto: "A chave Pix não está no formato certo para o tipo escolhido." });
      if (!pixNome.trim() || !pixCidade.trim()) return setMsg({ tipo: "erro", texto: "Para receber por Pix, informe o nome do titular da conta e a cidade." });
    }
    const link = cartaoLink.trim() ? linkPagamentoValido(cartaoLink) : null;
    if (cartaoLink.trim() && !link) return setMsg({ tipo: "erro", texto: "O link de pagamento por cartão precisa começar com https://" });
    const { error } = await supabaseBrowser().from("profissionais").upsert({
      cartao_link: link,
      id, nome, profissao, especialidade, conselho, preferencias,
      pix_tipo: chave ? pixTipo : null, pix_chave: chave, pix_nome: chave ? pixNome.trim() : null, pix_cidade: chave ? pixCidade.trim() : null,
    });
    setMsg(error ? { tipo: "erro", texto: "Não foi possível salvar: " + error.message } : { tipo: "ok", texto: "Salvo." });
    if (!error) router.refresh();
  }

  const ABAS: [Aba, string][] = [["dados", "Meus dados"], ["recebimento", "Recebimento"], ["pagina", "Minha página"], ["horarios", "Horários"]];
  return (
    <>
      <h1 style={{ marginBottom: 6 }}>Perfil</h1>
      <div style={{ marginBottom: 12 }}><AjudaLink roteiro="perfil" texto="Ajuda com esta página" /></div>
      <div className="abas-perfil" role="tablist" aria-label="Partes do perfil" data-ajuda="pf-abas">
        {ABAS.map(([k, r]) => (
          <button key={k} type="button" role="tab" aria-selected={aba === k} className={aba === k ? "ativa" : ""} data-ajuda={`pf-aba-${k}`} onClick={() => irPara(k)}>{r}</button>
        ))}
      </div>
      {(aba === "dados" || aba === "recebimento") && (
      <form className="card" onSubmit={salvar}>
        {aba === "dados" && <>
        <label>Nome completo</label>
        <input data-ajuda="pf-dados" value={nome} onChange={(e) => setNome(e.target.value)} required />
        <div className="grid" style={{ marginTop: 10 }}>
          <div>
            <label>Profissão</label>
            <select value={profissao} onChange={(e) => { setProfissao(e.target.value); if (e.target.value !== "Médico(a)") setEspecialidade(""); else setEspecialidade("Clínica médica"); }}>
              {PROFISSOES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label>Especialidade</label>
            {profissao === "Médico(a)" ? (
              <select value={especialidade} onChange={(e) => setEspecialidade(e.target.value)}>
                {ESPECIALIDADES_MEDICAS.map((s) => <option key={s}>{s}</option>)}
              </select>
            ) : (
              <>
                <input list="lista-especialidades" placeholder="Opcional" value={especialidade} onChange={(e) => setEspecialidade(e.target.value)} />
                <datalist id="lista-especialidades">
                  {(profissao === "Dentista" ? ["Harmonização orofacial", "Dentística (estética)", "Clínico geral", "Ortodontia", "Implantodontia", "Endodontia", "Periodontia", "Prótese dentária", "Odontopediatria", "Cirurgia bucomaxilofacial"]
                    : grupoProfissao(profissao) === "psicologia" ? ["Psicologia clínica", "Terapia cognitivo-comportamental", "Psicanálise", "Neuropsicologia", "Psicologia infantil", "Terapia de casal e família"] : []).map((x) => <option key={x} value={x} />)}
                </datalist>
              </>
            )}
          </div>
          <div>
            <label>Registro no conselho</label>
            <input placeholder={`Ex.: ${SIGLA_CONSELHO[grupoProfissao(profissao)] === "conselho profissional" ? "registro" : SIGLA_CONSELHO[grupoProfissao(profissao)]}-PA 12345`} value={conselho} onChange={(e) => setConselho(e.target.value)} />
          </div>
        </div>
        <div style={{ height: 10 }} />
        <label>Preferências de escrita (opcional)</label>
        <textarea rows={3} placeholder="Ex.: usar abreviações HAS e DM; escrever conduta em tópicos; não usar termos em inglês." value={preferencias} onChange={(e) => setPreferencias(e.target.value)} />
        <p className="muted">A IA segue estas preferências em todos os seus registros.</p>
        </>}
        {aba === "recebimento" && <>
        <h3 className="sub" style={{ marginTop: 0 }}>Pix</h3>
        <p className="muted" style={{ marginTop: -4 }}>Para as teleconsultas que você mesmo agenda.</p>
        <div className="grid" data-ajuda="pf-pix">
          <div>
            <label htmlFor="pix-tipo">Tipo de chave Pix</label>
            <select id="pix-tipo" value={pixTipo} onChange={(e) => setPixTipo(e.target.value as TipoChave)}>
              {TIPOS_CHAVE.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="pix-chave">Chave Pix</label>
            <input id="pix-chave" value={pixChave} onChange={(e) => setPixChave(e.target.value)} />
          </div>
          <div>
            <label htmlFor="pix-nome">Nome do titular da conta</label>
            <input id="pix-nome" value={pixNome} onChange={(e) => setPixNome(e.target.value)} />
          </div>
          <div>
            <label htmlFor="pix-cidade">Cidade da conta</label>
            <input id="pix-cidade" value={pixCidade} onChange={(e) => setPixCidade(e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 14 }} data-ajuda="pf-cartao">
          <label htmlFor="cartao-link">Link de pagamento (crédito e débito)</label>
          <input id="cartao-link" inputMode="url" placeholder="https://" value={cartaoLink} onChange={(e) => setCartaoLink(e.target.value)} />
          <p className="muted" style={{ marginBottom: 0 }}>Crie no app do seu banco ou maquininha, com o valor da consulta, e cole aqui.</p>
        </div>
        <div style={{ height: 14 }} />
        {msg && <div className={msg.tipo} style={{ marginBottom: 10 }}>{msg.texto}</div>}
        </>}
        <button type="submit" data-ajuda="pf-salvar" style={{ width: "100%" }}>Salvar</button>
      </form>
      )}
      {(aba === "recebimento" || aba === "pagina" || aba === "horarios") && <AgendaOnline key={aba} nome={nome} parte={(aba === "recebimento" ? "pagamento" : aba) as ParteAgenda} />}
      {aba === "dados" && (
        <>
          <a className="card card-link" href="/financas"><b>Finanças</b><span className="muted">Plano, cartão e cobranças</span></a>
          <LinkPainel />
          <ExportarProntuario />
        </>
      )}
    </>
  );
}
