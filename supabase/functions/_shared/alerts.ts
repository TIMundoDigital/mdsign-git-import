// Alertas da plataforma por e-mail aos Super Admins (auditoria de 17/11/2026, item P1-7).
// Chamado pela rotina de hora em hora logo depois de refresh_platform_alerts: cada alerta aberto
// é avisado uma vez (platform_alerts.notified_at). Sem e-mail configurado, fica para depois.

import { admin } from "./auth.ts";
import { alertsEmail, emailConfigured, sendEmail } from "./email.ts";
import { siteUrl } from "./notifications.ts";

/** Nome de cada alerta como aparece no painel do Super Admin. */
export const ALERT_LABELS: Record<string, string> = {
  cron_failed: "Rotina agendada com falha na última hora",
  engine_errors: "Muitos erros do motor de assinatura na última hora",
  notifications_stuck: "Fila de notificações parada",
  engine_events_failed: "Avisos do motor sem processar após 5 tentativas",
  data_requests_overdue: "Pedidos de titulares (LGPD) vencidos",
  bulk_stuck: "Envio em massa parado há mais de 1 hora",
  document_charges_unknown: "Consumo de documento a conferir",
  documents_incomplete: "Documentos pendentes incompletos no MDSign",
  cron_http_failed: "Rotina chamou as funções e recebeu erro na última hora",
  reminders_stale: "Rotina de hora em hora sem terminar há mais de 2 horas",
};

/** Envia os alertas ainda não avisados. Devolve quantos alertas foram avisados. */
export async function notifyNewAlerts() {
  const { data: open } = await admin
    .from("platform_alerts")
    .select("id, kind, detail, first_seen")
    .is("resolved_at", null)
    .is("notified_at", null);
  if (!open?.length || !emailConfigured()) return 0;
  const { data: admins } = await admin.from("platform_admins").select("user_id");
  const mail = alertsEmail({
    items: open.map((a) => ({
      label: ALERT_LABELS[a.kind as string] ?? String(a.kind),
      count: Number((a.detail as { count?: number } | null)?.count ?? 0),
    })),
    adminUrl: `${siteUrl()}/admin`,
  });
  let sent = false;
  for (const a of admins ?? []) {
    try {
      const { data } = await admin.auth.admin.getUserById(a.user_id as string);
      const email = data?.user?.email;
      if (!email) continue;
      await sendEmail({
        to: email,
        ...mail,
        idempotencyKey: `alerts:${a.user_id}:${open.map((o) => o.id).join("-")}`,
      });
      sent = true;
    } catch (e) {
      console.error("alert email", String(e).slice(0, 200));
    }
  }
  if (!sent) return 0;
  await admin
    .from("platform_alerts")
    .update({ notified_at: new Date().toISOString() })
    .in(
      "id",
      open.map((o) => o.id),
    )
    .is("notified_at", null);
  return open.length;
}
