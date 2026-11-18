// Fila de e-mails (processNotifications): idioma de quem recebe, com banco e Resend simulados.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { installFakeBackend } from "./fake_backend.ts";

Deno.env.set("RESEND_API_KEY", Deno.env.get("RESEND_API_KEY") || "re_teste");
Deno.env.set("EMAIL_FROM", Deno.env.get("EMAIL_FROM") || "MDSign <nao-responda@mdsign.test>");
const { processNotifications } = await import("../functions/_shared/notifications.ts");

const ORG = "11111111-1111-4111-8111-111111111111";
const DOC = "22222222-2222-4222-8222-222222222222";

const person = (id: string, email: string) => ({
  id,
  name: `Pessoa ${id}`,
  email,
  phone: null,
  role: "signer",
  status: "pending",
});
const note = (id: string, participant: string) => ({
  id,
  organization_id: ORG,
  document_id: DOC,
  participant_id: participant,
  channel: "email",
  kind: "signature_requested",
  attempts: 0,
  status: "pending",
  scheduled_at: "2026-11-18T10:00:00Z",
});

Deno.test("e-mail no idioma do perfil de quem recebe; sem conta, no idioma do documento", async () => {
  const emails: { to: string; subject: string }[] = [];
  const asked: unknown[] = [];
  const fake = installFakeBackend({
    tables: {
      organizations: [{ id: ORG, name: "Org Teste" }],
      documents: [
        {
          id: DOC,
          name: "Contrato",
          status: "pending",
          origin: "api",
          created_by: null,
          message: null,
          email_locale: "pt",
          organization_id: ORG,
        },
      ],
      document_participants: [
        person("p1", "Ana@Ex.com"),
        person("p2", "bruno@ex.com"),
        person("p3", "carla@ex.com"),
      ],
      notifications: [note("n1", "p1"), note("n2", "p2"), note("n3", "p3")],
      policies: [],
      sign_links: [],
      document_events: [],
    },
    rpc: {
      claim_notifications: () => ["n1", "n2", "n3"],
      recipient_locales: (args) => {
        asked.push(args);
        return [
          { email: "ana@ex.com", locale: "en" },
          { email: "bruno@ex.com", locale: "es" },
        ];
      },
    },
    http: async (req, url) => {
      if (!url.host.includes("resend.com")) return undefined;
      const b = (await req.json()) as { to: string[]; subject: string };
      emails.push({ to: b.to[0]!, subject: b.subject });
      return Response.json({ id: `e-${emails.length}` });
    },
  });
  try {
    const out = await processNotifications();
    assertEquals(out.sent, 3);
    assertEquals(asked.length, 1, "uma consulta por rodada");
    const subject = (to: string) => emails.find((e) => e.to === to)!.subject;
    const pt = subject("carla@ex.com");
    const en = subject("Ana@Ex.com");
    const es = subject("bruno@ex.com");
    assert(pt !== en && pt !== es && en !== es, `${pt} | ${en} | ${es}`);
  } finally {
    fake.restore();
  }
});
