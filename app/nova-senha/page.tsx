"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function NovaSenha() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [msg, setMsg] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (senha !== confirma) return setMsg({ tipo: "erro", texto: "As senhas não são iguais." });
    setCarregando(true);
    const { error } = await supabaseBrowser().auth.updateUser({ password: senha });
    setCarregando(false);
    if (error) return setMsg({ tipo: "erro", texto: "Não foi possível salvar. Peça um novo link de redefinição." });
    setMsg({ tipo: "ok", texto: "Senha alterada. Entrando..." });
    setTimeout(() => { router.push("/"); router.refresh(); }, 1200);
  }

  return (
    <>
      <h1>Criar nova senha</h1>
      <form className="card" onSubmit={salvar}>
        <label>Nova senha (mínimo 8 caracteres)</label>
        <input type="password" minLength={8} value={senha} onChange={(e) => setSenha(e.target.value)} required />
        <div style={{ height: 10 }} />
        <label>Repita a nova senha</label>
        <input type="password" minLength={8} value={confirma} onChange={(e) => setConfirma(e.target.value)} required />
        <div style={{ height: 14 }} />
        {msg && <div className={msg.tipo} style={{ marginBottom: 10 }}>{msg.texto}</div>}
        <button type="submit" disabled={carregando} style={{ width: "100%" }}>{carregando ? "Salvando..." : "Salvar nova senha"}</button>
      </form>
    </>
  );
}
