// Exclusão no 60º dia após o encerramento (runAccountPurge), com banco e Storage simulados
// (fake_backend.ts): arquivos de lotes, modelos e anexos apagados, com paginação e conferência.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { installFakeBackend } from "./fake_backend.ts";

const { runAccountPurge } = await import("../functions/_shared/retention.ts");

const ORG = "77777777-7777-4777-8777-777777777777";
const OUTRA = "88888888-8888-4888-8888-888888888888";

function scenario() {
  const purged: string[] = [];
  const fake = installFakeBackend({
    tables: {
      organizations: [
        { id: ORG, purge_after: new Date(Date.now() - 1000).toISOString(), purged_at: null },
        { id: OUTRA, purge_after: null, purged_at: null },
      ],
    },
    rpc: {
      purge_organization: (a) => {
        purged.push(String(a["org"]));
        return null;
      },
    },
  });
  // 1.500 anexos (mais que uma página de 1.000), modelos e lote em subpastas; a outra
  // organização tem arquivos que não podem ser tocados.
  fake.storage["attachments"] = new Set(
    Array.from({ length: 1500 }, (_, i) => `${ORG}/doc-unico/${i}.pdf`),
  );
  fake.storage["attachments"].add(`${OUTRA}/doc-x/1.pdf`);
  fake.storage["templates"] = new Set([`${ORG}/modelo.pdf`, `${OUTRA}/modelo.pdf`]);
  fake.storage["bulk-sources"] = new Set([`${ORG}/lote-1/parte/a.pdf`]);
  return { fake, purged };
}

Deno.test("exclusão: apaga lotes, modelos e anexos da organização (com paginação)", async () => {
  const { fake, purged } = scenario();
  try {
    assertEquals(await runAccountPurge(), 1);
    assertEquals(purged, [ORG]);
    const left = (b: string) => [...fake.storage[b]!].filter((p) => p.startsWith(ORG));
    assertEquals(left("attachments"), [], "os 1.500 anexos foram apagados");
    assertEquals(left("templates"), []);
    assertEquals(left("bulk-sources"), []);
    assert(fake.storage["attachments"]!.has(`${OUTRA}/doc-x/1.pdf`), "outra organização intacta");
    assert(fake.storage["templates"]!.has(`${OUTRA}/modelo.pdf`));
  } finally {
    fake.restore();
  }
});

Deno.test(
  "exclusão: se sobrar arquivo, não marca como excluída (tenta de novo depois)",
  async () => {
    const { fake, purged } = scenario();
    fake.storageDropOneOnRemove = true;
    try {
      assertEquals(await runAccountPurge(), 0);
      assertEquals(purged, [], "o banco não é marcado com arquivo para trás");
    } finally {
      fake.restore();
    }
  },
);
