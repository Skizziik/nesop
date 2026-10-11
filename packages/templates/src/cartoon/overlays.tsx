/**
 * Надписи поверх сцены мультика: карточка слова, заставка истории (лента), вопрос зрителю, караоке песни, субтитры.
 * Раскладка безопасных зон: карточки сверху, субтитры и караоке снизу, «?» в правом верхнем углу — лица героев (середина кадра) свободны.
 * Все движения — spring/interpolate от времени: детерминированно. Без SVG-фильтров (размытие, тени) — только сплошные «тени» смещением.
 */
import type { CSSProperties, ReactNode } from "react";
import { interpolate, spring } from "remotion";
import { CAST } from "./cast";
import { shade } from "./rig";

/** Тёмный «чернильный» цвет стиль-гайда (вместо чёрного) и сливовый контур надписей. */
export const INK = "#2A1B33";
export const PLUM = "#3A2466";
/** Сочные «конфетные» цвета для букв, лент и конфетти. */
export const CANDY = ["#FF5A7A", "#FFB23F", "#3D8BFF", "#4CB944", "#8E5CFF", "#FF8A2A", "#1FB5C9", "#FF6FA8"];

export interface OverlayDoc {
  t: number;
  dur: number;
  kind: "word" | "title" | "question" | "lyric";
  text: string;
  sub?: string;
  sung?: number; // строка песни: сколько секунд реально поётся
}
interface CaptionLine {
  char: string;
  start: number;
  dur: number;
  text: string;
}

const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
/** Простой стабильный хэш строки → цвет/вариант не меняется между рендерами. */
export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
export const candy = (i: number) => CANDY[((i % CANDY.length) + CANDY.length) % CANDY.length]!;

/** Пружинка «поп» с задержкой (сек): 0 → 1 с перелётом. */
export function popAt(lt: number, delay: number, fps: number, damping = 10, stiffness = 180): number {
  const f = Math.round((lt - delay) * fps);
  return f <= 0 ? 0 : spring({ frame: f, fps, config: { damping, stiffness } });
}
/** Плавное исчезновение в последние `len` секунд надписи. */
const outK = (lt: number, dur: number, len = 0.3) => interpolate(lt, [dur - len, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

/** Четырёхлучевая искорка (контур скруглённый), центр в 0,0. */
export function Sparkle({ r, color, rot = 0 }: { r: number; color: string; rot?: number }) {
  const k = r * 0.28;
  return <path transform={`rotate(${rot})`} d={`M0 ${-r} Q${k} ${-k} ${r} 0 Q${k} ${k} 0 ${r} Q${-k} ${k} ${-r} 0 Q${-k} ${-k} 0 ${-r} Z`} fill={color} stroke="#FFFFFF" strokeWidth={r * 0.16} strokeLinejoin="round" />;
}
/** Пятиконечная звезда со скруглёнными углами (через strokeLinejoin), центр в 0,0. */
export function starPath(R: number, r: number, rot = -90, n = 5): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = ((rot + (i * 180) / n) * Math.PI) / 180;
    const rr = i % 2 === 0 ? R : r;
    pts.push(`${(Math.cos(a) * rr).toFixed(1)} ${(Math.sin(a) * rr).toFixed(1)}`);
  }
  return `M${pts.join(" L")} Z`;
}
export function Star({ r, color, stroke = "#FFFFFF", rot = 0 }: { r: number; color: string; stroke?: string; rot?: number }) {
  return <path d={starPath(r, r * 0.5, -90 + rot)} fill={color} stroke={stroke} strokeWidth={r * 0.18} strokeLinejoin="round" />;
}

const svgAbs = (w: number, h: number, style: CSSProperties = {}): CSSProperties => ({ position: "absolute", width: w, height: h, overflow: "visible", ...style });

/* ------------------------------------------------------------------ карточка слова */

