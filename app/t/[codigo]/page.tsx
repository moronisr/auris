"use client";
import { use, useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import Link from "next/link";
import CartaoMP from "@/components/CartaoMP";
import { AjudaLink } from "@/components/AjudaInicio";
import RemarcarConsulta from "@/components/RemarcarConsulta";
import EscolhaPaciente from "@/components/EscolhaPaciente";
import { supabaseBrowser } from "@/lib/supabase/client";
import { codigoPix, hostDoLink, reais } from "@/lib/pix";
import { abrirCameraMicrofone, useSala } from "@/lib/sala";
import { dataHora } from "@/lib/teleconsulta";
import { grupoProfissao, termoTeleconsulta } from "@/lib/conselhos";

type Info = {
  paciente: string; profissional: string; especialidade: string | null; conselho: string | null;
  inicio: string; duracao_min: number; valor: number | null; status: string;
  consentimento_em: string | null; pagamento_status: string; preconsulta_ok: boolean; na_espera: boolean;
  pix: { chave: string; nome: string | null; cidade: string | null } | null;
  cartao_link: string | null;
  pagamento_online?: boolean; reserva_expira_em?: string | null; profissao?: string | null;
  pagamento_metodo?: string | null; pagamento_confirmado_em?: string | null; transacao?: string | null;
  devolvido_em?: string | null; devolucao_valor?: number | null; cancelamento_horas?: number; cancelamento_obs?: string | null; cancelado_por?: string | null; pagina?: string | null;
};

function Passos({ atual, total }: { atual: number; total: number }) {
  return (
    <div className="passos" aria-label={`Passo ${atual} de ${total}`}>
      {Array.from({ length: total }, (_, i) => <span key={i} className={i < atual ? "passo feito" : "passo"} />)}
    </div>
  );
}

export default function SalaPaciente({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = use(params);
  const [info, setInfo] = useState<Info | null | undefined>(undefined);
  const [aceito, setAceito] = useState(false);
  const [usoIA, setUsoIA] = useState<"sim" | "nao">("nao");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [qr, setQr] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [metodo, setMetodo] = useState<"pix" | "credito" | "debito" | null>(null);
  const [abriuCartao, setAbriuCartao] = useState(false);
  const [abrindoPg, setAbrindoPg] = useState(false);
  const [voltouPg, setVoltouPg] = useState(false);
  const [pixOnline, setPixOnline] = useState<{ codigo: string; imagem: string } | null>(null);
  const [copiadoOnline, setCopiadoOnline] = useState(false);
  const [cartaoOnline, setCartaoOnline] = useState<{ metodo: "credito" | "debito"; publicKey: string } | null>(null);
  const [recusa, setRecusa] = useState<{ titulo: string; texto: string } | null>(null);
  const [recemPago, setRecemPago] = useState(false);
  const [aviso, setAviso] = useState("");
  const statusAnterior = useRef<string | null>(null);
  const [pre, setPre] = useState({ motivo: "", medicamentos: "", alergia: "", quais: "" });
  const [pulouPre, setPulouPre] = useState(false);
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [naSala, setNaSala] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const videoLocal = useRef<HTMLVideoElement>(null);
  const videoRemoto = useRef<HTMLVideoElement>(null);

  const carregar = useCallback(async () => {
    const { data, error } = await supabaseBrowser().rpc("tele_paciente", { p_codigo: codigo });
    if (error) return setInfo((v) => (v === undefined ? null : v));
    setInfo((data as Info) ?? null);
  }, [codigo]);

  useEffect(() => {
    carregar();
    const p = setInterval(carregar, 8000);
    return () => clearInterval(p);
  }, [carregar]);

  // Voltou do Mercado Pago: o servidor consulta o Mercado Pago e confirma. Repete por alguns minutos (Pix pode demorar).
  const verificarPagamento = useCallback(async () => {
    await fetch("/api/pagamento/verificar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codigo }) }).catch(() => {});
    await carregar();
  }, [codigo, carregar]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("pg")) { setVoltouPg(true); verificarPagamento(); }
  }, [verificarPagamento]);
  useEffect(() => {
    if ((!voltouPg && info?.pagamento_status !== "informado") || !info || !info.pagamento_online || info.pagamento_status === "confirmado") return;
    let n = 0;
    const t = setInterval(() => { if (++n > 40) clearInterval(t); else verificarPagamento(); }, 6000);
    return () => clearInterval(t);
  }, [voltouPg, info?.pagamento_online, info?.pagamento_status, verificarPagamento]); // eslint-disable-line react-hooks/exhaustive-deps

  // Quando o pagamento é aprovado com o paciente na página, mostra o comprovante antes de seguir.
  useEffect(() => {
    const st = info?.pagamento_status ?? null;
    if (statusAnterior.current && statusAnterior.current !== "confirmado" && st === "confirmado") setRecemPago(true);
    if (st) statusAnterior.current = st;
  }, [info?.pagamento_status]);
  useEffect(() => { if (new URLSearchParams(window.location.search).get("pg")) statusAnterior.current = "pendente"; }, []);

  // "Já paguei e não liberou": confere de novo; se ainda não achou, avisa o consultório (que também confere sozinho).
  async function jaPaguei() {
    setAviso(""); setEnviando(true);
    await verificarPagamento();
    const { data } = await supabaseBrowser().rpc("tele_paciente", { p_codigo: codigo });
    const st = (data as Info | null)?.pagamento_status;
    if (st !== "confirmado") {
      await supabaseBrowser().rpc("tele_acao", { p_codigo: codigo, p_acao: "pagamento_informado", p_dados: { metodo: pixOnline ? "pix" : (cartaoOnline?.metodo ?? "pix") } });
      setAviso("Ainda não recebemos a confirmação do banco. Avisamos o consultório e continuamos conferindo sozinhos: assim que o pagamento for localizado, sua consulta é liberada aqui. Guarde o comprovante do seu banco. Não pague de novo.");
      await carregar();
    }
    setEnviando(false);
  }


  async function pagarOnline(m: "pix" | "credito" | "debito") {
    setErro(""); setRecusa(null); setAbrindoPg(true);
    if (m !== "pix") {
      // Cartão: formulário seguro do Mercado Pago na própria página, sem conta. Se não houver, usa a página da instituição.
      const k = await fetch(`/api/pagamento/chave-publica?codigo=${encodeURIComponent(codigo)}`).then((x) => x.json()).catch(() => ({}));
      if (k?.publicKey) { setAbrindoPg(false); setPixOnline(null); setCartaoOnline({ metodo: m, publicKey: k.publicKey }); return; }
    }
    const r = await fetch("/api/pagamento/criar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codigo, metodo: m }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.pix?.codigo) {
      setAbrindoPg(false); setCartaoOnline(null); setPixOnline(d.pix); setCopiadoOnline(false); setVoltouPg(true);
      if (!d.pix.imagem) QRCode.toDataURL(d.pix.codigo, { margin: 1, width: 360, color: { dark: "#101817", light: "#FFFFFF" } }).then((u) => setPixOnline({ codigo: d.pix.codigo, imagem: u })).catch(() => {});
      return;
    }
    if (!r.ok || !d.url) { setAbrindoPg(false); setErro(d.erro || "Não foi possível abrir o pagamento."); return; }
    window.location.href = d.url;
  }

  const { remoto, estado } = useSala(codigo, "paciente", local, naSala);
  useEffect(() => { if (videoLocal.current) videoLocal.current.srcObject = local; }, [local, naSala]);
  useEffect(() => { if (videoRemoto.current) videoRemoto.current.srcObject = remoto; }, [remoto]);
  useEffect(() => () => local?.getTracks().forEach((tr) => tr.stop()), [local]);

  const pix = info?.pix && info.valor ? codigoPix({ chave: info.pix.chave, nome: info.pix.nome ?? info.profissional, cidade: info.pix.cidade ?? "", valor: Number(info.valor), identificador: `AURIS${codigo}` }) : "";
  useEffect(() => {
    if (!pix) return;
    QRCode.toDataURL(pix, { margin: 1, width: 360, color: { dark: "#101817", light: "#FFFFFF" } }).then(setQr).catch(() => setQr(""));
  }, [pix]);

  async function acao(nome: string, dados?: Record<string, string>) {
    setErro(""); setEnviando(true);
    const { data, error } = await supabaseBrowser().rpc("tele_acao", { p_codigo: codigo, p_acao: nome, p_dados: dados ?? null });
    setEnviando(false);
    if (error || data !== true) { setErro("Não foi possível salvar. Verifique a internet e tente de novo."); return false; }
    await carregar();
    return true;
  }

  async function copiarPix() {
    try { await navigator.clipboard.writeText(pix); setCopiado(true); setTimeout(() => setCopiado(false), 3000); } catch { setErro("Não consegui copiar. Selecione o código e copie manualmente."); }
  }

  async function enviarPre() {
    if (!pre.motivo.trim()) return setErro("Conte em poucas palavras o motivo da consulta.");
    if (!pre.alergia) return setErro("Responda se você tem alergia a algum medicamento.");
    await acao("preconsulta", { motivo: pre.motivo, medicamentos: pre.medicamentos, alergias: pre.alergia === "sim" ? pre.quais || "Sim, não informou quais" : "Não" });
  }

  async function testarCamera() {
    setErro("");
    const r = await abrirCameraMicrofone();
    if (!r.stream) return setErro(r.erro ?? "Não consegui abrir a câmera.");
    setLocal(r.stream);
  }

  async function entrarNaEspera() {
    if (!local) return;
    if (await acao("espera")) setNaSala(true);
  }

  const alternarMic = () => { local?.getAudioTracks().forEach((tr) => (tr.enabled = !micOn)); setMicOn(!micOn); };
  const alternarCam = () => { local?.getVideoTracks().forEach((tr) => (tr.enabled = !camOn)); setCamOn(!camOn); };
  const sair = () => { local?.getTracks().forEach((tr) => tr.stop()); setLocal(null); setNaSala(false); };

  if (info === undefined) return <div className="paciente"><p className="muted">Carregando.</p></div>;
  if (info === null) return (
    <div className="paciente">
      <h1>Link não encontrado</h1>
      <p className="muted">Confira se o link está completo ou peça um novo ao consultório.</p>
    </div>
  );

  const termo = termoTeleconsulta(grupoProfissao(info.profissao));

  const cabecalho = (
    <div className="paciente-topo">
      <span className="paciente-marca">Auris</span>
      <span className="muted">Teleconsulta</span>
    </div>
  );

  if (info.status === "cancelada") return (
    <div className="paciente">{cabecalho}
      <h1>Consulta cancelada</h1>
      <p className="muted">{info.cancelado_por === "paciente" ? "Você cancelou esta teleconsulta." : "Esta teleconsulta foi cancelada pelo consultório."}</p>
      {info.pagamento_status === "devolvido" && (
        <div className="card">
          <div className="ok" role="status"><b>Valor devolvido</b><div style={{ marginTop: 4 }}>Devolvemos {reais(Number(info.devolucao_valor ?? info.valor ?? 0))}{info.devolvido_em ? ` em ${new Date(info.devolvido_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })}` : ""}.</div></div>
          <p className="muted" style={{ marginBottom: 0 }}>No Pix, o valor volta para a conta que pagou, em geral em poucos minutos. No cartão, o estorno aparece na fatura em até duas faturas, conforme o banco.{info.transacao ? ` Número da transação: ${info.transacao}.` : ""}</p>
        </div>
      )}
      {info.cancelado_por === "profissional" && info.pagamento_status === "confirmado"
        ? <EscolhaPaciente codigo={codigo} profissional={info.profissional} valor={Number(info.valor || 0)} obs={info.cancelamento_obs} aoConcluir={carregar} />
        : <RemarcarConsulta profissional={info.profissional} pagina={info.pagina} obs={info.cancelamento_obs} />}
    </div>
  );
  if (info.status === "encerrada" || estado === "encerrada") return (
    <div className="paciente">{cabecalho}
      <h1>Consulta encerrada</h1>
      <p className="muted">Obrigado, {info.paciente}. O profissional vai revisar o atendimento e enviar o resumo e os documentos por um link próprio.</p>
    </div>
  );

  const temValor = !!info.valor && Number(info.valor) > 0;
  const total = temValor ? 4 : 3;
  // Trava: com valor, só segue para a sala depois do pagamento confirmado (pelo Mercado Pago ou pelo consultório).
  const pago = info.pagamento_status === "confirmado" || info.pagamento_status === "isento";
  const precisaPagar = temValor && !pago;
  const reservaVencida = !!info.reserva_expira_em && new Date(info.reserva_expira_em) < new Date();

  // Chamada em andamento
  if (naSala) return (
    <div className="paciente paciente-chamada">
      <div className="row">
        <div><b>{info.profissional}</b><div className="muted">{info.especialidade}</div></div>
      </div>
      <div className="ajuda-paciente"><AjudaLink roteiro="paciente" texto="Precisa de ajuda? Ver o passo a passo" /></div>
      <div className="video-remoto video-remoto-celular">
        <video ref={videoRemoto} autoPlay playsInline />
        {!remoto && (
          <div className="video-vazio">
            {estado === "conectando" ? "Conectando" : estado === "instavel" ? "Conexão instável, tentando de novo" : `Você está na sala de espera. ${info.profissional} vai entrar em instantes.`}
          </div>
        )}
        <video ref={videoLocal} className="video-local" autoPlay playsInline muted />
      </div>
      <div className="controles">
        <button type="button" className="btn-sec" data-ajuda="p-controles" onClick={alternarMic} aria-pressed={!micOn}>{micOn ? "Desligar microfone" : "Ligar microfone"}</button>
        <button type="button" className="btn-sec" onClick={alternarCam} aria-pressed={!camOn}>{camOn ? "Desligar câmera" : "Ligar câmera"}</button>
        <button type="button" className="link" onClick={sair}>Sair da sala</button>
      </div>
      <p className="muted" style={{ textAlign: "center" }}>Deixe esta tela aberta. Se a conexão cair, a chamada volta sozinha.</p>
    </div>
  );

  return (
    <div className="paciente">
      {cabecalho}
      <div className="ajuda-paciente"><AjudaLink roteiro="paciente" texto="Precisa de ajuda? Ver o passo a passo" /></div>
      <p className="muted" style={{ marginBottom: 2 }}>Olá, {info.paciente}</p>
      <h1>Sua consulta com {info.profissional}</h1>
      <div className="card">
        <b>{(() => { const d = dataHora(info.inicio); return d.charAt(0).toUpperCase() + d.slice(1); })()}</b>
        <div className="muted">{[info.especialidade, info.conselho].filter(Boolean).join(", ")}{temValor ? `. Valor: ${reais(Number(info.valor))}` : ""}</div>
        {temValor && info.pagamento_status === "confirmado" && <div className="pago-linha">Pagamento aprovado{info.pagamento_confirmado_em ? ` em ${new Date(info.pagamento_confirmado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })}` : ""}</div>}
      </div>

      {erro && <div className="erro" style={{ marginBottom: 12 }} role="alert">{erro}</div>}

      {!info.consentimento_em ? (
        <div className="card">
          <Passos atual={1} total={total} />
          <h2 style={{ marginTop: 12 }} data-ajuda="p-termo">Termo de consentimento</h2>
          <div className="termo">{termo}</div>
          <label className="aceite" data-ajuda="p-ia">
            <input type="checkbox" checked={usoIA === "sim"} onChange={(e) => setUsoIA(e.target.checked ? "sim" : "nao")} />
            <span>Autorizo o Auris para a organização das anotações da consulta.</span>
          </label>
          <label className="aceite" data-ajuda="p-aceite">
            <input type="checkbox" checked={aceito} onChange={(e) => setAceito(e.target.checked)} />
            <span>Li e concordo em ser atendido(a) online.</span>
          </label>
          <button type="button" data-ajuda="p-concordar" disabled={!aceito || enviando} style={{ width: "100%", marginTop: 12 }} onClick={() => acao("consentir", { texto: `${termo}\n\nUso de IA no registro: ${usoIA === "sim" ? "autorizado" : "não autorizado"} pelo paciente.`, ia: usoIA === "sim" ? "true" : "false" })}>Concordar e continuar</button>
          <p className="muted" style={{ marginBottom: 0 }}>Seu aceite fica guardado no prontuário, com data e hora.</p>
        </div>
      ) : temValor && recemPago && info.pagamento_status === "confirmado" ? (
        <div className="card">
          <Passos atual={2} total={total} />
          <div className="ok" role="status" style={{ marginTop: 12 }}>
            <b style={{ fontSize: 17 }}>Pagamento aprovado</b>
            <div style={{ marginTop: 4 }}>Sua consulta com {info.profissional} está confirmada.</div>
          </div>
          <dl className="comprovante">
            <dt>Valor</dt><dd>{reais(Number(info.valor))}</dd>
            <dt>Forma de pagamento</dt><dd>{info.pagamento_metodo === "credito" ? "Cartão de crédito" : info.pagamento_metodo === "debito" ? "Cartão de débito" : "Pix"}</dd>
            {info.pagamento_confirmado_em && <><dt>Aprovado em</dt><dd>{new Date(info.pagamento_confirmado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })}</dd></>}
            {info.transacao && <><dt>Número da transação</dt><dd>{info.transacao}</dd></>}
            <dt>Consulta</dt><dd>{(() => { const d = dataHora(info.inicio); return d.charAt(0).toUpperCase() + d.slice(1); })()}</dd>
          </dl>
          <p className="muted">Guarde este número da transação, se precisar falar com o consultório. Boa consulta!</p>
          <button type="button" data-ajuda="p-pago" style={{ width: "100%" }} onClick={() => setRecemPago(false)}>Continuar</button>
        </div>
      ) : precisaPagar ? (
        <div className="card">
          <Passos atual={2} total={total} />
          <h2 style={{ marginTop: 12 }}>Pagamento da consulta</h2>
          {info.pagamento_online ? (
            info.pagamento_status === "informado" ? (
              <div className="aviso" role="status" style={{ marginBottom: 0 }}><b>Conferindo o seu pagamento.</b> Você avisou que pagou e o consultório foi avisado. Continuamos conferindo com o banco: assim que o pagamento for localizado, esta página libera a consulta sozinha. Guarde o comprovante do seu banco e não pague de novo.</div>
            ) : reservaVencida ? (
              <p style={{ marginBottom: 0 }}>O prazo de 30 minutos para pagar este horário terminou e ele foi liberado. Volte à página do profissional e escolha um novo horário.</p>
            ) : cartaoOnline && info.pagamento_status !== "confirmado" ? (
              <>
                <p className="muted">Pague <b style={{ color: "var(--tinta)" }}>{reais(Number(info.valor))}</b> no cartão de {cartaoOnline.metodo === "credito" ? "crédito, à vista" : "débito"}. Os dados do cartão ficam só no Mercado Pago; o Auris não vê nem guarda. Não precisa de conta no Mercado Pago.</p>
                <div data-ajuda="p-cartao"><CartaoMP key={cartaoOnline.metodo} codigo={codigo} publicKey={cartaoOnline.publicKey} valor={Number(info.valor)} metodo={cartaoOnline.metodo}
                  onAprovado={() => { setErro(""); setRecusa(null); setRecemPago(true); verificarPagamento(); }}
                  onErro={(msg, recusado) => setRecusa(recusado
                    ? { titulo: "Pagamento recusado", texto: `${msg} Nenhum valor foi cobrado. Você pode tentar de novo, usar outro cartão ou pagar com Pix.` }
                    : { titulo: "Pagamento não concluído", texto: msg })} /></div>
                {recusa && <div className="erro" role="alert" style={{ marginTop: 12 }}><b>{recusa.titulo}</b><div style={{ marginTop: 4 }}>{recusa.texto}</div></div>}
                {cartaoOnline.metodo === "debito" && <p className="muted">No débito online, nem todos os bancos aceitam. Se o seu não aceitar, use o crédito ou o Pix.</p>}
                <button type="button" className="link" onClick={() => { setCartaoOnline(null); setErro(""); }}>Escolher outra forma de pagamento</button>
              </>
            ) : pixOnline && info.pagamento_status !== "confirmado" ? (
              <>
                <p className="muted">Pague <b style={{ color: "var(--tinta)" }}>{reais(Number(info.valor))}</b> com Pix pelo aplicativo do seu banco. Não precisa de conta em nenhuma outra instituição.</p>
                {pixOnline.imagem && <img src={pixOnline.imagem} alt="QR Code do Pix" className="qr" />}
                <label htmlFor="pix-online">Pix copia e cola</label>
                <textarea id="pix-online" readOnly rows={3} value={pixOnline.codigo} onFocus={(e) => e.currentTarget.select()} />
                <button type="button" data-ajuda="p-pix" style={{ width: "100%", marginTop: 8 }} onClick={() => { navigator.clipboard?.writeText(pixOnline.codigo).then(() => setCopiadoOnline(true)).catch(() => {}); }}>{copiadoOnline ? "Código copiado" : "Copiar código Pix"}</button>
                <p className="muted">No app do banco, escolha Pix, depois Pix Copia e Cola (ou ler QR Code).</p>
                <div className="aviso" role="status"><b>Aguardando o pagamento.</b> Deixe esta página aberta: assim que o Pix for aprovado, aparece aqui a confirmação, em poucos segundos.</div>
                {aviso ? <div className="aviso" role="status">{aviso}</div> : <button type="button" className="btn-sec" disabled={enviando} style={{ width: "100%", marginBottom: 8 }} onClick={jaPaguei}>{enviando ? "Conferindo com o banco" : "Já paguei e não liberou"}</button>}
                <button type="button" className="link" onClick={() => setPixOnline(null)}>Escolher outra forma de pagamento</button>
              </>
            ) : voltouPg && info.pagamento_status !== "confirmado" ? (
              <>
                <p>Estamos aguardando a confirmação do pagamento. Pelo Pix, costuma levar poucos segundos; esta página atualiza sozinha.</p>
                {aviso ? <div className="aviso" role="status">{aviso}</div> : <button type="button" className="btn-sec" disabled={enviando} style={{ width: "100%", marginBottom: 8 }} onClick={jaPaguei}>{enviando ? "Conferindo com o banco" : "Já paguei e não liberou"}</button>}
                <p className="muted">Se você fechou o pagamento sem concluir, escolha a forma de pagamento de novo:</p>
                <div className="opcoes" data-ajuda="p-pagar" role="group" aria-label="Forma de pagamento">
                  <button type="button" className="opcao" disabled={abrindoPg} onClick={() => pagarOnline("pix")}>Pix</button>
                  <button type="button" className="opcao" disabled={abrindoPg} onClick={() => pagarOnline("credito")}>Cartão de crédito</button>
                  <button type="button" className="opcao" disabled={abrindoPg} onClick={() => pagarOnline("debito")}>Cartão de débito</button>
                </div>
              </>
            ) : (
              <>
                <p className="muted">Valor da consulta: <b style={{ color: "var(--tinta)" }}>{reais(Number(info.valor))}</b>. O pagamento vai direto para {info.profissional} e confirma a sua consulta automaticamente.</p>
                <p className="muted" style={{ marginBottom: 6 }}>Escolha como pagar:</p>
                <div className="opcoes" data-ajuda="p-pagar" role="group" aria-label="Forma de pagamento">
                  <button type="button" className="opcao" disabled={abrindoPg} onClick={() => pagarOnline("pix")}>Pix</button>
                  <button type="button" className="opcao" disabled={abrindoPg} onClick={() => pagarOnline("credito")}>Cartão de crédito</button>
                  <button type="button" className="opcao" disabled={abrindoPg} onClick={() => pagarOnline("debito")}>Cartão de débito</button>
                </div>
                <p className="muted">{abrindoPg ? "Abrindo a página de pagamento segura." : "Você paga aqui mesmo, pelo app do seu banco (Pix) ou com o seu cartão, sem precisar de conta em outra instituição. Os dados do cartão não passam pelo Auris."}</p>
                {info.reserva_expira_em && <p className="muted" style={{ marginBottom: 0 }}>Seu horário fica reservado até as {new Date(info.reserva_expira_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}.</p>}
              </>
            )
          ) : info.pagamento_status === "informado" ? (
            <p style={{ marginBottom: 0 }}>Recebemos o seu aviso de pagamento. Assim que o consultório confirmar o recebimento, esta página libera os próximos passos e a sala de espera. Ela atualiza sozinha.</p>
          ) : !info.pix && !info.cartao_link ? (
            <p className="muted" style={{ marginBottom: 0 }}>O consultório ainda não cadastrou a forma de pagamento. Entre em contato com o consultório.</p>
          ) : (
            <>
              <p className="muted">Valor da consulta: <b style={{ color: "var(--tinta)" }}>{reais(Number(info.valor))}</b>. O pagamento vai direto para {info.pix?.nome || info.profissional}.</p>
              <p className="muted" style={{ marginBottom: 6 }}>Escolha como pagar:</p>
              <div className="opcoes" data-ajuda="p-pagar" role="group" aria-label="Forma de pagamento">
                {(["pix", "credito", "debito"] as const).map((m) => {
                  const atual = metodo ?? (info.pix ? "pix" : "credito");
                  return (
                    <button key={m} type="button" aria-pressed={atual === m} className={atual === m ? "opcao ativa" : "opcao"} onClick={() => { setMetodo(m); setAbriuCartao(false); }}>
                      {m === "pix" ? "Pix" : m === "credito" ? "Cartão de crédito" : "Cartão de débito"}
                    </button>
                  );
                })}
              </div>
              {(() => {
                const atual = metodo ?? (info.pix ? "pix" : "credito");
                if (atual === "pix") return info.pix ? (
                  <>
                    <p className="muted">Pague com Pix pelo aplicativo do seu banco.</p>
                    {qr && <img src={qr} alt="QR Code do Pix" className="qr" />}
                    <label htmlFor="pix-cc">Pix copia e cola</label>
                    <textarea id="pix-cc" readOnly rows={3} value={pix} onFocus={(e) => e.currentTarget.select()} />
                    <button type="button" data-ajuda="p-pix" className="btn-sec" style={{ width: "100%", marginTop: 8 }} onClick={copiarPix}>{copiado ? "Código copiado" : "Copiar código Pix"}</button>
                    <button type="button" data-ajuda="p-informar" disabled={enviando} style={{ width: "100%", marginTop: 10 }} onClick={() => acao("pagamento_informado", { metodo: "pix" })}>Já fiz o pagamento</button>
                  </>
                ) : <p className="muted">Este consultório não recebe por Pix. Escolha cartão de crédito ou de débito.</p>;
                const nome = atual === "credito" ? "crédito" : "débito";
                return info.cartao_link ? (
                  <>
                    <p className="muted">Você vai pagar no <b>cartão de {nome}</b>, no site seguro de <b>{hostDoLink(info.cartao_link)}</b>. Lá, escolha a opção {nome}. Os dados do cartão ficam só nesse site; o Auris não vê nem guarda.</p>
                    <a className="btn" data-ajuda="p-cartao" href={info.cartao_link} target="_blank" rel="noopener noreferrer" style={{ display: "block", textAlign: "center" }} onClick={() => setAbriuCartao(true)}>Pagar no cartão de {nome}</a>
                    <button type="button" data-ajuda="p-informar" className={abriuCartao ? "" : "btn-sec"} disabled={enviando} style={{ width: "100%", marginTop: 10 }} onClick={() => acao("pagamento_informado", { metodo: atual })}>Já fiz o pagamento</button>
                  </>
                ) : <p className="muted">Este consultório ainda não recebe por cartão. Escolha Pix.</p>;
              })()}
              <p className="muted" style={{ marginBottom: 0 }}>Depois de pagar, toque em &quot;Já fiz o pagamento&quot;. O consultório confere e libera a sala de espera.</p>
            </>
          )}
        </div>
      ) : !info.preconsulta_ok && !pulouPre ? (
        <div className="card">
          <Passos atual={temValor ? 3 : 2} total={total} />
          <h2 style={{ marginTop: 12 }}>Antes da consulta</h2>
          <p className="muted">Suas respostas chegam ao profissional antes da chamada.</p>
          <label htmlFor="pre-motivo" data-ajuda="p-pre">Qual é o motivo da consulta?</label>
          <textarea id="pre-motivo" rows={3} value={pre.motivo} onChange={(e) => setPre({ ...pre, motivo: e.target.value })} />
          <div style={{ height: 10 }} />
          <label htmlFor="pre-med">Você toma algum remédio todos os dias? Quais?</label>
          <input id="pre-med" value={pre.medicamentos} onChange={(e) => setPre({ ...pre, medicamentos: e.target.value })} />
          <div style={{ height: 10 }} />
          <span className="rotulo">Tem alergia a algum medicamento?</span>
          <div className="opcoes">
            <button type="button" aria-pressed={pre.alergia === "sim"} className={pre.alergia === "sim" ? "opcao ativa" : "opcao"} onClick={() => setPre({ ...pre, alergia: "sim" })}>Sim</button>
            <button type="button" aria-pressed={pre.alergia === "nao"} className={pre.alergia === "nao" ? "opcao ativa" : "opcao"} onClick={() => setPre({ ...pre, alergia: "nao", quais: "" })}>Não</button>
          </div>
          {pre.alergia === "sim" && (
            <>
              <label htmlFor="pre-quais">Quais?</label>
              <input id="pre-quais" value={pre.quais} onChange={(e) => setPre({ ...pre, quais: e.target.value })} />
            </>
          )}
          <button type="button" data-ajuda="p-pre-enviar" disabled={enviando} style={{ width: "100%", marginTop: 14 }} onClick={enviarPre}>Enviar e ir para a sala de espera</button>
          <button type="button" className="link" style={{ width: "100%", marginTop: 4 }} onClick={() => setPulouPre(true)}>Prefiro falar na consulta</button>
        </div>
      ) : (
        <div className="card">
          <Passos atual={total} total={total} />
          <h2 style={{ marginTop: 12 }}>Sala de espera</h2>
          {temValor && pago && <p className="ok" style={{ marginTop: 0 }}>Pagamento confirmado.</p>}
          <div className="video-remoto video-teste">
            {local ? <video ref={videoLocal} autoPlay playsInline muted /> : <div className="video-vazio">Teste a câmera e o microfone antes de entrar.</div>}
          </div>
          {!local ? (
            <button type="button" data-ajuda="p-testar" style={{ width: "100%", marginTop: 12 }} onClick={testarCamera}>Testar câmera e microfone</button>
          ) : (
            <button type="button" data-ajuda="p-entrar" disabled={enviando} style={{ width: "100%", marginTop: 12 }} onClick={entrarNaEspera}>Entrar na sala de espera</button>
          )}
          <p className="muted" style={{ marginBottom: 0 }}>Use um lugar reservado e com boa internet. No horário marcado, o profissional entra na chamada.</p>
        </div>
      )}

      {info.consentimento_em && (
        <p className="ajuda-link"><Link href={`/t/${codigo}/ajuda`}>Ajuda e política de cancelamento</Link></p>
      )}
    </div>
  );
}
