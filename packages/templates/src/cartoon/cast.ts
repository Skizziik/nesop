import type { CharacterSpec } from "./rig";

/** Постоянные герои сериала (оригинальные персонажи). Характеры — в «библии сериала» для LLM (services/api). */
export const CAST: Record<string, CharacterSpec> = {
  benny: { id: "benny", name: "Benny", species: "bunny", fur: "#EDE7F2", belly: "#FFC7D6", outfit: { kind: "overalls", color: "#3D8BFF", accent: "#FFD54A" } },
  mia: { id: "mia", name: "Mia", species: "cat", fur: "#FFA449", belly: "#FFE7C7", outfit: { kind: "dress", color: "#FFD23F", accent: "#FFFFFF" }, extra: "bow", eye: "#2E7D32" },
  ollie: { id: "ollie", name: "Ollie", species: "bear", fur: "#A86B3C", belly: "#E9C59A", outfit: { kind: "tshirt", color: "#E8453C", accent: "#FFD54A" } },
  dot: { id: "dot", name: "Dot", species: "dog", fur: "#FFFFFF", belly: "#FFF3E6", outfit: { kind: "none", color: "#FFFFFF" }, extra: "collar" },
  mama: { id: "mama", name: "Mama Bunny", species: "bunny", fur: "#D9CCE6", belly: "#FFC7D6", outfit: { kind: "apron", color: "#7BC96F", accent: "#FFFFFF" }, adult: true },
};

export const CAST_IDS = Object.keys(CAST);
