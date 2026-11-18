/**
 * Textos dos planos (descrição e benefícios) vêm do banco, em português, e são editados no Super
 * Admin. Em inglês e espanhol, traduz só os textos publicados que conhecemos: se o Super Admin
 * mudar um texto, ele aparece como foi escrito até a tradução ser acrescentada aqui.
 */
const KNOWN: Record<string, { en: string; es: string }> = {
  "Experimente gratuitamente.": { en: "Try it for free.", es: "Pruébelo gratis." },
  "Para profissionais.": { en: "For professionals.", es: "Para profesionales." },
  "Para empresas e equipes.": { en: "For companies and teams.", es: "Para empresas y equipos." },
  "Para operações corporativas.": {
    en: "For corporate operations.",
    es: "Para operaciones corporativas.",
  },
  "5 documentos grátis": { en: "5 free documents", es: "5 documentos gratis" },
  "Assinatura eletrônica": { en: "Electronic signature", es: "Firma electrónica" },
  "Aprovação e assinatura em ordem": {
    en: "Approval and signing in order",
    es: "Aprobación y firma en orden",
  },
  "50 documentos por mês": { en: "50 documents per month", es: "50 documentos por mes" },
  "Modelos reutilizáveis": { en: "Reusable templates", es: "Plantillas reutilizables" },
  "Aprovação em várias etapas": {
    en: "Multi-step approval",
    es: "Aprobación en varias etapas",
  },
  "Documentos ilimitados": { en: "Unlimited documents", es: "Documentos ilimitados" },
  "Até 4 usuários": { en: "Up to 4 users", es: "Hasta 4 usuarios" },
  "Permissões e relatórios gerenciais": {
    en: "Permissions and management reports",
    es: "Permisos e informes de gestión",
  },
  "API e Webhooks": { en: "API and webhooks", es: "API y webhooks" },
  "Envio em massa e relatórios avançados": {
    en: "Bulk sending and advanced reports",
    es: "Envío masivo e informes avanzados",
  },
  "Capacidade sob contrato": { en: "Capacity under contract", es: "Capacidad bajo contrato" },
};

export function planText(text: string, locale: string): string {
  if (locale !== "en" && locale !== "es") return text;
  return KNOWN[text.trim()]?.[locale] ?? text;
}
