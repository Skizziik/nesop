import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { MASCOT_IDS, MASCOTS, Mascot, type Emotion } from "./Mascots";

const EMOTIONS: Emotion[] = ["neutral", "happy", "surprised", "thinking"];

/** Галерея маскотов × эмоций: превью для редактора и визуальная проверка. */
export const MascotGallery: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  return (
    <AbsoluteFill style={{ background: "#1B1035", flexDirection: "row", flexWrap: "wrap", alignContent: "center", justifyContent: "center", gap: 6, padding: 20 }}>
      {MASCOT_IDS.map((id) => (
        <div key={id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          {EMOTIONS.map((e, i) => (
            <Mascot key={e} character={id} height={230} s={{ mouth: i === 2 ? 2 : i === 1 ? 1 : 0, blink: false, emotion: e, t }} />
          ))}
          <div style={{ color: "#fff", fontFamily: "sans-serif", fontWeight: 800, fontSize: 22 }}>{MASCOTS[id]!.name}</div>
        </div>
      ))}
    </AbsoluteFill>
  );
};
