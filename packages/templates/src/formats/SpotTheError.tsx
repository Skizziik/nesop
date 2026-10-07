import { interpolate } from "remotion";
import type { RenderProps, SpotTheErrorBody } from "../generated";
import { Card, CONTENT_TOP, CONTENT_W, CONTENT_X, CountdownRing, pulse, useT } from "../components/Kit";
import { fitFontSize } from "../lib/text";

/** Trova l'errore: фраза с ошибкой, таймер, затем зачёркивание и правильный вариант ❌→✅. */
export const SpotTheError: React.FC<{ props: RenderProps }> = ({ props }) => {
  const b = props.body as unknown as SpotTheErrorBody;
  const { theme, timeline } = props;
  const pal = theme.palette;
  const font = theme.font;
  const T = useT(timeline);
  const rev = T.active("reveal");
  const revealed = b.reveal !== false && T.started("reveal");
  const since = rev ? T.t - rev.t_start : null;
  const strike = since === null ? (revealed ? 1 : 0) : interpolate(since, [0, 0.4], [0, 1], { extrapolateRight: "clamp" });
  const showFix = since === null ? revealed : since > 0.35;
  const idx = b.sentence.indexOf(b.wrong);
  const before = idx >= 0 ? b.sentence.slice(0, idx) : b.sentence;
  const after = idx >= 0 ? b.sentence.slice(idx + b.wrong.length) : "";
  const fs = fitFontSize(b.sentence, (CONTENT_W - 100) * (b.sentence.length > 22 ? 1.9 : 1), 78, font, 46);

  return (
    <>
      <div style={{ position: "absolute", left: CONTENT_X, top: CONTENT_TOP + 40, width: CONTENT_W }}>
        <div style={{ textAlign: "center", fontFamily: font, fontWeight: 800, fontSize: 64, color: "#fff", WebkitTextStroke: `8px ${pal.accent}`, paintOrder: "stroke fill", marginBottom: 30 }}>
          {revealed ? "✅" : "❌"} {revealed ? "Ecco l'errore!" : "Trova l'errore"}
        </div>
        <Card palette={pal} scale={revealed ? 1 : pulse(T.t, 0.015, 0.8)} style={{ textAlign: "center" }}>
          <div style={{ fontFamily: font, fontWeight: 800, fontSize: fs, lineHeight: 1.3 }}>
            {before}
            <span style={{ position: "relative", color: revealed ? pal.accent : "inherit" }}>
              {b.wrong}
              <span style={{ position: "absolute", left: -6, top: "52%", height: 10, width: `calc(${strike * 100}% + 12px)`, background: pal.accent, borderRadius: 5 }} />
            </span>
            {showFix ? <span style={{ background: pal.highlight_bg, color: pal.highlight_text, borderRadius: 12, padding: "0 12px", marginLeft: 10 }}>{b.right}</span> : null}
            {after}
          </div>
        </Card>
        {showFix && b.explanation ? (
          <div style={{ marginTop: 34, textAlign: "center", fontFamily: font, fontWeight: 700, fontSize: 40, color: pal.title_text, background: pal.title_bg, borderRadius: 24, padding: "18px 26px" }}>
            {b.explanation}
          </div>
        ) : null}
      </div>
      <div style={{ position: "absolute", left: 0, right: 150, top: CONTENT_TOP + 760, display: "flex", justifyContent: "center" }}>
        <CountdownRing ev={T.active("countdown")} t={T.t} palette={pal} size={220} />
      </div>
    </>
  );
};
