import type { EnemyAnimationAssignments, ProjectScene, SceneObjectBase } from '../types/project';
import { intersects } from './RuntimeCollision';
import type { RuntimeBounds, RuntimeWorld } from './RuntimeWorld';
import { receivePlayerDamage } from './systems/PlayerCombatSystem';

export type RuntimeEnemyKind = 'cactus' | 'boss';
export type RuntimeEnemyMode = 'patrol' | 'chase' | 'attack' | 'hurt' | 'dead';
export type RuntimeEnemyVisualState = 'idle' | 'walk' | 'run' | 'attack' | 'hurt' | 'dead';

export type RuntimeEnemyState = RuntimeBounds & {
  id: string;
  sourceObjectId: string;
  assetId?: string;
  animationAssignments?: EnemyAnimationAssignments;
  kind: RuntimeEnemyKind;
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
  baseRunSpeed: number;
  attackDistance: number;
  baseDamage: number;
  baseAttackCooldown: number;
  attackCooldownRemaining: number;
  attackElapsed: number;
  attackDamageApplied: boolean;
  health: number;
  maxHealth: number;
  phase: number;
  phaseCount: number;
  hurtRemaining: number;
  deathRemaining: number;
  lastHitByAttackSerial: number;
  removed: boolean;
  mode: RuntimeEnemyMode;
  visualState: RuntimeEnemyVisualState;
  velocityX: number;
};

const ATTACK_DURATION = 0.42;
const BOSS_ATTACK_DURATION = 0.58;
const ATTACK_HIT_RATIO = 0.43;
const ENEMY_HURT_DURATION = 0.2;
const CACTUS_DEATH_DURATION = 0.45;
const BOSS_DEATH_DURATION = 0.9;
const MAX_MOVEMENT_STEP = 8;

const finiteOr = (value: number | undefined, fallback: number) => Number.isFinite(value) ? Number(value) : fallback;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function createEnemy(object: SceneObjectBase, scene: ProjectScene): RuntimeEnemyState {
  const kind: RuntimeEnemyKind = object.type === 'boss' ? 'boss' : 'cactus';
  const width = Math.max(1, object.transform.width);
  const height = Math.max(1, object.transform.height);
  const maxX = Math.max(0, scene.width - width);
  const spawnX = clamp(object.transform.x, 0, maxX);
  const configuredLeft = finiteOr(object.patrolLeft, kind === 'boss' ? 0 : spawnX - 160);
  const configuredRight = finiteOr(object.patrolRight, kind === 'boss' ? maxX : spawnX + 160);
  const patrolLeft = clamp(Math.min(configuredLeft, configuredRight, spawnX), 0, maxX);
  const patrolRight = clamp(Math.max(configuredLeft, configuredRight, spawnX), patrolLeft, maxX);
  const health = Math.max(1, Math.floor(kind === 'boss'
    ? finiteOr(object.bossHealth, 20)
    : finiteOr(object.enemyHealth, 3)));
  const phaseCount = kind === 'boss' ? Math.max(1, Math.floor(finiteOr(object.bossPhaseCount, 2))) : 1;

  return {
    id: object.id,
    sourceObjectId: object.id,
    assetId: object.assetId,
    animationAssignments: object.enemyAnimationAssignments,
    kind,
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
    visionDistance: Math.max(0, finiteOr(object.visionDistance, kind === 'boss' ? scene.width * 2 : 420)),
    walkSpeed: Math.max(0, finiteOr(object.walkSpeed, kind === 'boss' ? 0 : 70)),
    baseRunSpeed: Math.max(0, finiteOr(object.runSpeed, kind === 'boss' ? 95 : 150)),
    attackDistance: Math.max(0, finiteOr(object.attackDistance, kind === 'boss' ? Math.max(110, width * 0.55) : 90)),
    baseDamage: Math.max(0, finiteOr(object.damage, kind === 'boss' ? 2 : 1)),
    baseAttackCooldown: Math.max(0, finiteOr(object.attackCooldownMs, kind === 'boss' ? 1500 : 1200) / 1000),
    attackCooldownRemaining: 0,
    attackElapsed: 0,
    attackDamageApplied: false,
    health,
    maxHealth: health,
    phase: 1,
    phaseCount,
    hurtRemaining: 0,
    deathRemaining: 0,
    lastHitByAttackSerial: -1,
    removed: false,
    mode: kind === 'boss' ? 'chase' : 'patrol',
    visualState: kind === 'boss' ? 'idle' : 'walk',
    velocityX: 0,
  };
}

