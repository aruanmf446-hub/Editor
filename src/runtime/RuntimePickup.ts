import type { ProjectScene, SceneObjectBase } from '../types/project';
import { intersects } from './RuntimeCollision';
import type { RuntimeBounds, RuntimeWorld } from './RuntimeWorld';

export type RuntimePickupKind = 'health' | 'attack' | 'defense';
export type RuntimePickupMemory = Record<string, number>;

export type RuntimePickupState = RuntimeBounds & {
  id: string;
  sceneId: string;
  kind: RuntimePickupKind;
  amount: number;
  respawnable: boolean;
  respawnDelay: number;
  active: boolean;
  respawnRemaining: number;
  requiresExit: boolean;
};

const PERMANENTLY_COLLECTED = -1;
const MINIMUM_RESPAWN_DELAY = 1 / 60;

function kindFor(object: SceneObjectBase): RuntimePickupKind | null {
  if (object.type === 'pickup-health') return 'health';
  if (object.type === 'pickup-attack') return 'attack';
  if (object.type === 'pickup-defense') return 'defense';
  return null;
}

export function createRuntimePickups(
  scene: ProjectScene,
  memory: RuntimePickupMemory,
): RuntimePickupState[] {
  return scene.objects.flatMap((object) => {
    const kind = kindFor(object);
    if (!kind || !object.visible || object.editorOnly) return [];
    const remembered = memory[object.id] ?? 0;
    const active = remembered === 0;
    return [{
      id: object.id,
      sceneId: scene.id,
      kind,
      x: object.transform.x,
      y: object.transform.y,
      width: object.transform.width,
      height: object.transform.height,
      amount: Math.max(1, Math.floor(object.pickupAmount ?? 1)),
      respawnable: Boolean(object.respawnable),
      respawnDelay: Math.max(MINIMUM_RESPAWN_DELAY, (object.respawnDelayMs ?? 5000) / 1000),
      active,
      respawnRemaining: remembered > 0 ? remembered : 0,
      requiresExit: false,
    }];
  });
}

function tickMemory(memory: RuntimePickupMemory, delta: number): void {
  for (const [id, remaining] of Object.entries(memory)) {
    if (remaining <= 0) continue;
    const next = Math.max(0, remaining - delta);
    if (next === 0) delete memory[id];
    else memory[id] = next;
  }
}

function applyPickup(world: RuntimeWorld, pickup: RuntimePickupState): boolean {
  const player = world.player;
  if (pickup.kind === 'health') {
    if (player.health >= player.maxHealth) return false;
    player.health = Math.min(player.maxHealth, player.health + pickup.amount);
  } else if (pickup.kind === 'attack') {
    player.attack += pickup.amount;
  } else {
    player.defense += pickup.amount;
  }
  return true;
}

export function updateRuntimePickups(world: RuntimeWorld, delta: number): void {
  tickMemory(world.pickupMemory, delta);

  for (const pickup of world.pickups) {
    const remembered = world.pickupMemory[pickup.id] ?? 0;
    pickup.respawnRemaining = remembered > 0 ? remembered : 0;
    if (remembered === PERMANENTLY_COLLECTED) {
      pickup.active = false;
      continue;
    }
    if (remembered > 0) {
      pickup.active = false;
      continue;
    }

    pickup.active = true;
    const overlapping = intersects(world.player, pickup);
    if (pickup.requiresExit) {
      if (!overlapping) pickup.requiresExit = false;
      continue;
    }
    if (!overlapping || world.player.mode === 'dead') continue;
    if (!applyPickup(world, pickup)) continue;

    pickup.active = false;
    pickup.requiresExit = true;
    if (pickup.respawnable) {
      world.pickupMemory[pickup.id] = pickup.respawnDelay;
      pickup.respawnRemaining = pickup.respawnDelay;
    } else {
      world.pickupMemory[pickup.id] = PERMANENTLY_COLLECTED;
    }
  }
}
