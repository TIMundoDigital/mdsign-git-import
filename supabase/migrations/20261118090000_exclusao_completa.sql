-- MDSign — Exclusão completa no 60º dia após o encerramento (Termos de Uso aprovados, seção 7, e
-- Política de Privacidade, seção 10; auditoria de 17/11/2026, item P1-4). Só a função muda.
--
-- A versão anterior não cobria as tabelas criadas depois dela. Passam a ser apagados também:
-- - document_shares (e-mails de quem recebeu cópia);
-- - saved_flows (fluxos salvos, com nomes, e-mails e CPFs);
-- - document_attachments (registro dos anexos; os arquivos são apagados pelo servidor antes);
-- - document_folders (pastas; os documentos ficam, sem pasta);
-- - organization_units (estrutura interna);
-- - onboarding_state (progresso da introdução ao app).
-- Continuam guardados como registro: documentos, participantes, observadores, versões, linha do
-- tempo, auditoria e cobrança; os PDFs assinados ficam no motor como evidência.

create or replace function public.purge_organization(org uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.organizations where id = org
                 and purge_after <= now() and purged_at is null) then
    raise exception 'invalid_request' using errcode = 'P0001';
  end if;
  delete from public.sign_links where organization_id = org;
  delete from public.notifications where organization_id = org;
  delete from public.notification_settings where organization_id = org;
  delete from public.whatsapp_opt_outs where organization_id = org;
  delete from public.delegations where organization_id = org;
  delete from public.org_group_members where organization_id = org;
  delete from public.org_groups where organization_id = org;
  delete from public.webhook_deliveries where organization_id = org;
  delete from public.webhook_endpoints where organization_id = org;
  delete from public.api_requests where organization_id = org;
  delete from public.api_keys where organization_id = org;
  delete from public.bulk_items where organization_id = org;
  delete from public.bulk_jobs where organization_id = org;
  delete from public.processes where organization_id = org;
  delete from public.forms where organization_id = org;
  delete from public.templates where organization_id = org;
  delete from public.contacts where organization_id = org;
  delete from public.org_qualification where organization_id = org;
  delete from public.invitations where organization_id = org;
  -- Acrescentados em 18/11/2026.
  delete from public.document_shares where organization_id = org;
  delete from public.saved_flows where organization_id = org;
  delete from public.document_attachments where organization_id = org;
  update public.documents set folder_id = null where organization_id = org and folder_id is not null;
  delete from public.document_folders where organization_id = org;
  delete from public.onboarding_state where organization_id = org;
  delete from public.memberships where organization_id = org;
  delete from public.organization_units where organization_id = org;
  update public.organizations set purged_at = now() where id = org;
  perform public.write_audit_as(org, null, 'organization.purged', 'organization', org::text,
    '{"kept": ["documents", "participants", "observers", "versions", "events", "audit", "billing"]}'::jsonb);
end;
$$;
revoke execute on function public.purge_organization(uuid) from public, anon, authenticated;
grant execute on function public.purge_organization(uuid) to service_role;
