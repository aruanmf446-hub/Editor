import { RUNTIME_CONFIG } from '../RuntimeConfig';
import type { RuntimeWorld } from '../RuntimeWorld';

export function updateCamera(world: RuntimeWorld, delta = 0) {
  const { camera, player, scene } = world;
  const maxX = Math.max(0, scene.width - camera.viewportWidth);
  const maxY = Math.max(0, scene.height - camera.viewportHeight);
  const override = world.cameraOverride;
  if (override && override.remaining > 0) {
    camera.x = Math.max(0, Math.min(override.x, maxX));
    camera.y = Math.max(0, Math.min(override.y, maxY));
    override.remaining = Math.max(0, override.remaining - Math.max(0, delta));
    if (override.remaining === 0) world.cameraOverride = null;
    return;
  }
  const targetX = Math.max(0, Math.min(player.x + player.width / 2 - camera.viewportWidth / 2, maxX));
  const targetY = Math.max(0, Math.min(player.y + player.height / 2 - camera.viewportHeight * 0.58, maxY));
  camera.x += (targetX - camera.x) * RUNTIME_CONFIG.cameraSmoothing;
  camera.y += (targetY - camera.y) * (RUNTIME_CONFIG.cameraSmoothing * 0.45);
}
