/**
 * Предметы сцены с историей (этап 2): предмет лежит на земле или в руке героя, его передают, бросают, ловят, поднимают и кладут,
 * едят (состояние bitten → eaten). Ключи предмета: где он (at) и в каком состоянии с момента t; anim — как он туда попал.
 * Позиция руки — из скелета (handPositions), поэтому предмет едет вместе с рукой при любом действии.
 */
import { GROUND } from "./scenes";

export type ItemAt = { kind: "ground"; x: number } | { kind: "hand"; char: string };
export interface ItemKey {
  t: number; // сек от начала сцены
  at?: ItemAt;
  state?: string; // "bitten" | "eaten" | "open" | "popped"…
  anim?: "pass" | "throw" | "drop" | "float_away";
}
export interface SceneItem {
  uid: string;
  prop: string;
  color?: string;
  keys: ItemKey[];
}

/** Где кисть героя в мире в момент t (null — героя нет в сцене). */
export type HandOf = (char: string, t: number) => { x: number; y: number; scale: number } | null;

const DUR: Record<NonNullable<ItemKey["anim"]>, number> = { pass: 0.45, throw: 0.75, drop: 0.4, float_away: 3.5 };
const GROUND_SCALE = 1.3;
const ease = (k: number) => (k < 0 ? 0 : k > 1 ? 1 : k * k * (3 - 2 * k));

function place(at: ItemAt, t: number, hand: HandOf): { x: number; y: number; scale: number } | null {
  if (at.kind === "ground") return { x: at.x, y: GROUND + 6, scale: GROUND_SCALE };
  const h = hand(at.char, t);
  return h ? { x: h.x, y: h.y, scale: h.scale * 0.85 } : null;
}

export interface ItemPose {
  x: number;
  y: number;
  scale: number;
  rot: number;
  state?: string;
  holder?: string; // у кого в руке (в полёте — нет)
  flying: boolean;
  opacity: number;
}

/** Состояние предмета в момент t. */
export function itemAt(item: SceneItem, t: number, hand: HandOf): ItemPose | null {
  const keys = [...item.keys].sort((a, b) => a.t - b.t);
  let state: string | undefined;
  let cur: ItemKey | undefined;
  let prevAt: ItemAt | undefined;
  for (const k of keys) {
    if (k.t > t) break;
    if (k.state !== undefined) state = k.state || undefined;
    if (k.at) {
      prevAt = cur?.at ?? prevAt;
      cur = k;
    }
  }
  if (!cur?.at) return null; // ещё не появился
  const target = place(cur.at, t, hand);
  if (!target) return null;
  const holder = cur.at.kind === "hand" ? cur.at.char : undefined;
  const anim = cur.anim;
  if (anim && prevAt && t < cur.t + DUR[anim]) {
    const from = place(prevAt, cur.t, hand) ?? target;
    const k = Math.min(1, Math.max(0, (t - cur.t) / DUR[anim]));
    if (anim === "float_away") {
      return { x: from.x + k * 160 + Math.sin(k * 9) * 20, y: from.y - k * 900, scale: from.scale, rot: Math.sin(k * 6) * 10, state, flying: true, opacity: k > 0.85 ? (1 - k) / 0.15 : 1 };
    }
    const e = anim === "drop" ? k * k : ease(k);
    const arc = anim === "throw" ? Math.sin(k * Math.PI) * 240 : anim === "pass" ? Math.sin(k * Math.PI) * 40 : 0;
    return {
      x: from.x + (target.x - from.x) * e,
      y: from.y + (target.y - from.y) * e - arc,
      scale: from.scale + (target.scale - from.scale) * e,
      rot: anim === "throw" ? k * 540 : 0,
      state,
      flying: true,
      opacity: 1,
    };
  }
  if (anim === "float_away" && t >= cur.t + DUR.float_away) return null; // улетел
  return { ...target, rot: 0, state, holder: anim === "float_away" ? undefined : holder, flying: false, opacity: 1 };
}

/** Кто что держит в момент t (для поз: высокие предметы — поднятой рукой). */
export function heldBy(items: SceneItem[] | undefined, t: number, hand: HandOf): Record<string, string> {
  const out: Record<string, string> = {};
  for (const it of items ?? []) {
    const p = itemAt(it, t, hand);
    if (p?.holder) out[p.holder] = it.prop;
  }
  return out;
}
