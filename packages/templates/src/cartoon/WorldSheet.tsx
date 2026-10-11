/**
 * Лист мира (этап 1): одна локация во всех совместимых состояниях — время суток × погода, плюс сезоны.
 * Нужен для визуальной проверки: каждое состояние без артефактов, с героем для масштаба.
 */
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { actionPose } from "./actions";
import { CAST } from "./cast";
import { LOCATION_CATALOG, worldAllowed, type Season, type TimeOfDay, type Weather } from "./catalog";
import { locationDef, locationProps } from "./locations";
import type { WorldState } from "./palette";
import { Character, REST } from "./rig";
import { GROUND } from "./scenes";
import { WorldFx } from "./world";

export const WORLD_SHEET_ID = "WorldSheet";
const TIMES: TimeOfDay[] = ["morning", "day", "evening", "night"];
const WEATHERS: Weather[] = ["clear", "cloudy", "rain", "snow", "windy"];
const SEASONS: Season[] = ["spring", "summer", "autumn", "winter"];

/** Все совместимые состояния локации: время × погода (сезон лето, для снега зима) и сезоны днём в ясную погоду. */
export function worldStates(location: string, season: Season = "summer"): WorldState[] {
  const loc = LOCATION_CATALOG.find((l) => l.id === location);
  if (!loc) return [];
  const out: WorldState[] = [];
  for (const time of TIMES)
    for (const weather of WEATHERS) {
      const w = { time, weather, season: weather === "snow" ? ("winter" as Season) : season };
      if (worldAllowed(loc, w)) out.push(w);
    }
  for (const s of SEASONS) {
    const w = { time: loc.times.includes("day") ? ("day" as TimeOfDay) : loc.times[0]!, weather: "clear" as Weather, season: s };
    if (s !== season && worldAllowed(loc, w)) out.push(w);
  }
  return out;
}

export function WorldCell({ location, world, t, seed = 7 }: { location: string; world: WorldState; t: number; seed?: number }) {
  const loc = locationDef(location);
  const cam = { x: 960, y: 1080 * 0.62, zoom: 1 };
  const lp = locationProps(location, cam, t, { world, seed, uid: `ws-${location}-${world.time}-${world.weather}-${world.season}` });
  const outdoor = LOCATION_CATALOG.find((l) => l.id === location)?.outdoor ?? true;
  const wear = world.weather === "rain" ? (["raincoat"] as const) : world.season === "winter" ? (["winter_hat", "scarf"] as const) : world.time === "night" && !outdoor ? (["pajamas"] as const) : [];
  return (
    <svg viewBox="0 0 1920 1080" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
      <loc.Back {...lp} />
      <g transform={`translate(960 ${GROUND}) scale(1.25)`}>
        <Character spec={CAST.benny!} st={{ pose: actionPose("wave", 1, t) ?? REST, emotion: "happy", mouth: 0, blink: false, look: [0, 0], facing: 1, wear: [...wear] }} t={t} />
      </g>
      {loc.Front ? <loc.Front {...lp} /> : null}
      <WorldFx world={world} t={t} outdoor={outdoor} />
    </svg>
  );
}

export function WorldSheet({ location = "garden", season = "summer" }: { location?: string; season?: Season }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps + 1;
  const states = worldStates(location, season);
  const cols = states.length > 16 ? 6 : states.length > 9 ? 4 : 3;
  const rows = Math.ceil(states.length / cols);
  return (
    <AbsoluteFill style={{ background: "#F4F1FA", padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ font: "900 30px/1 Nunito, Arial, sans-serif", color: "#2A1B33" }}>
        Мир · {location} · {states.length} состояний
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, gap: 10, flex: 1, minHeight: 0 }}>
        {states.map((w) => (
          <div key={`${w.time}-${w.weather}-${w.season}`} style={{ position: "relative", borderRadius: 14, overflow: "hidden", background: "#2A1B33" }}>
            <WorldCell location={location} world={w} t={t} />
            <div style={{ position: "absolute", left: 8, bottom: 6, font: "800 16px/1 Nunito, Arial, sans-serif", color: "#FFFFFF", background: "rgba(42,27,51,.65)", padding: "4px 8px", borderRadius: 10 }}>
              {w.time} · {w.weather} · {w.season}
            </div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}
