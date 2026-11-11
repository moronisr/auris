"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { PROFISSOES, ESPECIALIDADES_MEDICAS } from "@/lib/modelos";

function traduzir(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("email not confirmed")) return "Seu e-mail ainda não foi confirmado. Abra o e-mail de confirmação (veja também o spam) e clique no link. Se não chegou, use “Reenviar e-mail de confirmação”.";
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos. Se você acabou de se cadastrar, confirme primeiro o seu e-mail.";
  if (m.includes("already registered")) return "Este e-mail já tem conta. Clique em “Já tenho conta” e entre.";
  if (m.includes("rate limit")) return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.";
  if (m.includes("password")) return "Senha inválida: use no mínimo 8 caracteres.";
  return msg;
}

export default function Login() {
  const router = useRouter();
  const [modo, setModo] = useState<"entrar" | "cadastrar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [profissao, setProfissao] = useState(PROFISSOES[0]);
  const [especialidade, setEspecialidade] = useState("Clínica geral");
  const [conselho, setConselho] = useState("");
  const [msg, setMsg] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("link") === "expirado")
      setMsg({ tipo: "erro", texto: "Este link expirou ou já foi usado. Digite seu e-mail abaixo e clique em “Reenviar e-mail de confirmação” ou “Esqueci minha senha”." });
  }, []);

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
        const esp = profissao === "Médico(a)" ? especialidade : especialidade || profissao;
        const { data, error } = await sb.auth.signUp({
          email,
          password: senha,
          options: {
            data: { nome, profissao, especialidade: esp, conselho },
            emailRedirectTo: `${window.location.origin}/auth/confirm`,
          },
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
      setMsg({ tipo: "erro", texto: traduzir(err instanceof Error ? err.message : "Erro ao entrar.") });
    } finally {
      setCarregando(false);
    }
  }

  return (
    <>
      <h1>Ditado Clínico</h1>
      <p className="muted">Registre o atendimento falando. A IA organiza, você revisa, aprova e gera o PDF.</p>
      <form className="card" onSubmit={enviar}>
        {modo === "cadastrar" && (
          <>
            <label>Nome completo</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} required />
            <div className="grid" style={{ marginTop: 10 }}>
              <div>
                <label>Profissão</label>
                <select value={profissao} onChange={(e) => { setProfissao(e.target.value); setEspecialidade(e.target.value === "Médico(a)" ? "Clínica geral" : ""); }}>
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
                <label>Registro no conselho (ex.: CRM-PA 12345)</label>
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
      {modo === "entrar" && (
        <button
          className="btn-sec"
          style={{ width: "100%", marginBottom: 8 }}
          onClick={async () => {
            if (!email) return setMsg({ tipo: "erro", texto: "Digite seu e-mail acima e clique de novo em reenviar." });
            const { error } = await supabaseBrowser().auth.resend({ type: "signup", email, options: { emailRedirectTo: `${window.location.origin}/auth/confirm` } });
            setMsg(error ? { tipo: "erro", texto: traduzir(error.message) } : { tipo: "ok", texto: "E-mail de confirmação reenviado. Veja sua caixa de entrada e o spam." });
          }}
        >
          Reenviar e-mail de confirmação
        </button>
      )}
      {modo === "entrar" && (
        <button
          className="btn-sec"
          style={{ width: "100%", marginBottom: 8 }}
          onClick={async () => {
            if (!email) return setMsg({ tipo: "erro", texto: "Digite seu e-mail acima e clique de novo em “Esqueci minha senha”." });
            const { error } = await supabaseBrowser().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/confirm` });
            setMsg(error ? { tipo: "erro", texto: traduzir(error.message) } : { tipo: "ok", texto: "Enviamos um link para criar uma nova senha. Veja sua caixa de entrada e o spam." });
          }}
        >
          Esqueci minha senha
        </button>
      )}
      <button className="btn-sec" style={{ width: "100%" }} onClick={() => setModo(modo === "entrar" ? "cadastrar" : "entrar")}>
        {modo === "entrar" ? "Não tem conta? Cadastre-se" : "Já tenho conta"}
      </button>
    </>
  );
}
