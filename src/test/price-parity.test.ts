// Preços e limites iguais em todo lugar (auditoria P1-9, C-06): o site (landing.ts) e os Termos
// (legal.ts, seção 8) repetem a matriz de lançamento do banco (lancamento_2026_11). Este teste lê a
// matriz direto da migração e falha se o site ou os Termos ficarem diferentes.
// Publicou uma matriz nova no Super Admin? Atualize o site, os Termos e a referência abaixo.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { legalDocs } from "@/content/legal";
import { plans } from "@/content/landing";

const MIGRATION = "supabase/migrations/20261024090000_planos_lancamento.sql";
const VERSION = "lancamento_2026_11";
const sql = readFileSync(MIGRATION, "utf8");

function priceCents(plan: string): number | null {
  const m = new RegExp(`\\('${VERSION}', '${plan}', (null|\\d+),`).exec(sql);
  if (!m) throw new Error(`preço de ${plan} não encontrado na migração`);
  return m[1] === "null" ? null : Number(m[1]);
}
function entitlement(plan: string, key: string): number | null {
  const m = new RegExp(`\\('${VERSION}', '${plan}', '${key}', (\\d+), null\\)`).exec(sql);
  return m ? Number(m[1]) : null;
}
const brl = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

describe("preços e limites iguais no banco, no site e nos Termos", () => {
  it("site: preço de cada plano pago", () => {
    for (const id of ["jacaranda", "ipe"] as const) {
      const cents = priceCents(id)!;
      expect(plans.find((p) => p.id === id)?.price).toBe(brl(cents));
    }
    expect(priceCents("cedro")).toBe(0);
    expect(priceCents("mogno")).toBeNull();
  });

  it("Termos, seção 8: preços, franquias e usuários", () => {
    const planos = legalDocs.terms.sections
      .find((s) => s.title.startsWith("8."))!
      .paragraphs.find((p) => p.startsWith("Cedro: gratuito"))!;
    expect(planos).toContain(
      `franquia total de ${entitlement("cedro", "documents_total")} documentos por pessoa`,
    );
    expect(planos).toContain(
      `Jacarandá (${brl(priceCents("jacaranda")!)}/mês; ${entitlement("jacaranda", "documents_month")} documentos/mês; ${entitlement("jacaranda", "users_max")} usuário)`,
    );
    expect(planos).toContain(
      `Ipê (${brl(priceCents("ipe")!)}/mês; documentos ilimitados; até ${entitlement("ipe", "users_max")} usuários)`,
    );
    expect(planos).toContain("Mogno (sob proposta e contrato)");
  });
});
