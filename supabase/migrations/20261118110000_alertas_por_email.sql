-- MDSign — Alertas da plataforma também por e-mail (auditoria de 17/11/2026, item P1-7). Só
-- acréscimos.
--
-- Os alertas (motor com erro, fila parada, documento incompleto, cobrança a conferir...) só
-- apareciam no painel do Super Admin. A rotina de hora em hora passa a enviar por e-mail aos
-- Super Admins os alertas recém-abertos, uma vez por abertura: notified_at guarda o envio.

alter table public.platform_alerts add column if not exists notified_at timestamptz;
comment on column public.platform_alerts.notified_at is
  'Quando os Super Admins foram avisados por e-mail desta abertura do alerta.';
