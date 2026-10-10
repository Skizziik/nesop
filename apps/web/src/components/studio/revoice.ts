"use client";

import type { TimelineDoc } from "@ipt/templates";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { useStudio } from "./store";

/** Переозвучить фразу (клип субтитров): сохраняет несохранённые правки, просит у сервера новый дубль, перезагружает документ. */
export async function revoiceClip(clipId: string): Promise<boolean> {
  const st = useStudio.getState();
  if (!st.projectId || !st.doc) return false;
  try {
    let rev = st.revision;
    if (st.dirty) {
      const saved = await api.saveProject(st.projectId, { doc: st.doc, title: st.doc.title, base_revision: rev });
      rev = saved.revision;
    }
    const r = await api.revoiceSentence(st.projectId, clipId, rev);
    const keep = useStudio.getState().playhead;
    st.load(st.projectId, r.doc as TimelineDoc, r.revision);
    useStudio.setState({ playhead: keep, selected: [clipId] });
    const ok = r.revoice.score >= 0.8;
    toast[ok ? "success" : "warning"](ok ? `Новый дубль #${r.revoice.take} — нажми ▶ и послушай` : `Дубль #${r.revoice.take}: распознано «${r.revoice.heard}». Можно переозвучить ещё раз`);
    return true;
  } catch (e) {
    toast.error(e instanceof ApiError ? e.message : "Не удалось переозвучить");
    return false;
  }
}
