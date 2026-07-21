import type { DialogueLine, SceneObjectBase, TriggerAction } from '../types/project';
import { intersects } from './RuntimeCollision';
import type { RuntimeBounds, RuntimePlatformState, RuntimeWorld } from './RuntimeWorld';
import { receivePlayerDamage } from './systems/PlayerCombatSystem';
import { recordCampaignCollectible, recordCampaignStats } from './RuntimeCampaign';

export type RuntimeObjectMemory = Record<string, true>;
const bounds = (object: SceneObjectBase): RuntimeBounds => ({ x: object.transform.x, y: object.transform.y, width: object.transform.width, height: object.transform.height });

export function isRuntimeObjectVisible(world: RuntimeWorld, object: SceneObjectBase): boolean {
  return world.objectVisibilityOverrides?.[object.id] ?? (object.visible && !object.editorOnly);
}

function memory(world: RuntimeWorld, key: 'collectedObjectIds' | 'triggeredObjectIds' | 'activeTriggerContacts' | 'completedDialogueIds'): RuntimeObjectMemory {
  const existing = world[key];
  if (existing) return existing;
  const created: RuntimeObjectMemory = {};
  world[key] = created;
  return created;
}

function normalizedDialogueLines(object: SceneObjectBase): DialogueLine[] {
  if (!object.dialogueLines?.length) return [{ id: `${object.id}-aviso`, speaker: '', text: object.name, durationMs: 1500 }];
  return object.dialogueLines.filter((line) => line.text.trim().length > 0).map((line, index) => ({ ...line, id: line.id?.trim() || `${object.id}-fala-${index + 1}`, speaker: line.speaker?.trim() || '', text: line.text.trim(), durationMs: Math.max(250, line.durationMs ?? 2500) }));
}

export function startRuntimeDialogue(world: RuntimeWorld, object: SceneObjectBase, contactOnly = false): boolean {
  if (object.type !== 'dialogue-zone' || !isRuntimeObjectVisible(world, object)) return false;
  if (object.dialogueOnce && memory(world, 'completedDialogueIds')[object.id]) return false;
  const lines = normalizedDialogueLines(object);
  if (!lines.length) return false;
  world.activeDialogue = { objectId: object.id, lines, lineIndex: 0, lineElapsed: 0, advanceMode: contactOnly ? 'auto' : object.dialogueAdvanceMode ?? 'manual', blockPlayer: contactOnly ? false : object.dialogueBlockPlayer ?? true, once: Boolean(object.dialogueOnce), contactOnly };
  world.dialogueAdvanceRequested = false;
  return true;
}

function finishDialogue(world: RuntimeWorld): void {
  const dialogue = world.activeDialogue;
  if (!dialogue) return;
  memory(world, 'completedDialogueIds')[dialogue.objectId] = true;
  world.activeDialogue = null;
  world.dialogueAdvanceRequested = false;
}

function updateDialogues(world: RuntimeWorld, delta: number): void {
  const active = world.activeDialogue;
  if (active) {
    const source = world.scene.objects.find((object) => object.id === active.objectId);
    if (active.contactOnly) { if (!source || !intersects(world.player, bounds(source))) world.activeDialogue = null; return; }
    active.lineElapsed += Math.max(0, delta);
    const line = active.lines[active.lineIndex];
    const duration = Math.max(0.25, (line?.durationMs ?? 2500) / 1000);
    const manual = Boolean(world.dialogueAdvanceRequested) && (active.advanceMode === 'manual' || active.advanceMode === 'both');
    const automatic = active.lineElapsed >= duration && (active.advanceMode === 'auto' || active.advanceMode === 'both');
    if (!manual && !automatic) return;
    world.dialogueAdvanceRequested = false;
    active.lineIndex += 1;
    active.lineElapsed = 0;
    if (active.lineIndex >= active.lines.length) finishDialogue(world);
    return;
  }
  const dialogue = world.scene.objects.find((object) => object.type === 'dialogue-zone' && isRuntimeObjectVisible(world, object) && intersects(world.player, bounds(object)) && !(object.dialogueOnce && memory(world, 'completedDialogueIds')[object.id]));
  if (dialogue) startRuntimeDialogue(world, dialogue, !dialogue.dialogueLines?.length);
}

export function isPlayerBlockedByDialogue(world: RuntimeWorld): boolean { return Boolean(world.activeDialogue?.blockPlayer); }

function updateNoCollisionZone(world: RuntimeWorld): void {
  world.playerNoCollision = world.scene.objects.some((object) => object.type === 'no-collision-zone' && isRuntimeObjectVisible(world, object) && intersects(world.player, bounds(object)));
}

function updateDropZones(world: RuntimeWorld): void {
  if (world.player.mode === 'dead') return;
  const dropped = world.scene.objects.some((object) => object.type === 'drop-zone' && isRuntimeObjectVisible(world, object) && intersects(world.player, bounds(object)));
  if (!dropped) return;
  world.player.invulnerabilityRemaining = 0;
  world.player.defending = false;
  receivePlayerDamage(world, { amount: world.player.health + world.player.defense + 999, sourceX: null, damageType: 'environmental' });
}

