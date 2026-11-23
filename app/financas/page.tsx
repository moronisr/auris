"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CartaoAsaas, { type CartaoForm } from "@/components/CartaoAsaas";
import Recebimentos from "@/components/Recebimentos";
import { buscarSituacao, dataCurtaBR, type SituacaoAssinatura } from "@/lib/useAcesso";

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const BANDEIRA: Record<string, string> = { visa: "Visa", master: "Mastercard", amex: "American Express", elo: "Elo", hipercard: "Hipercard", debvisa: "Visa", debmaster: "Mastercard" };
const STATUS_COBRANCA: Record<string, string> = { approved: "Paga", rejected: "Recusada", cancelled: "Cancelada", refunded: "Devolvida", in_process: "Em análise", pending: "Pendente", charged_back: "Contestada no cartão", in_mediation: "Em contestação" };
const MOTIVOS = ["O preço não cabe no meu orçamento agora", "Não estou usando o suficiente", "Faltou algum recurso", "Vou usar outro sistema", "Outro motivo"];

/**
 * Finanças do profissional: duas abas.
 * Recebimentos: o que os pacientes pagaram, devolvido, contestado e a receber.
 * Plano do Auris: plano, pagamento, cobranças, upgrade e, no fim, cancelamento.
 */
export default function Financas() {
  const [s, setS] = useState<SituacaoAssinatura | null | undefined>(undefined);
  const [escolhido, setEscolhido] = useState("");
  const [modo, setModo] = useState<"" | "assinar" | "cartao" | "plano" | "remover" | "cancelar">("");
  const [salvarCartao, setSalvarCartao] = useState(true);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [aba, setAba] = useState<"" | "recebimentos" | "plano">("");

  const recarregar = async () => setS(await buscarSituacao(true));
  useEffect(() => { recarregar(); }, []);
  useEffect(() => {
    if (!s || aba) return;
    const pedida = new URLSearchParams(location.search).get("aba");
    // Com pagamento do plano pendente ou bloqueado, abre direto no plano para resolver.
    setAba(pedida === "plano" || pedida === "recebimentos" ? pedida : s.acesso === "aviso" || s.acesso === "bloqueado" ? "plano" : "recebimentos");
  }, [s, aba]);

  async function enviar(corpo: Record<string, unknown>): Promise<string | null> {
    const r = await fetch("/api/assinatura", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
    const d = await r.json().catch(() => ({}));
    return r.ok ? null : d.erro || "Não foi possível concluir. Tente de novo.";
  }
  const pronto = (texto: string) => { setModo(""); setMsg({ tipo: "ok", texto }); window.scrollTo({ top: 0, behavior: "smooth" }); recarregar(); };

  if (s === undefined) return <p className="muted">Carregando.</p>;
  if (s === null) return <p className="erro">Não foi possível carregar as suas finanças. Recarregue a página.</p>;

  const a = s.assinatura;
  const planoAtual = s.planos.find((p) => p.id === a?.plano) || null;
  const ativo = !!a?.plano && (s.acesso === "ativa" || s.acesso === "aviso" || s.acesso === "liberado") && !!a.pago_ate && new Date(a.pago_ate) > new Date(Date.now() - 7 * 864e5);
  const recorrente = !!a?.recorrente;
  const temCartao = !!a?.cartao_final;
  const plano = s.planos.find((p) => p.id === escolhido);
  const upgrades = planoAtual ? s.planos.filter((p) => !p.oculto && p.valor > planoAtual.valor) : [];
  const testeAte = s.cobrancaAtiva && s.fimTeste && new Date(s.fimTeste) > new Date() ? s.fimTeste : null;

  const selo = s.acesso === "bloqueado" ? ["Inativa", "selo-alerta"] : s.acesso === "aviso" ? ["Pagamento pendente", "selo-alerta"] : s.acesso === "teste" ? ["Teste grátis", "selo-ok"] : s.acesso === "liberado" && !a?.plano ? ["Fase de testes", "selo-ok"] : ["Ativa", "selo-ok"];

  const formCartao = (modoForm: "assinar" | "cartao", p: { id: string; nome: string; valor: number }) => (
    <div style={{ marginTop: 14 }}>
      {modoForm === "assinar" && (
        <label className="aceite">
          <input type="checkbox" checked={salvarCartao} onChange={(e) => setSalvarCartao(e.target.checked)} />
          <span><b>Salvar este cartão para renovar automaticamente todo mês</b> (recomendado). Você não precisa lembrar de pagar e não corre o risco de ter o acesso interrompido.</span>
        </label>
      )}
      <p className="muted">
        {modoForm === "cartao" ? "O novo cartão passa a ser usado nas próximas cobranças."
          : salvarCartao ? (testeAte ? `Nada é cobrado agora. A primeira cobrança de ${reais(p.valor)} é em ${dataCurtaBR(testeAte)}, e depois todo mês.` : `A cobrança de ${reais(p.valor)} é feita agora e depois todo mês, na mesma data.`)
          : `Você paga ${reais(p.valor)} agora, por 1 mês, e o cartão não fica salvo. Para continuar depois, pague de novo antes do vencimento.`}
        {" "}O cartão fica guardado no Asaas, instituição de pagamento autorizada pelo Banco Central; o Auris guarda só a bandeira e os 4 últimos números.
      </p>
      <CartaoAsaas key={`${modoForm}-${p.id}-${salvarCartao}`} email={s.email} permitirOutroTitular={modoForm === "assinar"}
        rotulo={modoForm === "cartao" ? "Salvar novo cartão" : salvarCartao ? (testeAte ? "Cadastrar cartão" : `Assinar por ${reais(p.valor)} por mês`) : `Pagar ${reais(p.valor)} por 1 mês`}
        onCartao={async (cartao: CartaoForm) => {
          if (modoForm === "cartao") { const e = await enviar({ acao: "trocar_cartao", cartao }); if (!e) pronto("Cartão atualizado."); return e; }
          const e = await enviar({ acao: salvarCartao ? "assinar" : "pagar_avulso", plano: p.id, cartao });
          if (!e) pronto(salvarCartao ? `Plano ${p.nome} ativado com renovação automática.` : `Pagamento aprovado. Plano ${p.nome} ativo por 1 mês.`);
          return e;
        }} />
    </div>
  );

  return (
    <div>
      <div className="row">
        <h1>Finanças</h1>
        <a className="btn btn-sec" href="/perfil">Voltar</a>
      </div>
      <div className="abas-login" role="tablist" aria-label="Finanças">
        <button type="button" role="tab" aria-selected={aba === "recebimentos"} className={aba === "recebimentos" ? "ativa" : ""} onClick={() => { setAba("recebimentos"); setMsg(null); }}>Recebimentos</button>
        <button type="button" role="tab" aria-selected={aba === "plano"} className={aba === "plano" ? "ativa" : ""} onClick={() => { setAba("plano"); setMsg(null); }}>Plano do Auris{s.acesso === "aviso" || s.acesso === "bloqueado" ? " (pendente)" : ""}</button>
      </div>
      {aba === "recebimentos" && <Recebimentos />}
      {aba === "plano" && <>
      {msg && <div className={msg.tipo} role="status" style={{ marginBottom: 12 }}>{msg.texto}</div>}

      {/* 1. Situação */}
      <div className="card">
        <div className="row"><b>Sua assinatura</b><span className={`selo ${selo[1]}`}>{selo[0]}</span></div>
        {a?.plano ? (
          <dl className="comprovante">
            <dt>Plano</dt><dd>{planoAtual?.nome || a.plano}{a.valor ? `, ${reais(Number(a.valor))} por mês` : ""}</dd>
            <dt>Renovação</dt><dd>{recorrente ? "Automática, no cartão" : "Manual (cartão não salvo)"}</dd>
            {recorrente && a.proxima_cobranca && <><dt>Próxima cobrança</dt><dd>{dataCurtaBR(a.proxima_cobranca)}</dd></>}
            {a.pago_ate && <><dt>{recorrente ? "Acesso garantido até" : "Vence em"}</dt><dd>{dataCurtaBR(a.pago_ate)}</dd></>}
            {a.ultimo_pagamento_em && <><dt>Último pagamento</dt><dd>{dataCurtaBR(a.ultimo_pagamento_em)}</dd></>}
          </dl>
        ) : (
          <p className="muted" style={{ marginBottom: 0 }}>{s.acesso === "teste" ? `Você está no teste grátis até ${dataCurtaBR(s.fimTeste)}. Escolha um plano para continuar sem interrupção.` : s.acesso === "liberado" ? "Fase de testes do Auris: uso liberado, sem cobrança." : "Escolha um plano para usar o Auris."}</p>
        )}
        {a?.cortesia_ate && new Date(a.cortesia_ate) > new Date() && <div className="ok" style={{ marginTop: 10 }}>Você tem acesso de cortesia ao Auris até {dataCurtaBR(a.cortesia_ate)}, sem cobrança.</div>}
        {s.acesso === "aviso" && <div className="erro" style={{ marginTop: 10 }}>{a?.falha_motivo === "chargeback"
          ? "Uma cobrança do seu plano foi contestada no cartão e o valor voltou para você. Pague de novo ou atualize o cartão abaixo para não interromper o uso. Se não reconhece a contestação, fale com o seu banco."
          : "O último pagamento não foi aprovado. Atualize o cartão abaixo para não interromper o uso."}</div>}
        {s.acesso === "bloqueado" && <div className="erro" style={{ marginTop: 10 }}>Assinatura inativa. Suas fichas e consultas continuam disponíveis para consulta e exportação. Ative um plano para voltar a registrar e atender.</div>}
        {a?.plano && !recorrente && a.pago_ate && <div className="aviso" style={{ marginTop: 10, marginBottom: 0 }}>Seu plano vence em {dataCurtaBR(a.pago_ate)}. Salve um cartão para renovar automaticamente e não ter o acesso interrompido.
          <div style={{ marginTop: 8 }}><button type="button" onClick={() => { setEscolhido(a.plano!); setSalvarCartao(true); setModo("assinar"); }}>Ativar renovação automática</button></div></div>}
      </div>

      {!s.configurada && <div className="aviso">O pagamento do plano está sendo preparado. Em breve você poderá escolher o seu plano aqui.</div>}

      {/* 2. Upgrade (sempre em destaque) */}
      {s.configurada && ativo && upgrades.length > 0 && (
        <div className="card upgrade">
          <h2 style={{ marginTop: 0 }}>Faça mais com o Auris</h2>
          <div className="planos">
            {upgrades.map((p) => (
              <div key={p.id} className="plano plano-estatico">
                <b>{p.nome}</b>
                <span className="plano-valor">{reais(p.valor)}<small> por mês</small></span>
                <span className="muted">{p.resumo}</span>
                <ul>{p.recursos.map((r) => <li key={r}>{r}</li>)}</ul>
                <button type="button" disabled={enviando} onClick={async () => {
                  if (!recorrente) { setEscolhido(p.id); setSalvarCartao(true); setModo("assinar"); return; }
                  setEnviando(true); const e = await enviar({ acao: "trocar_plano", plano: p.id }); setEnviando(false);
                  if (e) setMsg({ tipo: "erro", texto: e }); else pronto(`Upgrade feito: plano ${p.nome}. O novo valor vale a partir da próxima cobrança.`);
                }}>Fazer upgrade para {p.nome}</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Escolher plano (sem plano ativo) */}
      {s.configurada && !ativo && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Escolha o seu plano</h2>
          <p className="muted">Consultas ilimitadas em todos os planos. Pagamento no cartão de crédito.</p>
          <div className="planos">
            {s.planos.map((p) => (
              <button type="button" key={p.id} className={escolhido === p.id ? "plano ativo" : "plano"} aria-pressed={escolhido === p.id} onClick={() => { setEscolhido(p.id); setModo("assinar"); setMsg(null); }}>
                {p.destaque && <span className="plano-tag">Mais escolhido</span>}
                <b>{p.nome}</b>
                <span className="plano-valor">{reais(p.valor)}<small> por mês</small></span>
                <span className="muted">{p.resumo}</span>
                <ul>{p.recursos.map((r) => <li key={r}>{r}</li>)}</ul>
              </button>
            ))}
          </div>
          {modo === "assinar" && plano && formCartao("assinar", plano)}
          <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>Ao contratar, você concorda com os <Link href="/termos">Termos de uso</Link>. Na fatura do cartão, a cobrança aparece identificada pelo Asaas, que processa o pagamento do Auris.</p>
        </div>
      )}
      {s.configurada && ativo && modo === "assinar" && plano && <div className="card">{formCartao("assinar", plano)}</div>}

      {/* 4. Forma de pagamento */}
      {s.configurada && a?.plano && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Forma de pagamento</h2>
          {temCartao ? (
            <div className="row" style={{ alignItems: "center" }}>
              <span>Cartão de crédito <b>{BANDEIRA[a.cartao_bandeira || ""] || ""} final {a.cartao_final}</b>{!recorrente && <span className="muted"> (não salvo para renovação)</span>}</span>
            </div>
          ) : <p className="muted" style={{ margin: 0 }}>Nenhum cartão salvo.</p>}
          <div className="acoes-pequenas">
            {recorrente && <button type="button" className="link" onClick={() => { setModo(modo === "cartao" ? "" : "cartao"); setMsg(null); }}>Trocar cartão</button>}
            {!recorrente && <button type="button" className="link" onClick={() => { setEscolhido(a.plano!); setSalvarCartao(true); setModo("assinar"); }}>Salvar um cartão</button>}
            {recorrente && <button type="button" className="link" onClick={() => { setModo(modo === "remover" ? "" : "remover"); setMsg(null); }}>Remover cartão</button>}
            {ativo && <button type="button" className="link" onClick={() => { setModo(modo === "plano" ? "" : "plano"); setEscolhido(a.plano || ""); setMsg(null); }}>Mudar de plano</button>}
          </div>
          <p className="muted" style={{ marginBottom: 0 }}>Pix Automático, sem cartão: em breve.</p>

          {modo === "cartao" && planoAtual && formCartao("cartao", planoAtual)}
          {modo === "remover" && (
            <div className="aviso" style={{ marginTop: 12, marginBottom: 0 }}>
              <b>Remover o cartão?</b>
              <div style={{ marginTop: 4 }}>Sem cartão, o plano não renova sozinho. Seu acesso continua até {dataCurtaBR(a.pago_ate)}; depois disso, para continuar, será preciso pagar de novo.</div>
              <div className="acoes-ficha" style={{ marginTop: 10 }}>
                <button type="button" className="btn-sec" disabled={enviando} onClick={() => setModo("cartao")}>Trocar por outro cartão</button>
                <button type="button" className="link" disabled={enviando} onClick={async () => { setEnviando(true); const e = await enviar({ acao: "remover_cartao" }); setEnviando(false); if (e) setMsg({ tipo: "erro", texto: e }); else pronto(`Cartão removido. Seu plano continua ativo até ${dataCurtaBR(a.pago_ate)}.`); }}>Remover mesmo assim</button>
              </div>
            </div>
          )}
          {modo === "plano" && (
            <div style={{ marginTop: 12 }}>
              <div className="planos">
                {s.planos.filter((p) => !p.oculto || p.id === a.plano).map((p) => (
                  <button type="button" key={p.id} className={escolhido === p.id ? "plano ativo" : "plano"} aria-pressed={escolhido === p.id} onClick={() => setEscolhido(p.id)}>
                    {planoAtual && p.valor > planoAtual.valor && <span className="plano-tag">Upgrade</span>}
                    <b>{p.nome}</b><span>{reais(p.valor)} por mês</span>
                  </button>
                ))}
              </div>
              <p className="muted">{recorrente ? "O novo valor vale a partir da próxima cobrança." : "Para mudar de plano, salve um cartão com o novo plano."}</p>
              <button type="button" disabled={enviando || !escolhido || escolhido === a.plano} onClick={async () => {
                if (!recorrente) { setSalvarCartao(true); setModo("assinar"); return; }
                setEnviando(true); const e = await enviar({ acao: "trocar_plano", plano: escolhido }); setEnviando(false);
                if (e) setMsg({ tipo: "erro", texto: e }); else pronto("Plano alterado. O novo valor vale a partir da próxima cobrança.");
              }}>{enviando ? "Salvando" : "Confirmar plano"}</button>
            </div>
          )}
        </div>
      )}

      {/* 5. Histórico */}
      {(s.cobrancas?.length ?? 0) > 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Histórico de cobranças</h2>
          <table className="tabela-simples">
            <thead><tr><th>Data</th><th>Plano</th><th>Valor</th><th>Situação</th></tr></thead>
            <tbody>
              {s.cobrancas!.map((c, i) => (
                <tr key={i}><td>{dataCurtaBR(c.data)}</td><td>{s.planos.find((p) => p.id === c.plano)?.nome || c.plano || "-"}</td><td>{c.valor != null ? reais(Number(c.valor)) : "-"}</td><td>{STATUS_COBRANCA[c.status] || c.status}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 6. Ajuda */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Ajuda com pagamentos</h2>
        <ul className="politica-lista">
          <li><b>Pagamento recusado:</b> confira o limite com o seu banco ou troque o cartão. Você tem 7 dias de uso normal para resolver.</li>
          <li><b>Cobrança na fatura:</b> aparece identificada pelo Asaas, que processa o pagamento do Auris.</li>
          <li><b>Nota fiscal e dúvidas:</b> escreva para <a href="mailto:contato@aurismed.com.br">contato@aurismed.com.br</a>.</li>
        </ul>
      </div>

      {/* 7. Cancelamento, discreto no fim */}
      {a?.plano && recorrente && (
        <div className="cancelar-rodape">
          {modo !== "cancelar" ? (
            <button type="button" className="link link-discreto" onClick={() => { setModo("cancelar"); setMsg(null); }}>Cancelar assinatura</button>
          ) : (
            <div className="card">
              <b>Tem certeza?</b>
              <p className="muted">Ao cancelar, a partir de {dataCurtaBR(a.pago_ate)} você deixa de registrar fichas por voz, fazer teleconsultas e receber agendamentos pela sua página. Suas fichas continuam guardadas para consulta e exportação.</p>
              <label htmlFor="motivo-cancel">O que levou você a cancelar?</label>
              <select id="motivo-cancel" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                <option value="">Escolha uma opção</option>
                {MOTIVOS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <div className="acoes-ficha" style={{ marginTop: 12 }}>
                <button type="button" onClick={() => setModo("")}>Continuar com o Auris</button>
                <button type="button" className="link link-discreto" disabled={!motivo || enviando} onClick={async () => { setEnviando(true); const e = await enviar({ acao: "cancelar", motivo }); setEnviando(false); if (e) setMsg({ tipo: "erro", texto: e }); else pronto(`Assinatura cancelada. Seu acesso continua até ${dataCurtaBR(a.pago_ate)}.`); }}>{enviando ? "Cancelando" : "Confirmar cancelamento"}</button>
              </div>
            </div>
          )}
        </div>
      )}
      </>}
    </div>
  );
}
