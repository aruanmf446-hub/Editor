import { moveHorizontal, moveVertical, probeGround } from '../RuntimeCollision';
import { resetPlayerAtSpawn } from '../RuntimePlayer';
import type { RuntimeWorld } from '../RuntimeWorld';

export function resolveWorldMovement(world: RuntimeWorld, delta: number) {
  const player = world.player;
  player.previousX = player.x;
  player.previousY = player.y;
  player.lastCollisionSide = null;
  moveHorizontal(player, world.platforms, delta, world.scene.width);
  moveVertical(player, world.platforms, delta);
  if (!player.grounded && player.velocityY >= 0 && probeGround(player, world.platforms)) player.grounded = true;
  if (player.y < 0) {
    player.y = 0;
    if (player.velocityY < 0) player.velocityY = 0;
    player.lastCollisionSide = 'top';
  }
  if (player.y > world.scene.height + player.height) resetPlayerAtSpawn(player);
}
