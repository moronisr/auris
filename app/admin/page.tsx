import { notFound } from "next/navigation";
import { ehAdmin } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";
import PainelAuris from "@/components/PainelAuris";

export const dynamic = "force-dynamic";
export const metadata = { title: "Painel do Auris" };

/** Só o dono do Auris abre esta página; para os demais ela não existe. */
export default async function Admin() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!ehAdmin(user?.id)) notFound();
  return <PainelAuris />;
}
