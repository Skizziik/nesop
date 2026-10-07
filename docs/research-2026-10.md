# Shorts farm research (verified 2026-10-07)

Everything below was checked on the web on 2026-10-07 (PyPI JSON, Hugging Face, GitHub, npm, Docker Hub and official docs).
Anything I could not confirm is marked **UNVERIFIED**. This is not legal advice. For the monetized channel, treat "commercial use" as required everywhere.

---

## 1. TTS models

### Summary table

| Model | Italian | Code license | Weights license | Commercial OK? | CPU viable | VRAM | Clone / design | Fits RTX 4060 8GB |
|---|---|---|---|---|---|---|---|---|
| Piper (piper-tts 1.8.0) | paola, riccardo, **serena (new)** | GPL-3.0-or-later | repo tagged MIT; the dataset license differs per voice (see below) | serena: yes (CC-BY-4.0, needs attribution). paola and riccardo: risky (see below) | Yes, excellent | n/a (ONNX on CPU) | No / No | Yes (CPU) |
| Kokoro-82M (kokoro 0.9.4) | if_sara, im_nicola (grade C) | Apache-2.0 | Apache-2.0 | Yes | Yes | under 1 GB | No / No | Yes |
| Qwen3-TTS (qwen-tts 0.1.1) | Yes (1 of 10 languages) | Apache-2.0 | Apache-2.0 | Yes | Not documented | 1.7B is about 2B params in bf16; a third party says 8 GB is enough | Clone 3 s: yes. Voice design: yes (1.7B-VoiceDesign) | Yes (0.6B comfortably; 1.7B should fit in bf16) |
| Chatterbox Multilingual V3 (chatterbox-tts 0.1.7) | Yes (`it`) | MIT | MIT | Yes (output has a Perth watermark) | Slow | about 3.5 GB (NVIDIA ACE docs) | Clone: yes / design: no | Yes |
| Fun-CosyVoice3-0.5B-2512 | Yes (1 of 9 languages) | Apache-2.0 | Apache-2.0 | Yes | Slow | small (0.5B) | Clone: yes; instruct for emotion, speed, etc. | Yes |
| MOSS-TTS-Nano-100M | Yes (1 of 20 languages) | Apache-2.0 | Apache-2.0 | Yes | Yes (built for 4-core CPU, ONNX build) | small | Clone: yes | Yes (CPU) |
| Kyutai Pocket TTS (pocket-tts 3.3.0) | Yes (`italian_24l`) | MIT | **CC-BY-4.0**, gated: you must accept terms, and cloning requires consent | Yes, with attribution | Yes (about 6x real-time on an M4 Air) | about 100M params | Clone: yes | Yes (CPU) |
| Voxtral-4B-TTS-2603 (Mistral) | Yes | n/a (vLLM-Omni) | **CC BY-NC 4.0** | **No** (use the Mistral API for commercial work) | No | at least 16 GB in BF16 | 20 preset voices; open cloning unclear | **No** |
| XTTS-v2 (Coqui) | Yes | MPL (coqui-tts) | **CPML, non-commercial** | **No** | Slow | about 4 GB | Clone: yes | Yes, but not usable on a monetized channel |
| Fish Audio S2 Pro | Yes | open | Fish Audio Research License | **No** (paid license needed) | No | about 4B | Clone: yes | No |

