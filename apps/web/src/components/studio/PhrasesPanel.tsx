"use client";

import { Loader2, Mic, Play, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { ProjectFull } from "@/lib/api";
import { cn } from "../ui";
import { revoiceClip } from "./revoice";
import { fmtTime, useStudio } from "./store";

type Bad = { text: string; heard?: string; score: number };

/** Все фразы ролика списком: поиск по тексту, «только проблемные» (по проверке Whisper), переход и переозвучка. */
export function PhrasesPanel({ project, onSeek, onClose }: { project: ProjectFull; onSeek: (t: number) => void; onClose: () => void }) {
  const doc = useStudio((s) => s.doc)!;
  const select = useStudio((s) => s.select);
  const selected = useStudio((s) => s.selected);
  const [q, setQ] = useState("");
  const [onlyBad, setOnlyBad] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const bad = useMemo(() => {
    const r = (project.meta?.report as { pronunciation?: { still_bad?: Bad[] } } | undefined)?.pronunciation?.still_bad ?? [];
    return new Map(r.map((b) => [b.text, b]));
  }, [project.meta]);
  const subs = useMemo(
    () => doc.tracks.filter((t) => t.kind === "subtitle").flatMap((t) => t.clips).sort((a, b) => a.start - b.start),
    [doc],
  );
  const needle = q.trim().toLowerCase();
  const rows = subs.filter((c) => {
    const p = c.props as { text?: string; tr?: string; take?: number };
    if (onlyBad && !(bad.has(p.text ?? "") && !p.take)) return false;
    return !needle || `${p.text ?? ""} ${p.tr ?? ""}`.toLowerCase().includes(needle);
  });
  const badCount = subs.filter((c) => bad.has(String((c.props as { text?: string }).text)) && !(c.props as { take?: number }).take).length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between p-3 pb-2">
        <span className="font-display text-sm font-semibold">Фразы · {subs.length}</span>
        <button onClick={onClose} className="text-xs text-mute hover:text-ink">
          закрыть
        </button>
      </div>
      <div className="grid gap-1.5 px-3 pb-2">
        <label className="flex items-center gap-1.5 rounded-md border border-line bg-panel-2 px-2 py-1">
          <Search size={12} className="text-mute" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="поиск по тексту или переводу" className="w-full bg-transparent text-xs outline-none" />
        </label>
        <label className="flex items-center gap-2 text-[11px]">
          <input type="checkbox" checked={onlyBad} onChange={(e) => setOnlyBad(e.target.checked)} />
          только проблемные по проверке произношения ({badCount})
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-2 pb-3">
        {rows.map((c) => {
          const p = c.props as { text?: string; tr?: string; lang?: string; take?: number };
          const b = bad.get(p.text ?? "");
          const flagged = b && !p.take;
          const sel = selected.includes(c.id);
          return (
            <div
              key={c.id}
              className={cn("mb-1 rounded-md px-2 py-1.5 text-xs", sel ? "bg-panel-2 ring-1 ring-giallo" : "hover:bg-panel-2", flagged && "border-l-2 border-rosso")}
              onClick={() => (select([c.id]), onSeek(c.start + 0.05))}
            >
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] text-mute">{fmtTime(c.start)}</span>
                <span className="rounded bg-panel px-1 text-[9px] font-bold uppercase text-mute">{p.lang ?? (p.tr ? "it" : "en")}</span>
                {p.take ? <span className="text-[9px] font-bold text-verde-2">дубль {p.take}</span> : null}
                <span className="ml-auto flex gap-1">
                  <button title="Перейти и слушать" onClick={(e) => (e.stopPropagation(), select([c.id]), onSeek(c.start + 0.05))} className="text-mute hover:text-ink">
                    <Play size={12} />
                  </button>
                  <button
                    title="Переозвучить фразу"
                    disabled={!!busy}
                    onClick={async (e) => {
                      e.stopPropagation();
                      setBusy(c.id);
                      await revoiceClip(c.id);
                      setBusy(null);
                    }}
                    className="text-mute hover:text-verde-2 disabled:opacity-40"
                  >
                    {busy === c.id ? <Loader2 size={12} className="animate-spin" /> : <Mic size={12} />}
                  </button>
                </span>
              </div>
              <div className="mt-0.5 font-semibold">{p.text}</div>
              {p.tr ? <div className="text-[11px] text-mute">{p.tr}</div> : null}
              {flagged ? <div className="mt-0.5 text-[10px] text-rosso">Whisper услышал: «{b.heard || "—"}» · {Math.round(b.score * 100)}%</div> : null}
            </div>
          );
        })}
        {!rows.length ? <div className="p-3 text-xs text-mute">Ничего не найдено.</div> : null}
      </div>
    </div>
  );
}
