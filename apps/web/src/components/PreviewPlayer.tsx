"use client";

import { Player, type PlayerRef } from "@remotion/player";
import { ShortVideo, durationFrames, type RenderProps } from "@ipt/templates";
import { useRef } from "react";

/** Тот же компонент, что рендерит renderer: превью = рендер. */
export function PreviewPlayer({ props, overlay }: { props: RenderProps; overlay: boolean }) {
  const ref = useRef<PlayerRef>(null);
  const input = { ...props, show_yt_overlay: overlay, asset_base: "" };
  return (
    <Player
      ref={ref}
      component={ShortVideo as unknown as React.FC<Record<string, unknown>>}
      inputProps={input as unknown as Record<string, unknown>}
      durationInFrames={durationFrames(props)}
      fps={props.canvas.fps}
      compositionWidth={props.canvas.w}
      compositionHeight={props.canvas.h}
      style={{ width: "100%", aspectRatio: "9 / 16", borderRadius: 16, overflow: "hidden", background: "#000" }}
      controls
      loop
      clickToPlay
      acknowledgeRemotionLicense
    />
  );
}
