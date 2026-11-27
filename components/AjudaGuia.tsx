"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Ajuda guiada para quem está começando. Opcional: só aparece se o profissional escolher "Sim".
 * Destaca o botão certo com um contorno que pisca e uma setinha com uma frase curta.
 * O passo fica salvo no navegador, então a ajuda continua quando a página muda.
 */
export const CHAVE_AJUDA = "auris_ajuda_passo";
export const CHAVE_AJUDA_VISTA = "auris_ajuda_vista";

type Passo = {
  alvo: string;
  texto: string;
  /** Avança quando a pessoa toca no item destacado e a próxima parte aparece na tela. */
  aoTocar?: boolean;
  /** Frase mostrada enquanto a parte deste passo ainda não apareceu (ex.: aguardando o pagamento). */
  espera?: string;
  /** Ao tocar, segue para o primeiro passo seguinte que estiver na tela (ex.: abas). */
  segue?: boolean;
};

const PASSOS_REGISTRO: Passo[] = [
  { alvo: "novo", texto: "Comece por aqui: toque em Consulta presencial.", aoTocar: true },
  { alvo: "presencial-opcao", texto: "Toque em Começar a consulta.", aoTocar: true },
  { alvo: "modo", texto: "O modo que você escolheu já vem marcado aqui. Se quiser, troque entre Ditado e Consulta." },
  { alvo: "area", texto: "Confira a sua área. O formato da ficha já vem escolhido por ela." },
  { alvo: "gravar", texto: "Toque para gravar. Quando terminar, toque em Parar e espere a ficha ficar pronta.", aoTocar: true },
  { alvo: "aprovar", texto: "Confira a ficha, corrija o que precisar e toque em Aprovar.", aoTocar: true, espera: "Montando a ficha. Em alguns segundos ela aparece aqui para a sua revisão." },
  { alvo: "receita", texto: "Aqui você emite a receita com a assinatura gov.br." },
  { alvo: "assinar", texto: "Aqui você assina a ficha digitalmente, para ela valer sem papel." },
  { alvo: "documentos", texto: "Atestado, pedido de exames e outros documentos ficam aqui. Pronto, você já sabe o caminho." },
];

const PASSOS_TELE: Passo[] = [
  { alvo: "tc-paciente", texto: "Preencha o nome e o WhatsApp do paciente. É por esse número que ele recebe o link." },
  { alvo: "tc-quando", texto: "Escolha a data, a hora e a duração da consulta." },
  { alvo: "tc-valor", texto: "Se for cobrar, coloque o valor: o paciente paga pelo link antes de entrar. Vazio = sem cobrança." },
  { alvo: "tc-agendar", texto: "Toque para agendar. O Auris gera o link do paciente. Se aparecer um aviso em vermelho, corrija e toque de novo.", aoTocar: true },
  { alvo: "tc-convite", texto: "Link gerado. Envie ao paciente pelo WhatsApp ou toque em Copiar link para colar onde quiser. Pelo link ele aceita o termo, paga e entra na sala." },
  { alvo: "tc-lista", texto: "A consulta fica na sua agenda. Aqui você manda um lembrete ao paciente, copia o link de novo ou cancela. Os selos acima mostram se ele já aceitou o termo, pagou e respondeu a pré-consulta." },
  { alvo: "tc-abrir", texto: "Na hora da consulta, toque em Abrir a sala.", aoTocar: true },
  { alvo: "tc-status", texto: "Aqui você acompanha o paciente: termo aceito, pagamento, pré-consulta e se ele já chegou à sala de espera." },
  { alvo: "tc-entrar", texto: "Toque em Entrar na sala. Quando o navegador pedir, toque em Permitir para a câmera e o microfone. Se negar sem querer, toque no cadeado ao lado do endereço do site e libere os dois.", aoTocar: true },
  { alvo: "tc-controles", texto: "Aqui você liga e desliga o microfone; ao lado, a câmera. Se o paciente não te ouvir, confira se o microfone está ligado." },
  { alvo: "tc-encerrar", texto: "Ao terminar, toque em Encerrar e montar a ficha. A conversa vira a ficha para a sua revisão. Se o paciente não autorizou a IA, o botão é Encerrar consulta.", aoTocar: true },
  { alvo: "aprovar", texto: "A ficha da teleconsulta chegou. Confira, corrija o que precisar e toque em Aprovar. Pronto.", espera: "Montando a ficha da consulta. Em alguns segundos ela aparece aqui para a sua revisão." },
];