export function createRuntimeEnemies(scene: ProjectScene): RuntimeEnemyState[] {
  return scene.objects
    .filter((object) => (object.type === 'enemy-cactus' || object.type === 'boss') && object.visible && !object.editorOnly)
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
  if (player.mode === 'dead' || enemy.removed || enemy.mode === 'dead') return false;
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

function phaseSpeed(enemy: RuntimeEnemyState): number {
  return enemy.baseRunSpeed * (1 + (enemy.phase - 1) * 0.25);
}

function phaseDamage(enemy: RuntimeEnemyState): number {
  return enemy.baseDamage + (enemy.kind === 'boss' ? enemy.phase - 1 : 0);
}

function phaseCooldown(enemy: RuntimeEnemyState): number {
  if (enemy.kind !== 'boss') return enemy.baseAttackCooldown;
  return enemy.baseAttackCooldown * Math.max(0.4, 1 - (enemy.phase - 1) * 0.18);
}

function updateBossPhase(enemy: RuntimeEnemyState): void {
  if (enemy.kind !== 'boss' || enemy.health <= 0) return;
  const lostRatio = 1 - enemy.health / enemy.maxHealth;
  enemy.phase = Math.min(enemy.phaseCount, Math.floor(lostRatio * enemy.phaseCount) + 1);
}

function moveEnemy(world: RuntimeWorld, enemy: RuntimeEnemyState, direction: 'left' | 'right', speed: number, delta: number, patrolOnly: boolean): boolean {
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
  const duration = enemy.kind === 'boss' ? BOSS_ATTACK_DURATION : ATTACK_DURATION;
  const hitTime = duration * ATTACK_HIT_RATIO;
  const previousElapsed = enemy.attackElapsed;
  enemy.attackElapsed = Math.min(duration, previousElapsed + delta);

  if (!enemy.attackDamageApplied && previousElapsed < hitTime && enemy.attackElapsed >= hitTime) {
    const inRange = horizontalGap(enemy, world.player) <= enemy.attackDistance
      && verticalGap(enemy, world.player) <= Math.max(enemy.height, world.player.height);
    if (inRange) receivePlayerDamage(world, { amount: phaseDamage(enemy), sourceX: enemy.x + enemy.width / 2, damageType: 'physical' });
    enemy.attackDamageApplied = true;
  }

  if (enemy.attackElapsed < duration) return;
  enemy.attackElapsed = 0;
  enemy.attackCooldownRemaining = phaseCooldown(enemy);
  enemy.mode = canSeePlayer(world, enemy) ? 'chase' : 'patrol';
  enemy.visualState = enemy.mode === 'chase' ? 'run' : 'walk';
}

function patrol(world: RuntimeWorld, enemy: RuntimeEnemyState, delta: number): void {
  enemy.mode = 'patrol';
  enemy.visualState = enemy.walkSpeed > 0 ? 'walk' : 'idle';
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
    else { enemy.mode = 'chase'; enemy.visualState = 'idle'; }
    return;
  }
  enemy.mode = 'chase';
  enemy.visualState = 'run';
  moveEnemy(world, enemy, enemy.direction, phaseSpeed(enemy), delta, false);
}

function applyPlayerAttack(world: RuntimeWorld, enemy: RuntimeEnemyState): void {
  const hitbox = world.player.attackHitbox;
  const attackSerial = world.player.attackSerial;
  if (!hitbox || attackSerial <= 0 || enemy.lastHitByAttackSerial === attackSerial || !intersects(hitbox, enemy)) return;
  enemy.lastHitByAttackSerial = attackSerial;
  enemy.health = Math.max(0, enemy.health - Math.max(1, Math.floor(world.player.attack)));
  enemy.velocityX = world.player.direction === 'right' ? 110 : -110;
  updateBossPhase(enemy);
  if (enemy.health === 0) {
    enemy.mode = 'dead';
    enemy.visualState = 'dead';
    enemy.deathRemaining = enemy.kind === 'boss' ? BOSS_DEATH_DURATION : CACTUS_DEATH_DURATION;
    enemy.attackElapsed = 0;
    enemy.attackDamageApplied = true;
    enemy.velocityX = 0;
    return;
  }
  enemy.mode = 'hurt';
  enemy.visualState = 'hurt';
  enemy.hurtRemaining = ENEMY_HURT_DURATION;
  enemy.attackElapsed = 0;
  enemy.attackDamageApplied = true;
}

function updateHurt(world: RuntimeWorld, enemy: RuntimeEnemyState, delta: number): void {
  enemy.velocityX = 0;
  enemy.hurtRemaining = Math.max(0, enemy.hurtRemaining - delta);
  if (enemy.hurtRemaining > 0) return;
  enemy.mode = canSeePlayer(world, enemy) ? 'chase' : 'patrol';
  enemy.visualState = enemy.mode === 'chase' ? 'run' : (enemy.walkSpeed > 0 ? 'walk' : 'idle');
}

function isLastScene(world: RuntimeWorld): boolean {
  const ordered = [...world.project.scenes].sort((a, b) => a.order - b.order);
  return ordered.at(-1)?.id === world.scene.id;
}

function updateDead(world: RuntimeWorld, enemy: RuntimeEnemyState, delta: number): void {
  enemy.velocityX = 0;
  enemy.deathRemaining = Math.max(0, enemy.deathRemaining - delta);
  if (enemy.deathRemaining > 0) return;
  enemy.removed = true;
  if (enemy.kind !== 'boss') return;
  const livingBoss = world.enemies.some((candidate) => candidate.kind === 'boss' && !candidate.removed && candidate.health > 0);
  const hasFinish = world.scene.objects.some((object) => object.type === 'finish' && object.visible && !object.editorOnly);
  if (!livingBoss && !hasFinish && isLastScene(world)) {
    world.completed = true;
    world.paused = true;
    world.player.velocityX = 0;
    world.player.velocityY = 0;
  }
}

export function updateRuntimeEnemies(world: RuntimeWorld, delta: number): void {
  for (const enemy of world.enemies) {
    if (enemy.removed) continue;
    enemy.renderPreviousX = enemy.x;
    enemy.renderPreviousY = enemy.y;
    enemy.previousX = enemy.x;
    enemy.previousY = enemy.y;
    enemy.attackCooldownRemaining = Math.max(0, enemy.attackCooldownRemaining - delta);
    if (enemy.mode !== 'dead') applyPlayerAttack(world, enemy);
    if (enemy.mode === 'dead') { updateDead(world, enemy, delta); continue; }
    if (enemy.mode === 'hurt') { updateHurt(world, enemy, delta); continue; }
    if (enemy.mode === 'attack') { updateAttack(world, enemy, delta); continue; }
    if (canSeePlayer(world, enemy)) chase(world, enemy, delta);
    else patrol(world, enemy, delta);
  }
}
