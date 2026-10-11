/**
 * Заставка сериала «Benny & Friends» (~7 с) и прощальная карточка «Bye bye!». Это сцены kind "intro" / "outro":
 * рисуются вместо локации, на солнечных лучах, с героями, конфетти и прыгающими буквами логотипа.
 * Всё детерминированно от t (секунды от начала сцены). Без SVG-фильтров — только заливки, градиенты и контуры.
 */
import type { ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import { actionPose, type ActionKind } from "./actions";
import { CAST } from "./cast";
import { Character, shade, type CEmotion } from "./rig";
import { CANDY, PLUM, Sparkle, Star, candy, popAt } from "./overlays";

const W = 1920;
const H = 1080;
export const SHOW_TITLE = "Benny & Friends";
export const KIDS = ["benny", "mia", "ollie", "dot"] as const;
const HILL_Y = 930;

/* ------------------------------------------------------------------ фон */

/** Солнечные лучи: вращаются, чередуются пастельные цвета и кремовый; мягкое свечение в центре (градиент). */
export function Sunburst({ t, k = 1, warm = false, cy = 430 }: { t: number; k?: number; warm?: boolean; cy?: number }) {
  const n = 24;
  const rays = warm ? ["#FFC9A8", "#FFB3C7", "#FFD98A", "#F7B5E0"] : ["#FFE07A", "#FFC2D9", "#A8DCFF", "#BFF0A8", "#FFCFA0", "#D9C4FF"];
  const base = warm ? "#FFE9D6" : "#FFF6D8";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ position: "absolute", inset: 0 }}>
      <defs>
        <radialGradient id={warm ? "sbw" : "sb"} cx={W / 2} cy={cy} r={1100} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity={0.95} />
          <stop offset="0.28" stopColor="#FFFFFF" stopOpacity={0.35} />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={base} />
      <g transform={`translate(${W / 2} ${cy}) rotate(${t * 9}) scale(${k})`}>
        {Array.from({ length: n }, (_, i) => {
          if (i % 2) return null;
          const a0 = (i / n) * Math.PI * 2;
          const a1 = ((i + 1) / n) * Math.PI * 2;
          const R = 2200;
          return <path key={i} d={`M0 0 L${Math.cos(a0) * R} ${Math.sin(a0) * R} L${Math.cos(a1) * R} ${Math.sin(a1) * R} Z`} fill={rays[(i / 2) % rays.length]} />;
        })}
      </g>
      <rect width={W} height={H} fill={`url(#${warm ? "sbw" : "sb"})`} />
    </svg>
  );
}

/** Пушистое облачко (кружки одной заливки + светлая обводка). */
function Cloud({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-120 30 C-150 30 -150 -14 -116 -14 C-116 -54 -60 -64 -40 -34 C-28 -80 46 -80 56 -30 C80 -56 130 -36 120 0 C150 4 148 30 120 30 Z" fill="#FFFFFF" stroke="#D7E6FF" strokeWidth={6} strokeLinejoin="round" />
      <ellipse cx={-50} cy={-30} rx={26} ry={12} fill="#FFFFFF" opacity={0.8} />
    </g>
  );
}

/** Холм с цветочками внизу кадра. */
function Hill({ t, rise }: { t: number; rise: number }) {
  const y = HILL_Y + (1 - rise) * 260;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ position: "absolute", inset: 0 }}>
      <path d={`M-40 ${y + 30} C400 ${y - 60} 1500 ${y - 60} ${W + 40} ${y + 30} V${H + 40} H-40 Z`} fill="#7BD66A" stroke={shade("#7BD66A", 0.3)} strokeWidth={6} />
      <path d={`M120 ${y + 14} C500 ${y - 44} 1400 ${y - 44} ${W - 120} ${y + 14}`} fill="none" stroke="#A8EC8E" strokeWidth={14} strokeLinecap="round" opacity={0.8} />
      {Array.from({ length: 16 }, (_, i) => {
        const fx = 60 + i * 120 + (i % 3) * 14;
        const fy = y + 40 + ((i * 37) % 70);
        const c = CANDY[i % CANDY.length]!;
        const sway = Math.sin(t * 2.2 + i) * 4;
        return (
          <g key={i} transform={`translate(${fx} ${fy}) rotate(${sway})`}>
            {[0, 1, 2, 3, 4].map((j) => (
              <circle key={j} cx={Math.cos((j / 5) * Math.PI * 2) * 11} cy={Math.sin((j / 5) * Math.PI * 2) * 11} r={9} fill={c} stroke={shade(c, 0.3)} strokeWidth={3} />
            ))}
            <circle r={7} fill="#FFE45C" stroke="#E0A800" strokeWidth={3} />
          </g>
        );
      })}
    </svg>
  );
}

