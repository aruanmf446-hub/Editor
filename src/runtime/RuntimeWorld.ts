import type { ElFuegoProject, ProjectScene, SceneObjectBase } from '../types/project';
import type { RuntimeInputState } from './RuntimeInput';

export type RuntimeBounds = { x: number; y: number; width: number; height: number };
export type RuntimeCameraState = { x: number; y: number; viewportWidth: number; viewportHeight: number };
export type RuntimePlayerState = RuntimeBounds & {
  spawnX: number; spawnY: number; standingHeight: number;
  velocityX: number; velocityY: number;
  direction: 'left' | 'right'; grounded: boolean; crouching: boolean;
  health: number; attack: number; defense: number;
  coyoteRemaining: number; jumpBufferRemaining: number;
};
export type RuntimePlatformState = RuntimeBounds & { id: string; oneWay: boolean };
export type RuntimeWorld = {
  project: ElFuegoProject;
  scene: ProjectScene;
  player: RuntimePlayerState;
  platforms: RuntimePlatformState[];
  camera: RuntimeCameraState;
  input: RuntimeInputState;
  paused: boolean;
  completed: boolean;
};

export function createRuntimePlayer(spawn: SceneObjectBase): RuntimePlayerState {
  return {
    x: spawn.transform.x, y: spawn.transform.y,
    spawnX: spawn.transform.x, spawnY: spawn.transform.y,
    width: spawn.transform.width, height: spawn.transform.height,
    standingHeight: spawn.transform.height,
    velocityX: 0, velocityY: 0,
    direction: spawn.direction ?? 'right', grounded: false, crouching: false,
    health: spawn.initialHealth ?? 3, attack: spawn.initialAttack ?? 1, defense: spawn.initialDefense ?? 1,
    coyoteRemaining: 0, jumpBufferRemaining: 0,
  };
}

export function createRuntimePlatforms(scene: ProjectScene): RuntimePlatformState[] {
  return scene.objects.filter((object) => object.visible && (object.type === 'platform' || object.type === 'wall')).map((object) => ({
    id: object.id, x: object.transform.x, y: object.transform.y,
    width: object.transform.width, height: object.transform.height,
    oneWay: object.type === 'platform' && Boolean(object.passThrough),
  }));
}
