import { Composition, type CalculateMetadataFunction } from "remotion";
import type { RenderProps } from "./generated";
import { ShortVideo } from "./Video";
import { SAMPLE_PROPS } from "./sample";
import { MascotGallery } from "./components/MascotGallery";
import type { TimelineDoc } from "./generated";
import { TimelineVideo } from "./timeline/Timeline";
import { SAMPLE_TIMELINE } from "./timeline/sample";
import { docFrames } from "./timeline/types";
import { Thumbnail, THUMBNAIL_ID, THUMB_H, THUMB_W } from "./timeline/Thumbnail";
import { ChannelBanner, BANNER_ID, BANNER_H, BANNER_W } from "./timeline/ChannelBanner";

export const TIMELINE_ID = "Timeline";

const timelineMetadata: CalculateMetadataFunction<AnyProps> = ({ props }) => {
  const d = props as unknown as TimelineDoc;
  return { durationInFrames: docFrames(d), fps: d.canvas.fps, width: d.canvas.w, height: d.canvas.h };
};

export const COMPOSITION_ID = "Short";

type AnyProps = Record<string, unknown>;

export const durationFrames = (p: Pick<RenderProps, "duration_s" | "canvas">): number => Math.max(1, Math.ceil(p.duration_s * p.canvas.fps));

const calculateMetadata: CalculateMetadataFunction<AnyProps> = ({ props }) => {
  const p = props as unknown as RenderProps;
  return { durationInFrames: durationFrames(p), fps: p.canvas.fps, width: p.canvas.w, height: p.canvas.h };
};

export const RemotionRoot: React.FC = () => (
  <>
  <Composition id="MascotGallery" component={MascotGallery} durationInFrames={90} fps={30} width={1920} height={1080} />
  <Composition id={BANNER_ID} component={ChannelBanner as unknown as React.FC<AnyProps>} durationInFrames={1} fps={30} width={BANNER_W} height={BANNER_H} defaultProps={{}} />
  <Composition
    id={THUMBNAIL_ID}
    component={Thumbnail as unknown as React.FC<AnyProps>}
    durationInFrames={1}
    fps={30}
    width={THUMB_W}
    height={THUMB_H}
    defaultProps={{ text: "Essere o avere?", highlight: "avere", sub: "Learn Italian", badge: "A2", mascot: "espresso", emotion: "surprised", variant: 0 }}
  />
  <Composition
    id={TIMELINE_ID}
    component={TimelineVideo as unknown as React.FC<AnyProps>}
    durationInFrames={docFrames(SAMPLE_TIMELINE)}
    fps={30}
    width={1920}
    height={1080}
    defaultProps={SAMPLE_TIMELINE as unknown as AnyProps}
    calculateMetadata={timelineMetadata}
  />
  <Composition
    id={COMPOSITION_ID}
    component={ShortVideo as unknown as React.FC<AnyProps>}
    durationInFrames={durationFrames(SAMPLE_PROPS)}
    fps={30}
    width={1080}
    height={1920}
    defaultProps={SAMPLE_PROPS as unknown as AnyProps}
    calculateMetadata={calculateMetadata}
  />
  </>
);
