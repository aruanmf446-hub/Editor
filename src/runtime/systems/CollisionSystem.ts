import { intersects, moveHorizontal, moveVertical, probeGround } from '../RuntimeCollision';
import { resetPlayerAtSpawn } from '../RuntimePlayer';
import type { RuntimeBounds, RuntimeWorld } from '../RuntimeWorld';

const MAX_RESPAWN_SEARCH_DISTANCE = 256;
const RESPAWN_SEARCH_STEP = 4;

function findSafeRespawnY(world: RuntimeWorld): number | null {
  const player = world.player;
  for (let offset = 0; offset <= MAX_RESPAWN_SEARCH_DISTANCE; offset += RESPAWN_SEARCH_STEP) {
    const candidate: RuntimeBounds = { x: player.spawnX, y: player.spawnY - offset, width: player.width, height: player.standingHeight };
    const blocked = world.platforms.some((platform) => !platform.oneWay && intersects(candidate, platform));
    if (!blocked && candidate.x >= 0 && candidate.x + candidate.width <= world.scene.width && candidate.y >= 0) return candidate.y;
  }
  return null;
}

export function respawnPlayerSafely(world: RuntimeWorld): boolean {
  const safeY = findSafeRespawnY(world);
  if (safeY === null) {
    world.respawnFailure = true;
    world.pauseReason = 'invalid-respawn';
    world.paused = true;
    world.player.velocityX = 0;
    world.player.velocityY = 0;
    return false;
  }
  world.respawnFailure = false;
  world.pauseReason = undefined;
  resetPlayerAtSpawn(world.player);
  world.player.y = safeY;
  world.player.previousY = safeY;
  return true;
}

function moveWithoutCollisions(world: RuntimeWorld, delta: number): void {
  const player = world.player;
  player.x = Math.min(Math.max(0, player.x + player.velocityX * delta), Math.max(0, world.scene.width - player.width));
  player.y += player.velocityY * delta;
  player.grounded = false;
  if (player.y < 0) {
    player.y = 0;
    if (player.velocityY < 0) player.velocityY = 0;
    player.lastCollisionSide = 'top';
  }
}

function endTestByFall(world: RuntimeWorld): void {
  world.campaignDeaths = (world.campaignDeaths ?? 0) + 1;
  world.gameOverReason = 'fall';
  world.completed = true;
  world.paused = true;
  world.player.health = 0;
  world.player.mode = 'dead';
  world.player.visualState = 'dead';
  world.player.velocityX = 0;
  world.player.velocityY = 0;
}

export function resolveWorldMovement(world: RuntimeWorld, delta: number) {
  const player = world.player;
  player.lastCollisionSide = null;
  if (world.playerNoCollision) moveWithoutCollisions(world, delta);
  else {
    moveHorizontal(player, world.platforms, delta, world.scene.width);
    moveVertical(player, world.platforms, delta);
    if (!player.grounded && player.velocityY >= 0 && probeGround(player, world.platforms)) player.grounded = true;
  }
  if (player.grounded) player.airJumpsRemaining = player.doubleJumpEnabled ? 1 : 0;
  if (player.y < 0) {
    player.y = 0;
    if (player.velocityY < 0) player.velocityY = 0;
    player.lastCollisionSide = 'top';
  }
  if (player.y > world.scene.height + player.height) endTestByFall(world);
}