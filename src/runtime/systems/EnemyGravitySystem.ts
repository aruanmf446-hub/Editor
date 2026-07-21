import { RUNTIME_CONFIG } from '../RuntimeConfig';
import type { RuntimeEnemyState } from '../RuntimeEnemy';
import type { RuntimePlatformState, RuntimeWorld } from '../RuntimeWorld';

type EnemyVerticalState = { velocityY: number };

const verticalState = new Map<string, EnemyVerticalState>();
const EPSILON = 0.01;

function overlapsHorizontally(enemy: RuntimeEnemyState, platform: RuntimePlatformState): boolean {
  return enemy.x + enemy.width > platform.x + EPSILON
    && enemy.x < platform.x + platform.width - EPSILON;
}

function landingPlatform(
  enemy: RuntimeEnemyState,
  platforms: RuntimePlatformState[],
  previousY: number,
  nextY: number,
): RuntimePlatformState | undefined {
  const previousBottom = previousY + enemy.height;
  const nextBottom = nextY + enemy.height;
  return platforms
    .filter((platform) => overlapsHorizontally(enemy, platform))
    .filter((platform) => previousBottom <= platform.y + EPSILON && nextBottom >= platform.y - EPSILON)
    .sort((a, b) => a.y - b.y)[0];
}

function ceilingPlatform(
  enemy: RuntimeEnemyState,
  platforms: RuntimePlatformState[],
  previousY: number,
  nextY: number,
): RuntimePlatformState | undefined {
  return platforms
    .filter((platform) => !platform.oneWay && overlapsHorizontally(enemy, platform))
    .filter((platform) => previousY >= platform.y + platform.height - EPSILON && nextY <= platform.y + platform.height + EPSILON)
    .sort((a, b) => b.y - a.y)[0];
}

export function updateEnemyGravity(world: RuntimeWorld, delta: number): void {
  const activeIds = new Set<string>();

  for (const enemy of world.enemies) {
    activeIds.add(enemy.id);
    if (enemy.removed) continue;

    const state = verticalState.get(enemy.id) ?? { velocityY: 0 };
    verticalState.set(enemy.id, state);

    const previousY = enemy.y;
    state.velocityY = Math.min(
      RUNTIME_CONFIG.maxFallSpeed,
      state.velocityY + RUNTIME_CONFIG.gravity * delta,
    );
    let nextY = previousY + state.velocityY * delta;

    if (state.velocityY >= 0) {
      const platform = landingPlatform(enemy, world.platforms, previousY, nextY);
      if (platform) {
        nextY = platform.y - enemy.height;
        state.velocityY = 0;
      }
    } else {
      const platform = ceilingPlatform(enemy, world.platforms, previousY, nextY);
      if (platform) {
        nextY = platform.y + platform.height;
        state.velocityY = 0;
      }
    }

    enemy.y = nextY;
    if (enemy.y > world.scene.height + enemy.height) {
      enemy.y = enemy.spawnY;
      enemy.x = enemy.spawnX;
      enemy.previousX = enemy.spawnX;
      enemy.previousY = enemy.spawnY;
      enemy.renderPreviousX = enemy.spawnX;
      enemy.renderPreviousY = enemy.spawnY;
      state.velocityY = 0;
    }
  }

  for (const id of verticalState.keys()) {
    if (!activeIds.has(id)) verticalState.delete(id);
  }
}