/** Конфетти: детерминированный дождь из полосок, кружков и звёздочек, начиная с `from` секунд. */
export function Confetti({ t, from = 0, n = 70 }: { t: number; from?: number; n?: number }) {
  const lt = t - from;
  if (lt <= 0) return null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ position: "absolute", inset: 0 }}>
      {Array.from({ length: n }, (_, i) => {
        const seed = (i * 7919) % 1000;
        const x0 = (seed * 1.93) % W;
        const speed = 260 + (seed % 7) * 40;
        const y = -60 - (seed % 9) * 70 + lt * speed;
        if (y > H + 60) return null;
        const x = x0 + Math.sin(lt * 2 + i) * 40;
        const c = candy(i);
        const rot = lt * (120 + (seed % 5) * 60) * (i % 2 ? 1 : -1);
        return (
          <g key={i} transform={`translate(${x} ${y}) rotate(${rot})`}>
            {i % 3 === 0 ? <rect x={-14} y={-6} width={28} height={12} rx={5} fill={c} /> : i % 3 === 1 ? <circle r={8} fill={c} /> : <Star r={14} color={c} stroke={shade(c, 0.25)} />}
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ логотип */

/** Буква логотипа: цветная заливка, белая обводка внутри и сливовая снаружи (два слоя), прыгает при появлении. */
function LogoLetter({ ch, color, k, bob, rot, size }: { ch: string; color: string; k: number; bob: number; rot: number; size: number }) {
  const common = { fontFamily: "Fredoka", fontWeight: 700, fontSize: size, lineHeight: 1 } as const;
  return (
    <span style={{ position: "relative", display: "inline-block", transform: `translateY(${(1 - k) * -520 + bob}px) rotate(${rot}deg) scale(${0.4 + 0.6 * k})`, opacity: k > 0 ? 1 : 0, margin: "0 -2px" }}>
      <span style={{ ...common, position: "absolute", left: 0, top: 0, color: PLUM, WebkitTextStroke: `${size * 0.16}px ${PLUM}`, transform: `translateY(${size * 0.07}px)` }}>{ch}</span>
      <span style={{ ...common, position: "relative", color, WebkitTextStroke: `${size * 0.045}px #FFFFFF`, paintOrder: "stroke fill" }}>{ch}</span>
    </span>
  );
}

/** «&» в розовом сердечке. */
function HeartAmp({ k, t }: { k: number; t: number }) {
  const beat = 1 + Math.max(0, Math.sin(t * 6)) * 0.08;
  return (
    <svg viewBox="-80 -80 160 150" width={150} height={140} style={{ overflow: "visible", margin: "0 6px", transform: `scale(${k * beat}) rotate(${Math.sin(t * 2) * 8}deg)` }}>
      <path d="M0 58 C-70 10 -84 -26 -62 -50 C-42 -72 -12 -62 0 -36 C12 -62 42 -72 62 -50 C84 -26 70 10 0 58 Z" fill="#FF5A7A" stroke={PLUM} strokeWidth={10} strokeLinejoin="round" />
      <ellipse cx={-36} cy={-36} rx={14} ry={9} fill="#FFFFFF" opacity={0.5} transform="rotate(-30 -36 -36)" />
      <text y={20} textAnchor="middle" fontFamily="Fredoka" fontWeight={700} fontSize={66} fill="#FFFFFF" stroke={PLUM} strokeWidth={6} paintOrder="stroke">
        &amp;
      </text>
    </svg>
  );
}

/** Логотип «Benny & Friends»: буквы падают по одной, потом живут (покачивание), в конце «пульс». */
export function ShowLogo({ t, fps, start = 0.45, size = 168 }: { t: number; fps: number; start?: number; size?: number }) {
  const w1 = [..."Benny"];
  const w2 = [..."Friends"];
  const step = 0.075;
  const letter = (ch: string, i: number) => {
    const d = start + i * step;
    const k = popAt(t, d, fps, 9, 150);
    const live = t > d + 0.6;
    return <LogoLetter key={i} ch={ch} size={size} color={candy(i * 3 + 1)} k={k} bob={live ? Math.sin(t * 3 + i * 0.7) * 7 : 0} rot={(i % 2 ? 4 : -4) + (live ? Math.sin(t * 2.4 + i) * 3 : 0)} />;
  };
  const ampK = popAt(t, start + w1.length * step + 0.05, fps, 8, 170);
  const pulse = 1 + Math.max(0, Math.sin((t - 4.6) * 5)) * 0.04 * (t > 4.6 && t < 5.3 ? 1 : 0);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${pulse})`, whiteSpace: "nowrap" }}>
      {w1.map((c, i) => letter(c, i))}
      <HeartAmp k={ampK} t={t} />
      {w2.map((c, i) => letter(c, i + w1.length + 1))}
    </div>
  );
}

/* ------------------------------------------------------------------ герои */

/** Герой выпрыгивает из-за холма и машет; табличка с именем под ногами. */
function KidPop({ id, x, at, t, fps, late, scale = 1.32 }: { id: string; x: number; at: number; t: number; fps: number; late: ActionKind; scale?: number }) {
  const spec = CAST[id];
  if (!spec) return null;
  const k = popAt(t, at, fps, 9, 120);
  if (k <= 0) return null;
  const tl = t - at;
  const lateAt = 4.7 - at;
  const action: ActionKind = tl < 0.35 ? "jump" : tl < lateAt ? "wave" : late;
  const atl = action === "jump" ? tl : action === "wave" ? tl - 0.35 : tl - lateAt;
  const emotion: CEmotion = tl < 0.5 ? "surprised" : "laugh";
  const mouth = tl < 0.5 ? 0.6 : 0.35 + Math.max(0, Math.sin(t * 7 + x)) * 0.35;
  const y = HILL_Y + 10 + (1 - k) * 420;
  const nameK = popAt(t, at + 0.35, fps, 10, 190);
  const c = spec.outfit.kind === "none" ? "#FF5A7A" : spec.outfit.color;
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <g transform={`translate(${x} ${y}) scale(${scale})`}>
          <Character spec={spec} st={{ pose: actionPose(action, atl, t + x), emotion, mouth, blink: Math.floor((t + x) * 10) % 41 === 0, look: [0, 0], facing: x < W / 2 ? 1 : -1 }} t={t + x} />
        </g>
      </svg>
      <div style={{ position: "absolute", left: x - 140, width: 280, top: HILL_Y + 22, display: "flex", justifyContent: "center" }}>
        <div style={{ transform: `scale(${nameK}) rotate(${Math.sin(t * 2 + x) * 3}deg)`, background: c, border: `6px solid #FFFFFF`, borderRadius: 999, padding: "0 30px 4px", boxShadow: `0 7px 0 ${shade(c, 0.4)}`, fontFamily: "Fredoka", fontWeight: 700, fontSize: 52, color: "#FFFFFF", WebkitTextStroke: `7px ${shade(c, 0.45)}`, paintOrder: "stroke fill" }}>
          {spec.name}
        </div>
      </div>
    </>
  );
}

/** Искорки, мерцающие вокруг логотипа. */
function Twinkles({ t, from, area }: { t: number; from: number; area: [number, number, number, number] }) {
  if (t < from) return null;
  const [x0, y0, x1, y1] = area;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ position: "absolute", inset: 0 }}>
      {Array.from({ length: 12 }, (_, i) => {
        const x = x0 + (((i * 611) % 1000) / 1000) * (x1 - x0);
        const y = y0 + (((i * 383) % 1000) / 1000) * (y1 - y0);
        const s = Math.max(0, Math.sin((t - from) * 4 + i * 1.7));
        return (
          <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
            <Sparkle r={18 + (i % 3) * 8} color={i % 2 ? "#FFFFFF" : candy(i)} rot={t * 60} />
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ сцены */

/** Заставка сериала: лучи раскрываются, логотип падает по буквам, четверо друзей выпрыгивают и машут, конфетти. */
export function ShowIntro({ t, fps }: { t: number; fps: number }) {
  const burstK = popAt(t, 0, fps, 14, 90);
  const hill = popAt(t, 0.15, fps, 13, 110);
  const xs = [430, 790, 1130, 1490];
  const late: ActionKind[] = ["dance", "jump", "dance", "jump"];
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Sunburst t={t} k={0.2 + 0.8 * burstK} />
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <Cloud x={-40 + ((t * 18) % 2200)} y={110} s={1} />
        <Cloud x={1700 - ((t * 12) % 2200)} y={200} s={0.75} />
      </svg>
      <Twinkles t={t} from={1.6} area={[180, 40, 1740, 420]} />
      <div style={{ position: "absolute", top: 120, left: 0, right: 0 }}>
        <ShowLogo t={t} fps={fps} />
      </div>
      <Hill t={t} rise={hill} />
      {KIDS.map((id, i) => (
        <KidPop key={id} id={id} x={xs[i]!} at={2.0 + i * 0.5} t={t} fps={fps} late={late[i]!} />
      ))}
      <Confetti t={t} from={1.7} n={80} />
    </AbsoluteFill>
  );
}

/** Значок «колокольчик» в круглой плашке (качается). */
function BellBadge({ t, k }: { t: number; k: number }) {
  const swing = Math.sin(t * 9) * 16 * (0.6 + 0.4 * Math.sin(t * 1.5));
  return (
    <svg viewBox="-80 -80 160 160" width={150} height={150} style={{ overflow: "visible", transform: `scale(${k})` }}>
      <circle cy={8} r={70} fill={shade("#FFB23F", 0.4)} />
      <circle r={70} fill="#FFB23F" stroke="#FFFFFF" strokeWidth={8} />
      <g transform={`rotate(${swing} 0 -40)`}>
        <path d="M-34 22 C-30 -10 -32 -36 0 -40 C32 -36 30 -10 34 22 L42 30 H-42 Z" fill="#FFE45C" stroke={PLUM} strokeWidth={7} strokeLinejoin="round" />
        <circle cy={38} r={9} fill="#FFE45C" stroke={PLUM} strokeWidth={6} />
        <circle cy={-44} r={6} fill={PLUM} />
        <ellipse cx={-14} cy={-14} rx={6} ry={12} fill="#FFFFFF" opacity={0.6} />
      </g>
      {[-1, 1].map((s) => (
        <path key={s} d={`M${s * 50} -26 q${s * 10} 10 0 24 M${s * 62} -36 q${s * 16} 20 0 44`} fill="none" stroke="#FFFFFF" strokeWidth={6} strokeLinecap="round" opacity={0.5 + 0.5 * Math.sin(t * 9)} />
      ))}
    </svg>
  );
}

/** Значок «палец вверх» в круглой плашке (подпрыгивает). */
function ThumbBadge({ t, k }: { t: number; k: number }) {
  return (
    <svg viewBox="-80 -80 160 160" width={150} height={150} style={{ overflow: "visible", transform: `scale(${k}) rotate(${Math.sin(t * 4) * 8}deg)` }}>
      <circle cy={8} r={70} fill={shade("#3D8BFF", 0.4)} />
      <circle r={70} fill="#3D8BFF" stroke="#FFFFFF" strokeWidth={8} />
      <g transform={`translate(0 ${-Math.abs(Math.sin(t * 4)) * 6})`}>
        <rect x={-44} y={-6} width={22} height={50} rx={7} fill="#FFFFFF" stroke={PLUM} strokeWidth={6} />
        <path d="M-18 -4 L-2 -30 C2 -40 4 -50 12 -50 C24 -50 24 -34 18 -14 L40 -14 C52 -14 54 2 46 6 C54 10 52 22 44 24 C50 30 46 40 38 40 C42 46 36 52 28 52 L-18 46 Z" fill="#FFFFFF" stroke={PLUM} strokeWidth={6} strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** Прощальная карточка: «Bye bye!» по буквам, лента «See you next time!», колокольчик и палец вверх, герои машут. */
export function ShowOutro({ t, fps, title = "Bye bye!", sub = "See you next time!" }: { t: number; fps: number; title?: string; sub?: string }) {
  const burstK = popAt(t, 0, fps, 14, 90);
  const xs = [250, 600, 1320, 1670];
  const letters = [...title];
  const subK = popAt(t, 0.35 + letters.length * 0.07, fps, 11, 160);
  const iconK = (d: number) => popAt(t, 1.2 + d, fps, 9, 170);
  const kids: ReactNode[] = KIDS.map((id, i) => {
    const spec = CAST[id];
    if (!spec) return null;
    const at = 0.1 + i * 0.18;
    const k = popAt(t, at, fps, 10, 130);
    const tl = t - at;
    const action: ActionKind = tl > 3.2 && i % 2 === 0 ? "dance" : "wave";
    return (
      <g key={id} transform={`translate(${xs[i]} ${HILL_Y + 10 + (1 - k) * 420}) scale(1.38)`}>
        <Character spec={spec} st={{ pose: actionPose(action, Math.max(0, tl - (action === "dance" ? 3.2 : 0)), t + i), emotion: "laugh", mouth: 0.3 + Math.max(0, Math.sin(t * 6 + i)) * 0.3, blink: false, look: [0, 0], facing: xs[i]! < W / 2 ? 1 : -1 }} t={t + i} />
      </g>
    );
  });
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Sunburst t={t} k={0.2 + 0.8 * burstK} warm />
      <Twinkles t={t} from={0.6} area={[200, 40, 1720, 360]} />
      <div style={{ position: "absolute", top: 50, left: 0, right: 0, display: "flex", justifyContent: "center", whiteSpace: "pre" }}>
        {letters.map((ch, i) => {
          const d = 0.25 + i * 0.07;
          const k = popAt(t, d, fps, 9, 150);
          const live = t > d + 0.6;
          return <LogoLetter key={i} ch={ch} size={190} color={candy(i * 2)} k={k} bob={live ? Math.sin(t * 3 + i * 0.8) * 9 : 0} rot={(i % 2 ? 5 : -5) + (live ? Math.sin(t * 2 + i) * 3 : 0)} />;
        })}
      </div>
      <div style={{ position: "absolute", top: 290, left: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "center", gap: 36 }}>
        <ThumbBadge t={t} k={iconK(0)} />
        <div
          style={{
            transform: `scale(${subK}) rotate(${Math.sin(t * 2) * 2}deg)`,
            background: "#8E5CFF",
            border: "8px solid #FFFFFF",
            borderRadius: 999,
            padding: "6px 54px 12px",
            boxShadow: `0 12px 0 ${shade("#8E5CFF", 0.45)}`,
            fontFamily: "Fredoka",
            fontWeight: 700,
            fontSize: 76,
            color: "#FFFFFF",
            WebkitTextStroke: `10px ${PLUM}`,
            paintOrder: "stroke fill",
          }}
        >
          {sub}
        </div>
        <BellBadge t={t} k={iconK(0.15)} />
      </div>
      <div style={{ position: "absolute", top: 448, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <div style={{ transform: `scale(${iconK(0.35)})`, background: "#FFFFFF", border: "6px solid #FF5A7A", borderRadius: 999, padding: "2px 36px 6px", fontFamily: "Fredoka", fontWeight: 700, fontSize: 50, color: "#FF5A7A", boxShadow: `0 8px 0 ${shade("#FF5A7A", 0.4)}` }}>
          Subscribe for more fun!
        </div>
      </div>
      <Hill t={t} rise={1} />
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        {kids}
      </svg>
      <Confetti t={t} from={0.9} n={50} />
    </AbsoluteFill>
  );
}
