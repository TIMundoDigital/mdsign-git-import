// Enviar cópia do documento concluído para e-mails de fora do fluxo (link próprio, 7 dias),
// e ver/revogar as cópias já enviadas.

import { useCallback, useEffect, useState } from "react";
import { Ban, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { callFunction } from "../api";
import { formatDate } from "../documents";
import { errorText } from "../errors";
import { useAppI18n } from "../i18n";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** "a@x.com, b@y.com" ou um por linha → lista sem repetição. */
export function parseEmails(raw: string) {
  return [
    ...new Set(
      raw
        .split(/[\s,;]+/)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

type ShareRow = {
  id: string;
  email: string;
  created_at: string;
  expires_at: string;
  opened_at: string | null;
  revoked_at: string | null;
};

export function ShareDialog({
  documentId,
  onClose,
  onSent,
}: {
  documentId: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const { t, f, locale } = useAppI18n();
  const s = t.share;
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [revoking, setRevoking] = useState<string | null>(null);
  const loadShares = useCallback(async () => {
    const { data } = await supabase
      .from("document_shares")
      .select("id, email, created_at, expires_at, opened_at, revoked_at")
      .eq("document_id", documentId)
      .order("created_at", { ascending: false })
      .limit(50);
    setShares((data as ShareRow[] | null) ?? []);
  }, [documentId]);
  useEffect(() => {
    void loadShares();
  }, [loadShares]);

  async function revoke(id: string) {
    setRevoking(id);
    setError(null);
    try {
      await callFunction("document-share", { action: "revoke", shareId: id });
      toast.success(s.revoked);
      await loadShares();
    } catch (e) {
      setError(errorText(t, e));
    } finally {
      setRevoking(null);
    }
  }
  const [raw, setRaw] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emails = parseEmails(raw);
  const valid = emails.length > 0 && emails.length <= 10 && emails.every((e) => EMAIL.test(e));

  async function send() {
    if (!valid) return setError(s.invalid);
    setBusy(true);
    setError(null);
    try {
      const r = await callFunction<{ sent: number; failed: string[]; testMode?: boolean }>(
        "document-share",
        { action: "send", documentId, emails, message },
      );
      if (r.sent) toast.success(f(s.sent, { n: String(r.sent) }));
      if (r.failed.length) {
        setError(
          [f(s.someFailed, { list: r.failed.join(", ") }), r.testMode ? s.testSender : ""]
            .filter(Boolean)
            .join(" "),
        );
        setBusy(false);
        if (r.sent) onSent();
        return;
      }
      onSent();
    } catch (e) {
      setError(errorText(t, e));
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{s.title}</DialogTitle>
          <DialogDescription>{s.hint}</DialogDescription>
        </DialogHeader>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">{s.emails}</span>
          <Textarea value={raw} rows={3} onChange={(e) => setRaw(e.target.value)} disabled={busy} />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">{s.message}</span>
          <Textarea
            value={message}
            rows={2}
            maxLength={500}
            onChange={(e) => setMessage(e.target.value)}
            disabled={busy}
          />
        </label>
        {shares.length > 0 && (
          <section className="grid gap-2" aria-labelledby="share-history">
            <h3 id="share-history" className="text-sm font-medium">
              {s.history}
            </h3>
            <ul className="grid max-h-48 gap-1 overflow-y-auto text-sm">
              {shares.map((r) => {
                const expired = new Date(r.expires_at).getTime() < Date.now();
                const state = r.revoked_at
                  ? s.stateRevoked
                  : expired
                    ? s.stateExpired
                    : r.opened_at
                      ? s.stateOpened
                      : s.stateActive;
                const active = !r.revoked_at && !expired;
                return (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{r.email}</span>
                      <span className="block text-xs text-muted-foreground">
                        {state} · {f(s.until, { date: formatDate(r.expires_at, locale) })}
                      </span>
                    </span>
                    {active && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void revoke(r.id)}
                        disabled={revoking !== null}
                        aria-label={f(s.revokeFor, { email: r.email })}
                      >
                        {revoking === r.id ? (
                          <Loader2 className="animate-spin" aria-hidden />
                        ) : (
                          <Ban aria-hidden />
                        )}
                        {s.revoke}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t.common.cancel}
          </Button>
          <Button
            className="bg-brand hover:bg-brand-strong"
            onClick={() => void send()}
            disabled={busy || !emails.length}
          >
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
            {s.send}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
