import type { CompletionCondition, ProjectScene, SceneObjectBase } from '../../types/project';
import { isRuntimeObjectVisible, resetRuntimeSceneObjectState } from '../RuntimeAdvancedObjects';
import { intersects } from '../RuntimeCollision';
import { createRuntimeEnemies } from '../RuntimeEnemy';
import { createRuntimePickups } from '../RuntimePickup';
import { createRuntimePlayer } from '../RuntimePlayer';
import { createRuntimePlatforms, type RuntimeWorld } from '../RuntimeWorld';
import { respawnPlayerSafely } from './CollisionSystem';
import { enterCampaignScene, recordCampaignCheckpoint, recordCampaignLevelCompletion } from '../RuntimeCampaign';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const runtimeObjectBounds = (object: SceneObjectBase) => ({ x: object.transform.x, y: object.transform.y, width: object.transform.width, height: object.transform.height });
type FinishTarget = { scene: ProjectScene; entryId?: string };

function createFallbackSpawn(scene: ProjectScene, world: RuntimeWorld): SceneObjectBase<'player-spawn'> {
  const previous = world.player;
  const width = previous.width;
  const height = previous.standingHeight;
  return { id: `runtime-entry-${scene.id}`, sceneId: scene.id, type: 'player-spawn', name: 'Entrada automática', entryId: 'entrada-automatica', defaultEntry: true, assetId: previous.assetId, animationAssignments: previous.animationAssignments, transform: { x: Math.min(32, Math.max(0, scene.width - width)), y: Math.min(32, Math.max(0, scene.height - height)), z: 0, width, height, scaleX: 1, scaleY: 1, rotation: 0 }, visible: true, locked: false, editorOnly: false, gameOnly: false, direction: previous.direction, initialHealth: previous.maxHealth, initialAttack: previous.attack, initialDefense: previous.defense };
}

function findSceneSpawn(scene: ProjectScene, world: RuntimeWorld, entryId?: string): SceneObjectBase {
  const spawns = scene.objects.filter((object) => object.type === 'player-spawn' && object.visible && !object.editorOnly);
  const normalizedEntry = entryId?.trim();
  if (normalizedEntry) { const exact = spawns.find((spawn) => spawn.entryId?.trim() === normalizedEntry); if (exact) return exact; }
  return spawns.find((spawn) => spawn.defaultEntry) ?? spawns[0] ?? createFallbackSpawn(scene, world);
}

export function enterRuntimeScene(world: RuntimeWorld, scene: ProjectScene, entryId?: string): void {
  const previous = world.player;
  enterCampaignScene(world, scene.id);
  const spawn = findSceneSpawn(scene, world, entryId);
  const nextPlayer = createRuntimePlayer(spawn);
  nextPlayer.maxHealth = Math.max(previous.maxHealth, nextPlayer.maxHealth);
  nextPlayer.health = clamp(previous.health, 1, nextPlayer.maxHealth);
  nextPlayer.respawnHealth = nextPlayer.maxHealth;
  nextPlayer.attack = previous.attack;
  nextPlayer.defense = previous.defense;
  if (!nextPlayer.assetId) nextPlayer.assetId = previous.assetId;
  if (!nextPlayer.animationAssignments) nextPlayer.animationAssignments = previous.animationAssignments;
  world.scene = scene; world.sceneRevision += 1; world.player = nextPlayer; world.platforms = createRuntimePlatforms(scene); world.enemies = createRuntimeEnemies(scene); world.pickups = createRuntimePickups(scene, world.pickupMemory); world.activeCheckpoint = null; world.camera.x = 0; world.camera.y = 0; world.completed = false; world.paused = false; world.respawnFailure = false; world.pauseReason = undefined;
  resetRuntimeSceneObjectState(world);
  respawnPlayerSafely(world);
}

function completeRuntime(world: RuntimeWorld): void {
  recordCampaignLevelCompletion(world);
  world.completed = true; world.paused = true; world.player.velocityX = 0; world.player.velocityY = 0;
}

function resolveFinishTarget(world: RuntimeWorld, finish: SceneObjectBase): FinishTarget | null {
  const mode = finish.endingMode ?? 'next-scene';
  if (mode === 'complete-game') return null;
  if (mode === 'target-scene') { const scene = finish.targetSceneId ? world.project.scenes.find((candidate) => candidate.id === finish.targetSceneId) : undefined; return scene ? { scene, entryId: finish.targetEntryId?.trim() || undefined } : null; }
  const ordered = [...world.project.scenes].sort((a, b) => a.order - b.order);
  const currentIndex = ordered.findIndex((scene) => scene.id === world.scene.id);
  const scene = currentIndex >= 0 ? ordered[currentIndex + 1] : undefined;
  return scene ? { scene, entryId: finish.targetEntryId?.trim() || undefined } : null;
}

function conditionMet(world: RuntimeWorld, condition: CompletionCondition): boolean {
  if (condition.type === 'boss-defeated') {
    if (condition.targetObjectId) return !world.enemies.some((enemy) => enemy.sourceObjectId === condition.targetObjectId && !enemy.removed && enemy.health > 0);
    return !world.enemies.some((enemy) => enemy.kind === 'boss' && !enemy.removed && enemy.health > 0);
  }
  if (condition.type === 'collectible-count') return (world.collectibleTotals?.[condition.collectibleId] ?? 0) >= Math.max(0, condition.minimum);
  if (condition.type === 'variable') return world.variables?.[condition.key] === condition.value;
  if (condition.type === 'dialogue-completed') return Boolean(world.completedDialogueIds?.[condition.targetObjectId]);
  return !world.enemies.some((enemy) => {
    const source = world.scene.objects.find((object) => object.id === enemy.sourceObjectId);
    return Boolean(source?.requiredForCompletion) && !enemy.removed && enemy.health > 0;
  });
}

function canFinish(world: RuntimeWorld, finish: SceneObjectBase): boolean {
  const activeBoss = world.enemies.some((enemy) => enemy.kind === 'boss' && !enemy.removed && enemy.health > 0);
  if (activeBoss) return false;
  if (finish.requiresAllCollectibles && (world.collectiblesRemaining ?? 0) > 0) return false;
  const conditions = finish.completionConditions ?? [];
  if (!conditions.length) return true;
  const results = conditions.map((condition) => conditionMet(world, condition));
  return finish.completionLogic === 'any' ? results.some(Boolean) : results.every(Boolean);
}

export function updateRuntimeCheckpoints(world: RuntimeWorld): void {
  const candidates = world.scene.objects.filter((object) => object.type === 'checkpoint' && isRuntimeObjectVisible(world, object) && intersects(world.player, runtimeObjectBounds(object))).sort((a, b) => (b.checkpointOrder ?? 1) - (a.checkpointOrder ?? 1));
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
  world.activeCheckpoint = { sceneId: world.scene.id, objectId: checkpoint.id, order, x, y, respawnHealth };
  world.player.spawnX = x; world.player.spawnY = y; world.player.respawnHealth = respawnHealth;
  recordCampaignCheckpoint(world);
}

export function updateRuntimeFinish(world: RuntimeWorld): void {
  if (world.completed || world.player.mode === 'dead') return;
  const finish = world.scene.objects.find((object) => object.type === 'finish' && isRuntimeObjectVisible(world, object) && intersects(world.player, runtimeObjectBounds(object)));
  if (!finish || !canFinish(world, finish)) return;
  const target = resolveFinishTarget(world, finish);
  if (!target) { completeRuntime(world); return; }
  enterRuntimeScene(world, target.scene, target.entryId);
}
