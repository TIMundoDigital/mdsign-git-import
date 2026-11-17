-- MDSign — Verificação em duas etapas exigida também no servidor (auditoria de 17/11/2026, item
-- P1-11 / D-25). Só acréscimos; as funções mantêm as regras anteriores e ganham a conferência.
--
-- Antes, quem ativou a verificação em duas etapas era barrado só na tela: pela API, a senha
-- sozinha dava acesso aos dados. Agora, para quem tem um fator verificado, as funções em que
-- todas as regras de acesso (RLS) se apoiam só valem com a sessão confirmada pelo código (aal2).
-- Quem não ativou continua como antes. O servidor (service_role) não é afetado.

create function public.mfa_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f
                     where f.user_id = auth.uid() and f.status = 'verified');
$$;
revoke execute on function public.mfa_ok() from public, anon;
grant execute on function public.mfa_ok() to authenticated, service_role;

create or replace function public.is_org_member(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships
    where organization_id = org and user_id = auth.uid() and status = 'active'
  ) and public.org_accessible(org) and public.mfa_ok();
$$;

create or replace function public.has_org_permission(org uuid, perm text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.memberships m
    join public.role_permissions rp on rp.role = m.role
    where m.organization_id = org and m.user_id = auth.uid()
      and m.status = 'active' and rp.permission = perm
  ) and public.org_accessible(org) and public.mfa_ok();
$$;

create or replace function public.org_role_of(org uuid) returns public.org_role
language sql stable security definer set search_path = '' as $$
  select role from public.memberships
  where organization_id = org and user_id = auth.uid() and status = 'active'
    and public.mfa_ok();
$$;

create or replace function public.can_view_document(doc uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.mfa_ok() and exists (
    select 1 from public.documents d
    where d.id = doc
      and (public.has_org_permission(d.organization_id, 'documents.view')
           or exists (select 1 from public.document_participants p
                      where p.document_id = d.id and p.user_id = auth.uid())
           or exists (select 1 from public.document_observers o
                      where o.document_id = d.id and o.user_id = auth.uid()))
  );
$$;
