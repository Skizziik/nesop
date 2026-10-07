import { describe, expect, it } from "vitest";
import { JobQueue } from "../src/jobs";

const tick = () => new Promise((r) => setTimeout(r, 5));

describe("JobQueue", () => {
  it("не превышает параллелизм и доводит задачи до done/error", async () => {
    let active = 0;
    let peak = 0;
    const q = new JobQueue(2, async (job) => {
      active++;
      peak = Math.max(peak, active);
      await tick();
      active--;
      if (job.props.fail) throw new Error("boom");
    });
    const jobs = [q.add({}, "/data/a"), q.add({}, "/data/b"), q.add({ fail: true }, "/data/c"), q.add({}, "/data/d")];
    for (let i = 0; i < 50 && jobs.some((j) => !j.finishedAt); i++) await tick();
    expect(peak).toBe(2);
    expect(jobs.map((j) => q.get(j.id)!.status)).toEqual(["done", "done", "error", "done"]);
    expect(q.get(jobs[2]!.id)!.error).toBe("boom");
  });
});
