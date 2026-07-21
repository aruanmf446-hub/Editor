import type { RuntimeBounds, RuntimePlatformState, RuntimePlayerState } from './RuntimeWorld';

export const intersects = (a: RuntimeBounds, b: RuntimeBounds) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

export function canStand(player: RuntimePlayerState, platforms: RuntimePlatformState[], standingHeight: number): boolean {
  const candidate = { x: player.x, y: player.y + player.height - standingHeight, width: player.width, height: standingHeight };
  return !platforms.some((platform) => !platform.oneWay && intersects(candidate, platform));
}

export function moveHorizontal(player: RuntimePlayerState, platforms: RuntimePlatformState[], delta: number, sceneWidth: number) {
  player.x += player.velocityX * delta;
  for (const platform of platforms) {
    if (platform.oneWay || !intersects(player, platform)) continue;
    if (player.velocityX > 0) player.x = platform.x - player.width;
    else if (player.velocityX < 0) player.x = platform.x + platform.width;
    player.velocityX = 0;
  }
  player.x = Math.max(0, Math.min(player.x, sceneWidth - player.width));
}

export function moveVertical(player: RuntimePlayerState, platforms: RuntimePlatformState[], delta: number) {
  const previousBottom = player.y + player.height;
  player.y += player.velocityY * delta;
  player.grounded = false;
  for (const platform of platforms) {
    if (platform.oneWay) {
      const currentBottom = player.y + player.height;
      const crossesTop = player.velocityY >= 0 && previousBottom <= platform.y + 1 && currentBottom >= platform.y;
      const overlapsX = player.x < platform.x + platform.width && player.x + player.width > platform.x;
      if (crossesTop && overlapsX) {
        player.y = platform.y - player.height; player.velocityY = 0; player.grounded = true;
      }
      continue;
    }
    if (!intersects(player, platform)) continue;
    if (player.velocityY > 0) { player.y = platform.y - player.height; player.grounded = true; }
    else if (player.velocityY < 0) player.y = platform.y + platform.height;
    player.velocityY = 0;
  }
}
