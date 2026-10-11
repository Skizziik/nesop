# Research: making automated preschool cartoons (ages 2–5) cute, catchy and YouTube-safe

Prepared 2026-10-11 for the "Benny & Friends" generator (SVG cut-out rig in Remotion, LLM writer, director and verifier, Qwen TTS, procedural music).

**How sure we are.** Evidence quality is marked as **[R]** for peer-reviewed research or an official policy, **[I]** for an industry or practitioner source (studio interviews, trade press), and **[O]** for observation or common practice, which is weaker. Where no hard number exists, a working number is proposed and labelled as a guideline.

**What was checked in our code.** Before writing the recommendations I read the current pipeline (`services/api/app/pipeline/cartoon.py`, `packages/templates/src/cartoon/rig.tsx`, `palette.ts`, `catalog/index.ts`). Several recommendations refer to concrete current values, such as the 2.8 s question pause, the camera re-framing on every line, and song lyrics that are spoken rather than sung.

---

## 0. TL;DR: the numbers to build into the generator

| Parameter | Guideline | Basis |
|---|---|---|
| Average shot length (story scenes) | **5–8 s**, never under 2 s. Hold 8–15 s on question and answer moments. | Lillard and Peterson 2011 compared SpongeBob (a full scene change every 11 s) with Caillou (every 34 s) **[R]**. Mister Rogers held shots for 10–20 s **[I]**. Cocomelon's 1–3 s cutting is widely criticised **[I]**. |
| Location or scene changes | **2 or fewer per minute** | The slow condition in Lillard and Peterson 2011 had a scene change about every 34 s **[R]** |
| Camera moves | At most one re-frame per 2–3 lines, and moves of 0.8–1.2 s with easing. No continuous drift during dialogue. | Bluey stages shots "straight ahead and flat" **[I]**. Hey Duggee avoids overlapping action **[I]**. |
| Viewer-question pause | **4–6 s** of silence, then repeat the question once (for key questions), then a child voice gives the answer. Our current value is 2.8 s. | Pauses in TV shows average 1.79 s. Children often answer after that, and the authors recommend waiting up to 8 s **[R, Disney Research]**. |
| Speech rate | **110–130 words per minute** for narration and dialogue. Flag lines above 145. | Preschoolers are said to process about 120 wpm. Fred Rogers spoke at about 124 wpm, while some cartoons run at 180–190 **[I, audiologists]**. |
| Sentence length | 3–8 words for a 2–3-year-old target, 4–10 words for 4–5 | **[O]** in line with parentese and the speech-therapy style of Ms Rachel |
| Gap between lines | 0.45–0.7 s. Our current value is 0.32 s. | **[O]**, giving time to process |
| Song tempo | **100–125 BPM** for most songs. Dance songs go up to 130; lullabies run at 60–80. | Baby Shark is about 116 BPM **[I]**. One preschool album averages 131 BPM **[I]**. Young children prefer fast tempos with a strong beat **[R, small sample]**. |
| Song length | 1:30–2:30 inside an episode. Each chorus repeats **3 or more times**, and the title hook comes within the first 15 s. | **[O]** from Super Simple Songs, Pinkfong and Cocomelon |
| Melody range | Roughly **D4–A4** (C4–A4 for 3-year-olds), mostly stepwise, in a major key (C, D, F or G) | Children's vocal-range studies **[R, secondary]** |
| Target vocabulary | **1 target word per story** (3–4 per episode), each **spoken 5 or more times** and shown on a picture card | Rice and Woodsmall 1988: children aged 3–5 learned novel words from TV, with about 5 exposures each in a 6–7 minute film **[R]** |
| Impossible events (teleports, puffs, floating) | **No more than 1 per story**. Characters enter and exit by walking. | Lillard et al. 2015: fantastical content, not pacing, depleted 4-year-olds' executive function **[R]** |
| Flashes | **No more than 3 flashes per second** over a large screen area, and no transitions to or from saturated red | Ofcom/ITC guidance and WCAG 2.3.1 **[R]** |
| Loudness | **−14 LUFS** integrated, −1 dBTP true peak. Duck music 10–12 dB under dialogue. | YouTube normalisation (de facto) **[I]** |
| Thumbnail | 1280×720. **0–3 words** in large type. One or two big character faces with a **happy** expression (not distorted) plus **one key object**, high saturation and brightness, readable at about 160 px wide. | A PACIS 2025 study of 38.6k children's videos found saturation, brightness, quality and text increase engagement, and objects beat people **[R]**. Exaggerated faces hurt recommendations **[I]**. |
| Title | `Topic keyword first … \| Series Name \| Nursery Rhymes & Kids Songs`, about 60–70 characters | Cocomelon and Super Simple naming patterns **[I]**. YouTube says to put the important words first **[R]**. |
| Chapters | The first timestamp is 00:00, with at least 3 chapters, each 10 s or longer | YouTube Help **[R]** |
| Long-form | Episodes of 20–25 min, **plus 30–60+ min compilations** | ChuChu TV gets three-quarters of its views from compilations **[I]**. Ms Rachel's videos run 30–60 min **[I]**. |

---

## 1. Visual style of top preschool shows

### 1.1 Show by show (what to borrow)

