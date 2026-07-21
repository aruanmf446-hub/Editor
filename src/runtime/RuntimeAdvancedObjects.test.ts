import { describe, expect, it } from 'vitest';
import {
  EL_FUEGO_PROJECT_FORMAT,
  EL_FUEGO_PROJECT_VERSION,
  type ElFuegoProject,
  type ProjectScene,
  type SceneObjectBase,
  type TriggerAction,
} from '../types/project';
import {
  isPlayerBlockedByDialogue,
  resetRuntimeSceneObjectState,
  updateRuntimeAdvancedObjects,
} from './RuntimeAdvancedObjects';
import { RUNTIME_CONFIG } from './RuntimeConfig';
import { createRuntimeEnemies } from './RuntimeEnemy';
import { createRuntimePickups } from './RuntimePickup';
import { createRuntimePlayer } from './RuntimePlayer';
import { createRuntimePlatforms, type RuntimeWorld } from './RuntimeWorld';
import { resolveWorldMovement } from './systems/CollisionSystem';
import { updateRuntimeFinish } from './systems/RuntimeSceneSystem';

const object = (
  type: SceneObjectBase['type'],
  x: number,
  y: number,
  width: number,
  height: number,
  patch: Partial<SceneObjectBase> = {},
): SceneObjectBase => ({
  id: `${type}-${crypto.randomUUID()}`,
  sceneId: 'scene',
  type,
  name: patch.name ?? type,
  transform: { x, y, z: 0, width, height, scaleX: 1, scaleY: 1, rotation: 0 },
  visible: true,
  locked: false,
  editorOnly: false,
  gameOnly: false,
  ...patch,
});

function createWorld(objects: SceneObjectBase[]): RuntimeWorld {
  const spawn = object('player-spawn', 100, 300, 50, 100, {
    initialHealth: 5,
    initialAttack: 1,
    initialDefense: 0,
    direction: 'right',
  });
  const scene: ProjectScene = {
    id: 'scene',
    name: 'Cena',
    order: 0,
    width: 1000,
    height: 600,
    backgroundAssetId: null,
    background: { fit: 'cover', positionX: 50, positionY: 50, scale: 1, editorOpacity: 1 },
    objects: [spawn, ...objects],
  };
  const project: ElFuegoProject = {
    format: EL_FUEGO_PROJECT_FORMAT,
    version: EL_FUEGO_PROJECT_VERSION,
    project: { id: 'project', name: 'Projeto', createdAt: '', updatedAt: '' },
    settings: { gravity: RUNTIME_CONFIG.gravity, gridSize: 16, snapEnabled: true, defaultSceneWidth: 1000, defaultSceneHeight: 600 },
    assets: [],
    scenes: [scene],
  };
  const pickupMemory = {};
  return {
    project,
    scene,
    sceneRevision: 0,
    player: createRuntimePlayer(spawn),
    enemies: createRuntimeEnemies(scene),
    pickups: createRuntimePickups(scene, pickupMemory),
    pickupMemory,
    platforms: createRuntimePlatforms(scene),
    activeCheckpoint: null,
    collectedObjectIds: {},
    triggeredObjectIds: {},
    activeTriggerContacts: {},
    completedDialogueIds: {},
    objectVisibilityOverrides: {},
    collisionEnabledOverrides: {},
    variables: {},
    collectiblesRemaining: 0,
    activeDialogue: null,
    dialogueAdvanceRequested: false,
    lastTriggerId: null,
    playerNoCollision: false,
    pendingSceneTransitionId: null,
    cameraOverride: null,
    camera: { x: 0, y: 0, viewportWidth: 400, viewportHeight: 300 },
    input: { left: false, right: false, jump: false, crouch: false, attack: false, defend: false, jumpPressed: false, jumpReleased: false },
    paused: false,
    completed: false,
    physicsSteps: 0,
    accumulator: 0,
    droppedPhysicsTime: 0,
  };
}

