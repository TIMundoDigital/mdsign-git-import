// Super Admin: painéis de operação (cobrança Asaas, erros do motor e alertas da plataforma),
// separados de routes/admin.tsx para o arquivo ficar menor. Só platform_admins (RLS no banco).
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { callFunction } from "@/app/api";
import { errorText } from "@/app/errors";
import { fillText } from "@/app/features";
import { useAppI18n } from "@/app/i18n";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type BillingRow = {
  organization_id: string;
  organization_name: string;
  plan_id: string;
  provider: string;
  status: string;
  billing_status: string;
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
  next_due_date: string | null;
  last_payment_at: string | null;
  last_sync_at: string | null;
  pending_events: number;
};
type BillingStatus = {
  environment: string | null;
  error: string | null;
  apiKeyConfigured: boolean;
  webhookTokenConfigured: boolean;
  productionEnabled: boolean;
};

/** Cobrança (Asaas): situação por organização e configuração — nunca chaves ou segredos. */
export function BillingAdmin() {
  const { t, locale } = useAppI18n();
  const [rows, setRows] = useState<BillingRow[]>([]);
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const date = (v: string | null) =>
    v
      ? new Intl.DateTimeFormat(locale === "pt" ? "pt-BR" : locale, { dateStyle: "short" }).format(
          new Date(v),
        )
      : "—";

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("admin_billing");
    setRows((data as BillingRow[] | null) ?? []);
    try {
      setStatus(await callFunction<BillingStatus>("billing", { action: "status" }));
    } catch {
      setStatus(null);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function setupWebhook() {
    setBusy(true);
    try {
      await callFunction("billing", { action: "setup-webhook" });
      toast.success(t.admin.webhookReady);
    } catch (e) {
      toast.error(errorText(t, e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b p-4">
        <h2 className="flex-1 font-display text-lg font-semibold">{t.admin.billing}</h2>
        {status && (
          <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
            {status.environment
              ? `${t.admin.environment}: ${status.environment}`
              : t.errors[status.error ?? "billing_not_configured"]}
            {" · "}
            {status.apiKeyConfigured ? t.admin.keyOk : t.admin.keyMissing}
            {" · "}
            {t.admin.productionOff}
          </span>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => void setupWebhook()}
          disabled={busy || !status?.environment || !status.webhookTokenConfigured}
        >
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {t.admin.setupWebhook}
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-muted-foreground">
            <tr>
              <th className="p-2 font-medium">{t.admin.organization}</th>
              <th className="p-2 font-medium">{t.admin.plan}</th>
              <th className="p-2 font-medium">{t.admin.provider}</th>
              <th className="p-2 font-medium">{t.admin.billingStatus}</th>
              <th className="p-2 font-medium">{t.admin.customer}</th>
              <th className="p-2 font-medium">{t.admin.subscription}</th>
              <th className="p-2 font-medium">{t.billing.nextDue}</th>
              <th className="p-2 font-medium">{t.billing.lastPayment}</th>
              <th className="p-2 font-medium">{t.admin.lastSync}</th>
              <th className="p-2 text-right font-medium">{t.admin.pendingEvents}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.organization_id}>
                <td className="p-2">{r.organization_name}</td>
                <td className="p-2">{r.plan_id}</td>
                <td className="p-2">{r.provider}</td>
                <td className="p-2">
                  {t.plan.statuses[r.status] ?? r.status} /{" "}
                  {t.admin.billingStatuses[r.billing_status] ?? r.billing_status}
                </td>
                <td className="p-2 font-mono text-xs">{r.asaas_customer_id ?? "—"}</td>
                <td className="p-2 font-mono text-xs">{r.asaas_subscription_id ?? "—"}</td>
                <td className="p-2">{date(r.next_due_date)}</td>
                <td className="p-2">{date(r.last_payment_at)}</td>
                <td className="p-2">{date(r.last_sync_at)}</td>
                <td
                  className={cn(
                    "p-2 text-right tabular-nums",
                    r.pending_events > 0 && "font-semibold text-orange-700",
                  )}
                >
                  {r.pending_events}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type EngineError = {
  id: number;
  created_at: string;
  operation: string;
  engine_document_id: string | null;
  kind: string;
  http_status: number | null;
  code: string | null;
  message: string | null;
};

/** Erros do motor de assinatura (sem dados pessoais), para diagnóstico e chamados à Lacuna. */
export function EngineErrors({
  fmtDate,
}: {
  fmtDate: (v: string | null, withTime?: boolean) => string;
}) {
  const { t } = useAppI18n();
  const [rows, setRows] = useState<EngineError[] | null>(null);
  useEffect(() => {
    void supabase
      .rpc("admin_engine_errors", { lim: 30 })
      .then(({ data }) => setRows((data as EngineError[] | null) ?? []));
  }, []);
  return (
    <section className="mt-6 rounded-2xl border bg-white shadow-sm">
      <div className="border-b p-4">
        <h2 className="font-display text-lg font-semibold">{t.admin.engineErrors}</h2>
        <p className="text-sm text-muted-foreground">{t.admin.engineErrorsHint}</p>
      </div>
      {rows === null ? (
        <p className="p-5 text-muted-foreground">{t.common.loading}</p>
      ) : rows.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">{t.admin.engineErrorsEmpty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">{t.admin.activityWhen}</th>
                <th className="p-3 font-medium">{t.admin.engineOperation}</th>
                <th className="p-3 font-medium">{t.admin.engineStatus}</th>
                <th className="p-3 font-medium">{t.admin.engineMessage}</th>
                <th className="p-3 font-medium">{t.admin.engineDocument}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap p-3">{fmtDate(r.created_at, true)}</td>
                  <td className="p-3 font-mono text-xs">{r.operation}</td>
                  <td className="p-3">
                    {r.kind === "http"
                      ? `HTTP ${r.http_status ?? "?"}`
                      : (t.admin.engineKinds[r.kind] ?? r.kind)}
                    {r.code && (
                      <span className="block text-xs text-muted-foreground">{r.code}</span>
                    )}
                  </td>
                  <td className="max-w-md p-3 text-xs break-words">{r.message ?? "—"}</td>
                  <td className="p-3 font-mono text-xs">{r.engine_document_id ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

type PlatformAlert = {
  id: number;
  kind: string;
  detail: { count?: number };
  first_seen: string;
  last_seen: string;
  resolved_at: string | null;
};

/** Alertas da plataforma (abertos e resolvidos na última semana), calculados de hora em hora. */
export function PlatformAlerts({
  fmtDate,
}: {
  fmtDate: (v: string | null, withTime?: boolean) => string;
}) {
  const { t, f } = useAppI18n();
  const [rows, setRows] = useState<PlatformAlert[]>([]);
  useEffect(() => {
    void supabase
      .rpc("admin_alerts")
      .then(({ data }) => setRows((data as PlatformAlert[] | null) ?? []));
  }, []);
  const open = rows.filter((r) => !r.resolved_at);
  if (!rows.length) return null;
  return (
    <section
      aria-label={t.admin.alerts.title}
      className={cn(
        "mb-6 grid gap-2 rounded-2xl border p-4",
        open.length ? "border-destructive/40 bg-destructive/5" : "bg-white",
      )}
    >
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
        <AlertTriangle
          className={cn("size-5", open.length ? "text-destructive" : "text-muted-foreground")}
          aria-hidden
        />
        {open.length ? f(t.admin.alerts.open, { n: String(open.length) }) : t.admin.alerts.noneOpen}
      </h2>
      <ul className="grid gap-1 text-sm">
        {rows.map((r) => (
          <li key={r.id} className={cn(r.resolved_at && "text-muted-foreground")}>
            <b>{t.admin.alerts.kinds[r.kind] ?? r.kind}</b>
            {r.detail.count ? ` (${r.detail.count})` : ""} ·{" "}
            {r.resolved_at
              ? f(t.admin.alerts.resolved, { date: fmtDate(r.resolved_at, true) })
              : f(t.admin.alerts.since, { date: fmtDate(r.first_seen, true) })}
          </li>
        ))}
      </ul>
    </section>
  );
}

type EngineCheck = {
  offered: string[];
  engine: {
    context: string | null;
    certificate: boolean | null;
    livenessOnSelfie: boolean | null;
    methods: Record<string, boolean | null>;
  } | null;
  reason: "no_documents" | "no_context" | null;
  fields?: Record<string, string[]>;
  documentsChecked?: number;
  checkedAt?: string;
};

/** Métodos de autenticação: o que o SignDoc aceita × o que o MDSign oferece (só leitura). */
export function EngineMethods({
  fmtDate,
}: {
  fmtDate: (v: string | null, withTime?: boolean) => string;
}) {
  const { t } = useAppI18n();
  const x = t.admin.engineMethods;
  const [data, setData] = useState<EngineCheck | null>(null);
  const [busy, setBusy] = useState(false);
  const check = async () => {
    setBusy(true);
    try {
      setData(await callFunction<EngineCheck>("admin-engine-check", {}));
    } catch (e) {
      toast.error(errorText(t, e));
    } finally {
      setBusy(false);
    }
  };
  const yesNo = (v: boolean | null | undefined) => (v == null ? x.unknown : v ? x.yes : x.no);
  // Nome no segredo SIGNDOC_AUTH_METHODS × nome no SignDoc.
  const offeredKey: Record<string, string> = { liveness: "liveness", idScan: "idscan" };
  const offers = (k: string) =>
    k === "email" || (data?.offered ?? []).includes(offeredKey[k] ?? k.toLowerCase());
  return (
    <section className="mt-6 rounded-2xl border bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
        <div>
          <h2 className="font-display text-lg font-semibold">{x.title}</h2>
          <p className="text-sm text-muted-foreground">{x.hint}</p>
        </div>
        <Button variant="outline" onClick={() => void check()} disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {x.check}
        </Button>
      </div>
      {data && (
        <div className="grid gap-3 p-4 text-sm" aria-live="polite">
          {data.reason === "no_documents" && <p>{x.noDocuments}</p>}
          {data.reason === "no_context" && (
            <>
              <p>{fillText(x.noContext, { n: data.documentsChecked ?? 1 })}</p>
              {Object.entries(data.fields ?? {}).map(([where, names]) => (
                <p key={where} className="text-xs text-muted-foreground">
                  {x.fieldsReturned} ({where}):{" "}
                  <span className="font-mono">{names.join(", ") || "—"}</span>
                </p>
              ))}
            </>
          )}
          {data.engine && (
            <>
              <p>
                {x.context}: <strong>{data.engine.context ?? x.unknown}</strong> · {x.certificate}:{" "}
                <strong>{yesNo(data.engine.certificate)}</strong> · {x.livenessOnSelfie}:{" "}
                <strong>{yesNo(data.engine.livenessOnSelfie)}</strong>
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="p-2 font-medium">{x.method}</th>
                      <th className="p-2 font-medium">{x.engineCol}</th>
                      <th className="p-2 font-medium">{x.offeredCol}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {Object.entries(data.engine.methods).map(([k, v]) => (
                      <tr key={k}>
                        <td className="p-2">{x.names[k] ?? k}</td>
                        <td className={cn("p-2", v ? "text-emerald-700" : "text-muted-foreground")}>
                          {yesNo(v)}
                        </td>
                        <td className="p-2">{offers(k) ? x.yes : x.no}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {data.checkedAt && (
            <p className="text-xs text-muted-foreground">
              {x.checkedAt} {fmtDate(data.checkedAt, true)}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
