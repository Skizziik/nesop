"use client";

import { MASCOT_IDS, MASCOTS, Mascot, STICKER_NAMES, type Clip } from "@ipt/templates";
import { useQuery } from "@tanstack/react-query";
import { Film, Image as ImageIcon, Music, Presentation, Square, Subtitles, Type } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { cn } from "../ui";
import { useStudio } from "./store";

type NewClip = Omit<Clip, "id">;

const TABS = [
  { id: "text", label: "Текст", icon: Type },
  { id: "mascot", label: "Маскоты", icon: null },
  { id: "slide", label: "Слайды", icon: Presentation },
  { id: "media", label: "Медиа", icon: ImageIcon },
] as const;

export function AddPanel() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("text");
  const doc = useStudio((s) => s.doc)!;
  const playhead = useStudio((s) => s.playhead);
  const addClip = useStudio((s) => s.addClip);
  const portrait = doc.canvas.h > doc.canvas.w;
  const at = Math.min(playhead, Math.max(0, doc.duration_s - 0.5));
  const add = (c: Partial<NewClip> & Pick<NewClip, "type" | "props">, dur = 4) => addClip({ start: Math.round(at * 100) / 100, duration: dur, x: 0, y: 0, w: 1, h: 1, ...c } as NewClip);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid grid-cols-4 border-b border-line">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn("py-2 text-[11px] font-bold", tab === t.id ? "bg-panel-2 text-ink" : "text-mute hover:text-ink")}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {tab === "text" ? (
          <div className="grid gap-2">
            <Tile onClick={() => add({ type: "text", x: 0.1, y: 0.08, w: 0.8, h: 0.14, anim_in: "pop", anim_out: "fade", props: { text: "Titolo", size: 84, color: "#FFFFFF", stroke: "#1B1035" } })} icon={<Type size={18} />} title="Заголовок" hint="крупный текст с обводкой" />
            <Tile onClick={() => add({ type: "text", x: 0.25, y: 0.7, w: 0.5, h: 0.09, anim_in: "slide_up", anim_out: "fade", props: { text: "Подпись", size: 44, color: "#1B1B1B", bg: "#FFE135" } })} icon={<Type size={18} />} title="Плашка" hint="текст на цветной подложке" />
            <Tile onClick={() => add({ type: "text", x: 0.55, y: 0.15, w: 0.35, h: 0.16, rotation: -4, anim_in: "pop", anim_out: "pop", props: { text: "Attenzione! 👀", size: 52, color: "#FFFFFF", bg: "#E3262E", radius: 40 } })} icon={<Type size={18} />} title="Выноска" hint="наклонная яркая плашка" />
            <Tile onClick={() => add({ type: "subtitle", props: { text: "Testo del sottotitolo", tr: "Перевод" } }, 3)} icon={<Subtitles size={18} />} title="Субтитр" hint="на дорожку субтитров" />
            <Tile onClick={() => add({ type: "shape", x: 0.05, y: 0.75, w: 0.9, h: 0.18, props: { fill: "rgba(0,0,0,0.55)", radius: 30 } })} icon={<Square size={18} />} title="Фигура" hint="подложка / рамка" />
            <div className="mt-2 text-[11px] font-bold text-mute">Наклейки</div>
            <div className="grid grid-cols-3 gap-2">
              {STICKER_NAMES.map((n) => (
                <button key={n} onClick={() => add({ type: "sticker", x: 0.8, y: 0.1, w: portrait ? 0.15 : 0.08, h: portrait ? 0.085 : 0.14, anim_in: "pop", props: { name: n } })} className="rounded-lg bg-panel-2 py-2 text-xs hover:ring-1 hover:ring-verde-2">
                  {n}
                </button>
              ))}
            </div>
          </div>
        ) : tab === "mascot" ? (
          <div className="grid grid-cols-2 gap-2">
            {MASCOT_IDS.map((m) => (
              <button
                key={m}
                onClick={() =>
                  add(
                    { type: "mascot", label: MASCOTS[m]!.name, x: portrait ? 0.6 : 0.72, y: portrait ? 0.62 : 0.36, w: portrait ? 0.36 : 0.24, h: portrait ? 0.22 : 0.56, anim_in: "pop", anim_out: "pop", props: { character: m, emotion: "auto", talk: true } },
                    10,
                  )
                }
                className="flex flex-col items-center rounded-xl bg-panel-2 p-2 hover:ring-1 hover:ring-verde-2"
              >
                <Mascot character={m} height={70} s={{ mouth: 0, blink: false, emotion: "happy", t: 0 }} />
                <span className="mt-1 text-[11px] font-semibold">{MASCOTS[m]!.name}</span>
              </button>
            ))}
          </div>
        ) : tab === "slide" ? (
          <div className="grid gap-2">
            {(
              [
                ["title", "Титул", { kind: "title", chapter: "Capitolo", title: "Nuovo capitolo" }],
                ["explain", "Объяснение", { kind: "explain", title: "Regola", bullets: ["Primo punto", "Secondo punto", "Terzo punto"], marks: [0.5, 2, 3.5] }],
                ["examples", "Примеры", { kind: "examples", title: "Esempi", rows: [{ it: "il gatto", tr: "кот" }, { it: "la casa", tr: "дом" }], marks: [0.5, 2] }],
                ["table", "Таблица", { kind: "table", title: "Tabella", table: { header: ["io", "tu"], rows: [["sono", "sei"]] } }],
                ["quiz", "Квиз", { kind: "quiz", title: "Quiz", quiz: { question: "Domanda?", options: ["A", "B", "C"], correct: 0, timer_s: 4 }, countdown_at: 1, reveal_at: 5 }],
                ["recap", "Повторение", { kind: "recap", title: "Ripasso", bullets: ["Punto 1", "Punto 2"] }],
              ] as const
            ).map(([k, label, props]) => (
              <Tile key={k} onClick={() => add({ type: "slide", label, anim_in: "slide_left", props: props as unknown as Record<string, unknown> }, 8)} icon={<Presentation size={18} />} title={label} hint="на дорожку сцен" />
            ))}
          </div>
        ) : (
          <Media add={add} />
        )}
      </div>
    </div>
  );
}

