-- MDSign — Alerta "documents_incomplete": documento pendente que existe no motor, mas está
-- incompleto no MDSign (auditoria de 17/11/2026, achado D-05/D-06). Só acréscimos.
--
-- Conta os documentos pendentes, criados há mais de 10 minutos, com pelo menos um destes casos:
-- - participante sem vínculo com a ação do motor (engine_flow_action_id nulo), que a
--   sincronização não conseguiu religar;
-- - nenhum participante gravado;
-- - nenhuma versão gravada.
-- Os 10 minutos evitam acusar um documento que ainda está sendo criado.

alter table public.platform_alerts drop constraint if exists platform_alerts_kind_check;
alter table public.platform_alerts add constraint platform_alerts_kind_check check (kind in (
  'cron_failed', 'engine_errors', 'notifications_stuck', 'engine_events_failed',
  'data_requests_overdue', 'bulk_stuck', 'document_charges_unknown', 'documents_incomplete'));

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
          or not exists (select 1 from public.document_versions v where v.document_id = d.id)))
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

