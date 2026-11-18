import { useEffect, useState } from "react";
import { FeatureGate } from "@/app/components/feature-preview";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Files, LayoutTemplate, Wallet } from "lucide-react";

import { PageHeader } from "@/app/components/app-shell";
import { SplitWizard, type SplitPreset } from "@/app/components/split-wizard";
import { useAppI18n } from "@/app/i18n";
import { useOrg } from "@/app/org";
import { supabase } from "@/lib/supabase";
import { TemplateBulk, type ProcessConfig } from "@/app/components/template-bulk";

// Envio em massa (PRD §17–§19): Modelo → Planilha → Colunas → Conferência → Envio.
type Search = {
  mode?: "template" | "pdf" | undefined;
  preset?: "payslips" | undefined;
  process?: string | undefined;
};

export const Route = createFileRoute("/app/_shell/bulk/new")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    mode: search["mode"] === "pdf" || search["mode"] === "template" ? search["mode"] : undefined,
    preset: search["preset"] === "payslips" ? "payslips" : undefined,
    process: typeof search["process"] === "string" ? search["process"] : undefined,
  }),
  // Recurso do plano: fora dele, a prévia de upgrade no lugar da tela (o backend recusa).
  component: () => (
    <FeatureGate code="bulk_send">
      <NewBulk />
    </FeatureGate>
  ),
});

/** "Como estão seus documentos?": modelo + planilha ou PDF com vários documentos. */
function NewBulk() {
  const { t } = useAppI18n();
  const { can } = useOrg();
  const { mode, preset, process } = Route.useSearch();
  const [loaded, setLoaded] = useState<{ name: string; config: ProcessConfig } | null>(null);
  const [loadError, setLoadError] = useState(false);

  // "Fazer de novo": abre o assistente com a configuração do Processo.
  useEffect(() => {
    if (!process) return;
    supabase
      .from("processes")
      .select("name, config")
      .eq("id", process)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return setLoadError(true);
        setLoaded({ name: data.name as string, config: (data.config ?? {}) as ProcessConfig });
        void supabase
          .from("processes")
          .update({ last_run_at: new Date().toISOString() })
          .eq("id", process);
      });
  }, [process]);

  if (!can("bulk.send")) return <p>{t.common.forbidden}</p>;
  if (process && !loaded)
    return loadError ? <p>{t.common.forbidden}</p> : <p>{t.common.loading}</p>;

  const fromProcess = loaded?.config;
  const kind = fromProcess
    ? fromProcess.source === "pdf"
      ? "pdf"
      : "template"
    : preset
      ? "pdf"
      : mode;

  if (kind === "pdf") {
    const payslips: SplitPreset = {
      split: { mode: "content" },
      identify: { matricula: true },
      options: { docName: t.split.payslipsName },
    };
    const presetConfig: SplitPreset | undefined = fromProcess
      ? {
          ...(fromProcess.split?.rule ? { split: fromProcess.split.rule } : {}),
          ...(fromProcess.split?.identify ? { identify: fromProcess.split.identify } : {}),
          ...(fromProcess.options ? { options: fromProcess.options } : {}),
        }
      : preset === "payslips"
        ? payslips
        : undefined;
    return (
      <>
        <PageHeader title={loaded?.name ?? t.bulk.new} subtitle={t.split.fromPdfText} />
        <SplitWizard preset={presetConfig} />
      </>
    );
  }
  if (kind === "template")
    return (
      <TemplateBulk
        initialTemplateId={fromProcess?.templateId ?? undefined}
        initialOptions={fromProcess?.options}
      />
    );

  // A pergunta que decide o caminho: o PDF já traz os dados de cada pessoa ou é um modelo em branco?
  const card = (
    search: { mode: "template" | "pdf" } | { preset: "payslips" },
    Icon: typeof Files,
    title: string,
    text: string,
  ) => (
    <li key={title}>
      <Link
        to="/app/bulk/new"
        search={search}
        className="flex h-full flex-col gap-3 rounded-2xl border bg-white p-5 shadow-sm transition-colors hover:border-brand"
      >
        <span className="flex size-11 items-center justify-center rounded-xl bg-brand-soft">
          <Icon className="size-5 text-brand" aria-hidden />
        </span>
        <span className="font-display text-base font-semibold">{title}</span>
        <span className="text-sm text-muted-foreground">{text}</span>
      </Link>
    </li>
  );

  return (
    <>
      <PageHeader title={t.bulk.new} subtitle={t.split.filledQuestion} />
      <div className="grid max-w-4xl gap-8">
        <section className="grid gap-3" aria-labelledby="bulk-blank">
          <div>
            <h2 id="bulk-blank" className="font-display text-lg font-semibold">
              {t.split.blankTitle}
            </h2>
            <p className="text-sm text-muted-foreground">{t.split.blankHint}</p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {card(
              { mode: "template" },
              LayoutTemplate,
              t.split.fromTemplate,
              t.split.fromTemplateText,
            )}
          </ul>
          <Link
            to="/app/templates/new"
            search={{ kind: "pdf" }}
            className="w-fit text-sm font-semibold text-brand hover:underline"
          >
            {t.split.createFromPdf} →
          </Link>
        </section>
        <section className="grid gap-3" aria-labelledby="bulk-filled">
          <div>
            <h2 id="bulk-filled" className="font-display text-lg font-semibold">
              {t.split.filledTitle}
            </h2>
            <p className="text-sm text-muted-foreground">{t.split.filledHint}</p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {card({ mode: "pdf" }, Files, t.split.fromPdf, t.split.fromPdfText)}
            {card({ preset: "payslips" }, Wallet, t.split.payslips, t.split.payslipsText)}
          </ul>
        </section>
      </div>
    </>
  );
}
