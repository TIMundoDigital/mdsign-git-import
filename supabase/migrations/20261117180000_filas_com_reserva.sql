-- MDSign — Filas com reserva (auditoria de 17/11/2026, achado D-13). Só acréscimos.
--
-- Notificações (e-mail/WhatsApp), entregas de webhooks aos clientes e eventos do motor eram lidos
-- com um select simples. Duas execuções ao mesmo tempo (a rotina de minuto e uma ação do usuário,
-- ou duas rodadas sobrepostas) pegavam os mesmos itens e enviavam em dobro.
--
-- Agora cada execução reserva os itens que vai tratar (FOR UPDATE SKIP LOCKED) e marca
-- locked_until = agora + 5 minutos. Outra execução pula os reservados. Ao terminar, o servidor
-- libera os que continuaram pendentes (nova tentativa agendada ou ritmo atingido). Se a execução
-- cair no meio, a reserva vence sozinha em 5 minutos e o item volta para a fila.

alter table public.notifications add column if not exists locked_until timestamptz;
alter table public.webhook_deliveries add column if not exists locked_until timestamptz;
alter table public.engine_webhook_events add column if not exists locked_until timestamptz;

-- Notificações vencidas (scheduled_at) e livres, na ordem da fila.
create function public.claim_notifications(lim integer)
returns setof uuid
language sql security definer set search_path = '' as $$
  update public.notifications n
     set locked_until = now() + interval '5 minutes'
   where n.id in (
     select q.id from public.notifications q
      where q.status = 'pending' and q.scheduled_at <= now()
        and (q.locked_until is null or q.locked_until < now())
      order by q.scheduled_at
      limit greatest(1, least(coalesce(lim, 30), 200))
      for update skip locked)
  returning n.id;
$$;

-- Entregas de webhooks vencidas e livres (opcionalmente só de uma organização).
create function public.claim_webhook_deliveries(lim integer, org uuid default null)
returns setof uuid
language sql security definer set search_path = '' as $$
  update public.webhook_deliveries w
     set locked_until = now() + interval '5 minutes'
   where w.id in (
     select q.id from public.webhook_deliveries q
      where q.status = 'pending' and q.next_attempt_at <= now()
        and (org is null or q.organization_id = org)
        and (q.locked_until is null or q.locked_until < now())
      order by q.next_attempt_at
      limit greatest(1, least(coalesce(lim, 50), 200))
      for update skip locked)
  returning w.id;
$$;

-- Eventos do motor para reprocessar: com nova tentativa vencida ou, se nunca tentados, recebidos
-- há mais de 1 minuto (antes disso o próprio webhook ainda está processando).
create function public.claim_engine_events(lim integer, max_attempts integer)
returns setof bigint
language sql security definer set search_path = '' as $$
  update public.engine_webhook_events e
     set locked_until = now() + interval '5 minutes'
   where e.id in (
     select q.id from public.engine_webhook_events q
      where q.processed_at is null and q.attempts < max_attempts
        and (case when q.next_attempt_at is not null then q.next_attempt_at <= now()
                  else q.received_at < now() - interval '1 minute' end)
        and (q.locked_until is null or q.locked_until < now())
      order by q.received_at
      limit greatest(1, least(coalesce(lim, 20), 200))
      for update skip locked)
  returning e.id;
$$;

revoke execute on function public.claim_notifications(integer),
  public.claim_webhook_deliveries(integer, uuid),
  public.claim_engine_events(integer, integer) from public, anon, authenticated;
grant execute on function public.claim_notifications(integer),
  public.claim_webhook_deliveries(integer, uuid),
  public.claim_engine_events(integer, integer) to service_role;
