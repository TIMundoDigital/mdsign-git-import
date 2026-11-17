-- MDSign — Limite de usuários do plano em todas as portas de entrada (auditoria de 17/11/2026,
-- item P1-2). Só acréscimos; as funções mantêm as regras anteriores e ganham a conferência.
--
-- Antes, o limite (users_max) só era conferido ao convidar. Escapavam:
-- - aceitar um convite feito quando ainda havia vaga (ou antes de trocar para um plano menor);
-- - reativar um membro suspenso;
-- - trocar para um plano menor com mais usuários ativos do que ele permite.

-- Usuários ativos da organização.
create function public.org_active_members(org uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.memberships where organization_id = org and status = 'active';
$$;
revoke execute on function public.org_active_members(uuid) from public, anon, authenticated;

-- Aceitar convite: confere de novo o limite (quem já é membro ativo não ocupa vaga nova).
create or replace function public.accept_invitation(invite_token uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  inv public.invitations;
  user_email text;
begin
  select email into user_email from auth.users where id = auth.uid();
  select * into inv from public.invitations
  where token = invite_token and accepted_at is null and expires_at > now();
  if inv.id is null then
    raise exception 'invitation_invalid' using errcode = 'P0002';
  end if;
  if lower(user_email) <> inv.email then
    raise exception 'invitation_email_mismatch' using errcode = '42501';
  end if;
  -- Trava a organização: dois aceites ao mesmo tempo não passam juntos do limite.
  perform 1 from public.organizations where id = inv.organization_id for update;
  if public.entitlement_exists(inv.organization_id, 'users_max')
     and not exists (select 1 from public.memberships where organization_id = inv.organization_id
                     and user_id = auth.uid() and status = 'active')
     and public.org_active_members(inv.organization_id)
         >= public.entitlement_int(inv.organization_id, 'users_max') then
    raise exception 'plan_users_limit' using errcode = 'P0001';
  end if;
  insert into public.memberships (organization_id, user_id, role, unit_id)
  values (inv.organization_id, auth.uid(), inv.role, inv.unit_id)
  on conflict (organization_id, user_id) do update set role = excluded.role, status = 'active';
  update public.invitations set accepted_at = now() where id = inv.id;
  perform public.write_audit(inv.organization_id, 'member.joined', 'membership', auth.uid()::text,
    jsonb_build_object('role', inv.role));
  return inv.organization_id;
end;
$$;

-- Alterar membro: reativar um suspenso também ocupa vaga.
create or replace function public.update_member(org uuid, member uuid, new_role public.org_role default null,
  new_status public.member_status default null, new_unit uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  target public.memberships;
begin
  if not public.has_org_permission(org, 'members.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into target from public.memberships where organization_id = org and user_id = member;
  if target.user_id is null then
    raise exception 'member_not_found' using errcode = 'P0002';
  end if;
  -- Proprietário só é alterado por outro proprietário; o último proprietário não pode sair.
  if (target.role = 'owner' or new_role = 'owner') and public.org_role_of(org) <> 'owner' then
    raise exception 'forbidden_role' using errcode = '42501';
  end if;
  if target.role = 'owner' and (coalesce(new_role, 'owner') <> 'owner' or new_status = 'suspended')
     and (select count(*) from public.memberships
          where organization_id = org and role = 'owner' and status = 'active') <= 1 then
    raise exception 'last_owner' using errcode = '42501';
  end if;
  if new_status = 'active' and target.status <> 'active' then
    perform 1 from public.organizations where id = org for update;
    if public.entitlement_exists(org, 'users_max')
       and public.org_active_members(org) >= public.entitlement_int(org, 'users_max') then
      raise exception 'plan_users_limit' using errcode = 'P0001';
    end if;
  end if;
  update public.memberships set
    role = coalesce(new_role, role),
    status = coalesce(new_status, status),
    unit_id = coalesce(new_unit, unit_id)
  where organization_id = org and user_id = member;
  perform public.write_audit(org, 'member.updated', 'membership', member::text,
    jsonb_build_object('role', new_role, 'status', new_status, 'unit', new_unit));
end;
$$;

-- Troca de plano (checkout): os usuários ativos cabem no plano escolhido, na matriz publicada?
-- Usada pelo servidor antes de criar o checkout. Sem limite definido no plano = cabe.
create function public.plan_users_fit(org uuid, target_plan text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'fits', e.value_int is null or public.org_active_members(org) <= e.value_int,
    'active', public.org_active_members(org),
    'max', e.value_int)
  from (select (select value_int from public.plan_version_entitlements
                where version_id = public.current_plan_version() and plan_id = target_plan
                  and key = 'users_max') as value_int) e;
$$;
revoke execute on function public.plan_users_fit(uuid, text) from public, anon, authenticated;
grant execute on function public.plan_users_fit(uuid, text), public.org_active_members(uuid)
  to service_role;
