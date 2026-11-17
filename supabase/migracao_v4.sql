-- v4: controle dos envios automáticos pelo WhatsApp. Só acrescenta colunas.
alter table public.teleconsultas add column if not exists convite_whatsapp_em timestamptz;
alter table public.teleconsultas add column if not exists lembrete_24h_em timestamptz;
alter table public.teleconsultas add column if not exists lembrete_1h_em timestamptz;
alter table public.teleconsultas add column if not exists lembrete_manual_em timestamptz;
alter table public.entregas add column if not exists whatsapp_em timestamptz;
