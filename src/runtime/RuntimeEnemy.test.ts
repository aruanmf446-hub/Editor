import { describe, expect, it } from 'vitest';
import {
  EL_FUEGO_PROJECT_FORMAT,
  EL_FUEGO_PROJECT_VERSION,
  type BossAttackDefinition,
  type BossPhaseDefinition,
  type ElFuegoProject,
  type ProjectScene,
  type SceneObjectBase,
} from '../types/project';
import { RUNTIME_CONFIG } from './RuntimeConfig';
import { createRuntimeEnemies, updateRuntimeEnemies } from './RuntimeEnemy';
import { createRuntimePlayer } from './RuntimePlayer';
import { createRuntimePlatforms, type RuntimeWorld } from './RuntimeWorld';

const object = (
  type: SceneObjectBase['type'],
  x: number,
  y: number,
  width: number,
  height: number,
  patch: Partial<SceneObjectBase> = {},
): SceneObjectBase => ({
  id: crypto.randomUUID(),
  sceneId: 'scene',
  type,
  name: type,
  transform: { x, y, z: 0, width, height, scaleX: 1, scaleY: 1, rotation: 0 },
  visible: true,
  locked: false,
  editorOnly: false,
  gameOnly: false,
  ...patch,
});

function createWorld(
  playerX = 700,
  enemyPatch: Partial<SceneObjectBase> = {},
  enemyType: 'enemy-cactus' | 'boss' = 'enemy-cactus',
): RuntimeWorld {
  const spawn = object('player-spawn', playerX, 300, 50, 100, {
    direction: 'right',
    initialHealth: 8,
    initialAttack: 1,
    initialDefense: 0,
  });
  const enemy = object(enemyType, 200, 300, enemyType === 'boss' ? 120 : 60, enemyType === 'boss' ? 150 : 100, {
    direction: 'right',
    patrolLeft: 100,
    patrolRight: 500,
    visionDistance: 600,
    walkSpeed: 60,
    runSpeed: 180,
    attackDistance: 35,
    damage: 2,
    attackCooldownMs: 500,
    ...enemyPatch,
  });
  const scene: ProjectScene = {
    id: 'scene',
    name: 'Cena',
    order: 0,
    width: 1000,
    height: 600,
    backgroundAssetId: null,
    background: { fit: 'cover', positionX: 50, positionY: 50, scale: 1, editorOpacity: 1 },
    objects: [spawn, enemy],
  };
  const project: ElFuegoProject = {
    format: EL_FUEGO_PROJECT_FORMAT,
    version: EL_FUEGO_PROJECT_VERSION,
    project: { id: 'project', name: 'Projeto', createdAt: '', updatedAt: '' },
    settings: { gravity: RUNTIME_CONFIG.gravity, gridSize: 16, snapEnabled: true, defaultSceneWidth: 1000, defaultSceneHeight: 600 },
    assets: [],
    scenes: [scene],
  };
  return {
    project,
    scene,
    sceneRevision: 0,
    player: createRuntimePlayer(spawn),
    enemies: createRuntimeEnemies(scene),
    pickups: [],
    pickupMemory: {},
    platforms: createRuntimePlatforms(scene),
    activeCheckpoint: null,
    camera: { x: 0, y: 0, viewportWidth: 400, viewportHeight: 300 },
    input: { left: false, right: false, jump: false, crouch: false, attack: false, defend: false, jumpPressed: false, jumpReleased: false },
    paused: false,
    completed: false,
    physicsSteps: 0,
    accumulator: 0,
    droppedPhysicsTime: 0,
  };
}

function hitEnemy(world: RuntimeWorld, serial: number, damage: number): void {
  const enemy = world.enemies[0];
  world.player.attack = damage;
  world.player.attackSerial = serial;
  world.player.attackHitbox = { x: enemy.x, y: enemy.y, width: enemy.width, height: enemy.height };
  updateRuntimeEnemies(world, 1 / 60);
}

