"use client";
import { useEffect, useState } from "react";
import { DOCUMENTOS, gerarPdfDocumento, textoInicial, type ConteudoEntrega, type TipoDocumento } from "@/lib/documentos";
import { supabaseBrowser } from "@/lib/supabase/client";
import { linkWhatsApp, mascaraData, nascimentoIso, novoCodigo, sha256 } from "@/lib/teleconsulta";

type Props = {
  dados: Record<string, string | number | null>;
  registroId: string;
  telefone: string;
  prof: { nome: string; especialidade: string; conselho: string };
};

export default function FormDocumentos({ dados, prof, registroId, telefone }: Props) {
  const [tipo, setTipo] = useState<TipoDocumento>("resumo");
  const [textos, setTextos] = useState<Record<TipoDocumento, string>>(() => ({
    resumo: textoInicial("resumo", dados),
    atestado: textoInicial("atestado", dados),
    exames: textoInicial("exames", dados),
    encaminhamento: textoInicial("encaminhamento", dados),
  }));
  const [dias, setDias] = useState("");
  const [destino, setDestino] = useState("");
  const [paciente, setPaciente] = useState(String(dados.paciente_nome ?? ""));
  const [registro, setRegistro] = useState(prof.conselho);
  const [endereco, setEndereco] = useState("");
  const [cidade, setCidade] = useState("");
  const [revisei, setRevisei] = useState(false);
  const [erro, setErro] = useState("");
  const [pronto, setPronto] = useState("");
  const [gerando, setGerando] = useState(false);
  const [envio, setEnvio] = useState<Record<TipoDocumento, boolean>>({ resumo: true, atestado: false, exames: false, encaminhamento: false });
  const [nascEnvio, setNascEnvio] = useState(() => (/^\d{2}\/\d{2}\/\d{4}$/.test(String(dados.paciente_data_nascimento ?? "")) ? String(dados.paciente_data_nascimento) : ""));
  const [telEnvio, setTelEnvio] = useState(telefone);
  const [reviseiEnvio, setReviseiEnvio] = useState(false);
  const [erroEnvio, setErroEnvio] = useState("");
  const [linkPaciente, setLinkPaciente] = useState("");
  const [criandoLink, setCriandoLink] = useState(false);
  const [copiadoLink, setCopiadoLink] = useState(false);
  const [whats, setWhats] = useState(false);
  const [codigoCriado, setCodigoCriado] = useState({ codigo: "", hash: "" });
  const [envioWhats, setEnvioWhats] = useState("");

  useEffect(() => {
    fetch("/api/whatsapp").then((r) => r.json()).then((d) => setWhats(!!d.ativo)).catch(() => setWhats(false));
    try {
      setEndereco(localStorage.getItem("auris_endereco_consultorio") ?? "");
      setCidade(localStorage.getItem("auris_cidade") ?? "");
    } catch { /* sem armazenamento local: o profissional digita de novo */ }
  }, []);

  const doc = DOCUMENTOS.find((x) => x.id === tipo)!;
  const mudarTexto = (v: string) => { setPronto(""); setRevisei(false); setTextos({ ...textos, [tipo]: v }); };
  const trocar = (t: TipoDocumento) => { setTipo(t); setErro(""); setPronto(""); setRevisei(false); };
  const refazer = (novoDias = dias, novoDestino = destino) =>
    setTextos((atual) => ({ ...atual, [tipo]: textoInicial(tipo, { ...dados, paciente_nome: paciente }, { dias: novoDias, destino: novoDestino }) }));

  async function gerar() {
    setErro(""); setPronto("");
    if (!paciente.trim()) return setErro("Informe o nome do paciente.");
    if (!registro.trim()) return setErro("Informe o seu registro no conselho (ex.: CRM-PA 12345).");
    if (!textos[tipo].trim()) return setErro("O documento está vazio. Escreva o texto antes de gerar.");
    if (!revisei) return setErro("Marque que você revisou o documento antes de gerar.");
    setGerando(true);
    try {
      try { localStorage.setItem("auris_endereco_consultorio", endereco); localStorage.setItem("auris_cidade", cidade); } catch { /* opcional */ }
      const bytes = await gerarPdfDocumento({
        titulo: doc.titulo, profissional: prof.nome, registro, especialidade: prof.especialidade,
        enderecoConsultorio: endereco, paciente, cidade, corpo: textos[tipo],
      });
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tipo}-${paciente.trim().toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-")}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setPronto(doc.nome);
    } catch {
      setErro("Não consegui gerar o PDF. Tente de novo.");
    } finally {
      setGerando(false);
    }
  }

  async function criarLink() {
    setErroEnvio(""); setLinkPaciente("");
    const escolhidos = DOCUMENTOS.filter((x) => envio[x.id] && textos[x.id].trim());
    if (!escolhidos.length) return setErroEnvio("Marque pelo menos um documento com texto.");
    if (!paciente.trim()) return setErroEnvio("Informe o nome do paciente, no topo da tela.");
    const nasc = nascEnvio ? nascimentoIso(nascEnvio) : null;
    if (nascEnvio && !nasc) return setErroEnvio("Data de nascimento inválida. Use DD/MM/AAAA.");
    if (!reviseiEnvio) return setErroEnvio("Marque que você revisou os documentos antes de enviar.");
    setCriandoLink(true);
    const codigo = novoCodigo();
    const conteudo: ConteudoEntrega = {
      paciente: paciente.trim(),
      profissional: { nome: prof.nome, especialidade: prof.especialidade, registro, endereco },
      cidade,
      data: new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }),
      documentos: escolhidos.map((x) => ({ tipo: x.id, nome: x.nome, titulo: x.titulo, texto: textos[x.id] })),
    };
    const hash = await sha256(codigo);
    const { error } = await supabaseBrowser().from("entregas").insert({ registro_id: registroId, codigo_hash: hash, nascimento: nasc, conteudo });
    setCriandoLink(false);
    if (error) return setErroEnvio("Não foi possível criar o link: " + error.message);
    setLinkPaciente(`${window.location.origin}/p/${codigo}`);
    setCodigoCriado({ codigo, hash });
    setEnvioWhats("");
  }

  async function enviarPeloAuris() {
    if (!telEnvio.replace(/\D/g, "")) return setEnvioWhats("Informe o WhatsApp do paciente.");
    setEnvioWhats("Enviando");
    const r = await fetch("/api/whatsapp", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "documentos", codigo: codigoCriado.codigo, codigoHash: codigoCriado.hash, telefone: telEnvio, paciente }) });
    const d = await r.json().catch(() => ({}));
    setEnvioWhats(r.ok ? "Enviado pelo WhatsApp do Auris." : d.erro || "Não foi possível enviar.");
  }

  async function copiarLink() {
    try { await navigator.clipboard.writeText(linkPaciente); setCopiadoLink(true); setTimeout(() => setCopiadoLink(false), 3000); } catch { /* sem permissão */ }
  }

  const mensagemPaciente = `Olá, ${paciente.trim().split(" ")[0]}. Aqui estão o resumo e os documentos da sua consulta com ${prof.nome}:\n${linkPaciente}${nascEnvio ? "\n\nPara abrir, informe a sua data de nascimento." : ""}`;

  return (
    <>
      <div className="abas-doc" role="tablist" aria-label="Tipo de documento">
        {DOCUMENTOS.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={tipo === x.id} className={tipo === x.id ? "aba-doc ativa" : "aba-doc"} onClick={() => trocar(x.id)}>
            {x.nome}
          </button>
        ))}
      </div>

      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>{doc.descricao}</p>
        <div className="grid" style={{ marginBottom: 14 }}>
          <div>
            <label htmlFor="doc-paciente">Paciente</label>
            <input id="doc-paciente" value={paciente} onChange={(e) => { setPaciente(e.target.value); setPronto(""); }} />
          </div>
          <div>
            <label htmlFor="doc-registro">Seu registro no conselho</label>
            <input id="doc-registro" value={registro} onChange={(e) => setRegistro(e.target.value)} placeholder="CRM-PA 12345" />
          </div>
          <div>
            <label htmlFor="doc-cidade">Cidade</label>
            <input id="doc-cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Belém" />
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label htmlFor="doc-endereco">Endereço do consultório (aparece no cabeçalho)</label>
          <input id="doc-endereco" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
        </div>

        {tipo === "atestado" && (
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="doc-dias">Dias de afastamento (deixe vazio para atestado de comparecimento)</label>
            <input id="doc-dias" inputMode="numeric" value={dias} onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); setDias(v); setPronto(""); setRevisei(false); refazer(v, destino); }} style={{ maxWidth: 160 }} />
          </div>
        )}
        {tipo === "encaminhamento" && (
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="doc-destino">Encaminhar para (especialidade ou serviço)</label>
            <input id="doc-destino" value={destino} onChange={(e) => { setDestino(e.target.value); setPronto(""); setRevisei(false); refazer(dias, e.target.value); }} placeholder="Neurologia" />
          </div>
        )}

        <label htmlFor="doc-texto">Texto do documento</label>
        <textarea id="doc-texto" rows={12} value={textos[tipo]} onChange={(e) => mudarTexto(e.target.value)} />
        {!textos[tipo].trim() && (
          <p className="muted">A ficha não tem informações para este documento. Escreva o texto acima.</p>
        )}

        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 14 }}>
          <input type="checkbox" checked={revisei} onChange={(e) => setRevisei(e.target.checked)} style={{ width: 20, height: 20, marginTop: 2, flex: "0 0 20px" }} />
          <span>Revisei o documento e ele está correto.</span>
        </label>

        {erro && <div className="erro" role="alert" style={{ marginTop: 12 }}>{erro}</div>}
        {pronto && (
          <div className="ok" role="status" style={{ marginTop: 12 }}>
            {pronto}: PDF baixado. Se precisar de assinatura eletrônica, envie o arquivo em{" "}
            <a href="https://assinador.iti.br" target="_blank" rel="noreferrer">assinador.iti.br</a> com a sua conta gov.br.
          </div>
        )}
        <button type="button" onClick={gerar} disabled={gerando} style={{ marginTop: 12 }}>
          {gerando ? "Gerando" : `Gerar PDF: ${doc.nome}`}
        </button>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Enviar ao paciente</h2>
        <p className="muted" style={{ marginTop: 0 }}>O paciente recebe um link com os documentos marcados. Ele abre no celular, sem criar conta, e pode baixar em PDF. O link vale por 30 dias.</p>
        <div className="selos" style={{ marginBottom: 12 }}>
          {DOCUMENTOS.map((x) => (
            <label key={x.id} className="marca-envio">
              <input type="checkbox" checked={envio[x.id]} disabled={!textos[x.id].trim()} onChange={(e) => { setEnvio({ ...envio, [x.id]: e.target.checked }); setReviseiEnvio(false); }} />
              <span>{x.nome}{!textos[x.id].trim() ? " (vazio)" : ""}</span>
            </label>
          ))}
        </div>
        <div className="grid">
          <div>
            <label htmlFor="env-nasc">Data de nascimento do paciente</label>
            <input id="env-nasc" inputMode="numeric" placeholder="DD/MM/AAAA" value={nascEnvio} onChange={(e) => setNascEnvio(mascaraData(e.target.value))} />
          </div>
          <div>
            <label htmlFor="env-tel">WhatsApp do paciente</label>
            <input id="env-tel" inputMode="tel" value={telEnvio} onChange={(e) => setTelEnvio(e.target.value)} />
          </div>
        </div>
        <p className="muted">Com a data de nascimento, só quem souber a data consegue abrir o link. Recomendado.</p>
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 6 }}>
          <input type="checkbox" checked={reviseiEnvio} onChange={(e) => setReviseiEnvio(e.target.checked)} style={{ width: 20, height: 20, marginTop: 2, flex: "0 0 20px" }} />
          <span>Revisei os documentos marcados e autorizo o envio ao paciente.</span>
        </label>
        {erroEnvio && <div className="erro" role="alert" style={{ marginTop: 12 }}>{erroEnvio}</div>}
        {!linkPaciente ? (
          <button type="button" onClick={criarLink} disabled={criandoLink} style={{ marginTop: 12 }}>{criandoLink ? "Criando o link" : "Criar o link do paciente"}</button>
        ) : (
          <div className="ok" style={{ marginTop: 12 }}>
            Link criado. Envie agora ao paciente.
            <div className="acoes-ficha" style={{ marginTop: 10 }}>
              {whats && <button type="button" onClick={enviarPeloAuris} disabled={envioWhats === "Enviando"}>Enviar pelo WhatsApp do Auris</button>}
              <a className={whats ? "btn btn-sec" : "btn"} href={linkWhatsApp(telEnvio, mensagemPaciente)} target="_blank" rel="noreferrer">{whats ? "Enviar pelo meu WhatsApp" : "Enviar pelo WhatsApp"}</a>
              <button type="button" className="btn-sec" onClick={copiarLink}>{copiadoLink ? "Link copiado" : "Copiar link"}</button>
            </div>
            {envioWhats && <p style={{ margin: "10px 0 0" }}>{envioWhats}</p>}
          </div>
        )}
      </div>
    </>
  );
}
