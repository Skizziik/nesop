"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cpu, Download, Mic, Play, Trash2, Wand2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { api, ApiError, type TtsModel, type VoiceProfile } from "@/lib/api";
import { inputCls } from "./SchemaForm";
import { Badge, Button, Card, CardTitle, Empty, Progress, cn } from "./ui";

const COMMERCIAL: Record<string, { tone: "green" | "yellow" | "red"; label: string }> = {
  ok: { tone: "green", label: "коммерция ✓" },
  attribution: { tone: "green", label: "коммерция ✓ (атрибуция)" },
  risk: { tone: "yellow", label: "лицензия под вопросом" },
  no: { tone: "red", label: "non-commercial" },
};

function play(url: string) {
  void new Audio(url).play();
}

export function VoicesPage() {
  const qc = useQueryClient();
  const { data: hw } = useQuery({ queryKey: ["tts-hw"], queryFn: api.ttsHardware });
  const { data: models = [] } = useQuery({
    queryKey: ["tts-models"],
    queryFn: api.ttsModels,
    refetchInterval: (q) => (q.state.data?.some((m) => Object.values(m.installs).some((i) => i.status === "downloading")) ? 2000 : 15000),
  });
  const { data: profiles = [] } = useQuery({ queryKey: ["voice-profiles"], queryFn: api.voiceProfiles });
  const onErr = (e: unknown) => toast.error(e instanceof ApiError ? e.message : "Ошибка");
  const refresh = () => (void qc.invalidateQueries({ queryKey: ["tts-models"] }), void qc.invalidateQueries({ queryKey: ["voice-profiles"] }));
  const install = useMutation({ mutationFn: ({ id, voice }: { id: string; voice?: string }) => api.ttsInstall(id, voice), onSuccess: () => (toast.success("Скачивание началось"), refresh()), onError: onErr });
  const uninstall = useMutation({ mutationFn: ({ id, voice }: { id: string; voice?: string }) => api.ttsUninstall(id, voice), onSuccess: () => (toast.success("Удалено"), refresh()), onError: onErr });

  return (
    <div className="mx-auto grid max-w-6xl gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">Голоса</h1>
        <Badge tone={hw?.cuda ? "green" : "gray"}>
          <Cpu size={12} /> {hw?.cuda ? `${hw.gpu_name} · ${hw.vram_gb} GB VRAM` : "только CPU (GPU не найден)"}
        </Badge>
      </div>
      <Card className="border-verde/40 text-sm">
        💡 Для монетизации и узнаваемости лучше всего фирменный голос: <b>клон твоего голоса</b> или голос, созданный через <b>voice design</b>. Стоковые голоса есть у всех — YouTube
        хуже относится к «массовому» контенту.
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        {models.map((m) => (
          <ModelCard key={m.id} m={m} onInstall={(voice) => install.mutate({ id: m.id, voice })} onUninstall={(voice) => confirm("Удалить веса?") && uninstall.mutate({ id: m.id, voice })} />
        ))}
      </div>
      <Profiles models={models} profiles={profiles} onChange={refresh} />
      <AbTest profiles={profiles} />
    </div>
  );
}

