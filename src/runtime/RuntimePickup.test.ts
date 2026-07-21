import { describe, expect, it } from 'vitest';
import {
  EL_FUEGO_PROJECT_FORMAT,
  EL_FUEGO_PROJECT_VERSION,
  type ElFuegoProject,
  type ProjectScene,
  type SceneObjectBase,
} from '../types/project';
import { RUNTIME_CONFIG } from './RuntimeConfig';
import { createRuntimeEnemies } from './RuntimeEnemy';
import { createRuntimePickups, updateRuntimePickups } from './RuntimePickup';
import { createRuntimePlayer } from './RuntimePlayer';
import { createRuntimePlatforms, type RuntimeWorld } from './RuntimeWorld';
import { enterRuntimeScene } from './systems/RuntimeSceneSystem';

const object = (
  sceneId: string,
  type: SceneObjectBase['type'],
  x: number,
  y: number,
  patch: Partial<SceneObjectBase> = {},
): SceneObjectBase => ({
  id: `${sceneId}-${type}-${crypto.randomUUID()}`,
  sceneId,
  type,
  name: type,
  transform: { x, y, z: 0, width: 50, height: 50, scaleX: 1, scaleY: 1, rotation: 0 },
  visible: true,
  locked: false,
  editorOnly: false,
  gameOnly: false,
  ...patch,
});

function scene(id: string, order: number, objects: SceneObjectBase[]): ProjectScene {
  return {
    id,
    name: id,
    order,
    width: 1000,
    height: 600,
    backgroundAssetId: null,
    background: { fit: 'cover', positionX: 50, positionY: 50, scale: 1, editorOpacity: 1 },
    objects,
  };
}

function createWorld(scenes: ProjectScene[]): RuntimeWorld {
  const initial = scenes[0];
  const spawn = initial.objects.find((candidate) => candidate.type === 'player-spawn');
  if (!spawn) throw new Error('spawn ausente');
  const project: ElFuegoProject = {
    format: EL_FUEGO_PROJECT_FORMAT,
    version: EL_FUEGO_PROJECT_VERSION,
    project: { id: 'project', name: 'Projeto', createdAt: '', updatedAt: '' },
    settings: { gravity: RUNTIME_CONFIG.gravity, gridSize: 16, snapEnabled: true, defaultSceneWidth: 1000, defaultSceneHeight: 600 },
    assets: [],
    scenes,
  };
  const pickupMemory = {};
  return {
    project,
    scene: initial,
    sceneRevision: 0,
    player: createRuntimePlayer(spawn),
    enemies: createRuntimeEnemies(initial),
    pickups: createRuntimePickups(initial, pickupMemory),
    pickupMemory,
    platforms: createRuntimePlatforms(initial),
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

function placePlayerOn(world: RuntimeWorld, pickup: RuntimePickupStateLike): void {
  world.player.x = pickup.x;
  world.player.y = pickup.y;
}

type RuntimePickupStateLike = { x: number; y: number };

describe('RuntimePickup', () => {
  it('recupera vida sem ultrapassar a vida máxima e não some quando a vida está cheia', () => {
    const spawn = object('one', 'player-spawn', 20, 300, { initialHealth: 5, initialDefense: 0 });
    spawn.transform.width = 50;
    spawn.transform.height = 100;
    const health = object('one', 'pickup-health', 100, 300, { pickupAmount: 3 });
    const world = createWorld([scene('one', 0, [spawn, health])]);
    const pickup = world.pickups[0];
    placePlayerOn(world, pickup);

    updateRuntimePickups(world, 1 / 60);
    expect(pickup.active).toBe(true);
    expect(world.pickupMemory[pickup.id]).toBeUndefined();

    world.player.health = 3;
    updateRuntimePickups(world, 1 / 60);
    expect(world.player.health).toBe(5);
    expect(pickup.active).toBe(false);
    expect(world.pickupMemory[pickup.id]).toBe(-1);
  });

  it('aumenta ataque e defesa pelo valor configurado', () => {
    const spawn = object('one', 'player-spawn', 20, 300, { initialAttack: 1, initialDefense: 1 });
    spawn.transform.width = 50;
    spawn.transform.height = 100;
    const attack = object('one', 'pickup-attack', 100, 300, { pickupAmount: 2 });
    const defense = object('one', 'pickup-defense', 200, 300, { pickupAmount: 3 });
    const world = createWorld([scene('one', 0, [spawn, attack, defense])]);

    placePlayerOn(world, world.pickups[0]);
    updateRuntimePickups(world, 1 / 60);
    placePlayerOn(world, world.pickups[1]);
    updateRuntimePickups(world, 1 / 60);

    expect(world.player.attack).toBe(3);
    expect(world.player.defense).toBe(4);
  });

  it('faz respawn após o tempo e exige que o player saia antes de coletar novamente', () => {
    const spawn = object('one', 'player-spawn', 20, 300, { initialAttack: 1 });
    spawn.transform.width = 50;
    spawn.transform.height = 100;
    const attack = object('one', 'pickup-attack', 100, 300, { pickupAmount: 1, respawnable: true, respawnDelayMs: 100 });
    const world = createWorld([scene('one', 0, [spawn, attack])]);
    const pickup = world.pickups[0];
    placePlayerOn(world, pickup);

    updateRuntimePickups(world, 1 / 60);
    expect(world.player.attack).toBe(2);
    expect(pickup.active).toBe(false);

    updateRuntimePickups(world, .2);
    expect(pickup.active).toBe(true);
    expect(world.player.attack).toBe(2);

    world.player.x = 500;
    updateRuntimePickups(world, 1 / 60);
    placePlayerOn(world, pickup);
    updateRuntimePickups(world, 1 / 60);
    expect(world.player.attack).toBe(3);
  });

  it('mantém pickup não respawnável coletado ao sair e voltar para a cena', () => {
    const spawnOne = object('one', 'player-spawn', 20, 300, { initialAttack: 1 });
    spawnOne.transform.width = 50;
    spawnOne.transform.height = 100;
    const attack = object('one', 'pickup-attack', 100, 300, { pickupAmount: 2 });
    const spawnTwo = object('two', 'player-spawn', 20, 300);
    spawnTwo.transform.width = 50;
    spawnTwo.transform.height = 100;
    const first = scene('one', 0, [spawnOne, attack]);
    const second = scene('two', 1, [spawnTwo]);
    const world = createWorld([first, second]);
    placePlayerOn(world, world.pickups[0]);
    updateRuntimePickups(world, 1 / 60);

    enterRuntimeScene(world, second);
    enterRuntimeScene(world, first);

    expect(world.pickups).toHaveLength(1);
    expect(world.pickups[0].active).toBe(false);
    expect(world.player.attack).toBe(3);
  });
});
