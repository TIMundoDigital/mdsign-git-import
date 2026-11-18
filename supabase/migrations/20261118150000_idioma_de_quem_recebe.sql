-- E-mails no idioma de quem recebe (auditoria P2): quando o destinatário tem conta no MDSign, usa o
-- idioma do perfil dele; sem conta, continua o idioma do documento (de quem enviou).
-- Só acréscimo: uma função de leitura, restrita ao servidor.
create function public.recipient_locales(p_emails text[])
returns table (email text, locale text)
language sql stable security definer set search_path = '' as $$
  select distinct on (lower(u.email)) lower(u.email)::text, p.locale
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(u.email) = any (select lower(e) from unnest(p_emails) as e)
  order by lower(u.email), u.created_at;
$$;

revoke execute on function public.recipient_locales(text[]) from public, anon, authenticated;
grant execute on function public.recipient_locales(text[]) to service_role;

comment on function public.recipient_locales(text[]) is
  'Idioma do perfil de cada e-mail que tem conta. Só o servidor (fila de notificações) chama.';
