"use client";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function BotaoSair() {
  const router = useRouter();
  return (
    <button
      className="btn-sec"
      onClick={async () => {
        await supabaseBrowser().auth.signOut();
        router.push("/login");
        router.refresh();
      }}
    >
      Sair
    </button>
  );
}
