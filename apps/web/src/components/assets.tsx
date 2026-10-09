"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { inputCls } from "./SchemaForm";
import { Badge, Button, Card, CardTitle, Empty, cn } from "./ui";

const KINDS: Record<string, string> = { music: "Музыка", sticker: "Наклейки", avatar: "Ведущая", mascot: "Маскот", sfx: "Звуки", palette: "Палитры" };
const ACCEPT: Record<string, string> = { music: ".mp3,.wav,.ogg,.m4a", sticker: ".png,.webp,.svg", avatar: ".mp4,.webm,.mov,.png", mascot: ".png,.svg,.webp", sfx: ".wav,.mp3" };

export function AssetsPage() {
  const qc = useQueryClient();
  const [kind, setKind] = useState("music");
  const { data = [] } = useQuery({ queryKey: ["assets", kind], queryFn: () => api.assets(kind) });
  const [license, setLicense] = useState("");
  const [source, setSource] = useState("");
  const [attribution, setAttribution] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["assets"] });
  const onErr = (e: unknown) => toast.error(e instanceof ApiError ? e.message : "Ошибка");
  const upload = useMutation({
    mutationFn: async () => {
      const f = file.current?.files?.[0];
      if (!f) throw new ApiError("Выбери файл");
      const form = new FormData();
      form.set("file", f);
      form.set("kind", kind);
      form.set("license", license);
      form.set("source", source);
      form.set("attribution", attribution);
      return api.uploadAsset(form);
    },
    onSuccess: () => (toast.success("Загружено"), (file.current!.value = ""), void refresh()),
    onError: onErr,
  });
  const patch = useMutation({ mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => api.patchAsset(id, { enabled }), onSuccess: () => void refresh(), onError: onErr });
  const del = useMutation({ mutationFn: (id: string) => api.deleteAsset(id), onSuccess: () => void refresh(), onError: onErr });
  const canUpload = kind in ACCEPT;

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-5">
      <h1 className="font-display text-3xl font-bold">Ассеты</h1>
      <div className="flex flex-wrap gap-2">
        {Object.entries(KINDS).map(([k, v]) => (
          <Button key={k} variant={kind === k ? "primary" : "outline"} onClick={() => setKind(k)}>
            {v}
          </Button>
        ))}
      </div>
      {kind === "music" ? (
        <p className="text-sm text-mute">
          Музыка подмешивается тихо (−23 dB под голос), случайный трек на ролик. Загружай только своё или явно royalty-free/CC0 — у каждого файла обязательна лицензия.
        </p>
      ) : null}
      {canUpload ? (
        <Card>
          <CardTitle>Загрузить</CardTitle>
          <div className="grid gap-3 md:grid-cols-2">
            <input ref={file} type="file" accept={ACCEPT[kind]} className="text-sm" />
            <input className={inputCls(!license)} value={license} onChange={(e) => setLicense(e.target.value)} placeholder="Лицензия (обязательно): CC0, своё, Pixabay License…" />
            <input className={inputCls()} value={source} onChange={(e) => setSource(e.target.value)} placeholder="Источник (ссылка)" />
            <input className={inputCls()} value={attribution} onChange={(e) => setAttribution(e.target.value)} placeholder="Атрибуция для описания (если нужна)" />
          </div>
          <Button className="mt-3" onClick={() => upload.mutate()} disabled={!license || upload.isPending}>
            <Upload size={16} /> Загрузить
          </Button>
        </Card>
      ) : null}
      <Card>
        <CardTitle>{KINDS[kind]}</CardTitle>
        {data.length ? (
          <div className="grid gap-2">
            {data.map((a) => (
              <div key={a.id} className={cn("flex items-center gap-3 rounded-lg bg-panel-2 px-3 py-2 text-sm", !a.enabled && "opacity-50")}>
                <input type="checkbox" checked={a.enabled} onChange={(e) => patch.mutate({ id: a.id, enabled: e.target.checked })} className="h-4 w-4 accent-[var(--color-verde-2)]" />
                {kind === "palette" ? (
                  <div className="flex gap-1">
                    {["bg", "title_bg", "left_bg", "right_bg", "highlight_bg", "accent"].map((k) => (
                      <span key={k} className="h-6 w-6 rounded-full border border-white/20" style={{ background: String(a.data[k] ?? "#000") }} />
                    ))}
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{a.name}</div>
                  <div className="truncate text-xs text-mute">
                    {a.license} {a.source ? `· ${a.source}` : ""} {a.attribution ? `· ${a.attribution}` : ""}
                  </div>
                </div>
                {a.url && (kind === "music" || kind === "sfx") ? <audio src={a.url} controls className="h-8" /> : null}
                {a.url && (kind === "sticker" || kind === "mascot") ? <img src={a.url} alt={a.name} className="h-10 w-10 object-contain" /> : null}
                <Badge>{a.kind}</Badge>
                {kind !== "palette" && kind !== "sfx" ? (
                  <button onClick={() => confirm("Удалить файл?") && del.mutate(a.id)} className="rounded p-1 text-mute hover:text-rosso" aria-label="Удалить">
                    <Trash2 size={14} />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <Empty>Пока пусто.</Empty>
        )}
      </Card>
    </div>
  );
}