function platformFromObject(object: SceneObjectBase): RuntimePlatformState | null {
  if (object.type !== 'platform' && object.type !== 'wall' && object.type !== 'obstacle') return null;
  return { id: object.id, ...bounds(object), oneWay: object.type === 'platform' && Boolean(object.passThrough) };
}

function setCollisionEnabled(world: RuntimeWorld, object: SceneObjectBase, enabled: boolean): void {
  world.collisionEnabledOverrides ??= {};
  world.collisionEnabledOverrides[object.id] = enabled;
  world.platforms = world.platforms.filter((platform) => platform.id !== object.id);
  const platform = platformFromObject(object);
  if (enabled && platform) world.platforms.push(platform);
}

export function executeTriggerAction(world: RuntimeWorld, action: TriggerAction): void {
  if (action.type === 'set-variable') { world.variables ??= {}; world.variables[action.key] = action.value; recordCampaignStats(world); return; }
  if (action.type === 'set-camera') { world.cameraOverride = { x: action.x, y: action.y, remaining: Math.max(0, action.durationMs / 1000) }; return; }
  if (action.type === 'transition-scene') { world.pendingSceneTransition = { sceneId: action.targetSceneId, entryId: action.targetEntryId?.trim() || undefined }; return; }
  const target = world.scene.objects.find((object) => object.id === action.targetObjectId);
  if (!target) return;
  if (action.type === 'set-object-visible') { world.objectVisibilityOverrides ??= {}; world.objectVisibilityOverrides[target.id] = action.visible; }
  else if (action.type === 'set-collision-enabled') setCollisionEnabled(world, target, action.enabled);
  else if (action.type === 'activate-enemy') { const enemy = world.enemies.find((candidate) => candidate.sourceObjectId === target.id); if (enemy && enemy.health > 0) { enemy.removed = !action.active; enemy.velocityX = 0; } }
  else if (action.type === 'start-dialogue') startRuntimeDialogue(world, target);
}

function updateTriggers(world: RuntimeWorld): void {
  const triggered = memory(world, 'triggeredObjectIds');
  const contacts = memory(world, 'activeTriggerContacts');
  for (const object of world.scene.objects) {
    if (object.type !== 'trigger' || !isRuntimeObjectVisible(world, object)) continue;
    const overlapping = intersects(world.player, bounds(object));
    if (!overlapping) { delete contacts[object.id]; continue; }
    if (contacts[object.id]) continue;
    contacts[object.id] = true;
    if (object.triggerOnce && triggered[object.id]) continue;
    triggered[object.id] = true;
    world.lastTriggerId = object.triggerId?.trim() || object.id;
    for (const action of object.triggerActions ?? []) executeTriggerAction(world, action);
  }
}

function updateCollectibles(world: RuntimeWorld): void {
  const collected = memory(world, 'collectedObjectIds');
  world.collectibleTotals ??= {};
  for (const object of world.scene.objects) {
    if (object.type !== 'collectible' || !isRuntimeObjectVisible(world, object) || collected[object.id]) continue;
    if (world.player.mode === 'dead' || !intersects(world.player, bounds(object))) continue;
    collected[object.id] = true;
    const definition = object.collectible;
    const collectibleId = definition?.id?.trim() || object.id;
    const value = Math.max(1, definition?.value ?? 1);
    world.collectibleTotals[collectibleId] = (world.collectibleTotals[collectibleId] ?? 0) + value;
    recordCampaignCollectible(world, object.id, collectibleId, value);
    for (const action of definition?.actions ?? []) executeTriggerAction(world, action);
  }
  world.collectiblesRemaining = world.scene.objects.filter((object) => object.type === 'collectible' && isRuntimeObjectVisible(world, object) && !collected[object.id]).length;
}

export function updateRuntimeAdvancedObjects(world: RuntimeWorld, delta = 0): void {
  updateNoCollisionZone(world); updateDropZones(world); updateTriggers(world); updateDialogues(world, delta); updateCollectibles(world);
}

export function resetRuntimeSceneObjectState(world: RuntimeWorld): void {
  world.playerNoCollision = false; world.activeDialogue = null; world.dialogueAdvanceRequested = false; world.lastTriggerId = null; world.activeTriggerContacts = {}; world.objectVisibilityOverrides = {}; world.collisionEnabledOverrides = {}; world.pendingSceneTransition = null; world.cameraOverride = null;
  for (const object of world.scene.objects) {
    if ((object.type === 'enemy-cactus' || object.type === 'boss') && object.enemyActiveAtStart === false) {
      const enemy = world.enemies.find((candidate) => candidate.sourceObjectId === object.id);
      if (enemy) enemy.removed = true;
    }
  }
  updateCollectibles(world);
}