describe('RuntimeAdvancedObjects', () => {
  it('trata obstáculo como colisor sólido', () => {
    const obstacle = object('obstacle', 200, 250, 60, 150);
    const world = createWorld([obstacle]);
    expect(world.platforms).toEqual(expect.arrayContaining([expect.objectContaining({ id: obstacle.id, oneWay: false })]));
  });

  it('zona de queda mata o player e inicia o ciclo de respawn', () => {
    const drop = object('drop-zone', 80, 280, 200, 160);
    const world = createWorld([drop]);
    updateRuntimeAdvancedObjects(world);
    expect(world.player.health).toBe(0);
    expect(world.player.mode).toBe('dead');
    expect(world.player.deathRemaining).toBeGreaterThan(0);
  });

  it('área sem colisão permite atravessar um obstáculo', () => {
    const zone = object('no-collision-zone', 80, 250, 300, 200);
    const obstacle = object('obstacle', 160, 250, 40, 200);
    const world = createWorld([zone, obstacle]);
    world.player.velocityX = 1000;
    updateRuntimeAdvancedObjects(world);
    resolveWorldMovement(world, .1);
    expect(world.playerNoCollision).toBe(true);
    expect(world.player.x).toBe(200);
  });

  it('gatilho dispara na entrada, não repete durante contato e respeita triggerOnce', () => {
    const trigger = object('trigger', 80, 280, 200, 160, { triggerId: 'abrir-porta', triggerOnce: true });
    const world = createWorld([trigger]);
    updateRuntimeAdvancedObjects(world);
    expect(world.lastTriggerId).toBe('abrir-porta');
    expect(world.triggeredObjectIds?.[trigger.id]).toBe(true);
    world.lastTriggerId = null;
    updateRuntimeAdvancedObjects(world);
    expect(world.lastTriggerId).toBeNull();
    world.player.x = 500;
    updateRuntimeAdvancedObjects(world);
    world.player.x = 100;
    updateRuntimeAdvancedObjects(world);
    expect(world.lastTriggerId).toBeNull();
  });

  it('mantém compatibilidade com aviso simples usando o nome da área', () => {
    const dialogue = object('dialogue-zone', 80, 280, 200, 160, { name: 'Cuidado com os cactos!' });
    const world = createWorld([dialogue]);
    updateRuntimeAdvancedObjects(world);
    expect(world.activeDialogue?.lines[0].text).toBe('Cuidado com os cactos!');
    expect(world.activeDialogue?.contactOnly).toBe(true);
    world.player.x = 500;
    updateRuntimeAdvancedObjects(world);
    expect(world.activeDialogue).toBeNull();
  });

  it('avança várias falas, bloqueia o player e respeita diálogo único', () => {
    const dialogue = object('dialogue-zone', 80, 280, 200, 160, {
      dialogueLines: [
        { id: 'one', speaker: 'El Fuego', text: 'Onde estou?', durationMs: 5000 },
        { id: 'two', speaker: 'Malagueta', text: 'Você não deveria ter vindo.', durationMs: 5000 },
      ],
      dialogueAdvanceMode: 'manual',
      dialogueBlockPlayer: true,
      dialogueOnce: true,
    });
    const world = createWorld([dialogue]);
    updateRuntimeAdvancedObjects(world);
    expect(world.activeDialogue?.lineIndex).toBe(0);
    expect(isPlayerBlockedByDialogue(world)).toBe(true);
    world.dialogueAdvanceRequested = true;
    updateRuntimeAdvancedObjects(world);
    expect(world.activeDialogue?.lineIndex).toBe(1);
    world.dialogueAdvanceRequested = true;
    updateRuntimeAdvancedObjects(world);
    expect(world.activeDialogue).toBeNull();
    expect(world.completedDialogueIds?.[dialogue.id]).toBe(true);
    updateRuntimeAdvancedObjects(world);
    expect(world.activeDialogue).toBeNull();
  });

  it('executa ações ordenadas de visibilidade, colisão, diálogo, inimigo, câmera e variável', () => {
    const obstacle = object('obstacle', 500, 250, 60, 150, { name: 'Porta' });
    const dialogue = object('dialogue-zone', 600, 250, 100, 100, {
      dialogueLines: [{ id: 'fala', speaker: 'El Fuego', text: 'A porta abriu.' }],
    });
    const enemy = object('enemy-cactus', 700, 300, 60, 100, { enemyActiveAtStart: false });
    const actions: TriggerAction[] = [
      { id: 'visible', type: 'set-object-visible', targetObjectId: obstacle.id, visible: false },
      { id: 'collision', type: 'set-collision-enabled', targetObjectId: obstacle.id, enabled: false },
      { id: 'dialogue', type: 'start-dialogue', targetObjectId: dialogue.id },
      { id: 'enemy', type: 'activate-enemy', targetObjectId: enemy.id, active: true },
      { id: 'camera', type: 'set-camera', x: 300, y: 40, durationMs: 1200 },
      { id: 'variable', type: 'set-variable', key: 'porta', value: 'aberta' },
    ];
    const trigger = object('trigger', 80, 280, 200, 160, { triggerActions: actions });
    const world = createWorld([obstacle, dialogue, enemy, trigger]);
    resetRuntimeSceneObjectState(world);
    expect(world.enemies[0].removed).toBe(true);

    updateRuntimeAdvancedObjects(world);

    expect(world.objectVisibilityOverrides?.[obstacle.id]).toBe(false);
    expect(world.platforms.some((platform) => platform.id === obstacle.id)).toBe(false);
    expect(world.activeDialogue?.lines[0].text).toBe('A porta abriu.');
    expect(world.enemies[0].removed).toBe(false);
    expect(world.cameraOverride).toEqual({ x: 300, y: 40, remaining: 1.2 });
    expect(world.variables?.porta).toBe('aberta');
  });

  it('registra transição de cena solicitada pelo gatilho', () => {
    const trigger = object('trigger', 80, 280, 200, 160, {
      triggerActions: [{ id: 'scene', type: 'transition-scene', targetSceneId: 'scene-two' }],
    });
    const world = createWorld([trigger]);
    updateRuntimeAdvancedObjects(world);
    expect(world.pendingSceneTransitionId).toBe('scene-two');
  });

  it('coleta item uma vez e libera fim que exige todos os colecionáveis', () => {
    const collectible = object('collectible', 300, 300, 50, 50);
    const finish = object('finish', 100, 300, 80, 100, { endingMode: 'complete-game', requiresAllCollectibles: true });
    const world = createWorld([collectible, finish]);
    updateRuntimeAdvancedObjects(world);
    expect(world.collectiblesRemaining).toBe(1);
    updateRuntimeFinish(world);
    expect(world.completed).toBe(false);
    world.player.x = 300;
    updateRuntimeAdvancedObjects(world);
    expect(world.collectiblesRemaining).toBe(0);
    expect(world.collectedObjectIds?.[collectible.id]).toBe(true);
    world.player.x = 110;
    updateRuntimeFinish(world);
    expect(world.completed).toBe(true);
  });
});
