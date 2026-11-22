import { createClient } from "@supabase/supabase-js";

/** Cliente com a chave de serviço: só no servidor, para páginas públicas e confirmação de pagamento. */
export function supabaseAdmin() {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave, { auth: { persistSession: false } });
}

/** Contas de dono do Auris (variável AURIS_ADMINS, ids separados por vírgula). */
export const idsAdmin = () => (process.env.AURIS_ADMINS || "").split(",").map((s) => s.trim()).filter(Boolean);
export const ehAdmin = (uid?: string | null) => !!uid && idsAdmin().includes(uid);
