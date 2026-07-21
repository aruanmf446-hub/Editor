import type { SceneObjectBase } from '../types/project';
import { RUNTIME_CONFIG } from './RuntimeConfig';
import type { RuntimePlatformState } from './RuntimeWorld';
import { intersects } from './RuntimeCollision';

export type RuntimePlayerVisualState = 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'crouch';

export type RuntimePlayerState = {
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  spawnX: number;
  spawnY: number;
  width: number;
  height: number;
  standingHeight: number;
  velocityX: number;
  velocityY: number;
  direction: 'left' | 'right';
  grounded: boolean;
  crouching: boolean;
  health: number;
  attack: number;
  defense: number;
  coyoteRemaining: number;
  jumpBufferRemaining: number;
  visualState: RuntimePlayerVisualState;
  lastCollisionSide: 'left' | 'right' | 'top' | 'bottom' | null;
};

/** player-spawn x/y represent the top-left corner of the initial player hitbox. */
export function createRuntimePlayer(spawn: SceneObjectBase): RuntimePlayerState {
  return {
    x: spawn.transform.x,
    y: spawn.transform.y,
    previousX: spawn.transform.x,
    previousY: spawn.transform.y,
    spawnX: spawn.transform.x,
    spawnY: spawn.transform.y,
    width: spawn.transform.width,
    height: spawn.transform.height,
    standingHeight: spawn.transform.height,
    velocityX: 0,
    velocityY: 0,
    direction: spawn.direction ?? 'right',
    grounded: false,
    crouching: false,
    health: spawn.initialHealth ?? 3,
    attack: spawn.initialAttack ?? 1,
    defense: spawn.initialDefense ?? 1,
    coyoteRemaining: 0,
    jumpBufferRemaining: 0,
    visualState: 'fall',
    lastCollisionSide: null,
  };
}

export function resolvePlayerVisualState(player: RuntimePlayerState): RuntimePlayerVisualState {
  if (player.crouching) return 'crouch';
  if (!player.grounded) return player.velocityY < 0 ? 'jump' : 'fall';
  const speed = Math.abs(player.velocityX);
  if (speed >= RUNTIME_CONFIG.runThreshold) return 'run';
  if (speed > RUNTIME_CONFIG.idleThreshold) return 'walk';
  return 'idle';
}

export function canPlayerStand(player: RuntimePlayerState, platforms: RuntimePlatformState[]): boolean {
  const candidate = {
    x: player.x,
    y: player.y + player.height - player.standingHeight,
    width: player.width,
    height: player.standingHeight,
  };
  return !platforms.some((platform) => !platform.oneWay && intersects(candidate, platform));
}

export function setPlayerCrouching(player: RuntimePlayerState, crouching: boolean): void {
  if (crouching === player.crouching) return;
  const feetY = player.y + player.height;
  player.height = crouching ? player.standingHeight * RUNTIME_CONFIG.crouchHeightFactor : player.standingHeight;
  player.y = feetY - player.height;
  player.crouching = crouching;
}

export function resetPlayerAtSpawn(player: RuntimePlayerState): void {
  player.x = player.spawnX;
  player.y = player.spawnY;
  player.previousX = player.spawnX;
  player.previousY = player.spawnY;
  player.height = player.standingHeight;
  player.velocityX = 0;
  player.velocityY = 0;
  player.grounded = false;
  player.crouching = false;
  player.coyoteRemaining = 0;
  player.jumpBufferRemaining = 0;
  player.lastCollisionSide = null;
  player.visualState = 'fall';
}
