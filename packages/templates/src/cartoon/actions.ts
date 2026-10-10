/**
 * Действия персонажей → поза на каждый кадр. Все функции детерминированы (t — секунды), без случайности:
 * один и тот же эпизод рендерится одинаково.
 */
import { REST, type Pose } from "./rig";

export type ActionKind = "idle" | "talk" | "walk" | "run" | "wave" | "point" | "jump" | "clap" | "dance" | "think" | "shrug" | "cheer" | "sad" | "scared" | "hug" | "sit" | "bow";

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const ease = (k: number) => (k < 0 ? 0 : k > 1 ? 1 : k * k * (3 - 2 * k));

/** Поза действия; tl — время от начала действия, t — глобальное время (для дыхания и мелочей). */
export function actionPose(kind: ActionKind, tl: number, t: number, dur = 2): Pose {
  const p: Pose = { ...REST, armL: [...REST.armL] as [number, number], armR: [...REST.armR] as [number, number] };
  // мягкое «живое» покачивание рук всегда
  const sway = Math.sin(t * 1.8) * 3;
  p.armL = [REST.armL[0] + sway, REST.armL[1]];
  p.armR = [REST.armR[0] - sway, REST.armR[1]];
  switch (kind) {
    case "talk": {
      // жест одной рукой в ритме речи
      const g = Math.sin(tl * 4.2);
      p.armR = [38 + g * 14, 55 + g * 18];
      p.armL = [16 + Math.sin(tl * 2.1) * 6, 20];
      p.tilt = Math.sin(tl * 1.7) * 4;
      break;
    }
    case "walk":
    case "run": {
      const speed = kind === "run" ? 13 : 8;
      p.walk = tl * speed;
      const s = Math.sin(p.walk);
      p.armL = [10 + s * (kind === "run" ? 40 : 24), kind === "run" ? 60 : 20];
      p.armR = [10 - s * (kind === "run" ? 40 : 24), kind === "run" ? 60 : 20];
      p.bob = -Math.abs(Math.cos(p.walk)) * (kind === "run" ? 9 : 5);
      p.lean = kind === "run" ? 6 : 2;
      break;
    }
    case "wave": {
      const k = ease(tl / 0.3);
      p.armR = [lerp(12, 155, k), lerp(8, 25 + Math.sin(tl * 12) * 28, k)];
      p.tilt = 5 * k;
      break;
    }
    case "point": {
      const k = ease(tl / 0.35);
      p.armR = [lerp(12, 95, k), lerp(8, 4, k)];
      p.lean = 3 * k;
      break;
    }
    case "jump": {
      // прыжки с периодом 0.8 с: присед → полёт → приземление
      const ph = (tl % 0.8) / 0.8;
      const air = ph > 0.15 && ph < 0.85 ? Math.sin(((ph - 0.15) / 0.7) * Math.PI) : 0;
      p.lift = air * 90;
      p.bob = ph < 0.15 ? 8 * Math.sin((ph / 0.15) * Math.PI) : 0;
      p.armL = [lerp(20, 150, air), 15];
      p.armR = [lerp(20, 150, air), 15];
      break;
    }
    case "clap": {
      const c = (Math.sin(tl * 11) + 1) / 2;
      p.armL = [55, lerp(70, 105, c)];
      p.armR = [55, lerp(70, 105, c)];
      p.bob = c * 2;
      break;
    }
    case "dance": {
      const b = Math.sin(tl * 6);
      p.armL = [130 + b * 25, 30 + b * 20];
      p.armR = [130 - b * 25, 30 - b * 20];
      p.lean = b * 7;
      p.tilt = -b * 6;
      p.lift = Math.max(0, Math.sin(tl * 12)) * 10;
      break;
    }
    case "cheer": {
      const k = ease(tl / 0.25);
      p.armL = [lerp(12, 165, k), 10];
      p.armR = [lerp(12, 165, k), 10];
      p.lift = Math.max(0, Math.sin(tl * 9)) * 22 * k;
      break;
    }
    case "think": {
      const k = ease(tl / 0.4);
      p.armR = [lerp(12, 30, k), lerp(8, 150, k)];
      p.armL = [lerp(12, 40, k), lerp(8, 95, k)];
      p.tilt = 8 * k;
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
      p.armL = [6, 4];
      p.armR = [6, 4];
      p.tilt = -8;
      p.bob = 4;
      break;
    }
    case "scared": {
      const sh = Math.sin(tl * 40) * 2;
      p.armL = [60, 120];
      p.armR = [60, 120];
      p.lean = sh;
      p.bob = 3;
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
      p.armL = [20, 40];
      p.armR = [20, 40];
      break;
    }
    case "sit":
      p.bob = 18;
      p.armL = [25, 40];
      p.armR = [25, 40];
      break;
    default:
      break;
  }
  void dur;
  return p;
}
