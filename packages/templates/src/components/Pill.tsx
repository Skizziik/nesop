import type { CSSProperties, ReactNode } from "react";
import type { Theme } from "../generated";

const RADIUS: Record<Theme["badge_shape"], (h: number) => number> = {
  rounded: (h) => h * 0.22,
  square: (h) => h * 0.06,
  pill: (h) => h / 2,
};

export interface PillProps {
  width: number;
  height: number;
  bg: string;
  color: string;
  shape: Theme["badge_shape"];
  font: string;
  fontSize: number;
  scale?: number;
  shadow?: boolean;
  children: ReactNode;
  style?: CSSProperties;
}

/** Плашка со словом. Вся анимация — через scale из useCurrentFrame, без CSS-transition. */
export const Pill: React.FC<PillProps> = ({ width, height, bg, color, shape, font, fontSize, scale = 1, shadow = true, children, style }) => (
  <div
    style={{
      width,
      height,
      background: bg,
      color,
      borderRadius: RADIUS[shape](height),
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: font,
      fontWeight: 800,
      fontSize,
      letterSpacing: 0.5,
      whiteSpace: "nowrap",
      transform: `scale(${scale})`,
      boxShadow: shadow ? "0 6px 0 rgba(0,0,0,0.18)" : undefined,
      ...style,
    }}
  >
    {children}
  </div>
);
