"use client";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { AREAS_ATENDIMENTO, modeloDaArea } from "@/lib/modelos";
import { reais } from "@/lib/pix";
import { abrirCameraMicrofone, useSala } from "@/lib/sala";
import { dataHora, horaDe, type Teleconsulta } from "@/lib/teleconsulta";

const LIMITE_S = 60 * 60; // até 60 minutos de registro por voz

function formatoAudio(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((t) => MediaRecorder.isTypeSupported?.(t));
}

export default function SalaMedico({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [t, setT] = useState<Teleconsulta | null>(null);
  const [area, setArea] = useState("Clínica médica");
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [ativo, setAtivo] = useState(false);
  const [erro, setErro] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [segundos, setSegundos] = useState(0);
  const [gravando, setGravando] = useState(false);
  const [etapa, setEtapa] = useState<"sala" | "processando" | "falhou">("sala");
  const videoRemoto = useRef<HTMLVideoElement>(null);
  const videoLocal = useRef<HTMLVideoElement>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const destino = useRef<MediaStreamAudioDestinationNode | null>(null);
  const juntador = useRef<ChannelMergerNode | null>(null);
  const doisCanais = useRef(false);
  const remotoLigado = useRef<MediaStream | null>(null);
  const gravador = useRef<MediaRecorder | null>(null);
  const partes = useRef<Blob[]>([]);
  const audioFinal = useRef<Blob | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const [aviso, setAviso] = useState("");

  const { remoto, estado, encerrar } = useSala(t?.codigo ?? "", "medico", local, ativo && !!t);

  const carregar = useCallback(async () => {
    const { data } = await supabaseBrowser().from("teleconsultas").select("*").eq("id", id).maybeSingle();
    if (data) setT(data as Teleconsulta);
  }, [id]);

  useEffect(() => {
    carregar();
    const p = setInterval(carregar, 5000);
    (async () => {
      const sb = supabaseBrowser();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      const { data } = await sb.from("profissionais").select("profissao, especialidade").eq("id", user.id).maybeSingle();
      const a = data?.profissao === "Médico(a)" ? data?.especialidade : data?.profissao;
      if (a && AREAS_ATENDIMENTO.some((g) => g.itens.includes(a))) setArea(a);
    })();
    return () => clearInterval(p);
  }, [carregar]);

  useEffect(() => { if (videoLocal.current) videoLocal.current.srcObject = local; }, [local]);
  useEffect(() => {
    if (videoRemoto.current) videoRemoto.current.srcObject = remoto;
    // Voz do paciente no canal 2 da gravação (o canal 1 é o profissional).
    if (remoto && audioCtx.current && juntador.current && remotoLigado.current !== remoto && remoto.getAudioTracks().length) {
      audioCtx.current.createMediaStreamSource(new MediaStream(remoto.getAudioTracks())).connect(juntador.current, 0, 1);
      remotoLigado.current = remoto;
    }
  }, [remoto]);

  // Limpeza apenas quando o profissional sai da página.
  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
    if (gravador.current?.state === "recording") gravador.current.stop();
    localRef.current?.getTracks().forEach((tr) => tr.stop());
    audioCtx.current?.close().catch(() => {});
  }, []);

  function criarGravador(fonte: MediaStream, bits: number): MediaRecorder {
    const tipo = formatoAudio();
    try { return new MediaRecorder(fonte, { ...(tipo ? { mimeType: tipo } : {}), audioBitsPerSecond: bits }); }
    catch { return new MediaRecorder(fonte); }
  }

  async function iniciarGravacao(stream: MediaStream, ctx: AudioContext | null) {
    let fonte: MediaStream = new MediaStream(stream.getAudioTracks());
    // Mistura a voz do profissional e a do paciente; se o navegador não liberar o áudio, grava o microfone direto.
    if (ctx) {
      try { await ctx.resume(); } catch { /* segue para o plano B */ }
      if (ctx.state === "running") {
        // Gravação em dois canais: profissional no canal 1, paciente no canal 2.
        const dest = ctx.createMediaStreamDestination();
        dest.channelCount = 2;
        dest.channelInterpretation = "discrete";
        const merger = ctx.createChannelMerger(2);
        merger.connect(dest);
        ctx.createMediaStreamSource(new MediaStream(stream.getAudioTracks())).connect(merger, 0, 0);
        audioCtx.current = ctx;
        destino.current = dest;
        juntador.current = merger;
        doisCanais.current = true;
        fonte = dest.stream;
        if (remoto && remoto.getAudioTracks().length) {
          ctx.createMediaStreamSource(new MediaStream(remoto.getAudioTracks())).connect(merger, 0, 1);
          remotoLigado.current = remoto;
        }
      } else {
        doisCanais.current = false;
        ctx.close().catch(() => {});
        setAviso("O navegador não liberou a mistura de áudio. O registro vai usar o seu microfone, que também capta a voz do paciente pelo alto-falante.");
      }
    }
    const mr = criarGravador(fonte, doisCanais.current ? 48000 : 32000);
    partes.current = [];
    audioFinal.current = null;
    mr.ondataavailable = (e) => { if (e.data.size) partes.current.push(e.data); };
    mr.onstop = () => { audioFinal.current = new Blob(partes.current, { type: mr.mimeType || "audio/webm" }); };
    mr.start(1000);
    gravador.current = mr;
    setGravando(true);
    setSegundos(0);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => setSegundos((s) => {
      if (s + 1 >= LIMITE_S && gravador.current?.state === "recording") { gravador.current.stop(); setGravando(false); }
      return s + 1;
    }), 1000);
  }

  async function entrar() {
    setErro(""); setAviso("");
    // O áudio precisa ser criado no próprio clique, senão o navegador o deixa mudo.
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const ctx = AC ? new AC() : null;
    const r = await abrirCameraMicrofone();
    if (!r.stream) { ctx?.close().catch(() => {}); return setErro(r.erro ?? "Não consegui abrir a câmera."); }
    localRef.current = r.stream;
    setLocal(r.stream);
    setAtivo(true);
    await iniciarGravacao(r.stream, ctx);
    await supabaseBrowser().from("teleconsultas").update({ status: "em_andamento", iniciada_em: new Date().toISOString() }).eq("id", id);
    carregar();
  }

  const alternarMic = () => { local?.getAudioTracks().forEach((tr) => (tr.enabled = !micOn)); setMicOn(!micOn); };
  const alternarCam = () => { local?.getVideoTracks().forEach((tr) => (tr.enabled = !camOn)); setCamOn(!camOn); };

  async function pararTudo() {
    if (timer.current) clearInterval(timer.current);
    if (gravador.current?.state === "recording") {
      await new Promise<void>((ok) => { gravador.current!.addEventListener("stop", () => setTimeout(ok, 50), { once: true }); gravador.current!.stop(); });
    }
    setGravando(false);
    encerrar();
    local?.getTracks().forEach((tr) => tr.stop());
    localRef.current = null;
    setLocal(null);
    setAtivo(false);
    await supabaseBrowser().from("teleconsultas").update({ status: "encerrada", encerrada_em: new Date().toISOString() }).eq("id", id);
  }

  async function enviarAudio() {
    const audio = audioFinal.current;
    if (!audio || audio.size < 2000) { setEtapa("falhou"); return setErro("A gravação ficou vazia: o microfone não captou a conversa. Use Gravar, no menu, para ditar o atendimento."); }
    setEtapa("processando");
    setErro("");
    const ext = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
    const fd = new FormData();
    fd.append("area", area);
    fd.append("modelo", modeloDaArea(area));
    fd.append("modo", "consulta");
    fd.append("consentimento", "sim");
    fd.append("teleconsulta", "sim");
    fd.append("canais", doisCanais.current ? "2" : "1");
    try {
      // O áudio vai para o armazenamento privado do profissional e é apagado logo após a transcrição.
      const sb = supabaseBrowser();
      const { data: { user } } = await sb.auth.getUser();
      let enviadoPorArquivo = false;
      if (user) {
        const caminho = `${user.id}/tele-${id}-${Date.now()}.${ext}`;
        const { error } = await sb.storage.from("audios").upload(caminho, audio, { contentType: audio.type || "audio/webm", upsert: false });
        if (!error) { fd.append("audio_caminho", caminho); enviadoPorArquivo = true; }
      }
      if (!enviadoPorArquivo) {
        if (audio.size > 4.4 * 1024 * 1024) throw new Error("Não consegui enviar a gravação. Verifique a internet e tente de novo.");
        fd.append("audio", audio, `teleconsulta.${ext}`);
      }
      const r = await fetch("/api/processar", { method: "POST", body: fd });
      const data = await r.json().catch(() => ({ erro: `Falha de conexão com o servidor (código ${r.status}).` }));
      if (!r.ok) throw new Error(data.erro || "Falha ao processar.");
      try { sessionStorage.setItem("auris_tele_resultado", JSON.stringify({ tele: id, area, res: data })); } catch { /* armazenamento indisponível */ }
      router.push(`/novo?tele=${id}`);
    } catch (e) {
      setEtapa("falhou");
      setErro((e instanceof Error ? e.message : "") || "Falha ao processar.");
    }
  }

  async function encerrarComFicha() { await pararTudo(); await enviarAudio(); }
  async function encerrarSemFicha() { await pararTudo(); router.push("/teleconsultas"); }

  if (!t) return <p className="muted">Carregando a teleconsulta.</p>;

  const pagamentoPendente = t.pagamento_status === "pendente" || t.pagamento_status === "informado";
  const tempo = `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")}`;
  const textoEstado = estado === "conectado" ? "Paciente conectado" : estado === "conectando" ? "Conectando ao paciente" : estado === "instavel" ? "Conexão instável, tentando de novo" : t.paciente_na_espera_em ? "Paciente na sala de espera" : "Aguardando o paciente entrar";

  return (
    <div className="sala-medico">
      <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
        <div>
          <h1 style={{ marginBottom: 2 }}>{t.paciente_nome}</h1>
          <p className="muted" style={{ margin: 0 }}>Teleconsulta, {dataHora(t.inicio)}</p>
        </div>
        <a className="btn btn-sec" href="/teleconsultas">Voltar à agenda</a>
      </div>

      {erro && <div className="erro" style={{ margin: "12px 0" }}>{erro}</div>}
      {aviso && etapa === "sala" && <div className="aviso" style={{ margin: "12px 0" }}>{aviso}</div>}

      {etapa === "processando" && <div className="card" style={{ marginTop: 14 }}>Consulta encerrada. Transcrevendo a conversa e montando a ficha, isso leva alguns segundos.</div>}
      {etapa === "falhou" && (
        <div className="card" style={{ marginTop: 14 }}>
          <p style={{ marginTop: 0 }}>A consulta foi encerrada, mas a ficha não foi montada.</p>
          <div className="acoes-ficha">
            {audioFinal.current && audioFinal.current.size > 2000 && <button type="button" onClick={enviarAudio}>Tentar montar a ficha de novo</button>}
            <a className="btn btn-sec" href="/novo">Ditar o atendimento</a>
          </div>
        </div>
      )}

      {etapa === "sala" && (
        <div className="sala-grade">
          <section className="sala-video-col">
            <div className="video-remoto">
              <video ref={videoRemoto} autoPlay playsInline />
              {!remoto && <div className="video-vazio">{ativo ? textoEstado : "Entre na sala para iniciar a chamada"}</div>}
              {local && <video ref={videoLocal} className="video-local" autoPlay playsInline muted />}
              {ativo && <span className="video-tag"><span className={gravando ? "ponto ponto-ativo" : "ponto"} aria-hidden="true" />{gravando ? `Registro por voz ativo, ${tempo}` : "Registro por voz pausado"}</span>}
            </div>
            {!ativo ? (
              <button type="button" className="gravar" onClick={entrar} style={{ marginTop: 12 }}>Entrar na sala</button>
            ) : (
              <div className="controles">
                <button type="button" className="btn-sec" onClick={alternarMic} aria-pressed={!micOn}>{micOn ? "Desligar microfone" : "Ligar microfone"}</button>
                <button type="button" className="btn-sec" onClick={alternarCam} aria-pressed={!camOn}>{camOn ? "Desligar câmera" : "Ligar câmera"}</button>
                <button type="button" onClick={encerrarComFicha}>Encerrar e montar a ficha</button>
                <button type="button" className="link" onClick={encerrarSemFicha}>Encerrar sem ficha</button>
              </div>
            )}
            {ativo && segundos >= LIMITE_S && <p className="muted">O registro por voz cobre os primeiros 60 minutos. O restante você pode completar na revisão da ficha.</p>}
            <p className="muted">A chamada não é gravada em vídeo. Ao encerrar, a conversa é transcrita e vira a ficha para a sua revisão.</p>
          </section>

          <aside className="sala-lado">
            <div className="card">
              <h2 style={{ marginTop: 0 }}>Antes da consulta</h2>
              <ul className="lista-check">
                <li className={t.consentimento_em ? "feito" : ""}>{t.consentimento_em ? `Termo aceito às ${horaDe(t.consentimento_em)}` : "Termo ainda não aceito"}</li>
                {t.pagamento_status !== "isento" && (
                  <li className={t.pagamento_status === "confirmado" ? "feito" : ""}>
                    {t.pagamento_status === "confirmado" ? `Pagamento confirmado${t.valor ? `, ${reais(Number(t.valor))}` : ""}` : t.pagamento_status === "informado" ? "Paciente informou o pagamento; confira no banco" : "Pagamento pendente"}
                  </li>
                )}
                <li className={t.preconsulta ? "feito" : ""}>{t.preconsulta ? "Pré-consulta respondida" : "Pré-consulta não respondida"}</li>
                <li className={t.paciente_na_espera_em ? "feito" : ""}>{t.paciente_na_espera_em ? "Paciente chegou à sala de espera" : "Paciente ainda não entrou"}</li>
              </ul>
              {pagamentoPendente && t.valor ? <p className="muted" style={{ marginBottom: 0 }}>Você pode iniciar mesmo sem a confirmação do pagamento.</p> : null}
            </div>
            {t.preconsulta && (
              <div className="card">
                <h2 style={{ marginTop: 0 }}>Respostas do paciente</h2>
                {t.preconsulta.motivo && <p><b>Motivo:</b> {t.preconsulta.motivo}</p>}
                {t.preconsulta.medicamentos && <p><b>Remédios de uso diário:</b> {t.preconsulta.medicamentos}</p>}
                {t.preconsulta.alergias && <p style={{ marginBottom: 0 }}><b>Alergia a medicamento:</b> {t.preconsulta.alergias}</p>}
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
