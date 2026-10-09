"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { api, ApiError, type Hook } from "@/lib/api";
import { inputCls } from "./SchemaForm";
import { Badge, Button, Card, CardTitle, cn } from "./ui";

const FORMAT_SHORT: Record<string, string> = {
  list_mystery: "список",
  quiz_abc: "квиз",
  fill_blank: "пропуск",
  spot_the_error: "ошибка",
  false_friends: "ложные друзья",
  emoji_vocab: "эмодзи",
  level_ladder: "A1→C2",
  conjugation_challenge: "спряжение",
  tongue_twister: "скороговорка",
  idiom: "идиома",
  daily_word: "слово дня",
};

export function HooksPage() {
  const qc = useQueryClient();
  const [kind, setKind] = useState<"hook" | "cta">("hook");
  const [fmt, setFmt] = useState("");
  const { data = [] } = useQuery({ queryKey: ["hooks", kind], queryFn: () => api.hooks(kind) });
  const rows = useMemo(() => data.filter((h) => !fmt || h.formats.includes(fmt) || h.formats.length === 0), [data, fmt]);
  const [text, setText] = useState("");
  const [spoken, setSpoken] = useState("");
  const [formats, setFormats] = useState<string[]>(["list_mystery", "false_friends", "emoji_vocab"]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["hooks"] });
  const onErr = (e: unknown) => toast.error(e instanceof ApiError ? e.message : "Ошибка");
  const add = useMutation({
    mutationFn: () => api.createHook({ kind, text, spoken, formats }),
    onSuccess: () => (setText(""), setSpoken(""), toast.success("Добавлено"), void refresh()),
    onError: onErr,
  });
  const gen = useMutation({
    mutationFn: () => api.generateHooks(10, formats),
    onSuccess: (r) => (toast.success(`LLM добавила ${r.added.length} хуков`), void refresh()),
    onError: onErr,
  });
  const patch = useMutation({ mutationFn: ({ id, body }: { id: string; body: Partial<Hook> }) => api.patchHook(id, body), onSuccess: () => void refresh(), onError: onErr });
  const del = useMutation({ mutationFn: (id: string) => api.deleteHook(id), onSuccess: () => void refresh(), onError: onErr });

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">Хуки и призывы</h1>
        <div className="flex gap-2">
          <Button variant={kind === "hook" ? "primary" : "outline"} onClick={() => setKind("hook")}>
            Хуки над заголовком
          </Button>
          <Button variant={kind === "cta" ? "primary" : "outline"} onClick={() => setKind("cta")}>
            Призывы в комменты
          </Button>
        </div>
      </div>
      <p className="text-sm text-mute">
        Генератор не повторяет один и тот же хук чаще раза в 15 роликов серии и не ставит одинаковые хуки в одну пачку. Выключенные не используются.
      </p>
      <Card>
        <CardTitle>Добавить</CardTitle>
        <div className="grid gap-3 md:grid-cols-2">
          <input className={inputCls()} value={text} onChange={(e) => setText(e.target.value)} placeholder={kind === "hook" ? "Текст на экране, 2-6 слов" : "Призыв на экране, напр. «Scrivi A, B o C 👇»"} maxLength={60} />
          <input className={inputCls()} value={spoken} onChange={(e) => setSpoken(e.target.value)} placeholder="Как говорит голос (необязательно, числа словами)" maxLength={160} />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {Object.entries(FORMAT_SHORT).map(([k, v]) => (
            <button
              key={k}
              onClick={() => setFormats((f) => (f.includes(k) ? f.filter((x) => x !== k) : [...f, k]))}
              className={cn("rounded-full border px-2.5 py-1 text-xs", formats.includes(k) ? "border-verde-2 text-ink" : "border-line text-mute")}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Button onClick={() => add.mutate()} disabled={text.trim().length < 2 || add.isPending}>
            <Plus size={16} /> Добавить
          </Button>
          {kind === "hook" ? (
            <Button variant="outline" onClick={() => gen.mutate()} disabled={gen.isPending}>
              <Sparkles size={16} /> Сгенерировать 10 через LLM
            </Button>
          ) : null}
        </div>
      </Card>
      <Card>
        <CardTitle
          extra={
            <select value={fmt} onChange={(e) => setFmt(e.target.value)} className="rounded-xl border border-line bg-panel-2 px-3 py-1.5 text-sm">
              <option value="">Все форматы</option>
              {Object.entries(FORMAT_SHORT).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          }
        >
          Библиотека ({rows.length})
        </CardTitle>
        <div className="grid gap-1.5">
          {rows.map((h) => (
            <div key={h.id} className={cn("flex items-center gap-3 rounded-lg bg-panel-2 px-3 py-2 text-sm", !h.enabled && "opacity-50")}>
              <input type="checkbox" checked={h.enabled} onChange={(e) => patch.mutate({ id: h.id, body: { enabled: e.target.checked } })} className="h-4 w-4 accent-[var(--color-verde-2)]" title="Использовать" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{h.text}</div>
                {h.spoken && h.spoken !== h.text ? <div className="truncate text-xs text-mute">🔊 {h.spoken}</div> : null}
              </div>
              <div className="hidden max-w-xs flex-wrap gap-1 md:flex">
                {(h.formats.length ? h.formats : ["все"]).map((f) => (
                  <Badge key={f}>{FORMAT_SHORT[f] ?? f}</Badge>
                ))}
              </div>
              <Badge tone={h.used_in_videos ? "green" : "gray"} className="w-24 justify-center">
                в роликах: {h.used_in_videos}
              </Badge>
              <Badge>{h.source}</Badge>
              <button onClick={() => confirm("Удалить?") && del.mutate(h.id)} className="rounded p-1 text-mute hover:text-rosso" aria-label="Удалить">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
