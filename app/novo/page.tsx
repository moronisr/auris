"use client";
import { useAcesso } from "@/lib/useAcesso";
import CampoCid from "@/components/CampoCid";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { MODELOS, AREAS_ATENDIMENTO, camposDoModelo, modeloDaArea, type Campo, type Ficha } from "@/lib/modelos";

/** Escolhe um formato de gravação que o aparelho suporte (iPhone grava em mp4, Android/PC em webm). */
function formatoSuportado(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const opcoes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/aac"];
  return opcoes.find((t) => MediaRecorder.isTypeSupported?.(t));
}
import { formatarCpf, validarFicha } from "@/lib/validacao";
import { guardarPendente, apagarPendente, lerPendente, type AudioPendente, type ConfigEnvio } from "@/lib/audioPendente";

type Resultado = { transcricao: string; ficha: Ficha; avisos: string[]; modelo: string; modo: string; tempo_processamento_ms: number };
type Modo = "ditado" | "consulta";
const LIMITE_CONSULTA_S = 20 * 60; // 20 minutos (limite de tamanho do envio)
type Etapa = "pronto" | "gravando" | "processando" | "revisar" | "salvando";

const EXEMPLOS: Record<string, string> = {
  geral: "“Paciente João Pereira, 55 anos. Queixa de dor de cabeça há três dias, pior à tarde. Hipertenso, usa losartana 50 mg. Pressão 150 por 95. Impressão: cefaleia tensional, descartar crise hipertensiva. Conduta: ajustar losartana para 100 mg, solicitar hemograma. Retorno em um mês.”",
  oftalmologia: "“Paciente Maria da Silva, 42 anos, CPF 529 982 247 25. Olho direito menos dois esférico, menos meio cilíndrico, eixo 180. Olho esquerdo menos um e setenta e cinco. Adição mais dois. Retorno em um ano.”",
  psicologia: "“Paciente Ana Souza, 30 anos, quarta sessão. Relata melhora no sono e mais segurança no trabalho, ainda ansiedade antes de reuniões. Trabalhamos técnicas de respiração e reestruturação de pensamentos. Plano: manter sessões semanais.”",
};

