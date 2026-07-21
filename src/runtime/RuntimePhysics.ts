import type { RuntimeWorld } from './RuntimeWorld';
import { updatePlayerMovement } from './systems/PlayerMovementSystem';
import { applyGravity } from './systems/GravitySystem';
import { resolveWorldMovement } from './systems/CollisionSystem';
import { updateCamera } from './systems/CameraSystem';

export function updateRuntimeWorld(world: RuntimeWorld, delta: number) {
  updatePlayerMovement(world, delta);
  applyGravity(world, delta);
  resolveWorldMovement(world, delta);
  updateCamera(world);
}
