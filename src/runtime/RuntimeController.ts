import type { RuntimeProjectSnapshot } from './RuntimeProjectLoader';
import { RUNTIME_CONFIG } from './RuntimeConfig';
import { RuntimeInput } from './RuntimeInput';
import { RuntimeLoop, type RuntimeFrame } from './RuntimeLoop';
import { updateRuntimeWorld } from './RuntimePhysics';
import { createRuntimePlayer } from './RuntimePlayer';
import { createRuntimePlatforms, type RuntimeWorld } from './RuntimeWorld';

export type RuntimePauseReason = 'manual' | 'blur' | null;
export type RuntimeControllerSnapshot = { world: RuntimeWorld; fps: number };

type Options = {
  snapshot: RuntimeProjectSnapshot;
  onRender: (snapshot: RuntimeControllerSnapshot) => void;
};

export class RuntimeController {
  private readonly input = new RuntimeInput();
  private readonly world: RuntimeWorld;
  private readonly loop: RuntimeLoop;
  private pauseReason: RuntimePauseReason = null;
  private accumulator = 0;
  private disposed = false;
  private renderTimer = 0;

  constructor(private readonly options: Options) {
    const { snapshot } = options;
    this.world = {
      project: snapshot.project,
      scene: snapshot.initialScene,
      player: createRuntimePlayer(snapshot.spawn),
      platforms: createRuntimePlatforms(snapshot.initialScene),
      camera: { x: 0, y: 0, viewportWidth: 960, viewportHeight: 540 },
      input: this.input.snapshot(),
      paused: false,
      completed: false,
      physicsSteps: 0,
      accumulator: 0,
    };
    this.loop = new RuntimeLoop(this.frame);
  }

  start(): void {
    if (this.disposed) return;
    this.input.start();
    this.loop.start();
  }

  pause(reason: Exclude<RuntimePauseReason, null>): void {
    if (this.disposed) return;
    if (this.pauseReason === 'manual' && reason === 'blur') return;
    this.pauseReason = reason;
    this.world.paused = true;
    this.accumulator = 0;
    this.world.accumulator = 0;
    this.input.resetEdges();
    this.loop.setPaused(true);
    this.emit(0);
  }

  resume(): void {
    if (this.disposed) return;
    this.pauseReason = null;
    this.world.paused = false;
    this.accumulator = 0;
    this.world.accumulator = 0;
    this.input.resetEdges();
    this.loop.setPaused(false);
  }

  resize(width: number, height: number): void {
    this.world.camera.viewportWidth = Math.max(1, width);
    this.world.camera.viewportHeight = Math.max(1, height);
  }

  getWorld(): RuntimeWorld { return this.world; }
  getPauseReason(): RuntimePauseReason { return this.pauseReason; }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.accumulator = 0;
    this.world.accumulator = 0;
    this.loop.stop();
    this.input.stop();
  }

  private frame = (frame: RuntimeFrame) => {
    if (this.disposed || this.world.paused) return;
    this.accumulator += frame.delta;
    let steps = 0;
    while (this.accumulator >= RUNTIME_CONFIG.fixedStep && steps < RUNTIME_CONFIG.maxPhysicsStepsPerFrame) {
      this.world.input = this.input.snapshot();
      updateRuntimeWorld(this.world, RUNTIME_CONFIG.fixedStep);
      this.input.commitStep();
      this.accumulator -= RUNTIME_CONFIG.fixedStep;
      steps += 1;
    }
    if (steps === RUNTIME_CONFIG.maxPhysicsStepsPerFrame && this.accumulator >= RUNTIME_CONFIG.fixedStep) this.accumulator = 0;
    this.world.physicsSteps = steps;
    this.world.accumulator = this.accumulator;
    this.renderTimer += frame.delta;
    if (this.renderTimer >= 1 / 30) {
      this.renderTimer = 0;
      this.emit(frame.fps);
    }
  };

  private emit(fps: number): void {
    if (!this.disposed) this.options.onRender({ world: this.world, fps });
  }
}
