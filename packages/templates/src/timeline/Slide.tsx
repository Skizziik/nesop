import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Palette } from "../generated";
import { activeMark, type SlideProps } from "./types";

/** Слайд лекции. Размеры — от высоты бокса (k = h/1080), поэтому слайд работает и в 16:9, и в 9:16. */
export function Slide({ p, pal, font, w, h }: { p: SlideProps; pal: Palette; font: string; w: number; h: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const k = Math.min(h / 1080, w / 1920 * 1.15);
  const portrait = h > w;
  const act = activeMark(p.marks, t);
  const pop = (since: number) => spring({ frame: Math.round(since * fps), fps, config: { damping: 12, stiffness: 160 } });
  const enter = pop(t);

  const header = (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 * k, marginBottom: 34 * k, transform: `translateY(${(1 - enter) * 30 * k}px)`, opacity: enter }}>
      {p.chapter ? <div style={{ fontSize: 30 * k, fontWeight: 800, color: pal.accent, letterSpacing: 3 * k, textTransform: "uppercase" }}>{p.chapter}</div> : null}
      <div style={{ fontSize: (p.kind === "title" ? 96 : 64) * k, fontWeight: 800, lineHeight: 1.08, color: "#fff" }}>{p.title}</div>
      {p.subtitle ? <div style={{ fontSize: 36 * k, fontWeight: 700, color: "rgba(255,255,255,0.75)" }}>{p.subtitle}</div> : null}
    </div>
  );

  let body: React.ReactNode = null;
  if (p.kind === "explain" || p.kind === "recap") {
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: 22 * k }}>
        {(p.bullets ?? []).map((b, i) => {
          const shown = !p.marks?.length || i <= act;
          const cur = i === act;
          const since = p.marks?.[i] !== undefined ? t - p.marks[i]! : 1;
          const s = shown ? pop(Math.max(since, 0)) : 0;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 22 * k,
                alignItems: "flex-start",
                opacity: shown ? 1 : 0.18,
                transform: `translateX(${(1 - s) * 40 * k}px)`,
                background: cur ? "rgba(255,255,255,0.10)" : "transparent",
                borderRadius: 22 * k,
                padding: `${12 * k}px ${18 * k}px`,
              }}
            >
              <div style={{ width: 46 * k, height: 46 * k, borderRadius: 23 * k, background: p.kind === "recap" ? pal.highlight_bg : pal.title_bg, color: "#141414", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 28 * k, flexShrink: 0 }}>
                {p.kind === "recap" ? "✓" : i + 1}
              </div>
              <div style={{ fontSize: 44 * k, fontWeight: 700, color: "#fff", lineHeight: 1.25 }}>{b}</div>
            </div>
          );
        })}
      </div>
    );
  } else if (p.kind === "examples") {
    body = (
      <div style={{ display: "grid", gridTemplateColumns: portrait ? "1fr" : "1fr 1fr", gap: 18 * k }}>
        {(p.rows ?? []).map((r, i) => {
          const cur = i === act;
          const shown = !p.marks?.length || i <= act;
          return (
            <div
              key={i}
              style={{
                background: cur ? pal.highlight_bg : pal.right_bg,
                color: cur ? pal.highlight_text : pal.right_text,
                opacity: shown ? 1 : 0.35,
                borderRadius: 26 * k,
                padding: `${18 * k}px ${26 * k}px`,
                boxShadow: `0 ${8 * k}px 0 rgba(0,0,0,0.25)`,
                transform: `scale(${cur ? 1 + 0.04 * Math.sin(pop(t - (p.marks?.[i] ?? 0)) * Math.PI) : 1})`,
              }}
            >
              <div style={{ fontSize: 46 * k, fontWeight: 800 }}>{r.it}</div>
              {r.tr ? <div style={{ fontSize: 30 * k, fontWeight: 700, opacity: 0.7, marginTop: 4 * k }}>{r.tr}</div> : null}
              {r.note ? <div style={{ fontSize: 26 * k, fontWeight: 700, marginTop: 6 * k, color: cur ? undefined : pal.accent }}>💡 {r.note}</div> : null}
            </div>
          );
        })}
      </div>
    );
  } else if (p.kind === "table" && p.table) {
    const tb = p.table;
    body = (
      <div style={{ borderRadius: 26 * k, overflow: "hidden", background: pal.right_bg, color: pal.right_text, boxShadow: `0 ${8 * k}px 0 rgba(0,0,0,0.25)` }}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${tb.header.length}, 1fr)`, background: pal.left_bg, color: pal.left_text }}>
          {tb.header.map((c, i) => (
            <div key={i} style={{ padding: `${14 * k}px ${22 * k}px`, fontSize: 34 * k, fontWeight: 800 }}>
              {c}
            </div>
          ))}
        </div>
        {tb.rows.map((row, ri) => (
          <div
            key={ri}
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${tb.header.length}, 1fr)`,
              background: ri === act ? pal.highlight_bg : ri % 2 ? "rgba(0,0,0,0.04)" : "transparent",
              color: ri === act ? pal.highlight_text : undefined,
              opacity: !p.marks?.length || ri <= act ? 1 : 0.3,
            }}
          >
            {row.map((c, ci) => (
              <div key={ci} style={{ padding: `${12 * k}px ${22 * k}px`, fontSize: 38 * k, fontWeight: ci === 0 ? 700 : 800 }}>
                {c}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  } else if (p.kind === "quiz" && p.quiz) {
    const q = p.quiz;
    const cdAt = p.countdown_at ?? 0;
    const dur = q.timer_s ?? 5;
    const revealed = p.reveal_at !== undefined && t >= p.reveal_at;
    const inCd = t >= cdAt && !revealed;
    const left = Math.max(Math.ceil(dur - (t - cdAt)), 1);
    body = (
      <div style={{ display: "flex", gap: 40 * k, alignItems: "center" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 18 * k }}>
          <div style={{ fontSize: 48 * k, fontWeight: 800, color: "#fff", marginBottom: 10 * k }}>{q.question}</div>
          {q.options.map((o, i) => {
            const right = revealed && i === q.correct;
            return (
              <div key={i} style={{ display: "flex", gap: 18 * k, alignItems: "center", opacity: revealed && !right ? 0.4 : 1 }}>
                <div style={{ width: 62 * k, height: 62 * k, borderRadius: 31 * k, background: right ? pal.highlight_bg : pal.left_bg, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 34 * k }}>
                  {"ABCD"[i]}
                </div>
                <div style={{ flex: 1, background: right ? pal.highlight_bg : pal.right_bg, color: right ? pal.highlight_text : pal.right_text, borderRadius: 999, padding: `${12 * k}px ${30 * k}px`, fontSize: 42 * k, fontWeight: 800 }}>
                  {o}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ width: 220 * k, height: 220 * k, borderRadius: "50%", background: pal.right_bg, color: pal.right_text, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 110 * k, fontWeight: 800, border: `${16 * k}px solid ${inCd ? pal.accent : revealed ? pal.highlight_bg : "rgba(0,0,0,0.15)"}`, transform: `scale(${inCd ? 1 + 0.06 * Math.max(0, 1 - ((t - cdAt) % 1) * 4) : 1})` }}>
          {revealed ? "✓" : inCd ? left : "?"}
        </div>
      </div>
    );
  }

  const glow = interpolate(Math.sin(t * 0.5), [-1, 1], [0.12, 0.22]);
  return (
    <div style={{ width: w, height: h, position: "relative", overflow: "hidden", fontFamily: font, background: `radial-gradient(circle at 20% 15%, rgba(255,255,255,${glow}), transparent 45%), linear-gradient(135deg, ${pal.bg} 0%, ${pal.bg2 ?? pal.bg} 100%)` }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 10 * k, background: "linear-gradient(90deg, #009246 0 33.3%, #F1F2F1 33.3% 66.6%, #CE2B37 66.6% 100%)" }} />
      <div
        style={{
          position: "absolute",
          left: (portrait ? 60 : 110) * k,
          right: (portrait ? 60 : 520) * k,
          top: (p.kind === "title" ? (portrait ? 520 : 300) : 110) * k,
          bottom: 190 * k,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {header}
        {body}
      </div>
    </div>
  );
}
