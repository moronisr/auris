"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Campo CID-10 com busca na tabela oficial (DATASUS).
 * Busca por código ("J45") ou por nome ("asma"), sem diferença de acento.
 * Aceita vários CIDs separados por "; ". A tabela só é baixada quando o campo recebe foco.
 */
type Item = [string, string];
let tabela: Promise<Item[]> | null = null;
const carregar = () => (tabela ??= fetch("/cid10.json").then((r) => r.json()).catch(() => { tabela = null; return []; }));
const sem = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function CampoCid({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  const [lista, setLista] = useState<Item[]>([]);
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const caixa = useRef<HTMLDivElement>(null);

  // O trecho em edição é o que vem depois do último ";".
  const partes = valor.split(";");
  const termo = partes[partes.length - 1].trim();

  const sugestoes = useMemo(() => {
    if (termo.length < 2 || !lista.length) return [];
    const t = sem(termo);
    const cod = t.replace(/\s/g, "").toUpperCase();
    const porCodigo = lista.filter(([c]) => c.replace(".", "").startsWith(cod.replace(".", "")));
    const porNome = lista.filter(([c, d]) => !porCodigo.some(([x]) => x === c) && sem(d).includes(t));
    return [...porCodigo, ...porNome].slice(0, 8);
  }, [termo, lista]);

  useEffect(() => {
    const fora = (e: MouseEvent) => { if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false); };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  function escolher([c, d]: Item) {
    const anteriores = partes.slice(0, -1).map((p) => p.trim()).filter(Boolean);
    onChange([...anteriores, `${c} ${d}`].join("; ") + "; ");
    setAberto(false);
  }

  return (
    <div ref={caixa} style={{ position: "relative" }}>
      <input
        value={valor}
        placeholder="Digite o código ou o nome (ex.: J45 ou asma)"
        onFocus={() => { carregar().then(setLista); setAberto(true); }}
        onChange={(e) => { onChange(e.target.value); setAberto(true); setAtivo(0); }}
        onBlur={() => onChange(valor.replace(/[;\s]+$/, ""))}
        onKeyDown={(e) => {
          if (!aberto || !sugestoes.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setAtivo((a) => Math.min(a + 1, sugestoes.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setAtivo((a) => Math.max(a - 1, 0)); }
          if (e.key === "Enter") { e.preventDefault(); escolher(sugestoes[ativo]); }
          if (e.key === "Escape") setAberto(false);
        }}
        autoComplete="off"
        aria-autocomplete="list"
      />
      {aberto && sugestoes.length > 0 && (
        <ul role="listbox" style={{ position: "absolute", zIndex: 20, left: 0, right: 0, top: "100%", margin: "4px 0 0", padding: 4, listStyle: "none", background: "rgba(24, 33, 20, .96)", border: "1px solid var(--linha, #d9dee3)", borderRadius: 14, boxShadow: "0 16px 40px rgba(0,0,0,.45)", backdropFilter: "blur(20px)", maxHeight: 280, overflowY: "auto" }}>
          {sugestoes.map((s, i) => (
            <li key={s[0]} role="option" aria-selected={i === ativo}
              onMouseDown={(e) => { e.preventDefault(); escolher(s); }}
              onMouseEnter={() => setAtivo(i)}
              style={{ padding: "7px 10px", borderRadius: 7, cursor: "pointer", fontSize: 14, background: i === ativo ? "var(--destaque-claro, #eef3f2)" : "transparent" }}>
              <b>{s[0]}</b> {s[1]}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
