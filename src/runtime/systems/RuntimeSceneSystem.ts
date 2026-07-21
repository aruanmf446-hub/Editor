import type { ProjectScene, SceneObjectBase } from '../../types/project';
import { intersects } from '../RuntimeCollision';
import { createRuntimeEnemies } from '../RuntimeEnemy';
import { createRuntimePickups } from '../RuntimePickup';
import { createRuntimePlayer } from '../RuntimePlayer';
import { createRuntimePlatforms, type RuntimeWorld } from '../RuntimeWorld';
import { respawnPlayerSafely } from './CollisionSystem';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function runtimeObjectBounds(object: SceneObjectBase) {
  return {
    x: object.transform.x,
    y: object.transform.y,
    width: object.transform.width,
    height: object.transform.height,
  };
}

function createFallbackSpawn(scene: ProjectScene, world: RuntimeWorld): SceneObjectBase<'player-spawn'> {
  const previous = world.player;
  const width = previous.width;
  const height = previous.standingHeight;
  return {
    id: `runtime-entry-${scene.id}`,
    sceneId: scene.id,
    type: 'player-spawn',
    name: 'Entrada automática',
    assetId: previous.assetId,
    animationAssignments: previous.animationAssignments,
    transform: {
      x: Math.min(32, Math.max(0, scene.width - width)),
      y: Math.min(32, Math.max(0, scene.height - height)),
      z: 0,
      width,
      height,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
    },
    visible: true,
    locked: false,
    editorOnly: false,
    gameOnly: false,
    direction: previous.direction,
    initialHealth: previous.maxHealth,
    initialAttack: previous.attack,
    initialDefense: previous.defense,
  };
}

function findSceneSpawn(scene: ProjectScene, world: RuntimeWorld): SceneObjectBase {
  return scene.objects.find((object) => object.type === 'player-spawn' && object.visible && !object.editorOnly)
    ?? createFallbackSpawn(scene, world);
}

export function enterRuntimeScene(world: RuntimeWorld, scene: ProjectScene): void {
  const previous = world.player;
  const spawn = findSceneSpawn(scene, world);
  const nextPlayer = createRuntimePlayer(spawn);

  nextPlayer.maxHealth = Math.max(previous.maxHealth, nextPlayer.maxHealth);
  nextPlayer.health = clamp(previous.health, 1, nextPlayer.maxHealth);
  nextPlayer.respawnHealth = nextPlayer.maxHealth;
  nextPlayer.attack = previous.attack;
  nextPlayer.defense = previous.defense;
  if (!nextPlayer.assetId) nextPlayer.assetId = previous.assetId;
  if (!nextPlayer.animationAssignments) nextPlayer.animationAssignments = previous.animationAssignments;

  world.scene = scene;
  world.sceneRevision += 1;
  world.player = nextPlayer;
  world.platforms = createRuntimePlatforms(scene);
  world.enemies = createRuntimeEnemies(scene);
  world.pickups = createRuntimePickups(scene, world.pickupMemory);
  world.activeCheckpoint = null;
  world.camera.x = 0;
  world.camera.y = 0;
  world.completed = false;
  world.paused = false;
  world.respawnFailure = false;
  world.pauseReason = undefined;
  respawnPlayerSafely(world);
}

function completeRuntime(world: RuntimeWorld): void {
  world.completed = true;
  world.paused = true;
  world.player.velocityX = 0;
  world.player.velocityY = 0;
}

function resolveFinishTarget(world: RuntimeWorld, finish: SceneObjectBase): ProjectScene | null {
  const mode = finish.endingMode ?? 'next-scene';
  if (mode === 'complete-game') return null;
  if (mode === 'target-scene') {
    return finish.targetSceneId
      ? world.project.scenes.find((scene) => scene.id === finish.targetSceneId) ?? null
      : null;
  }

  const ordered = [...world.project.scenes].sort((a, b) => a.order - b.order);
  const currentIndex = ordered.findIndex((scene) => scene.id === world.scene.id);
  return currentIndex >= 0 ? ordered[currentIndex + 1] ?? null : null;
}

export function updateRuntimeCheckpoints(world: RuntimeWorld): void {
  const candidates = world.scene.objects
    .filter((object) => object.type === 'checkpoint' && object.visible && !object.editorOnly && intersects(world.player, runtimeObjectBounds(object)))
    .sort((a, b) => (b.checkpointOrder ?? 1) - (a.checkpointOrder ?? 1));
  const checkpoint = candidates[0];
  if (!checkpoint) return;

  const order = checkpoint.checkpointOrder ?? 1;
  if (world.activeCheckpoint?.sceneId === world.scene.id && world.activeCheckpoint.order > order) return;
  if (world.activeCheckpoint?.objectId === checkpoint.id) return;

  const maxX = Math.max(0, world.scene.width - world.player.width);
  const maxY = Math.max(0, world.scene.height - world.player.standingHeight);
  const x = clamp(checkpoint.transform.x + (checkpoint.transform.width - world.player.width) / 2, 0, maxX);
  const y = clamp(checkpoint.transform.y + checkpoint.transform.height - world.player.standingHeight, 0, maxY);
  const respawnHealth = Math.max(1, checkpoint.respawnHealth ?? world.player.maxHealth);

  world.activeCheckpoint = {
    sceneId: world.scene.id,
    objectId: checkpoint.id,
    order,
    x,
    y,
    respawnHealth,
  };
  world.player.spawnX = x;
  world.player.spawnY = y;
  world.player.respawnHealth = respawnHealth;
}

export function updateRuntimeFinish(world: RuntimeWorld): void {
  if (world.completed || world.player.mode === 'dead') return;
  const livingBoss = world.enemies.some((enemy) => enemy.kind === 'boss' && !enemy.removed && enemy.health > 0);
  if (livingBoss) return;

  const finish = world.scene.objects.find((object) =>
    object.type === 'finish'
    && object.visible
    && !object.editorOnly
    && intersects(world.player, runtimeObjectBounds(object))
  );
  if (!finish) return;

  const target = resolveFinishTarget(world, finish);
  if (!target) {
    completeRuntime(world);
    return;
  }
  enterRuntimeScene(world, target);
}
