import type { RuntimeWorld } from './RuntimeWorld';
import { isPlayerBlockedByDialogue, updateRuntimeAdvancedObjects } from './RuntimeAdvancedObjects';
import { resolvePlayerVisualState } from './RuntimePlayer';
import { updateRuntimeEnemies } from './RuntimeEnemy';
import { updateRuntimePickups } from './RuntimePickup';
import { updatePlayerMovement } from './systems/PlayerMovementSystem';
import { updatePlayerCombat } from './systems/PlayerCombatSystem';
import { applyGravity } from './systems/GravitySystem';
import { resolveWorldMovement } from './systems/CollisionSystem';
import { updateCamera } from './systems/CameraSystem';
import { enterRuntimeScene, updateRuntimeCheckpoints, updateRuntimeFinish } from './systems/RuntimeSceneSystem';

function processPendingSceneTransition(world: RuntimeWorld): boolean {
  const targetId = world.pendingSceneTransitionId;
  if (!targetId) return false;
  world.pendingSceneTransitionId = null;
  const target = world.project.scenes.find((scene) => scene.id === targetId);
  if (!target) return false;
  enterRuntimeScene(world, target);
  return true;
}

export function updateRuntimeWorld(world: RuntimeWorld, delta: number) {
  if (world.paused) return;
  world.player.renderPreviousX = world.player.x;
  world.player.renderPreviousY = world.player.y;
  updateRuntimeAdvancedObjects(world, delta);
  if (processPendingSceneTransition(world)) {
    updateCamera(world, delta);
    return;
  }

  const dialogueBlocksPlayer = isPlayerBlockedByDialogue(world);
  if (dialogueBlocksPlayer) {
    world.player.velocityX = 0;
    world.player.velocityY = 0;
    world.player.attackHitbox = null;
    world.player.defending = false;
    if (world.player.mode !== 'dead' && world.player.mode !== 'hurt') world.player.mode = 'idle';
  } else {
    updatePlayerCombat(world, delta);
    updatePlayerMovement(world, delta);
    if (world.player.mode !== 'dead') {
      applyGravity(world, delta);
      resolveWorldMovement(world, delta);
    }
  }

  updateRuntimeAdvancedObjects(world, 0);
  if (processPendingSceneTransition(world)) {
    updateCamera(world, delta);
    return;
  }
  updateRuntimeEnemies(world, delta);
  updateRuntimePickups(world, delta);
  updateRuntimeCheckpoints(world);
  updateRuntimeFinish(world);
  world.player.visualState = resolvePlayerVisualState(world.player);
  updateCamera(world, delta);
}
