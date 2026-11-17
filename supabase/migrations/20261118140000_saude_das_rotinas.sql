-- MDSign — Saúde das rotinas (auditoria de 17/11/2026, A-5). Só acréscimos.
--
-- O pg_net é assíncrono: a rotina agendada "dá certo" mesmo quando a função chamada responde com
-- erro, e os alertas eram recalculados dentro da própria rotina de hora em hora (se ela parasse,
-- ninguém via). Agora:
-- 1. routine_heartbeats: a rotina de hora em hora grava quando terminou bem;
-- 2. dois alertas novos: chamadas às funções com erro na última hora (cron_http_failed) e rotina
--    de hora em hora parada há mais de 2 horas (reminders_stale);
-- 3. os alertas também são recalculados por uma rotina só do banco (sem passar pelas funções).

create table if not exists public.routine_heartbeats (
  name text primary key check (char_length(name) <= 80),
  last_ok_at timestamptz not null,
  detail jsonb not null default '{}'::jsonb
);
alter table public.routine_heartbeats enable row level security;
revoke all on public.routine_heartbeats from anon, authenticated;

alter table public.platform_alerts drop constraint if exists platform_alerts_kind_check;
alter table public.platform_alerts add constraint platform_alerts_kind_check check (kind in (
  'cron_failed', 'engine_errors', 'notifications_stuck', 'engine_events_failed',
  'data_requests_overdue', 'bulk_stuck', 'document_charges_unknown', 'documents_incomplete',
  'cron_http_failed', 'reminders_stale'));

create or replace function public.refresh_platform_alerts()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  cfg jsonb := coalesce((select config from public.policies where id = 'platform_alerts' and active), '{}');
  max_errors integer := coalesce((cfg->>'engine_errors_per_hour')::int, 5);
  stuck_min integer := coalesce((cfg->>'queue_stuck_minutes')::int, 30);
  checks jsonb;
  k text;
  v jsonb;
  opened integer := 0;
begin
  checks := jsonb_build_object(
    'cron_failed', (select count(*) from cron.job_run_details r join cron.job j on j.jobid = r.jobid
      where j.jobname like 'mdsign-%' and r.status = 'failed' and r.start_time > now() - interval '1 hour'),
    'engine_errors', (select case when count(*) >= max_errors then count(*) else 0 end
      from public.engine_errors where created_at > now() - interval '1 hour'),
    'notifications_stuck', (select count(*) from public.notifications
      where status = 'pending' and scheduled_at < now() - make_interval(mins => stuck_min)),
    'engine_events_failed', (select count(*) from public.engine_webhook_events
      where processed_at is null and attempts >= 5),
    'data_requests_overdue', (select count(*) from public.data_requests
      where status not in ('answered', 'rejected') and due_at < now()),
    'bulk_stuck', (select count(*) from public.bulk_jobs
      where status = 'sending' and updated_at < now() - interval '1 hour'),
    'document_charges_unknown', (select count(*) from public.document_charges
      where status = 'unknown'),
    'documents_incomplete', (select count(*) from public.documents d
      where d.status = 'pending' and d.deleted_at is null
        and d.created_at < now() - interval '10 minutes'
        and (exists (select 1 from public.document_participants p
                     where p.document_id = d.id and p.engine_flow_action_id is null)
          or not exists (select 1 from public.document_participants p where p.document_id = d.id)
          or not exists (select 1 from public.document_versions v where v.document_id = d.id))),
    -- Rotinas que chamaram as funções e receberam erro (o pg_net guarda as respostas por horas).
    'cron_http_failed', (select count(*) from net._http_response
      where created > now() - interval '1 hour'
        and (timed_out or error_msg is not null or status_code >= 500)),
    -- Rotina de hora em hora sem terminar bem há mais de 2 horas (antes do 1º registro, não acusa).
    'reminders_stale', (select count(*) from public.routine_heartbeats
      where name = 'reminders-run' and last_ok_at < now() - interval '2 hours')
  );
  for k, v in select * from jsonb_each(checks) loop
    if (v #>> '{}')::int > 0 then
      insert into public.platform_alerts (kind, detail) values (k, jsonb_build_object('count', v))
      on conflict (kind) where resolved_at is null
        do update set last_seen = now(), detail = excluded.detail;
      opened := opened + 1;
    else
      update public.platform_alerts set resolved_at = now() where kind = k and resolved_at is null;
    end if;
  end loop;
  return opened;
end;
$function$;

-- Recalcula os alertas direto no banco, de hora em hora (independente das funções).
select cron.unschedule('mdsign-alerts-refresh')
  where exists (select 1 from cron.job where jobname = 'mdsign-alerts-refresh');
select cron.schedule('mdsign-alerts-refresh', '37 * * * *',
  'select public.refresh_platform_alerts()');
