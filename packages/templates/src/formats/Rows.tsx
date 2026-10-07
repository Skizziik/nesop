import type { ConjugationChallengeBody, EmojiVocabBody, FalseFriendsBody, LevelLadderBody, RenderProps } from "../generated";
import { Pill } from "../components/Pill";
import { bounce, CONTENT_BOTTOM, CONTENT_TOP, CONTENT_W, CONTENT_X, LEVEL_COLORS, pulse, useT } from "../components/Kit";
import { fitFontSize, upper } from "../lib/text";

const rowGeom = (n: number, top = CONTENT_TOP, maxH = 170) => {
  const h = Math.min(maxH, (CONTENT_BOTTOM - top) / n);
  const y0 = top + (CONTENT_BOTTOM - top - h * n) / 2;
  return { h, y: (i: number) => y0 + i * h };
};

// ================================================================ false_friends
export const FalseFriends: React.FC<{ props: RenderProps }> = ({ props }) => {
  const b = props.body as unknown as FalseFriendsBody;
  const { theme, timeline } = props;
  const pal = theme.palette;
  const font = theme.font;
  const T = useT(timeline);
  const n = b.items.length;
  const G = rowGeom(n, CONTENT_TOP, 200);
  return (
    <>
      {b.items.map((it, i) => {
        const hi = T.hiTarget === `row:${i}`;
        const last = i === n - 1;
        const sc = hi ? bounce(T.hiSince, T.fps) : 1;
        const fsTop = fitFontSize(`${it.it} ≠ ${it.looks_like}`, CONTENT_W - 80, G.h * 0.36, font, 30);
        return (
          <div key={i} style={{ position: "absolute", left: CONTENT_X, top: G.y(i), width: CONTENT_W, height: G.h * 0.88, transform: `scale(${sc})` }}>
            <div
              style={{
                height: "100%",
                borderRadius: 28,
                background: hi ? pal.highlight_bg : pal.right_bg,
                color: hi ? pal.highlight_text : pal.right_text,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                fontFamily: font,
                boxShadow: "0 6px 0 rgba(0,0,0,0.18)",
              }}
            >
              <div style={{ fontWeight: 800, fontSize: fsTop }}>
                {upper(it.it)} <span style={{ color: pal.accent }}>≠</span> <span style={{ opacity: 0.7 }}>{it.looks_like}</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: fsTop * 0.62, marginTop: 4 }}>
                = {last ? <span style={{ color: pal.accent, display: "inline-block", transform: `scale(${pulse(T.t)})` }}>???</span> : it.it_means}
                {!last ? <span style={{ opacity: 0.6 }}> · {it.looks_like} = {it.say_instead}</span> : null}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
};

// ================================================================ emoji_vocab
export const EmojiVocab: React.FC<{ props: RenderProps }> = ({ props }) => {
  const b = props.body as unknown as EmojiVocabBody;
  const { theme, timeline } = props;
  const pal = theme.palette;
  const font = theme.font;
  const T = useT(timeline);
  const n = b.items.length;
  const cols = 2;
  const rows = Math.ceil(n / cols);
  const gap = 22;
  const cw = (CONTENT_W - gap) / cols;
  const ch = Math.min(250, (CONTENT_BOTTOM - CONTENT_TOP - gap * (rows - 1)) / rows);
  return (
    <>
      {b.items.map((it, i) => {
        const hi = T.hiTarget === `row:${i}`;
        const last = i === n - 1;
        const r = Math.floor(i / cols);
        const c = i % cols;
        const lastAlone = last && n % cols === 1;
        const x = lastAlone ? CONTENT_X + (CONTENT_W - cw) / 2 : CONTENT_X + c * (cw + gap);
        const label = it.article ? (it.article.endsWith("'") ? `${it.article}${it.word}` : `${it.article} ${it.word}`) : it.word;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: CONTENT_TOP + r * (ch + gap),
              width: cw,
              height: ch,
              borderRadius: 28,
              background: hi ? pal.highlight_bg : pal.right_bg,
              color: hi ? pal.highlight_text : pal.right_text,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 6px 0 rgba(0,0,0,0.18)",
              transform: `scale(${hi ? bounce(T.hiSince, T.fps) : 1})`,
              fontFamily: font,
            }}
          >
            <div style={{ fontSize: ch * 0.42, lineHeight: 1 }}>{it.emoji}</div>
            <div style={{ fontWeight: 800, fontSize: fitFontSize(upper(label), cw - 40, ch * 0.2, font, 26), marginTop: 8, transform: last ? `scale(${pulse(T.t)})` : undefined, color: last ? pal.accent : undefined }}>
              {last ? "???" : upper(label)}
            </div>
          </div>
        );
      })}
    </>
  );
};

