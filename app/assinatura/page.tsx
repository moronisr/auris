"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CartaoBrick, { type DadosCartao } from "@/components/CartaoBrick";
import { buscarSituacao, dataCurtaBR, type SituacaoAssinatura } from "@/lib/useAcesso";

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const BANDEIRA: Record<string, string> = { visa: "Visa", master: "Mastercard", amex: "American Express", elo: "Elo", hipercard: "Hipercard" };

/** Plano e pagamento do profissional: escolher plano, cadastrar e trocar cartão, trocar plano e cancelar. */
export default function Assinatura() {
  const [s, setS] = useState<SituacaoAssinatura | null | undefined>(undefined);
  const [escolhido, setEscolhido] = useState<string>("");
  const [modo, setModo] = useState<"" | "assinar" | "cartao" | "plano" | "cancelar">("");
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const recarregar = async () => setS(await buscarSituacao(true));
  useEffect(() => { recarregar(); }, []);

  async function enviar(corpo: Record<string, unknown>): Promise<string | null> {
    const r = await fetch("/api/assinatura", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return d.erro || "Não foi possível concluir. Tente de novo.";
    return null;
  }

  if (s === undefined) return <p className="muted">Carregando.</p>;
  if (s === null) return <p className="erro">Não foi possível carregar a sua assinatura. Recarregue a página.</p>;

  const a = s.assinatura;
  const temAssinatura = !!a?.plano && a.status !== "cancelada";
  const planoAtual = s.planos.find((p) => p.id === a?.plano);
  const plano = s.planos.find((p) => p.id === escolhido);
  const testeAte = s.cobrancaAtiva && s.fimTeste && new Date(s.fimTeste) > new Date() ? s.fimTeste : null;

  const situacao = s.acesso === "liberado" ? "Fase de testes do Auris: uso liberado, sem cobrança."
    : s.acesso === "teste" ? `Teste grátis até ${dataCurtaBR(s.fimTeste)}.`
    : s.acesso === "ativa" ? (a?.status === "cancelada" ? `Cancelada. Acesso até ${dataCurtaBR(a.pago_ate)}.` : "Ativa.")
    : s.acesso === "aviso" ? "Pagamento não aprovado. Atualize o cartão para não interromper o uso."
    : "Inativa. Você pode consultar e exportar suas fichas; para registrar e atender, ative um plano.";

  return (
    <div>
      <h1>Plano e pagamento</h1>

      <div className="card">
        <div className="row"><b>Situação</b><span className={s.acesso === "bloqueado" || s.acesso === "aviso" ? "selo selo-alerta" : "selo selo-ok"}>{s.acesso === "bloqueado" ? "Inativa" : s.acesso === "aviso" ? "Pagamento pendente" : s.acesso === "teste" ? "Teste grátis" : s.acesso === "liberado" ? "Liberado" : a?.status === "cancelada" ? "Cancelada" : "Ativa"}</span></div>
        <p className="muted" style={{ marginBottom: 0 }}>{situacao}</p>
        {a?.plano && (
          <dl className="comprovante">
            <dt>Plano</dt><dd>{planoAtual?.nome || a.plano}{a.valor ? `, ${reais(Number(a.valor))} por mês` : ""}</dd>
            {a.cartao_final && <><dt>Cartão</dt><dd>{BANDEIRA[a.cartao_bandeira || ""] || "Cartão"} final {a.cartao_final}</dd></>}
            {a.proxima_cobranca && a.status !== "cancelada" && <><dt>Próxima cobrança</dt><dd>{dataCurtaBR(a.proxima_cobranca)}</dd></>}
            {a.ultimo_pagamento_em && <><dt>Último pagamento</dt><dd>{dataCurtaBR(a.ultimo_pagamento_em)}</dd></>}
            {a.pago_ate && <><dt>Acesso garantido até</dt><dd>{dataCurtaBR(a.pago_ate)}</dd></>}
          </dl>
        )}
      </div>

      {msg && <div className={msg.tipo} role="status" style={{ marginBottom: 12 }}>{msg.texto}</div>}
      {!s.configurada && <div className="aviso">A assinatura com cartão está sendo preparada. Em breve você poderá escolher o seu plano aqui.</div>}

      {s.configurada && temAssinatura && s.publicKey && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Gerenciar</h2>
          <div className="acoes-ficha">
            <button type="button" className={modo === "cartao" ? "" : "btn-sec"} onClick={() => { setModo(modo === "cartao" ? "" : "cartao"); setMsg(null); }}>Trocar cartão</button>
            <button type="button" className={modo === "plano" ? "" : "btn-sec"} onClick={() => { setModo(modo === "plano" ? "" : "plano"); setEscolhido(a?.plano || ""); setMsg(null); }}>Trocar plano</button>
            <button type="button" className="link" onClick={() => { setModo(modo === "cancelar" ? "" : "cancelar"); setMsg(null); }}>Cancelar assinatura</button>
          </div>

          {modo === "cartao" && (
            <div style={{ marginTop: 14 }}>
              <p className="muted">O novo cartão passa a ser usado nas próximas cobranças. Os dados ficam guardados no Mercado Pago; o Auris guarda só a bandeira e os 4 últimos números.</p>
              <CartaoBrick id="brick-troca" publicKey={s.publicKey} valor={Number(a?.valor || 1)} email={s.email} rotulo="Salvar novo cartão"
                onCartao={async (d: DadosCartao) => { const e = await enviar({ acao: "trocar_cartao", cartao: d }); if (!e) { setModo(""); setMsg({ tipo: "ok", texto: "Cartão atualizado." }); recarregar(); } return e; }} />
            </div>
          )}

          {modo === "plano" && (
            <div style={{ marginTop: 14 }}>
              <div className="planos">
                {s.planos.map((p) => (
                  <button type="button" key={p.id} className={escolhido === p.id ? "plano ativo" : "plano"} onClick={() => setEscolhido(p.id)} aria-pressed={escolhido === p.id}>
                    <b>{p.nome}</b><span>{reais(p.valor)} por mês</span>
                  </button>
                ))}
              </div>
              <p className="muted">O novo valor vale a partir da próxima cobrança.</p>
              <button type="button" disabled={enviando || !escolhido || escolhido === a?.plano} onClick={async () => { setEnviando(true); const e = await enviar({ acao: "trocar_plano", plano: escolhido }); setEnviando(false); if (e) setMsg({ tipo: "erro", texto: e }); else { setModo(""); setMsg({ tipo: "ok", texto: "Plano alterado. O novo valor vale a partir da próxima cobrança." }); recarregar(); } }}>{enviando ? "Salvando" : "Confirmar novo plano"}</button>
            </div>
          )}

          {modo === "cancelar" && (
            <div className="aviso" style={{ marginTop: 14 }}>
              <b>Cancelar a assinatura?</b>
              <div style={{ marginTop: 4 }}>Não haverá novas cobranças. {a?.pago_ate ? `Você continua usando normalmente até ${dataCurtaBR(a.pago_ate)}.` : ""} Depois disso, suas fichas e consultas continuam disponíveis para consulta e exportação.</div>
              <div className="acoes-ficha" style={{ marginTop: 10 }}>
                <button type="button" disabled={enviando} onClick={async () => { setEnviando(true); const e = await enviar({ acao: "cancelar" }); setEnviando(false); if (e) setMsg({ tipo: "erro", texto: e }); else { setModo(""); setMsg({ tipo: "ok", texto: "Assinatura cancelada. Nenhuma nova cobrança será feita." }); recarregar(); } }}>{enviando ? "Cancelando" : "Confirmar cancelamento"}</button>
                <button type="button" className="link" disabled={enviando} onClick={() => setModo("")}>Voltar</button>
              </div>
            </div>
          )}
        </div>
      )}

      {s.configurada && !temAssinatura && s.publicKey && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Escolha o seu plano</h2>
          <p className="muted">Consultas ilimitadas em todos os planos. Pagamento mensal no cartão de crédito, com renovação automática. Cancele quando quiser.</p>
          <div className="planos">
            {s.planos.map((p) => (
              <button type="button" key={p.id} className={escolhido === p.id ? "plano ativo" : "plano"} onClick={() => { setEscolhido(p.id); setModo("assinar"); setMsg(null); }} aria-pressed={escolhido === p.id}>
                {p.destaque && <span className="plano-tag">Mais escolhido</span>}
                <b>{p.nome}</b>
                <span className="plano-valor">{reais(p.valor)}<small> por mês</small></span>
                <span className="muted">{p.resumo}</span>
                <ul>{p.recursos.map((r) => <li key={r}>{r}</li>)}</ul>
              </button>
            ))}
          </div>
          {modo === "assinar" && plano && (
            <div style={{ marginTop: 16 }}>
              <h3 className="sub" style={{ marginTop: 0 }}>Cartão de crédito</h3>
              <p className="muted">{testeAte ? `Nada é cobrado agora. A primeira cobrança de ${reais(plano.valor)} é em ${dataCurtaBR(testeAte)}, no fim do teste grátis, e depois todo mês.` : `A primeira cobrança de ${reais(plano.valor)} é feita agora, e depois todo mês na mesma data.`} Os dados do cartão ficam guardados no Mercado Pago, com segurança; o Auris não vê nem guarda o número do cartão.</p>
              <CartaoBrick key={plano.id} id="brick-assinar" publicKey={s.publicKey} valor={plano.valor} email={s.email} rotulo={testeAte ? "Cadastrar cartão" : `Assinar por ${reais(plano.valor)} por mês`}
                onCartao={async (d: DadosCartao) => { const e = await enviar({ acao: "assinar", plano: plano.id, cartao: d }); if (!e) { setModo(""); setMsg({ tipo: "ok", texto: `Plano ${plano.nome} ativado.${testeAte ? ` A primeira cobrança é em ${dataCurtaBR(testeAte)}.` : ""}` }); recarregar(); } return e; }} />
              <p className="muted" style={{ marginTop: 10 }}>Ao assinar, você concorda com os <Link href="/termos">Termos de uso</Link>. A cobrança aparece na fatura como Mercado Pago, Auris.</p>
            </div>
          )}
        </div>
      )}

      <p className="muted" style={{ textAlign: "center" }}><Link href="/perfil">Voltar para o Perfil</Link></p>
    </div>
  );
}
