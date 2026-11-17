import { describe, expect, it } from "vitest";

import { productionConfigProblems } from "@/config/build-check";

describe("conferência do build de produção", () => {
  it("homologação (sem VITE_ENVIRONMENT) segue com os valores padrão", () => {
    expect(productionConfigProblems({})).toEqual([]);
  });

  it("produção exige os endereços e não aceita a homologação", () => {
    expect(productionConfigProblems({ VITE_ENVIRONMENT: "production" })).toHaveLength(4);
    expect(
      productionConfigProblems({
        VITE_ENVIRONMENT: "production",
        VITE_SUPABASE_URL: "https://vrksxqbopteeyeovdwpu.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
        VITE_SITE_URL: "https://mdsign.com.br",
        VITE_LEAD_ENDPOINT: "https://novo.supabase.co/functions/v1/lead-submit",
      }),
    ).toEqual(["VITE_SUPABASE_URL aponta para a homologação"]);
    expect(
      productionConfigProblems({
        VITE_ENVIRONMENT: "production",
        VITE_SUPABASE_URL: "https://novo.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
        VITE_SITE_URL: "https://mdsign.com.br",
        VITE_LEAD_ENDPOINT: "https://novo.supabase.co/functions/v1/lead-submit",
      }),
    ).toEqual([]);
  });
});
