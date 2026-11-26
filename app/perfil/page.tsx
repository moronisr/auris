"use client";
import LinkPainel from "@/components/LinkPainel";
import { iniciarAjuda } from "@/components/AjudaGuia";
import { AjudaLink } from "@/components/AjudaInicio";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { PROFISSOES, ESPECIALIDADES_MEDICAS } from "@/lib/modelos";
import { TIPOS_CHAVE, linkPagamentoValido, normalizarChave, type TipoChave } from "@/lib/pix";
import AgendaOnline from "@/components/AgendaOnline";
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
    setMsg(error ? { tipo: "erro", texto: "Não foi possível salvar: " + error.message } : { tipo: "ok", texto: "Perfil salvo." });
    if (!error) setTimeout(() => { router.push("/"); router.refresh(); }, 800);
  }

  return (
    <>
      <div className="row">
        <h1>Meu perfil</h1>
        <a className="btn btn-sec" href="/">Voltar</a>
      </div>
      <div style={{ marginTop: -6, marginBottom: 10 }}><AjudaLink roteiro="perfil" texto="Ajuda com esta página" /></div>
      <a className="card card-link" href="/financas"><b>Finanças</b><span className="muted">Seu plano, forma de pagamento, cobranças e upgrade</span></a>
      <LinkPainel />
      <button type="button" className="card card-link" style={{ width: "100%", textAlign: "left", color: "inherit", fontWeight: 400 }} onClick={() => iniciarAjuda("registro")}><b>Ajuda para usar o Auris</b><span className="muted">Passo a passo mostrando onde tocar para registrar, assinar e emitir receita</span></button>
      <form className="card" onSubmit={salvar}>
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
        <h2>Recebimento manual (teleconsultas agendadas por você)</h2>
        <p className="muted" style={{ marginTop: -4 }}>Usado quando você mesmo agenda a teleconsulta e não conectou o pagamento online (abaixo). Nesse caso, você confere o pagamento e confirma no Auris. Com o pagamento online conectado (Mercado Pago ou PagBank), a confirmação é automática.</p>
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
          <label htmlFor="cartao-link">Link de pagamento por cartão de crédito e débito</label>
          <input id="cartao-link" inputMode="url" placeholder="https://" value={cartaoLink} onChange={(e) => setCartaoLink(e.target.value)} />
          <p className="muted" style={{ marginBottom: 0 }}>Crie um link de pagamento com o valor da consulta na sua conta do Mercado Pago, PagBank, InfinitePay ou da sua maquininha, e cole aqui. O paciente paga no site desse serviço, no crédito ou no débito. Necessário para cobrar teleconsultas: o paciente sempre vê as três opções, Pix, crédito e débito.</p>
        </div>
        <div style={{ height: 14 }} />
        {msg && <div className={msg.tipo} style={{ marginBottom: 10 }}>{msg.texto}</div>}
        <button type="submit" data-ajuda="pf-salvar" style={{ width: "100%" }}>Salvar perfil</button>
      </form>
      <AgendaOnline nome={nome} />
      <ExportarProntuario />
    </>
  );
}
