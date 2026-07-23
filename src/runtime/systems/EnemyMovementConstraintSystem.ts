import type { RuntimeEnemyState } from '../RuntimeEnemy';
import type { RuntimePlatformState, RuntimeWorld } from '../RuntimeWorld';
import type { SceneObjectBase } from '../../types/project';

const SUPPORT_TOLERANCE = 4;
const EPSILON = 0.01;

type PursuitVillain = SceneObjectBase<'enemy-cactus'> & { pursuitMode?: boolean };

function overlapsAtX(enemy: RuntimeEnemyState, platform: RuntimePlatformState, x: number): boolean {
  return x + enemy.width > platform.x + EPSILON
    && x < platform.x + platform.width - EPSILON;
}

function supportingPlatform(world: RuntimeWorld, enemy: RuntimeEnemyState): RuntimePlatformState | undefined {
  const feetY = enemy.y + enemy.height;
  return world.platforms
    .filter((platform) => overlapsAtX(enemy, platform, enemy.previousX))
    .filter((platform) => Math.abs(feetY - platform.y) <= SUPPORT_TOLERANCE)
    .sort((a, b) => a.y - b.y)[0];
}

function isPursuitMode(world: RuntimeWorld, enemy: RuntimeEnemyState): boolean {
  const source = world.scene.objects.find((object) => object.id === enemy.sourceObjectId);
  return source?.type === 'enemy-cactus' && Boolean((source as PursuitVillain).pursuitMode);
}

export function constrainEnemyMovement(world: RuntimeWorld): void {
  for (const enemy of world.enemies) {
    if (enemy.removed || enemy.kind !== 'cactus') continue;

    const support = supportingPlatform(world, enemy);
    const pursuitMode = isPursuitMode(world, enemy);
    let minimumX = pursuitMode ? 0 : enemy.patrolLeft;
    let maximumX = pursuitMode ? Math.max(0, world.scene.width - enemy.width) : enemy.patrolRight;

    if (support) {
      minimumX = Math.max(minimumX, support.x);
      maximumX = Math.min(maximumX, support.x + support.width - enemy.width);
    }

    maximumX = Math.max(minimumX, maximumX);
    const constrainedX = Math.min(maximumX, Math.max(minimumX, enemy.x));
    if (Math.abs(constrainedX - enemy.x) <= EPSILON) continue;

    enemy.x = constrainedX;
    enemy.velocityX = 0;
    if (enemy.mode === 'chase') enemy.visualState = 'idle';
  }
}