const ESPERA_PAGAMENTO = "Aguardando a confirmação do pagamento. Deixe esta página aberta: ela atualiza sozinha.";

const PASSOS_PACIENTE: Passo[] = [
  { alvo: "p-termo", texto: "Leia o termo da consulta online. Ele explica como funciona o atendimento pela internet." },
  { alvo: "p-ia", texto: "Opcional: marque se autoriza o Auris a organizar as anotações da consulta." },
  { alvo: "p-aceite", texto: "Marque aqui para concordar em ser atendido(a) online." },
  { alvo: "p-concordar", texto: "Toque em Concordar e continuar.", aoTocar: true },
  { alvo: "p-pagar", texto: "Escolha como pagar: Pix, cartão de crédito ou cartão de débito. O valor vai direto para o profissional." },
  { alvo: "p-pix", texto: "Toque para copiar o código Pix. No app do seu banco, escolha Pix, depois Pix Copia e Cola, e cole o código.", espera: ESPERA_PAGAMENTO },
  { alvo: "p-cartao", texto: "Preencha os dados do cartão e confirme. Os dados ficam só no site de pagamento seguro; o Auris não vê.", espera: ESPERA_PAGAMENTO },
  { alvo: "p-informar", texto: "Depois de pagar, toque em Já fiz o pagamento. O consultório confere e libera a sala de espera.", espera: ESPERA_PAGAMENTO },
  { alvo: "p-pago", texto: "Pagamento aprovado. Guarde o número da transação e toque em Continuar.", aoTocar: true, espera: ESPERA_PAGAMENTO },
  { alvo: "p-pre", texto: "Responda em poucas palavras o motivo da consulta, os remédios que toma e se tem alergia. O profissional lê antes da chamada." },
  { alvo: "p-pre-enviar", texto: "Toque em Enviar e ir para a sala de espera. Se preferir, toque em Prefiro falar na consulta, logo abaixo.", aoTocar: true },
  { alvo: "p-testar", texto: "Toque em Testar câmera e microfone. Quando o celular perguntar, toque em Permitir. Se aparecer um erro, toque no cadeado ao lado do endereço do site e libere a câmera e o microfone.", aoTocar: true },
  { alvo: "p-entrar", texto: "Você aparece na tela? Então toque em Entrar na sala de espera.", aoTocar: true },
  { alvo: "p-controles", texto: "Pronto, você está na sala. Aqui você liga e desliga o microfone e a câmera. Deixe esta tela aberta: o profissional entra no horário marcado." },
];

const PASSOS_PERFIL: Passo[] = [
  { alvo: "pf-abas", texto: "O perfil está dividido em quatro partes. Vamos passar por cada uma." },
  { alvo: "pf-aba-dados", texto: "Toque em Meus dados.", aoTocar: true, segue: true },
  { alvo: "pf-dados", texto: "Confira seu nome, profissão, especialidade e registro no conselho. Eles aparecem nas fichas e receitas." },
  { alvo: "pf-salvar", texto: "Toque em Salvar e depois em Próximo." },
  { alvo: "pf-aba-recebimento", texto: "Toque em Recebimento.", aoTocar: true, segue: true },
  { alvo: "pf-pix", texto: "Coloque a sua chave Pix, o nome e a cidade da conta. O Auris monta o código Pix para o paciente." },
  { alvo: "pf-cartao", texto: "Para receber no cartão: crie um link de pagamento no app do seu banco ou maquininha e cole aqui. Depois toque em Salvar." },
  { alvo: "pf-online", texto: "Conecte o Mercado Pago para o pagamento ser confirmado sozinho." },
  { alvo: "pf-aba-pagina", texto: "Toque em Minha página.", aoTocar: true, segue: true },
  { alvo: "pf-link", texto: "Este é o link da sua página. Escolha um nome simples, como dra-ana." },
  { alvo: "pf-valor", texto: "Coloque o valor, a duração e com quanta antecedência o paciente pode marcar." },
  { alvo: "pf-cancelar", texto: "Defina até quando o paciente pode cancelar e receber o valor de volta." },
  { alvo: "pf-abrir", texto: "Marque para abrir a agenda. Fechada, ninguém marca." },
  { alvo: "pf-salvar-agenda", texto: "Toque em Salvar e depois em Próximo." },
  { alvo: "pf-divulgar", texto: "Veja como o paciente vê a sua página ou copie o link para divulgar.", espera: "Depois de salvar, aparecem aqui os botões para ver e copiar o seu link." },
  { alvo: "pf-aba-horarios", texto: "Toque em Horários.", aoTocar: true, segue: true },
  { alvo: "pf-calendario", texto: "Toque num dia do calendário. Os dias que já passaram ficam apagados; o ponto verde marca os dias com atendimento." },
  { alvo: "pf-dia", texto: "Marque se atende toda semana nesse dia, dê folga só nesta data ou abra um horário extra.", espera: "Toque num dia do calendário para ver as opções." },
  { alvo: "pf-salvar-horarios", texto: "Toque em Salvar horários. Pronto." },
];

