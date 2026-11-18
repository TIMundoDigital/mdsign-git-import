// Dividir PDF: painel de conferência de cada documento (separado de split-wizard.tsx).
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppI18n } from "../i18n";
import { type PdfSplitter } from "../pdflib";
import { isReady, type Person, type SplitDoc } from "../split";
import { formatCpf, isValidCpf, onlyDigits } from "../validation";
import { PdfPlacer } from "./pdf-placer";

/** Painel de conferência: PDF à esquerda/em cima, dados do destinatário e ações. */
export function DocPanel({
  doc,
  people,
  person,
  splitter,
  onClose,
  onChange,
  onAddPerson,
  onSplit,
}: {
  onSplit: (at: number) => void;
  doc: SplitDoc;
  people: Person[];
  person: Person | null;
  splitter: PdfSplitter | null;
  onClose: () => void;
  onChange: (patch: Partial<SplitDoc>) => void;
  onAddPerson: (p: Person) => void;
}) {
  const { t } = useAppI18n();
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [query, setQuery] = useState("");
  const [manual, setManual] = useState({ name: "", email: "", cpf: "" });

  useEffect(() => {
    if (!splitter) return;
    void splitter.part(doc.from, doc.to).then((out) => setBytes(out.slice().buffer));
  }, [splitter, doc.from, doc.to]);

  const q = query.trim().toLowerCase();
  const results = (
    q
      ? people.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.email.includes(q) ||
            p.cpf.includes(onlyDigits(q) || "~") ||
            p.matricula.toLowerCase() === q,
        )
      : people.filter((p) => doc.candidates.includes(p.key))
  ).slice(0, 8);

  return (
    <aside className="grid content-start gap-3 rounded-2xl border bg-white p-4 text-sm">
      <div className="flex items-center justify-between">
        <p className="font-semibold">
          {t.split.pages}: {doc.from === doc.to ? doc.from : `${doc.from}–${doc.to}`}
        </p>
        <Button size="sm" variant="ghost" onClick={onClose}>
          {t.common.close}
        </Button>
      </div>
      <div className="max-h-[45svh] overflow-y-auto rounded-md border bg-muted/30 p-2">
        <PdfPlacer
          source={bytes}
          boxes={[]}
          onChange={() => undefined}
          tool={null}
          onCreate={() => undefined}
          selected={null}
          onSelect={() => undefined}
          maxPages={3}
        />
      </div>
      <p className="text-muted-foreground">{t.split.reasons[doc.reason]}</p>
      {doc.to > doc.from && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{t.split.splitHere}</span>
          {Array.from({ length: doc.to - doc.from }, (_, i) => doc.from + i + 1).map((pg) => (
            <Button
              key={pg}
              size="sm"
              variant="outline"
              className="h-7 px-2"
              onClick={() => onSplit(pg)}
            >
              {pg}
            </Button>
          ))}
        </div>
      )}
      {person ? (
        <dl className="grid grid-cols-[6rem_1fr] gap-1">
          <dt className="text-muted-foreground">{t.participants.name}</dt>
          <dd>{person.name || "—"}</dd>
          <dt className="text-muted-foreground">{t.participants.email}</dt>
          <dd>{person.email || "—"}</dd>
          <dt className="text-muted-foreground">{t.participants.cpf}</dt>
          <dd>{person.cpf ? formatCpf(person.cpf) : "—"}</dd>
        </dl>
      ) : (
        <p className="font-medium text-destructive">{t.split.noRecipient}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {person && !doc.excluded && !isReady(doc) && (
          <Button
            size="sm"
            className="bg-brand hover:bg-brand-strong"
            onClick={() => onChange({ confirmed: true })}
          >
            {t.split.confirm}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => onChange({ excluded: !doc.excluded })}>
          {doc.excluded ? t.split.include : t.split.exclude}
        </Button>
      </div>
      <div className="grid gap-2 border-t pt-3">
        <Label htmlFor="who">{t.split.changeRecipient}</Label>
        <Input
          id="who"
          value={query}
          placeholder={t.contacts.search}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ul className="grid gap-1">
          {results.map((p) => (
            <li key={p.key}>
              <button
                type="button"
                className="w-full rounded-md border px-2 py-1 text-left hover:border-brand"
                onClick={() =>
                  onChange({
                    personKey: p.key,
                    confirmed: true,
                    method: "manual",
                    value: "",
                    excluded: false,
                  })
                }
              >
                <span className="font-medium">{p.name || p.email}</span>{" "}
                <span className="text-muted-foreground">
                  · {p.email}
                  {p.cpf ? ` · ${formatCpf(p.cpf)}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <details>
          <summary className="cursor-pointer text-xs font-semibold text-brand">
            {t.split.typeRecipient}
          </summary>
          <div className="mt-2 grid gap-2">
            <Input
              aria-label={t.participants.name}
              placeholder={t.participants.name}
              value={manual.name}
              onChange={(e) => setManual({ ...manual, name: e.target.value })}
            />
            <Input
              aria-label={t.participants.email}
              placeholder={t.participants.email}
              value={manual.email}
              onChange={(e) => setManual({ ...manual, email: e.target.value })}
            />
            <Input
              aria-label={t.participants.cpf}
              placeholder={t.participants.cpf}
              value={manual.cpf}
              onChange={(e) => setManual({ ...manual, cpf: formatCpf(e.target.value) })}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={
                manual.name.trim().length < 2 ||
                !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(manual.email) ||
                (manual.cpf !== "" && !isValidCpf(manual.cpf))
              }
              onClick={() => {
                const key = `m:${doc.index}`;
                onAddPerson({
                  key,
                  name: manual.name.trim(),
                  email: manual.email.trim().toLowerCase(),
                  cpf: onlyDigits(manual.cpf),
                  phone: "",
                  matricula: "",
                  custom: "",
                });
                onChange({
                  personKey: key,
                  confirmed: true,
                  method: "manual",
                  value: "",
                  excluded: false,
                });
              }}
            >
              {t.split.useThis}
            </Button>
          </div>
        </details>
      </div>
    </aside>
  );
}
