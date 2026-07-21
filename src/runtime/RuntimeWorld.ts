import type { ElFuegoProject, ProjectScene } from '../types/project';
import type { RuntimeInputSnapshot } from './RuntimeInput';
import type { RuntimePlayerState } from './RuntimePlayer';

export type RuntimeBounds = { x: number; y: number; width: number; height: number };
export type RuntimeCameraState = { x: number; y: number; viewportWidth: number; viewportHeight: number };
export type RuntimePlatformState = RuntimeBounds & { id: string; oneWay: boolean };

export type RuntimeWorld = {
  project: ElFuegoProject;
  scene: ProjectScene;
  player: RuntimePlayerState;
  platforms: RuntimePlatformState[];
  camera: RuntimeCameraState;
  input: RuntimeInputSnapshot;
  paused: boolean;
  completed: boolean;
  physicsSteps: number;
  accumulator: number;
  droppedPhysicsTime: number;
};

export function createRuntimePlatforms(scene: ProjectScene): RuntimePlatformState[] {
  return scene.objects
    .filter((object) => object.visible && (object.type === 'platform' || object.type === 'wall'))
    .map((object) => ({
      id: object.id,
      x: object.transform.x,
      y: object.transform.y,
      width: object.transform.width,
      height: object.transform.height,
      oneWay: object.type === 'platform' && Boolean(object.passThrough),
    }));
}