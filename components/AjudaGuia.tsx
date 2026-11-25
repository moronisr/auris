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

const PASSOS: Passo[] = [
  { alvo: "novo", texto: "Comece por aqui: toque em Novo registro.", aoTocar: true },
  { alvo: "modo", texto: "Escolha Ditado, se for falar sozinho depois do atendimento, ou Consulta, para gravar a conversa com o paciente." },
  { alvo: "area", texto: "Confira a sua área. O formato da ficha já vem escolhido por ela." },
  { alvo: "gravar", texto: "Toque para gravar. Quando terminar, toque em Parar e espere a ficha ficar pronta.", aoTocar: true },
  { alvo: "aprovar", texto: "Confira a ficha, corrija o que precisar e toque em Aprovar.", aoTocar: true },
  { alvo: "assinar", texto: "Aqui você assina a ficha digitalmente, para ela valer sem papel." },
  { alvo: "receita", texto: "Aqui você emite a receita com a assinatura gov.br.", opcional: true },
  { alvo: "documentos", texto: "Atestado, pedido de exames e outros documentos ficam aqui. Pronto, você já sabe o caminho." },
];

export function iniciarAjuda() {
  try {
    localStorage.setItem(CHAVE_AJUDA, "0");
    localStorage.setItem(CHAVE_AJUDA_VISTA, "1");
  } catch {}
  window.dispatchEvent(new Event("auris-ajuda"));
}

function lerPasso(): number | null {
  try {
    const v = localStorage.getItem(CHAVE_AJUDA);
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
}

export default function AjudaGuia() {
  const [passo, setPasso] = useState<number | null>(null);
  const [caixa, setCaixa] = useState<DOMRect | null>(null);

  const definir = useCallback((n: number | null) => {
    try {
      if (n === null || n >= PASSOS.length) localStorage.removeItem(CHAVE_AJUDA);
      else localStorage.setItem(CHAVE_AJUDA, String(n));
    } catch {}
    setPasso(n === null || n >= PASSOS.length ? null : n);
    setCaixa(null);
  }, []);

  // Começa (ou continua) a ajuda ao abrir a página ou quando o profissional escolhe "Sim".
  useEffect(() => {
    const atualizar = () => setPasso(lerPasso());
    atualizar();
    window.addEventListener("auris-ajuda", atualizar);
    return () => window.removeEventListener("auris-ajuda", atualizar);
  }, []);

  // Procura o botão do passo atual na tela e acompanha a posição dele.
  useEffect(() => {
    if (passo === null) return;
    const atual = PASSOS[passo];
    let rolou = false;
    let espera = 0;
    const achar = () => {
      const el = document.querySelector<HTMLElement>(`[data-ajuda="${atual.alvo}"]`);
      if (!el || el.offsetParent === null) {
        // Passo que nem sempre existe (ex.: receita só para quem pode receitar): pula sozinho.
        if (atual.opcional && document.querySelector('[data-ajuda="documentos"]') && ++espera > 4) definir(passo + 1);
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
  }, [passo, definir]);

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
