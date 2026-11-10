"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function Login() {
  const router = useRouter();
  const [modo, setModo] = useState<"entrar" | "cadastrar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [profissao, setProfissao] = useState("Médico(a)");
  const [especialidade, setEspecialidade] = useState("Oftalmologia");
  const [conselho, setConselho] = useState("");
  const [msg, setMsg] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setMsg(null);
    const sb = supabaseBrowser();
    try {
      if (modo === "entrar") {
        const { error } = await sb.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
        router.push("/");
        router.refresh();
      } else {
        // O perfil é criado pelo banco (gatilho) a partir destes dados.
        const { data, error } = await sb.auth.signUp({
          email,
          password: senha,
          options: { data: { nome, profissao, especialidade, conselho } },
        });
        if (error) throw error;
        if (data.session) {
          router.push("/");
          router.refresh();
        } else {
          setMsg({ tipo: "ok", texto: "Conta criada. Confirme o e-mail que enviamos e depois entre." });
          setModo("entrar");
        }
      }
    } catch (err) {
      setMsg({ tipo: "erro", texto: err instanceof Error ? err.message : "Erro ao entrar." });
    } finally {
      setCarregando(false);
    }
  }

  return (
    <>
      <h1>Ditado Clínico</h1>
      <p className="muted">Registre o atendimento falando. A IA organiza, você revisa e aprova.</p>
      <form className="card" onSubmit={enviar}>
        {modo === "cadastrar" && (
          <>
            <label>Nome completo</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} required />
            <div className="grid" style={{ marginTop: 10 }}>
              <div>
                <label>Profissão</label>
                <select value={profissao} onChange={(e) => setProfissao(e.target.value)}>
                  <option>Médico(a)</option>
                </select>
              </div>
              <div>
                <label>Especialidade</label>
                <select value={especialidade} onChange={(e) => setEspecialidade(e.target.value)}>
                  <option>Oftalmologia</option>
                </select>
              </div>
              <div>
                <label>Conselho (ex.: CRM-PA 12345)</label>
                <input value={conselho} onChange={(e) => setConselho(e.target.value)} />
              </div>
            </div>
            <div style={{ height: 10 }} />
          </>
        )}
        <label>E-mail</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <div style={{ height: 10 }} />
        <label>Senha (mínimo 8 caracteres)</label>
        <input type="password" minLength={8} value={senha} onChange={(e) => setSenha(e.target.value)} required />
        <div style={{ height: 14 }} />
        {msg && <div className={msg.tipo} style={{ marginBottom: 10 }}>{msg.texto}</div>}
        <button type="submit" disabled={carregando} style={{ width: "100%" }}>
          {carregando ? "Aguarde..." : modo === "entrar" ? "Entrar" : "Criar conta"}
        </button>
      </form>
      <button className="btn-sec" style={{ width: "100%" }} onClick={() => setModo(modo === "entrar" ? "cadastrar" : "entrar")}>
        {modo === "entrar" ? "Não tem conta? Cadastre-se" : "Já tenho conta"}
      </button>
    </>
  );
}
