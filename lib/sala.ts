"use client";
import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Chamada de vídeo direta entre o navegador do profissional e o do paciente (WebRTC).
 * O vídeo não passa por servidor do Auris e não é gravado. O canal do Supabase só troca
 * os sinais de conexão. O profissional sempre inicia a negociação.
 */
export type Papel = "medico" | "paciente";
export type EstadoConexao = "aguardando" | "conectando" | "conectado" | "instavel" | "encerrada";

// STUN descobre o endereço público; o TURN (Cloudflare, credencial temporária) repassa o vídeo quando a rede bloqueia a conexão direta.
let turnSala: { codigo: string; lista: Promise<RTCIceServer[]> } | null = null;
function turnDaSala(codigo: string): Promise<RTCIceServer[]> {
  if (turnSala?.codigo !== codigo) {
    turnSala = {
      codigo,
      lista: fetch(`/api/turn?sala=${encodeURIComponent(codigo)}`, { cache: "no-store" })
        .then((r) => r.json()).then((d) => (Array.isArray(d.iceServers) ? d.iceServers : [])).catch(() => []),
    };
  }
  return turnSala.lista;
}
async function servidoresIce(codigo: string): Promise<RTCIceServer[]> {
  const lista: RTCIceServer[] = [{ urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] }];
  const turn = await Promise.race([turnDaSala(codigo), new Promise<RTCIceServer[]>((ok) => setTimeout(() => ok([]), 4000))]);
  return [...lista, ...turn];
}

type Sinal =
  | { t: "presente"; de: Papel }
  | { t: "oferta"; sdp: RTCSessionDescriptionInit }
  | { t: "resposta"; sdp: RTCSessionDescriptionInit }
  | { t: "ice"; de: Papel; c: RTCIceCandidateInit }
  | { t: "fim" };

export function useSala(codigo: string, papel: Papel, local: MediaStream | null, ativo: boolean) {
  const [remoto, setRemoto] = useState<MediaStream | null>(null);
  const [estado, setEstado] = useState<EstadoConexao>("aguardando");
  const pc = useRef<RTCPeerConnection | null>(null);
  const canal = useRef<RealtimeChannel | null>(null);
  const fila = useRef<RTCIceCandidateInit[]>([]);

  useEffect(() => {
    if (!ativo || !local) return;
    const sb = supabaseBrowser();
    const ch = sb.channel(`sala-${codigo}`, { config: { broadcast: { self: false } } });
    canal.current = ch;
    const enviar = (s: Sinal) => ch.send({ type: "broadcast", event: "sinal", payload: s });

    turnDaSala(codigo); // busca a credencial TURN já ao entrar na sala

    const novaConexao = async () => {
      pc.current?.close();
      pc.current = null;
      fila.current = [];
      const c = new RTCPeerConnection({ iceServers: await servidoresIce(codigo) });
      local.getTracks().forEach((tr) => c.addTrack(tr, local));
      c.onicecandidate = (e) => e.candidate && enviar({ t: "ice", de: papel, c: e.candidate.toJSON() });
      c.ontrack = (e) => setRemoto(e.streams[0] ?? new MediaStream([e.track]));
      c.onconnectionstatechange = () => {
        const s = c.connectionState;
        if (s === "connected") setEstado("conectado");
        else if (s === "connecting" || s === "new") setEstado("conectando");
        else if (s === "disconnected") setEstado("instavel");
        else if (s === "failed") { setEstado("instavel"); if (papel === "paciente") enviar({ t: "presente", de: "paciente" }); }
      };
      pc.current = c;
      return c;
    };

    const aplicarFila = async () => {
      const c = pc.current;
      if (!c?.remoteDescription) return;
      for (const cand of fila.current.splice(0)) await c.addIceCandidate(cand).catch(() => {});
    };

    const ofertar = async () => {
      setEstado("conectando");
      const c = await novaConexao();
      const oferta = await c.createOffer();
      await c.setLocalDescription(oferta);
      enviar({ t: "oferta", sdp: c.localDescription!.toJSON() });
    };

    ch.on("broadcast", { event: "sinal" }, async ({ payload }) => {
      const s = payload as Sinal;
      try {
        if (s.t === "presente") {
          if (papel === "medico" && s.de === "paciente") await ofertar();
          if (papel === "paciente" && s.de === "medico") enviar({ t: "presente", de: "paciente" });
        } else if (s.t === "oferta" && papel === "paciente") {
          setEstado("conectando");
          const c = await novaConexao();
          await c.setRemoteDescription(s.sdp);
          await aplicarFila();
          const resp = await c.createAnswer();
          await c.setLocalDescription(resp);
          enviar({ t: "resposta", sdp: c.localDescription!.toJSON() });
        } else if (s.t === "resposta" && papel === "medico") {
          await pc.current?.setRemoteDescription(s.sdp);
          await aplicarFila();
        } else if (s.t === "ice" && s.de !== papel) {
          if (pc.current?.remoteDescription) await pc.current.addIceCandidate(s.c).catch(() => {});
          else fila.current.push(s.c);
        } else if (s.t === "fim") {
          pc.current?.close();
          setRemoto(null);
          setEstado("encerrada");
        }
      } catch {
        setEstado("instavel");
      }
    });

    ch.subscribe((st) => {
      if (st === "SUBSCRIBED") enviar({ t: "presente", de: papel });
    });

    return () => {
      pc.current?.close();
      pc.current = null;
      sb.removeChannel(ch);
      canal.current = null;
    };
  }, [codigo, papel, local, ativo]);

  const encerrar = () => {
    canal.current?.send({ type: "broadcast", event: "sinal", payload: { t: "fim" } });
    pc.current?.close();
    setRemoto(null);
    setEstado("encerrada");
  };

  return { remoto, estado, encerrar };
}

/** Pede câmera e microfone com mensagens claras para cada erro comum. */
export async function abrirCameraMicrofone(): Promise<{ stream?: MediaStream; erro?: string }> {
  if (!navigator.mediaDevices?.getUserMedia) return { erro: "Este navegador não permite chamada de vídeo. No celular, use o Chrome ou o Safari atualizado." };
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
    return { stream };
  } catch (e) {
    const nome = e instanceof DOMException ? e.name : "";
    if (nome === "NotAllowedError") return { erro: "A câmera ou o microfone foram bloqueados. Toque no cadeado ao lado do endereço do site e permita o acesso." };
    if (nome === "NotFoundError") return { erro: "Não encontrei câmera ou microfone neste aparelho." };
    if (nome === "NotReadableError") return { erro: "A câmera está sendo usada por outro aplicativo. Feche o outro aplicativo e tente de novo." };
    return { erro: "Não consegui abrir a câmera e o microfone. Tente de novo." };
  }
}
