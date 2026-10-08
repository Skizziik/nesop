"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api, ApiError, type Series, type SeriesInput } from "@/lib/api";
import { inputCls } from "./SchemaForm";
import { Badge, Button, Card, CardTitle, Empty, cn } from "./ui";

const FORMATS: Record<string, string> = {
  list_mystery: "Список с загадкой",
  quiz_abc: "Квиз A/B/C",
  spot_the_error: "Найди ошибку",
  false_friends: "Ложные друзья",
  fill_blank: "Вставь слово",
  level_ladder: "От A1 до C2",
  tongue_twister: "Скороговорка",
  idiom: "Идиома",
  emoji_vocab: "Эмодзи-словарь",
  conjugation_challenge: "Спряжение",
  daily_word: "Слово дня",
};
const ANSWER: Record<string, string> = { hide: "только в комментах", reveal: "показать в конце", answer_tomorrow: "ответ завтра (закреп)" };
const HOOKS: Record<string, string> = {
  hidden_answer: "Напиши ответ",
  abc: "A, B или C",
  level: "Какой у тебя уровень?",
  challenge: "Челлендж",
  native_language: "Как на твоём языке?",
  debate: "Спорная норма",
  streak: "Серия (streak)",
};

export function SeriesPage() {
  const qc = useQueryClient();
  const { data: series = [] } = useQuery({ queryKey: ["series"], queryFn: api.series });
  const [edit, setEdit] = useState<Series | "new" | null>(null);
  return (
    <div className="mx-auto grid max-w-7xl gap-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold">Серии</h1>
        <Button onClick={() => setEdit("new")}>
          <Plus size={16} /> Новая серия
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {series.map((s) => (
          <Card key={s.id} className="cursor-pointer transition-colors hover:border-verde/60" onClick={() => setEdit(s)}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-display text-lg font-semibold">{s.name}</div>
                <div className="text-xs text-mute">
                  {FORMATS[s.format] ?? s.format} · {s.level}
                </div>
              </div>
              {s.implemented ? <Badge tone="green">формат готов</Badge> : <Badge tone="yellow">формат — этап 4</Badge>}
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-mute">{s.description}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <Badge>в банке {s.counts.lessons}</Badge>
              <Badge tone="green">готово {s.counts.ready}</Badge>
              <Badge>эпизодов {s.episode_counter}</Badge>
              {s.auto_approve ? <Badge tone="blue">авто-аппрув</Badge> : <Badge>ручной аппрув</Badge>}
            </div>
          </Card>
        ))}
      </div>
      {edit ? <SeriesDrawer s={edit === "new" ? null : edit} onClose={() => (setEdit(null), void qc.invalidateQueries({ queryKey: ["series"] }))} /> : null}
    </div>
  );
}

