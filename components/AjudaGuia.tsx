"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Ajuda guiada para quem está começando. Opcional: só aparece se o profissional escolher "Sim".
 * Destaca o botão certo com um contorno que pisca e uma setinha com uma frase curta.
 * O passo fica salvo no navegador, então a ajuda continua quando a página muda.
 */
export const CHAVE_AJUDA = "auris_ajuda_passo";
export const CHAVE_AJUDA_VISTA = "auris_ajuda_vista";

type Passo = { alvo: string; texto: string; aoTocar?: boolean; opcional?: boolean };

const PASSOS_REGISTRO: Passo[] = [
  { alvo: "novo", texto: "Comece por aqui: toque em Novo registro.", aoTocar: true },
  { alvo: "modo", texto: "Escolha Ditado, se for falar sozinho depois do atendimento, ou Consulta, para gravar a conversa com o paciente." },
  { alvo: "area", texto: "Confira a sua área. O formato da ficha já vem escolhido por ela." },
  { alvo: "gravar", texto: "Toque para gravar. Quando terminar, toque em Parar e espere a ficha ficar pronta.", aoTocar: true },
  { alvo: "aprovar", texto: "Confira a ficha, corrija o que precisar e toque em Aprovar.", aoTocar: true },
  { alvo: "receita", texto: "Aqui você emite a receita com a assinatura gov.br.", opcional: true },
  { alvo: "assinar", texto: "Aqui você assina a ficha digitalmente, para ela valer sem papel." },
  { alvo: "documentos", texto: "Atestado, pedido de exames e outros documentos ficam aqui. Pronto, você já sabe o caminho." },
];

const PASSOS_TELE: Passo[] = [
  { alvo: "tc-paciente", texto: "Preencha o nome e o WhatsApp do paciente. É por esse número que ele recebe o link." },
  { alvo: "tc-quando", texto: "Escolha a data, a hora e a duração da consulta." },
  { alvo: "tc-valor", texto: "Se for cobrar, coloque o valor: o paciente paga pelo link antes de entrar. Vazio = sem cobrança." },
  { alvo: "tc-agendar", texto: "Toque para agendar. O Auris gera o link do paciente.", aoTocar: true },
  { alvo: "tc-convite", texto: "Envie o link ao paciente pelo WhatsApp ou copie. Pelo link ele aceita o termo, paga e entra na sala." },
  { alvo: "tc-abrir", texto: "Na hora da consulta, toque em Abrir a sala.", aoTocar: true },
  { alvo: "tc-entrar", texto: "Toque em Entrar na sala. Quando o navegador pedir a câmera e o microfone, toque em Permitir.", aoTocar: true },
  { alvo: "tc-controles", texto: "Aqui e no botão ao lado você liga e desliga o microfone e a câmera. Se o paciente não te ouvir, confira se o microfone está ligado." },
  { alvo: "tc-encerrar", texto: "Ao terminar, toque em Encerrar e montar a ficha. A conversa vira a ficha para a sua revisão. Pronto." },
];

const ROTEIROS: Record<string, Passo[]> = { registro: PASSOS_REGISTRO, tele: PASSOS_TELE };
type Estado = { roteiro: string; passo: number };

export function iniciarAjuda(roteiro: "registro" | "tele" = "registro") {
  try {
    localStorage.setItem(CHAVE_AJUDA, `${roteiro}:0`);
    localStorage.setItem(CHAVE_AJUDA_VISTA, "1");
  } catch {}
  window.dispatchEvent(new Event("auris-ajuda"));
}

function lerEstado(): Estado | null {
  try {
    const v = localStorage.getItem(CHAVE_AJUDA);
    if (v === null) return null;
    const [roteiro, n] = v.includes(":") ? v.split(":") : ["registro", v];
    return ROTEIROS[roteiro] ? { roteiro, passo: Number(n) || 0 } : null;
  } catch {
    return null;
  }
}

