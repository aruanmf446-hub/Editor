import type { ProjectScene, SceneObjectBase } from '../types/project';
import { intersects } from './RuntimeCollision';
import type { RuntimeBounds, RuntimeWorld } from './RuntimeWorld';
import { receivePlayerDamage } from './systems/PlayerCombatSystem';

export type RuntimeEnemyMode = 'patrol' | 'chase' | 'attack';
export type RuntimeEnemyVisualState = 'idle' | 'walk' | 'run' | 'attack';

export type RuntimeEnemyState = RuntimeBounds & {
  id: string;
  sourceObjectId: string;
  assetId?: string;
  previousX: number;
  previousY: number;
  renderPreviousX: number;
  renderPreviousY: number;
  spawnX: number;
  spawnY: number;
  direction: 'left' | 'right';
  patrolLeft: number;
  patrolRight: number;
  visionDistance: number;
  walkSpeed: number;
  runSpeed: number;
  attackDistance: number;
  damage: number;
  attackCooldownDuration: number;
  attackCooldownRemaining: number;
  attackElapsed: number;
  attackDamageApplied: boolean;
  mode: RuntimeEnemyMode;
  visualState: RuntimeEnemyVisualState;
  velocityX: number;
};

const ATTACK_DURATION = 0.42;
const ATTACK_HIT_TIME = 0.18;
const MAX_MOVEMENT_STEP = 8;

const finiteOr = (value: number | undefined, fallback: number) => Number.isFinite(value) ? Number(value) : fallback;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function createEnemy(object: SceneObjectBase, scene: ProjectScene): RuntimeEnemyState {
  const width = Math.max(1, object.transform.width);
  const height = Math.max(1, object.transform.height);
  const maxX = Math.max(0, scene.width - width);
  const spawnX = clamp(object.transform.x, 0, maxX);
  const configuredLeft = finiteOr(object.patrolLeft, spawnX - 160);
  const configuredRight = finiteOr(object.patrolRight, spawnX + 160);

  // O ponto colocado no editor sempre faz parte da rota. Isso impede que um
  // valor antigo de patrulha teleporte o inimigo assim que o teste começa.
  const patrolLeft = clamp(Math.min(configuredLeft, configuredRight, spawnX), 0, maxX);
  const patrolRight = clamp(Math.max(configuredLeft, configuredRight, spawnX), patrolLeft, maxX);

  return {
    id: object.id,
    sourceObjectId: object.id,
    assetId: object.assetId,
    x: spawnX,
    y: object.transform.y,
    previousX: spawnX,
    previousY: object.transform.y,
    renderPreviousX: spawnX,
    renderPreviousY: object.transform.y,
    spawnX,
    spawnY: object.transform.y,
    width,
    height,
    direction: object.direction ?? 'left',
    patrolLeft,
    patrolRight,
    visionDistance: Math.max(0, finiteOr(object.visionDistance, 420)),
    walkSpeed: Math.max(0, finiteOr(object.walkSpeed, 70)),
    runSpeed: Math.max(0, finiteOr(object.runSpeed, 150)),
    attackDistance: Math.max(0, finiteOr(object.attackDistance, 90)),
    damage: Math.max(0, finiteOr(object.damage, 1)),
    attackCooldownDuration: Math.max(0, finiteOr(object.attackCooldownMs, 1200) / 1000),
    attackCooldownRemaining: 0,
    attackElapsed: 0,
    attackDamageApplied: false,
    mode: 'patrol',
    visualState: 'walk',
    velocityX: 0,
  };
}

export function createRuntimeEnemies(scene: ProjectScene): RuntimeEnemyState[] {
  return scene.objects
    .filter((object) => object.type === 'enemy-cactus' && object.visible && !object.editorOnly)
    .map((object) => createEnemy(object, scene));
}

function horizontalGap(a: RuntimeBounds, b: RuntimeBounds): number {
  if (a.x + a.width < b.x) return b.x - (a.x + a.width);
  if (b.x + b.width < a.x) return a.x - (b.x + b.width);
  return 0;
}

function verticalGap(a: RuntimeBounds, b: RuntimeBounds): number {
  if (a.y + a.height < b.y) return b.y - (a.y + a.height);
  if (b.y + b.height < a.y) return a.y - (b.y + b.height);
  return 0;
}

function canSeePlayer(world: RuntimeWorld, enemy: RuntimeEnemyState): boolean {
  const player = world.player;
  if (player.mode === 'dead') return false;
  const enemyCenter = enemy.x + enemy.width / 2;
  const playerCenter = player.x + player.width / 2;
  const closeHorizontally = Math.abs(playerCenter - enemyCenter) <= enemy.visionDistance;
  const closeVertically = verticalGap(enemy, player) <= Math.max(enemy.height, player.height);
  return closeHorizontally && closeVertically;
}

function faceTarget(enemy: RuntimeEnemyState, targetX: number): void {
  const center = enemy.x + enemy.width / 2;
  if (targetX < center) enemy.direction = 'left';
  else if (targetX > center) enemy.direction = 'right';
}

function solidObstacleAt(world: RuntimeWorld, candidate: RuntimeBounds): RuntimeBounds | null {
  return world.platforms.find((platform) => !platform.oneWay && intersects(candidate, platform)) ?? null;
}

