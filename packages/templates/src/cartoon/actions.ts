/**
 * Действия персонажей → поза на каждый кадр. Все функции детерминированы (t — секунды), без случайности:
 * один и тот же эпизод рендерится одинаково.
 */
import { REST, type Pose } from "./rig";

export const ACTION_IDS = [
  "idle",
  "talk",
  "walk",
  "run",
  "wave",
  "point",
  "jump",
  "clap",
  "dance",
  "think",
  "shrug",
  "cheer",
  "sad",
  "scared",
  "hug",
  "sit",
  "bow",
  // новые — только в конец (на порядок опираются сохранённые эпизоды и каталог)
  "nod",
  "shake_head",
  "laugh",
  "yawn",
  "stretch",
  "tiptoe",
  "spin",
  "hop",
  "peek",
  "high_five",
  "point_up",
  "cover_eyes",
  "wiggle",
  "give",
  "throw",
  "catch",
  "eat",
  "pick_up",
  "put_down",
] as const;
export type ActionKind = (typeof ACTION_IDS)[number];

/** Действия, в которых герой стоит боком (профиль по facing): ходьба и действия «к партнёру/предмету». */
export const PROFILE_ACTIONS: ReadonlySet<ActionKind> = new Set<ActionKind>(["walk", "run", "tiptoe", "hop", "give", "throw", "high_five", "pick_up", "put_down"]);
/** Время разворота анфас ↔ профиль, с. */
export const TURN_TIME = 0.2;

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const ease = (k: number) => (k < 0 ? 0 : k > 1 ? 1 : k * k * (3 - 2 * k));
const clamp01 = (k: number) => (k < 0 ? 0 : k > 1 ? 1 : k);

/**
 * Поза действия; tl — время от начала действия, t — глобальное время (для дыхания и мелочей).
 * prev — предыдущее действие: после ходьбы герой плавно разворачивается из профиля в анфас.
 */