export default function Novo() {
  const acessoAss = useAcesso();
  const router = useRouter();
  const [modelo, setModelo] = useState("geral");
  const [area, setArea] = useState("Clínica médica");
  const [modo, setModo] = useState<Modo>("ditado");
  const [consentimento, setConsentimento] = useState(false);
  const [etapa, setEtapa] = useState<Etapa>("pronto");
  const [erro, setErro] = useState<string | null>(null);
  const [res, setRes] = useState<Resultado | null>(null);
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [segundos, setSegundos] = useState(0);
  const gravador = useRef<MediaRecorder | null>(null);
  const partes = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [tele, setTele] = useState<string | null>(null);
  const veioDeTele = useRef(false);
  const ultimoEnvio = useRef<{ audio: Blob; cfg: ConfigEnvio } | null>(null);
  const [temReenvio, setTemReenvio] = useState(false);
  const [pendente, setPendente] = useState<AudioPendente | null>(null);

  // Gravação que não virou ficha (queda de internet ou navegador fechado): oferece enviar de novo.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tele")) return;
    lerPendente().then((p) => p && setPendente(p));
  }, []);

  // Ficha vinda de uma teleconsulta encerrada: abre direto na revisão.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("tele");
    if (!id) return;
    try {
      const s = JSON.parse(sessionStorage.getItem("auris_tele_resultado") || "null");
      if (s?.tele === id && s.res?.ficha) {
        veioDeTele.current = true;
        setTele(id);
        setModo("consulta");
        setModelo(s.res.modelo);
        setRes(s.res as Resultado);
        setFicha(s.res.ficha);
        setEtapa("revisar");
      }
    } catch { /* sem armazenamento: o profissional dita o atendimento */ }
  }, []);

  useEffect(() => {
    (async () => {
      const sb = supabaseBrowser();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      const { data } = await sb.from("profissionais").select("profissao, especialidade").eq("id", user.id).maybeSingle();
      const a = data?.profissao === "Médico(a)" ? data?.especialidade : data?.profissao;
      const existe = AREAS_ATENDIMENTO.some((g) => g.itens.includes(a ?? ""));
      const escolhida = a && existe ? a : "Clínica médica";
      setArea(escolhida);
      // Na ficha vinda da teleconsulta, o modelo já foi escolhido ao montar a ficha.
      if (!veioDeTele.current) setModelo(modeloDaArea(escolhida));
    })();
  }, []);

  async function iniciar() {
    setErro(null);
    if (modo === "consulta" && !consentimento)
      return setErro("Antes de iniciar, marque que combinou com o paciente o uso do Auris no registro.");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined")
      return setErro("Este navegador não permite gravar áudio. No iPhone use o Safari atualizado; no Android, o Chrome.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const mimeType = formatoSuportado();
      // Áudio de voz em qualidade leve: mantém consultas longas dentro do limite de envio.
      let mr: MediaRecorder;
      try {
        mr = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 32000 });
      } catch {
        mr = new MediaRecorder(stream);
      }
      partes.current = [];
      mr.ondataavailable = (e) => e.data.size && partes.current.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        enviar(new Blob(partes.current, { type: mr.mimeType || "audio/webm" }));
      };
      mr.start(1000); // entrega o áudio em partes a cada segundo (necessário em alguns celulares)
      gravador.current = mr;
      setSegundos(0);
      timer.current = setInterval(() => {
        setSegundos((s) => {
          const limite = modo === "consulta" ? LIMITE_CONSULTA_S : 10 * 60;
          if (s + 1 >= limite) setTimeout(() => parar(), 0);
          return s + 1;
        });
      }, 1000);
      setEtapa("gravando");
    } catch {
      setErro("Não consegui acessar o microfone. Permita o uso do microfone no navegador.");
    }
  }

  function parar() {
    if (timer.current) clearInterval(timer.current);
    gravador.current?.stop();
    setEtapa("processando");
  }

  async function enviar(audio: Blob, cfg: ConfigEnvio = { area, modelo, modo, consentimento }) {
    const fd = new FormData();
    if (audio.size < 2000) {
      setErro("A gravação ficou vazia. Verifique se o microfone está liberado e grave novamente.");
      setEtapa("pronto");
      return;
    }
    if (audio.size > 4.4 * 1024 * 1024) {
      setErro("A gravação ficou grande demais para envio. Grave consultas de até 20 minutos.");
      setEtapa("pronto");
      return;
    }
    const ext = audio.type.includes("mp4") || audio.type.includes("aac") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
    fd.append("audio", audio, `gravacao.${ext}`);
    fd.append("area", cfg.area);
    fd.append("modelo", cfg.modelo);
    fd.append("modo", cfg.modo);
    if (cfg.modo === "consulta" && cfg.consentimento) fd.append("consentimento", "sim");
    // Guarda a gravação neste aparelho até a ficha ficar pronta, para nunca precisar regravar.
    ultimoEnvio.current = { audio, cfg };
    setTemReenvio(false);
    setPendente(null);
    setErro(null);
    setEtapa("processando");
    await guardarPendente({ ...cfg, audio, em: Date.now() });
    const semRede = (m: string) => m === "Failed to fetch" || m.includes("NetworkError") || m.includes("Load failed");
    let ultimoErro = "";
    // Até 2 envios automáticos: se a internet oscilar ou o servidor falhar, tenta de novo sozinho.
    for (let tentativa = 1; tentativa <= 2; tentativa++) {
      try {
        const r = await fetch("/api/processar", { method: "POST", body: fd });
        const bruto = await r.text();
        let data: { erro?: string } & Partial<Resultado>;
        try {
          data = JSON.parse(bruto);
        } catch {
          throw Object.assign(new Error(r.status === 413 ? "A gravação ficou grande demais para envio." : `Falha de conexão com o servidor (código ${r.status}).`), { repetir: r.status >= 500 });
        }
        if (!r.ok) throw Object.assign(new Error(data.erro || "Falha ao processar."), { repetir: r.status >= 500 });
        await apagarPendente();
        ultimoEnvio.current = null;
        setRes(data as Resultado);
        setFicha((data as Resultado).ficha);
        setEtapa("revisar");
        return;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        ultimoErro = semRede(msg) ? "Sem conexão com a internet no momento do envio." : msg || "Falha ao processar.";
        const repetir = semRede(msg) || (e as { repetir?: boolean }).repetir === true;
        if (tentativa === 2 || !repetir) break;
        await new Promise((ok) => setTimeout(ok, 4000));
      }
    }
    setErro(`${ultimoErro} A gravação ficou guardada neste aparelho: toque em "Enviar a gravação de novo" quando quiser, sem precisar gravar outra vez.`);
    setTemReenvio(true);
    setEtapa("pronto");
  }

  function reenviar() {
    if (ultimoEnvio.current) enviar(ultimoEnvio.current.audio, ultimoEnvio.current.cfg);
  }

  function enviarPendente() {
    if (!pendente) return;
    const { audio, em: _em, ...cfg } = pendente;
    setModo(cfg.modo); setArea(cfg.area); setModelo(cfg.modelo); setConsentimento(cfg.consentimento);
    enviar(audio, cfg);
  }

  async function descartarPendente() {
    await apagarPendente();
    setPendente(null);
  }

  function alterar(c: Campo, valor: string) {
    if (!ficha) return;
    const numerico = c.tipo === "numero" || c.tipo === "inteiro";
    const v = valor.trim() === "" ? null : numerico ? Number(valor.replace(",", ".")) : valor;
    setFicha({ ...ficha, [c.chave]: v });
  }

  async function aprovar() {
    if (!ficha || !res) return;
    if (!ficha.paciente_nome) return setErro("Informe o nome do paciente antes de aprovar.");
    setEtapa("salvando");
    const corrigido = JSON.stringify(ficha) !== JSON.stringify(res.ficha);
    const meses = typeof ficha.retorno_meses === "number" ? ficha.retorno_meses : null;
    let retorno_data: string | null = null;
    if (meses) {
      const d = new Date();
      d.setMonth(d.getMonth() + meses);
      retorno_data = d.toISOString().slice(0, 10);
    }
    const s = (k: string) => (ficha[k] == null ? null : String(ficha[k]));
    const { data, error } = await supabaseBrowser().from("registros").insert({
      modelo: res.modelo,
      // O uso de IA fica registrado no prontuário (presencial: o profissional confirmou que avisou o paciente).
      dados: { ...ficha, ...(tele ? {} : { _atendimento: modo === "consulta" ? "presencial_conversa" : "ditado", ...(modo === "consulta" && consentimento ? { _ia_paciente_informado_em: new Date().toISOString() } : {}) }) },
      paciente_nome: s("paciente_nome"),
      paciente_idade: typeof ficha.paciente_idade === "number" ? ficha.paciente_idade : null,
      paciente_cpf: s("paciente_cpf")?.replace(/\D/g, "") || null,
      paciente_telefone: s("paciente_telefone"),
      paciente_email: s("paciente_email"),
      retorno_meses: meses,
      retorno_data,
      transcricao: res.transcricao,
      tempo_processamento_ms: res.tempo_processamento_ms,
      corrigido_pelo_medico: corrigido,
    }).select("id").single();
    if (error) {
      setErro("Erro ao salvar: " + error.message);
      setEtapa("revisar");
      return;
    }
    if (tele) {
      await supabaseBrowser().from("teleconsultas").update({ registro_id: data.id }).eq("id", tele);
      try { sessionStorage.removeItem("auris_tele_resultado"); } catch { /* opcional */ }
    }
    router.push(`/registro/${data.id}`);
  }

  const campos = camposDoModelo(res?.modelo ?? modelo);
  const grupos = [...new Set(campos.map((c) => c.grupo))];
  const avisos = ficha ? validarFicha(ficha, res?.modelo ?? modelo) : [];

  const input = (c: Campo) => {
    const valor = ficha?.[c.chave];
    const texto = valor == null ? "" : c.chave === "paciente_cpf" ? formatarCpf(String(valor)) : String(valor).replace(/^(-?\d+)\.(\d+)$/, "$1,$2");
    return (
      <div key={c.chave} style={c.tipo === "longo" ? { gridColumn: "1 / -1" } : undefined}>
        <label>{c.rotulo}</label>
        {c.chave === "cid10" ? (
          <CampoCid valor={texto} onChange={(v) => setFicha((f) => (f ? { ...f, cid10: v.trim() === "" ? null : v } : f))} />
        ) : c.tipo === "longo" ? (
          <textarea rows={3} value={texto} onChange={(e) => alterar(c, e.target.value)} />
        ) : (
          <input value={texto} onChange={(e) => alterar(c, e.target.value)} inputMode={c.tipo === "texto" ? "text" : "decimal"} />
        )}
      </div>
    );
  };

  if (acessoAss?.acesso === "bloqueado") return (
    <>
      <div className="row">
        <h1>{tele ? "Ficha da teleconsulta" : "Novo registro"}</h1>
        <a className="btn btn-sec" href="/">Voltar</a>
      </div>
      {acessoAss?.acesso === "bloqueado" && (
        <div className="card bloqueio">
          <h2 style={{ marginTop: 0 }}>Assinatura inativa</h2>
          <p className="muted">Você continua podendo consultar e exportar suas fichas e consultas. Para registrar novas fichas, ative um plano.</p>
          <a className="btn" href="/financas">Ativar plano</a>
        </div>
      )}
    </>
  );

  return (
    <>
      <div className="row">
        <h1>{tele ? "Ficha da teleconsulta" : "Novo registro"}</h1>
        <a className="btn btn-sec" href="/">Voltar</a>
      </div>

      {erro && <div className="erro" style={{ marginBottom: 12 }}>{erro}</div>}
      {temReenvio && etapa === "pronto" && (
        <div className="acoes-ficha" style={{ marginBottom: 12 }}>
          <button type="button" onClick={reenviar}>Enviar a gravação de novo</button>
        </div>
      )}
      {pendente && etapa === "pronto" && !temReenvio && (
        <div className="card" style={{ marginBottom: 12 }}>
          <p style={{ marginTop: 0 }}>
            Há uma gravação de {new Date(pendente.em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} que ainda não virou ficha. Ela está guardada só neste aparelho.
          </p>
          <div className="acoes-ficha">
            <button type="button" onClick={enviarPendente}>Montar a ficha dessa gravação</button>
            <button type="button" className="btn-sec" onClick={descartarPendente}>Descartar</button>
          </div>
        </div>
      )}

      {(etapa === "pronto" || etapa === "gravando") && (
        <div className="card">
          <label>Como você quer registrar?</label>
          <div className="row" data-ajuda="modo" style={{ justifyContent: "flex-start", marginBottom: 10 }}>
            <button type="button" className={modo === "ditado" ? "" : "btn-sec"} disabled={etapa === "gravando"} onClick={() => setModo("ditado")}>Ditado</button>
            <button type="button" className={modo === "consulta" ? "" : "btn-sec"} disabled={etapa === "gravando"} onClick={() => setModo("consulta")}>Consulta (conversa)</button>
          </div>
          <p className="muted" style={{ marginTop: 0 }}>
            {modo === "ditado"
              ? "Você fala sozinho, após o atendimento, e a IA organiza o registro."
              : "Grave a conversa com o paciente, mesmo informal. A IA identifica quem fala e extrai nome, endereço, queixas e observações. Máx. 20 minutos."}
          </p>
          {modo === "consulta" && (
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 14, color: "#0f172a", marginBottom: 12 }}>
              <input type="checkbox" style={{ width: 20, height: 20, flex: "none" }} checked={consentimento} onChange={(e) => setConsentimento(e.target.checked)} />
              <span>Combinei com o paciente que uso o Auris para escrever o registro desta consulta.
                <span className="muted" style={{ display: "block", marginTop: 4 }}>Sugestão de frase: &quot;Eu uso um assistente que me ajuda a escrever o prontuário, assim consigo prestar mais atenção em você. Tudo bem?&quot; Se o paciente preferir que não, é só não gravar.</span>
              </span>
            </label>
          )}
          <label>Especialidade / área do atendimento</label>
          <select data-ajuda="area" value={area} disabled={etapa === "gravando"} onChange={(e) => { setArea(e.target.value); setModelo(modeloDaArea(e.target.value)); }}>
            {AREAS_ATENDIMENTO.map((g) => (
              <optgroup key={g.grupo} label={g.grupo}>
                {g.itens.map((i) => <option key={i} value={i}>{i}</option>)}
              </optgroup>
            ))}
          </select>
          <div style={{ height: 10 }} />
          <label>Formato da ficha (define quais campos aparecem; já vem escolhido pela especialidade, e você pode trocar)</label>
          <select value={modelo} onChange={(e) => setModelo(e.target.value)} disabled={etapa === "gravando"}>
            {Object.values(MODELOS).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
          {modo === "ditado" && <p className="muted">Exemplo de ditado: {EXEMPLOS[modelo]}</p>}
          {etapa === "pronto" ? (
            <button className="gravar" data-ajuda="gravar" onClick={iniciar}>{modo === "consulta" ? "Iniciar consulta" : "Iniciar gravação"}</button>
          ) : (
            <button className="gravar gravando" onClick={parar}>Parar ({Math.floor(segundos / 60)}:{String(segundos % 60).padStart(2, "0")})</button>
          )}
        </div>
      )}

      {etapa === "processando" && <div className="card">Transcrevendo e organizando o registro. Isso leva alguns segundos.</div>}

      {(etapa === "revisar" || etapa === "salvando") && ficha && (
        <>
          {avisos.map((a) => <div className="aviso" key={a}>{a}</div>)}
          <div className="card">
            <div className="muted">{MODELOS[res?.modelo ?? modelo]?.nome}. Revise antes de aprovar.</div>
            {grupos.map((g) => (
              <div key={g}>
                <div className="olho">{g}</div>
                <div className="grid">{campos.filter((c) => c.grupo === g).map(input)}</div>
              </div>
            ))}
            <details style={{ marginTop: 12 }}>
              <summary>Ver transcrição do áudio</summary>
              <p className="muted" style={{ whiteSpace: "pre-wrap" }}>{res?.transcricao}</p>
            </details>
          </div>
          <div className="row">
            <button className="btn-sec" onClick={() => { setFicha(null); setRes(null); setEtapa("pronto"); }}>Gravar de novo</button>
            <button data-ajuda="aprovar" onClick={aprovar} disabled={etapa === "salvando"}>{etapa === "salvando" ? "Salvando..." : "Aprovar e gerar ficha"}</button>
          </div>
        </>
      )}
    </>
  );
}