function moveEnemy(
  world: RuntimeWorld,
  enemy: RuntimeEnemyState,
  direction: 'left' | 'right',
  speed: number,
  delta: number,
  patrolOnly: boolean,
): boolean {
  enemy.direction = direction;
  const sign = direction === 'right' ? 1 : -1;
  const displacement = sign * speed * delta;
  const maxStep = Math.min(MAX_MOVEMENT_STEP, Math.max(1, enemy.width * 0.25));
  const steps = Math.max(1, Math.ceil(Math.abs(displacement) / maxStep));
  const step = displacement / steps;
  const sceneMaxX = Math.max(0, world.scene.width - enemy.width);
  let blocked = false;

  for (let index = 0; index < steps; index += 1) {
    const previousX = enemy.x;
    let nextX = clamp(previousX + step, 0, sceneMaxX);
    if (patrolOnly) nextX = clamp(nextX, enemy.patrolLeft, enemy.patrolRight);

    const candidate: RuntimeBounds = { x: nextX, y: enemy.y, width: enemy.width, height: enemy.height };
    const obstacle = solidObstacleAt(world, candidate);
    if (obstacle) {
      nextX = step > 0 ? obstacle.x - enemy.width : obstacle.x + obstacle.width;
      nextX = clamp(nextX, 0, sceneMaxX);
      if (patrolOnly) nextX = clamp(nextX, enemy.patrolLeft, enemy.patrolRight);
      blocked = true;
    }

    enemy.previousX = previousX;
    enemy.x = nextX;
    if (blocked || nextX === previousX) break;
  }

  enemy.velocityX = blocked ? 0 : sign * speed;
  return blocked;
}

function beginAttack(enemy: RuntimeEnemyState): void {
  enemy.mode = 'attack';
  enemy.visualState = 'attack';
  enemy.velocityX = 0;
  enemy.attackElapsed = 0;
  enemy.attackDamageApplied = false;
}

function updateAttack(world: RuntimeWorld, enemy: RuntimeEnemyState, delta: number): void {
  const playerCenter = world.player.x + world.player.width / 2;
  faceTarget(enemy, playerCenter);
  enemy.velocityX = 0;

  const previousElapsed = enemy.attackElapsed;
  enemy.attackElapsed = Math.min(ATTACK_DURATION, previousElapsed + delta);
  if (!enemy.attackDamageApplied && previousElapsed < ATTACK_HIT_TIME && enemy.attackElapsed >= ATTACK_HIT_TIME) {
    const inRange = horizontalGap(enemy, world.player) <= enemy.attackDistance
      && verticalGap(enemy, world.player) <= Math.max(enemy.height, world.player.height);
    if (inRange) {
      receivePlayerDamage(world, {
        amount: enemy.damage,
        sourceX: enemy.x + enemy.width / 2,
        damageType: 'physical',
      });
    }
    enemy.attackDamageApplied = true;
  }

  if (enemy.attackElapsed < ATTACK_DURATION) return;
  enemy.attackElapsed = 0;
  enemy.attackCooldownRemaining = enemy.attackCooldownDuration;
  enemy.mode = canSeePlayer(world, enemy) ? 'chase' : 'patrol';
  enemy.visualState = enemy.mode === 'chase' ? 'run' : 'walk';
}

function patrol(world: RuntimeWorld, enemy: RuntimeEnemyState, delta: number): void {
  enemy.mode = 'patrol';
  enemy.visualState = 'walk';

  let direction = enemy.direction;
  if (enemy.x < enemy.patrolLeft) direction = 'right';
  else if (enemy.x > enemy.patrolRight) direction = 'left';
  else if (enemy.x <= enemy.patrolLeft && direction === 'left') direction = 'right';
  else if (enemy.x >= enemy.patrolRight && direction === 'right') direction = 'left';

  const blocked = moveEnemy(world, enemy, direction, enemy.walkSpeed, delta, true);
  if (blocked) enemy.direction = direction === 'right' ? 'left' : 'right';
}

function chase(world: RuntimeWorld, enemy: RuntimeEnemyState, delta: number): void {
  const player = world.player;
  const playerCenter = player.x + player.width / 2;
  faceTarget(enemy, playerCenter);
  const gap = horizontalGap(enemy, player);

  if (gap <= enemy.attackDistance) {
    enemy.velocityX = 0;
    if (enemy.attackCooldownRemaining === 0) beginAttack(enemy);
    else {
      enemy.mode = 'chase';
      enemy.visualState = 'idle';
    }
    return;
  }

  enemy.mode = 'chase';
  enemy.visualState = 'run';
  moveEnemy(world, enemy, enemy.direction, enemy.runSpeed, delta, false);
}

export function updateRuntimeEnemies(world: RuntimeWorld, delta: number): void {
  for (const enemy of world.enemies) {
    enemy.renderPreviousX = enemy.x;
    enemy.renderPreviousY = enemy.y;
    enemy.previousX = enemy.x;
    enemy.previousY = enemy.y;
    enemy.attackCooldownRemaining = Math.max(0, enemy.attackCooldownRemaining - delta);

    if (enemy.mode === 'attack') {
      updateAttack(world, enemy, delta);
      continue;
    }

    if (canSeePlayer(world, enemy)) chase(world, enemy, delta);
    else patrol(world, enemy, delta);
  }
}
