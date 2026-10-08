import { interpolate } from "remotion";
import type { DailyWordBody, IdiomBody, RenderProps, TongueTwisterBody } from "../generated";
import { bounce, Card, CONTENT_TOP, CONTENT_W, CONTENT_X, pulse, useT } from "../components/Kit";
import { fitFontSize, upper } from "../lib/text";

// ================================================================ tongue_twister
export const TongueTwister: React.FC<{ props: RenderProps }> = ({ props }) => {
  const b = props.body as unknown as TongueTwisterBody;
  const { theme, timeline } = props;
  const pal = theme.palette;
  const font = theme.font;
  const T = useT(timeline);
  const word = T.active("word");
  const fast = T.active("speak_fast");
  const words = b.text.split(/\s+/).filter(Boolean);
  const fs = Math.max(46, Math.min(78, Math.floor(1500 / Math.sqrt(b.text.length * 6))));
  const shake = fast ? Math.sin(T.t * 60) * 4 : 0;
  return (
    <>
      <div style={{ position: "absolute", left: CONTENT_X, width: CONTENT_W, top: CONTENT_TOP + 20, transform: `translateX(${shake}px)` }}>
        <Card palette={pal} style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "10px 16px", padding: "44px 36px" }} scale={fast ? pulse(T.t, 0.02, 3) : 1}>
          {words.map((w, i) => {
            const on = word?.target === `w:${i}`;
            const since = on && word ? T.t - word.t_start : null;
            return (
              <span
                key={i}
                style={{
                  fontFamily: font,
                  fontWeight: 800,
                  fontSize: fs,
                  padding: "2px 12px",
                  borderRadius: 14,
                  background: on || fast ? pal.title_bg : "transparent",
                  color: pal.right_text,
                  transform: `scale(${on ? bounce(since, T.fps) : 1})`,
                  display: "inline-block",
                }}
              >
                {w}
              </span>
            );
          })}
        </Card>
        {b.translation ? <div style={{ marginTop: 26, textAlign: "center", fontFamily: font, fontWeight: 700, fontSize: 36, color: pal.title_text, opacity: 0.85 }}>{b.translation}</div> : null}
        <div style={{ marginTop: 40, textAlign: "center", fontFamily: font, fontWeight: 800, fontSize: 56, color: "#fff", WebkitTextStroke: `8px ${pal.accent}`, paintOrder: "stroke fill" }}>
          {fast ? "🔥 VELOCE!" : "🐢 piano piano…"}
        </div>
      </div>
    </>
  );
};

// ================================================================ idiom
export const Idiom: React.FC<{ props: RenderProps }> = ({ props }) => {
  const b = props.body as unknown as IdiomBody;
  const { theme, timeline } = props;
  const pal = theme.palette;
  const font = theme.font;
  const T = useT(timeline);
  const on = (k: string) => T.hiTarget === k;
  const dim = (k: string) => (T.hiTarget === null || on(k) ? 1 : 0.55);
  const block = (k: string, label: string, text: string, big = false) => (
    <div style={{ opacity: dim(k), transform: `scale(${on(k) ? bounce(T.hiSince, T.fps) : 1})`, marginTop: 24 }}>
      <Card palette={pal} highlighted={on(k)} style={{ padding: "22px 30px" }}>
        <div style={{ fontFamily: font, fontWeight: 700, fontSize: 30, opacity: 0.7 }}>{label}</div>
        <div style={{ fontFamily: font, fontWeight: 800, fontSize: big ? fitFontSize(text, CONTENT_W - 80, 74, font, 44) : fitFontSize(text, (CONTENT_W - 80) * 1.8, 56, font, 34), lineHeight: 1.2 }}>{text}</div>
      </Card>
    </div>
  );
  return (
    <div style={{ position: "absolute", left: CONTENT_X, width: CONTENT_W, top: CONTENT_TOP - 20 }}>
      {block("card", "🇮🇹", b.idiom, true)}
      {block("literal", "Literally", b.literal)}
      {block("meaning", "Meaning", b.meaning)}
      {b.example ? block("example", "Esempio", b.example) : null}
      {b.question ? (
        <div style={{ marginTop: 30, textAlign: "center", fontFamily: font, fontWeight: 800, fontSize: 52, color: "#fff", WebkitTextStroke: `8px ${pal.accent}`, paintOrder: "stroke fill", transform: `scale(${on("question") ? pulse(T.t) : 1})` }}>
          {b.question} {b.answer ? "???" : ""}
        </div>
      ) : null}
    </div>
  );
};

