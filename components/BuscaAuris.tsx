"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { iniciarAjuda } from "./AjudaGuia";

/**
 * Busca das funções do Auris (não busca pacientes).
 * A pessoa digita com as palavras dela ("cartão", "gravar", "agenda") e toca no atalho.
 */
type Atalho = { titulo: string; desc: string; href?: string; acao?: "ajuda" | "ajuda-tele"; palavras: string };

const ATALHOS: Atalho[] = [
  { titulo: "Novo registro", desc: "Gravar um atendimento por voz", href: "/novo", palavras: "gravar gravacao audio ditado ditar microfone consulta conversa registrar registro ficha nova atendimento" },
  { titulo: "Teleconsultas", desc: "Agendar e atender por vídeo", href: "/teleconsultas", palavras: "teleconsulta video online chamada telemedicina agendar agendamento link sala paciente remoto" },
  { titulo: "Agenda online", desc: "Horários que o paciente pode marcar sozinho", href: "/perfil#agenda-online", palavras: "agenda horario horarios marcar disponibilidade semana folga" },
  { titulo: "Finanças", desc: "Meu plano, cartão, Pix e cobranças", href: "/financas", palavras: "financas financeiro cartao credito plano pagamento pagar pix cobranca assinatura mensalidade upgrade trocar cancelar fatura valor preco" },
  { titulo: "Recebimentos das consultas", desc: "Pagamentos dos pacientes nas teleconsultas", href: "/financas", palavras: "recebimentos receber recebido dinheiro paciente pagou extrato" },
  { titulo: "PDF do dia", desc: "Todos os atendimentos de um dia em PDF", href: "/dia", palavras: "pdf dia atendimentos relatorio imprimir impressao diario lista" },
  { titulo: "Receita, atestado e assinatura", desc: "Abra a ficha do paciente em Últimos pacientes", href: "/#ultimos-pacientes", palavras: "receita receituario prescricao atestado pedido exame exames encaminhamento documento documentos assinar assinatura govbr gov icp certificado" },
  { titulo: "Meu perfil", desc: "Nome, registro no conselho e especialidade", href: "/perfil", palavras: "perfil dados nome crm conselho registro especialidade conta" },
  { titulo: "Pagamento das teleconsultas", desc: "Chave Pix e link de cartão para o paciente pagar", href: "/perfil", palavras: "chave pix link cartao paciente pagar consulta cobrar recebimento" },
  { titulo: "Exportar prontuário", desc: "Baixar todas as fichas", href: "/perfil#exportar", palavras: "exportar exportacao backup baixar copia prontuario todas fichas guardar" },
  { titulo: "Ajuda para usar o Auris", desc: "Passo a passo mostrando onde tocar", acao: "ajuda", palavras: "ajuda tutorial como usar comecar duvida passo guia" },
  { titulo: "Ajuda para fazer uma teleconsulta", desc: "Agendar, mandar o link, entrar na sala e encerrar", acao: "ajuda-tele", palavras: "ajuda teleconsulta video online sala link paciente camera microfone como usar tutorial" },
  { titulo: "Como a IA funciona", desc: "O que a IA faz e o que não faz", href: "/ia", palavras: "ia inteligencia artificial como funciona seguranca" },
  { titulo: "Privacidade", desc: "Como os dados são tratados", href: "/privacidade", palavras: "privacidade lgpd dados protecao" },
  { titulo: "Termos de uso", desc: "Regras de uso do Auris", href: "/termos", palavras: "termos uso contrato regras cancelamento" },
];

const normalizar = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ");

export default function BuscaAuris() {
  const [aberta, setAberta] = useState(false);
  const [texto, setTexto] = useState("");
  const campo = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => { if (aberta) setTimeout(() => campo.current?.focus(), 30); else setTexto(""); }, [aberta]);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAberta(false); };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);

  const resultados = useMemo(() => {
    const termos = normalizar(texto).split(" ").filter(Boolean);
    if (!termos.length) return [];
    return ATALHOS.filter((a) => {
      const palavras = normalizar(`${a.titulo} ${a.palavras}`).split(" ");
      return termos.every((t) => palavras.some((p) => p.startsWith(t)));
    }).slice(0, 6);
  }, [texto]);

  const abrir = (a: Atalho) => {
    setAberta(false);
    if (a.acao === "ajuda") { router.push("/"); setTimeout(() => iniciarAjuda("registro"), 400); return; }
    if (a.acao === "ajuda-tele") { router.push("/teleconsultas"); setTimeout(() => iniciarAjuda("tele"), 400); return; }
    if (a.href) router.push(a.href);
  };

  return (
    <>
      <button type="button" className="busca-botao" aria-label="Buscar no Auris" onClick={() => setAberta(true)}>
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      </button>
      {aberta && (
        <div className="busca-fundo" onClick={() => setAberta(false)}>
          <div className="busca-painel" role="dialog" aria-label="Buscar no Auris" onClick={(e) => e.stopPropagation()}>
            <div className="busca-campo">
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input
                ref={campo}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && resultados[0]) abrir(resultados[0]); }}
                placeholder="O que você procura? Ex.: gravar, cartão, agenda"
                aria-label="O que você procura?"
              />
              <button type="button" className="busca-fechar" onClick={() => setAberta(false)}>Fechar</button>
            </div>
            {texto.trim() && (
              resultados.length ? (
                <ul className="busca-lista">
                  {resultados.map((a) => (
                    <li key={a.titulo}>
                      <button type="button" onClick={() => abrir(a)}>
                        <b>{a.titulo}</b>
                        <span className="muted">{a.desc}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted busca-vazia">Não encontrei. Tente outra palavra ou abra a <button type="button" className="ajuda-link" onClick={() => abrir(ATALHOS.find((x) => x.acao === "ajuda")!)}>ajuda passo a passo</button>.</p>
              )
            )}
          </div>
        </div>
      )}
    </>
  );
}
