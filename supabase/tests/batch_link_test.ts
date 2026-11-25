// "Assinar tudo de uma vez" (documents-action, ação batch-link): pede ao SignDoc o e-mail agrupado
// de pendências (POST /api/users/notify-pending), cujo link abre o lote sem login da 3.3.
// Banco, login e SignDoc simulados (fake_backend.ts); o código real roda sem alteração.
import { assertEquals } from "jsr:@std/assert@1";
import { installFakeBackend } from "./fake_backend.ts";

Deno.env.set("SIGNDOC_API_KEY", Deno.env.get("SIGNDOC_API_KEY") || "teste");

let action: (req: Request) => Promise<Response> = () => Promise.reject(new Error("sem handler"));
const serve = Deno.serve;
(Deno as unknown as { serve: unknown }).serve = (h: typeof action) => {
  action = h;
  return { finished: Promise.resolve(), shutdown: () => Promise.resolve() };
};
await import("../functions/documents-action/index.ts");
(Deno as unknown as { serve: unknown }).serve = serve;

const BIA = { id: "u-bia", email: "bia@ex.com" };
const CAIO = { id: "u-caio", email: "caio@ex.com" };

const doc = (id: string, status = "pending", org = "org-1") => ({
  id,
  organization_id: org,
  created_by: "u-dono",
  status,
  engine_document_id: `eng-${id}`,
  own_email: false,
  deleted_at: null,
});
const part = (id: string, documentId: string, extra: Record<string, unknown>) => ({
  id,
  document_id: documentId,
  organization_id: "org-1",
  name: "Bia",
  user_id: null,
  email: BIA.email,
  role: "signer",
  step: 1,
  status: "pending",
  ...extra,
});

function scenario() {
  return installFakeBackend({
    users: { "token-bia": BIA, "token-caio": CAIO },
    tables: {
      profiles: [
        { id: BIA.id, full_name: "Bia", cpf: null, no_cpf: false, locale: "pt" },
        { id: CAIO.id, full_name: "Caio", cpf: null, no_cpf: false, locale: "pt" },
      ],
      documents: [doc("d1"), doc("d2", "pending", "org-2"), doc("d3", "concluded"), doc("d4")],
      document_participants: [
        part("p1", "d1", { user_id: BIA.id }),
        // Mesma pessoa pelo e-mail, com maiúsculas, em outra organização.
        part("p2", "d2", { email: "Bia@Ex.com", organization_id: "org-2" }),
        // Documento já concluído: fica de fora.
        part("p3", "d3", {}),
        // Ainda não é a vez dela (fluxo em ordem): fica de fora.
        part("p4", "d4", { status: "created" }),
        // O "_" do ilike não pode puxar o endereço de outra pessoa.
        part("p5", "d4", { email: "bia@exxcom", name: "Outra" }),
      ],
    },
  });
}

const call = (token: string) =>
  action(
    new Request("http://local/documents-action", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ action: "batch-link" }),
    }),
  );

Deno.test("lote: desligado enquanto SIGNDOC_PUBLIC_BATCH não for true", async () => {
  Deno.env.delete("SIGNDOC_PUBLIC_BATCH");
  const fake = scenario();
  try {
    const r = await call("token-bia");
    assertEquals(r.status, 404);
    assertEquals((await r.json()).error, "feature_unavailable");
    assertEquals(fake.engine.notifyPending, undefined);
  } finally {
    fake.restore();
  }
});

Deno.test(
  "lote: pede ao SignDoc um único e-mail com as pendências e registra na linha do tempo",
  async () => {
    Deno.env.set("SIGNDOC_PUBLIC_BATCH", "true");
    const fake = scenario();
    try {
      const r = await call("token-bia");
      assertEquals(r.status, 200);
      assertEquals(await r.json(), { documents: 2, emails: ["bia@ex.com"] });
      assertEquals(fake.engine.notifyPending, [["bia@ex.com"]]);
      const evs = (fake.tables["document_events"] ?? []).filter(
        (e) => e["type"] === "participant.batch_link_requested",
      );
      assertEquals(evs.map((e) => e["document_id"]).sort(), ["d1", "d2"]);
      assertEquals(
        evs.map((e) => e["organization_id"]).sort(),
        ["org-1", "org-2"],
        "cada evento na organização do seu documento",
      );

      // Segundo pedido em menos de 5 minutos: recusado, sem novo e-mail.
      const again = await call("token-bia");
      assertEquals(again.status, 429);
      assertEquals((await again.json()).error, "batch_link_too_soon");
      assertEquals(fake.engine.notifyPending?.length, 1);
    } finally {
      fake.restore();
      Deno.env.delete("SIGNDOC_PUBLIC_BATCH");
    }
  },
);

Deno.test("lote: sem pendência, nada é enviado", async () => {
  Deno.env.set("SIGNDOC_PUBLIC_BATCH", "true");
  const fake = scenario();
  try {
    const r = await call("token-caio");
    assertEquals(r.status, 409);
    assertEquals((await r.json()).error, "nothing_to_sign");
    assertEquals(fake.engine.notifyPending, undefined);
  } finally {
    fake.restore();
    Deno.env.delete("SIGNDOC_PUBLIC_BATCH");
  }
});
