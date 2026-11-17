"use client";
import { use, useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { supabaseBrowser } from "@/lib/supabase/client";
import { codigoPix, reais } from "@/lib/pix";
import { abrirCameraMicrofone, useSala } from "@/lib/sala";
import { TERMO_TELECONSULTA, dataHora } from "@/lib/teleconsulta";

type Info = {
  paciente: string; profissional: string; especialidade: string | null; conselho: string | null;
  inicio: string; duracao_min: number; valor: number | null; status: string;
  consentimento_em: string | null; pagamento_status: string; preconsulta_ok: boolean; na_espera: boolean;
  pix: { chave: string; nome: string | null; cidade: string | null } | null;
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
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [qr, setQr] = useState("");
  const [copiado, setCopiado] = useState(false);
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

  const cabecalho = (
    <div className="paciente-topo">
      <span className="paciente-marca">Auris</span>
      <span className="muted">Teleconsulta</span>
    </div>
  );

  if (info.status === "cancelada") return <div className="paciente">{cabecalho}<h1>Consulta cancelada</h1><p className="muted">Esta teleconsulta foi cancelada pelo consultório. Entre em contato para remarcar.</p></div>;
  if (info.status === "encerrada" || estado === "encerrada") return (
    <div className="paciente">{cabecalho}
      <h1>Consulta encerrada</h1>
      <p className="muted">Obrigado, {info.paciente}. O profissional vai revisar o atendimento e enviar o resumo e os documentos por um link próprio.</p>
    </div>
  );

  const temValor = !!info.valor && Number(info.valor) > 0;
  const total = temValor ? 4 : 3;
  const precisaPagar = temValor && info.pagamento_status === "pendente";

  // Chamada em andamento
  if (naSala) return (
    <div className="paciente paciente-chamada">
      <div className="row">
        <div><b>{info.profissional}</b><div className="muted">{info.especialidade}</div></div>
      </div>
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
        <button type="button" className="btn-sec" onClick={alternarMic} aria-pressed={!micOn}>{micOn ? "Desligar microfone" : "Ligar microfone"}</button>
        <button type="button" className="btn-sec" onClick={alternarCam} aria-pressed={!camOn}>{camOn ? "Desligar câmera" : "Ligar câmera"}</button>
        <button type="button" className="link" onClick={sair}>Sair da sala</button>
      </div>
      <p className="muted" style={{ textAlign: "center" }}>Deixe esta tela aberta. Se a conexão cair, a chamada volta sozinha.</p>
    </div>
  );

  return (
    <div className="paciente">
      {cabecalho}
      <p className="muted" style={{ marginBottom: 2 }}>Olá, {info.paciente}</p>
      <h1>Sua consulta com {info.profissional}</h1>
      <div className="card">
        <b style={{ textTransform: "capitalize" }}>{dataHora(info.inicio)}</b>
        <div className="muted">{[info.especialidade, info.conselho].filter(Boolean).join(", ")}{temValor ? `. Valor: ${reais(Number(info.valor))}` : ""}</div>
      </div>

      {erro && <div className="erro" style={{ marginBottom: 12 }} role="alert">{erro}</div>}

      {!info.consentimento_em ? (
        <div className="card">
          <Passos atual={1} total={total} />
          <h2 style={{ marginTop: 12 }}>Termo de consentimento</h2>
          <div className="termo">{TERMO_TELECONSULTA}</div>
          <label className="aceite">
            <input type="checkbox" checked={aceito} onChange={(e) => setAceito(e.target.checked)} />
            <span>Li e concordo em ser atendido(a) por teleconsulta.</span>
          </label>
          <button type="button" disabled={!aceito || enviando} style={{ width: "100%", marginTop: 12 }} onClick={() => acao("consentir", { texto: TERMO_TELECONSULTA })}>Concordar e continuar</button>
          <p className="muted" style={{ marginBottom: 0 }}>Seu aceite fica guardado no prontuário, com data e hora.</p>
        </div>
      ) : precisaPagar ? (
        <div className="card">
          <Passos atual={2} total={total} />
          <h2 style={{ marginTop: 12 }}>Pagamento da consulta</h2>
          {info.pix ? (
            <>
              <p className="muted">Pague com Pix pelo aplicativo do seu banco. O valor de {reais(Number(info.valor))} vai direto para {info.pix.nome || info.profissional}.</p>
              {qr && <img src={qr} alt="QR Code do Pix" className="qr" />}
              <label htmlFor="pix-cc">Pix copia e cola</label>
              <textarea id="pix-cc" readOnly rows={3} value={pix} onFocus={(e) => e.currentTarget.select()} />
              <button type="button" className="btn-sec" style={{ width: "100%", marginTop: 8 }} onClick={copiarPix}>{copiado ? "Código copiado" : "Copiar código Pix"}</button>
              <button type="button" disabled={enviando} style={{ width: "100%", marginTop: 10 }} onClick={() => acao("pagamento_informado")}>Já fiz o pagamento</button>
              <p className="muted" style={{ marginBottom: 0 }}>O consultório confere o pagamento no banco. Você já pode seguir para os próximos passos.</p>
            </>
          ) : (
            <p className="muted" style={{ marginBottom: 0 }}>O consultório ainda não cadastrou a forma de pagamento. Entre em contato com o consultório.</p>
          )}
        </div>
      ) : !info.preconsulta_ok && !pulouPre ? (
        <div className="card">
          <Passos atual={temValor ? 3 : 2} total={total} />
          <h2 style={{ marginTop: 12 }}>Antes da consulta</h2>
          <p className="muted">Suas respostas chegam ao profissional antes da chamada.</p>
          <label htmlFor="pre-motivo">Qual é o motivo da consulta?</label>
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
          <button type="button" disabled={enviando} style={{ width: "100%", marginTop: 14 }} onClick={enviarPre}>Enviar e ir para a sala de espera</button>
          <button type="button" className="link" style={{ width: "100%", marginTop: 4 }} onClick={() => setPulouPre(true)}>Prefiro falar na consulta</button>
        </div>
      ) : (
        <div className="card">
          <Passos atual={total} total={total} />
          <h2 style={{ marginTop: 12 }}>Sala de espera</h2>
          {temValor && info.pagamento_status === "informado" && <p className="muted">Pagamento informado. O consultório vai conferir.</p>}
          <div className="video-remoto video-teste">
            {local ? <video ref={videoLocal} autoPlay playsInline muted /> : <div className="video-vazio">Teste a câmera e o microfone antes de entrar.</div>}
          </div>
          {!local ? (
            <button type="button" style={{ width: "100%", marginTop: 12 }} onClick={testarCamera}>Testar câmera e microfone</button>
          ) : (
            <button type="button" disabled={enviando} style={{ width: "100%", marginTop: 12 }} onClick={entrarNaEspera}>Entrar na sala de espera</button>
          )}
          <p className="muted" style={{ marginBottom: 0 }}>Use um lugar reservado e com boa internet. No horário marcado, o profissional entra na chamada.</p>
        </div>
      )}
    </div>
  );
}
