-- MDSign — Perfis: cada pessoa lê só o próprio (auditoria de 17/11/2026, achado D-12).
--
-- Antes, qualquer colega ativo de uma organização em comum, inclusive o Visualizador, lia o
-- perfil inteiro, com CPF e telefone. Nenhuma tela usa isso: o app lê só o perfil de quem está
-- logado, a lista de membros vem de list_members e os nomes nas telas do Super Admin vêm de
-- funções security definer, que não dependem desta regra.
--
-- Super Admin (com MFA) continua com a leitura que já tinha.

alter policy profiles_select on public.profiles
  using (id = auth.uid() or public.is_platform_admin());
