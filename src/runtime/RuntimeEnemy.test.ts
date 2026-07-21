import { describe, expect, it } from 'vitest';
import {
  EL_FUEGO_PROJECT_FORMAT,
  EL_FUEGO_PROJECT_VERSION,
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

function createWorld(playerX = 700, cactusPatch: Partial<SceneObjectBase> = {}): RuntimeWorld {
  const spawn = object('player-spawn', playerX, 300, 50, 100, {
    direction: 'right',
    initialHealth: 5,
    initialAttack: 1,
    initialDefense: 0,
  });
  const cactus = object('enemy-cactus', 200, 300, 60, 100, {
    direction: 'right',
    patrolLeft: 100,
    patrolRight: 400,
    visionDistance: 250,
    walkSpeed: 60,
    runSpeed: 180,
    attackDistance: 35,
    damage: 2,
    attackCooldownMs: 500,
    ...cactusPatch,
  });
  const scene: ProjectScene = {
    id: 'scene',
    name: 'Cena',
    order: 0,
    width: 1000,
    height: 600,
    backgroundAssetId: null,
    background: { fit: 'cover', positionX: 50, positionY: 50, scale: 1, editorOpacity: 1 },
    objects: [spawn, cactus],
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

describe('RuntimeEnemy', () => {
  it('caminha continuamente enquanto o player está fora da visão', () => {
    const world = createWorld(800);
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
    expect(enemy.velocityX).toBe(enemy.runSpeed);
  });

  it('volta a caminhar sem congelar depois de perder o player', () => {
    const world = createWorld(430);
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
    const world = createWorld(900, { patrolLeft: 0, patrolRight: 50, walkSpeed: 60 });
    const enemy = world.enemies[0];
    const startX = enemy.x;

    updateRuntimeEnemies(world, 1 / 60);

    expect(Math.abs(enemy.x - startX)).toBeLessThanOrEqual(enemy.walkSpeed / 60 + 0.001);
    expect(enemy.patrolRight).toBeGreaterThanOrEqual(startX);
  });
});
