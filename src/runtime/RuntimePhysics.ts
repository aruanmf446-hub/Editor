import type { RuntimeWorld } from './RuntimeWorld';
import { resolvePlayerVisualState } from './RuntimePlayer';
import { updatePlayerMovement } from './systems/PlayerMovementSystem';
import { applyGravity } from './systems/GravitySystem';
import { resolveWorldMovement } from './systems/CollisionSystem';
import { updateCamera } from './systems/CameraSystem';

export function updateRuntimeWorld(world: RuntimeWorld, delta: number) {
  if (world.paused) return;
  updatePlayerMovement(world, delta);
  applyGravity(world, delta);
  resolveWorldMovement(world, delta);
  world.player.visualState = resolvePlayerVisualState(world.player);
  updateCamera(world);
}