/** Карточка слова урока: белая «подушка» с цветной рамкой, буквы выпрыгивают по одной и потом бегут волной. */
function WordCard({ o, lt, fps }: { o: OverlayDoc; lt: number; fps: number }) {
  const h = hashStr(o.text);
  const frame = candy(h);
  const letters = [...o.text];
  const k = popAt(lt, 0, fps, 11, 170);
  const out = outK(lt, o.dur);
  const fs = Math.max(84, Math.min(156, Math.floor(1300 / Math.max(4, letters.length) / 0.62)));
  const step = Math.min(0.07, 0.9 / Math.max(1, letters.length));
  return (
    <div style={{ position: "absolute", top: 40, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: out }}>
      <div style={{ position: "relative", transform: `scale(${0.3 + 0.7 * k * (0.92 + 0.08 * out)}) rotate(${-2 + Math.sin(lt * 2.6) * 1.5}deg)` }}>
        {/* искорки по бокам */}
        {[-1, 1].map((side) => (
          <svg key={side} viewBox="-60 -60 120 120" style={svgAbs(120, 120, { top: -34, [side < 0 ? "left" : "right"]: -78 })}>
            <g transform={`scale(${popAt(lt, 0.25 + (side > 0 ? 0.1 : 0), fps) * (0.85 + Math.sin(lt * 5 + side) * 0.15)})`}>
              <Sparkle r={42} color={side < 0 ? "#FFD23F" : candy(h + 3)} rot={lt * 40 * side} />
              <circle cx={side * 44} cy={46} r={10} fill={candy(h + 5)} stroke="#FFFFFF" strokeWidth={3} />
            </g>
          </svg>
        ))}
        <div
          style={{
            background: "#FFFFFF",
            border: `10px solid ${frame}`,
            borderRadius: 56,
            padding: "6px 58px 14px",
            boxShadow: `0 14px 0 ${shade(frame, 0.32)}`,
            display: "flex",
            alignItems: "flex-end",
            whiteSpace: "pre",
          }}
        >
          {letters.map((ch, i) => {
            const lk = popAt(lt, 0.12 + i * step, fps, 9, 200);
            const wave = lk >= 0.99 ? Math.max(0, Math.sin((lt - 0.6 - i * 0.08) * 5)) * -10 : 0;
            const c = candy(h + i);
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  fontFamily: "Andika",
                  fontWeight: 700,
                  fontSize: fs,
                  lineHeight: 1.12,
                  color: c,
                  WebkitTextStroke: `6px ${shade(c, 0.3)}`,
                  paintOrder: "stroke fill",
                  textShadow: `0 6px 0 ${shade(c, 0.42)}`,
                  transform: `translateY(${(1 - lk) * -70 + wave}px) scale(${lk})`,
                  opacity: Math.min(1, lk * 3),
                  margin: "0 2px",
                }}
              >
                {ch}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ заставка истории / песни */

/** Хвост ленты (V-вырез + загиб), рисуется за основной лентой. */
function RibbonTail({ color, side }: { color: string; side: -1 | 1 }) {
  return (
    <svg viewBox="0 0 150 130" style={svgAbs(150, 130, { top: 34, [side < 0 ? "left" : "right"]: -104, transform: side > 0 ? "scaleX(-1)" : undefined })}>
      <path d="M8 24 H128 V112 H8 L42 68 Z" fill={shade(color, 0.12)} stroke={shade(color, 0.35)} strokeWidth={6} strokeLinejoin="round" />
      <path d="M104 24 L128 4 V24 Z M104 112 L128 124 V112 Z" fill={shade(color, 0.38)} />
      <circle cx={70} cy={50} r={7} fill="#FFFFFF" opacity={0.35} />
    </svg>
  );
}

/** Заставка: значок «Story 2» / «Sing along!» + название на ленте, слова выпрыгивают по очереди, звёздочки разлетаются. */
function TitleCard({ o, lt, fps }: { o: OverlayDoc; lt: number; fps: number }) {
  const h = hashStr(o.text);
  const band = ["#FF5A7A", "#3D8BFF", "#4CB944", "#8E5CFF", "#FF8A2A"][h % 5]!;
  const words = o.text.split(/\s+/).filter(Boolean);
  const len = o.text.length;
  const fs = len <= 14 ? 128 : len <= 22 ? 108 : len <= 32 ? 92 : 78;
  const out = outK(lt, o.dur, 0.35);
  const bandK = popAt(lt, o.sub ? 0.12 : 0, fps, 12, 160);
  const subK = popAt(lt, 0, fps, 9, 190);
  const song = /sing/i.test(o.sub ?? "");
  const burst = clamp01((lt - 0.25) / 1.1);
  return (
    <div style={{ position: "absolute", top: 70, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", opacity: out }}>
      {o.sub ? (
        <div
          style={{
            transform: `scale(${subK}) rotate(${-4 + Math.sin(lt * 3) * 2}deg)`,
            marginBottom: -14,
            zIndex: 2,
            background: "#FFE45C",
            border: `7px solid ${PLUM}`,
            borderRadius: 999,
            padding: "2px 34px 6px 26px",
            boxShadow: `0 8px 0 ${PLUM}`,
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontFamily: "Fredoka",
            fontWeight: 700,
            fontSize: 54,
            color: PLUM,
          }}
        >
          <svg viewBox="-30 -30 60 60" width={50} height={50} style={{ overflow: "visible" }}>
            {song ? (
              <g transform={`rotate(${Math.sin(lt * 6) * 12})`}>
                <path d="M-6 14 V-20 L18 -26 V8" fill="none" stroke={PLUM} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
                <ellipse cx={-12} cy={14} rx={10} ry={8} fill={PLUM} />
                <ellipse cx={12} cy={8} rx={10} ry={8} fill={PLUM} />
              </g>
            ) : (
              <g transform={`rotate(${lt * 60})`}>
                <Star r={24} color="#FF5A7A" stroke={PLUM} />
              </g>
            )}
          </svg>
          {o.sub}
        </div>
      ) : null}
      <div style={{ position: "relative", transform: `scale(${bandK}) rotate(${Math.sin(lt * 1.8) * 1.2}deg)`, maxWidth: 1560 }}>
        <RibbonTail color={band} side={-1} />
        <RibbonTail color={band} side={1} />
        {/* звёздочки разлетаются из-за ленты при появлении */}
        <svg viewBox="-800 -200 1600 400" style={svgAbs(1600, 400, { left: "50%", top: "50%", marginLeft: -800, marginTop: -200 })}>
          {burst > 0 && burst < 1
            ? Array.from({ length: 12 }, (_, i) => {
                const a = (i / 12) * Math.PI * 2 + 0.3;
                const d = 160 + burst * 560;
                return (
                  <g key={i} transform={`translate(${Math.cos(a) * d * 1.1} ${Math.sin(a) * d * 0.42}) scale(${(1 - burst) * 1.1})`}>
                    {i % 2 ? <Star r={22} color={candy(h + i)} /> : <circle r={12} fill={candy(h + i)} stroke="#FFFFFF" strokeWidth={4} />}
                  </g>
                );
              })
            : null}
        </svg>
        <div
          style={{
            position: "relative",
            background: band,
            border: `8px solid ${shade(band, 0.35)}`,
            borderRadius: 34,
            padding: o.sub ? "26px 70px 18px" : "16px 70px",
            boxShadow: `0 14px 0 ${shade(band, 0.45)}`,
            textAlign: "center",
            lineHeight: 1.08,
          }}
        >
          {/* блик на ленте */}
          <div style={{ position: "absolute", left: 30, right: 30, top: 10, height: 18, borderRadius: 99, background: "#FFFFFF", opacity: 0.22 }} />
          {words.map((w, i) => {
            const wk = popAt(lt, 0.3 + i * 0.1, fps, 9, 190);
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  margin: "0 14px",
                  fontFamily: "Fredoka",
                  fontWeight: 700,
                  fontSize: fs,
                  color: i === words.length - 1 && words.length > 1 ? "#FFE45C" : "#FFFFFF",
                  WebkitTextStroke: `12px ${PLUM}`,
                  paintOrder: "stroke fill",
                  textShadow: `0 8px 0 ${PLUM}`,
                  transform: `translateY(${(1 - wk) * 60 + (wk > 0.99 ? Math.sin(lt * 3 + i) * 3 : 0)}px) scale(${wk})`,
                }}
              >
                {w}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ вопрос зрителю */

/** Ушко с ладошкой «я слушаю!» и волны звука к нему; центр уха в 0,0. */
function ListenEar({ lt }: { lt: number }) {
  return (
    <g>
      {/* звуковые волны летят к уху слева направо */}
      {[0, 1, 2].map((i) => {
        const ph = ((lt * 0.55 + i / 3) % 1 + 1) % 1;
        return <path key={i} d="M0 -26 Q14 0 0 26" transform={`translate(${-96 + ph * 52} 0) scale(${0.7 + ph * 0.5})`} fill="none" stroke="#3D8BFF" strokeWidth={8} strokeLinecap="round" opacity={Math.sin(ph * Math.PI)} />;
      })}
      {/* ушко */}
      <path d="M-22 -48 C10 -66 44 -44 42 -10 C40 14 22 18 18 34 C14 50 -8 58 -22 46" fill="#FFD9BE" stroke="#C98A5A" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M-8 -28 C10 -38 26 -24 22 -8 C20 4 8 6 6 18" fill="none" stroke="#E7A57E" strokeWidth={6} strokeLinecap="round" />
      {/* ладошка «чашечкой» за ухом */}
      <path
        d="M30 -54 C52 -62 72 -46 74 -22 C76 2 70 26 56 44 C48 54 36 52 34 42 L40 18 C44 4 46 -14 40 -28 C36 -38 28 -44 30 -54 Z"
        fill="#FF8A2A"
        stroke={shade("#FF8A2A", 0.35)}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <path d="M50 -40 C60 -30 62 -14 60 2 M60 -34 C70 -22 70 -4 68 10" fill="none" stroke={shade("#FF8A2A", 0.3)} strokeWidth={4} strokeLinecap="round" opacity={0.7} />
      <ellipse cx={-4} cy={-40} rx={10} ry={6} fill="#FFFFFF" opacity={0.5} />
    </g>
  );
}

/**
 * «?» для зрителя (пауза 4-6 с, ребёнок отвечает вслух): жёлтый круг мягко «дышит», спокойные кольца-волны,
 * ушко с ладошкой «я слушаю» и точки «время подумать», которые заполняются за паузу. Без резких вспышек.
 */
function QuestionCard({ o, lt, fps }: { o: OverlayDoc; lt: number; fps: number }) {
  const k = popAt(lt, 0, fps, 11, 140);
  const out = outK(lt, o.dur, 0.45);
  const breathe = 1 + Math.sin(lt * 2.6) * 0.035;
  const earK = popAt(lt, 0.5, fps, 12, 150);
  const n = 4;
  return (
    <svg viewBox="-230 -200 460 470" style={svgAbs(460, 470, { top: 20, right: 34, opacity: out })}>
      {[0, 1].map((i) => {
        const ph = ((lt * 0.45 + i / 2) % 1 + 1) % 1;
        return <circle key={i} r={124 + ph * 80} fill="none" stroke={["#FFB23F", "#3D8BFF"][i]} strokeWidth={10 * (1 - ph) + 2} opacity={Math.sin(ph * Math.PI) * k * 0.7} />;
      })}
      <g transform={`scale(${k * breathe}) rotate(${Math.sin(lt * 1.6) * 5})`}>
        <circle cy={12} r={122} fill={PLUM} />
        <circle r={122} fill="#FFE45C" stroke={PLUM} strokeWidth={12} />
        <ellipse cx={-50} cy={-62} rx={34} ry={20} fill="#FFFFFF" opacity={0.45} transform="rotate(-30 -50 -62)" />
        <text y={66} textAnchor="middle" fontFamily="Fredoka" fontWeight={700} fontSize={200} fill="#FF5A7A" stroke={PLUM} strokeWidth={10} paintOrder="stroke" strokeLinejoin="round">
          ?
        </text>
        <g transform={`translate(96 -96) scale(${0.8 + Math.sin(lt * 2) * 0.2})`}>
          <Sparkle r={26} color="#FFFFFF" rot={lt * 25} />
        </g>
      </g>
      <g transform={`translate(-150 128) scale(${earK * 1.1}) rotate(${Math.sin(lt * 2.2) * 5})`}>
        <circle r={72} fill="#FFFFFF" stroke={PLUM} strokeWidth={8} />
        <ListenEar lt={lt} />
      </g>
      {/* точки «время подумать»: заполняются по очереди за паузу */}
      {Array.from({ length: n }, (_, i) => {
        const on = clamp01((lt - 0.6 - i * ((o.dur - 1.2) / n)) / 0.25);
        return <circle key={i} cx={-30 + i * 44} cy={200} r={12 + on * 4} fill={on > 0.5 ? candy(i * 2) : "#FFFFFF"} stroke={PLUM} strokeWidth={6} opacity={k} />;
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ караоке */

/** Строка песни: слово под мячиком подсвечивается; мячик прыгает по центрам слов в такт. */
function LyricLine({ o, lt, fps }: { o: OverlayDoc; lt: number; fps: number }) {
  const words = o.text.split(/\s+/).filter(Boolean);
  const per = Math.min(o.dur, o.sung ?? o.dur) / Math.max(1, words.length + 0.4); // шарик идёт вместе с голосом, а не по всему слоту
  const k = popAt(lt, 0, fps, 13, 170);
  const out = outK(lt, o.dur, 0.25);
  const fs = o.text.length <= 26 ? 80 : o.text.length <= 40 ? 68 : 56;
  const cur = Math.min(words.length - 1, Math.floor(lt / per));
  const p = clamp01((lt - cur * per) / per);
  const ball = (
    <svg viewBox="-24 -24 48 48" width={44} height={44} style={{ overflow: "visible" }}>
      <circle r={20} fill="#FF5A7A" stroke="#FFFFFF" strokeWidth={5} />
      <circle cx={-6} cy={-7} r={6} fill="#FFFFFF" opacity={0.6} />
    </svg>
  );
  // прыжок: в первой половине — от центра слова cur к его правому краю, во второй — от левого края следующего к центру
  const last = cur === words.length - 1;
  const hop = last ? Math.abs(Math.sin(p * Math.PI * 2)) * 0.5 : Math.sin(p * Math.PI);
  const squash = hop < 0.08 ? 1 - (0.08 - hop) * 3 : 1;
  return (
    <div style={{ position: "absolute", bottom: 46, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: out }}>
      <div
        style={{
          transform: `translateY(${(1 - k) * 80}px)`,
          background: "rgba(58,36,102,0.88)",
          border: "6px solid #FFFFFF",
          borderRadius: 999,
          padding: "26px 40px 10px",
          boxShadow: "0 10px 0 rgba(42,27,51,0.35)",
          display: "flex",
          alignItems: "center",
          whiteSpace: "nowrap",
        }}
      >
        <Note lt={lt} side={-1} />
        {words.map((w, j) => {
          const sung = lt >= j * per;
          const active = j === cur && sung;
          const bk = active ? popAt(lt, j * per, fps, 8, 260) : 0;
          let bx: number | null = null;
          if (!last && j === cur && p < 0.5) bx = 50 + p * 100;
          else if (!last && j === cur + 1 && p >= 0.5) bx = (p - 0.5) * 100;
          else if (last && j === cur) bx = 50;
          return (
            <span key={j} style={{ position: "relative", display: "inline-block", padding: "0 13px" }}>
              {bx !== null && lt >= 0 ? (
                <span style={{ position: "absolute", left: `${bx}%`, top: -46 - hop * 60, transform: `translateX(-50%) scale(${1 / squash}, ${squash})`, transformOrigin: "50% 100%" }}>{ball}</span>
              ) : null}
              <span
                style={{
                  display: "inline-block",
                  fontFamily: "Fredoka",
                  fontWeight: 700,
                  fontSize: fs,
                  lineHeight: 1.05,
                  color: active ? "#FFE45C" : sung ? "#FFD0DC" : "#FFFFFF",
                  WebkitTextStroke: active ? `8px ${PLUM}` : "0px transparent",
                  paintOrder: "stroke fill",
                  transform: `scale(${1 + bk * 0.14}) translateY(${-bk * 6}px)`,
                }}
              >
                {w}
              </span>
            </span>
          );
        })}
        <Note lt={lt} side={1} />
      </div>
    </div>
  );
}
function Note({ lt, side }: { lt: number; side: -1 | 1 }) {
  return (
    <svg viewBox="-30 -36 60 60" width={56} height={56} style={{ overflow: "visible", margin: "0 8px", transform: `translateY(${Math.sin(lt * 6 + side) * 6 - 6}px) rotate(${side * 10 + Math.sin(lt * 4) * 8}deg)` }}>
      <path d="M-6 14 V-20 L18 -26 V8" fill="none" stroke="#FFE45C" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
      <ellipse cx={-12} cy={14} rx={10} ry={8} fill="#FFE45C" />
      <ellipse cx={12} cy={8} rx={10} ry={8} fill="#FFE45C" />
    </svg>
  );
}

/* ------------------------------------------------------------------ сборка */

/** Все надписи сцены на момент lt. `skipTitle` — титр уже нарисован самой сценой (интро/прощание). */
export function Overlays({ overlays, lt, fps, skipTitle = false }: { overlays?: OverlayDoc[]; lt: number; fps: number; skipTitle?: boolean }) {
  const live = (overlays ?? []).filter((o) => lt >= o.t && lt <= o.t + o.dur && !(skipTitle && o.kind === "title"));
  const out: ReactNode[] = live.map((o, i) => {
    const t = lt - o.t;
    if (o.kind === "word") return <WordCard key={i} o={o} lt={t} fps={fps} />;
    if (o.kind === "title") return <TitleCard key={i} o={o} lt={t} fps={fps} />;
    if (o.kind === "question") return <QuestionCard key={i} o={o} lt={t} fps={fps} />;
    return <LyricLine key={i} o={o} lt={t} fps={fps} />;
  });
  return <>{out}</>;
}

/** Цвет говорящего: костюм героя (рассказчик — сливовый). */
export function speakerColor(char: string): string {
  const s = CAST[char];
  if (!s) return "#8E5CFF";
  return s.outfit.kind === "none" ? "#FF5A7A" : s.outfit.color;
}

/**
 * Субтитр: белая «таблетка» с тёмным текстом и рамкой цвета говорящего — читается на любом фоне.
 * Внизу по центру, до двух строк; в песнях не показывается (там караоке).
 */
export function Caption({ lines, lt, fps, hidden }: { lines: CaptionLine[]; lt: number; fps: number; hidden?: boolean }) {
  if (hidden) return null;
  const l = lines.find((x) => lt >= x.start && lt <= x.start + x.dur);
  if (!l) return null;
  const k = popAt(lt, l.start, fps, 14, 200);
  const c = speakerColor(l.char);
  const fs = l.text.length > 90 ? 38 : 44;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 38, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div
        style={{
          transform: `translateY(${(1 - k) * 30}px)`,
          opacity: Math.min(1, k * 2),
          maxWidth: 1460,
          display: "flex",
          alignItems: "center",
          gap: 18,
          background: "rgba(255,255,255,0.95)",
          border: `6px solid ${c}`,
          borderRadius: 40,
          padding: "10px 36px 12px 18px",
          boxShadow: `0 8px 0 ${shade(c, 0.35)}`,
        }}
      >
        <svg viewBox="-20 -20 40 40" width={40} height={40} style={{ flex: "none" }}>
          <circle r={16} fill={c} stroke={shade(c, 0.3)} strokeWidth={4} />
          <circle cx={-5} cy={-5} r={5} fill="#FFFFFF" opacity={0.55} />
        </svg>
        <div style={{ fontFamily: "Nunito", fontWeight: 800, fontSize: fs, lineHeight: 1.2, color: INK, textAlign: "center" }}>{l.text}</div>
      </div>
    </div>
  );
}

/** Маленький значок сериала в левом верхнем углу (брендинг внутри видео: у детских роликов нет водяных знаков и конечных заставок). */
export function SeriesBadge({ t }: { t: number }) {
  const letters = [..."Benny"];
  return (
    <div style={{ position: "absolute", top: 26, left: 28, display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.88)", border: `4px solid ${PLUM}`, borderRadius: 999, padding: "2px 18px 4px 12px", opacity: 0.92, boxShadow: `0 5px 0 rgba(58,36,102,0.35)` }}>
      <svg viewBox="-30 -30 60 56" width={34} height={32} style={{ transform: `scale(${1 + Math.max(0, Math.sin(t * 2)) * 0.06})` }}>
        <path d="M0 22 C-26 4 -32 -10 -24 -19 C-16 -27 -5 -23 0 -13 C5 -23 16 -27 24 -19 C32 -10 26 4 0 22 Z" fill="#FF5A7A" stroke={PLUM} strokeWidth={5} strokeLinejoin="round" />
      </svg>
      <span style={{ fontFamily: "Fredoka", fontWeight: 700, fontSize: 30, lineHeight: 1 }}>
        {letters.map((c, i) => (
          <span key={i} style={{ color: candy(i * 3 + 1) }}>
            {c}
          </span>
        ))}
        <span style={{ color: PLUM }}> &amp; Friends</span>
      </span>
    </div>
  );
}