// ================================================================ daily_word
export const DailyWord: React.FC<{ props: RenderProps }> = ({ props }) => {
  const b = props.body as unknown as DailyWordBody;
  const { theme, timeline } = props;
  const pal = theme.palette;
  const font = theme.font;
  const T = useT(timeline);
  const slow = T.active("speak_slow");
  const exOn = T.hiTarget === "example";
  const word = b.article ? (b.article.endsWith("'") ? `${b.article}${b.word}` : `${b.article} ${b.word}`) : b.word;
  const syl = slow ? interpolate(T.t - slow.t_start, [0, slow.t_end - slow.t_start], [0, 1], { extrapolateRight: "clamp" }) : 1;
  return (
    <div style={{ position: "absolute", left: CONTENT_X, width: CONTENT_W, top: CONTENT_TOP - 20 }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
        <div style={{ fontFamily: font, fontWeight: 800, fontSize: 40, background: pal.accent, color: "#fff", borderRadius: 999, padding: "10px 30px" }}>
          Parola del giorno #{props.episode_no ?? 1}
        </div>
      </div>
      <Card palette={pal} highlighted={T.hiTarget === "card"} scale={T.hiTarget === "card" ? bounce(T.hiSince, T.fps) : 1} style={{ textAlign: "center", padding: "40px 30px" }}>
        <div style={{ fontFamily: font, fontWeight: 800, fontSize: fitFontSize(word, CONTENT_W - 80, 120, font, 60), lineHeight: 1.1 }}>{word}</div>
        <div style={{ fontFamily: font, fontWeight: 700, fontSize: 46, marginTop: 14, letterSpacing: 2 }}>
          {b.syllables.split("-").map((s, i, arr) => (
            <span key={i} style={{ opacity: slow ? (i / arr.length <= syl ? 1 : 0.3) : 0.85, color: s === s.toUpperCase() && /[A-ZÀ-Ù]/.test(s) ? pal.accent : undefined }}>
              {s}
              {i < arr.length - 1 ? "·" : ""}
            </span>
          ))}
        </div>
        <div style={{ marginTop: 18, display: "flex", gap: 14, justifyContent: "center", alignItems: "center", fontFamily: font }}>
          <span style={{ background: pal.left_bg, color: pal.left_text, borderRadius: 999, padding: "6px 20px", fontSize: 30, fontWeight: 700 }}>{b.part_of_speech}</span>
          <span style={{ fontSize: 40, fontWeight: 800 }}>= {b.translation}</span>
        </div>
      </Card>
      <div style={{ marginTop: 34, transform: `scale(${exOn ? bounce(T.hiSince, T.fps) : 1})` }}>
        <Card palette={pal} highlighted={exOn} style={{ padding: "26px 30px" }}>
          <div style={{ fontFamily: font, fontWeight: 800, fontSize: fitFontSize(b.example, (CONTENT_W - 80) * 1.8, 60, font, 38), lineHeight: 1.25 }}>«{b.example}»</div>
          {b.example_translation ? <div style={{ fontFamily: font, fontWeight: 700, fontSize: 32, opacity: 0.75, marginTop: 10 }}>{b.example_translation}</div> : null}
        </Card>
      </div>
      <div style={{ marginTop: 30, textAlign: "center", fontFamily: font, fontWeight: 700, fontSize: 34, color: pal.title_text, opacity: 0.8 }}>{upper("una parola al giorno")} 🇮🇹</div>
    </div>
  );
};
