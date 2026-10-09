import { AbsoluteFill } from "remotion";
import { Mascot } from "../components/Mascots";

/** Шапка канала YouTube 2560×1440. Всё важное — в безопасной зоне 1546×423 по центру (её видно и на телефоне). */
export const BANNER_ID = "ChannelBanner";
export const BANNER_W = 2560;
export const BANNER_H = 1440;
const SAFE_W = 1546;
const SAFE_H = 423;

export function ChannelBanner({ title = "Italiano Per Te", tagline = "Learn Italian the fun way", note = "New lessons every week" }: { title?: string; tagline?: string; note?: string }) {
  const sx = (BANNER_W - SAFE_W) / 2;
  const sy = (BANNER_H - SAFE_H) / 2;
  const face = (emotion: "happy" | "surprised" | "neutral") => ({ mouth: 0 as const, blink: false, emotion, t: 0 });
  return (
    <AbsoluteFill style={{ fontFamily: "Montserrat", overflow: "hidden", background: "linear-gradient(135deg, #1B1035 0%, #3C1E6E 55%, #5B2A9E 100%)" }}>
      {/* лучи от чашки */}
      <AbsoluteFill style={{ background: "repeating-conic-gradient(from 0deg at 41% 50%, rgba(255,255,255,0.05) 0deg 8deg, transparent 8deg 20deg)" }} />
      <div style={{ position: "absolute", left: sx - 120, top: sy - 330, width: 1100, height: 1100, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,214,10,0.30) 0%, transparent 62%)" }} />
      {/* триколор сверху и снизу */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 26, background: "linear-gradient(90deg, #009246 0 33.3%, #F1F2F1 33.3% 66.6%, #CE2B37 66.6% 100%)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 26, background: "linear-gradient(90deg, #009246 0 33.3%, #F1F2F1 33.3% 66.6%, #CE2B37 66.6% 100%)" }} />

      {/* друзья чашки — по краям (видны на ТВ и десктопе, на телефоне обрезаются) */}
      <div style={{ position: "absolute", left: 120, top: 560, transform: "rotate(-8deg)", opacity: 0.95 }}>
        <Mascot character="pizza" height={380} s={face("happy")} />
      </div>
      <div style={{ position: "absolute", left: 360, top: 900, transform: "rotate(6deg)", opacity: 0.9 }}>
        <Mascot character="gelato" height={300} s={face("surprised")} />
      </div>
      <div style={{ position: "absolute", right: 140, top: 520, transform: "rotate(7deg)", opacity: 0.95 }}>
        <Mascot character="limone" height={330} s={face("happy")} />
      </div>
      <div style={{ position: "absolute", right: 360, top: 880, transform: "rotate(-6deg)", opacity: 0.9 }}>
        <Mascot character="vespa" height={320} s={face("neutral")} />
      </div>
      {/* разбросанные итальянские слова */}
      {[
        ["Ciao!", 560, 300, -10],
        ["Grazie", 1820, 260, 8],
        ["Andiamo!", 620, 1140, 6],
        ["Bellissimo", 1500, 1180, -7],
      ].map(([w, x, y, r]) => (
        <div key={String(w)} style={{ position: "absolute", left: Number(x), top: Number(y), transform: `rotate(${r}deg)`, fontSize: 64, fontWeight: 900, color: "rgba(255,255,255,0.16)" }}>
          {w}
        </div>
      ))}

      {/* безопасная зона: чашка + название */}
      <div style={{ position: "absolute", left: sx, top: sy, width: SAFE_W, height: SAFE_H, display: "flex", alignItems: "center", gap: 50 }}>
        <div style={{ flexShrink: 0, filter: "drop-shadow(0 20px 30px rgba(0,0,0,0.45))", marginTop: 20 }}>
          <Mascot character="espresso" height={430} s={face("happy")} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22, whiteSpace: "nowrap" }}>
          <div style={{ fontSize: 150, fontWeight: 900, lineHeight: 0.95, color: "#FFFFFF", letterSpacing: -3, WebkitTextStroke: "12px #14082B", paintOrder: "stroke fill", textShadow: "0 10px 0 #14082B" }}>
            {title.split(" ").map((w, i) => (
              <span key={i} style={{ color: i === 0 ? "#FFFFFF" : i === 1 ? "#2DE53A" : "#FF4B4B", marginRight: 26 }}>
                {w}
              </span>
            ))}
          </div>
          <div style={{ display: "flex" }}>
            <span style={{ background: "#FFD60A", color: "#14082B", fontWeight: 900, fontSize: 56, padding: "10px 34px", borderRadius: 999, boxShadow: "0 8px 0 rgba(0,0,0,0.3)" }}>{tagline}</span>
          </div>
          <span style={{ color: "rgba(255,255,255,0.88)", fontWeight: 800, fontSize: 44, paddingLeft: 10 }}>{note}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
}
