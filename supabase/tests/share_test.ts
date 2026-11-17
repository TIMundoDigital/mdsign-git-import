// Cópia do documento concluído (document-share): prazo do Cedro e revogação, com banco, login e
// SignDoc simulados (fake_backend.ts). O código real roda sem alteração.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { installFakeBackend } from "./fake_backend.ts";

Deno.env.set("SIGNDOC_API_KEY", Deno.env.get("SIGNDOC_API_KEY") || "teste");
Deno.env.set("RESEND_API_KEY", Deno.env.get("RESEND_API_KEY") || "re_teste");
Deno.env.set("EMAIL_FROM", Deno.env.get("EMAIL_FROM") || "MDSign <nao-responda@mdsign.test>");

let share: (req: Request) => Promise<Response> = () => Promise.reject(new Error("sem handler"));
const serve = Deno.serve;
(Deno as unknown as { serve: unknown }).serve = (h: typeof share) => {
  share = h;
  return { finished: Promise.resolve(), shutdown: () => Promise.resolve() };
};
await import("../functions/document-share/index.ts");
(Deno as unknown as { serve: unknown }).serve = serve;
const { hashToken } = await import("../functions/_shared/notifications.ts");

const DONO = { id: "u-dono", email: "dono@ex.com" };
const OUTRO = { id: "u-outro", email: "outro@ex.com" };
const day = 86400000;

function scenario(availableUntil: string | null, canManage = false) {
  const emails: string[] = [];
  const fake = installFakeBackend({
    users: { "token-dono": DONO, "token-outro": OUTRO },
    tables: {
      profiles: [
        { id: DONO.id, full_name: "Dono", cpf: null, no_cpf: false, locale: "pt" },
        { id: OUTRO.id, full_name: "Outro", cpf: null, no_cpf: false, locale: "pt" },
      ],
      documents: [
        {
          id: "doc-s",
          organization_id: "org-1",
          created_by: DONO.id,
          name: "Contrato",
          status: "concluded",
          engine_document_id: "44444444-4444-4444-8444-444444444444",
          deleted_at: null,
        },
      ],
      document_shares: [],
    },
    rpc: {
      document_available_until: () => availableUntil,
      has_org_permission: () => canManage,
    },
    http: async (req, url) => {
      if (!url.host.includes("resend.com")) return undefined;
      emails.push(String(((await req.json()) as { to: string[] | string }).to));
      return Response.json({ id: `email-${emails.length}` });
    },
  });
  return { fake, emails };
}

const call = (token: string | null, body: Record<string, unknown>) =>
  share(
    new Request("http://local/document-share", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    }),
  );

Deno.test("cópia: Cedro vencido não envia; perto do prazo, o link não passa dele", async () => {
  const vencido = scenario(new Date(Date.now() - day).toISOString());
  try {
    const r = await call("token-dono", {
      action: "send",
      documentId: "doc-s",
      emails: ["a@ex.com"],
    });
    assertEquals(r.status, 403);
    assertEquals((await r.json()).error, "cedro_document_expired");
    assertEquals(vencido.emails, [], "nenhum e-mail enviado");
  } finally {
    vencido.fake.restore();
  }

  const limite = new Date(Date.now() + 2 * day);
  const perto = scenario(limite.toISOString());
  try {
    const r = await call("token-dono", {
      action: "send",
      documentId: "doc-s",
      emails: ["a@ex.com"],
    });
    assertEquals(r.status, 200);
    const row = perto.fake.tables["document_shares"]![0]!;
    assert(
      new Date(row["expires_at"] as string).getTime() <= limite.getTime(),
      "o link vence junto com o documento, não em 7 dias",
    );
    const ev = perto.fake.tables["document_events"]!.find((e) => e["type"] === "document.shared")!;
    assertEquals((ev["data"] as { days: number }).days, 2, "o e-mail informa 2 dias");
  } finally {
    perto.fake.restore();
  }
});

Deno.test("cópia: link já enviado não abre depois do prazo do Cedro", async () => {
  const { fake } = scenario(new Date(Date.now() - day).toISOString());
  const token = "token-da-copia-com-24-caracteres";
  fake.tables["document_shares"]!.push({
    id: "sh-1",
    document_id: "doc-s",
    organization_id: "org-1",
    email: "a@ex.com",
    token_hash: await hashToken(token),
    expires_at: new Date(Date.now() + 5 * day).toISOString(),
    revoked_at: null,
    opened_at: null,
    open_count: 0,
  });
  try {
    const r = await call(null, { action: "open", token });
    assertEquals(r.status, 410);
    assertEquals((await r.json()).error, "link_expired");
    assertEquals(fake.engineCalls, [], "o motor nem é consultado");
  } finally {
    fake.restore();
  }
});

Deno.test("cópia: quem enviou revoga; o link deixa de abrir; outra pessoa não revoga", async () => {
  const { fake } = scenario(null);
  const token = "outro-token-da-copia-24-caract";
  fake.tables["document_shares"]!.push({
    id: "55555555-5555-4555-8555-555555555555",
    document_id: "doc-s",
    organization_id: "org-1",
    email: "cliente@ex.com",
    token_hash: await hashToken(token),
    expires_at: new Date(Date.now() + 5 * day).toISOString(),
    revoked_at: null,
    opened_at: null,
    open_count: 0,
  });
  const shareId = "55555555-5555-4555-8555-555555555555";
  try {
    const outro = await call("token-outro", { action: "revoke", shareId });
    assertEquals(outro.status, 403, "sem ser quem enviou nem gerenciar documentos");
    assertEquals(fake.tables["document_shares"]![0]!["revoked_at"], null);

    const r = await call("token-dono", { action: "revoke", shareId });
    assertEquals(r.status, 200);
    assert(fake.tables["document_shares"]![0]!["revoked_at"], "revogada");
    const ev = fake.tables["document_events"]!.find((e) => e["type"] === "document.share_revoked")!;
    assertEquals(
      (ev["data"] as { to: string }).to,
      "cl***@ex.com",
      "e-mail mascarado na linha do tempo",
    );
    assert((fake.tables["audit_calls"] ?? []).some((a) => a["act"] === "document.share_revoked"));

    const again = await call("token-dono", { action: "revoke", shareId });
    assertEquals(again.status, 200, "revogar de novo não dá erro");
    assertEquals(
      fake.tables["document_events"]!.filter((e) => e["type"] === "document.share_revoked").length,
      1,
    );

    const open = await call(null, { action: "open", token });
    assertEquals(open.status, 404);
    assertEquals((await open.json()).error, "link_invalid");
  } finally {
    fake.restore();
  }
});
