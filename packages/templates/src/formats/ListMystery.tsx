import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { ListMysteryBody, RenderProps } from "../generated";
import { Pill } from "../components/Pill";
import { activeEvent, highlightedIndex } from "../lib/timeline";
import { fitFontSize, upper } from "../lib/text";
import { SAFE_RECT } from "../lib/safe";

export const LIST_TOP = 450;
export const LIST_BOTTOM = 1560;
const BADGE_BG = "#8E1B2E"; // бордовая плашка для чисел, как в старых роликах

export interface RowLayout {
  x: number;
  y: number;
  rowH: number;
  pillH: number;
  leftW: number;
  rightW: number;
  gap: number;
}

/** Чистая функция раскладки (тестируется отдельно). */
export function layoutList(body: ListMysteryBody, layout: "center" | "left", hasSub: boolean): RowLayout {
  const n = body.items.length;
  const rowH = Math.min(132, (LIST_BOTTOM - LIST_TOP) / n);
  const pillH = rowH * (hasSub ? 0.66 : 0.78);
  const maxLeft = Math.max(...body.items.map((i) => [...i.left].length), 2);
  const width = SAFE_RECT.x1 - SAFE_RECT.x0 - 20;
  const gap = 22;
  const leftW = Math.round(Math.min(Math.max(maxLeft * pillH * 0.55 + 70, 150), width * 0.42));
  const rightW = Math.round(Math.min(width - leftW - gap, 520));
  const total = leftW + gap + rightW;
  const x = layout === "left" ? SAFE_RECT.x0 + 20 : Math.round(SAFE_RECT.x0 + (SAFE_RECT.x1 - SAFE_RECT.x0 - total) / 2);
  const y = Math.round(LIST_TOP + (LIST_BOTTOM - LIST_TOP - rowH * n) / 2);
  return { x, y, rowH, pillH, leftW, rightW, gap };
}

export const ListMystery: React.FC<{ props: RenderProps }> = ({ props }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const body = props.body as unknown as ListMysteryBody;
  const { theme, timeline } = props;
  const pal = theme.palette;
  const font = theme.font;
  const hasSub = !!theme.second_lang && body.items.some((i) => !!i.sub);
  const L = layoutList(body, theme.layout, hasSub);
  const hi = highlightedIndex(timeline, t);
  const hiEv = activeEvent(timeline, t, "highlight");
  const revealEv = timeline.find((e) => e.action === "reveal");
  const revealed = !!body.reveal && !!revealEv && t >= revealEv.t_start;
  const n = body.items.length;

  return (
    <>
      {body.items.map((item, i) => {
        const isLast = i === n - 1;
        const hidden = isLast && !revealed;
        const isHi = hi === i;
        const since = isHi && hiEv ? Math.round((t - hiEv.t_start) * fps) : null;
        const bounce = since === null ? 0 : spring({ frame: since, fps, config: { damping: 8, stiffness: 220, mass: 0.6 } });
        const scale = since === null ? 1 : 1 + 0.08 * Math.sin(bounce * Math.PI);
        const pulse = hidden ? 1 + 0.06 * Math.sin((frame / fps) * Math.PI * 2.2) : 1;

        const leftText = hidden && body.hide === "left" ? "??" : upper(item.left);
        const rightText = hidden && body.hide === "right" ? "???" : upper(item.right);
        const leftBg = body.left_style === "badge" ? BADGE_BG : pal.left_bg;
        const leftColor = isHi ? pal.highlight_left_text : pal.left_text;
        const rightBg = isHi || (isLast && revealed) ? pal.highlight_bg : pal.right_bg;
        const rightColor = isHi || (isLast && revealed) ? pal.highlight_text : pal.right_text;
        const fsL = fitFontSize(leftText, L.leftW - 30, L.pillH * 0.56, font);
        const fsR = fitFontSize(rightText, L.rightW - 36, L.pillH * 0.56, font);
        const y = L.y + i * L.rowH;

        return (
          <div key={i} style={{ position: "absolute", left: L.x, top: y, display: "flex", gap: L.gap, alignItems: "flex-start" }}>
            <Pill
              width={L.leftW}
              height={L.pillH}
              bg={leftBg}
              color={leftColor}
              shape={theme.badge_shape}
              font={font}
              fontSize={fsL}
              scale={hidden && body.hide === "left" ? pulse : scale}
            >
              {leftText}
            </Pill>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <Pill
                width={L.rightW}
                height={L.pillH}
                bg={rightBg}
                color={rightColor}
                shape={theme.badge_shape}
                font={font}
                fontSize={fsR}
                scale={hidden && body.hide === "right" ? pulse : scale}
              >
                {rightText}
              </Pill>
              {hasSub && item.sub && !hidden ? (
                <div style={{ fontFamily: font, fontWeight: 700, fontSize: L.rowH * 0.2, color: pal.title_text, marginTop: 2, opacity: 0.85 }}>{item.sub}</div>
              ) : null}
            </div>
          </div>
        );
      })}
    </>
  );
};