// ================================================================ level_ladder
export const LevelLadder: React.FC<{ props: RenderProps }> = ({ props }) => {
  const b = props.body as unknown as LevelLadderBody;
  const { theme, timeline } = props;
  const pal = theme.palette;
  const font = theme.font;
  const T = useT(timeline);
  const top = CONTENT_TOP + 70;
  const G = rowGeom(b.steps.length, top, 175);
  return (
    <>
      {b.concept_translation ? (
        <div style={{ position: "absolute", left: CONTENT_X, width: CONTENT_W, top: CONTENT_TOP - 10, textAlign: "center", fontFamily: font, fontWeight: 700, fontSize: 40, color: pal.title_text, opacity: 0.85 }}>
          «{b.concept}» — {b.concept_translation}
        </div>
      ) : null}
      {b.steps.map((s, i) => {
        const hi = T.hiTarget === `row:${i}`;
        // лестница: каждая ступень чуть правее предыдущей
        const indent = i * 26;
        const w = CONTENT_W - 150 - (b.steps.length - 1) * 26;
        return (
          <div key={i} style={{ position: "absolute", left: CONTENT_X + indent, top: G.y(i), display: "flex", alignItems: "center", gap: 18, transform: `scale(${hi ? bounce(T.hiSince, T.fps) : 1})` }}>
            <div style={{ width: 128, height: G.h * 0.72, borderRadius: 22, background: LEVEL_COLORS[s.level], color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font, fontWeight: 800, fontSize: G.h * 0.34 }}>
              {s.level}
            </div>
            <Pill
              width={w}
              height={G.h * 0.72}
              bg={hi ? pal.highlight_bg : pal.right_bg}
              color={hi ? pal.highlight_text : pal.right_text}
              shape={theme.badge_shape}
              font={font}
              fontSize={fitFontSize(s.text, w - 40, G.h * 0.32, font, 26)}
            >
              {s.text}
            </Pill>
          </div>
        );
      })}
    </>
  );
};

// ================================================================ conjugation_challenge
const PRON = ["io", "tu", "lui/lei", "noi", "voi", "loro"];

export const Conjugation: React.FC<{ props: RenderProps }> = ({ props }) => {
  const b = props.body as unknown as ConjugationChallengeBody;
  const { theme, timeline } = props;
  const pal = theme.palette;
  const font = theme.font;
  const T = useT(timeline);
  const revealed = !!b.reveal && T.started("reveal");
  const top = CONTENT_TOP + 90;
  const G = rowGeom(6, top, 165);
  const lw = 230;
  const rw = CONTENT_W - lw - 30;
  return (
    <>
      <div style={{ position: "absolute", left: CONTENT_X, width: CONTENT_W, top: CONTENT_TOP - 10, textAlign: "center", fontFamily: font, fontWeight: 800, fontSize: 54, color: pal.title_text }}>
        {upper(b.verb)} · <span style={{ fontWeight: 700, opacity: 0.85 }}>{b.tense}</span>
      </div>
      {b.forms.map((f, i) => {
        const hi = T.hiTarget === `row:${i}`;
        const hidden = b.hidden.includes(i) && !revealed;
        const sc = hi ? bounce(T.hiSince, T.fps) : 1;
        return (
          <div key={i} style={{ position: "absolute", left: CONTENT_X + 10, top: G.y(i), display: "flex", gap: 20, alignItems: "center" }}>
            <Pill width={lw} height={G.h * 0.74} bg={pal.left_bg} color={hi ? pal.highlight_left_text : pal.left_text} shape={theme.badge_shape} font={font} fontSize={G.h * 0.32} scale={sc}>
              {upper(PRON[i]!)}
            </Pill>
            <Pill
              width={rw}
              height={G.h * 0.74}
              bg={hi && !hidden ? pal.highlight_bg : hidden ? pal.title_bg : pal.right_bg}
              color={hi && !hidden ? pal.highlight_text : pal.right_text}
              shape={theme.badge_shape}
              font={font}
              fontSize={fitFontSize(upper(f), rw - 40, G.h * 0.36, font, 26)}
              scale={hidden ? pulse(T.t) : sc}
            >
              {hidden ? "???" : upper(f)}
            </Pill>
          </div>
        );
      })}
    </>
  );
};
