"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, PlugZap } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, ApiError, type LlmSettings } from "@/lib/api";
import { inputCls } from "./SchemaForm";
import { Badge, Button, Card, CardTitle, Empty } from "./ui";

const PURPOSE: Record<string, string> = {
  ideas: "Идеи",
  script: "Скрипты",
  verify: "Проверка",
  metadata: "Метаданные",
  hooks: "Хуки",
  test: "Тест",
};

export function SettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["llm-settings"], queryFn: api.llmSettings });
  const { data: usage } = useQuery({ queryKey: ["llm-usage"], queryFn: () => api.llmUsage(30) });
  const [f, setF] = useState<LlmSettings | null>(null);
  useEffect(() => {
    if (data && !f) setF(data);
  }, [data, f]);
  const onErr = (e: unknown) => toast.error(e instanceof ApiError ? e.message : "Ошибка");
  const save = useMutation({
    mutationFn: () => api.saveLlmSettings(f!),
    onSuccess: () => (toast.success("Сохранено"), void qc.invalidateQueries({ queryKey: ["llm-settings"] })),
    onError: onErr,
  });
  const test = useMutation({
    mutationFn: async () => (await api.saveLlmSettings(f!), api.testLlm()),
    onSuccess: (r) => toast.success(`Работает: ${r.model}, ответ ${JSON.stringify(r.answer)}, $${r.cost_usd.toFixed(5)}`),
    onError: onErr,
  });
  if (!f) return <div className="text-mute">Загрузка…</div>;
  const set = (p: Partial<LlmSettings>) => setF({ ...f, ...p });
  const total = (usage?.rows ?? []).reduce((a, r) => a + r.usd, 0);

  return (
    <div className="mx-auto grid max-w-4xl gap-5">
      <h1 className="font-display text-3xl font-bold">Настройки</h1>
      <Card>
        <CardTitle>LLM-провайдер</CardTitle>
        <div className="grid gap-3 text-sm">
          <div className="flex gap-2">
            {(["anthropic", "openai", "ollama"] as const).map((p) => (
              <Button key={p} variant={f.provider === p ? "primary" : "outline"} onClick={() => set({ provider: p })}>
                {{ anthropic: "Anthropic", openai: "OpenAI-совместимый", ollama: "Ollama (локально)" }[p]}
              </Button>
            ))}
          </div>
          {f.provider === "anthropic" ? (
            <>
              <Field label="Модель">
                <input className={inputCls()} value={f.anthropic_model} onChange={(e) => set({ anthropic_model: e.target.value })} />
              </Field>
              <div>Ключ ANTHROPIC_API_KEY: {data?.anthropic_key_set ? <Badge tone="green">задан в .env</Badge> : <Badge tone="red">не задан — впиши в .env и перезапусти</Badge>}</div>
            </>
          ) : f.provider === "openai" ? (
            <>
              <Field label="Base URL (…/v1)">
                <input className={inputCls()} value={f.openai_base_url} onChange={(e) => set({ openai_base_url: e.target.value })} />
              </Field>
              <Field label="Модель">
                <input className={inputCls()} value={f.openai_model} onChange={(e) => set({ openai_model: e.target.value })} />
              </Field>
              <div>Ключ OPENAI_API_KEY: {data?.openai_key_set ? <Badge tone="green">задан</Badge> : <Badge>не задан (можно без ключа)</Badge>}</div>
            </>
          ) : (
            <>
              <Field label="URL Ollama">
                <input className={inputCls()} value={f.ollama_url} onChange={(e) => set({ ollama_url: e.target.value })} />
              </Field>
              <Field label="Модель">
                <input className={inputCls()} value={f.ollama_model} onChange={(e) => set({ ollama_model: e.target.value })} />
              </Field>
            </>
          )}
          <p className="text-xs text-mute">Ключи хранятся только в .env на этой машине и в браузер не передаются.</p>
          <div className="flex gap-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              Сохранить
            </Button>
            <Button variant="outline" onClick={() => test.mutate()} disabled={test.isPending}>
              {test.isPending ? <Loader2 size={16} className="animate-spin" /> : <PlugZap size={16} />} Проверить связь
            </Button>
          </div>
        </div>
      </Card>
      <Card>
        <CardTitle extra={<Badge tone="green">${total.toFixed(2)} за 30 дней</Badge>}>Расход LLM</CardTitle>
        {usage?.rows.length ? (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-mute">
              <tr>
                <th className="py-1">Задача</th>
                <th>Модель</th>
                <th className="text-right">Вызовов</th>
                <th className="text-right">Токены вход / выход</th>
                <th className="text-right">$</th>
              </tr>
            </thead>
            <tbody>
              {usage.rows.map((r, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="py-1.5">{PURPOSE[r.purpose] ?? r.purpose}</td>
                  <td className="text-mute">{r.model}</td>
                  <td className="text-right">{r.calls}</td>
                  <td className="text-right text-mute">
                    {r.input_tokens.toLocaleString("ru-RU")} / {r.output_tokens.toLocaleString("ru-RU")}
                  </td>
                  <td className="text-right font-bold">{r.usd.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>Вызовов LLM ещё не было.</Empty>
        )}
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-bold text-mute">{label}</span>
      {children}
    </label>
  );
}
