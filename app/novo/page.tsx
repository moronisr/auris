"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { MODELOS, camposDoModelo, modeloPadrao, type Campo, type Ficha } from "@/lib/modelos";
import { formatarCpf, validarFicha } from "@/lib/validacao";

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
  const router = useRouter();
  const [modelo, setModelo] = useState("geral");
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

  useEffect(() => {
    (async () => {
      const sb = supabaseBrowser();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      const { data } = await sb.from("profissionais").select("profissao, especialidade").eq("id", user.id).maybeSingle();
      setModelo(modeloPadrao(data?.profissao, data?.especialidade));
    })();
  }, []);

  async function iniciar() {
    setErro(null);
    if (modo === "consulta" && !consentimento)
      return setErro("Antes de iniciar, marque que você avisou o paciente sobre o registro com IA.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Áudio de voz em qualidade leve: mantém consultas longas dentro do limite de envio.
      const mr = new MediaRecorder(stream, { audioBitsPerSecond: 24000 });
      partes.current = [];
      mr.ondataavailable = (e) => e.data.size && partes.current.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        enviar(new Blob(partes.current, { type: mr.mimeType || "audio/webm" }));
      };
      mr.start();
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

  async function enviar(audio: Blob) {
    const fd = new FormData();
    fd.append("audio", audio, "ditado.webm");
    fd.append("modelo", modelo);
    fd.append("modo", modo);
    if (modo === "consulta" && consentimento) fd.append("consentimento", "sim");
    try {
      const r = await fetch("/api/processar", { method: "POST", body: fd });
      const data = await r.json();
      if (!r.ok) throw new Error(data.erro || "Falha ao processar.");
      setRes(data);
      setFicha(data.ficha);
      setEtapa("revisar");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao processar.");
      setEtapa("pronto");
    }
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
      dados: ficha,
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
        {c.tipo === "longo" ? (
          <textarea rows={3} value={texto} onChange={(e) => alterar(c, e.target.value)} />
        ) : (
          <input value={texto} onChange={(e) => alterar(c, e.target.value)} inputMode={c.tipo === "texto" ? "text" : "decimal"} />
        )}
      </div>
    );
  };

  return (
    <>
      <div className="row">
        <h1>Novo registro</h1>
        <a className="btn btn-sec" href="/">Voltar</a>
      </div>

      {erro && <div className="erro" style={{ marginBottom: 12 }}>{erro}</div>}

      {(etapa === "pronto" || etapa === "gravando") && (
        <div className="card">
          <label>Como você quer registrar?</label>
          <div className="row" style={{ justifyContent: "flex-start", marginBottom: 10 }}>
            <button type="button" className={modo === "ditado" ? "" : "btn-sec"} disabled={etapa === "gravando"} onClick={() => setModo("ditado")}>🗣️ Ditado</button>
            <button type="button" className={modo === "consulta" ? "" : "btn-sec"} disabled={etapa === "gravando"} onClick={() => setModo("consulta")}>👥 Consulta (conversa)</button>
          </div>
          <p className="muted" style={{ marginTop: 0 }}>
            {modo === "ditado"
              ? "Você fala sozinho, após o atendimento, e a IA organiza o registro."
              : "Grave a conversa com o paciente, mesmo informal. A IA identifica quem fala e extrai nome, endereço, queixas e observações. Máx. 20 minutos."}
          </p>
          {modo === "consulta" && (
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 14, color: "#0f172a", marginBottom: 12 }}>
              <input type="checkbox" style={{ width: 20, height: 20, flex: "none" }} checked={consentimento} onChange={(e) => setConsentimento(e.target.checked)} />
              Avisei o paciente, no início da consulta, que uso um sistema com IA para registrar o atendimento. O áudio é apagado após a transcrição.
            </label>
          )}
          <label>Tipo de registro</label>
          <select value={modelo} onChange={(e) => setModelo(e.target.value)} disabled={etapa === "gravando"}>
            {Object.values(MODELOS).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
          {modo === "ditado" && <p className="muted">Exemplo de ditado: {EXEMPLOS[modelo]}</p>}
          {etapa === "pronto" ? (
            <button className="gravar" onClick={iniciar}>{modo === "consulta" ? "🎙️ Iniciar consulta" : "🎙️ Gravar"}</button>
          ) : (
            <button className="gravar gravando" onClick={parar}>⏹️ Parar ({Math.floor(segundos / 60)}:{String(segundos % 60).padStart(2, "0")})</button>
          )}
        </div>
      )}

      {etapa === "processando" && <div className="card">⏳ Transcrevendo e organizando o registro...</div>}

      {(etapa === "revisar" || etapa === "salvando") && ficha && (
        <>
          {avisos.map((a) => <div className="aviso" key={a}>⚠️ {a}</div>)}
          <div className="card">
            <div className="muted">{MODELOS[res?.modelo ?? modelo]?.nome} · revise antes de aprovar</div>
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
            <button onClick={aprovar} disabled={etapa === "salvando"}>{etapa === "salvando" ? "Salvando..." : "✅ Aprovar e gerar ficha"}</button>
          </div>
        </>
      )}
    </>
  );
}
