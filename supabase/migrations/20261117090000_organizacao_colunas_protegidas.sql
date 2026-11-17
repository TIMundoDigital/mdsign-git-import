-- MDSign — Organização: pela API, quem tem "settings.manage" altera só o cadastro (nome, CNPJ e
-- idioma), que é o que a tela de Organização grava.
--
-- Antes, o "grant update" valia para a tabela inteira. Um Administrador (não proprietário) podia
-- gravar export_until/purge_after no passado — bloqueando o acesso de todos ou disparando o
-- expurgo — reabrir uma conta encerrada ou trocar status e engine_mode (auditoria de 17/11/2026,
-- achado D-01).
--
-- Ciclo de vida (closed_at, export_until, purge_after, purged_at), status e motor continuam sendo
-- alterados só pelas funções security definer (close_organization, reopen_organization,
-- purge_organization) e pelo servidor (service_role), que não dependem destas permissões.
-- updated_at continua preenchido pelo gatilho organizations_touch.

revoke update on public.organizations from authenticated;
grant update (name, cnpj, locale) on public.organizations to authenticated;
