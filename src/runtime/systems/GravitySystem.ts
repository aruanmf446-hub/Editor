import { RUNTIME_CONFIG } from '../RuntimeConfig';
import type { RuntimeWorld } from '../RuntimeWorld';

export function applyGravity(world: RuntimeWorld, delta: number) {
  world.player.velocityY = Math.min(world.player.velocityY + RUNTIME_CONFIG.gravity * delta, RUNTIME_CONFIG.maxFallSpeed);
}
