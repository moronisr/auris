-- Agendador dos lembretes automáticos (rodar UMA vez, depois que o WhatsApp estiver configurado na Vercel).
-- Antes de rodar, troque COLE_AQUI_O_CRON_SECRET pelo mesmo valor que você colocou em CRON_SECRET na Vercel.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('auris-lembretes') where exists (select 1 from cron.job where jobname = 'auris-lembretes');

select cron.schedule(
  'auris-lembretes',
  '*/10 * * * *',
  $$
  select net.http_get(
    url := 'https://aurisclinica.vercel.app/api/whatsapp/lembretes',
    headers := jsonb_build_object('Authorization', 'Bearer COLE_AQUI_O_CRON_SECRET')
  );
  $$
);
