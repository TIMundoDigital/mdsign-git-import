// Editor de modelos em PDF: propriedades do campo selecionado (separado de pdf-template-editor.tsx).
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppI18n } from "../i18n";
import { selectClass } from "../ui";
import {
  fieldSources,
  fieldTypes,
  type FieldSource,
  type FieldType,
  type TemplateField,
  type TemplateRole,
} from "./template-fields";

/** Nome técnico do campo: letras, números e sublinhado. */
export const FIELD_KEY = /^[a-zA-Z0-9_]{1,60}$/;

export function FieldProperties({
  field,
  roles,
  roleLabel,
  onRename,
  onChange,
  onAddPosition,
  onRemove,
}: {
  field: TemplateField;
  roles: TemplateRole[];
  roleLabel: (slot: number) => string;
  onRename: (key: string) => void;
  onChange: (patch: Partial<TemplateField>) => void;
  onAddPosition: () => void;
  onRemove: () => void;
}) {
  const { t } = useAppI18n();
  const [key, setKey] = useState(field.key);
  useEffect(() => setKey(field.key), [field.key]);
  const keyOk = FIELD_KEY.test(key);
  return (
    <div className="grid gap-3 rounded-xl border bg-white p-3">
      <label className="grid gap-1">
        <span className="font-medium">{t.pdf.variable}</span>
        <Input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onBlur={() => onRename(key)}
          aria-invalid={!keyOk}
          className="font-mono"
        />
        {!keyOk && <span className="text-xs text-destructive">{t.pdf.variableInvalid}</span>}
      </label>
      <label className="grid gap-1">
        <span className="font-medium">{t.templates.editor.fieldLabel}</span>
        <Input value={field.label} onChange={(e) => onChange({ label: e.target.value })} />
      </label>
      <label className="grid gap-1">
        <span className="font-medium">{t.templates.editor.fieldType}</span>
        <select
          value={field.type}
          onChange={(e) => onChange({ type: e.target.value as FieldType })}
          className={selectClass}
        >
          {fieldTypes.map((type) => (
            <option key={type} value={type}>
              {t.templates.editor.types[type]}
            </option>
          ))}
        </select>
      </label>
      {field.type === "select" && (
        <label className="grid gap-1">
          <span className="font-medium">{t.templates.editor.fieldOptions}</span>
          <Input
            value={(field.options ?? []).join(", ")}
            onChange={(e) => onChange({ options: e.target.value.split(",").map((o) => o.trim()) })}
          />
        </label>
      )}
      <label className="grid gap-1">
        <span className="font-medium">{t.pdf.source}</span>
        <select
          value={field.source ?? "manual"}
          onChange={(e) => onChange({ source: e.target.value as FieldSource })}
          className={selectClass}
        >
          {fieldSources.map((s) => (
            <option key={s} value={s}>
              {t.pdf.sources[s]}
            </option>
          ))}
        </select>
      </label>
      {field.source === "signer" && (
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1">
            <span className="font-medium">{t.pdf.roleOf}</span>
            <select
              value={field.slot ?? ""}
              onChange={(e) =>
                onChange(
                  e.target.value
                    ? { slot: Number(e.target.value) }
                    : { slot: undefined, slotAttr: undefined },
                )
              }
              className={selectClass}
            >
              <option value="">—</option>
              {roles.map((r) => (
                <option key={r.slot} value={r.slot}>
                  {roleLabel(r.slot)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="font-medium">{t.pdf.fillWith}</span>
            <select
              value={field.slotAttr ?? ""}
              disabled={!field.slot}
              onChange={(e) =>
                onChange({ slotAttr: (e.target.value || undefined) as TemplateField["slotAttr"] })
              }
              className={selectClass}
            >
              <option value="">{t.pdf.fillWithNone}</option>
              {(["name", "email", "cpf", "phone"] as const).map((a) => (
                <option key={a} value={a}>
                  {t.pdf.attrs[a]}
                </option>
              ))}
            </select>
          </label>
          {field.slot && field.slotAttr && (
            <p className="col-span-2 text-xs text-muted-foreground">
              {t.pdf.linkedHint.replace("{role}", roleLabel(field.slot))}
            </p>
          )}
        </div>
      )}
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={field.required ?? false}
          onChange={(e) => onChange({ required: e.target.checked })}
          className="size-4 accent-[var(--color-brand)]"
        />
        {t.templates.editor.fieldRequired}
      </label>
      {field.pdfField && (
        <p className="text-xs text-muted-foreground">
          {t.pdf.formField.replace("{name}", field.pdfField)}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {t.pdf.positions.replace("{n}", String(field.boxes?.length ?? 0))}
      </p>
      <Button size="sm" variant="outline" onClick={onAddPosition}>
        <Plus aria-hidden />
        {t.pdf.addPosition}
      </Button>
      <Button size="sm" variant="ghost" onClick={onRemove}>
        <Trash2 aria-hidden />
        {t.pdf.removeItem}
      </Button>
    </div>
  );
}
