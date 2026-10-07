"use client";

import { Plus, Trash2 } from "lucide-react";
import { cn } from "./ui";

/** Минимальный генератор формы по JSON Schema (object / array / string / enum / boolean / number) с $ref на $defs. */
export interface JsonSchema {
  type?: string | string[];
  enum?: unknown[];
  const?: unknown;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  $ref?: string;
  $defs?: Record<string, JsonSchema>;
  description?: string;
  title?: string;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  default?: unknown;
}

type Issues = Record<string, string[]>;

const LABELS: Record<string, string> = {
  left_style: "Левая плашка",
  speak: "Что озвучивать",
  hide: "Что спрятать в конце",
  reveal: "Показать ответ в конце",
  items: "Строки",
  left: "Слева",
  right: "Справа",
  sub: "Подпись (2-й язык)",
};

const ENUM_LABELS: Record<string, string> = {
  badge: "бордовая (числа)",
  dark: "чёрная",
  right: "правую часть",
  both: "пару целиком",
  left: "левую часть",
};

function resolve(s: JsonSchema, root: JsonSchema): JsonSchema {
  if (s.$ref?.startsWith("#/$defs/")) return root.$defs?.[s.$ref.slice(8)] ?? s;
  return s;
}

function typeOf(s: JsonSchema): string {
  if (s.enum) return "enum";
  const t = Array.isArray(s.type) ? s.type.find((x) => x !== "null") : s.type;
  return t ?? "string";
}

function blank(s: JsonSchema, root: JsonSchema): unknown {
  const r = resolve(s, root);
  if (r.default !== undefined) return r.default;
  switch (typeOf(r)) {
    case "object":
      return Object.fromEntries((r.required ?? []).map((k) => [k, blank(r.properties![k]!, root)]));
    case "array":
      return [];
    case "boolean":
      return false;
    case "number":
    case "integer":
      return 0;
    case "enum":
      return r.enum?.[0];
    default:
      return "";
  }
}

export function SchemaForm({ schema, value, onChange, issues = {}, path = "body" }: { schema: JsonSchema; value: unknown; onChange: (v: unknown) => void; issues?: Issues; path?: string }) {
  return <Node schema={schema} root={schema} value={value} onChange={onChange} issues={issues} path={path} />;
}

function Node({ schema, root, value, onChange, issues, path, label, compact }: { schema: JsonSchema; root: JsonSchema; value: unknown; onChange: (v: unknown) => void; issues: Issues; path: string; label?: string; compact?: boolean }) {
  const s = resolve(schema, root);
  const t = typeOf(s);
  const errs = issues[path] ?? [];
  const bad = errs.length > 0;

  if (t === "object") {
    const obj = (value ?? {}) as Record<string, unknown>;
    const keys = Object.keys(s.properties ?? {});
    return (
      <div className={cn(compact ? "flex flex-1 gap-2" : "grid gap-3")}>
        {keys.map((k) => (
          <Node
            key={k}
            schema={s.properties![k]!}
            root={root}
            value={obj[k]}
            onChange={(v) => onChange({ ...obj, [k]: v })}
            issues={issues}
            path={`${path}.${k}`}
            label={LABELS[k] ?? k}
            compact={compact}
          />
        ))}
      </div>
    );
  }

  if (t === "array") {
    const arr = (Array.isArray(value) ? value : []) as unknown[];
    const item = s.items ?? {};
    const max = s.maxItems ?? 100;
    return (
      <div className="grid gap-2">
        <div className="flex items-center justify-between text-xs font-bold text-mute">
          <span>
            {label} ({arr.length}
            {s.minItems ? `, мин. ${s.minItems}` : ""}, макс. {max})
          </span>
          <button
            type="button"
            disabled={arr.length >= max}
            onClick={() => onChange([...arr, blank(item, root)])}
            className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-ink hover:bg-panel-2 disabled:opacity-40"
          >
            <Plus size={12} /> строка
          </button>
        </div>
        {arr.map((v, i) => (
          <div key={i} className={cn("flex items-center gap-2 rounded-xl p-1", issues[`${path}.${i}`]?.length && "ring-2 ring-rosso/60")}>
            <span className="w-5 text-right text-xs text-mute">{i + 1}</span>
            <Node schema={item} root={root} value={v} onChange={(nv) => onChange(arr.map((x, j) => (j === i ? nv : x)))} issues={issues} path={`${path}.${i}`} compact />
            <button type="button" onClick={() => onChange(arr.filter((_, j) => j !== i))} className="rounded-lg p-1.5 text-mute hover:bg-panel-2 hover:text-rosso" aria-label="Удалить строку">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {errs.map((e, i) => (
          <div key={i} className="text-xs text-rosso">
            {e}
          </div>
        ))}
      </div>
    );
  }

  const field =
    t === "enum" ? (
      <select value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} className={inputCls(bad)}>
        {s.enum!.map((o) => (
          <option key={String(o)} value={String(o)}>
            {ENUM_LABELS[String(o)] ?? String(o)}
          </option>
        ))}
      </select>
    ) : t === "boolean" ? (
      <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[var(--color-verde-2)]" />
    ) : t === "number" || t === "integer" ? (
      <input type="number" value={Number(value ?? 0)} onChange={(e) => onChange(Number(e.target.value))} className={inputCls(bad)} />
    ) : (
      <input
        value={String(value ?? "")}
        maxLength={s.maxLength}
        placeholder={compact ? label : undefined}
        onChange={(e) => onChange(Array.isArray(s.type) && s.type.includes("null") && e.target.value === "" ? null : e.target.value)}
        className={inputCls(bad)}
        title={errs.join("\n") || s.description}
      />
    );

  if (compact) return <div className="min-w-0 flex-1">{field}</div>;
  return (
    <label className={cn("grid gap-1 text-sm", t === "boolean" && "flex items-center gap-2")}>
      <span className="text-xs font-bold text-mute">{label}</span>
      {field}
      {errs.map((e, i) => (
        <span key={i} className="text-xs text-rosso">
          {e}
        </span>
      ))}
    </label>
  );
}

export const inputCls = (bad = false) => cn("w-full rounded-lg border bg-panel-2 px-2.5 py-1.5 text-sm outline-none focus:border-verde-2", bad ? "border-rosso" : "border-line");

/** issues[] с путями вида body.items.3.right → словарь path → сообщения (для подсветки полей). */
export function issuesByPath(issues: { field: string; message: string }[]): Issues {
  const out: Issues = {};
  for (const i of issues) (out[i.field] ??= []).push(i.message);
  return out;
}
