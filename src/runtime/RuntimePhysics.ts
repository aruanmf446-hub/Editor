import type { RuntimeWorld } from './RuntimeWorld';
import { resolvePlayerVisualState } from './RuntimePlayer';
import { updatePlayerMovement } from './systems/PlayerMovementSystem';
import { updatePlayerCombat } from './systems/PlayerCombatSystem';
import { applyGravity } from './systems/GravitySystem';
import { resolveWorldMovement } from './systems/CollisionSystem';
import { updateCamera } from './systems/CameraSystem';

export function updateRuntimeWorld(world: RuntimeWorld, delta: number) {
  if (world.paused) return;
  updatePlayerCombat(world, delta);
  updatePlayerMovement(world, delta);
  if (world.player.mode !== 'dead') {
    applyGravity(world, delta);
    resolveWorldMovement(world, delta);
  }
  world.player.visualState = resolvePlayerVisualState(world.player);
  updateCamera(world);
}
