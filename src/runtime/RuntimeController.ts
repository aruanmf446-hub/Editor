import type { CampaignProgress } from '../types/project';
import type { RuntimeProjectSnapshot } from './RuntimeProjectLoader';
import { resetRuntimeSceneObjectState } from './RuntimeAdvancedObjects';
import { restoreCampaignProgress } from './RuntimeCampaign';
import { RUNTIME_CONFIG } from './RuntimeConfig';
import { createRuntimeEnemies } from './RuntimeEnemy';
import { RuntimeInput } from './RuntimeInput';
import { RuntimeLoop, type RuntimeFrame } from './RuntimeLoop';
import { createRuntimePickups } from './RuntimePickup';
import { updateRuntimeWorld } from './RuntimePhysics';
import { createRuntimePlayer } from './RuntimePlayer';
import { createRuntimePlatforms, type RuntimeWorld } from './RuntimeWorld';

export type RuntimePauseReason = 'manual' | 'blur' | null;
export type RuntimeControllerSnapshot = { world: RuntimeWorld; fps: number };
type Options = { snapshot: RuntimeProjectSnapshot; progress?: CampaignProgress | null; onProgressChange?: (progress: CampaignProgress) => void; onRender: (snapshot: RuntimeControllerSnapshot) => void };

export class RuntimeController {
  private readonly input = new RuntimeInput();
  private readonly world: RuntimeWorld;
  private readonly loop: RuntimeLoop;
  private pauseReason: RuntimePauseReason = null;
  private accumulator = 0;
  private disposed = false;

  constructor(private readonly options: Options) {
    const { snapshot } = options;
    const pickupMemory = {};
    this.world = {
      project: snapshot.project,
      scene: snapshot.initialScene,
      sceneRevision: 0,
      currentLevelId: snapshot.levelId,
      campaignProgress: options.progress ? structuredClone(options.progress) : null,
      campaignProgressRevision: 0,
      campaignElapsed: 0,
      campaignDeaths: 0,
      player: createRuntimePlayer(snapshot.spawn),
      enemies: createRuntimeEnemies(snapshot.initialScene),
      pickups: createRuntimePickups(snapshot.initialScene, pickupMemory),
      pickupMemory,
      platforms: createRuntimePlatforms(snapshot.initialScene),
      activeCheckpoint: null,
      collectedObjectIds: {},
      triggeredObjectIds: {},
      activeTriggerContacts: {},
      completedDialogueIds: {},
      objectVisibilityOverrides: {},
      collisionEnabledOverrides: {},
      variables: {},
      collectiblesRemaining: snapshot.initialScene.objects.filter((object) => object.type === 'collectible' && object.visible && !object.editorOnly).length,
      activeDialogue: null,
      dialogueAdvanceRequested: false,
      lastTriggerId: null,
      playerNoCollision: false,
      pendingSceneTransition: null,
      cameraOverride: null,
      camera: { x: 0, y: 0, viewportWidth: 960, viewportHeight: 540 },
      input: this.input.snapshot(), paused: false, completed: false,
      physicsSteps: 0, accumulator: 0, droppedPhysicsTime: 0,
    };
    resetRuntimeSceneObjectState(this.world);
    restoreCampaignProgress(this.world, options.progress ?? null);
    this.loop = new RuntimeLoop(this.frame);
  }

  start(): void { if (!this.disposed) { this.input.start(); this.loop.start(); } }
  pause(reason: Exclude<RuntimePauseReason, null>): void {
    if (this.disposed || (this.pauseReason === 'manual' && reason === 'blur')) return;
    this.pauseReason = reason; this.world.paused = true; this.clearAccumulator(); this.input.resetEdges(); this.loop.setPaused(true); this.emit(0);
  }
  resume(): void {
    if (this.disposed || this.world.completed) return;
    this.pauseReason = null; this.world.paused = false; this.clearAccumulator(); this.input.resetEdges(); this.loop.setPaused(false);
  }
  advanceDialogue(): void {
    if (this.disposed || !this.world.activeDialogue || this.world.activeDialogue.contactOnly) return;
    this.world.dialogueAdvanceRequested = true;
  }
  resize(width: number, height: number): void { this.world.camera.viewportWidth = Math.max(1, width); this.world.camera.viewportHeight = Math.max(1, height); }
  getWorld(): RuntimeWorld { return this.world; }
  getPauseReason(): RuntimePauseReason { return this.pauseReason; }
  destroy(): void { if (!this.disposed) { this.disposed = true; this.clearAccumulator(); this.loop.stop(); this.input.stop(); } }

  private clearAccumulator(): void { this.accumulator = 0; this.world.accumulator = 0; }
  private frame = (frame: RuntimeFrame) => {
    if (this.disposed || this.world.paused) return;
    this.accumulator += frame.delta;
    let steps = 0;
    while (this.accumulator >= RUNTIME_CONFIG.fixedStep && steps < RUNTIME_CONFIG.maxPhysicsStepsPerFrame) {
      this.world.input = this.input.snapshot();
      updateRuntimeWorld(this.world, RUNTIME_CONFIG.fixedStep);
      this.world.campaignElapsed = (this.world.campaignElapsed ?? 0) + RUNTIME_CONFIG.fixedStep;
      this.emitProgressIfChanged();
      if (steps === 0) this.input.consumeEdges();
      this.accumulator -= RUNTIME_CONFIG.fixedStep;
      steps += 1;
      if (this.world.paused) {
        this.clearAccumulator();
        this.world.physicsSteps = steps;
        this.emit(frame.fps);
        return;
      }
    }
    if (steps === RUNTIME_CONFIG.maxPhysicsStepsPerFrame && this.accumulator >= RUNTIME_CONFIG.fixedStep) {
      const remainder = this.accumulator % RUNTIME_CONFIG.fixedStep;
      this.world.droppedPhysicsTime += this.accumulator - remainder;
      this.accumulator = remainder;
    }
    this.world.physicsSteps = steps;
    this.world.accumulator = this.accumulator;

    // O loop já é dirigido por requestAnimationFrame. Emitir somente a 30 Hz fazia a
    // câmera e os elementos React avançarem em saltos, embora o contador mostrasse 60 FPS.
    // Mantemos a física fixa em 60 Hz e apresentamos cada frame do navegador.
    this.emit(frame.fps);
  };
  private emit(fps: number): void { if (!this.disposed) this.options.onRender({ world: this.world, fps }); }
  private emittedProgressRevision = 0;
  private emitProgressIfChanged(): void {
    const revision = this.world.campaignProgressRevision ?? 0;
    if (revision === this.emittedProgressRevision || !this.world.campaignProgress) return;
    this.emittedProgressRevision = revision;
    this.options.onProgressChange?.(structuredClone(this.world.campaignProgress));
  }
}