export default function AjudaGuia() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const PASSOS = estado ? ROTEIROS[estado.roteiro] : PASSOS_REGISTRO;
  const passo = estado ? estado.passo : null;
  const [caixa, setCaixa] = useState<DOMRect | null>(null);

  const definir = useCallback((n: number | null) => {
    setEstado((atual) => {
      const fim = !atual || n === null || n >= ROTEIROS[atual.roteiro].length;
      try {
        if (fim) localStorage.removeItem(CHAVE_AJUDA);
        else localStorage.setItem(CHAVE_AJUDA, `${atual!.roteiro}:${n}`);
      } catch {}
      return fim ? null : { roteiro: atual!.roteiro, passo: n! };
    });
    setCaixa(null);
  }, []);

  // Começa (ou continua) a ajuda ao abrir a página ou quando o profissional escolhe "Sim".
  useEffect(() => {
    const atualizar = () => setEstado(lerEstado());
    atualizar();
    window.addEventListener("auris-ajuda", atualizar);
    return () => window.removeEventListener("auris-ajuda", atualizar);
  }, []);

  // Procura o botão do passo atual na tela e acompanha a posição dele.
  useEffect(() => {
    if (passo === null) return;
    const atual = PASSOS[passo];
    if (!atual) return;
    let rolou = false;
    let espera = 0;
    const achar = () => {
      const el = document.querySelector<HTMLElement>(`[data-ajuda="${atual.alvo}"]`);
      if (!el || el.offsetParent === null) {
        // Passo que nem sempre existe (ex.: receita só para quem pode receitar): pula sozinho.
        if (atual.opcional && document.querySelector('[data-ajuda="assinar"]') && ++espera > 4) definir(passo + 1);
        setCaixa(null);
        return;
      }
      if (!rolou) { el.scrollIntoView({ block: "center", behavior: "smooth" }); rolou = true; }
      setCaixa(el.getBoundingClientRect());
    };
    achar();
    const t = window.setInterval(achar, 400);
    window.addEventListener("scroll", achar, true);
    window.addEventListener("resize", achar);
    // Passos que avançam quando o profissional toca no botão destacado.
    const aoClicar = (e: MouseEvent) => {
      if (!atual.aoTocar) return;
      const el = document.querySelector(`[data-ajuda="${atual.alvo}"]`);
      if (el && e.target instanceof Node && el.contains(e.target)) definir(passo + 1);
    };
    document.addEventListener("click", aoClicar, true);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("scroll", achar, true);
      window.removeEventListener("resize", achar);
      document.removeEventListener("click", aoClicar, true);
    };
  }, [passo, definir, PASSOS]);

  if (passo === null || !caixa) return null;
  const atual = PASSOS[passo];
  const ultimo = passo === PASSOS.length - 1;

  const largura = Math.min(320, window.innerWidth - 24);
  const abaixo = caixa.bottom + 150 < window.innerHeight;
  const esquerda = Math.max(12, Math.min(caixa.left + caixa.width / 2 - largura / 2, window.innerWidth - largura - 12));
  const setaX = Math.max(18, Math.min(caixa.left + caixa.width / 2 - esquerda, largura - 18));
  const folga = 6;

  return (
    <>
      <div
        className="ajuda-destaque"
        style={{ top: caixa.top - folga, left: caixa.left - folga, width: caixa.width + folga * 2, height: caixa.height + folga * 2 }}
      />
      <div
        className={`ajuda-balao ${abaixo ? "abaixo" : "acima"}`}
        role="dialog"
        aria-label="Ajuda"
        style={{ left: esquerda, width: largura, ...(abaixo ? { top: caixa.bottom + 14 } : { bottom: window.innerHeight - caixa.top + 14 }) }}
      >
        <span className="ajuda-seta" style={{ left: setaX }} />
        <div className="ajuda-contador">Passo {passo + 1} de {PASSOS.length}</div>
        <p>{atual.texto}</p>
        <div className="ajuda-acoes">
          <button type="button" className="ajuda-sair" onClick={() => definir(null)}>Sair da ajuda</button>
          {!atual.aoTocar && (
            <button type="button" className="ajuda-proximo" onClick={() => definir(passo + 1)}>{ultimo ? "Concluir" : "Próximo"}</button>
          )}
        </div>
      </div>
    </>
  );
}
