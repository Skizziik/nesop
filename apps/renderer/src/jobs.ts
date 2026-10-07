import { randomUUID } from "node:crypto";

export type JobStatus = "queued" | "rendering" | "postprocess" | "done" | "error";

export interface RenderJob {
  id: string;
  status: JobStatus;
  progress: number;
  error: string | null;
  outDir: string;
  props: Record<string, unknown>;
  outputs: { video?: string; cover?: string };
  createdAt: number;
  finishedAt: number | null;
}

/** Простая in-memory очередь с ограничением параллелизма. Источник правды о задачах — БД api; здесь только исполнение. */
export class JobQueue {
  private jobs = new Map<string, RenderJob>();
  private running = 0;
  private pending: string[] = [];

  constructor(
    private concurrency: number,
    private run: (job: RenderJob) => Promise<void>,
  ) {}

  add(props: Record<string, unknown>, outDir: string): RenderJob {
    const job: RenderJob = { id: randomUUID(), status: "queued", progress: 0, error: null, outDir, props, outputs: {}, createdAt: Date.now(), finishedAt: null };
    this.jobs.set(job.id, job);
    this.pending.push(job.id);
    this.pump();
    return job;
  }

  get(id: string): RenderJob | undefined {
    return this.jobs.get(id);
  }

  stats() {
    return { running: this.running, queued: this.pending.length, concurrency: this.concurrency };
  }

  private pump(): void {
    while (this.running < this.concurrency && this.pending.length) {
      const job = this.jobs.get(this.pending.shift()!);
      if (!job) continue;
      this.running++;
      this.run(job)
        .then(() => {
          job.status = "done";
          job.progress = 1;
        })
        .catch((e: unknown) => {
          job.status = "error";
          job.error = e instanceof Error ? e.message : String(e);
        })
        .finally(() => {
          job.finishedAt = Date.now();
          this.running--;
          this.gc();
          this.pump();
        });
    }
  }

  /** Держим завершённые задачи час, чтобы worker успел забрать статус. */
  private gc(): void {
    const cutoff = Date.now() - 3600_000;
    for (const [id, j] of this.jobs) if (j.finishedAt && j.finishedAt < cutoff) this.jobs.delete(id);
  }
}
