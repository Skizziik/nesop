import { AbsoluteFill } from "remotion";
import { CANVAS, SAFE } from "../lib/safe";

/** Оверлей интерфейса YouTube Shorts для превью: показывает, что перекрывается кнопками. В рендер не попадает. */
export const YtOverlay: React.FC = () => {
  const icons = ["👍", "👎", "💬", "↗", "⟳"];
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: SAFE.top, background: "rgba(255,0,0,0.12)", borderBottom: "3px dashed rgba(255,0,0,0.6)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: SAFE.bottom, background: "rgba(0,0,0,0.45)" }}>
        <div style={{ position: "absolute", left: 40, top: 60, display: "flex", alignItems: "center", gap: 20, color: "#fff", fontSize: 38, fontFamily: "sans-serif" }}>
          <div style={{ width: 72, height: 72, borderRadius: 36, background: "#c33" }} />
          <b>@ItalianoPerTe</b>
          <span style={{ background: "#fff", color: "#000", borderRadius: 30, padding: "10px 26px", fontSize: 32 }}>Iscriviti</span>
        </div>
        <div style={{ position: "absolute", left: 40, top: 160, color: "#fff", fontSize: 32, fontFamily: "sans-serif", opacity: 0.9 }}>Titolo del video… #shorts</div>
      </div>
      <div style={{ position: "absolute", right: 0, top: CANVAS.h - SAFE.bottom - 760, width: SAFE.right, height: 760, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-around", background: "rgba(0,0,0,0.25)" }}>
        {icons.map((i) => (
          <div key={i} style={{ width: 96, height: 96, borderRadius: 48, background: "rgba(0,0,0,0.5)", color: "#fff", fontSize: 48, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {i}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
