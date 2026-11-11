"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { PROFISSOES, ESPECIALIDADES_MEDICAS } from "@/lib/modelos";

export default function Perfil() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [profissao, setProfissao] = useState(PROFISSOES[0]);
  const [especialidade, setEspecialidade] = useState("Clínica médica");
  const [conselho, setConselho] = useState("");
  const [preferencias, setPreferencias] = useState("");
  const [msg, setMsg] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const sb = supabaseBrowser();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      setId(user.id);
      const { data } = await sb.from("profissionais").select("*").eq("id", user.id).maybeSingle();
      if (data) {
        setNome(data.nome ?? "");
        setProfissao(data.profissao ?? PROFISSOES[0]);
        setEspecialidade(data.especialidade ?? "");
        setConselho(data.conselho ?? "");
        setPreferencias(data.preferencias ?? "");
      }
    })();
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    const { error } = await supabaseBrowser().from("profissionais").upsert({ id, nome, profissao, especialidade, conselho, preferencias });
    setMsg(error ? { tipo: "erro", texto: "Não foi possível salvar: " + error.message } : { tipo: "ok", texto: "Perfil salvo." });
    if (!error) setTimeout(() => { router.push("/"); router.refresh(); }, 800);
  }

  return (
    <>
      <div className="row">
        <h1>Meu perfil</h1>
        <a className="btn btn-sec" href="/">Voltar</a>
      </div>
      <form className="card" onSubmit={salvar}>
        <label>Nome completo</label>
        <input value={nome} onChange={(e) => setNome(e.target.value)} required />
        <div className="grid" style={{ marginTop: 10 }}>
          <div>
            <label>Profissão</label>
            <select value={profissao} onChange={(e) => { setProfissao(e.target.value); if (e.target.value !== "Médico(a)") setEspecialidade(""); else setEspecialidade("Clínica médica"); }}>
              {PROFISSOES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label>Especialidade</label>
            {profissao === "Médico(a)" ? (
              <select value={especialidade} onChange={(e) => setEspecialidade(e.target.value)}>
                {ESPECIALIDADES_MEDICAS.map((s) => <option key={s}>{s}</option>)}
              </select>
            ) : (
              <input placeholder="Opcional" value={especialidade} onChange={(e) => setEspecialidade(e.target.value)} />
            )}
          </div>
          <div>
            <label>Registro no conselho</label>
            <input value={conselho} onChange={(e) => setConselho(e.target.value)} />
          </div>
        </div>
        <div style={{ height: 10 }} />
        <label>Preferências de escrita (opcional)</label>
        <textarea rows={3} placeholder="Ex.: usar abreviações HAS e DM; escrever conduta em tópicos; não usar termos em inglês." value={preferencias} onChange={(e) => setPreferencias(e.target.value)} />
        <p className="muted">A IA segue estas preferências em todos os seus registros.</p>
        {msg && <div className={msg.tipo} style={{ marginBottom: 10 }}>{msg.texto}</div>}
        <button type="submit" style={{ width: "100%" }}>Salvar perfil</button>
      </form>
    </>
  );
}
