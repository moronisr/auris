"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { formatarCpf, validarFicha, type Ficha } from "@/lib/validacao";

type Resultado = { transcricao: string; ficha: Ficha; avisos: string[]; tempo_processamento_ms: number };
type Etapa = "pronto" | "gravando" | "processando" | "revisar" | "salvando";

const CAMPOS_NUM: (keyof Ficha)[] = [
  "paciente_idade", "od_esferico", "od_cilindrico", "od_eixo",
  "oe_esferico", "oe_cilindrico", "oe_eixo", "adicao", "retorno_meses",
];

export default function Novo() {
  const router = useRouter();
  const [etapa, setEtapa] = useState<Etapa>("pronto");
  const [erro, setErro] = useState<string | null>(null);
  const [res, setRes] = useState<Resultado | null>(null);
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [segundos, setSegundos] = useState(0);
  const gravador = useRef<MediaRecorder | null>(null);
  const partes = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function iniciar() {
    setErro(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      partes.current = [];
      mr.ondataavailable = (e) => e.data.size && partes.current.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        enviar(new Blob(partes.current, { type: mr.mimeType || "audio/webm" }));
      };
      mr.start();
      gravador.current = mr;
      setSegundos(0);
      timer.current = setInterval(() => setSegundos((s) => s + 1), 1000);
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

  function alterar(campo: keyof Ficha, valor: string) {
    if (!ficha) return;
    const v = CAMPOS_NUM.includes(campo)
      ? valor.trim() === "" ? null : Number(valor.replace(",", "."))
      : valor.trim() === "" ? null : valor;
    setFicha({ ...ficha, [campo]: v });
  }

  async function aprovar() {
    if (!ficha || !res) return;
    if (!ficha.paciente_nome) return setErro("Informe o nome do paciente antes de aprovar.");
    setEtapa("salvando");
    const corrigido = JSON.stringify(ficha) !== JSON.stringify(res.ficha);
    let retorno_data: string | null = null;
    if (ficha.retorno_meses) {
      const d = new Date();
      d.setMonth(d.getMonth() + ficha.retorno_meses);
      retorno_data = d.toISOString().slice(0, 10);
    }
    const { error } = await supabaseBrowser().from("registros").insert({
      ...ficha,
      paciente_cpf: ficha.paciente_cpf?.replace(/\D/g, "") || null,
      retorno_data,
      transcricao: res.transcricao,
      tempo_processamento_ms: res.tempo_processamento_ms,
      corrigido_pelo_medico: corrigido,
    });
    if (error) {
      setErro("Erro ao salvar: " + error.message);
      setEtapa("revisar");
      return;
    }
    router.push("/");
    router.refresh();
  }

  const avisos = ficha ? validarFicha(ficha) : [];
  const campo = (c: keyof Ficha, rotulo: string) => (
    <div>
      <label>{rotulo}</label>
      <input
        value={ficha?.[c] == null ? "" : String(ficha[c]).replace(".", ",")}
        onChange={(e) => alterar(c, e.target.value)}
        inputMode={CAMPOS_NUM.includes(c) ? "decimal" : "text"}
      />
    </div>
  );

  return (
    <>
      <div className="row">
        <h1>Novo registro</h1>
        <a className="btn btn-sec" href="/">Voltar</a>
      </div>

      {erro && <div className="erro" style={{ marginBottom: 12 }}>{erro}</div>}

      {(etapa === "pronto" || etapa === "gravando") && (
        <div className="card">
          <p className="muted">
            Exemplo: “Paciente Maria da Silva, 42 anos, CPF 123 456 789 09. Olho direito menos dois esférico,
            menos meio cilíndrico, eixo 180. Olho esquerdo menos um e setenta e cinco. Adição mais dois. Retorno em um ano.”
          </p>
          {etapa === "pronto" ? (
            <button className="gravar" onClick={iniciar}>🎙️ Gravar</button>
          ) : (
            <button className="gravar gravando" onClick={parar}>⏹️ Parar ({segundos}s)</button>
          )}
        </div>
      )}

      {etapa === "processando" && <div className="card">⏳ Transcrevendo e organizando a ficha...</div>}

      {(etapa === "revisar" || etapa === "salvando") && ficha && (
        <>
          {avisos.map((a) => <div className="aviso" key={a}>⚠️ {a}</div>)}
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Paciente</h2>
            <div className="grid">
              {campo("paciente_nome", "Nome")}
              {campo("paciente_idade", "Idade")}
              <div>
                <label>CPF</label>
                <input value={ficha.paciente_cpf ? formatarCpf(ficha.paciente_cpf) : ""} onChange={(e) => alterar("paciente_cpf", e.target.value)} inputMode="numeric" />
              </div>
              {campo("paciente_telefone", "Telefone")}
            </div>
            <div className="olho">Olho direito (OD)</div>
            <div className="grid">{campo("od_esferico", "Esférico")}{campo("od_cilindrico", "Cilíndrico")}{campo("od_eixo", "Eixo (°)")}</div>
            <div className="olho">Olho esquerdo (OE)</div>
            <div className="grid">{campo("oe_esferico", "Esférico")}{campo("oe_cilindrico", "Cilíndrico")}{campo("oe_eixo", "Eixo (°)")}</div>
            <div className="olho">Outros</div>
            <div className="grid">{campo("adicao", "Adição")}{campo("dnp", "DNP")}{campo("retorno_meses", "Retorno (meses)")}</div>
            <div style={{ marginTop: 10 }}>
              <label>Observações</label>
              <textarea rows={3} value={ficha.observacoes ?? ""} onChange={(e) => alterar("observacoes", e.target.value)} />
            </div>
            <details style={{ marginTop: 10 }}>
              <summary>Ver transcrição do áudio</summary>
              <p className="muted">{res?.transcricao}</p>
            </details>
          </div>
          <div className="row">
            <button className="btn-sec" onClick={() => { setFicha(null); setRes(null); setEtapa("pronto"); }}>Gravar de novo</button>
            <button onClick={aprovar} disabled={etapa === "salvando"}>{etapa === "salvando" ? "Salvando..." : "✅ Aprovar e salvar"}</button>
          </div>
        </>
      )}
    </>
  );
}
