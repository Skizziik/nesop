"use client";

import { BACKGROUND_THEMES, MASCOT_IDS, MASCOTS, STICKER_NAMES, type Clip, type SlideProps, type TimelineDoc } from "@ipt/templates";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Mic, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { revoiceClip } from "./revoice";
import { contentEnd, findClip, useStudio } from "./store";

const ANIMS = [
  ["none", "нет"],
  ["fade", "проявление"],
  ["pop", "выпрыгивание"],
  ["slide_up", "снизу"],
  ["slide_left", "справа"],
  ["zoom", "зум"],
] as const;

const inp = "w-full rounded-md border border-line bg-panel-2 px-2 py-1 text-xs outline-none focus:border-verde-2";

export function Inspector() {
  const doc = useStudio((s) => s.doc)!;
  const selected = useStudio((s) => s.selected);
  const { updateClip, updateProps, commit, fitDuration } = useStudio();
  const f = selected.length === 1 ? findClip(doc, selected[0]!) : null;

  if (!f) {
    const st = doc.subtitle_style ?? {};
    const setDoc = (patch: Record<string, unknown>) => commit((d) => Object.assign(d, patch), "doc");
    const setSub = (patch: Record<string, unknown>) => commit((d) => (d.subtitle_style = { ...(d.subtitle_style ?? {}), ...patch }), "sub");
    return (
      <Panel title={selected.length > 1 ? `Выбрано клипов: ${selected.length}` : "Проект"}>
        <Field label="Название">
          <input className={inp} value={doc.title} onChange={(e) => setDoc({ title: e.target.value })} />
        </Field>
        <Row>
          <Field label="Длительность, с">
            <input type="number" step={0.1} className={inp} value={doc.duration_s} onChange={(e) => setDoc({ duration_s: Math.max(1, Number(e.target.value)) })} />
          </Field>
          <Field label=" ">
            <button className={`${inp} hover:bg-panel`} onClick={fitDuration} title={`По последнему клипу: ${contentEnd(doc).toFixed(1)} с`}>
              по контенту
            </button>
          </Field>
        </Row>
        <BackgroundEditor />
        <Row>
          <Field label="Шрифт">
            <select className={inp} value={doc.font ?? "Montserrat"} onChange={(e) => setDoc({ font: e.target.value })}>
              {["Montserrat", "Fredoka", "Nunito"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
        </Row>
        <div className="mt-3 text-[11px] font-bold text-mute">Стиль субтитров</div>
        <Row>
          <Field label="Размер">
            <input type="number" className={inp} value={st.size ?? 46} onChange={(e) => setSub({ size: Number(e.target.value) })} />
          </Field>
          <Field label="Высота (0-1)">
            <input type="number" step={0.01} className={inp} value={st.y ?? 0.88} onChange={(e) => setSub({ y: Number(e.target.value) })} />
          </Field>
        </Row>
        <Row>
          <Field label="Центр по X (0-1)">
            <input type="number" step={0.01} className={inp} value={st.x ?? 0.5} onChange={(e) => setSub({ x: Number(e.target.value) })} />
          </Field>
          <Field label="Ширина (0-1)">
            <input type="number" step={0.01} className={inp} value={st.max_w ?? 0.88} onChange={(e) => setSub({ max_w: Number(e.target.value) })} />
          </Field>
        </Row>
        <Row>
          <Field label="Цвет">
            <input type="color" className="h-7 w-full" value={st.color ?? "#ffffff"} onChange={(e) => setSub({ color: e.target.value })} />
          </Field>
          <Field label="Подложка">
            <input className={inp} value={st.bg ?? "rgba(0,0,0,0.6)"} onChange={(e) => setSub({ bg: e.target.value })} />
          </Field>
        </Row>
        <Check label="Показывать перевод" value={st.show_translation !== false} onChange={(v) => setSub({ show_translation: v })} />
        <Check label="Караоке (подсветка слова)" value={st.highlight_words !== false} onChange={(v) => setSub({ highlight_words: v })} />
        <p className="mt-4 text-[11px] text-mute">Выбери клип на таймлайне или прямо на превью, чтобы менять его свойства.</p>
      </Panel>
    );
  }

  const c = f.clip;
  const set = (patch: Partial<Clip>) => updateClip(c.id, patch, `clip-${c.id}`);
  const p = (c.props ?? {}) as Record<string, unknown>;
  const setP = (patch: Record<string, unknown>) => updateProps(c.id, patch, `props-${c.id}`);
  const visual = c.type !== "audio" && c.type !== "subtitle";

  return (
    <Panel title={`${c.type}${c.label ? ` · ${c.label}` : ""}`}>
      <Row>
        <Field label="Старт, с">
          <input type="number" step={0.1} className={inp} value={c.start} onChange={(e) => set({ start: Math.max(0, Number(e.target.value)) })} />
        </Field>
        <Field label="Длительность, с">
          <input type="number" step={0.1} className={inp} value={c.duration} onChange={(e) => set({ duration: Math.max(0.1, Number(e.target.value)) })} />
        </Field>
      </Row>
      <Field label="Подпись на таймлайне">
        <input className={inp} value={c.label ?? ""} onChange={(e) => set({ label: e.target.value })} />
      </Field>
      {visual ? (
        <>
          <Row>
            <Num label="X" v={c.x ?? 0} on={(x) => set({ x })} />
            <Num label="Y" v={c.y ?? 0} on={(y) => set({ y })} />
          </Row>
          <Row>
            <Num label="Ширина" v={c.w ?? 1} on={(w) => set({ w })} />
            <Num label="Высота" v={c.h ?? 1} on={(h) => set({ h })} />
          </Row>
          <Row>
            <Field label="Поворот °">
              <input type="number" className={inp} value={c.rotation ?? 0} onChange={(e) => set({ rotation: Number(e.target.value) })} />
            </Field>
            <Field label={`Прозрачность ${Math.round((c.opacity ?? 1) * 100)}%`}>
              <input type="range" min={0} max={1} step={0.05} value={c.opacity ?? 1} onChange={(e) => set({ opacity: Number(e.target.value) })} className="w-full accent-[var(--color-verde-2)]" />
            </Field>
          </Row>
          <Row>
            <Field label="Появление">
              <select className={inp} value={c.anim_in ?? "none"} onChange={(e) => set({ anim_in: e.target.value as Clip["anim_in"] })}>
                {ANIMS.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Исчезновение">
              <select className={inp} value={c.anim_out ?? "none"} onChange={(e) => set({ anim_out: e.target.value as Clip["anim_out"] })}>
                {ANIMS.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
          </Row>
          <button className={`${inp} mt-1 hover:bg-panel`} onClick={() => set({ x: 0, y: 0, w: 1, h: 1, rotation: 0 })}>
            на весь кадр
          </button>
        </>
      ) : null}
      <div className="my-3 border-t border-line" />
      {c.type === "text" ? (
        <>
          <Field label="Текст">
            <textarea rows={3} className={inp} value={String(p.text ?? "")} onChange={(e) => setP({ text: e.target.value })} />
          </Field>
          <Row>
            <Field label="Размер">
              <input type="number" className={inp} value={Number(p.size ?? 64)} onChange={(e) => setP({ size: Number(e.target.value) })} />
            </Field>
            <Field label="Выравнивание">
              <select className={inp} value={String(p.align ?? "center")} onChange={(e) => setP({ align: e.target.value })}>
                <option value="left">слева</option>
                <option value="center">центр</option>
                <option value="right">справа</option>
              </select>
            </Field>
          </Row>
          <Row>
            <Field label="Цвет">
              <input type="color" className="h-7 w-full" value={String(p.color ?? "#ffffff")} onChange={(e) => setP({ color: e.target.value })} />
            </Field>
            <Field label="Подложка">
              <ColorOrNone v={p.bg as string | null | undefined} on={(bg) => setP({ bg })} />
            </Field>
          </Row>
          <Row>
            <Field label="Обводка">
              <ColorOrNone v={p.stroke as string | null | undefined} on={(stroke) => setP({ stroke })} />
            </Field>
            <Field label="Скругление">
              <input type="number" className={inp} value={Number(p.radius ?? 24)} onChange={(e) => setP({ radius: Number(e.target.value) })} />
            </Field>
          </Row>
        </>
      ) : c.type === "subtitle" ? (
        <>
          <Revoice clipId={c.id} />
          <Field label="Итальянский">
            <textarea rows={2} className={inp} value={String(p.text ?? "")} onChange={(e) => setP({ text: e.target.value, words: undefined })} />
          </Field>
          <Field label="Перевод">
            <textarea rows={2} className={inp} value={String(p.tr ?? "")} onChange={(e) => setP({ tr: e.target.value })} />
          </Field>
        </>
      ) : c.type === "mascot" ? (
        <>
          <Field label="Персонаж">
            <select className={inp} value={String(p.character ?? "pizza")} onChange={(e) => setP({ character: e.target.value })}>
              {MASCOT_IDS.map((m) => (
                <option key={m} value={m}>
                  {MASCOTS[m]!.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Эмоция">
            <select className={inp} value={String(p.emotion ?? "auto")} onChange={(e) => setP({ emotion: e.target.value })}>
              <option value="auto">авто (говорит / улыбается)</option>
              <option value="neutral">обычная</option>
              <option value="happy">радость</option>
              <option value="surprised">удивление</option>
              <option value="thinking">думает</option>
            </select>
          </Field>
          <Check label="Говорит (рот по голосу)" value={p.talk !== false} onChange={(v) => setP({ talk: v })} />
          <Check label="Отразить" value={!!p.flip} onChange={(v) => setP({ flip: v })} />
        </>
      ) : c.type === "sticker" ? (
        <Field label="Наклейка">
          <select className={inp} value={String(p.name ?? "heart")} onChange={(e) => setP({ name: e.target.value })}>
            {STICKER_NAMES.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </Field>
      ) : c.type === "slide" ? (
        <SlideEditor p={p as unknown as SlideProps} setP={setP} />
      ) : c.type === "audio" ? (
        <>
          <Field label={`Громкость ${Math.round(Number(p.volume ?? 1) * 100)}%`}>
            <input type="range" min={0} max={1.5} step={0.01} value={Number(p.volume ?? 1)} onChange={(e) => setP({ volume: Number(e.target.value) })} className="w-full accent-[var(--color-verde-2)]" />
          </Field>
          <Row>
            <Field label="Fade in, с">
              <input type="number" step={0.5} className={inp} value={Number(p.fade_in ?? 0)} onChange={(e) => setP({ fade_in: Number(e.target.value) })} />
            </Field>
            <Field label="Fade out, с">
              <input type="number" step={0.5} className={inp} value={Number(p.fade_out ?? 0)} onChange={(e) => setP({ fade_out: Number(e.target.value) })} />
            </Field>
          </Row>
          <Field label="Сдвиг начала (обрезка), с">
            <input type="number" step={0.1} className={inp} value={c.trim ?? 0} onChange={(e) => set({ trim: Math.max(0, Number(e.target.value)) })} />
          </Field>
          <Check label="Зациклить" value={!!p.loop} onChange={(v) => setP({ loop: v })} />
        </>
      ) : c.type === "image" || c.type === "video" ? (
        <>
          <Field label="Вписать">
            <select className={inp} value={String(p.fit ?? "contain")} onChange={(e) => setP({ fit: e.target.value })}>
              <option value="contain">целиком</option>
              <option value="cover">заполнить</option>
            </select>
          </Field>
          {c.type === "video" ? (
            <>
              <Field label={`Громкость ${Math.round(Number(p.volume ?? 1) * 100)}%`}>
                <input type="range" min={0} max={1} step={0.01} value={Number(p.volume ?? 1)} onChange={(e) => setP({ volume: Number(e.target.value) })} className="w-full accent-[var(--color-verde-2)]" />
              </Field>
              <Check label="Зациклить" value={!!p.loop} onChange={(v) => setP({ loop: v })} />
            </>
          ) : null}
        </>
      ) : c.type === "shape" ? (
        <Row>
          <Field label="Заливка">
            <input className={inp} value={String(p.fill ?? "rgba(0,0,0,0.5)")} onChange={(e) => setP({ fill: e.target.value })} />
          </Field>
          <Field label="Скругление">
            <input type="number" className={inp} value={Number(p.radius ?? 24)} onChange={(e) => setP({ radius: Number(e.target.value) })} />
          </Field>
        </Row>
      ) : c.type === "short" ? (
        <p className="text-[11px] text-mute">Готовый шортс — базовый слой. Поверх добавляй текст, маскотов, наклейки и звук.</p>
      ) : null}
    </Panel>
  );
}

function SlideEditor({ p, setP }: { p: SlideProps; setP: (patch: Record<string, unknown>) => void }) {
  const list = (key: "bullets", items: string[]) => (
    <ListEdit items={items} onChange={(v) => setP({ [key]: v })} />
  );
  return (
    <>
      <p className="rounded-md bg-sky-300/10 px-2 py-1.5 text-[11px] text-sky-200">
        Заголовок, подзаголовок и содержимое двигаются отдельно: тяни голубые рамки на превью, уголок — масштаб.
      </p>
      {p.layout && Object.keys(p.layout).length ? (
        <button className={`${inp} hover:bg-panel`} onClick={() => setP({ layout: undefined })}>
          Сбросить положение элементов
        </button>
      ) : null}
      <Field label="Фон этого слайда">
        <div className="flex items-center gap-1">
          <input type="checkbox" checked={!!p.bg} onChange={(e) => setP(e.target.checked ? { bg: "#5B0A12", bg2: "#B3121B" } : { bg: undefined, bg2: undefined })} />
          {p.bg ? (
            <>
              <input type="color" className="h-7 w-full" value={p.bg} onChange={(e) => setP({ bg: e.target.value })} title="Цвет 1" />
              <input type="color" className="h-7 w-full" value={p.bg2 ?? p.bg} onChange={(e) => setP({ bg2: e.target.value })} title="Цвет 2" />
            </>
          ) : (
            <span className="text-[11px] text-mute">как у всего видео</span>
          )}
        </div>
      </Field>
      <Field label="Тип слайда">
        <select className={inp} value={p.kind} onChange={(e) => setP({ kind: e.target.value })}>
          {["title", "explain", "examples", "table", "quiz", "recap"].map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      </Field>
      <Field label="Надзаголовок">
        <input className={inp} value={p.chapter ?? ""} onChange={(e) => setP({ chapter: e.target.value })} />
      </Field>
      <Field label="Заголовок">
        <input className={inp} value={p.title} onChange={(e) => setP({ title: e.target.value })} />
      </Field>
      {p.kind === "title" ? (
        <Field label="Подзаголовок">
          <input className={inp} value={p.subtitle ?? ""} onChange={(e) => setP({ subtitle: e.target.value })} />
        </Field>
      ) : null}
      {p.kind === "explain" || p.kind === "recap" ? <Field label="Пункты">{list("bullets", p.bullets ?? [])}</Field> : null}
      {p.kind === "examples" ? (
        <Field label="Примеры (итальянский | перевод)">
          <ListEdit
            items={(p.rows ?? []).map((r) => `${r.it} | ${r.tr ?? ""}`)}
            onChange={(v) => setP({ rows: v.map((s) => ({ it: s.split("|")[0]!.trim(), tr: (s.split("|")[1] ?? "").trim() })) })}
          />
        </Field>
      ) : null}
      {p.kind === "table" && p.table ? (
        <Field label="Строки таблицы (ячейки через |)">
          <ListEdit items={[p.table.header.join(" | "), ...p.table.rows.map((r) => r.join(" | "))]} onChange={(v) => setP({ table: { header: (v[0] ?? "").split("|").map((x) => x.trim()), rows: v.slice(1).map((r) => r.split("|").map((x) => x.trim())) } })} />
        </Field>
      ) : null}
      {p.kind === "quiz" && p.quiz ? (
        <>
          <Field label="Вопрос">
            <input className={inp} value={p.quiz.question} onChange={(e) => setP({ quiz: { ...p.quiz!, question: e.target.value } })} />
          </Field>
          <Field label="Варианты (отметь правильный)">
            {p.quiz.options.map((o, i) => (
              <div key={i} className="mb-1 flex items-center gap-1">
                <input type="radio" checked={p.quiz!.correct === i} onChange={() => setP({ quiz: { ...p.quiz!, correct: i } })} />
                <input className={inp} value={o} onChange={(e) => setP({ quiz: { ...p.quiz!, options: p.quiz!.options.map((x, j) => (j === i ? e.target.value : x)) } })} />
              </div>
            ))}
          </Field>
          <Row>
            <Field label="Таймер с, сек">
              <input type="number" step={0.1} className={inp} value={p.countdown_at ?? 0} onChange={(e) => setP({ countdown_at: Number(e.target.value) })} />
            </Field>
            <Field label="Ответ с, сек">
              <input type="number" step={0.1} className={inp} value={p.reveal_at ?? 4} onChange={(e) => setP({ reveal_at: Number(e.target.value) })} />
            </Field>
          </Row>
        </>
      ) : null}
      {p.marks?.length ? (
        <Field label="Время подсветки пунктов, с (через запятую)">
          <input className={inp} value={p.marks.join(", ")} onChange={(e) => setP({ marks: e.target.value.split(",").map((x) => Number(x.trim())).filter((x) => !Number.isNaN(x)) })} />
        </Field>
      ) : null}
    </>
  );
}

function ListEdit({ items, onChange }: { items: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="grid gap-1">
      {items.map((it, i) => (
        <div key={i} className="flex gap-1">
          <input className={inp} value={it} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-mute hover:text-rosso">
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      <button onClick={() => onChange([...items, ""])} className="flex items-center gap-1 text-[11px] text-verde-2">
        <Plus size={12} /> добавить
      </button>
    </div>
  );
}

function ColorOrNone({ v, on }: { v: string | null | undefined; on: (v: string | null) => void }) {
  return (
    <div className="flex items-center gap-1">
      <input type="checkbox" checked={!!v} onChange={(e) => on(e.target.checked ? "#000000" : null)} />
      {v ? <input type="color" className="h-7 w-full" value={v.startsWith("#") ? v : "#000000"} onChange={(e) => on(e.target.value)} /> : <span className="text-[11px] text-mute">нет</span>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="h-full overflow-auto p-3">
      <div className="mb-3 truncate font-display text-sm font-semibold">{title}</div>
      <div className="grid gap-2">{children}</div>
    </div>
  );
}
const Row = ({ children }: { children: React.ReactNode }) => <div className="grid grid-cols-2 gap-2">{children}</div>;
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-0.5">
      <span className="text-[10px] font-bold text-mute">{label}</span>
      {children}
    </label>
  );
}
function Num({ label, v, on }: { label: string; v: number; on: (v: number) => void }) {
  return (
    <Field label={label}>
      <input type="number" step={0.01} className={inp} value={Math.round(v * 1000) / 1000} onChange={(e) => on(Number(e.target.value))} />
    </Field>
  );
}
function Check({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="accent-[var(--color-verde-2)]" />
      {label}
    </label>
  );
}

/** Новый дубль голоса для этой фразы (лекции): сервер озвучивает заново, проверяет Whisper и вклеивает на место старого. */
function Revoice({ clipId }: { clipId: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={async () => (setBusy(true), await revoiceClip(clipId), setBusy(false))}
      disabled={busy}
      className="flex items-center justify-center gap-1.5 rounded-md bg-verde px-2 py-1.5 text-xs font-bold text-white hover:bg-verde-2 disabled:opacity-60"
    >
      {busy ? <Loader2 size={13} className="animate-spin" /> : <Mic size={13} />} {busy ? "Озвучиваю… (до минуты)" : "Переозвучить фразу"}
    </button>
  );
}

/** Фон всего видео: готовые темы, свои цвета градиента, картинка или видео из «Ассетов» с затемнением. */
function BackgroundEditor() {
  const doc = useStudio((s) => s.doc)!;
  const commit = useStudio((s) => s.commit);
  const { data: images = [] } = useQuery({ queryKey: ["assets", "sticker"], queryFn: () => api.assets("sticker") });
  const { data: avatars = [] } = useQuery({ queryKey: ["assets", "avatar"], queryFn: () => api.assets("avatar") });
  const { data: backgrounds = [] } = useQuery({ queryKey: ["assets", "background"], queryFn: () => api.assets("background") });
  const media = [...backgrounds, ...images, ...avatars].filter((a) => a.url);
  const pal = (doc.palette ?? {}) as { bg?: string; bg2?: string };
  const bg = pal.bg ?? "#1B1035";
  const bg2 = pal.bg2 ?? "#3C1E6E";
  const setColors = (c: { bg: string; bg2: string; name?: string }) =>
    commit((d) => {
      d.palette = { ...((d.palette ?? {}) as Record<string, unknown>), ...c };
      d.background = c.bg;
    }, "bg-colors");
  const bm = doc.background_media;
  return (
    <div className="grid gap-2 rounded-lg border border-line p-2">
      <span className="text-[11px] font-bold">Фон видео</span>
      <div className="grid grid-cols-3 gap-1.5">
        {BACKGROUND_THEMES.map((t) => (
          <button
            key={t.id}
            onClick={() => setColors({ bg: t.bg, bg2: t.bg2, name: t.id })}
            title={t.name}
            className={`h-9 rounded-md border-2 ${bg === t.bg && bg2 === t.bg2 ? "border-verde-2" : "border-transparent"}`}
            style={{ background: `linear-gradient(135deg, ${t.bg}, ${t.bg2})` }}
          />
        ))}
      </div>
      <Row>
        <Field label="Цвет 1">
          <input type="color" className="h-7 w-full" value={bg} onChange={(e) => setColors({ bg: e.target.value, bg2 })} />
        </Field>
        <Field label="Цвет 2">
          <input type="color" className="h-7 w-full" value={bg2} onChange={(e) => setColors({ bg, bg2: e.target.value })} />
        </Field>
      </Row>
      <Field label="Картинка или видео фоном">
        <select
          className={inp}
          value={bm?.src ?? ""}
          onChange={(e) => {
            const a = media.find((x) => x.url === e.target.value);
            commit((d) => {
              d.background_media = a ? { src: a.url!, kind: /\.(webm|mp4|mov)$/i.test(a.url!) ? "video" : "image", dim: d.background_media?.dim ?? 0.45 } : undefined;
            });
          }}
        >
          <option value="">— нет (цветной градиент) —</option>
          {media.map((a) => (
            <option key={a.id} value={a.url!}>
              {a.name}
            </option>
          ))}
        </select>
      </Field>
      {bm ? (
        <Field label={`Затемнение ${Math.round((bm.dim ?? 0.45) * 100)}%`}>
          <input
            type="range"
            min={0}
            max={0.85}
            step={0.05}
            value={bm.dim ?? 0.45}
            onChange={(e) => commit((d) => d.background_media && (d.background_media.dim = Number(e.target.value)), "bg-dim")}
            className="w-full accent-[var(--color-verde-2)]"
          />
        </Field>
      ) : (
        <p className="text-[10px] text-mute">Свои картинки и видео загружаются на странице «Ассеты» (тип «Фон»).</p>
      )}
    </div>
  );
}