const PASSOS_FINANCAS: Passo[] = [
  { alvo: "fi-abas", texto: "Em Recebimentos você vê o que os pacientes pagaram nas teleconsultas. Em Plano do Auris ficam o seu plano e a forma de pagamento." },
  { alvo: "fi-plano", texto: "Toque em Plano do Auris.", aoTocar: true, segue: true },
  { alvo: "fi-escolher", texto: "Escolha o seu plano. Todos têm consultas ilimitadas; o Max libera todos os recursos." },
  { alvo: "fi-pagar", texto: "Escolha cartão de crédito ou Pix Automático e preencha os dados. A cobrança é feita todo mês sozinha, sem você precisar lembrar." },
  { alvo: "fi-forma", texto: "Aqui ficam o seu cartão e o seu plano. Use Trocar cartão, Remover cartão ou Mudar de plano quando precisar." },
  { alvo: "fi-historico", texto: "Aqui ficam todas as cobranças do Auris, com data, valor e situação." },
];

const PASSOS_DIA: Passo[] = [
  { alvo: "dia-data", texto: "Escolha a data. A página mostra todos os atendimentos registrados nesse dia." },
  { alvo: "dia-pdf", texto: "Toque para salvar o PDF com todas as fichas do dia, para o seu arquivo." },
  { alvo: "dia-lista", texto: "Aqui está o resumo do dia, com a hora e o nome de cada paciente. Logo abaixo vêm as fichas completas." },
];

const PASSOS_AGENDAR: Passo[] = [
  { alvo: "ag-horario", texto: "Escolha o dia e toque no horário que preferir. Os horários são de Brasília." },
  { alvo: "ag-dados", texto: "Preencha o seu nome completo e o WhatsApp com DDD. É por ele que você recebe o link da consulta." },
  { alvo: "ag-continuar", texto: "Toque em Continuar para o pagamento. O horário fica reservado por 30 minutos enquanto você paga.", aoTocar: true },
  ...PASSOS_PACIENTE,
];

export type Roteiro = "registro" | "tele" | "paciente" | "perfil" | "financas" | "dia" | "agendar";
const ROTEIROS: Record<string, Passo[]> = {
  registro: PASSOS_REGISTRO, tele: PASSOS_TELE, paciente: PASSOS_PACIENTE,
  perfil: PASSOS_PERFIL, financas: PASSOS_FINANCAS, dia: PASSOS_DIA, agendar: PASSOS_AGENDAR,
};
const ROTEIROS_PACIENTE = ["paciente", "agendar"];
type Estado = { roteiro: string; passo: number };

