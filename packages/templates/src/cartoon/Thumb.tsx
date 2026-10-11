/**
 * Обложка мультика 1280×720: локация, герои крупно с яркими эмоциями, «предмет истории» (эмодзи) и 1-3 слова.
 * Дети не читают — решают герои и эмоции; родители считывают тему по слову.
 */
import { AbsoluteFill } from "remotion";
import { actionPose, type ActionKind } from "./actions";
import { CAST } from "./cast";
import { locationDef, locationProps } from "./locations";
import { Character, type CEmotion } from "./rig";
import { GROUND } from "./scenes";

export interface CartoonThumbProps {
  text: string;
  chars: string[]; // 1-3 героя
  emotions?: CEmotion[];
  actions?: ActionKind[];
  location?: string;
  emoji?: string; // большой предмет истории: 🍎 🎈 🧸
  variant?: number;
}

export const CARTOON_THUMB_ID = "CartoonThumb";

const ACCENTS = ["#FFE45C", "#FF6FA8", "#7CF29A"];

export function CartoonThumb({ text, chars, emotions = [], actions = [], location = "garden", emoji, variant = 0 }: CartoonThumbProps) {
  const loc = locationDef(location);
  const cam = { x: 960, y: 640, zoom: 1.1 };
  const list = chars.filter((c) => CAST[c]).slice(0, 3);
  const n = Math.max(1, list.length);
  const accent = ACCENTS[variant % ACCENTS.length]!;
  const mirror = variant % 2 === 1;
  const words = text.toUpperCase().split(/\s+/).slice(0, 4);
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#000" }}>
      {/* фон и герои рисуем в мире 1920×1080 и масштабируем в 1280×720 */}
      <svg viewBox="0 0 1920 1080" width={1280} height={720} style={{ position: "absolute", inset: 0 }}>
        <loc.Back {...locationProps(location, cam, 2, { uid: "thumb" })} />
        <rect x={0} y={0} width={1920} height={1080} fill="rgba(0,0,0,0.12)" />
        {list.map((id, i) => {
          const spec = CAST[id]!;
          const x = (mirror ? 520 : 1100) + (i - (n - 1) / 2) * 340;
          const e = emotions[i] ?? (["laugh", "surprised", "happy"] as CEmotion[])[i % 3]!;
          const a = actions[i] ?? (["cheer", "wave", "jump"] as ActionKind[])[i % 3]!;
          return (
            <g key={id} transform={`translate(${x} ${GROUND + 210}) scale(${n === 1 ? 2.5 : 2.05})`}>
              <Character spec={spec} st={{ pose: actionPose(a, 0.45, 1.2), emotion: e, mouth: e === "laugh" || e === "surprised" ? 0.7 : 0.3, blink: false, look: [0, 0], facing: 1 }} t={1.2} />
            </g>
          );
        })}
      </svg>
      {emoji ? (
        <div style={{ position: "absolute", top: 40, [mirror ? "right" : "left"]: 40, fontSize: 230, filter: "drop-shadow(0 12px 0 rgba(0,0,0,0.25))", transform: "rotate(-10deg)" }}>{emoji}</div>
      ) : null}
      <div style={{ position: "absolute", bottom: 40, [mirror ? "right" : "left"]: 46, maxWidth: 640, display: "flex", flexDirection: "column", alignItems: mirror ? "flex-end" : "flex-start" }}>
        {words.map((w, i) => (
          <div
            key={i}
            style={{
              fontFamily: "Fredoka",
              fontWeight: 700,
              fontSize: Math.min(150, Math.floor(620 / Math.max(3, w.length) / 0.62)),
              lineHeight: 0.98,
              color: i === words.length - 1 ? accent : "#FFFFFF",
              WebkitTextStroke: "14px #2A1B5E",
              paintOrder: "stroke fill",
              textShadow: "0 10px 0 #2A1B5E",
              transform: `rotate(${i % 2 ? 2 : -3}deg)`,
            }}
          >
            {w}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}
