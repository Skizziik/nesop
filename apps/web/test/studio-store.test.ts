import type { TimelineDoc } from "@ipt/templates";
import { beforeEach, describe, expect, it } from "vitest";
import { findClip, snapTo, useStudio } from "../src/components/studio/store";

const doc = (): TimelineDoc =>
  ({
    version: 1,
    title: "t",
    canvas: { w: 1920, h: 1080, fps: 30 },
    duration_s: 20,
    tracks: [
      { id: "scenes", kind: "scene", name: "Сцены", clips: [{ id: "a", type: "slide", start: 0, duration: 10, props: { kind: "title", title: "x" } }] },
      { id: "music", kind: "audio", name: "Звук", clips: [{ id: "m", type: "audio", start: 0, duration: 20, trim: 2, props: { src: "x.wav" } }] },
      { id: "subs", kind: "subtitle", name: "Субтитры", clips: [] },
    ],
  }) as unknown as TimelineDoc;

const st = () => useStudio.getState();

beforeEach(() => st().load("p1", doc(), 3));

describe("studio store", () => {
  it("правка → dirty, undo/redo возвращают документ", () => {
    st().updateClip("a", { duration: 5 });
    expect(st().dirty).toBe(true);
    expect(findClip(st().doc!, "a")!.clip.duration).toBe(5);
    st().undo();
    expect(findClip(st().doc!, "a")!.clip.duration).toBe(10);
    st().redo();
    expect(findClip(st().doc!, "a")!.clip.duration).toBe(5);
  });

  it("перетаскивание склеивается в один шаг истории", () => {
    for (let i = 1; i <= 5; i++) st().updateClip("a", { start: i }, "drag");
    expect(st().past.length).toBe(1);
    st().undo();
    expect(findClip(st().doc!, "a")!.clip.start).toBe(0);
  });

  it("разрезание аудио: правая часть продолжает с того же места", () => {
    st().select(["m"]);
    st().setPlayhead(8);
    st().splitAtPlayhead();
    const clips = st().doc!.tracks[1]!.clips;
    expect(clips).toHaveLength(2);
    expect(clips[0]!.duration).toBe(8);
    expect(clips[1]!.start).toBe(8);
    expect(clips[1]!.duration).toBe(12);
    expect(clips[1]!.trim).toBe(10);
  });

  it("клип ложится на дорожку своего типа и удлиняет ролик", () => {
    const id = st().addClip({ type: "subtitle", start: 19, duration: 4, props: { text: "ciao" } });
    expect(findClip(st().doc!, id)!.track.id).toBe("subs");
    expect(st().doc!.duration_s).toBe(23);
    expect(st().selected).toEqual([id]);
  });

  it("без нужной дорожки — создаётся новая", () => {
    const id = st().addClip({ type: "mascot", start: 0, duration: 4, props: { character: "pizza" } });
    expect(findClip(st().doc!, id)!.track.kind).toBe("mascot");
  });

  it("клип нельзя перенести на дорожку другого типа и нельзя удалить с замка", () => {
    st().moveClipToTrack("a", "music");
    expect(findClip(st().doc!, "a")!.track.id).toBe("scenes");
    st().updateTrack("scenes", { locked: true });
    st().select(["a"]);
    st().removeSelected();
    expect(findClip(st().doc!, "a")).not.toBeNull();
  });

  it("дубль встаёт сразу после оригинала", () => {
    st().select(["a"]);
    st().duplicateSelected();
    const [orig, copy] = st().doc!.tracks[0]!.clips;
    expect(copy!.start).toBe(orig!.start + orig!.duration);
    expect(copy!.id).not.toBe("a");
  });

  it("привязка к ближайшей точке в пределах допуска", () => {
    expect(snapTo(4.93, [0, 5, 10], 0.1)).toBe(5);
    expect(snapTo(4.5, [0, 5, 10], 0.1)).toBe(4.5);
  });
});
