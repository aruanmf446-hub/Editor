import { moveHorizontal, moveVertical } from '../RuntimeCollision';
import type { RuntimeWorld } from '../RuntimeWorld';

export function resolveWorldMovement(world: RuntimeWorld, delta: number) {
  moveHorizontal(world.player, world.platforms, delta, world.scene.width);
  moveVertical(world.player, world.platforms, delta);
  if (world.player.y > world.scene.height + world.player.height) {
    world.player.x = world.player.spawnX;
    world.player.y = world.player.spawnY;
    world.player.velocityX = 0;
    world.player.velocityY = 0;
    world.player.grounded = false;
  }
}
