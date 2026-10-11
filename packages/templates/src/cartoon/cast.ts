import type { CharacterSpec } from "./rig";

/** Постоянные герои сериала (оригинальные персонажи). Характеры — в «библии сериала» для LLM (services/api). */
export const CAST: Record<string, CharacterSpec> = {
  benny: { id: "benny", name: "Benny", species: "bunny", fur: "#EDE7F2", belly: "#FFC7D6", outfit: { kind: "overalls", color: "#3D8BFF", accent: "#FFD54A" } },
  mia: { id: "mia", name: "Mia", species: "cat", fur: "#FFA449", belly: "#FFE7C7", outfit: { kind: "dress", color: "#FFD23F", accent: "#FFFFFF" }, extra: "bow", eye: "#2E7D32" },
  ollie: { id: "ollie", name: "Ollie", species: "bear", fur: "#A86B3C", belly: "#E9C59A", outfit: { kind: "tshirt", color: "#E8453C", accent: "#FFD54A" } },
  dot: { id: "dot", name: "Dot", species: "dog", fur: "#FFFFFF", belly: "#FFF3E6", outfit: { kind: "none", color: "#FFFFFF" }, extra: "collar" },
  mama: { id: "mama", name: "Mama Bunny", species: "bunny", fur: "#D9CCE6", belly: "#FFC7D6", outfit: { kind: "apron", color: "#7BC96F", accent: "#FFFFFF" }, adult: true },
  // постоянные гости — соседи и друзья по детскому саду (catalog: guest: true), и папа Бенни
  finn: { id: "finn", name: "Finn", species: "fox", fur: "#F47A35", belly: "#FFF7EE", fur2: "#6E3B2A", outfit: { kind: "hoodie", color: "#4CB944", accent: "#FFFFFF" }, eye: "#7A4A1E" },
  molly: { id: "molly", name: "Molly", species: "mouse", fur: "#C9B3A6", belly: "#F7EEE9", outfit: { kind: "dress", color: "#FF6FA8", accent: "#FFFFFF" } },
  ellie: { id: "ellie", name: "Ellie", species: "elephant", fur: "#AFB9DA", belly: "#DCE2F3", outfit: { kind: "overalls", color: "#8E5CFF", accent: "#FFD23F" } },
  leo: { id: "leo", name: "Leo", species: "lion", fur: "#F7C55A", belly: "#FFEBC2", fur2: "#B5602E", outfit: { kind: "tshirt", color: "#FF8A2A", accent: "#FFE14D", motif: "star" } },
  papa: { id: "papa", name: "Papa Bunny", species: "bunny", fur: "#CFC8DD", belly: "#FFC7D6", outfit: { kind: "sweater", color: "#4A6FD0", accent: "#FFD54A" }, extra: "glasses", adult: true },
};

export const CAST_IDS = Object.keys(CAST);
