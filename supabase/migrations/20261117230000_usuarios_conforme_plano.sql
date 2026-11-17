-- MDSign — Usuários conforme o plano (decisão de 17/11/2026). Só acréscimos.
--
-- Quando a organização passa para um plano com menos usuários (ex.: volta ao Cedro por
-- cancelamento ou suspensão longa), os usuários a mais são SUSPENSOS automaticamente — nada é
-- apagado. Ficam: o proprietário mais antigo e, pela ordem, os papéis mais altos e os membros
-- mais antigos. Quando o plano volta a comportar (contratação ou regularização), esses mesmos
-- usuários são REATIVADOS sozinhos. Quem foi suspenso à mão continua suspenso.
-- Troca voluntária para um plano menor continua bloqueada no checkout (P1-2).

alter table public.memberships add column if not exists plan_suspended_at timestamptz;
comment on column public.memberships.plan_suspended_at is
  'Suspenso automaticamente por exceder o limite de usuários do plano; reativado sozinho quando houver vaga.';

-- Reativar à mão (ou por convite) apaga a marca: daí em diante vale a decisão de quem reativou.
create function public.memberships_clear_plan_mark() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'active' then new.plan_suspended_at := null; end if;
  return new;
end;
$$;
revoke execute on function public.memberships_clear_plan_mark() from public, anon, authenticated;
create trigger memberships_clear_plan_mark before update of status on public.memberships
  for each row execute function public.memberships_clear_plan_mark();

-- Ajusta os usuários ativos ao limite do plano atual da organização.
create function public.sync_users_to_plan(org uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  max_users integer;
  active integer;
  r record;
begin
  if not public.entitlement_exists(org, 'users_max') then
    max_users := null;
  else
    max_users := public.entitlement_int(org, 'users_max');
  end if;
  active := public.org_active_members(org);

  if max_users is not null and active > max_users then
    -- Excedentes: do fim da fila de prioridade (proprietário mais antigo nunca sai).
    for r in
      select m.user_id from public.memberships m
      where m.organization_id = org and m.status = 'active'
      order by case m.role when 'owner' then 0 when 'admin' then 1 when 'manager' then 2 else 3 end,
               m.created_at, m.user_id
      offset greatest(max_users, 1)
    loop
      update public.memberships set status = 'suspended', plan_suspended_at = now()
        where organization_id = org and user_id = r.user_id;
      insert into public.audit_log (organization_id, actor_id, action, entity, entity_id, data)
        values (org, null, 'member.suspended_by_plan', 'membership', r.user_id::text,
                jsonb_build_object('users_max', max_users));
    end loop;
  elsif max_users is null or active < max_users then
    -- Vaga aberta: volta quem o plano suspendeu, na mesma ordem de prioridade.
    for r in
      select m.user_id from public.memberships m
      where m.organization_id = org and m.status = 'suspended' and m.plan_suspended_at is not null
      order by case m.role when 'owner' then 0 when 'admin' then 1 when 'manager' then 2 else 3 end,
               m.created_at, m.user_id
      limit case when max_users is null then null else max_users - active end
    loop
      update public.memberships set status = 'active'
        where organization_id = org and user_id = r.user_id;
      insert into public.audit_log (organization_id, actor_id, action, entity, entity_id, data)
        values (org, null, 'member.reactivated_by_plan', 'membership', r.user_id::text,
                jsonb_build_object('users_max', max_users));
    end loop;
  end if;
end;
$$;
revoke execute on function public.sync_users_to_plan(uuid) from public, anon, authenticated;
grant execute on function public.sync_users_to_plan(uuid) to service_role;

-- Toda troca de plano (cobrança, Super Admin, volta ao Cedro) ajusta os usuários.
create function public.subscriptions_sync_users() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.sync_users_to_plan(new.organization_id);
  return null;
end;
$$;
revoke execute on function public.subscriptions_sync_users() from public, anon, authenticated;
create trigger subscriptions_sync_users after update of plan_id, plan_version_id on public.subscriptions
  for each row
  when (old.plan_id is distinct from new.plan_id or old.plan_version_id is distinct from new.plan_version_id)
  execute function public.subscriptions_sync_users();