**Bluey (Ludo Studio, cut-out 2D, the closest match to our pipeline)** [I]
- The characters had to be "geometric and simple" because it is a cut-out action show, with cute, simplified proportions. The environments favour **horizontal and vertical lines over diagonals**, and **rounded rectangles** are the signature shape. [Annecy 2023 recap](https://www.laughingplace.com/w/articles/2023/06/15/annecy-2023-recap-the-story-behind-bluey-with-joe-brumm-richard-jeffery-and-mark-paterson/)
- These rules come from the art director's guide, via the It's Nice That feature [How we built Bluey's world](https://www.itsnicethat.com/features/how-we-built-bluey-s-world-cartoon-background-scenery-art-director-catriona-drummond-animation-090725) and the [Goodsniff art director notes](https://goodsniff.substack.com/p/creating-bluey-tales-from-the-art-891):
  - **No black lineart.** Line colour is derived from the local object colour and its light.
  - **Avoid neutral shadow tones.** Push each shadow warmer or cooler than the object it falls on, with golden light and electric-blue shadows.
  - Colour is a "simplified, slightly more vivid" version of real light.
  - **Backgrounds are very simple** because the audience is preschool. Complex places are flattened into graphic designs.
  - Edges that face the camera stay flat. The two-point perspective reads as one-point and leaves a wide ground plane for acting.
  - Most shots are **staged straight ahead and flat**.
- Episodes run about 7 minutes. Storyboards (500–800 drawings per episode) set the pacing, the animatic is the blueprint, and episodes are test-screened with families. [Bluey storyboards](https://www.bluey.tv/blog/extras-an-introduction-to-bluey-storyboards/)

**Hey Duggee (Studio AKA, Flash)** [I]
- Characters are built from basic geometric shapes "with eyeballs and mouths". The style is minimalist filled shapes with **no outlines**, and gradients are reserved for the main character. [Cartoon Brew interview](https://www.cartoonbrew.com/?p=149069), [Wikipedia](https://en.wikipedia.org/wiki/Hey_Duggee)
- The show **avoids overlapping action** "to keep the show clear and concise for the children watching". This is a key staging rule for us. [License Global interview](https://www.licenseglobal.com/entertainment/designing-duggee-brand-interview-hey-duggee-creator-grant-orchard)

**Peppa Pig** [I/O]
- The look is flat, simple and highly graphic, with pastel tones, characters seen in profile, and a flat green hill and sky as the default background. Episodes are about 5 minutes on a single everyday theme, with a light, low-stakes conflict and a predictable structure. A female narrator frames the story. [Fatherly guide](https://www.fatherly.com/play/what-is-peppa-pig-guide/)

**Cocomelon (Moonbug, 3D)** [I]
- The characters are baby-schema faces (big heads, big eyes, round cheeks) built around family routines (bath, potty, vegetables, school). Saturated colour, near-constant music, and **cuts every 1–3 s with constant pans and zooms**. Pediatric critics call this pacing overstimulating. [Movieguide](https://www.movieguide.org/news-articles/is-cocomelon-as-safe-as-it-seems.html), [Screenwise](https://screenwiseapp.com/guides/comparing-modern-and-classic-kids-shows)
- Moonbug's model is driven by audience data. [TIME summary via getAbstract](https://www.getabstract.com/en/summary/inside-the-making-of-cocomelon-the-childrens-entertainment-juggernaut/45050)
- **Borrow:** the routine topics, baby-schema faces, sing-along structure and title format. **Don't borrow:** the cut rate or the camera that never stops.

**Pinkfong / Baby Shark** [I]
- The song is in G major at about 116 BPM, marked "with a bounce". Its hook is extreme repetition of a single word pattern (doo-doo) plus a hand-motion dance. [MuseScore article](https://musescore.com/news/?p=3137)
- The melody is a traditional camp chant. The Korean Supreme Court (2025) held that a folk-tune adaptation lacking originality is not protected. [IIPLA](https://iipla.org/news/south-korea-s-supreme-court-dismisses-us-composer-s-copyright-claim-over-baby-shark-song)

**Super Simple Songs, Little Baby Bum, Gracie's Corner, Blippi (animated)** [O]
- Super Simple Songs uses short repetitive lyrics, action verbs (clap, stomp, jump), slow clear vocals, gentle tempos and pastel 2D or puppet visuals. Its titles follow the pattern "Song Name | Kids Songs | Super Simple Songs".
- Little Baby Bum is soft, rounded 3D with a nursery-rhyme catalogue and many long compilations.
- Gracie's Corner uses modern genres (hip-hop and R&B) on educational topics, with diverse characters. This shows that genre variety in songs works.
- Blippi is high energy with lots of real-world vocabulary (vehicles, colours).

**Ms Rachel** [I]
- She looks directly at the camera and uses **parentese** (higher pitch, slower, exaggerated), **deliberate pauses** for the child to answer, and heavy repetition of key words. Speech therapists call it "as good as screen time is going to get". Her videos are mostly **30–60 minutes long**, and Netflix picked her up in 2025. [Motherly](https://mother.ly/news/viral-trending/ms-rachel-explains-parentese), [Tubefilter](https://www.tubefilter.com/?p=184310)
- This shows that slow, participatory content can win at scale.

**Sesame Street** [R]
- Its curriculum is set by the "CTW model": producers, content experts and researchers work together. Segments are tested for attention by playing them against a distractor screen and noting when children look away. [APS Observer](https://www.psychologicalscience.org/observer/science-in-educational-media-taking-it-to-the-sesame-street)
- **Our analogue:** an automated "comprehensibility" check by the LLM verifier, plus watching retention curves.

### 1.2 Character proportions (cuteness) [R]

- **Baby schema (Kindchenschema):** a large head, round face, high forehead, **big eyes placed below the midline of the head**, and a small nose and mouth. In Glocker et al. 2009, more baby schema meant higher cuteness ratings and more activity in the brain's reward area (nucleus accumbens). [Glocker et al., UPenn repository](https://repository.upenn.edu/cog_neuro_pubs/11)
- **Disney Research (Designing Animated Characters for Children of Different Ages)** measured existing shows:
  - Characters aimed at younger children have a **larger head-height-to-body-height ratio** (r = −0.72), **larger eye height relative to head height** (r = −0.67) and **rounder eyes**. Eye spacing showed no clear trend.
  - But children did *not* systematically prefer exaggerated versions in choice tasks, and showed a mild bias *against* enlarged heads. So keep the proportions consistent and appealing rather than extreme. [Paper PDF](https://la.disneyresearch.com/wp-content/uploads/Designing-Animated-Characters-for-Children-of-Different-Ages-Paper.pdf)
- **Our rig today:** the kid head radius is 86 (diameter 172) against a body plus legs of 146, so the head is about 54% of total height. That is already very chibi, which is good. Eye radius is 0.18r, so each eye is about 18% of head height.
  - **Suggestion:** raise eye height to **22–28% of head height**, keep the eyes round, put the eye line slightly **below** the head's centre, use a large pupil with **two catch-lights**, and keep blush cheeks.
  - Don't enlarge the head further.

### 1.3 Colour [R/I]

**Saturation and brightness**
- Children broadly prefer vivid, bright colours.
- But a 2023 eye-tracking study of 4–7-year-olds found attraction **increased as saturation decreased and brightness increased, within a range**, then fell off when colours became too washed out. The peak was a "bright, slightly softened" colour, not maximum chroma. Red and purple stayed attractive; yellow attracted less.
- Moderate contrast against the background aided visual comfort. [Chen et al. 2023, Frontiers in Psychology](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2023.1205213/full)
- **Our rule:** characters and key props use high chroma with mid-to-light value. Backgrounds use lighter, less saturated versions, more "Peppa pastel" than neon.

**Hierarchy and line**
- Following Bluey, use coloured lines instead of a single dark `ink` everywhere, and tinted shadows (cool shadow under warm light) instead of grey or black alpha.
- **Keep the character above the background:**
  - a value or chroma gap between the character and the area behind them
  - a limited palette per location (about 5–7 hue families)
  - a complementary accent for the story's key object.

**Safety**
- Avoid large-area flashing above 3 Hz and transitions to or from saturated red. This applies to party lights, lightning and sparkle bursts. [Ofcom/ITC guidance note](https://www.ofcom.org.uk/__data/assets/pdf_file/0021/16248/gn_flash.pdf), [WCAG 2.3.1](https://www.w3.org/WAI/GL/WCAG20/WD-UNDERSTANDING-WCAG20-20071102/seizure-does-not-violate.html)

### 1.4 Camera, framing, shot length, motion

**Pacing evidence [R]**
- Lillard and Peterson 2011 (*Pediatrics*, n = 60 four-year-olds): 9 minutes of SpongeBob (**a full scene change every 11 s**) impaired executive function right afterwards, compared with Caillou (**every 34 s**) or drawing. [NPR/WBEZ](https://www.wbez.org/culture/2011/09/12/spongebob-may-be-too-speedy-for-preschool-brains)
- Lillard et al. 2015 (*Developmental Psychology*, 3 studies, n = 160 + 80) separated the two factors: **fantastical content (physically impossible events), not pacing**, drove the effect. An educational show that was fast and fantastical depleted EF as much as an entertainment show did. [APA/Ovid](https://www.ovid.com/journals/depsy/pdf/10.1037/a0039097~further-examination-of-the-immediate-impact-of-television-on)
- A 2020 replication found that a high frequency of fantastical events led to lower EF, more and shorter eye fixations, and higher prefrontal activation. Fantastical events are defined as "physically impossible events", for example floating up and down. [Frontiers 2020](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2020.583174/full)
- A 2024 systematic review: pacing affects bottom-up attention, though the evidence is mixed, and the negative effect of fantasy on inhibitory control stands out. [BMC Psychology 2024](https://www.biomedcentral.com/articles/10.1186/s40359-024-01738-1)
- A content analysis of infant and toddler DVDs found they mostly use perceptually salient features (rapid pace, many cuts, special effects) that make comprehension *harder*. Female narration was one feature that aids comprehension. [Georgetown repository](https://repository.digital.georgetown.edu/handle/10822/551683)

**Practical rules for our renderer [O, derived from the above]**
- **Story scenes:** average shot length 5–8 s, minimum 3 s. Change shot type on story beats and on a speaker change only after 2 or more lines.
- **Mostly wide and medium shots.** Use close-ups for feelings and for questions to the viewer. In a close-up the character looks into the lens.
- **Prefer a hard cut or a slow ease** (0.8–1.2 s) to the constant 0.55 s pans we do now. In a cut-out style, a static camera with good acting reads best.
- **Songs:** re-frame on 4-bar or 8-bar phrase boundaries. At 110 BPM, 4 bars is about 8.7 s.
- **Movement:** one thing moves at a time (Hey Duggee). Listeners do a subtle idle, look at the speaker and blink. Only the speaker gestures.
- **Fantastical budget:** no more than one impossible event per story. Characters walk in and out instead of "puff" appearances. Magic sparkles are fine as decoration but should not teleport anyone.

---

## 2. Attention and development: what works, what to avoid

### 2.1 How attention works [R]

- **Two complementary models.**
  - Huston and Wright say **perceptually salient features** (sound effects, movement, music changes, unusual voices) capture young children's attention. With age, children shift towards **informative features** such as dialogue and story.
  - Anderson and Lorch say **comprehensibility** drives sustained attention: children look away when they don't understand. [PMC review](https://pmc.ncbi.nlm.nih.gov/articles/PMC2936722)
  - **Design implication:** use a salient cue (a "boing", a slide whistle, a character's gasp) **just before** the key educational moment, then keep that moment simple and clear.
- **Fisch's capacity model:** narrative and educational content compete for limited capacity, unless the **lesson is woven into the plot** (small "distance"). Lowering the story's processing demands leaves more capacity for the lesson. [Capacity theory](https://en.wikipedia.org/wiki/Capacity_theory), [Piotrowski 2014](https://dare.uva.nl/id/516f0ce9-e640-43d5-9a91-9b75a24de13e)
  - **Our rule:** the target word or concept *is* the problem the friends solve, rather than a side note. Keep 3 or fewer named characters active per story.

### 2.2 Repetition and interactivity [R]

- **Blue's Clues** aired the same episode 5 days in a row. Repeated viewing increased comprehension and participation (Crawley and Anderson 1999). Pause lengths were set by formative research, and **child voice-overs supply the answer** so that non-answering children still get it. [Mental Floss](https://www.mentalfloss.com/entertainment/tv/why-blues-clues-repeated-same-episode-five-days), [Wikipedia: Interactive TV narrative technique](https://en.wikipedia.org/wiki/Interactive_television_(narrative_technique))
- **Disney Research, interactive features (Carter, Hyde, Hodgins):** [PDF](https://studios.disneyresearch.com/wp-content/uploads/2019/04/Investigating-the-Effects-of-Interactive-Features-for-Preschool-Television-Programming.pdf)
  - Pauses in typical shows average **1.79 s** (range 0–5.5 s).
  - Waiting for the child's answer roughly **doubled response rates**. 49% of responses began *after* the pause the original show would have allowed.
  - The authors recommend **waiting up to 8 s**.
  - **Repeating** an unanswered question drew a response 82% of the time.
  - Feedback ("That's right!") did not change response rates, but should not be overused.
  - Children learn within the first few prompts whether the show really waits. Consistency therefore matters.
- **Daniel Tiger "strategy songs":**
  - Viewing was linked to higher empathy and emotion recognition, especially with parent co-viewing ([Texas Tech](https://www.depts.ttu.edu/hs/marketing/stories/research/2018/daniel-tiger-study-hdfs.php)).
  - Teens still remembered and used the songs years later. That evidence is self-report and producer-commissioned. [UCLA CSS](https://www.allyourscreens.com/latest-news/u-s/3749-new-ucla-study-reveals-the-lasting-impact-of-pbs-kids-series-daniel-tigers-neighborhood)
  - **Pattern:** a 1–2-line rhyming jingle that encodes the strategy, sung at the moment of need, 2–3 times per episode.
- **Vocabulary from TV:** children aged 3–5 learned novel words from a short narrated programme. Accounts describe about **5 exposures per word** in a 6–7 minute film, and 5-year-olds learned more than 3-year-olds (Rice and Woodsmall 1988). [Review](https://pmc.ncbi.nlm.nih.gov/articles/PMC2759180)
- **Parentese and pauses (Ms Rachel):** slower, higher-pitched, exaggerated speech, pauses for the child, and repetition of key words. [Motherly](https://mother.ly/news/viral-trending/ms-rachel-explains-parentese)

### 2.3 Speech rate [I]

- Children from preschool to third grade are said to process speech accurately at about **120 wpm**. Adults speak at 160–180, Fred Rogers at about **124 wpm**, and some cartoons at 180–190. [Wichita State](https://wichita.edu/about/wsunews/archive/index.php?nid=3349), [Hearing Health Matters](https://hearinghealthmatters.org/hearing-and-kids/2013/can-children-understand-fast-speech/)
- In a captioning study, comprehension was better at 90–120 wpm than at 180 (indirect evidence).
- **Implementation:** after TTS, compute words ÷ clip seconds × 60 for each line. If a line is above 140 wpm, re-synthesise at a lower `speed` or time-stretch it with a WSOLA-type algorithm, which keeps pitch.

### 2.4 Songs [R/I/O]

- **Tempo:**
  - Young children prefer known songs with a fast tempo and strong beat ([Polish and American preschool study](https://scholars.uky.edu/en/publications/polish-and-american-preschool-childrens-preferences-for-and-perce/)).
  - Baby Shark runs at about 116 BPM, and a Cedarmont preschool album averages 131 BPM ([getsongbpm](https://getsongbpm.com/album/preschool-songs/VP7v1)).
  - **Working ranges:** action and dance songs 110–130, story and learning songs 96–115, lullabies and bedtime 60–80. Our code currently defaults to 108 BPM, which is fine for learning songs.
- **Range:** young singers sit at about **D4–A4**. Children aged 3–4 mostly sing C4–A4 spontaneously, and singing games for young children stay within about a fourth to a sixth, mostly in C or D major. [Jyväskylä thesis](https://jyx.jyu.fi/bitstream/123456789/20902/1/urn_nbn_fi_jyu-2009411288.pdf), [Croatian singing-games study](https://ffstopenpress.ffst.hr/en/wp-json/wp/v2/article/3636)
- **Structure [O, from the top channels]:**
  - 4- or 8-bar intro, at most 2 bars before the voice enters.
  - The title phrase *is* the chorus hook.
  - Verse–chorus–verse–chorus–chorus, or a cumulative structure (Old MacDonald, Wheels on the Bus).
  - Each verse swaps one word (animal, colour, body part), which is a natural vocabulary drill.
  - Call and response or echo lines ("I say 'hop', you say 'hop'!").
  - Action verbs with on-screen movement the child can copy.
  - Total length 1:30–2:30.
- **A big gap in our pipeline:** `song()` currently has the narrator **speak** each lyric line at the start of every 2-bar slot, with no melody and no time-stretching. It is a chant, not a song.
  - **Option A (S–M):** treat songs openly as rhythmic chants. Place each syllable on a beat grid by time-stretching each line to fill exactly 1 or 2 bars, and add call-and-response with children's voices. Chant formats like "Going on a Bear Hunt" work well.
  - **Option B (L):** real singing via an open singing-voice-synthesis model (DiffSinger-style, driven by MIDI notes and lyrics). Alternatively, render TTS syllables and pitch-correct them to a generated melody (PSOLA or WORLD vocoder).
  - **Option C:** an instrumental "sing-along" with a bouncing ball highlighting each lyric word, with only the chorus sung or chanted.

### 2.5 Things to avoid

- **Overstimulation:** cuts under 2 s, a camera that never stops, constant SFX, more than 3 flashes per second, and many fantastical or impossible events (see 1.4).
- **Scary or unsafe content:** villains, loud sudden stingers, darkness used as threat, imitable danger (climbing, water or medicine without an adult), unhealthy food messages, bullying or mockery. YouTube's low-quality principles explicitly list "encouraging negative behaviors" such as dangerous pranks and unhealthy eating. Our writer rules already cover most of this.
- **YouTube's low-quality principles for kids content** (affect recommendations, YouTube Kids inclusion and monetisation) [R]: [YouTube Help 10774223](https://support.google.com/youtube/answer/10774223?hl=en), [YouTube blog](https://blog.youtube/news-and-events/our-responsibility-approach-protecting-kids-and-families-youtube/), [TechCrunch 2021](https://techcrunch.com/2021/10/25/youtube-warns-creators-it-will-start-to-demonetize-low-quality-kids-videos-next-month)
  1. **Heavily promotional:** brands, unboxing.
  2. **Encouraging negative behaviours.**
  3. **Deceptively educational:** the title or thumbnail promises learning (colours, numbers) that the video does not deliver, or the information is wrong. **Risk for us:** the LLM says "red" while the rendered prop is orange. The verifier must check named colours against actual prop colours.
  4. **Hard to follow:** jumbled storylines, unclear audio, no clear beginning, middle and end. YouTube says this is "often caused by mass production or autogeneration", which is **the single biggest risk for an automated generator**.
  5. **Sensational or misleading**, including **keyword stuffing** in titles.
  6. **Strange use of children's characters:** never use third-party characters.
  - **Consequences:** a channel that mainly makes low-quality kids content can be suspended from YPP. Individual videos get limited or no ads, are reduced in recommendations, and are excluded from YouTube Kids.
  - **High-quality signals to aim for:** being a good person (kindness, healthy habits), learning and curiosity, creativity and play, life skills and first experiences (dentist, first day at school), and showing the world (diverse places and people).
- **Inauthentic or mass-produced content (YPP update, 15 July 2025):** repetitive, mass-produced videos are ineligible for monetisation. YouTube called it a clarification of an old rule, and coverage linked it to "AI slop". [Plagiarism Today](https://www.plagiarismtoday.com/2025/07/08/youtube-targets-inauthentic-content/)
  - **Mitigation:** genuine story variety (the art-director and variety work already underway), human review before publishing, no near-identical titles or thumbnails, and a capped upload rate.
- **AI disclosure:** "altered or synthetic content" labels are required only for **realistic** content. **Animation is exempt**, and so is AI used for productivity, such as scripts. [YouTube blog](https://blog.youtube/news-and-events/disclosing-ai-generated-content)
- **COPPA and "made for kids" (MFK)** [R]:
  - Every episode must be set as MFK. Labelling content wrongly can lead to FTC penalties of up to **$53,088 per violation (2025 figure)**, and creators can be liable themselves. [FTC 2025 adjustment](https://search.ftc.gov/news-events/news/press-releases/2025/02/ftc-publishes-inflation-adjusted-civil-penalty-amounts-2025), [2019 settlement, Kidscreen](https://kidscreen.com/?p=138889)
  - **Features disabled on MFK videos:** cards, end screens, watermark, comments, live chat, miniplayer, Save to playlist and Watch Later, notifications, memberships, and **personalised ads**. [YouTube Help 9632097](https://support.google.com/youtube/answer/9632097?hl=en)
  - **Consequences for us:**
    - Discovery depends on **search, suggested videos and autoplay**, so titles, long watch time and series consistency matter most.
    - Branding must live **inside the video**: a character bug in the corner and a theme song.
    - RPM is lower because only contextual ads run.
    - Never ask children to comment, subscribe or share personal information.
- **Screen-time context:** the AAP recommends **about 1 hour a day** of high-quality programming for ages 2–5, ideally co-viewed. [AAP summary, GSU](https://sites.gsu.edu/bestpractices/2016/10/26/american-academy-of-pediatrics-announces-new-recommendations-for-childrens-media-use)
  - A calm goodbye routine at the end of each episode ("time to go play!") is good for parents' trust and brand, and fits the high-quality principles.

### 2.6 Pacing presets by age [O]

| | 2–3 years | 4–5 years |
|---|---|---|
| Story length | 3–4 min | 5–7 min |
| Plot | One problem, at most 2 attempts | Rule of three, a small twist |
| Characters active at once | 2–3 | 3–4 |
| Words per sentence | 3–6 | 4–10 |
| Questions to the viewer per story | 3–4 (naming, pointing, animal sounds) | 2–3 (prediction, feelings, counting to 10) |
| New words per story | 1 | 1–2 |

---

## 3. YouTube growth for kids channels

**Thumbnails**
- **Evidence:** a PACIS 2025 study of 38,598 videos from top children's channels found that **high saturation, brightness, image quality and the presence of text** increase engagement, and **thumbnails showing objects beat those showing people**. [AIS eLibrary](https://aisel.aisnet.org/pacis2025/is_education/is_education/9)
- YouTube's own advice: keep it uncluttered (too much detail overwhelms), use readable text, apply the rule of thirds, use the largest resolution, and refresh old thumbnails. [YouTube Help 12340300](https://support.google.com/youtube/answer/12340300?hl=en)
- **Avoid clickbait faces:** a vendor case study describes a kids channel whose recommendations had dropped 91% despite a healthy click-through rate. Removing exaggerated or distorted faces and mismatched thumbnails across the whole catalogue reportedly lifted views 2.8× and watch time 8× (anecdotal). [AIR Media-Tech](https://air.io/en/audience-growth/growing-youtube-kids-channel-4-data-backed-tactics-in-2026)
- **Our template:**
  - 1280×720 with a bright, simple background in a complementary hue.
  - 1–2 characters at large size (head about 35–45% of frame height), smiling, not grimacing.
  - **The story's key object** large and in full colour.
  - 0–3 words in a rounded heavy font with a thick outline, for example "SHARING!" or "Colors".
  - The series logo in a fixed corner.
  - Check legibility at 160×90.
  - Generate 3 variants. YouTube's A/B "Test & compare" uses watch-time share, but MFK eligibility is unconfirmed: a 2024 third-party source says MFK videos are excluded. [YouTube Help 16391400](https://support.google.com/youtube/answer/16391400)

**Titles** [I]
- The patterns are consistent, for example "Bunny Song + More Nursery Rhymes & Kids Songs - CoComelon" and "Put On Your Shoes | Kids Songs | Super Simple Songs".
- **Our formula:** `{Concrete topic or song name} | {Series} | Nursery Rhymes & Kids Songs`, or, for stories, `{Topic} | {Series} Cartoon for Kids | {Learning tag}`.
- Put the most important words first and episode numbers or branding last, use ALL CAPS and emoji sparingly, and **never keyword-stuff** (a low-quality principle).

**Descriptions and chapters** [R]
- Lines 1–2 say what the child learns ("Benny and Mia learn to share and the word 'together'").
- Then chapters: the first is 00:00, with at least 3 chapters of 10 s or more. [YouTube Help 9884579](https://support.google.com/youtube/answer/9884579?hl=en-EN)
- Then song **lyrics**, which help search and let parents sing along.
- Then a short parent note on the learning goals. Tags have low value.

**Length and compilations** [I]
- At ChuChu TV, **8 of the top 10 videos are compilations, and compilations bring three-quarters of views**. A YouTube executive at NATPE 2025 recommended compilations for the connected-TV audience. Kids increasingly watch YouTube on TVs. [ChuChu TV case study](https://www.thinkwithgoogle.com/intl/en-apac/marketing-strategies/video/chuchutv-biggest-youtube-channel-apac), [Gen Alpha data, eMarketer](https://www.emarketer.com/content/youtube-dominates-gen-alpha-programming)
- Ms Rachel's videos run 30–60 min. [Tubefilter](https://www.tubefilter.com/?p=184310)
- **Our plan:** 20–25 min episodes (good) plus a compilation builder for 30–60 min (and 1–3 h) videos with chapters, plus single 2–4 min song videos. Song singles are the building blocks for search ("Colors Song").

**24/7 live streams:** vendors report that streams of themed compilations add a lot of watch time. One channel reportedly got 80% of revenue from 11% of views. This is single-channel data, so test it later. [gyre.pro](https://gyre.pro/blog/how-to-create-successful-kids-music-channel-with-continuous-streams)

**Shorts**
- They work as a discovery and reactivation tool, not a foundation.
- Since 2026, parents (and from April 2026 all users) can set the **Shorts feed limit to zero**. [MediaNama](https://www.medianama.com/2026/04/223-youtube-option-turn-off-shorts-expands-time-controls/)
- **Use:** 20–45 s vertical cuts of song choruses and one funny moment per story, 3–5 per week.

**Cadence and series**
- Practitioners recommend consistency (for example 2–3 uploads a week), a **predictable structure with a consistent intro and outro and recurring segments**, and playlists by theme. [AIR Media-Tech](https://air.io/en/audience-growth/growing-youtube-kids-channel-4-data-backed-tactics-in-2026)
- Candidate playlists: Colours, Feelings, Bedtime, Animals, Songs.

**Localisation**
- Creators who upload multi-language audio see over 25% of watch time from non-primary languages (YouTube, via AIR).
- **Fits the IT+EN content rule:** add an **Italian dub audio track** to the same video.

---

## 4. Free and open assets, licensing, and procedural techniques

### 4.1 Assets (prefer CC0, keep a licence log)

| Source | Licence | Notes |
|---|---|---|
| **Kenney** (kenney.nl), including audio packs (Interface, Impact, Digital, Music Jingles, UI) and "Background Elements Redux" (vector) | **CC0**, credit optional, don't use the Kenney logo | [Kenney support](https://kenney.nl/support), [Background Elements on OpenGameArt](https://opengameart.org/content/background-elements) |
| **OpenGameArt** | Varies per item. Filter to CC0, since collections mix CC-BY and CC-BY-SA. | [CC0 backgrounds collection](https://opengameart.org/content/cc0-backgrounds) |
| **Freesound** | Varies per sound. **Filter to CC0.** CC-BY needs credit. **Avoid CC-BY-NC**: monetised YouTube is commercial use. | [Freesound forum](https://freesound.org/forum/legal-help-and-attribution-questions/35063/) |
| **Sonniss GDC bundles** | Royalty-free, commercial use OK, **no attribution**. You may not redistribute the raw sounds, and **AI training is prohibited**. | [Sonniss licence](https://sonniss.com/gdc-bundle-license/) |
| **Open Peeps / Open Doodles** | CC0 | The style doesn't match ours. Use only for reference. |
| **SVGRepo** | Varies per item (MIT, CC0, CC-BY…) | Check each item |
| **Pixabay music** | Pixabay licence | Some tracks are registered in **Content ID** ("shield" icon), so claims are possible even with legal use. Keep the licence page. |
| **BBC Sound Effects** | RemArc licence: personal, educational and research use only | Not for monetised YouTube (my reading of the terms; not verified in this search) |

**Fonts (Google Fonts, SIL OFL unless noted)**
- **Fredoka**, **Baloo 2**, **Sniglet** and **Grandstander** (OFL, a playful display face) for titles.
- **Nunito** for UI and subtitles. **Chewy** (Apache 2.0) for comic accents.
- **Andika (SIL, OFL)** for **word cards**. It is a literacy font for beginning readers with **single-storey "a" and "g"**, and it clearly separates I, l and 1. [SIL Andika design](https://software.sil.org/andika/design/)
- Use a single-storey "a" on all word cards for early readers, and check that glyph in any other font before using it there.

**Music licensing pitfalls**
- **Composition versus recording:** a public-domain nursery-rhyme *melody and lyrics* is free, but a modern *arrangement or recording* is copyrighted. Content ID can still claim your own recording of a public-domain tune, and you dispute it with documentation. [TunePocket](https://www.tunepocket.com/how-to-resolve-youtube-copyright-claim-for-public-domain-nursery-rhyme-melody/)
- **Our procedural music is ideal.** Keep generation logs and seeds as proof.
- Use only verified public-domain rhymes (pre-1930 publication: Twinkle Twinkle, Old MacDonald, Wheels on the Bus, Row Row Row Your Boat, and so on) in our own arrangements.
- **Don't imitate modern hits** (Cocomelon originals, Pinkfong's Baby Shark arrangement).
- **Don't register public-domain-based songs in Content ID.**

### 4.2 Procedural 2D animation techniques for a cut-out rig [I/O]

- **Squash and stretch:**
  - Scale on one axis with the inverse on the other (`sx = 1/sy`, which preserves volume), anchored at the feet. [SIGGRAPH HyperGraph](https://education.siggraph.org/static/HyperGraph/animation/character_animation/principles/squash_and_stretch.htm)
  - Typical cartoon values:
    - Landing: `sy` 0.85 for 2–3 frames, then a spring back past 1.05.
    - Jump take-off: `sy` 1.12.
    - Happy "bounce" idle: ±2–3%.
  - The amount of deformation should scale with velocity.
- **Anticipation:** 4–8 frames in the opposite direction before a jump, run or throw, for example a crouch of `sy` 0.92.
- **Follow-through and overlap:**
  - Treat ears, tails, bows, hair and held props as **damped springs** that lag the root's motion. A second-order system works: `θ'' = −k(θ − target) − c θ'`, with target = −gain × root velocity.
  - Remotion's `spring({ mass, damping, stiffness })` gives a ready second-order response. Defaults are mass 1, damping 10, stiffness 100. Lower damping (about 8) gives bouncy ears; damping 15–20 gives a gentle settle. [Remotion spring docs](https://www.remotion.dev/docs/spring)
  - In a frame-pure renderer, compute it analytically per frame, or simulate once and cache per actor.
- **Walk cycle (stubby-legged chibi):**
  - Contact, down, passing, up. In Richard Williams' scheme a natural walk has contacts at frames 1, 13 and 25 at 24 fps (12 frames per step). [Monmouth course, after Williams](https://animation.monmouth.edu/instruct/?p=351)
  - Toddler characters should take **shorter, faster steps: about 8–10 frames per step at 24 fps** (0.33–0.42 s), with a vertical bob of about 4–6% of body height, two bobs per cycle (low just after contact, high at passing).
  - Lock the foot during contact so it doesn't slide. The step length must equal travel per step.
  - Counter-rotate the arms, delay the head by 1–2 frames, and swing the ears and tail on springs.
  - For a sad walk, use a smaller bob and slower steps. For a happy skip, use a double bounce.
- **Moving holds:** never freeze a character. Use a breathing scale of ±1% at about 0.25 Hz, with a slight head tilt drift.
- **Blinks:** random intervals of 2–6 s, each blink lasting about 4–6 frames at 30 fps, with an occasional double blink. Characters blink on head turns and on emotion changes.
- **Eyes and attention:** listeners turn their pupils (and head, with a 3–6 frame lag) towards the speaker. A character asking the viewer looks straight into the lens and leans in slightly. Children follow gaze, so gaze points their attention to what matters.
- **Lip sync:** use **Rhubarb Lip Sync** (open source; to my knowledge MIT-licensed, but its LICENSE file was not checked in this search).
  - It produces 6 basic mouth shapes (A–F) plus optional G, H and X (rest), output as TSV, XML or JSON. [GitHub](https://github.com/DanielSWolf/rhubarb-lip-sync)
  - It accepts a **dialog text file** (`-d`) for better accuracy, and we have the exact script.
  - The shapes are A (closed: P/B/M), B (slightly open, teeth: most consonants and "ee"), C (open: eh/ae), D (wide: aa), E (rounded: ao/er), F (pucker: oo/w), G (F/V), H (L) and X (rest).
  - Map these to 6–9 SVG mouth paths per species, holding each shape for at least 2 frames. Our current mouth is driven only by an amplitude envelope (0..1).
- **Staging and clarity:** keep strong silhouettes, give one action the focus at a time, use arcs on all movement, ease in and out, and make holds long enough to read: a reaction pose held 0.5–1 s before speaking.

---

## 5. Prioritised list: the 25 most impactful changes

The effort scale is **S** (under a day), **M** (1–3 days) and **L** (a week or more). The order weighs impact against effort and policy risk.

### Quick wins (S)

**1. Question pauses of 4–6 s, with a reprompt and a child-voice answer. (S)**
- **Why:** shows typically pause less than 2 s. Children often answer later, response rates double when the show waits, and the authors recommend up to 8 s. This is our core Blue's Clues feature, and the current 2.8 s is too short.
- **How:** in `scene()`, when `ask_viewer` is set:
  - Hold silence for `4.5 s` (configurable by age preset).
  - For 1 key question per story, add a reprompt line ("Can you say it? …") and wait 3 s more.
  - The answer beat comes from a **child voice** ("Red!") before the character confirms.
  - **Visual waiting cues:** the asker faces the camera with a cupped ear and a slow lean, the others look at the camera, and the camera holds still.

**2. Camera discipline. (S)**
- **Why:** the camera currently moves 0.55 s on *every* line, so there is constant motion. Evidence favours longer holds, and Bluey stages flat and static.
- **How:**
  - The director keeps the shot unless (a) the speaker changes after 2 or more lines, (b) the story beat changes, or (c) there is an emotion or question close-up.
  - Minimum shot length 3 s, target 5–8 s.
  - Shot changes are hard cuts or 0.9 s eased moves.
  - Songs re-frame every 4 or 8 bars.
  - Add an automated check that computes average shot length per scene and warns if it is under 4 s.

**3. Speech rate and breathing room. (S)**
- **Why:** about 120 wpm suits preschool processing.
- **How:**
  - After TTS, measure wpm per line. If it is above 140, re-synthesise with a lower `speed` (0.85–0.9) or time-stretch with a WSOLA algorithm.
  - Raise the gap between lines from 0.32 s to about 0.5 s, and to 0.8 s after questions or new words.
  - Writer rules: 3–8 words per sentence for the 2–3 preset.

**4. A quality-principles gate in the verifier. (S)**
- **Why:** "hard to follow", "deceptively educational" and keyword stuffing are what get automated kids channels demonetised and pushed out of recommendations.
- **How:** extend `VERIFY_SCHEMA` with:
  - a clear beginning, middle and end
  - one stated lesson that is actually shown
  - the title's promise delivered
  - every named colour, number or shape matching the scene data (a lookup of prop colours versus the text)
  - no brands, no third-party characters
  - a title without stuffing.
- A failure means regeneration.

**5. A vocabulary repetition design. (S)**
- **Why:** about 5 exposures produce word learning, and the lesson should be tightly woven into the plot (Fisch).
- **How:**
  - The writer chooses **1 target word per story** that is central to the problem.
  - It must be said 5 or more times by at least 2 characters, shown once on a word card (picture plus word in Andika with single-storey "a"), and recapped in an end-of-episode "Word Time".
  - The verifier counts occurrences.

**6. Staging: one action at a time, and listeners watch the speaker. (S)**
- **Why:** Hey Duggee's "no overlapping action" rule, and gaze directs children's attention.
- **How:**
  - In the keyframe builder, non-speakers get `idle` with a subtle breathing hold, head and pupils turned towards the speaker with a 4-frame lag.
  - Gestures only for the active speaker.
  - Randomised blinks every 2–6 s from a per-actor seed.

**7. A budget for fantastical events. (S)**
- **Why:** impossible events, not pacing, depleted preschoolers' executive function (Lillard 2015).
- **How:**
  - Writer rule plus verifier: at most 1 impossible event per story.
  - Remove "puff" appearances and disappearances for entrances; characters walk in from the edge of the frame.
  - Keep sparkles, hearts and zzz as emotional decoration only.

**8. Baby-schema tuning of the face. (S)**
- **Why:** bigger, rounder, lower-set eyes read younger and cuter (Glocker; Disney Research).
- **How:**
  - In `rig.tsx`, set `eyeR` to about 0.23–0.26 × r for kids, move the eye line about 5% below the head's centre, enlarge the pupils, and use 2 catch-lights.
  - Keep the head size as is, since children were slightly biased against enlarged heads.
  - Check the result on an `AssetSheet` side by side.

**9. Audio mix standard and an SFX "attention grammar". (S)**
- **Why:** salient features capture young children's attention, comprehensibility holds it, and normalisation punishes over-compressed mixes.
- **How:**
  - Master to −14 LUFS and −1 dBTP.
  - Auto-duck music 10–12 dB under speech.
  - Use a small consistent SFX set (boing, pop, slide whistle, chime) **just before** key moments, at most about 1 every 10 s.
  - No sudden loud stingers. Limit peak-to-average ratio for SFX.

**10. Flash and strobe safety check. (S)**
- **Why:** photosensitivity guidance, and YouTube Kids trust.
- **How:**
  - After rendering, scan luminance per frame (downscaled). Flag more than 3 large-area flashes in any 1 s window and any transition to or from saturated red.
  - Cap the frequency of sparkle, lightning and party-light animations below 3 Hz.

**11. Anti-"inauthentic" safeguards and a licence ledger. (S)**
- **Why:** the July 2025 YPP rule on mass-produced and repetitive content, and Content ID disputes.
- **How:**
  - A required human review and approval step before upload.
  - Checks that titles, thumbnails and stories are not too similar to the last N episodes (embedding similarity).
  - A cap of 2–3 long uploads per week.
  - A `licenses.json` that records the source URL and licence (CC0 only) for every external asset and SFX, plus seeds and logs for procedural music.

**12. Pacing presets by age. (S)**
- **How:** add a project setting `age: "2-3" | "4-5"` that drives:
  - story length, sentence length and characters per story (writer prompt)
  - question type and count
  - pause length (5 s versus 4 s)
  - TTS speed
  - average shot length target.
- Default to 3–5.

### Mid-size (M)

**13. A song template overhaul. (M)**
- **Why:** catchiness comes from a chorus hook, repetition, action verbs and call and response.
- **How:**
  - **Song schema:** a `hook` (the title phrase), a chorus repeated 3–4 times, verses that swap one word, `actions` per line (clap, jump, spin, mapped to rig actions), and `echo` lines.
  - **BPM by mood:** 110–125 for action, 96–112 for learning, 70 for bedtime.
  - Key D, F or G, with melody notes constrained to D4–A4.
  - A word-by-word karaoke highlight (bouncing ball) instead of whole-line overlays.
  - The same theme song and goodbye song in every episode.

**14. Make songs rhythmic: chant aligned to the beat now, real singing later. (M now, L later)**
- **Why:** the current lyrics are spoken at bar starts with no melody, so they won't feel like songs or be catchy.
- **How:**
  - **Step 1 (M):** use Rhubarb or Whisper word timestamps to time-stretch each line so that its stressed syllables land on beats and the line fills exactly 1 or 2 bars. Layer a children's chorus for the echo lines (multiple Qwen kid voices, slightly detuned) and add claps.
  - **Step 2 (L):** an open singing-voice-synthesis model, or pitch-correction of TTS syllables to the generated melody (WORLD vocoder or PSOLA) driven by the same note sequence the music generator uses.

**15. Viseme lip sync with Rhubarb. (M)**
- **Why:** lip sync from mouth shapes looks far more alive than an amplitude-driven open/close.
- **How:**
  - Run `rhubarb -f json -d line.txt line.wav` per voiced line (we have the exact text) and store `mouthCues` alongside `envelope`.
  - Draw 6–9 mouth paths per species (A–H, X) in `rig.tsx`, holding each shape for at least 2 frames.
  - Fall back to the envelope if Rhubarb fails.

**16. Episode rituals and segment bumpers. (M)**
- **Why:** predictability gives comfort and learning (Peppa, Blue's Clues). Branding has to live in the video because MFK disables watermarks and end screens.
- **How:** a fixed skeleton with consistent music and animation that varies only in content:
  - cold open (10–15 s hook)
  - theme song (no more than 30 s)
  - greeting by Benny
  - "Story time!" bumper (5 s)
  - story
  - "Song time!"
  - "Word time!" recap
  - goodbye song with "time to go play!"
- Plus a series bug in the corner.

**17. A colour hierarchy and coloured linework. (M)**
- **Why:** characters should pop against calmer backgrounds. Bluey uses coloured lines and tinted shadows. Children prefer bright, slightly softened colours over maximum chroma.
- **How:**
  - In `palette.ts`, derive the line colour per fill (darken and shift hue towards the shadow colour) instead of a global `INK`, and make shadows tinted overlays.
  - Add `resolvePalette` constraints: background chroma ≤ 0.8 × character chroma, a minimum luminance or ΔE gap between each character's fill and the background sample behind them (checked automatically in `AssetSheet`), and 5–7 hue families per location.

**18. Squash and stretch, anticipation, and spring follow-through. (M)**
- **Why:** these are the core cartoon-appeal principles, and our motion is currently mostly rigid transforms.
- **How:**
  - Volume-preserving `sx = 1/sy` around the feet pivot on jump, land and laugh.
  - Anticipation frames before moves.
  - Ears and tails on second-order springs driven by root velocity (simulated deterministically per actor and cached for frame-pure rendering).
  - A ±1% breathing hold.

**19. A walk cycle rework. (M)**
- **Why:** sliding feet and a flat bob read as cheap.
- **How:**
  - Step period 0.35–0.42 s for kids and about 0.5 s for Mama, with contact, down, passing and up poses.
  - Feet locked on contact, and travel speed derived from step length.
  - Bob of 4–6% of height, arm counter-swing, and the head lagging by 1–2 frames.
  - Mood variants: happy skip, sad trudge, tiptoe.

**20. A strategy jingle per story (Daniel Tiger pattern). (M)**
- **Why:** a sung 1–2-line strategy is memorable and is used in real life ("When I feel mad, I stop and breathe, 1-2-3").
- **How:**
  - A new writer field `jingle` (no more than 14 words, rhyming, in the hook melody).
  - Sung or chanted 2–3 times inside the story at the moment of need, and once in the recap.
  - Reuse the jingle in the Shorts.

**21. A thumbnail generator with rules and 3 variants. (M)**
- **Why:** saturation, brightness and text increase engagement and objects beat people, while distorted faces hurt recommendations.
- **How:**
  - `Thumb.tsx` layouts: 1–2 characters at large size (head 35–45% of frame height) with a happy or curious expression, plus the key prop at large size.
  - A flat bright background in the complement of the main character's colour.
  - 0–3 words in Fredoka or Baloo with a heavy outline, and the series logo in a fixed corner.
  - A legibility check at 160 px.
  - Render 3 variants for manual or A/B choice.

**22. A title, description and chapter template. (S–M)**
- **How:** in the YouTube package builder:
  - **Title:** `{keyword topic} | Benny & Friends | Nursery Rhymes & Kids Songs` (or "Cartoon for Kids"), no more than about 70 characters, with no repeated keywords.
  - **Description:** a 2-line parent value statement, chapters (00:00 plus each story and song, at least 3 chapters, each 10 s or longer), full song lyrics, and the learning goals.
  - **Settings:** MFK set to yes. Never include calls to action that ask children to comment or subscribe.

**23. A compilation builder. (M)**
- **Why:** three-quarters of views at ChuChu come from compilations, connected-TV viewing favours long sessions, and Ms Rachel runs 30–60 min.
- **How:**
  - Assemble 30–60 min (and 1–3 h) videos from approved stories and songs grouped by theme (colours, bedtime, feelings), with auto chapters, a new thumbnail and the bumpers in between.
  - Later, a looping playlist for a 24/7 stream.

**24. An Italian dub audio track. (M)**
- **Why:** multi-language audio often brings over 25% of watch time from secondary languages, and it fits the IT+EN content rule.
- **How:**
  - The LLM translates lines while keeping the timing, Qwen speaks them with Italian character voices, and lines are re-timed to the existing scene durations (time-stretch within ±12%).
  - Songs get Italian lyrics on the same melody.
  - Upload as an additional audio track, with an Italian title and description translation.

**25. A Shorts pipeline. (M)**
- **Why:** cheap discovery and reactivation, but not the foundation (parents can block Shorts).
- **How:**
  - Automatically cut 20–45 s vertical clips (song chorus, the funniest beat, the jingle) by re-rendering the same scene JSON in a 1080×1920 composition with a tighter camera.
  - Large captions inside the safe zone and the series bug.
  - 3–5 per week, set as MFK.

---

## 6. Open risks and notes

- **Untested assumption about singing:** whether Qwen TTS can be pushed into acceptable sung or chanted delivery needs a spike. If it can't, item 14 Step 2 needs a singing-synthesis model, which brings GPU time and licence checks (check the model's licence for commercial use).
- **Weak evidence:** there is no hard average-shot-length data for Bluey or Peppa, so the 5–8 s target is a synthesis from the Lillard data, the Mister Rogers holds and studio interviews. Validate it against our own retention curves.
- **Unconfirmed eligibility:** "Test & compare" for MFK videos is unconfirmed, and so is Shorts monetisation detail for MFK. Check in YouTube Studio when the channel is live.
- **The biggest policy risk is "hard to follow / autogenerated":** keep human review mandatory and track average view duration per segment. A drop at the same segment type is a signal to fix that template.
