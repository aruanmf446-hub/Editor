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
import { createRuntimePlayer } from './RuntimePlayer';
import { createRuntimePlatforms, type RuntimeWorld } from './RuntimeWorld';
import { receivePlayerDamage, updatePlayerCombat } from './systems/PlayerCombatSystem';
import { updateRuntimeCheckpoints, updateRuntimeFinish } from './systems/RuntimeSceneSystem';

const object = (
  sceneId: string,
  type: SceneObjectBase['type'],
  x: number,
  y: number,
  width: number,
  height: number,
  patch: Partial<SceneObjectBase> = {},
): SceneObjectBase => ({
  id: `${sceneId}-${type}-${crypto.randomUUID()}`,
  sceneId,
  type,
  name: type,
  transform: { x, y, z: 0, width, height, scaleX: 1, scaleY: 1, rotation: 0 },
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

function project(scenes: ProjectScene[]): ElFuegoProject {
  return {
    format: EL_FUEGO_PROJECT_FORMAT,
    version: EL_FUEGO_PROJECT_VERSION,
    project: { id: 'project', name: 'Projeto', createdAt: '', updatedAt: '' },
    settings: { gravity: RUNTIME_CONFIG.gravity, gridSize: 16, snapEnabled: true, defaultSceneWidth: 1000, defaultSceneHeight: 600 },
    assets: [],
    scenes,
  };
}

function createWorld(scenes: ProjectScene[]): RuntimeWorld {
  const initial = scenes[0];
  const spawn = initial.objects.find((candidate) => candidate.type === 'player-spawn');
  if (!spawn) throw new Error('spawn ausente no teste');
  return {
    project: project(scenes),
    scene: initial,
    sceneRevision: 0,
    player: createRuntimePlayer(spawn),
    enemies: createRuntimeEnemies(initial),
    platforms: createRuntimePlatforms(initial),
    activeCheckpoint: null,
    camera: { x: 120, y: 80, viewportWidth: 400, viewportHeight: 300 },
    input: { left: false, right: false, jump: false, crouch: false, attack: false, defend: false, jumpPressed: false, jumpReleased: false },
    paused: false,
    completed: false,
    physicsSteps: 0,
    accumulator: 0,
    droppedPhysicsTime: 0,
  };
}

describe('RuntimeSceneSystem', () => {
  it('ativa checkpoint e usa posição e vida configuradas no respawn', () => {
    const spawn = object('one', 'player-spawn', 40, 300, 50, 100, { initialHealth: 5, initialDefense: 0 });
    const checkpoint = object('one', 'checkpoint', 200, 300, 72, 96, { checkpointOrder: 2, respawnHealth: 3 });
    const world = createWorld([scene('one', 0, [spawn, checkpoint])]);
    world.player.x = 210;
    world.player.y = 300;

    updateRuntimeCheckpoints(world);

    expect(world.activeCheckpoint?.objectId).toBe(checkpoint.id);
    expect(world.activeCheckpoint?.order).toBe(2);
    expect(world.player.spawnX).toBeCloseTo(211);
    expect(world.player.spawnY).toBeCloseTo(296);
    expect(world.player.respawnHealth).toBe(3);

    world.player.health = 1;
    expect(receivePlayerDamage(world, 10)).toBe('killed');
    updatePlayerCombat(world, RUNTIME_CONFIG.deathDuration);
    expect(world.player.health).toBe(3);
    expect(world.player.x).toBeCloseTo(211);
    expect(world.player.y).toBeCloseTo(296);
  });

  it('não volta para checkpoint de ordem menor', () => {
    const spawn = object('one', 'player-spawn', 40, 300, 50, 100);
    const high = object('one', 'checkpoint', 200, 300, 72, 96, { checkpointOrder: 3 });
    const low = object('one', 'checkpoint', 400, 300, 72, 96, { checkpointOrder: 1 });
    const world = createWorld([scene('one', 0, [spawn, high, low])]);
    world.player.x = 210; world.player.y = 300;
    updateRuntimeCheckpoints(world);
    world.player.x = 410; world.player.y = 300;
    updateRuntimeCheckpoints(world);
    expect(world.activeCheckpoint?.objectId).toBe(high.id);
  });

  it('troca para a próxima cena e reconstrói câmera, plataformas e inimigos', () => {
    const spawnOne = object('one', 'player-spawn', 40, 300, 50, 100, { initialHealth: 5, initialAttack: 2, initialDefense: 1, assetId: 'player-a' });
    const finish = object('one', 'finish', 100, 300, 80, 100, { endingMode: 'next-scene' });
    const spawnTwo = object('two', 'player-spawn', 70, 250, 60, 110, { assetId: 'player-b' });
    const platformTwo = object('two', 'platform', 0, 500, 600, 40);
    const cactusTwo = object('two', 'enemy-cactus', 300, 330, 60, 100);
    const world = createWorld([
      scene('one', 0, [spawnOne, finish]),
      scene('two', 1, [spawnTwo, platformTwo, cactusTwo]),
    ]);
    world.player.x = 110;
    world.player.y = 300;
    world.player.health = 4;
    world.camera.x = 200;
    world.camera.y = 100;

    updateRuntimeFinish(world);

    expect(world.scene.id).toBe('two');
    expect(world.sceneRevision).toBe(1);
    expect(world.camera.x).toBe(0);
    expect(world.camera.y).toBe(0);
    expect(world.platforms.map((item) => item.id)).toContain(platformTwo.id);
    expect(world.enemies.map((item) => item.id)).toContain(cactusTwo.id);
    expect(world.player.x).toBe(70);
    expect(world.player.y).toBe(250);
    expect(world.player.health).toBe(4);
    expect(world.player.assetId).toBe('player-b');
    expect(world.activeCheckpoint).toBeNull();
  });

  it('respeita targetSceneId em uma transição específica', () => {
    const spawnOne = object('one', 'player-spawn', 40, 300, 50, 100);
    const finish = object('one', 'finish', 100, 300, 80, 100, { endingMode: 'target-scene', targetSceneId: 'three' });
    const spawnTwo = object('two', 'player-spawn', 40, 300, 50, 100);
    const spawnThree = object('three', 'player-spawn', 80, 280, 50, 100);
    const world = createWorld([
      scene('one', 0, [spawnOne, finish]),
      scene('two', 1, [spawnTwo]),
      scene('three', 2, [spawnThree]),
    ]);
    world.player.x = 110; world.player.y = 300;

    updateRuntimeFinish(world);

    expect(world.scene.id).toBe('three');
    expect(world.player.x).toBe(80);
  });

  it('conclui o jogo no modo completo e na última cena sem destino', () => {
    const spawn = object('last', 'player-spawn', 40, 300, 50, 100);
    const finish = object('last', 'finish', 100, 300, 80, 100, { endingMode: 'complete-game' });
    const world = createWorld([scene('last', 0, [spawn, finish])]);
    world.player.x = 110; world.player.y = 300;

    updateRuntimeFinish(world);

    expect(world.completed).toBe(true);
    expect(world.paused).toBe(true);
    expect(world.player.velocityX).toBe(0);
    expect(world.player.velocityY).toBe(0);
  });
});
