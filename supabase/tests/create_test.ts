// Criação de documento (createDocument): regras do plano antes de reservar a franquia ou chamar o
// motor, com banco e motor simulados (fake_backend.ts).
import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { PDFDocument } from "npm:pdf-lib@1.17.1";
import { installFakeBackend } from "./fake_backend.ts";

Deno.env.set("SIGNDOC_API_KEY", Deno.env.get("SIGNDOC_API_KEY") || "teste");
const { createDocument } = await import("../functions/_shared/create.ts");
const { AppError } = await import("../functions/_shared/http.ts");

async function pdf() {
  const doc = await PDFDocument.create();
  doc.addPage([595, 842]);
  return new Uint8Array(await doc.save());
}

Deno.test("criação: certificado (nível qualificado) só no plano que inclui", async () => {
  const reserved: unknown[] = [];
  const fake = installFakeBackend({
    rpc: {
      feature_enabled: (a) => a["code"] !== "certificate_signature", // plano sem certificado
      reserve_document: (a) => {
        reserved.push(a);
        return { ok: false, reason: "plan_limit_reached" };
      },
    },
  });
  const bytes = await pdf();
  try {
    await assertRejects(
      () =>
        createDocument({
          organizationId: "org-cedro",
          createdBy: "u-1",
          actorName: "Ana",
          kind: "send",
          name: "Contrato",
          pdf: bytes,
          filename: "contrato.pdf",
          participants: [
            {
              name: "Bia",
              email: "bia@ex.com",
              cpf: "52998224725",
              noCpf: false,
              phone: null,
              role: "signer",
              authLevel: "qualified",
              step: 1,
              rule: null,
            },
          ],
          locale: "pt",
          notify: true,
          origin: "api",
          idempotencyKey: "api:k:teste-1234",
        }),
      AppError,
      "feature_not_in_plan",
    );
    assertEquals(reserved, [], "a franquia nem é reservada");
    assertEquals(fake.engineCalls, [], "o motor não é chamado");
  } finally {
    fake.restore();
  }
});
