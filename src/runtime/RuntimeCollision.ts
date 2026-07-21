import { RUNTIME_CONFIG } from './RuntimeConfig';
import type { RuntimePlayerState } from './RuntimePlayer';
import type { RuntimeBounds, RuntimePlatformState } from './RuntimeWorld';

export const intersects = (a: RuntimeBounds, b: RuntimeBounds) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

export const getMovementSteps = (displacement: number, player?: RuntimePlayerState) => {
  const maxStep = player
    ? Math.min(RUNTIME_CONFIG.maxMovementStep, Math.max(1, player.width * 0.25), Math.max(1, player.height * 0.25))
    : RUNTIME_CONFIG.maxMovementStep;
  return Math.max(1, Math.ceil(Math.abs(displacement) / maxStep));
};

export function moveHorizontal(player: RuntimePlayerState, platforms: RuntimePlatformState[], delta: number, sceneWidth: number) {
  const displacement = player.velocityX * delta;
  const steps = getMovementSteps(displacement, player);
  const step = displacement / steps;
  for (let index = 0; index < steps; index += 1) {
    const previous: RuntimeBounds = { x: player.x, y: player.y, width: player.width, height: player.height };
    player.previousX = previous.x;
    player.x += step;
    for (const obstacle of platforms) {
      if (obstacle.oneWay || !intersects(player, obstacle)) continue;
      const previousRight = previous.x + previous.width;
      const obstacleRight = obstacle.x + obstacle.width;
      if (step > 0 && previousRight <= obstacle.x + RUNTIME_CONFIG.collisionEpsilon) {
        player.x = obstacle.x - player.width; player.lastCollisionSide = 'right';
      } else if (step < 0 && previous.x >= obstacleRight - RUNTIME_CONFIG.collisionEpsilon) {
        player.x = obstacleRight; player.lastCollisionSide = 'left';
      } else {
        player.x = step > 0 ? obstacle.x - player.width : obstacleRight;
        player.lastCollisionSide = step > 0 ? 'right' : 'left';
      }
      player.velocityX = 0;
      break;
    }
  }
  player.x = Math.max(0, Math.min(player.x, Math.max(0, sceneWidth - player.width)));
}

export function moveVertical(player: RuntimePlayerState, platforms: RuntimePlatformState[], delta: number) {
  const displacement = player.velocityY * delta;
  const steps = getMovementSteps(displacement, player);
  const step = displacement / steps;
  player.grounded = false;
  for (let index = 0; index < steps; index += 1) {
    const previous: RuntimeBounds = { x: player.x, y: player.y, width: player.width, height: player.height };
    player.previousY = previous.y;
    player.y += step;
    for (const obstacle of platforms) {
      const previousBottom = previous.y + previous.height;
      const currentBottom = player.y + player.height;
      const overlapsX = player.x < obstacle.x + obstacle.width && player.x + player.width > obstacle.x;
      if (obstacle.oneWay) {
        const crossesTop = step >= 0 && overlapsX && previousBottom <= obstacle.y + RUNTIME_CONFIG.collisionEpsilon && currentBottom >= obstacle.y;
        if (!crossesTop) continue;
        player.y = obstacle.y - player.height; player.velocityY = 0; player.grounded = true; player.lastCollisionSide = 'bottom';
        break;
      }
      if (!intersects(player, obstacle)) continue;
      const obstacleBottom = obstacle.y + obstacle.height;
      if (step > 0 && previousBottom <= obstacle.y + RUNTIME_CONFIG.collisionEpsilon) {
        player.y = obstacle.y - player.height; player.velocityY = 0; player.grounded = true; player.lastCollisionSide = 'bottom';
      } else if (step < 0 && previous.y >= obstacleBottom - RUNTIME_CONFIG.collisionEpsilon) {
        player.y = obstacleBottom; player.velocityY = 0; player.lastCollisionSide = 'top';
      }
      break;
    }
  }
}

export function probeGround(player: RuntimePlayerState, platforms: RuntimePlatformState[]): boolean {
  if (player.velocityY < 0) return false;
  const feet = player.y + player.height;
  const probeBottom = feet + RUNTIME_CONFIG.groundProbeDistance;
  return platforms.some((platform) => {
    const overlapsX = player.x < platform.x + platform.width && player.x + player.width > platform.x;
    if (!overlapsX) return false;
    if (platform.oneWay && feet > platform.y + RUNTIME_CONFIG.collisionEpsilon) return false;
    return feet <= platform.y + RUNTIME_CONFIG.collisionEpsilon && probeBottom >= platform.y;
  });
}