import { Composition, type CalculateMetadataFunction } from "remotion";
import type { RenderProps } from "./generated";
import { ShortVideo } from "./Video";
import { SAMPLE_PROPS } from "./sample";
import { MascotGallery } from "./components/MascotGallery";

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
