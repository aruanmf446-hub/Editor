import { intersects, moveHorizontal, moveVertical, probeGround } from '../RuntimeCollision';
import { resetPlayerAtSpawn } from '../RuntimePlayer';
import type { RuntimeBounds, RuntimeWorld } from '../RuntimeWorld';

const MAX_RESPAWN_SEARCH_DISTANCE = 256;
const RESPAWN_SEARCH_STEP = 4;

function findSafeRespawnY(world: RuntimeWorld): number | null {
  const player = world.player;
  for (let offset = 0; offset <= MAX_RESPAWN_SEARCH_DISTANCE; offset += RESPAWN_SEARCH_STEP) {
    const candidate: RuntimeBounds = {
      x: player.spawnX,
      y: player.spawnY - offset,
      width: player.width,
      height: player.standingHeight,
    };
    const blocked = world.platforms.some((platform) => !platform.oneWay && intersects(candidate, platform));
    if (!blocked && candidate.x >= 0 && candidate.x + candidate.width <= world.scene.width && candidate.y >= 0) return candidate.y;
  }
  return null;
}

export function resolveWorldMovement(world: RuntimeWorld, delta: number) {
  const player = world.player;
  player.lastCollisionSide = null;
  moveHorizontal(player, world.platforms, delta, world.scene.width);
  moveVertical(player, world.platforms, delta);
  if (!player.grounded && player.velocityY >= 0 && probeGround(player, world.platforms)) player.grounded = true;
  if (player.y < 0) {
    player.y = 0;
    if (player.velocityY < 0) player.velocityY = 0;
    player.lastCollisionSide = 'top';
  }
  if (player.y > world.scene.height + player.height) {
    const safeY = findSafeRespawnY(world);
    if (safeY === null) {
      world.respawnFailure = true;
      world.pauseReason = 'invalid-respawn';
      world.paused = true;
      player.velocityX = 0;
      player.velocityY = 0;
      return;
    }
    world.respawnFailure = false;
    world.pauseReason = undefined;
    resetPlayerAtSpawn(player);
    player.y = safeY;
    player.previousY = safeY;
  }
}
