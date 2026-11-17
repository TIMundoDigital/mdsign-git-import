// Alertas da plataforma por e-mail (notifyNewAlerts), com banco, login e Resend simulados.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { installFakeBackend } from "./fake_backend.ts";

Deno.env.set("RESEND_API_KEY", Deno.env.get("RESEND_API_KEY") || "re_teste");
Deno.env.set("EMAIL_FROM", Deno.env.get("EMAIL_FROM") || "MDSign <nao-responda@mdsign.test>");
const { notifyNewAlerts } = await import("../functions/_shared/alerts.ts");

const ADMIN = { id: "99999999-9999-4999-8999-999999999999", email: "admin@ex.com" };

Deno.test("alertas: novos vão por e-mail aos Super Admins, uma vez por abertura", async () => {
  const emails: { to: string; subject: string; text: string }[] = [];
  const fake = installFakeBackend({
    users: { "token-admin": ADMIN },
    tables: {
      platform_admins: [{ user_id: ADMIN.id }],
      platform_alerts: [
        {
          id: 1,
          kind: "engine_errors",
          detail: { count: 7 },
          resolved_at: null,
          notified_at: null,
        },
        {
          id: 2,
          kind: "documents_incomplete",
          detail: { count: 1 },
          resolved_at: null,
          notified_at: null,
        },
        {
          id: 3,
          kind: "bulk_stuck",
          detail: {},
          resolved_at: "2026-11-17T10:00:00Z",
          notified_at: null,
        },
      ],
    },
    http: async (req, url) => {
      if (!url.host.includes("resend.com")) return undefined;
      const b = (await req.json()) as { to: string | string[]; subject: string; text: string };
      emails.push({ to: String(b.to), subject: b.subject, text: b.text });
      return Response.json({ id: "e-1" });
    },
  });
  try {
    assertEquals(await notifyNewAlerts(), 2, "só os abertos");
    assertEquals(emails.length, 1);
    assertEquals(emails[0]!.to, "admin@ex.com");
    assertEquals(emails[0]!.subject, "[MDSign] 2 alertas novos na plataforma");
    assert(emails[0]!.text.includes("Muitos erros do motor de assinatura na última hora (7)"));
    assert(!emails[0]!.text.includes("Envio em massa"), "alerta já fechado não vai");
    // Na próxima rodada, os mesmos alertas abertos não são reenviados.
    assertEquals(await notifyNewAlerts(), 0);
    assertEquals(emails.length, 1);
  } finally {
    fake.restore();
  }
});