describe('RuntimeEnemy', () => {
  it('caminha continuamente enquanto o player está fora da visão', () => {
    const world = createWorld(800, { visionDistance: 250 });
    const enemy = world.enemies[0];
    const startX = enemy.x;
    updateRuntimeEnemies(world, 1 / 60);
    expect(enemy.visualState).toBe('walk');
    expect(enemy.mode).toBe('patrol');
    expect(enemy.x).toBeGreaterThan(startX);
    expect(enemy.velocityX).toBe(enemy.walkSpeed);
  });

  it('corre em direção ao player quando ele entra no campo de visão', () => {
    const world = createWorld(430);
    const enemy = world.enemies[0];
    updateRuntimeEnemies(world, 1 / 60);
    expect(enemy.mode).toBe('chase');
    expect(enemy.visualState).toBe('run');
    expect(enemy.direction).toBe('right');
    expect(enemy.velocityX).toBe(enemy.baseRunSpeed);
  });

  it('volta a caminhar sem congelar depois de perder o player', () => {
    const world = createWorld(430, { visionDistance: 250 });
    const enemy = world.enemies[0];
    updateRuntimeEnemies(world, 1 / 60);
    expect(enemy.visualState).toBe('run');
    world.player.x = 900;
    const before = enemy.x;
    updateRuntimeEnemies(world, 1 / 60);
    expect(enemy.mode).toBe('patrol');
    expect(enemy.visualState).toBe('walk');
    expect(enemy.x).not.toBe(before);
  });

  it('aplica dano uma vez por ataque e respeita o cooldown', () => {
    const world = createWorld(270, { attackDistance: 20, damage: 2, attackCooldownMs: 600 });
    const enemy = world.enemies[0];
    const initialHealth = world.player.health;
    for (let index = 0; index < 30; index += 1) updateRuntimeEnemies(world, 1 / 60);
    expect(world.player.health).toBe(initialHealth - 2);
    expect(enemy.attackCooldownRemaining).toBeGreaterThan(0);
    const healthAfterAttack = world.player.health;
    for (let index = 0; index < 10; index += 1) updateRuntimeEnemies(world, 1 / 60);
    expect(world.player.health).toBe(healthAfterAttack);
  });

  it('não teleporta quando os limites antigos não incluem a posição colocada no editor', () => {
    const world = createWorld(900, { patrolLeft: 0, patrolRight: 50, walkSpeed: 60, visionDistance: 100 });
    const enemy = world.enemies[0];
    const startX = enemy.x;
    updateRuntimeEnemies(world, 1 / 60);
    expect(Math.abs(enemy.x - startX)).toBeLessThanOrEqual(enemy.walkSpeed / 60 + 0.001);
    expect(enemy.patrolRight).toBeGreaterThanOrEqual(startX);
  });

  it('recebe dano somente uma vez por serial de ataque e morre', () => {
    const world = createWorld(430, { enemyHealth: 3 });
    const enemy = world.enemies[0];
    hitEnemy(world, 1, 2);
    expect(enemy.health).toBe(1);
    expect(enemy.mode).toBe('hurt');
    hitEnemy(world, 1, 2);
    expect(enemy.health).toBe(1);
    hitEnemy(world, 2, 2);
    expect(enemy.health).toBe(0);
    expect(enemy.mode).toBe('dead');
    updateRuntimeEnemies(world, 1);
    expect(enemy.removed).toBe(true);
  });

  it('boss avança de fase com transição e conclui a última cena sem portal', () => {
    const world = createWorld(430, { bossHealth: 12, bossPhaseCount: 3, runSpeed: 100 }, 'boss');
    const boss = world.enemies[0];
    expect(boss.kind).toBe('boss');
    expect(boss.phase).toBe(1);

    hitEnemy(world, 1, 5);
    expect(boss.health).toBe(7);
    expect(boss.phase).toBe(2);
    expect(boss.mode).toBe('phase-transition');
    expect(boss.visualState).toBe('phase-transition');
    updateRuntimeEnemies(world, 0.5);
    updateRuntimeEnemies(world, 1 / 60);
    expect(Math.abs(boss.velocityX)).toBeCloseTo(125);

    hitEnemy(world, 2, 10);
    expect(boss.mode).toBe('dead');
    updateRuntimeEnemies(world, 1);
    expect(boss.removed).toBe(true);
    expect(world.completed).toBe(true);
    expect(world.paused).toBe(true);
  });

  it('executa ataque configurado com clip, janela de dano e cooldown próprios', () => {
    const attacks: BossAttackDefinition[] = [{
      id: 'cauda',
      name: 'Golpe de cauda',
      animationClip: 'Tail Attack',
      damage: 4,
      reach: 90,
      durationMs: 400,
      activeStartMs: 100,
      activeEndMs: 220,
      cooldownMs: 800,
      minimumPhase: 1,
    }];
    const phases: BossPhaseDefinition[] = [{
      id: 'fase-1',
      name: 'Fase 1',
      healthThreshold: 1,
      speedMultiplier: 1,
      damageMultiplier: 1.5,
      cooldownMultiplier: 0.5,
      enabledAttackIds: ['cauda'],
      transitionDurationMs: 0,
    }];
    const world = createWorld(350, { bossHealth: 20, bossAttacks: attacks, bossPhases: phases }, 'boss');
    const boss = world.enemies[0];
    const health = world.player.health;

    updateRuntimeEnemies(world, 1 / 60);
    expect(boss.mode).toBe('attack');
    expect(boss.activeAttackId).toBe('cauda');
    expect(boss.activeAnimationClip).toBe('Tail Attack');

    updateRuntimeEnemies(world, 0.1);
    expect(world.player.health).toBe(health - 6);
    const afterHit = world.player.health;
    updateRuntimeEnemies(world, 0.1);
    expect(world.player.health).toBe(afterHit);
    updateRuntimeEnemies(world, 0.25);
    expect(boss.attackCooldownRemaining).toBeCloseTo(0.4);
    expect(boss.activeAttackId).toBeNull();
  });

  it('libera ataque de investida somente na fase configurada', () => {
    const attacks: BossAttackDefinition[] = [
      { id: 'curto', name: 'Curto', damage: 1, reach: 40, durationMs: 300, activeStartMs: 100, activeEndMs: 180, cooldownMs: 300, minimumPhase: 1 },
      { id: 'investida', name: 'Investida', animationClip: 'Dash', damage: 3, reach: 360, durationMs: 800, activeStartMs: 180, activeEndMs: 620, cooldownMs: 900, minimumPhase: 2, dashSpeed: 300 },
    ];
    const phases: BossPhaseDefinition[] = [
      { id: 'fase-1', name: 'Fase 1', healthThreshold: 1, speedMultiplier: 1, damageMultiplier: 1, cooldownMultiplier: 1, enabledAttackIds: ['curto'], transitionDurationMs: 0 },
      { id: 'fase-2', name: 'Fase 2', healthThreshold: 0.5, speedMultiplier: 1.2, damageMultiplier: 1.2, cooldownMultiplier: 0.8, enabledAttackIds: ['investida'], transitionDurationMs: 200 },
    ];
    const world = createWorld(600, { bossHealth: 10, bossAttacks: attacks, bossPhases: phases }, 'boss');
    const boss = world.enemies[0];

    updateRuntimeEnemies(world, 1 / 60);
    expect(boss.activeAttackId).toBeNull();
    expect(boss.mode).toBe('chase');

    hitEnemy(world, 1, 6);
    expect(boss.phase).toBe(2);
    expect(boss.mode).toBe('phase-transition');
    updateRuntimeEnemies(world, 0.2);
    updateRuntimeEnemies(world, 1 / 60);
    expect(boss.activeAttackId).toBe('investida');
    expect(boss.activeAnimationClip).toBe('Dash');
    const before = boss.x;
    updateRuntimeEnemies(world, 0.1);
    expect(boss.x).toBeGreaterThan(before);
  });
});
