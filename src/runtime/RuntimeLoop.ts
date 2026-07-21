export type RuntimeFrame = { delta: number; elapsed: number; fps: number };

export class RuntimeLoop {
  private frameId = 0;
  private previous = 0;
  private elapsed = 0;
  private running = false;
  private paused = false;

  constructor(private readonly update: (frame: RuntimeFrame) => void) {}

  start() {
    if (this.running) return;
    this.running = true;
    this.previous = performance.now();
    this.frameId = requestAnimationFrame(this.tick);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.frameId);
  }

  setPaused(paused: boolean) {
    if (this.paused === paused) return;
    this.paused = paused;
    this.previous = performance.now();
  }

  private tick = (time: number) => {
    if (!this.running) return;
    const delta = Math.min((time - this.previous) / 1000, 1 / 20);
    this.previous = time;
    if (!this.paused) {
      this.elapsed += delta;
      this.update({ delta, elapsed: this.elapsed, fps: delta > 0 ? 1 / delta : 0 });
    }
    this.frameId = requestAnimationFrame(this.tick);
  };
}
