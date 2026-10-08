import { Composition, type CalculateMetadataFunction } from "remotion";
import type { RenderProps } from "./generated";
import { ShortVideo } from "./Video";
import { SAMPLE_PROPS } from "./sample";
import { MascotGallery } from "./components/MascotGallery";
import type { TimelineDoc } from "./generated";
import { TimelineVideo } from "./timeline/Timeline";
import { SAMPLE_TIMELINE } from "./timeline/sample";
import { docFrames } from "./timeline/types";

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