export function actionPose(kind: ActionKind, tl: number, t: number, dur = 2, prev?: ActionKind): Pose {
  const p: Pose = { ...REST, armL: [...REST.armL] as [number, number], armR: [...REST.armR] as [number, number] };
  // мягкое «живое» покачивание рук всегда
  const sway = Math.sin(t * 1.8) * 3;
  p.armL = [REST.armL[0] + sway, REST.armL[1]];
  p.armR = [REST.armR[0] - sway, REST.armR[1]];
  const turnIn = ease(tl / TURN_TIME);
  switch (kind) {
    case "talk": {
      // жест одной рукой в ритме речи
      const g = Math.sin(tl * 4.2);
      p.armR = [38 + g * 14, 55 + g * 18];
      p.armL = [16 + Math.sin(tl * 2.1) * 6, 20];
      p.tilt = Math.sin(tl * 1.7) * 4;
      p.mirror = true;
      break;
    }
    case "walk":
    case "run":
    case "tiptoe": {
      const run = kind === "run";
      const tip = kind === "tiptoe";
      // шаг ребёнка ≈ 0.39 с (полупериод), бег ≈ 0.24 с, на цыпочках — медленно и мелко
      const speed = run ? 13 : tip ? 6 : 8;
      p.walk = tl * speed;
      p.turn = turnIn;
      p.stride = run ? 1.45 : tip ? 0.5 : 1;
      const c = Math.cos(p.walk);
      // встречный мах: правая рука вперёд, когда вперёд левая нога (фаза 0 — контакт левой)
      const A = run ? 50 : 30;
      if (tip) {
        p.armR = [40 + c * 6, 105];
        p.armL = [36 - c * 6, 105];
        p.lift = 5;
        p.pitch = 0.2;
      } else {
        p.armR = [6 + c * A, (run ? 75 : 18) + Math.max(0, c) * 22];
        p.armL = [6 - c * A, (run ? 75 : 18) + Math.max(0, -c) * 22];
      }
      // ниже всего — на контакте, выше всего — в середине опоры
      const contact = Math.abs(c);
      p.bob = contact * (run ? 12 : tip ? 3 : 8) - (run ? 4 : 2);
      p.squash = (0.5 - contact) * (run ? 0.06 : 0.025);
      p.lean = run ? 8 : tip ? 4 : 3;
      // голова чуть запаздывает за телом, уши пружинят
      p.tilt = Math.sin(2 * p.walk - 0.8) * (run ? 2 : 2.5);
      p.follow = Math.cos(2 * p.walk - 1.2) * (run ? 0.8 : 0.45);
      break;
    }
    case "wave": {
      const k = ease(tl / 0.3);
      p.armR = [lerp(12, 130, k), lerp(8, 20 + Math.sin(tl * 12) * 30, k)];
      p.tilt = 5 * k;
      p.mirror = true;
      break;
    }
    case "point": {
      const k = ease(tl / 0.35);
      p.armR = [lerp(12, 95, k), lerp(8, 4, k)];
      p.lean = 3 * k;
      p.mirror = true;
      break;
    }
    case "jump": {
      // прыжки с периодом 0.8 с: присед (предвосхищение) → вытянутый полёт → сплющенное приземление
      const ph = (tl % 0.8) / 0.8;
      const airK = ph > 0.15 && ph < 0.85 ? (ph - 0.15) / 0.7 : -1;
      const air = airK >= 0 ? Math.sin(airK * Math.PI) : 0;
      p.lift = air * 90;
      // на земле: приземление (0.85..1) и присед перед следующим прыжком (0..0.15) — одна «пружина»
      const g = ph >= 0.85 ? ph - 0.85 : ph < 0.15 ? (tl < 0.8 ? ph * 2 : ph + 0.15) : -1;
      const sq = g >= 0 ? Math.sin((g / 0.3) * Math.PI) : 0;
      p.bob = 10 * sq;
      p.squash = g >= 0 ? -0.12 * sq : 0.07 * Math.abs(Math.cos(airK * Math.PI));
      p.follow = airK >= 0 ? -Math.cos(airK * Math.PI) * 0.9 : 0.6 * sq;
      p.armL = [lerp(20, 140, air), 10];
      p.armR = [lerp(20, 140, air), 10];
      break;
    }
    case "clap": {
      // ладошки встречаются перед грудью
      const c = (Math.sin(tl * 11) + 1) / 2;
      p.armL = [40, 100];
      p.armR = [40, 100];
      p.reach = { L: { at: "chest", dx: 0.03 + c * 0.32, dy: -0.05 }, R: { at: "chest", dx: 0.03 + c * 0.32, dy: -0.05 }, k: ease(tl / 0.15) };
      p.bob = (1 - c) * 2;
      break;
    }
    case "dance": {
      const b = Math.sin(tl * 6);
      p.armL = [115 + b * 22, 30 + b * 20];
      p.armR = [115 - b * 22, 30 - b * 20];
      p.lean = b * 7;
      p.tilt = -b * 6;
      p.lift = Math.max(0, Math.sin(tl * 12)) * 10;
      p.follow = Math.cos(tl * 12) * 0.5;
      break;
    }
    case "cheer": {
      const k = ease(tl / 0.25);
      p.armL = [lerp(12, 142, k), 8];
      p.armR = [lerp(12, 142, k), 8];
      const h = Math.max(0, Math.sin(tl * 9));
      p.lift = h * 22 * k;
      p.squash = (h - 0.4) * 0.05 * k;
      p.follow = Math.cos(tl * 9) * 0.6 * k;
      break;
    }
    case "think": {
      const k = ease(tl / 0.4);
      p.armR = [lerp(12, 30, k), lerp(8, 150, k)];
      p.armL = [lerp(12, 30, k), lerp(8, 90, k)];
      p.reach = { R: { at: "chin" }, L: { at: "tummy", dx: -0.25, dy: -0.05 }, k };
      p.tilt = 8 * k;
      p.mirror = true;
      break;
    }
    case "shrug": {
      const k = Math.sin(Math.min(1, tl / 0.6) * Math.PI);
      p.armL = [55, 95 - 30 * k];
      p.armR = [55, 95 - 30 * k];
      p.bob = -6 * k;
      p.tilt = 7 * k;
      break;
    }
    case "sad": {
      p.armL = [8, 30];
      p.armR = [8, 30];
      p.reach = { L: { at: "tummy", dx: -0.15, dy: 0.32 }, R: { at: "tummy", dx: -0.15, dy: 0.32 }, k: ease(tl / 0.5) };
      p.tilt = -8;
      p.pitch = 0.35;
      p.bob = 4;
      p.follow = -0.3;
      break;
    }
    case "scared": {
      const sh = Math.sin(tl * 40) * 2;
      p.armL = [60, 120];
      p.armR = [60, 120];
      p.reach = { L: { at: "mouth", dx: 0.12 }, R: { at: "mouth", dx: 0.12 }, k: ease(tl / 0.2) };
      p.lean = sh * 0.5;
      p.bob = 3;
      p.squash = -0.03;
      p.follow = -0.6;
      break;
    }
    case "hug": {
      p.armL = [80, 70];
      p.armR = [80, 70];
      p.lean = 4;
      break;
    }
    case "bow": {
      const k = Math.sin(Math.min(1, tl / 1.2) * Math.PI);
      p.lean = 20 * k;
      p.pitch = 0.6 * k;
      p.armL = [20, 40];
      p.armR = [20, 40];
      break;
    }
    case "sit":
      p.bob = 18;
      p.armL = [25, 40];
      p.armR = [25, 40];
      break;
    case "nod": {
      const env = tl < 1.8 ? 1 : 0.35;
      const n = Math.max(0, Math.sin(tl * 7));
      p.pitch = n * 0.9 * env;
      p.bob = n * 2 * env;
      break;
    }
    case "shake_head": {
      const env = tl < 1.6 ? 1 : 0.35;
      p.yaw = Math.sin(tl * 9) * 0.55 * env;
      p.tilt = Math.sin(tl * 9 + 0.6) * 2 * env;
      p.follow = Math.sin(tl * 9 - 0.8) * 0.3 * env;
      break;
    }
    case "laugh": {
      // трясётся от смеха, держится за животик
      const sh = Math.sin(tl * 15);
      p.armL = [28, 100];
      p.armR = [28, 100];
      p.reach = { L: { at: "tummy", dx: 0.05, dy: sh * 0.03 }, R: { at: "tummy", dx: 0.05, dy: -sh * 0.03 }, k: ease(tl / 0.25) };
      p.bob = 3 + sh * 3;
      p.squash = sh * 0.025;
      p.tilt = -5 + Math.sin(tl * 3) * 3;
      p.pitch = -0.25;
      p.lean = Math.sin(tl * 2.5) * 3;
      p.mouth = 0.55 + Math.abs(sh) * 0.3;
      p.follow = sh * 0.5;
      break;
    }
    case "yawn": {
      const ph = tl % 2.8;
      const k = Math.sin(clamp01(ph / 1.8) * Math.PI);
      p.armL = [lerp(12, 140, k), lerp(8, 12, k)];
      p.armR = [lerp(12, 140, k), lerp(8, 12, k)];
      p.mouth = k * 0.95;
      p.shut = k > 0.35;
      p.pitch = -0.4 * k;
      p.squash = 0.04 * k;
      p.follow = -0.3 * k;
      break;
    }
    case "stretch": {
      const ph = tl % 2.4;
      const k = ph < 0.5 ? ease(ph / 0.5) : ph < 1.6 ? 1 : 1 - ease((ph - 1.6) / 0.6);
      p.armL = [lerp(12, 146, k), lerp(8, 0, k)];
      p.armR = [lerp(12, 146, k), lerp(8, 0, k)];
      p.squash = 0.07 * k;
      p.lift = 6 * k;
      p.pitch = -0.3 * k;
      p.shut = k > 0.6;
      p.mouth = k > 0.6 ? 0.25 : 0;
      p.lean = Math.sin(tl * 2) * 3 * k;
      break;
    }
    case "spin": {
      // оборот за 0.9 с: анфас → профиль → спина → профиль в другую сторону
      const ph = (tl / 0.9) * Math.PI * 2;
      const s = Math.sin(ph);
      const c = Math.cos(ph);
      p.turn = Math.abs(s);
      p.face = s >= 0 ? 1 : -1;
      p.back = ease((-c - 0.2) / 0.5);
      p.armL = [75, 20];
      p.armR = [75, 20];
      p.lift = Math.abs(Math.sin(ph)) * 8;
      p.follow = 0.7;
      break;
    }
    case "hop": {
      // заячьи прыжки двумя лапками: присед → полёт → приземление, период 0.55 с
      const ph = (tl % 0.55) / 0.55;
      const g = ph < 0.25 ? Math.sin((ph / 0.25) * Math.PI) : 0;
      const ak = ph >= 0.25 ? (ph - 0.25) / 0.75 : -1;
      const air = ak >= 0 ? Math.sin(ak * Math.PI) : 0;
      p.turn = turnIn;
      p.lift = air * 45;
      p.bob = g * 7;
      p.squash = ak >= 0 ? 0.06 * Math.abs(Math.cos(ak * Math.PI)) : -0.1 * g;
      p.follow = ak >= 0 ? -Math.cos(ak * Math.PI) * 0.8 : 0.5 * g;
      p.armL = [lerp(-25, 30, air), 30];
      p.armR = [lerp(-25, 30, air), 30];
      p.lean = 4;
      break;
    }
    case "peek": {
      // выглядывает вдаль, ладошка козырьком
      const k = ease(tl / 0.35);
      p.armR = [lerp(12, 150, k), lerp(8, 60, k)];
      p.reach = { R: { at: "eyes", dx: 0.32, dy: -0.3 }, k };
      p.lean = 12 * k + Math.sin(tl * 2) * 2 * k;
      p.yaw = 0.3 * k;
      p.mirror = true;
      break;
    }
    case "high_five": {
      const k = ease(tl / 0.3);
      const slap = tl > 0.35 && tl < 0.6 ? Math.sin(((tl - 0.35) / 0.25) * Math.PI) : 0;
      p.turn = turnIn;
      // ладошка вперёд-вверх перед мордочкой партнёра (короткие ручки не достают выше головы)
      p.armR = [lerp(12, 95, k) + slap * 10, lerp(8, 40, k)];
      p.armL = [10, 20];
      p.lean = 4 * k + slap * 4;
      p.squash = slap * 0.03;
      p.follow = slap * 0.6;
      break;
    }
    case "point_up": {
      const k = ease(tl / 0.3);
      p.armR = [lerp(12, 150 + Math.sin(tl * 6) * 3, k), lerp(8, 2, k)];
      p.armL = [20, 40];
      p.pitch = -0.35 * k;
      p.bob = -Math.max(0, Math.sin(tl * 6)) * 2 * k;
      p.mirror = true;
      break;
    }
    case "cover_eyes": {
      // ку-ку: закрыл глазки ладошками → «ку-ку!» руки в стороны, период 1.6 с
      const ph = tl % 1.6;
      const k = ph < 0.15 ? ease(ph / 0.15) : ph < 0.9 ? 1 : ph < 1.05 ? 1 - ease((ph - 0.9) / 0.15) : 0;
      const boo = ph >= 0.9 ? Math.sin(clamp01((ph - 0.9) / 0.7) * Math.PI) : 0;
      p.armL = [lerp(30, 95, boo), lerp(60, 40, boo)];
      p.armR = [lerp(30, 95, boo), lerp(60, 40, boo)];
      p.reach = { L: { at: "eyes" }, R: { at: "eyes" }, k };
      p.pitch = 0.3 * k;
      p.mouth = boo * 0.6;
      p.lift = boo * 10;
      p.squash = boo * 0.03 - k * 0.02;
      p.follow = boo * 0.7;
      break;
    }
    case "wiggle": {
      const w = Math.sin(tl * 9);
      p.lean = w * 7;
      p.tilt = -w * 5;
      p.squash = Math.abs(w) * 0.03;
      p.bob = Math.abs(w) * 3;
      p.armL = [60 + w * 15, 50];
      p.armR = [60 - w * 15, 50];
      p.follow = w;
      break;
    }
    case "give": {
      // протягивает предмет вперёд (в профиль к партнёру) и держит
      const k = ease(tl / 0.5);
      p.turn = turnIn;
      p.armR = [lerp(12, 82, k), lerp(8, 10, k)];
      p.armL = [10, 20];
      p.lean = 5 * k;
      p.pitch = 0.1 * k;
      break;
    }
    case "throw": {
      // замах назад → бросок вверх-вперёд (0.45 с) → доводка корпусом
      p.turn = ease(tl / 0.15);
      if (tl < 0.25) {
        const k = ease(tl / 0.25);
        p.armR = [lerp(12, -70, k), lerp(8, 60, k)];
        p.armL = [lerp(10, 45, k), 20];
        p.lean = -4 * k;
        p.squash = -0.04 * k;
      } else if (tl < 0.45) {
        const k = ease((tl - 0.25) / 0.2);
        p.armR = [lerp(-70, 160, k), lerp(60, 0, k)];
        p.armL = [lerp(45, -10, k), 20];
        p.lean = lerp(-4, 10, k);
        p.squash = lerp(-0.04, 0.05, k);
        p.follow = k;
      } else {
        const k = ease((tl - 0.45) / 0.5);
        p.armR = [lerp(160, 110, k), lerp(0, 15, k)];
        p.armL = [lerp(-10, 10, k), 20];
        p.lean = lerp(10, 4, k);
        p.squash = lerp(0.05, 0, k);
        p.follow = 1 - k;
      }
      break;
    }
    case "catch": {
      // руки вверх-вперёд, маленький отскок назад
      const k = ease(tl / 0.25);
      const hop = tl < 0.45 ? Math.sin((tl / 0.45) * Math.PI) : 0;
      const land = tl >= 0.45 && tl < 0.65 ? Math.sin(((tl - 0.45) / 0.2) * Math.PI) : 0;
      p.armL = [lerp(12, 135, k), lerp(8, 35, k)];
      p.armR = [lerp(12, 135, k), lerp(8, 35, k)];
      p.lift = hop * 16;
      p.lean = -6 * hop;
      p.squash = 0.04 * hop - 0.08 * land;
      p.bob = 6 * land;
      p.follow = -hop * 0.6 + land * 0.6;
      break;
    }
    case "eat": {
      // ладошка ко рту, кусает ~2.5 раза в секунду, щёки надуты
      const k = ease(tl / 0.3);
      const bite = Math.sin(tl * Math.PI * 2 * 2.5);
      p.armR = [30, 120];
      p.armL = [15, 30];
      p.reach = { R: { at: "mouth", dx: 0.05, dy: 0.06 + Math.max(0, bite) * 0.1 }, k };
      p.mouth = k * (0.1 + Math.max(0, -bite) * 0.4);
      p.puff = k * (0.55 + Math.max(0, bite) * 0.45);
      p.pitch = 0.1 * k;
      p.mirror = true;
      break;
    }
    case "pick_up":
    case "put_down": {
      // присел, наклонился, правая рука к земле (0.3 с) и обратно (0.3 с)
      const d = tl < 0.3 ? ease(tl / 0.3) : tl < 0.6 ? 1 - ease((tl - 0.3) / 0.3) : 0;
      p.turn = ease(tl / 0.15);
      const holdK = kind === "pick_up" ? ease((tl - 0.3) / 0.3) : 1 - ease(tl / 0.3);
      p.armR = [lerp(12, 35, holdK), lerp(8, 45, holdK)];
      p.armL = [lerp(12, -20, d), lerp(8, 30, d)];
      p.reach = { R: { at: "ground" }, k: d };
      p.bob = 22 * d;
      p.lean = 16 * d;
      p.pitch = 0.45 * d;
      p.squash = -0.04 * d;
      p.follow = d * 0.4;
      break;
    }
    default:
      break;
  }
  // после действия «боком» — плавный разворот обратно в анфас
  if (prev && PROFILE_ACTIONS.has(prev) && !PROFILE_ACTIONS.has(kind) && kind !== "spin") p.turn = Math.max(p.turn ?? 0, 1 - turnIn);
  void dur;
  return p;
}
