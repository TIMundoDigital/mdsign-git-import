-- MDSign — Linha do tempo e versões também não podem ser apagadas (auditoria de 17/11/2026,
-- B-5). Só acréscimos.
--
-- Os gatilhos de 24/10/2026 bloqueavam só a alteração (UPDATE). A exclusão era impedida apenas
-- pelas permissões; o servidor (service_role) ainda conseguia apagar. Agora a exclusão também é
-- recusada no banco. Documentos não são apagados de verdade no MDSign (exclusão lógica), e o
-- encerramento de conta mantém a linha do tempo e as versões como registro.

create function public.forbid_history_delete() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'history_immutable' using errcode = '42501';
end;
$$;
revoke execute on function public.forbid_history_delete() from public, anon, authenticated;

create trigger document_events_no_delete before delete on public.document_events
  for each row execute function public.forbid_history_delete();
create trigger document_versions_no_delete before delete on public.document_versions
  for each row execute function public.forbid_history_delete();
