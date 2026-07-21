import type { RuntimeWorld } from './RuntimeWorld';
import { resolvePlayerVisualState } from './RuntimePlayer';
import { updateRuntimeEnemies } from './RuntimeEnemy';
import { updatePlayerMovement } from './systems/PlayerMovementSystem';
import { updatePlayerCombat } from './systems/PlayerCombatSystem';
import { applyGravity } from './systems/GravitySystem';
import { resolveWorldMovement } from './systems/CollisionSystem';
import { updateCamera } from './systems/CameraSystem';
import { updateRuntimeCheckpoints, updateRuntimeFinish } from './systems/RuntimeSceneSystem';

export function updateRuntimeWorld(world: RuntimeWorld, delta: number) {
  if (world.paused) return;
  world.player.renderPreviousX = world.player.x;
  world.player.renderPreviousY = world.player.y;
  updatePlayerCombat(world, delta);
  updatePlayerMovement(world, delta);
  if (world.player.mode !== 'dead') {
    applyGravity(world, delta);
    resolveWorldMovement(world, delta);
  }
  updateRuntimeEnemies(world, delta);
  updateRuntimeCheckpoints(world);
  updateRuntimeFinish(world);
  world.player.visualState = resolvePlayerVisualState(world.player);
  updateCamera(world);
}
