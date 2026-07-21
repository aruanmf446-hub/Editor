import type { SceneObjectBase } from '../types/project';
import { intersects } from './RuntimeCollision';
import type { RuntimeBounds, RuntimeWorld } from './RuntimeWorld';
import { receivePlayerDamage } from './systems/PlayerCombatSystem';

export type RuntimeObjectMemory = Record<string, true>;

function bounds(object: SceneObjectBase): RuntimeBounds {
  return {
    x: object.transform.x,
    y: object.transform.y,
    width: object.transform.width,
    height: object.transform.height,
  };
}

function visibleRuntimeObject(object: SceneObjectBase): boolean {
  return object.visible && !object.editorOnly;
}

function memory(world: RuntimeWorld, key: 'collectedObjectIds' | 'triggeredObjectIds' | 'activeTriggerContacts'): RuntimeObjectMemory {
  const existing = world[key];
  if (existing) return existing;
  const created: RuntimeObjectMemory = {};
  world[key] = created;
  return created;
}

function updateNoCollisionZone(world: RuntimeWorld): void {
  world.playerNoCollision = world.scene.objects.some((object) =>
    object.type === 'no-collision-zone'
    && visibleRuntimeObject(object)
    && intersects(world.player, bounds(object))
  );
}

function updateDropZones(world: RuntimeWorld): void {
  if (world.player.mode === 'dead') return;
  const dropped = world.scene.objects.some((object) =>
    object.type === 'drop-zone'
    && visibleRuntimeObject(object)
    && intersects(world.player, bounds(object))
  );
  if (!dropped) return;

  world.player.invulnerabilityRemaining = 0;
  world.player.defending = false;
  receivePlayerDamage(world, {
    amount: world.player.health + world.player.defense + 999,
    sourceX: null,
    damageType: 'environmental',
  });
}

function updateTriggers(world: RuntimeWorld): void {
  const triggered = memory(world, 'triggeredObjectIds');
  const contacts = memory(world, 'activeTriggerContacts');

  for (const object of world.scene.objects) {
    if (object.type !== 'trigger' || !visibleRuntimeObject(object)) continue;
    const overlapping = intersects(world.player, bounds(object));
    if (!overlapping) {
      delete contacts[object.id];
      continue;
    }
    if (contacts[object.id]) continue;
    contacts[object.id] = true;
    if (object.triggerOnce && triggered[object.id]) continue;

    triggered[object.id] = true;
    world.lastTriggerId = object.triggerId?.trim() || object.id;
  }
}

function updateDialogues(world: RuntimeWorld): void {
  const dialogue = world.scene.objects.find((object) =>
    object.type === 'dialogue-zone'
    && visibleRuntimeObject(object)
    && intersects(world.player, bounds(object))
  );
  world.activeDialogue = dialogue?.name ?? null;
}

function updateCollectibles(world: RuntimeWorld): void {
  const collected = memory(world, 'collectedObjectIds');
  for (const object of world.scene.objects) {
    if (object.type !== 'collectible' || !visibleRuntimeObject(object) || collected[object.id]) continue;
    if (world.player.mode !== 'dead' && intersects(world.player, bounds(object))) collected[object.id] = true;
  }

  world.collectiblesRemaining = world.scene.objects.filter((object) =>
    object.type === 'collectible'
    && visibleRuntimeObject(object)
    && !collected[object.id]
  ).length;
}

/**
 * Interpreta os objetos avançados diretamente do projeto. A função é segura
 * para ser chamada antes e depois do movimento no mesmo passo físico.
 */
export function updateRuntimeAdvancedObjects(world: RuntimeWorld): void {
  updateNoCollisionZone(world);
  updateDropZones(world);
  updateTriggers(world);
  updateDialogues(world);
  updateCollectibles(world);
}

export function resetRuntimeSceneObjectState(world: RuntimeWorld): void {
  world.playerNoCollision = false;
  world.activeDialogue = null;
  world.lastTriggerId = null;
  world.activeTriggerContacts = {};
  updateCollectibles(world);
}