function SeriesDrawer({ s, onClose }: { s: Series | null; onClose: () => void }) {
  const { data: palettes = [] } = useQuery({ queryKey: ["palettes"], queryFn: api.palettes });
  const { data: avatars = [] } = useQuery({ queryKey: ["assets", "avatar"], queryFn: () => api.assets("avatar") });
  const [f, setF] = useState<SeriesInput>(
    s ?? { name: "", format: "list_mystery", level: "A1", topic: "", description: "", palettes: [], fonts: ["Montserrat", "Fredoka", "Nunito"], auto_approve: false, answer_mode: "hide", answer_delay_h: 24, hook_type: "hidden_answer", second_lang: null, voice: {} },
  );
  const set = (patch: Partial<SeriesInput>) => setF({ ...f, ...patch });
  const onErr = (e: unknown) => toast.error(e instanceof ApiError ? e.message : "Ошибка");
  const save = useMutation({
    mutationFn: () => {
      const { name, format, level, topic, description, palettes: pal, fonts, auto_approve, answer_mode, answer_delay_h, hook_type, second_lang, voice, youtube_playlist_id, avatar } = f;
      const body = { name, format, level, topic, description, palettes: pal, fonts, auto_approve, answer_mode, answer_delay_h, hook_type, second_lang, voice, youtube_playlist_id, avatar };
      return s ? api.patchSeries(s.id, body) : api.createSeries(body);
    },
    onSuccess: () => (toast.success("Сохранено"), onClose()),
    onError: onErr,
  });
  const archive = useMutation({ mutationFn: () => api.archiveSeries(s!.id), onSuccess: () => (toast.success("Серия в архиве"), onClose()), onError: onErr });
  const pal = f.palettes ?? [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <div className="h-full w-full max-w-2xl overflow-auto border-l border-line bg-panel p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold">{s ? s.name : "Новая серия"}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-mute hover:bg-panel-2" aria-label="Закрыть">
            <X />
          </button>
        </div>
        <div className="grid gap-3 text-sm">
          <Row label="Название">
            <input className={inputCls()} value={f.name} onChange={(e) => set({ name: e.target.value })} />
          </Row>
          <div className="grid grid-cols-2 gap-3">
            <Row label="Формат">
              <select className={inputCls()} value={f.format} onChange={(e) => set({ format: e.target.value })} disabled={!!s}>
                {Object.entries(FORMATS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="Уровень">
              <select className={inputCls()} value={f.level} onChange={(e) => set({ level: e.target.value })}>
                {["A1", "A2", "B1", "B2", "C1", "C2"].map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </Row>
          </div>
          <Row label="Тематика">
            <input className={inputCls()} value={f.topic ?? ""} onChange={(e) => set({ topic: e.target.value })} />
          </Row>
          <Row label="Описание">
            <textarea className={inputCls()} rows={2} value={f.description ?? ""} onChange={(e) => set({ description: e.target.value })} />
          </Row>
          <Row label={`Палитры (${pal.length || "все"})`}>
            <div className="flex flex-wrap gap-2">
              {palettes.map((p) => {
                const on = pal.includes(p.name);
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => set({ palettes: on ? pal.filter((x) => x !== p.name) : [...pal, p.name] })}
                    className={cn("flex items-center gap-2 rounded-full border px-2 py-1 text-xs", on ? "border-verde-2" : "border-line opacity-60")}
                  >
                    <span className="h-4 w-4 rounded-full border border-white/30" style={{ background: String(p.bg) }} />
                    {p.name}
                  </button>
                );
              })}
            </div>
          </Row>
          <div className="grid grid-cols-2 gap-3">
            <Row label="Тип призыва в комменты">
              <select className={inputCls()} value={f.hook_type} onChange={(e) => set({ hook_type: e.target.value })}>
                {Object.entries(HOOKS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="Ответ">
              <select className={inputCls()} value={f.answer_mode} onChange={(e) => set({ answer_mode: e.target.value })}>
                {Object.entries(ANSWER).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Row>
            {f.answer_mode === "answer_tomorrow" ? (
              <Row label="Через сколько часов ответ">
                <input type="number" className={inputCls()} min={1} max={168} value={f.answer_delay_h ?? 24} onChange={(e) => set({ answer_delay_h: Number(e.target.value) })} />
              </Row>
            ) : null}
            <Row label="Второй язык подписей">
              <select className={inputCls()} value={f.second_lang ?? ""} onChange={(e) => set({ second_lang: e.target.value || null })}>
                <option value="">нет</option>
                <option value="en">английский</option>
                <option value="ru">русский</option>
                <option value="uk">украинский</option>
                <option value="es">испанский</option>
              </select>
            </Row>
            <Row label={`Скорость голоса: ${(f.voice?.speed ?? 0.92).toFixed(2)}`}>
              <input type="range" min={0.75} max={1.1} step={0.01} value={f.voice?.speed ?? 0.92} onChange={(e) => set({ voice: { ...f.voice, speed: Number(e.target.value) } })} className="accent-[var(--color-verde-2)]" />
            </Row>
            <Row label="Ведущая">
              <select
                className={inputCls()}
                value={f.avatar?.mode === "loop" ? `loop:${(f.avatar as { src?: string }).src ?? ""}` : (f.avatar?.mode ?? "none")}
                onChange={(e) => {
                  const v = e.target.value;
                  set({ avatar: v.startsWith("loop:") ? ({ mode: "loop", src: v.slice(5), position: "bottom_right", height: 320 } as Series["avatar"]) : ({ mode: v, position: "bottom_right", height: 320 } as Series["avatar"]) });
                }}
              >
                <option value="none">нет</option>
                <option value="mascot">маскот-пицца (рот по голосу)</option>
                {avatars.filter((a) => a.enabled && a.url).map((a) => (
                  <option key={a.id} value={`loop:${a.url}`}>
                    видео: {a.name}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="Плейлист YouTube (id)">
              <input className={inputCls()} value={f.youtube_playlist_id ?? ""} onChange={(e) => set({ youtube_playlist_id: e.target.value || null })} placeholder="PL…" />
            </Row>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4 accent-[var(--color-verde-2)]" checked={!!f.auto_approve} onChange={(e) => set({ auto_approve: e.target.checked })} />
            Авто-аппрув: всё, что прошло проверки, сразу в рендер
          </label>
        </div>
        <div className="mt-5 flex gap-2">
          <Button onClick={() => save.mutate()} disabled={!f.name || save.isPending}>
            Сохранить
          </Button>
          {s ? (
            <Button variant="outline" onClick={() => confirm("Убрать серию в архив? Ролики сохранятся.") && archive.mutate()}>
              <Archive size={16} /> В архив
            </Button>
          ) : null}
        </div>
        {s ? <Bank seriesId={s.id} /> : null}
      </div>
    </div>
  );
}

function Bank({ seriesId }: { seriesId: string }) {
  const qc = useQueryClient();
  const [n, setN] = useState(10);
  const fill = useMutation({
    mutationFn: () => api.fillBank(seriesId, n),
    onSuccess: () => toast.success(`LLM пишет ${n} уроков; в банк попадут только прошедшие проверки`),
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Ошибка"),
  });
  const { data: lessons = [] } = useQuery({ queryKey: ["lessons", seriesId], queryFn: () => api.lessons(seriesId) });
  const del = useMutation({
    mutationFn: (id: string) => api.deleteLesson(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lessons", seriesId] }),
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Ошибка"),
  });
  return (
    <Card className="mt-6">
      <CardTitle
        extra={
          <div className="flex items-center gap-2">
            <Badge>{lessons.length}</Badge>
            <input type="number" min={1} max={30} value={n} onChange={(e) => setN(Number(e.target.value))} className="w-14 rounded-lg bg-panel-2 px-2 py-1 text-sm" />
            <Button variant="outline" onClick={() => fill.mutate()} disabled={fill.isPending}>
              Наполнить банк
            </Button>
          </div>
        }
      >
        Банк уроков
      </CardTitle>
      {lessons.length ? (
        <div className="grid gap-1">
          {lessons.map((l) => {
            const items = ((l.script.body as { items?: { left: string; right: string }[] })?.items ?? []).map((i) => i.right);
            return (
              <div key={l.id} className="flex items-center gap-3 rounded-lg bg-panel-2 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{l.title}</div>
                  <div className="truncate text-xs text-mute">{items.join(" · ")}</div>
                </div>
                <Badge>{l.source}</Badge>
                <Badge tone={l.used_count ? "green" : "gray"}>×{l.used_count}</Badge>
                <button className="rounded p-1 text-mute hover:text-rosso" onClick={() => confirm("Удалить урок из банка?") && del.mutate(l.id)} aria-label="Удалить урок">
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <Empty>Банк пуст. Нажми «Наполнить банк» — LLM придумает и проверит уроки.</Empty>
      )}
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-bold text-mute">{label}</span>
      {children}
    </label>
  );
}