function ModelCard({ m, onInstall, onUninstall }: { m: TtsModel; onInstall: (voice?: string) => void; onUninstall: (voice?: string) => void }) {
  const lic = COMMERCIAL[m.commercial] ?? COMMERCIAL.risk!;
  const installing = Object.values(m.installs).find((i) => i.status === "downloading");
  const failed = Object.values(m.installs).find((i) => i.status === "error");
  const [test, setTest] = useState(false);
  return (
    <Card className={cn(!m.fits_hardware && "opacity-60")}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-display text-lg font-semibold">{m.name}</div>
          <div className="text-xs text-mute">{m.description}</div>
        </div>
        {m.installed ? <Badge tone="green">готова</Badge> : installing ? <Badge tone="blue">качается</Badge> : <Badge>не установлена</Badge>}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge tone={lic.tone}>{lic.label}</Badge>
        <Badge>{m.requires_gpu ? `GPU · ${m.vram_gb} GB` : "CPU"}</Badge>
        {m.supports_cloning ? <Badge tone="blue">клон</Badge> : null}
        {m.supports_voice_design ? <Badge tone="blue">voice design</Badge> : null}
      </div>
      <div className="mt-1 text-xs text-mute">{m.license}</div>
      {!m.fits_hardware ? <div className="mt-2 text-xs text-giallo">{m.unfit_reason}</div> : null}
      {installing ? (
        <div className="mt-3 grid gap-1 text-xs text-mute">
          <Progress value={installing.progress} />
          {installing.message} · {Math.round(installing.progress * 100)}%
        </div>
      ) : null}
      {failed && !installing ? <div className="mt-2 text-xs text-rosso">Ошибка установки: {failed.message}</div> : null}
      {m.voices.length > 1 || m.id === "piper" ? (
        <div className="mt-3 grid gap-1">
          {m.voices.map((v) => (
            <div key={v.id} className="flex items-center gap-2 rounded-lg bg-panel-2 px-2 py-1.5 text-xs">
              <span className="flex-1 font-semibold">
                {v.name} <span className="text-mute">· {v.gender === "female" ? "жен." : "муж."}</span>
              </span>
              {v.commercial !== "ok" && v.commercial !== "attribution" ? <Badge tone="yellow">{COMMERCIAL[v.commercial]?.label}</Badge> : null}
              {v.installed ? (
                <>
                  <button className="text-verde-2" title="Тест" onClick={() => api.testVoice({ model: m.id, voice: v.id }).then((r) => play(r.url), (e) => toast.error(String(e.message)))}>
                    <Play size={14} />
                  </button>
                  <button className="text-mute hover:text-rosso" title="Удалить" onClick={() => onUninstall(v.id)}>
                    <Trash2 size={14} />
                  </button>
                </>
              ) : (
                <button className="text-mute hover:text-ink" title={`Скачать ${v.size_mb} MB`} onClick={() => onInstall(v.id)}>
                  <Download size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : null}
      <div className="mt-3 flex gap-2">
        {!m.installed && !installing ? (
          <Button onClick={() => onInstall()} disabled={!m.fits_hardware}>
            <Download size={16} /> Скачать
          </Button>
        ) : null}
        {m.installed && m.id !== "piper" ? (
          <>
            <Button variant="outline" onClick={() => (setTest(true), api.testVoice({ model: m.id, voice: m.default_voice ?? undefined }).then((r) => play(r.url), (e) => toast.error(String(e.message))).finally(() => setTest(false)))} disabled={test}>
              <Play size={16} /> Тест
            </Button>
            <Button variant="ghost" onClick={() => onUninstall()}>
              <Trash2 size={16} />
            </Button>
          </>
        ) : null}
      </div>
    </Card>
  );
}

function Profiles({ models, profiles, onChange }: { models: TtsModel[]; profiles: VoiceProfile[]; onChange: () => void }) {
  const installed = models.filter((m) => m.installed);
  const [mode, setMode] = useState<"builtin" | "design" | "clone">("builtin");
  const [name, setName] = useState("");
  const [model, setModel] = useState("piper");
  const [voice, setVoice] = useState("");
  const [speed, setSpeed] = useState(0.92);
  const [desc, setDesc] = useState("warm young Italian female teacher, clear diction, slightly slow, friendly");
  const [refText, setRefText] = useState("");
  const [consent, setConsent] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const { data: series = [] } = useQuery({ queryKey: ["series"], queryFn: api.series });
  const onErr = (e: unknown) => toast.error(e instanceof ApiError ? e.message : "Ошибка");
  const cur = installed.find((m) => m.id === model);
  const candidates = installed.filter((m) => (mode === "design" ? m.supports_voice_design : mode === "clone" ? m.supports_cloning : true));

  const create = useMutation({
    mutationFn: async () => {
      if (mode === "clone") {
        const f = file.current?.files?.[0];
        if (!f) throw new ApiError("Выбери файл с голосом");
        const form = new FormData();
        form.set("file", f);
        form.set("name", name);
        form.set("model", model);
        form.set("consent", String(consent));
        form.set("ref_text", refText);
        form.set("speed", String(speed));
        return api.cloneVoice(form);
      }
      return api.createVoice({ name, kind: mode, model, voice: mode === "builtin" ? voice || cur?.default_voice || "" : "", speed, description: mode === "design" ? desc : "" });
    },
    onSuccess: () => (toast.success("Голос создан"), setName(""), onChange()),
    onError: onErr,
  });
  const del = useMutation({ mutationFn: (id: string) => api.deleteVoice(id), onSuccess: onChange, onError: onErr });
  const apply = useMutation({
    mutationFn: (id: string) => api.applyVoice(id, series.map((s) => s.id)),
    onSuccess: (r) => toast.success(`Голос назначен ${r.updated} сериям`),
    onError: onErr,
  });

  return (
    <Card>
      <CardTitle>Мои голоса</CardTitle>
      <div className="mb-3 flex flex-wrap gap-2">
        {(["builtin", "design", "clone"] as const).map((k) => (
          <Button key={k} variant={mode === k ? "primary" : "outline"} onClick={() => setMode(k)}>
            {k === "builtin" ? "Из встроенных" : k === "design" ? (
              <>
                <Wand2 size={14} /> Voice design
              </>
            ) : (
              <>
                <Mic size={14} /> Клон по образцу
              </>
            )}
          </Button>
        ))}
      </div>
      <div className="grid gap-3 text-sm md:grid-cols-2">
        <input className={inputCls()} value={name} onChange={(e) => setName(e.target.value)} placeholder="Название, напр. «Голос канала»" />
        <select className={inputCls()} value={model} onChange={(e) => setModel(e.target.value)}>
          {candidates.length ? candidates.map((m) => <option key={m.id} value={m.id}>{m.name}</option>) : <option value="">нет подходящих установленных моделей</option>}
        </select>
        {mode === "builtin" && cur ? (
          <select className={inputCls()} value={voice} onChange={(e) => setVoice(e.target.value)}>
            {cur.voices.filter((v) => v.installed).map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        ) : null}
        {mode === "design" ? <textarea className={cn(inputCls(), "md:col-span-2")} rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Описание голоса (лучше по-английски)" /> : null}
        {mode === "clone" ? (
          <>
            <input ref={file} type="file" accept=".wav,.mp3" className="text-sm" />
            <input className={inputCls()} value={refText} onChange={(e) => setRefText(e.target.value)} placeholder="Что сказано в образце (точный текст, если модель просит)" />
            <label className="flex items-center gap-2 md:col-span-2">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="h-4 w-4 accent-[var(--color-verde-2)]" />У меня есть согласие владельца голоса (или это мой голос). Образец 10-30 сек, без музыки и шума.
            </label>
          </>
        ) : null}
        <label className="flex items-center gap-3">
          <span className="w-32 text-mute">Скорость {speed.toFixed(2)}</span>
          <input type="range" min={0.75} max={1.1} step={0.01} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="flex-1 accent-[var(--color-verde-2)]" />
        </label>
      </div>
      <Button className="mt-3" onClick={() => create.mutate()} disabled={!name || !candidates.length || (mode === "clone" && !consent) || create.isPending}>
        Создать голос
      </Button>
      <div className="mt-5 grid gap-2">
        {profiles.length ? (
          profiles.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-lg bg-panel-2 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-bold">{p.name}</div>
                <div className="truncate text-xs text-mute">
                  {p.kind === "clone" ? "клон" : p.kind === "design" ? `design: ${p.description}` : p.voice} · {p.model} · ×{p.speed}
                </div>
              </div>
              <Badge tone="green">👍 {p.wins}</Badge>
              <Badge>👎 {p.losses}</Badge>
              <button className="text-verde-2" title="Тест" onClick={() => api.testVoice({ profile_id: p.id }).then((r) => play(r.url), (e) => toast.error(String(e.message)))}>
                <Play size={16} />
              </button>
              <Button variant="outline" onClick={() => confirm("Сделать голосом по умолчанию для ВСЕХ серий?") && apply.mutate(p.id)}>
                Всем сериям
              </Button>
              <button className="text-mute hover:text-rosso" onClick={() => confirm("Удалить голос?") && del.mutate(p.id)} aria-label="Удалить">
                <Trash2 size={14} />
              </button>
            </div>
          ))
        ) : (
          <Empty>Создай первый голос — потом его можно назначить сериям.</Empty>
        )}
      </div>
    </Card>
  );
}

function AbTest({ profiles }: { profiles: VoiceProfile[] }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [round, setRound] = useState<{ left: { profile_id: string; url: string }; right: { profile_id: string; url: string } } | null>(null);
  const [revealed, setRevealed] = useState(false);
  const names = Object.fromEntries(profiles.map((p) => [p.id, p.name]));
  const start = useMutation({ mutationFn: () => api.abVoices(a, b), onSuccess: (r) => (setRound(r), setRevealed(false)), onError: (e) => toast.error(e instanceof ApiError ? e.message : "Ошибка") });
  const vote = async (win: "left" | "right") => {
    if (!round) return;
    const w = round[win].profile_id;
    const l = round[win === "left" ? "right" : "left"].profile_id;
    await api.voteVoice(w, l);
    setRevealed(true);
    toast.success(`Победил: ${names[w]}`);
  };
  if (profiles.length < 2) return null;
  return (
    <Card>
      <CardTitle>A/B сравнение вслепую</CardTitle>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {[a, b].map((val, i) => (
          <select key={i} className={cn(inputCls(), "w-56")} value={val} onChange={(e) => (i === 0 ? setA : setB)(e.target.value)}>
            <option value="">голос {i === 0 ? "A" : "B"}…</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        ))}
        <Button onClick={() => start.mutate()} disabled={!a || !b || a === b || start.isPending}>
          Новый раунд
        </Button>
      </div>
      {round ? (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {(["left", "right"] as const).map((side) => (
            <div key={side} className="grid gap-2 rounded-xl bg-panel-2 p-3 text-center">
              <div className="font-bold">{revealed ? names[round[side].profile_id] : side === "left" ? "Голос 1" : "Голос 2"}</div>
              <audio src={round[side].url} controls className="w-full" />
              <Button variant="outline" onClick={() => void vote(side)} disabled={revealed}>
                Этот лучше
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
