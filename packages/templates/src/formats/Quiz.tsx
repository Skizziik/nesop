import type { FillBlankBody, QuizAbcBody, RenderProps } from "../generated";
import { Pill } from "../components/Pill";
import { bounce, Card, Confetti, CONTENT_TOP, CONTENT_W, CONTENT_X, CountdownRing, LetterBadge, useT } from "../components/Kit";
import { fitFontSize } from "../lib/text";

const LETTERS = "ABCD";

/** quiz_abc и fill_blank: вопрос/фраза, 3-4 варианта, кольцо-таймер, ответ с конфетти. */
function QuizCore({ props, question, options, correct, reveal, blank }: { props: RenderProps; question: string; options: string[]; correct: number; reveal: boolean; blank?: boolean }) {
  const { theme, timeline } = props;
  const pal = theme.palette;
  const font = theme.font;
  const T = useT(timeline);
  const revealEv = T.active("reveal");
  const revealed = reveal && T.started("reveal");
  const cd = T.active("countdown");
  const qHi = T.hiTarget === "q";

  const parts = blank ? question.split("___") : [question];
  const answerWord = options[correct] ?? "";
  // до двух строк: ширину для подбора берём с запасом под перенос
  const qSize = fitFontSize(question, (CONTENT_W - 100) * (question.length > 24 ? 1.85 : 1), 76, font, 44);

  const optTop = CONTENT_TOP + 330;
  const optH = 118;
  return (
    <>
      <div style={{ position: "absolute", left: CONTENT_X, top: CONTENT_TOP, width: CONTENT_W }}>
        <Card palette={pal} highlighted={false} scale={qHi ? bounce(T.hiSince, T.fps) : 1} style={{ minHeight: 260, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          <div style={{ fontFamily: font, fontWeight: 800, fontSize: qSize, lineHeight: 1.18 }}>
            {blank ? (
              <>
                {parts[0]}
                <span
                  style={{
                    display: "inline-block",
                    minWidth: 150,
                    padding: "0 14px",
                    margin: "0 6px",
                    borderBottom: revealed ? "none" : `8px solid ${pal.accent}`,
                    background: revealed ? pal.highlight_bg : "transparent",
                    color: revealed ? pal.highlight_text : pal.accent,
                    borderRadius: revealed ? 14 : 0,
                  }}
                >
                  {revealed ? answerWord : " "}
                </span>
                {parts[1]}
              </>
            ) : (
              question
            )}
          </div>
        </Card>
      </div>
      {options.map((o, i) => {
        const isHi = T.hiTarget === `opt:${i}`;
        const isRight = revealed && i === correct;
        const dim = revealed && i !== correct;
        const fs = fitFontSize(o, CONTENT_W - 230, 64, font, 34);
        return (
          <div
            key={i}
            style={{ position: "absolute", left: CONTENT_X + 20, top: optTop + i * (optH + 26), display: "flex", alignItems: "center", gap: 24, opacity: dim ? 0.45 : 1 }}
          >
            <LetterBadge letter={LETTERS[i]!} palette={pal} active={isHi || isRight} />
            <Pill
              width={CONTENT_W - 150}
              height={optH * 0.82}
              bg={isRight ? pal.highlight_bg : isHi ? pal.title_bg : pal.right_bg}
              color={isRight ? pal.highlight_text : pal.right_text}
              shape={theme.badge_shape}
              font={font}
              fontSize={fs}
              scale={isHi ? bounce(T.hiSince, T.fps) : isRight ? bounce(revealEv ? T.t - revealEv.t_start : null, T.fps) : 1}
              style={{ justifyContent: "flex-start", paddingLeft: 34 }}
            >
              {o}
            </Pill>
          </div>
        );
      })}
      <div style={{ position: "absolute", left: 0, right: 150, top: optTop + options.length * (optH + 26) + 20, display: "flex", justifyContent: "center" }}>
        <CountdownRing ev={cd} t={T.t} palette={pal} size={200} />
      </div>
      <Confetti since={revealEv ? T.t - revealEv.t_start : null} seed={props.seed} originY={optTop + correct * (optH + 26)} />
    </>
  );
}

export const QuizAbc: React.FC<{ props: RenderProps }> = ({ props }) => {
  const b = props.body as unknown as QuizAbcBody;
  return <QuizCore props={props} question={b.question} options={b.options} correct={b.correct} reveal={b.reveal !== false} />;
};

export const FillBlank: React.FC<{ props: RenderProps }> = ({ props }) => {
  const b = props.body as unknown as FillBlankBody;
  return <QuizCore props={props} question={b.sentence} options={b.options} correct={b.correct} reveal={b.reveal !== false} blank />;
};
