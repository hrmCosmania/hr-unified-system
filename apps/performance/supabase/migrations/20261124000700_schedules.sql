-- =====================================================================
-- GrowTogether PM · 0700 · งานตั้งเวลา (OPTIONAL)
-- รันเมื่อ deploy Edge Functions (integration-inbound / integration-dispatch) แล้วเท่านั้น
-- ต้องเปิด extension pg_cron + pg_net และเก็บ secret ใน Vault ก่อน:
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1', 'edge_base_url');
--   select vault.create_secret('<service_role_key>', 'service_role_key');
-- =====================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule('pm-outbox-dispatch', '*/5 * * * *', $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'edge_base_url') || '/integration-dispatch',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body    := '{}'::jsonb)
$$);

-- ประมวลผล event ที่ล้มเหลวซ้ำ (เช่น พนักงานยังไม่ sync) ทุก 15 นาที สูงสุด 5 ครั้ง
select cron.schedule('pm-inbound-retry', '*/15 * * * *', $$
  select pm_integration.process_inbound(id) from pm_integration.inbound_events
   where status = 'failed' and attempts < 5 order by id limit 500
$$);

