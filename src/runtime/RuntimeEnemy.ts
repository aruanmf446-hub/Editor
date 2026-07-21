import type {
  BossAttackDefinition,
  BossPhaseDefinition,
  EnemyAnimationAssignments,
  ProjectScene,
  SceneObjectBase,
} from '../types/project';
import { intersects } from './RuntimeCollision';
import type { RuntimeBounds, RuntimeWorld } from './RuntimeWorld';
import { receivePlayerDamage } from './systems/PlayerCombatSystem';

export type RuntimeEnemyKind = 'cactus' | 'boss';
export type RuntimeEnemyMode = 'patrol' | 'chase' | 'attack' | 'hurt' | 'phase-transition' | 'dead';
export type RuntimeEnemyVisualState = 'idle' | 'walk' | 'run' | 'attack' | 'hurt' | 'phase-transition' | 'dead';

export type RuntimeEnemyState = RuntimeBounds & {
  id: string;
  sourceObjectId: string;
  assetId?: string;
  animationAssignments?: EnemyAnimationAssignments;
  activeAnimationClip?: string;
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
  activeAttackId: string | null;
  attackCursor: number;
  bossAttacks: BossAttackDefinition[];
  bossPhases: BossPhaseDefinition[];
  phaseTransitionRemaining: number;
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

export function createDefaultBossAttacks(
  damage = 2,
  reach = 110,
  cooldownMs = 1500,
  runSpeed = 95,
): BossAttackDefinition[] {
  return [
    {
      id: 'golpe-frontal',
      name: 'Golpe frontal',
      damage,
      reach,
      durationMs: BOSS_ATTACK_DURATION * 1000,
      activeStartMs: 180,
      activeEndMs: 360,
      cooldownMs,
      minimumPhase: 1,
    },
    {
      id: 'investida',
      name: 'Investida',
      damage: damage + 1,
      reach: Math.max(reach * 2.2, 220),
      durationMs: 900,
      activeStartMs: 260,
      activeEndMs: 650,
      cooldownMs: Math.round(cooldownMs * 1.35),
      minimumPhase: 2,
      dashSpeed: Math.max(runSpeed * 1.65, 160),
    },
  ];
}

export function createDefaultBossPhases(count = 2): BossPhaseDefinition[] {
  const phaseCount = Math.max(1, Math.floor(count));
  return Array.from({ length: phaseCount }, (_, index) => {
    const phase = index + 1;
    return {
      id: `fase-${phase}`,
      name: `Fase ${phase}`,
      healthThreshold: index === 0 ? 1 : (phaseCount - index) / phaseCount,
      speedMultiplier: 1 + index * 0.25,
      damageMultiplier: 1 + index * 0.2,
      cooldownMultiplier: Math.max(0.45, 1 - index * 0.18),
      enabledAttackIds: phase === 1 ? ['golpe-frontal'] : ['golpe-frontal', 'investida'],
      transitionDurationMs: index === 0 ? 0 : 500,
    };
  });
}

function sanitizeBossAttacks(object: SceneObjectBase, runSpeed: number, reach: number, damage: number, cooldownMs: number): BossAttackDefinition[] {
  const source = object.bossAttacks?.length
    ? object.bossAttacks
    : createDefaultBossAttacks(damage, reach, cooldownMs, runSpeed);
  return source.map((attack, index) => {
    const durationMs = Math.max(80, finiteOr(attack.durationMs, BOSS_ATTACK_DURATION * 1000));
    const activeStartMs = clamp(finiteOr(attack.activeStartMs, durationMs * 0.32), 0, durationMs);
    const activeEndMs = clamp(finiteOr(attack.activeEndMs, durationMs * 0.68), activeStartMs, durationMs);
    return {
      id: attack.id?.trim() || `ataque-${index + 1}`,
      name: attack.name?.trim() || `Ataque ${index + 1}`,
      animationClip: attack.animationClip?.trim() || undefined,
      damage: Math.max(0, finiteOr(attack.damage, damage)),
      reach: Math.max(0, finiteOr(attack.reach, reach)),
      durationMs,
      activeStartMs,
      activeEndMs,
      cooldownMs: Math.max(0, finiteOr(attack.cooldownMs, cooldownMs)),
      minimumPhase: Math.max(1, Math.floor(finiteOr(attack.minimumPhase, 1))),
      dashSpeed: Math.max(0, finiteOr(attack.dashSpeed, 0)) || undefined,
    };
  });
}

function sanitizeBossPhases(object: SceneObjectBase, count: number, attackIds: string[]): BossPhaseDefinition[] {
  const source = object.bossPhases?.length ? object.bossPhases : createDefaultBossPhases(count);
  return source.map((phase, index) => ({
    id: phase.id?.trim() || `fase-${index + 1}`,
    name: phase.name?.trim() || `Fase ${index + 1}`,
    healthThreshold: clamp(finiteOr(phase.healthThreshold, index === 0 ? 1 : 0.5), 0, 1),
    speedMultiplier: Math.max(0, finiteOr(phase.speedMultiplier, 1)),
    damageMultiplier: Math.max(0, finiteOr(phase.damageMultiplier, 1)),
    cooldownMultiplier: Math.max(0.05, finiteOr(phase.cooldownMultiplier, 1)),
    enabledAttackIds: (phase.enabledAttackIds?.length ? phase.enabledAttackIds : attackIds).filter((id) => attackIds.includes(id)),
    transitionDurationMs: Math.max(0, finiteOr(phase.transitionDurationMs, index === 0 ? 0 : 500)),
  })).sort((a, b) => b.healthThreshold - a.healthThreshold);
}

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
  const health = Math.max(1, Math.floor(kind === 'boss' ? finiteOr(object.bossHealth, 20) : finiteOr(object.enemyHealth, 3)));
  const configuredPhaseCount = kind === 'boss' ? Math.max(1, Math.floor(finiteOr(object.bossPhaseCount, 2))) : 1;
  const baseRunSpeed = Math.max(0, finiteOr(object.runSpeed, kind === 'boss' ? 95 : 150));
  const attackDistance = Math.max(0, finiteOr(object.attackDistance, kind === 'boss' ? Math.max(110, width * 0.55) : 90));
  const baseDamage = Math.max(0, finiteOr(object.damage, kind === 'boss' ? 2 : 1));
  const cooldownMs = Math.max(0, finiteOr(object.attackCooldownMs, kind === 'boss' ? 1500 : 1200));
  const bossAttacks = kind === 'boss' ? sanitizeBossAttacks(object, baseRunSpeed, attackDistance, baseDamage, cooldownMs) : [];
  const bossPhases = kind === 'boss' ? sanitizeBossPhases(object, configuredPhaseCount, bossAttacks.map((attack) => attack.id)) : [];
  const phaseCount = kind === 'boss' ? Math.max(1, bossPhases.length) : 1;

  return {
    id: object.id,
    sourceObjectId: object.id,
    assetId: object.assetId,
    animationAssignments: object.enemyAnimationAssignments,
    activeAnimationClip: undefined,
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
    baseRunSpeed,
    attackDistance,
    baseDamage,
    baseAttackCooldown: cooldownMs / 1000,
    attackCooldownRemaining: 0,
    attackElapsed: 0,
    attackDamageApplied: false,
    activeAttackId: null,
    attackCursor: 0,
    bossAttacks,
    bossPhases,
    phaseTransitionRemaining: 0,
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
  return Math.abs(playerCenter - enemyCenter) <= enemy.visionDistance
    && verticalGap(enemy, player) <= Math.max(enemy.height, player.height);
}

function faceTarget(enemy: RuntimeEnemyState, targetX: number): void {
  const center = enemy.x + enemy.width / 2;
  if (targetX < center) enemy.direction = 'left';
  else if (targetX > center) enemy.direction = 'right';
}

function solidObstacleAt(world: RuntimeWorld, candidate: RuntimeBounds): RuntimeBounds | null {
  return world.platforms.find((platform) => !platform.oneWay && intersects(candidate, platform)) ?? null;
}

function currentPhaseDefinition(enemy: RuntimeEnemyState): BossPhaseDefinition | undefined {
  return enemy.kind === 'boss' ? enemy.bossPhases[Math.max(0, enemy.phase - 1)] : undefined;
}

function phaseSpeed(enemy: RuntimeEnemyState): number {
  return enemy.baseRunSpeed * (currentPhaseDefinition(enemy)?.speedMultiplier ?? 1);
}

function activeBossAttack(enemy: RuntimeEnemyState): BossAttackDefinition | undefined {
  return enemy.activeAttackId ? enemy.bossAttacks.find((attack) => attack.id === enemy.activeAttackId) : undefined;
}

function phaseDamage(enemy: RuntimeEnemyState, attack?: BossAttackDefinition): number {
  const base = attack?.damage ?? enemy.baseDamage;
  return base * (currentPhaseDefinition(enemy)?.damageMultiplier ?? 1);
}

function phaseCooldown(enemy: RuntimeEnemyState, attack?: BossAttackDefinition): number {
  const base = attack ? attack.cooldownMs / 1000 : enemy.baseAttackCooldown;
  return base * (currentPhaseDefinition(enemy)?.cooldownMultiplier ?? 1);
}

function resolveBossPhase(enemy: RuntimeEnemyState): number {
  if (enemy.kind !== 'boss' || enemy.health <= 0) return enemy.phase;
  const ratio = enemy.health / enemy.maxHealth;
  let resolved = 1;
  enemy.bossPhases.forEach((phase, index) => {
    if (ratio <= phase.healthThreshold + Number.EPSILON) resolved = index + 1;
  });
  return clamp(resolved, 1, enemy.phaseCount);
}

function beginPhaseTransition(enemy: RuntimeEnemyState, nextPhase: number): void {
  enemy.phase = nextPhase;
  const phase = currentPhaseDefinition(enemy);
  const duration = Math.max(0, (phase?.transitionDurationMs ?? 0) / 1000);
  if (duration <= 0) return;
  enemy.mode = 'phase-transition';
  enemy.visualState = 'phase-transition';
  enemy.phaseTransitionRemaining = duration;
  enemy.velocityX = 0;
  enemy.activeAttackId = null;
  enemy.activeAnimationClip = enemy.animationAssignments?.['phase-transition'];
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

function enabledBossAttacks(enemy: RuntimeEnemyState): BossAttackDefinition[] {
  const phase = currentPhaseDefinition(enemy);
  const enabled = phase?.enabledAttackIds.length ? new Set(phase.enabledAttackIds) : null;
  return enemy.bossAttacks.filter((attack) => (attack.minimumPhase ?? 1) <= enemy.phase && (!enabled || enabled.has(attack.id)));
}

function chooseBossAttack(enemy: RuntimeEnemyState, gap: number): BossAttackDefinition | undefined {
  const available = enabledBossAttacks(enemy).filter((attack) => gap <= attack.reach);
  if (!available.length) return undefined;
  const selected = available[enemy.attackCursor % available.length];
  enemy.attackCursor = (enemy.attackCursor + 1) % Math.max(1, available.length);
  return selected;
}

function beginAttack(enemy: RuntimeEnemyState, attack?: BossAttackDefinition): void {
  enemy.mode = 'attack';
  enemy.visualState = 'attack';
  enemy.velocityX = 0;
  enemy.attackElapsed = 0;
  enemy.attackDamageApplied = false;
  enemy.activeAttackId = attack?.id ?? null;
  enemy.activeAnimationClip = attack?.animationClip;
}

function updateAttack(world: RuntimeWorld, enemy: RuntimeEnemyState, delta: number): void {
  const playerCenter = world.player.x + world.player.width / 2;
  faceTarget(enemy, playerCenter);
  const attack = activeBossAttack(enemy);
  const duration = enemy.kind === 'boss' ? Math.max(0.08, (attack?.durationMs ?? BOSS_ATTACK_DURATION * 1000) / 1000) : ATTACK_DURATION;
  const activeStart = enemy.kind === 'boss' ? (attack?.activeStartMs ?? duration * 1000 * ATTACK_HIT_RATIO) / 1000 : duration * ATTACK_HIT_RATIO;
  const activeEnd = enemy.kind === 'boss' ? (attack?.activeEndMs ?? activeStart * 1000) / 1000 : activeStart;
  const previousElapsed = enemy.attackElapsed;
  enemy.attackElapsed = Math.min(duration, previousElapsed + delta);

  if (attack?.dashSpeed && enemy.attackElapsed <= activeEnd) {
    moveEnemy(world, enemy, enemy.direction, attack.dashSpeed, delta, false);
  } else {
    enemy.velocityX = 0;
  }

  if (!enemy.attackDamageApplied && previousElapsed < activeEnd && enemy.attackElapsed >= activeStart) {
    const reach = attack?.reach ?? enemy.attackDistance;
    const inRange = horizontalGap(enemy, world.player) <= reach
      && verticalGap(enemy, world.player) <= Math.max(enemy.height, world.player.height);
    if (inRange) receivePlayerDamage(world, { amount: phaseDamage(enemy, attack), sourceX: enemy.x + enemy.width / 2, damageType: 'physical' });
    enemy.attackDamageApplied = true;
  }

  if (enemy.attackElapsed < duration) return;
  enemy.attackElapsed = 0;
  enemy.attackCooldownRemaining = phaseCooldown(enemy, attack);
  enemy.activeAttackId = null;
  enemy.activeAnimationClip = undefined;
  enemy.mode = canSeePlayer(world, enemy) ? 'chase' : 'patrol';
  enemy.visualState = enemy.mode === 'chase' ? 'run' : 'walk';
}

function updatePhaseTransition(world: RuntimeWorld, enemy: RuntimeEnemyState, delta: number): void {
  enemy.velocityX = 0;
  enemy.phaseTransitionRemaining = Math.max(0, enemy.phaseTransitionRemaining - delta);
  if (enemy.phaseTransitionRemaining > 0) return;
  enemy.activeAnimationClip = undefined;
  enemy.mode = canSeePlayer(world, enemy) ? 'chase' : 'patrol';
  enemy.visualState = enemy.mode === 'chase' ? 'run' : (enemy.walkSpeed > 0 ? 'walk' : 'idle');
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
  const attack = enemy.kind === 'boss' ? chooseBossAttack(enemy, gap) : undefined;
  const canAttack = enemy.kind === 'boss' ? Boolean(attack) : gap <= enemy.attackDistance;
  if (canAttack) {
    enemy.velocityX = 0;
    if (enemy.attackCooldownRemaining === 0) beginAttack(enemy, attack);
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
  if (enemy.health === 0) {
    enemy.mode = 'dead';
    enemy.visualState = 'dead';
    enemy.deathRemaining = enemy.kind === 'boss' ? BOSS_DEATH_DURATION : CACTUS_DEATH_DURATION;
    enemy.attackElapsed = 0;
    enemy.attackDamageApplied = true;
    enemy.activeAttackId = null;
    enemy.activeAnimationClip = undefined;
    enemy.velocityX = 0;
    return;
  }
  const nextPhase = resolveBossPhase(enemy);
  if (nextPhase > enemy.phase) {
    beginPhaseTransition(enemy, nextPhase);
    if (enemy.mode === 'phase-transition') return;
  }
  enemy.mode = 'hurt';
  enemy.visualState = 'hurt';
  enemy.hurtRemaining = ENEMY_HURT_DURATION;
  enemy.attackElapsed = 0;
  enemy.attackDamageApplied = true;
  enemy.activeAttackId = null;
  enemy.activeAnimationClip = undefined;
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
    if (enemy.mode !== 'dead' && enemy.mode !== 'phase-transition') applyPlayerAttack(world, enemy);
    if (enemy.mode === 'dead') { updateDead(world, enemy, delta); continue; }
    if (enemy.mode === 'phase-transition') { updatePhaseTransition(world, enemy, delta); continue; }
    if (enemy.mode === 'hurt') { updateHurt(world, enemy, delta); continue; }
    if (enemy.mode === 'attack') { updateAttack(world, enemy, delta); continue; }
    if (canSeePlayer(world, enemy)) chase(world, enemy, delta);
    else patrol(world, enemy, delta);
  }
}