function Media({ add }: { add: (c: Partial<NewClip> & Pick<NewClip, "type" | "props">, dur?: number) => string }) {
  const { data: music = [] } = useQuery({ queryKey: ["assets", "music"], queryFn: () => api.assets("music") });
  const { data: stickers = [] } = useQuery({ queryKey: ["assets", "sticker"], queryFn: () => api.assets("sticker") });
  const { data: avatars = [] } = useQuery({ queryKey: ["assets", "avatar"], queryFn: () => api.assets("avatar") });
  return (
    <div className="grid gap-2 text-xs">
      <div className="font-bold text-mute">Музыка</div>
      {music.map((m) => (
        <Tile key={m.id} onClick={() => add({ type: "audio", label: m.name, props: { src: m.url!, volume: 0.08, loop: true, fade_in: 1, fade_out: 2 } }, 30)} icon={<Music size={16} />} title={m.name} hint={m.license} />
      ))}
      <div className="mt-2 font-bold text-mute">Картинки и видео (загрузка — в «Ассетах»)</div>
      {[...stickers, ...avatars].filter((a) => a.url).map((a) => {
        const vid = /\.(webm|mp4|mov)$/i.test(a.url!);
        return (
          <Tile
            key={a.id}
            onClick={() => add({ type: vid ? "video" : "image", label: a.name, x: 0.6, y: 0.5, w: 0.35, h: 0.45, props: { src: a.url!, fit: "contain", loop: true, volume: 0 } }, 6)}
            icon={vid ? <Film size={16} /> : <ImageIcon size={16} />}
            title={a.name}
            hint={a.license}
          />
        );
      })}
      {!music.length && !stickers.length && !avatars.length ? <div className="text-mute">Пока пусто — добавь файлы на странице «Ассеты».</div> : null}
    </div>
  );
}

function Tile({ onClick, icon, title, hint }: { onClick: () => void; icon: React.ReactNode; title: string; hint?: string }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 rounded-xl bg-panel-2 px-3 py-2 text-left hover:ring-1 hover:ring-verde-2">
      <span className="text-verde-2">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold">{title}</span>
        {hint ? <span className="block truncate text-[11px] text-mute">{hint}</span> : null}
      </span>
    </button>
  );
}
