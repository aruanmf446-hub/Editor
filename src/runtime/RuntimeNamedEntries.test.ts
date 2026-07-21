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
import { createRuntimePickups } from './RuntimePickup';
import { createRuntimePlayer } from './RuntimePlayer';
import { createRuntimePlatforms, type RuntimeWorld } from './RuntimeWorld';
import { enterRuntimeScene, updateRuntimeFinish } from './systems/RuntimeSceneSystem';

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
  transform: { x, y, z: 0, width: 50, height: 100, scaleX: 1, scaleY: 1, rotation: 0 },
  visible: true,
  locked: false,
  editorOnly: false,
  gameOnly: false,
  ...patch,
});

const scene = (id: string, order: number, objects: SceneObjectBase[]): ProjectScene => ({
  id,
  name: `Cena ${order + 1}`,
  order,
  width: 1000,
  height: 600,
  backgroundAssetId: null,
  background: { fit: 'cover', positionX: 50, positionY: 50, scale: 1, editorOpacity: 1 },
  objects,
});

function createWorld(scenes: ProjectScene[]): RuntimeWorld {
  const first = scenes[0];
  const spawn = first.objects.find((object) => object.type === 'player-spawn');
  if (!spawn) throw new Error('entrada inicial ausente');
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
    scene: first,
    sceneRevision: 0,
    player: createRuntimePlayer(spawn),
    enemies: createRuntimeEnemies(first),
    pickups: createRuntimePickups(first, pickupMemory),
    pickupMemory,
    platforms: createRuntimePlatforms(first),
    activeCheckpoint: null,
    pendingSceneTransition: null,
    camera: { x: 0, y: 0, viewportWidth: 400, viewportHeight: 300 },
    input: { left: false, right: false, jump: false, crouch: false, attack: false, defend: false, jumpPressed: false, jumpReleased: false },
    paused: false,
    completed: false,
    physicsSteps: 0,
    accumulator: 0,
    droppedPhysicsTime: 0,
  };
}

describe('entradas nomeadas', () => {
  it('usa a entrada padrão quando nenhuma entrada específica é solicitada', () => {
    const initial = object('one', 'player-spawn', 30, 300, { entryId: 'inicio', defaultEntry: true, direction: 'right' });
    const left = object('two', 'player-spawn', 70, 300, { entryId: 'esquerda', defaultEntry: true, direction: 'right' });
    const right = object('two', 'player-spawn', 780, 300, { entryId: 'direita', direction: 'left' });
    const target = scene('two', 1, [left, right]);
    const world = createWorld([scene('one', 0, [initial]), target]);

    enterRuntimeScene(world, target);

    expect(world.player.x).toBe(70);
    expect(world.player.direction).toBe('right');
  });

  it('seleciona a entrada exata solicitada pela saída', () => {
    const initial = object('one', 'player-spawn', 30, 300, { entryId: 'inicio', defaultEntry: true, direction: 'right' });
    const finish = object('one', 'finish', 100, 300, {
      endingMode: 'target-scene',
      targetSceneId: 'two',
      targetEntryId: 'porta-direita',
    });
    const defaultEntry = object('two', 'player-spawn', 70, 300, { entryId: 'porta-esquerda', defaultEntry: true, direction: 'right' });
    const namedEntry = object('two', 'player-spawn', 780, 280, { entryId: 'porta-direita', direction: 'left' });
    const world = createWorld([
      scene('one', 0, [initial, finish]),
      scene('two', 1, [defaultEntry, namedEntry]),
    ]);
    world.player.x = 110;
    world.player.y = 300;

    updateRuntimeFinish(world);

    expect(world.scene.id).toBe('two');
    expect(world.player.x).toBe(780);
    expect(world.player.y).toBe(280);
    expect(world.player.direction).toBe('left');
  });

  it('cai para a entrada padrão quando o identificador não é encontrado', () => {
    const initial = object('one', 'player-spawn', 30, 300, { defaultEntry: true });
    const fallback = object('two', 'player-spawn', 90, 300, { entryId: 'principal', defaultEntry: true });
    const target = scene('two', 1, [fallback]);
    const world = createWorld([scene('one', 0, [initial]), target]);

    enterRuntimeScene(world, target, 'entrada-inexistente');

    expect(world.player.x).toBe(90);
  });
});
