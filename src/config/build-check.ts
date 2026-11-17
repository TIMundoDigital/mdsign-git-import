/**
 * Conferência do build (auditoria A-3). Sem VITE_ENVIRONMENT=production, nada muda: o site
 * publicado pelo Lovable usa os valores padrão, que apontam para a homologação.
 * Com VITE_ENVIRONMENT=production, os endereços passam a ser obrigatórios e não podem apontar
 * para a homologação: um build de produção nunca cai, sem aviso, no banco de testes.
 */
export const REQUIRED_IN_PRODUCTION = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_SITE_URL",
  "VITE_LEAD_ENDPOINT",
] as const;

/** Projeto Supabase de homologação (não pode aparecer num build de produção). */
export const HOMOLOGATION_REF = "vrksxqbopteeyeovdwpu";

/** Devolve os problemas encontrados (lista vazia = pode seguir). */
export function productionConfigProblems(env: Record<string, string | undefined>): string[] {
  if (env["VITE_ENVIRONMENT"]?.trim() !== "production") return [];
  const problems: string[] = [];
  for (const key of REQUIRED_IN_PRODUCTION)
    if (!env[key]?.trim()) problems.push(`${key} não definida`);
  for (const key of ["VITE_SUPABASE_URL", "VITE_LEAD_ENDPOINT"] as const)
    if (env[key]?.includes(HOMOLOGATION_REF)) problems.push(`${key} aponta para a homologação`);
  return problems;
}