### Piper
- PyPI `piper-tts` **1.8.0** (released 2026-09-04), license **GPL-3.0-or-later**, requires Python >=3.9. Wheels are `cp39-abi3` for manylinux x86_64/aarch64, Windows and macOS, so they install on Python 3.12. espeak-ng is **embedded** (no apt package needed). https://pypi.org/project/piper-tts/
- The repo has moved to **https://github.com/OHF-Voice/piper1-gpl** (Open Home Foundation). Voice download helper: `python -m piper.download_voices <voice>`.
- **What GPL means here:** GPL obligations apply when you *distribute* the software, for example by publishing a Docker image that contains piper-tts. Running it locally, or calling it as a separate process, and publishing the generated **audio** does not make your videos or your other code GPL. Keep it in its own container or process and don't link it into proprietary code that you ship.
- Voice weights: the HF repo `rhasspy/piper-voices` is tagged `license: mit` (last modified 2026-09-17), but each voice's MODEL_CARD points to its dataset license:
  - **it_IT-paola-medium**: 22,050 Hz. Dataset `paolapersico1/Voice-Dataset-Italian` is **CC0-1.0**. However, the voice was "Finetuned from U.S. English lessac voice", and the Lessac Blizzard 2013 license is research-only. It explicitly excludes "using the Materials for any commercial purpose, including ... voice synthesis ... products or services" (https://www.cstr.ed.ac.uk/projects/blizzard/2013/lessac_blizzard2013/license.html). **That is a commercial-use risk.**
  - **it_IT-riccardo-x_low**: **16,000 Hz**, trained from scratch on the M-AILABS dataset (LibriVox public-domain audio). The exact M-AILABS license text is **UNVERIFIED** because caito.de was unreachable; it is generally described as free to use for training. Quality is low (x_low).
  - **it_IT-serena-medium / it_IT-serena-high (NEW)**: 22,050 Hz, trained from scratch on `committa/serena-synthetic-it-27h`, which is **CC-BY-4.0**. That is 27 h of synthetic speech generated with Qwen3-TTS-1.7B-Base (Apache-2.0). **This is the cleanest Piper Italian voice for commercial use**: credit the dataset.
- Download URLs (all checked, HTTP 200):
  - https://huggingface.co/rhasspy/piper-voices/resolve/main/it/it_IT/paola/medium/it_IT-paola-medium.onnx (+ `.onnx.json`)
  - https://huggingface.co/rhasspy/piper-voices/resolve/main/it/it_IT/riccardo/x_low/it_IT-riccardo-x_low.onnx (+ `.onnx.json`)
  - serena: `.../it/it_IT/serena/medium/it_IT-serena-medium.onnx` and `.../serena/high/it_IT-serena-high.onnx`. The folders exist; the exact file names follow the same pattern but I did not fetch them individually.

### Kokoro-82M
- HF `hexgrad/Kokoro-82M`, **Apache-2.0** for both weights and code. StyleTTS2 + ISTFTNet architecture, **24 kHz**. https://huggingface.co/hexgrad/Kokoro-82M
- Italian voices: `if_sara` (F) and `im_nicola` (M), both overall grade **C** with 10-100 min of training data, falling back to espeak-ng `it` (VOICES.md). Language code `'i'`.
  - https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/voices/if_sara.pt (HTTP 200)
  - https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/voices/im_nicola.pt (HTTP 200)
- pip `kokoro` **0.9.4** (2025-04-05), `requires_python >=3.10,<3.13`, so **3.12 works but 3.13 does not**. Depends on `misaki[en]>=0.9.4` (misaki 0.9.4, <3.13). There is no Italian misaki extra; Italian G2P goes through **espeak-ng** (`apt-get install espeak-ng`). Needs torch.

### Qwen3-TTS
- Released 2026-01-22. **Apache-2.0** (code and weights). https://github.com/QwenLM/Qwen3-TTS
- HF ids: `Qwen/Qwen3-TTS-Tokenizer-12Hz`, `Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign`, `Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice`, `Qwen/Qwen3-TTS-12Hz-1.7B-Base`, `Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice`, `Qwen/Qwen3-TTS-12Hz-0.6B-Base`.
- Languages: zh, en, ja, ko, de, fr, ru, pt, es, **it**.
- APIs: `generate_custom_voice()` (preset speakers), `generate_voice_design()` (natural-language voice description, 1.7B-VoiceDesign only), `generate_voice_clone()` (3 s reference, Base models), `create_voice_clone_prompt()`.
- pip `qwen-tts` **0.1.1** (2026-02-06). README recommends **Python 3.12**. Pins `transformers==4.57.3` and `accelerate==1.12.0`, plus sox, onnxruntime and librosa (apt `sox` is likely needed). FlashAttention-2 is recommended to cut VRAM but is optional.
- VRAM: the official docs give no number. The 1.7B model is about 2B params in BF16, roughly 4-5 GB of weights. A third-party FAQ says 8 GB is sufficient. **0.6B: comfortable on a 4060; 1.7B: should fit.** CPU inference is not documented, so treat it as GPU-only.
- Output sample rate: the "12Hz" in the name is the token frame rate, not the audio rate. The decoded audio rate is **UNVERIFIED** (I believe 24 kHz); read `sr` from the decode call.

### Chatterbox Multilingual (Resemble AI)
- **MIT**. HF `ResembleAI/Chatterbox-Multilingual-v3` (V2 is still available); class `ChatterboxMultilingualTTS`, `language_id="it"`. 23+ languages. https://github.com/resemble-ai/chatterbox
- pip `chatterbox-tts` **0.1.7** (2026-03-26), Python >=3.10. Pins **torch==2.6.0** and numpy<2 on Python <3.13; they tested on Python 3.11. 3.12 should work with torch 2.6.
- Every output carries the **Perth** imperceptible watermark. 24 kHz (third-party source; read `model.sr`). About 3.5 GB VRAM for multilingual TTS (NVIDIA ACE docs). Zero-shot cloning; no voice design. Chatterbox-Turbo (350M) is **English only**.

### Voxtral TTS (Mistral)
- HF `mistralai/Voxtral-4B-TTS-2603` (March 2026). The weights are **CC BY-NC 4.0** (inherited from its reference-voice datasets), so they are **not usable commercially**; commercial use goes through Mistral's API. 9 languages including Italian, 20 presets, 24 kHz, BF16 at **at least 16 GB VRAM**, served via vLLM-Omni 0.18+. **Does not fit 8 GB.** https://huggingface.co/mistralai/Voxtral-4B-TTS-2603
- One blog claimed an "MIT" Voxtral version; I could not verify this and it is likely wrong.

### MOSS-TTS-Nano (OpenMOSS / MOSI.AI)
- **Apache-2.0**, 100M params, **48 kHz stereo**, built for CPU and real time, with a standalone ONNX CPU build (2026-04-17). Voice cloning comes from a reference clip. 20 languages including Italian. HF `OpenMOSS-Team/MOSS-TTS-Nano` (+ `OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano`; ONNX variants exist). Install with `pip install -e .` from the repo, Python 3.12 recommended; `pynini` can be painful. https://github.com/OpenMOSS/MOSS-TTS-Nano
- Italian quality: the project publishes **no per-language metrics**, so test it yourself.

### Kyutai Pocket TTS
- pip `pocket-tts` **3.3.0** (2026-09-24), Python 3.10-3.14. Code is MIT; weights in `kyutai/pocket-tts` are **CC-BY-4.0** and **gated** (accept terms on HF; cloning without consent is prohibited). 100M params, about 6x real-time on an M4 CPU, ~200 ms to first chunk, cloning supported (`export-voice`). Italian is official; a higher-quality 24-layer variant is available via `--language italian_24l`. Training code was released in Aug 2026. Sample rate is **UNVERIFIED** (likely 24 kHz, Mimi codec). https://github.com/kyutai-labs/pocket-tts

### XTTS-v2
- `coqui/XTTS-v2`, **Coqui Public Model License**, 17 languages including Italian, 24 kHz. The license limits "non-commercial purposes" to uses where "you do not receive any direct or indirect payment arising from the use of the model or its output". **A monetized YouTube channel violates this. Do not use it.** Coqui shut down, so a commercial license cannot be bought. https://huggingface.co/coqui/XTTS-v2/blob/main/LICENSE.txt

### Other 2026-relevant models
- **Fun-CosyVoice3-0.5B-2512** (FunAudioLLM, Dec 2025): Apache-2.0, includes Italian, zero-shot cross-lingual cloning, instruct control for emotion and speed. Good candidate for an 8 GB card. https://huggingface.co/FunAudioLLM/Fun-CosyVoice3-0.5B-2512
- **Fish Audio S2 Pro**: strong and supports Italian, but under the Fish Audio Research License, so commercial use needs a paid license.
- VibeVoice (Microsoft) and Dia2 are en/zh only and not relevant.

**Recommendation for the 4060 8GB:**
- Primary: **Qwen3-TTS 1.7B (VoiceDesign, to create a consistent narrator, then CustomVoice or clone)**, or **Chatterbox Multilingual V3**. Both are permissive and both fit.
- CPU fallback or bulk: **Piper it_IT-serena-high** (clean CC-BY), **Kokoro if_sara/im_nicola**, or **Pocket TTS italian_24l**.
- Avoid on a monetized channel: XTTS-v2, Voxtral open weights and Fish S2. Treat Piper paola as a risk because of the lessac fine-tune.

---

## 2. Word-level aligner

| | faster-whisper `word_timestamps=True` | ctc-forced-aligner |
|---|---|---|
| Version | 1.2.1 (2025-10-31), Python >=3.9, ctranslate2 >=4,<5 | 1.0.2 on PyPI; README says install from git |
| Code license | MIT | BSD-2-Clause |
| Model license | Whisper weights: MIT | **Default `MahmoudAshraf/mms-300m-1130-forced-aligner` is CC-BY-NC-4.0, so it is not commercial.** Swap in an Apache model such as `jonatasgrosman/wav2vec2-large-xlsr-53-italian` (Apache-2.0) |
| Italian | Yes | Yes (MMS covers 1100+ languages; the Italian wav2vec2 model above also works) |
| Method | Transcribes, then gives cross-attention/DTW word times. Words may differ from your script | True forced alignment against **your exact script**. Tighter boundaries and no transcription errors |
| CPU speed | Good with int8 and `small`/`medium`; transcribing a 60 s short on a modern CPU should take seconds to tens of seconds (estimate, not benchmarked) | wav2vec2 CTC forward pass is fast on CPU, usually faster than Whisper (estimate, not benchmarked) |

**Recommendation:** you already know the exact Italian text from your own script, so use **ctc-forced-aligner with a commercially licensed Italian wav2vec2 checkpoint**, not the default MMS one, for karaoke captions. Keep faster-whisper (MIT) as a fallback or QA check, for example comparing Whisper's WER against the script to catch TTS mispronunciations. Avoid `whisper-timestamped`, which is AGPL-3.0.
Sources: https://github.com/MahmoudAshraf97/ctc-forced-aligner, https://pypi.org/project/faster-whisper/, https://huggingface.co/jonatasgrosman/wav2vec2-large-xlsr-53-italian

---

## 3. Remotion
- Current npm `remotion` is **4.0.534**, so the major version is still **v4**. License: "SEE LICENSE IN LICENSE.md".
- **Free license** applies to: an individual; "a for-profit organization with up to 3 employees"; non-profits; and evaluation. Free users may create videos for commercial purposes. Above 3 employees you need a **Company License**:
  - Creators: $25/month per seat.
  - Automators: $0.01 per render with a $100/month minimum (includes 10k renders).
  - Enterprise: from $500/month.
  - https://github.com/remotion-dev/remotion/blob/main/LICENSE.md and https://www.remotion.pro/license
- **Docker** (official https://www.remotion.dev/docs/docker): base `node:22-bookworm-slim`, then:
  ```dockerfile
  RUN apt-get update && apt install -y libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev libasound2 \
      libxrandr2 libxkbcommon-dev libxfixes3 libxcomposite1 libxdamage1 libatk-bridge2.0-0 \
      libpango-1.0-0 libcairo2 libcups2
  RUN npm i
  RUN npx remotion browser ensure   # downloads Chrome Headless Shell at build time
  CMD ["node", "render.mjs"]        # uses @remotion/bundler + @remotion/renderer (selectComposition, renderMedia)
  ```
  - Also add `fonts-noto-color-emoji` or use image emojis, and add fonts (see section 8).
  - `@remotion/player` is for the in-browser preview in your dashboard; it does not render.
  - Rendering happens server-side with `@remotion/renderer` (`bundle()` → `selectComposition()` → `renderMedia()`).
  - All `@remotion/*` package versions must match exactly.

---

## 4. Emoji sets
| | OpenMoji | Twemoji (jdecked/twemoji fork, maintained) |
|---|---|---|
| Graphics license | **CC BY-SA 4.0** | **CC-BY 4.0** |
| Code | n/a | MIT |
| Attribution | Required. For video, put "All emojis designed by OpenMoji – the open-source emoji and icon project. License: CC BY-SA 4.0" in the description and/or credits (OpenMoji FAQ) | Required (README, About page or description is fine) |
| Share-alike | Yes. Modified emojis must be released as CC BY-SA. The FAQ is ambiguous on whether a whole video counts as a derivative (see their issue #462) | No |
| Coverage | Unicode 15-ish plus extras | Unicode/Emoji **17.0** (`@twemoji/api`) |

**Recommendation:** **Twemoji**. It is attribution-only and has no share-alike ambiguity. Add one line, "Emoji graphics: Twemoji, CC-BY 4.0", to every description.
Sources: https://openmoji.org/faq/, https://github.com/jdecked/twemoji

---

## 5. YouTube

### "Inauthentic content" (YPP) – https://support.google.com/youtube/answer/1311392
- On **2025-07-15**, YouTube renamed "repetitious content" to **"inauthentic content"** to make clear that it covers mass-produced content.
- The policy targets content "that looks like it's made with a template, or that may feel repetitive to viewers after watching several videos in a row from the same channel."
- **Not allowed:** "Similar or repetitive content with low educational value, commentary, narratives, or minimal variation".
- **Not allowed:** identical storyline templates across videos, and "image slideshows, templated storylines, or scrolling text with minimal or no narrative".
- **Not allowed:** "AI-generated content made with generic or unoriginal templates" that lacks the creator's own insight or perspective.
- **Allowed:** the "same intro and outro for your videos, but the bulk of your content is different", and series formats (recurring characters, reviews) where "each video has a distinct storyline".
- Enforcement is **channel-level**: monetization can be removed from the whole channel if many videos violate the policy. The separate "reused content" rule requires "significant original commentary, substantive modifications, or educational or entertainment value".
- **Implication for this farm:** vary the format, scene structure, voice and visuals per video. Make sure each short teaches something distinct with real educational value. Avoid a single rigid template that only swaps words.

### Data API
- **Pinning comments is not possible via the API.** The `comments` resource has only list, insert, update, delete and setModerationStatus, and the revision history through 2026-09-30 adds no pin method. (The 2026-09-30 entry added `snippet.imageUrl` for image/GIF comments.) Pinning has to be done manually in Studio. https://developers.google.com/youtube/v3/docs/comments
- **videos.insert quota (changed recently):**
  - 2025-12-04: the upload cost dropped from about 1600 to **about 100 units**.
  - 2026-06-01: YouTube moved to **granular quota buckets**. The Quota Calculator now says the default allocation is "**100 `videos.insert` calls**, 100 `search.list` calls, and 10,000 units per day combined for all other endpoints". videos.insert is "100 quota per day. Each call costs 1 quota."
  - So by default you can upload up to **100 videos per day**, separate from the 10k pool.
  - Other costs: `thumbnails.set` = 50, `commentThreads.insert` = 50.
  - https://developers.google.com/youtube/v3/determine_quota_cost, https://developers.google.com/youtube/v3/revision_history
  - Note: uploads from unverified API projects are locked private until the project passes an audit. This is from long-standing policy and I did not re-verify it today.

---

## 6. LanguageTool and Hunspell
- **meyay/languagetool**: tags `latest` / `6.8` / `6.8-12`, pushed **2026-10-04**. Alpine 3.24 + Temurin 21, amd64 and arm64, about 288 MB. Built from the official LT source tags, because official ZIPs were discontinued after 6.6. Supports fasttext and automatic n-gram download, `JAVA_XMS`/`JAVA_XMX`, MAP_UID/GID, and read-only filesystem mode. Actively patched. https://hub.docker.com/r/meyay/languagetool
- **erikvl87/languagetool**: `latest` = `6.8` (2026-06-15, about 453 MB). Port **8010**. Env `Java_Xms` (default 256m) and `Java_Xmx` (default 512m), plus `langtool_languageModel=/ngrams`. https://hub.docker.com/r/erikvl87/languagetool
- Italian is supported in LanguageTool core. Italian n-grams are **UNVERIFIED** (LT publishes n-grams for only a few languages).
  - RAM: 512 MB-1 GB heap is enough for Italian without n-grams; give it 1-2 GB in production.
  - API: `POST /v2/check` with `language=it-IT`.
  - meyay's port is also 8010 by convention (**UNVERIFIED**; check its README).
- **Hunspell Italian dictionary:** Debian bookworm package **`hunspell-it`** (1:7.5.0-1, from libreoffice-dictionaries; installs `/usr/share/hunspell/it_IT.dic` and `.aff`, path per standard Debian layout).
- **Python 3.12 bindings:**
  - `spylls` 0.1.7 (2022, MPL-2.0): **pure Python**, so it works on 3.12 even though the classifiers stop at 3.9. It is slow but dependency-free. Load it with `Dictionary.from_files('/usr/share/hunspell/it_IT')`.
  - `phunspell` 0.1.6 (MIT): wraps spylls and bundles LibreOffice dictionaries including it_IT.
  - `hunspell` (pyhunspell) 0.5.5 (2018, LGPL): source only. It needs `libhunspell-dev` and a compiler, and building on 3.12 is not guaranteed.
  - `cyhunspell` 2.0.2 (2021): wheels only up to cp38, so it **won't install on 3.12**.
  - **Recommendation:** use spylls. Alternatively, rely on LanguageTool alone, since it already includes Hunspell-based Italian spelling.

---

## 7. Lip-sync
| Model | License | Inference VRAM | Notes |
|---|---|---|---|
| **MuseTalk 1.5** (2025-03-28) | MIT code; weights "available for any purpose, even commercially" | about 4-8 GB (ran on a 4 GB 3050 Ti in fp16, slowly) | 30 fps+ on a V100. Dependencies (whisper, sd-vae-ft-mse, DWPose, S3FD) have their own licenses. **Fits a 4060.** |
| **LatentSync 1.5** | Apache-2.0 | **8 GB** minimum | Borderline fit on a 4060 |
| **LatentSync 1.6** (2025-06-11), `ByteDance/LatentSync-1.6` | Apache-2.0 | **18 GB** | 512×512, sharper. **Does not fit.** |
| MOVA-720p (2026-01-29) | Apache-2.0 (third-party report) | 12-48 GB | Generates video and audio jointly. Does not fit. Claims are self-reported |
| Wav2Lip | Research/non-commercial (from memory, **UNVERIFIED** today) | low | Avoid |

**Recommendation:** MuseTalk 1.5 on the 4060.
Sources: https://github.com/TMElyralab/MuseTalk, https://github.com/bytedance/LatentSync, https://news.creeta.com/en/open-source-lip-sync-models-2026/

---

## 8. Fonts
- Montserrat, Fredoka and Nunito are all **SIL OFL-1.1** and fine for commercial video use.
- npm packages (all OFL-1.1, v5.3.0): `@fontsource/montserrat`, `@fontsource/fredoka`, `@fontsource/nunito`, plus variable builds such as `@fontsource-variable/montserrat`.
- Alternative in Remotion: `@remotion/google-fonts` (`loadFont()`).

---

## 9. Anthropic
- PyPI `anthropic` **1.12.0**, uploaded 2026-10-07 (today), requires Python >=3.10.
- **`claude-sonnet-5-5` exists.** The models overview lists the Claude API ID `claude-sonnet-5-5`:
  - $2 / $10 per MTok, 1M context, 128K max output, adaptive thinking, default effort `high`.
  - Other current models: `claude-opus-5-5`, `claude-fable-5-1` and `claude-haiku-5-5`.
  - https://platform.claude.com/docs/en/about-claude/models/overview (docs.anthropic.com now redirects there)
