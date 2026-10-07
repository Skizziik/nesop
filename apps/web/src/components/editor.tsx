"use client";

import type { RenderProps } from "@ipt/templates";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dices, Eye, Film, Loader2, RefreshCw, Save } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { api, ApiError, STATUS_LABEL, type Palette, type PreviewResult, type VideoFull } from "@/lib/api";
import { PreviewPlayer } from "./PreviewPlayer";
import { inputCls, issuesByPath, SchemaForm, type JsonSchema } from "./SchemaForm";
import { Badge, Button, Card, CardTitle } from "./ui";

type Script = VideoFull["script"];
type Theme = Record<string, unknown> & { palette?: Palette; layout?: string; badge_shape?: string; font?: string; bookmark?: { enabled?: boolean; position?: string } };

const SEG_LABEL = (k: string) => (k === "hook" ? "Хук" : k === "cta" ? "Призыв" : k === "reveal" ? "Ответ" : `Строка ${Number(k.split(":")[1]) + 1}`);

export function Editor({ id }: { id: string }) {
  const qc = useQueryClient();
  const { data: video } = useQuery({ queryKey: ["videos", "full", id], queryFn: () => api.video(id) });
  const { data: schemas } = useQuery({ queryKey: ["schemas"], queryFn: api.schemas, staleTime: Infinity });
  const { data: palettes = [] } = useQuery({ queryKey: ["palettes"], queryFn: api.palettes, staleTime: 60_000 });

  const [script, setScript] = useState<Script | null>(null);
  const [theme, setTheme] = useState<Theme | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [overlay, setOverlay] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (video && script === null) {
      setScript(video.script);
      setTheme((video.render_props?.theme as Theme) ?? null);
      setSpeed(video.voice?.speed ?? null);
    }
  }, [video, script]);

  const onErr = (e: unknown) => toast.error(e instanceof ApiError ? e.message : "Ошибка");

  const runPreview = useCallback(async () => {
    if (!script) return;
    setBusy(true);
    try {
      const r = await api.preview(id, { script, theme: theme ?? undefined, voice: speed ? { speed } : undefined });
      setPreview(r);
      if (!theme && r.props) setTheme((r.props as { theme: Theme }).theme);
    } catch (e) {
      onErr(e);
    } finally {
      setBusy(false);
    }
  }, [id, script, theme, speed]);

  // первое превью + автообновление после правок текста (с задержкой)
  const first = useRef(true);
  useEffect(() => {
    if (!script) return;
    if (first.current) {
      first.current = false;
      void runPreview();
      return;
    }
    const t = setTimeout(() => void runPreview(), 1200);
    return () => clearTimeout(t);
    // тема меняется мгновенно в плеере, без переозвучки
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script, speed]);

  const save = useMutation({
    mutationFn: async (render: boolean) => {
      const v = await api.saveVideo(id, { script, theme, voice: speed ? { speed } : undefined });
      if (render) {
        const r = await api.bulk([id], "approve");
        if (r.skipped.length) throw new ApiError("В рендер нельзя: в скрипте есть ошибки — исправь подсвеченные поля");
      }
      return v;
    },
    onSuccess: (_, render) => {
      setDirty(false);
      toast.success(render ? "Сохранено и отправлено в рендер" : "Сохранено");
      void qc.invalidateQueries({ queryKey: ["videos"] });
    },
    onError: onErr,
  });

  const regen = useMutation({
    mutationFn: (key: string) => api.regenLine(id, key),
    onSuccess: () => (toast.success("Новый дубль строки"), void runPreview()),
    onError: onErr,
  });

  const reroll = useMutation({
    mutationFn: () => api.rerollTheme(id),
    onSuccess: (r) => (setTheme(r.theme as Theme), setDirty(true)),
    onError: onErr,
  });

  const props = useMemo(() => {
    if (!preview?.props) return null;
    return { ...(preview.props as unknown as RenderProps), theme: (theme ?? (preview.props as { theme: Theme }).theme) as unknown as RenderProps["theme"] };
  }, [preview, theme]);

  const issues = useMemo(() => issuesByPath(preview?.issues ?? video?.issues ?? []), [preview, video]);
  if (!video || !script || !schemas) return <div className="text-mute">Загрузка…</div>;
  const bodySchema = schemas.formats[video.format] as JsonSchema | undefined;
  const ch = script.comment_hook ?? { type: "hidden_answer", text: "", spoken: "" };
  const upd = (patch: Partial<Script>) => (setScript({ ...script, ...patch }), setDirty(true));
  const updTheme = (patch: Partial<Theme>) => (setTheme({ ...(theme ?? {}), ...patch }), setDirty(true));

  return (
    <div className="mx-auto grid max-w-7xl gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/ideas" className="text-xs text-mute hover:underline">
            ← к идеям
          </Link>
          <h1 className="font-display text-2xl font-bold">{script.title}</h1>
          <div className="mt-1 flex gap-2">
            <Badge>{STATUS_LABEL[video.status]}</Badge>
            <Badge>{video.format}</Badge>
            {video.episode_no ? <Badge>эпизод {video.episode_no}</Badge> : null}
            {dirty ? <Badge tone="yellow">не сохранено</Badge> : null}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => save.mutate(false)} disabled={save.isPending}>
            <Save size={16} /> Сохранить
          </Button>
          <Button onClick={() => save.mutate(true)} disabled={save.isPending || video.status === "rendering"}>
            {save.isPending ? <Loader2 size={16} className="animate-spin" /> : <Film size={16} />} Рендер
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_400px]">
        <div className="grid content-start gap-5">
          <Card>
            <CardTitle>Текст</CardTitle>
            <div className="grid gap-3">
              <Labeled label="Заголовок" err={issues["title"]}>
                <input className={inputCls(!!issues["title"])} value={script.title} maxLength={60} onChange={(e) => upd({ title: e.target.value })} />
              </Labeled>
              <div className="grid gap-3 md:grid-cols-2">
                <Labeled label="Хук на экране (2-6 слов)">
                  <input className={inputCls()} value={String(script.hook_text ?? "")} maxLength={60} onChange={(e) => upd({ hook_text: e.target.value, spoken_hook: e.target.value })} />
                </Labeled>
                <Labeled label="Призыв в комменты (на экране)">
                  <input className={inputCls()} value={ch.text} maxLength={80} onChange={(e) => upd({ comment_hook: { ...ch, text: e.target.value } })} />
                </Labeled>
              </div>
              <Labeled label="Призыв голосом">
                <input className={inputCls()} value={ch.spoken ?? ""} maxLength={80} onChange={(e) => upd({ comment_hook: { ...ch, spoken: e.target.value } })} />
              </Labeled>
            </div>
          </Card>
          <Card>
            <CardTitle>Содержание</CardTitle>
            {bodySchema ? <SchemaForm schema={bodySchema} value={script.body} onChange={(b) => upd({ body: b })} issues={issues} /> : <div className="text-sm text-mute">Нет схемы для формата</div>}
          </Card>
          <Card>
            <CardTitle extra={<span className="text-xs text-mute">🔁 — новый дубль озвучки строки</span>}>Озвучка</CardTitle>
            <label className="mb-3 flex items-center gap-3 text-sm">
              <span className="w-40 text-mute">Скорость: {(speed ?? Number(preview?.voice?.speed ?? 0.92)).toFixed(2)}</span>
              <input type="range" min={0.75} max={1.1} step={0.01} value={speed ?? Number(preview?.voice?.speed ?? 0.92)} onChange={(e) => (setSpeed(Number(e.target.value)), setDirty(true))} className="flex-1 accent-[var(--color-verde-2)]" />
            </label>
            <div className="grid gap-1">
              {(preview?.segments ?? []).map((s) => (
                <div key={s.key} className="flex items-center gap-3 rounded-lg bg-panel-2 px-3 py-1.5 text-sm">
                  <span className="w-20 text-xs text-mute">{SEG_LABEL(s.key)}</span>
                  <span className="flex-1 truncate">{s.text}</span>
                  <button className="rounded p-1 text-mute hover:text-verde-2" title="Перегенерировать эту строку" onClick={() => regen.mutate(s.key)} disabled={regen.isPending}>
                    <RefreshCw size={14} />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid content-start gap-4 lg:sticky lg:top-6">
          {props ? <PreviewPlayer props={props} overlay={overlay} /> : <div className="flex aspect-[9/16] items-center justify-center rounded-2xl bg-panel text-mute">{busy ? "Озвучиваю…" : "Нет превью"}</div>}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant={overlay ? "primary" : "outline"} onClick={() => setOverlay((o) => !o)}>
              <Eye size={16} /> Интерфейс YouTube
            </Button>
            <Button variant="outline" onClick={() => void runPreview()} disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Обновить
            </Button>
          </div>
          <Card className="p-4">
            <CardTitle extra={<Button variant="ghost" onClick={() => reroll.mutate()} title="Другое оформление"><Dices size={16} /></Button>}>Оформление</CardTitle>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Labeled label="Палитра">
                <select className={inputCls()} value={String(theme?.palette?.name ?? "")} onChange={(e) => updTheme({ palette: palettes.find((p) => p.name === e.target.value) })}>
                  {palettes.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Labeled>
              <Labeled label="Шрифт">
                <select className={inputCls()} value={String(theme?.font ?? "Montserrat")} onChange={(e) => updTheme({ font: e.target.value })}>
                  {["Montserrat", "Fredoka", "Nunito"].map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </Labeled>
              <Labeled label="Раскладка">
                <select className={inputCls()} value={String(theme?.layout ?? "center")} onChange={(e) => updTheme({ layout: e.target.value })}>
                  <option value="center">по центру</option>
                  <option value="left">слева</option>
                </select>
              </Labeled>
              <Labeled label="Плашки">
                <select className={inputCls()} value={String(theme?.badge_shape ?? "rounded")} onChange={(e) => updTheme({ badge_shape: e.target.value })}>
                  <option value="rounded">скруглённые</option>
                  <option value="square">квадратные</option>
                  <option value="pill">таблетки</option>
                </select>
              </Labeled>
              <Labeled label="Закладка «сохрани»">
                <select
                  className={inputCls()}
                  value={theme?.bookmark?.enabled === false ? "off" : String(theme?.bookmark?.position ?? "top_right")}
                  onChange={(e) => updTheme({ bookmark: e.target.value === "off" ? { enabled: false, position: "top_right" } : { enabled: true, position: e.target.value } })}
                >
                  <option value="top_right">справа сверху</option>
                  <option value="top_left">слева сверху</option>
                  <option value="mid_right">справа посередине</option>
                  <option value="off">нет</option>
                </select>
              </Labeled>
            </div>
          </Card>
          {preview?.issues?.length ? (
            <Card className="border-giallo/40 p-4 text-sm">
              <div className="mb-1 font-bold text-giallo">Проверка</div>
              {preview.issues.map((i, k) => (
                <div key={k} className={i.severity === "error" ? "text-rosso" : "text-giallo"}>
                  {i.field}: {i.message}
                </div>
              ))}
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Labeled({ label, children, err }: { label: string; children: React.ReactNode; err?: string[] }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-bold text-mute">{label}</span>
      {children}
      {err?.map((e, i) => (
        <span key={i} className="text-xs text-rosso">
          {e}
        </span>
      ))}
    </label>
  );
}