export function iniciarAjuda(roteiro: Roteiro = "registro") {
  try {
    localStorage.setItem(CHAVE_AJUDA, `${roteiro}:0`);
    if (!ROTEIROS_PACIENTE.includes(roteiro)) localStorage.setItem(CHAVE_AJUDA_VISTA, "1");
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

/** O item do passo que está visível na tela agora (pode haver mais de um com o mesmo nome). */
function alvoVisivel(passo: Passo | undefined): HTMLElement | null {
  if (!passo) return null;
  const todos = document.querySelectorAll<HTMLElement>(`[data-ajuda="${passo.alvo}"]`);
  for (const el of todos) if (el.offsetParent !== null) return el;
  return null;
}

export default function AjudaGuia() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const PASSOS = estado ? ROTEIROS[estado.roteiro] : PASSOS_REGISTRO;
  const passo = estado ? estado.passo : null;
  const [caixa, setCaixa] = useState<DOMRect | null>(null);
  const [solto, setSolto] = useState(false);
  const [textoSolto, setTextoSolto] = useState("");
  const caminho = usePathname() ?? "";

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

  // Primeiro passo à frente cuja parte já está na tela.
  const proximoVisivel = useCallback((de: number) => {
    for (let i = de + 1; i < PASSOS.length; i++) if (alvoVisivel(PASSOS[i])) return i;
    return -1;
  }, [PASSOS]);

  const avancar = useCallback(() => {
    if (passo === null) return;
    const i = proximoVisivel(passo);
    definir(i >= 0 ? i : passo + 1);
  }, [passo, proximoVisivel, definir]);

  // Procura o item do passo atual e acompanha a posição dele. A ajuda nunca some sozinha:
  // se a parte do passo ainda não apareceu, mostra um aviso fixo até ela aparecer.
  useEffect(() => {
    if (passo === null) return;
    const atual = PASSOS[passo];
    if (!atual) return;
    let rolou = false;
    let tocado = false;
    let faltas = 0;
    const marca = `${estado?.roteiro}:${passo}`;
    // "Já visto" fica salvo, para voltar junto mesmo quando a página recarrega (ex.: Voltar à agenda).
    let visto = (() => { try { return localStorage.getItem("auris_ajuda_visto") === marca; } catch { return false; } })();
    const achar = () => {
      // Tocou no item destacado: segue quando a parte seguinte aparecer (se der erro, continua aqui).
      if (tocado && alvoVisivel(PASSOS[passo + 1])) return definir(passo + 1);
      if (tocado && atual.segue) { const i = proximoVisivel(passo); if (i >= 0) return definir(i); }
      const el = alvoVisivel(atual);
      if (!el) {
        // A pessoa já está mais adiante (outra tela ou outra etapa): pula para o passo que está na tela.
        const i = proximoVisivel(passo);
        if (i >= 0) return definir(i);
        // A pessoa voltou uma tela (ex.: Voltar à agenda, outra forma de pagamento): volta junto.
        // Espera uns 2 segundos a página terminar de carregar, para voltar ao passo certo.
        if (visto && !tocado && ++faltas > 5) {
          for (let j = passo - 1; j >= 0; j--) if (alvoVisivel(PASSOS[j])) return definir(j);
        }
        setTextoSolto(atual.espera ?? (tocado ? PASSOS[passo + 1]?.espera : undefined) ?? "Continue nesta tela. Quando a próxima parte aparecer, a ajuda mostra onde tocar.");
        setCaixa(null);
        setSolto(true);
        return;
      }
      faltas = 0;
      if (!visto) { visto = true; try { localStorage.setItem("auris_ajuda_visto", marca); } catch {} }
      setSolto(false);
      if (!rolou) { el.scrollIntoView({ block: "center", behavior: "smooth" }); rolou = true; }
      setCaixa(el.getBoundingClientRect());
    };
    achar();
    const t = window.setInterval(achar, 400);
    window.addEventListener("scroll", achar, true);
    window.addEventListener("resize", achar);
    const aoClicar = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return;
      // Botões que terminam o caminho sem a etapa seguinte (ex.: Encerrar sem ficha): a ajuda termina.
      if (e.target.closest("[data-ajuda-fim]")) { definir(null); return; }
      if (!atual.aoTocar) return;
      const el = alvoVisivel(atual);
      if (el && el.contains(e.target)) { tocado = true; window.setTimeout(achar, 300); }
    };
    document.addEventListener("click", aoClicar, true);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("scroll", achar, true);
      window.removeEventListener("resize", achar);
      document.removeEventListener("click", aoClicar, true);
    };
  }, [passo, definir, PASSOS, proximoVisivel, estado?.roteiro]);

  if (passo === null) return null;
  // A ajuda do paciente só aparece na página do paciente, e a do profissional só fora dela.
  const paginaPaciente = caminho.startsWith("/t/") || !!document.querySelector("[data-publico]");
  if (ROTEIROS_PACIENTE.includes(estado?.roteiro ?? "") !== paginaPaciente) return null;
  if (!caixa) {
    if (!solto) return null;
    const p = PASSOS[passo];
    return (
      <div className="ajuda-balao ajuda-solto" role="dialog" aria-label="Ajuda">
        <div className="ajuda-contador">Passo {passo + 1} de {PASSOS.length}</div>
        <p>{textoSolto || p?.espera}</p>
        <div className="ajuda-acoes">
          <button type="button" className="ajuda-sair" onClick={() => definir(null)}>Sair da ajuda</button>
        </div>
      </div>
    );
  }
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
            <button type="button" className="ajuda-proximo" onClick={avancar}>{ultimo ? "Concluir" : "Próximo"}</button>
          )}
        </div>
      </div>
    </>
  );
}
