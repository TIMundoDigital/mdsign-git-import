// Conferência dos métodos do SignDoc (admin-engine-check): só Super Admin, só leitura no motor.
import { assertEquals } from "jsr:@std/assert@1";
import { installFakeBackend } from "./fake_backend.ts";

Deno.env.set("SIGNDOC_API_KEY", Deno.env.get("SIGNDOC_API_KEY") || "teste");

let handler: (req: Request) => Promise<Response> = () => Promise.reject(new Error("sem handler"));
const serve = Deno.serve;
(Deno as unknown as { serve: unknown }).serve = (h: typeof handler) => {
  handler = h;
  return { finished: Promise.resolve(), shutdown: () => Promise.resolve() };
};
await import("../functions/admin-engine-check/index.ts");
(Deno as unknown as { serve: unknown }).serve = serve;

const OLD = "44444444-4444-4444-8444-444444444444";
const NEW = "55555555-5555-4555-8555-555555555555";
const ADMIN = { id: "u-admin", email: "admin@ex.com" };
const USER = { id: "u-user", email: "user@ex.com" };

function scenario(isAdmin: boolean) {
  const fake = installFakeBackend({
    users: { "token-admin": ADMIN, "token-user": USER },
    tables: {
      profiles: [
        { id: ADMIN.id, full_name: "Admin", cpf: null, no_cpf: false, locale: "pt" },
        { id: USER.id, full_name: "User", cpf: null, no_cpf: false, locale: "pt" },
      ],
      documents: [
        { id: "d1", engine_document_id: OLD, created_at: "2026-11-01T10:00:00Z" },
        { id: "d2", engine_document_id: NEW, created_at: "2026-11-18T10:00:00Z" },
        { id: "d3", engine_document_id: null, created_at: "2026-11-18T11:00:00Z" },
      ],
    },
    rpc: { is_platform_admin: () => isAdmin },
  });
  fake.engine.documents[NEW] = {
    id: NEW,
    status: "Pending",
    flowActions: [],
    securityContext: {
      name: "Default",
      portugueseName: "Padrão",
      allowDigitalSignature: true,
      allowedElectronicTypes: { email: true, sms: true, whatsapp: false, selfie: true },
      requireLivenessOnSelfieAuthentication: false,
    },
  };
  return fake;
}

const call = (token: string) =>
  handler(
    new Request("http://local/admin-engine-check", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: "{}",
    }),
  );

Deno.test(
  "conferência do motor: mostra o que o SignDoc aceita e o que o MDSign oferece",
  async () => {
    const fake = scenario(true);
    Deno.env.set("SIGNDOC_AUTH_METHODS", "sms,certificate");
    try {
      const res = await call("token-admin");
      assertEquals(res.status, 200);
      const body = await res.json();
      assertEquals(body.offered, ["sms", "certificate"]);
      assertEquals(body.engine.context, "Padrão");
      assertEquals(body.engine.certificate, true);
      assertEquals(body.engine.methods.sms, true);
      assertEquals(body.engine.methods.whatsapp, false);
      assertEquals(body.engine.methods.liveness, null, "não informado pelo motor");
      assertEquals(
        fake.engineCalls,
        [`GET /api/documents/${NEW}`],
        "só leitura, documento mais recente",
      );
    } finally {
      Deno.env.delete("SIGNDOC_AUTH_METHODS");
      fake.restore();
    }
  },
);

Deno.test(
  "conferência do motor: quem não é Super Admin é recusado sem consultar o motor",
  async () => {
    const fake = scenario(false);
    try {
      const res = await call("token-user");
      assertEquals(res.status, 403);
      await res.body?.cancel();
      assertEquals(fake.engineCalls, []);
    } finally {
      fake.restore();
    }
  },
);

Deno.test(
  "conferência do motor: sem contexto, tenta os documentos recentes e mostra só os nomes dos campos",
  async () => {
    const fake = scenario(true);
    fake.engine.documents[NEW] = { id: NEW, status: "Pending", flowActions: [], name: "Contrato" };
    fake.engine.documents[OLD] = { id: OLD, status: "Pending", flowActions: [], name: "Outro" };
    try {
      const res = await call("token-admin");
      assertEquals(res.status, 200);
      const body = await res.json();
      assertEquals(body.engine, null);
      assertEquals(body.reason, "no_context");
      assertEquals(body.documentsChecked, 2);
      assertEquals(body.fields.document, ["flowActions", "id", "name", "status"]);
      assertEquals(JSON.stringify(body).includes("Contrato"), false, "nunca devolve valores");
      assertEquals(
        fake.engineCalls.filter(
          (c) => c.startsWith("GET /api/documents/") && !c.endsWith("details"),
        ),
        [`GET /api/documents/${NEW}`, `GET /api/documents/${OLD}`],
      );
    } finally {
      fake.restore();
    }
  },
);
