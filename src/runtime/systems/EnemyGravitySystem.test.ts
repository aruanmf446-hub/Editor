import { describe, expect, it } from 'vitest';
import {
  EL_FUEGO_PROJECT_FORMAT,
  EL_FUEGO_PROJECT_VERSION,
  type ElFuegoProject,
  type ProjectScene,
  type SceneObjectBase,
} from '../../types/project';
import { createRuntimeEnemies } from '../RuntimeEnemy';
import { createRuntimePlayer } from '../RuntimePlayer';
import { createRuntimePlatforms, type RuntimeWorld } from '../RuntimeWorld';
import { receivePlayerDamage } from './PlayerCombatSystem';
import { updateEnemyGravity } from './EnemyGravitySystem';

const object = (type: SceneObjectBase['type'], x: number, y: number, width: number, height: number, patch: Partial<SceneObjectBase> = {}): SceneObjectBase => ({
  id: `${type}-${x}-${y}`, sceneId: 'scene', type, name: type,
  transform: { x, y, z: 0, width, height, scaleX: 1, scaleY: 1, rotation: 0 },
  visible: true, locked: false, editorOnly: false, gameOnly: false, ...patch,
});

function createWorld(): RuntimeWorld {
  const spawn = object('player-spawn', 20, 300, 50, 100, { initialHealth: 3, initialAttack: 1, initialDefense: 0 });
  const floor = object('platform', 0, 400, 800, 40, { collisionType: 'solid' });
  const cactus = object('enemy-cactus', 200, 100, 80, 120, { walkSpeed: 0, runSpeed: 0, enemyHealth: 3 });
  const scene: ProjectScene = { id: 'scene', name: 'Cena', order: 0, width: 800, height: 500, backgroundAssetId: null, background: { fit: 'cover', positionX: 50, positionY: 50, scale: 1, editorOpacity: 1 }, objects: [spawn, floor, cactus] };
  const project: ElFuegoProject = { format: EL_FUEGO_PROJECT_FORMAT, version: EL_FUEGO_PROJECT_VERSION, project: { id: 'p', name: 'P', createdAt: '', updatedAt: '' }, settings: { gravity: 1900, gridSize: 16, snapEnabled: true, defaultSceneWidth: 800, defaultSceneHeight: 500 }, assets: [], scenes: [scene] };
  return { project, scene, sceneRevision: 0, player: createRuntimePlayer(spawn), enemies: createRuntimeEnemies(scene), pickups: [], pickupMemory: {}, platforms: createRuntimePlatforms(scene), activeCheckpoint: null, camera: { x: 0, y: 0, viewportWidth: 400, viewportHeight: 300 }, input: { left: false, right: false, jump: false, crouch: false, attack: false, defend: false, jumpPressed: false, jumpReleased: false, attackPressed: false }, paused: false, completed: false, physicsSteps: 0, accumulator: 0, droppedPhysicsTime: 0 };
}

describe('EnemyGravitySystem', () => {
  it('faz o cacto cair e pousar com os pés exatamente na plataforma', () => {
    const world = createWorld();
    for (let index = 0; index < 120; index += 1) updateEnemyGravity(world, 1 / 60);
    const cactus = world.enemies[0];
    expect(cactus.y + cactus.height).toBeCloseTo(400, 5);
  });

  it('não aplica impacto físico quando o player está acima ou abaixo da hitbox do cacto', () => {
    const world = createWorld();
    const cactus = world.enemies[0];
    world.player.x = cactus.x;
    world.player.y = cactus.y + cactus.height + 1;
    const health = world.player.health;
    expect(receivePlayerDamage(world, { amount: 1, sourceX: cactus.x + cactus.width / 2, damageType: 'physical' })).toBe('ignored');
    expect(world.player.health).toBe(health);
  });
});
