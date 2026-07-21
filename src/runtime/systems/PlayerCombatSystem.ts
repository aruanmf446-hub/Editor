import { RUNTIME_CONFIG } from '../RuntimeConfig';
import type { RuntimePlayerState } from '../RuntimePlayer';
import type { RuntimeBounds, RuntimeWorld } from '../RuntimeWorld';
import { respawnPlayerSafely } from './CollisionSystem';

export type PlayerDamageResult = 'ignored' | 'blocked' | 'damaged' | 'killed';

function createAttackHitbox(player: RuntimePlayerState): RuntimeBounds {
  const height = player.standingHeight * RUNTIME_CONFIG.attackHeightFactor;
  return {
    x: player.direction === 'right' ? player.x + player.width : player.x - RUNTIME_CONFIG.attackReach,
    y: player.y + (player.height - height) / 2,
    width: RUNTIME_CONFIG.attackReach,
    height,
  };
}

export function receivePlayerDamage(world: RuntimeWorld, amount: number, sourceX: number): PlayerDamageResult {
  const player = world.player;
  if (player.mode === 'dead' || player.invulnerabilityRemaining > 0 || amount <= 0) return 'ignored';
  if (player.defending) return 'blocked';

  const applied = Math.max(1, amount - player.defense);
  player.health = Math.max(0, player.health - applied);
  player.attackHitbox = null;
  player.defending = false;

  if (player.health === 0) {
    player.mode = 'dead';
    player.visualState = 'dead';
    player.deathRemaining = RUNTIME_CONFIG.deathDuration;
    player.velocityX = 0;
    player.velocityY = 0;
    return 'killed';
  }

  player.mode = 'hurt';
  player.visualState = 'hurt';
  player.hurtRemaining = RUNTIME_CONFIG.damageInvulnerability;
  player.invulnerabilityRemaining = RUNTIME_CONFIG.damageInvulnerability;
  const direction = player.x + player.width / 2 < sourceX ? -1 : 1;
  player.velocityX = direction * RUNTIME_CONFIG.knockbackSpeedX;
  player.velocityY = -RUNTIME_CONFIG.knockbackSpeedY;
  player.grounded = false;
  return 'damaged';
}

export function updatePlayerCombat(world: RuntimeWorld, delta: number): void {
  const player = world.player;
  player.attackCooldownRemaining = Math.max(0, player.attackCooldownRemaining - delta);
  player.invulnerabilityRemaining = Math.max(0, player.invulnerabilityRemaining - delta);

  if (player.mode === 'dead') {
    player.deathRemaining = Math.max(0, player.deathRemaining - delta);
    if (player.deathRemaining === 0 && respawnPlayerSafely(world)) {
      player.health = player.maxHealth;
      player.invulnerabilityRemaining = RUNTIME_CONFIG.respawnInvulnerability;
    }
    return;
  }

  if (player.mode === 'hurt') {
    player.hurtRemaining = Math.max(0, player.hurtRemaining - delta);
    if (player.hurtRemaining === 0) player.mode = player.grounded ? 'idle' : 'fall';
    return;
  }

  if (player.mode === 'attack') {
    player.attackElapsed += delta;
    const active = player.attackElapsed >= RUNTIME_CONFIG.attackActiveStart && player.attackElapsed <= RUNTIME_CONFIG.attackActiveEnd;
    player.attackHitbox = active ? createAttackHitbox(player) : null;
    if (player.attackElapsed >= RUNTIME_CONFIG.attackDuration) {
      player.mode = player.grounded ? 'idle' : 'fall';
      player.attackElapsed = 0;
      player.attackHitbox = null;
      player.attackCooldownRemaining = RUNTIME_CONFIG.attackCooldown;
    }
    return;
  }

  player.defending = Boolean(world.input.defend) && player.grounded && !player.crouching;
  if (player.defending) {
    player.mode = 'defend';
    player.velocityX = 0;
    return;
  }
  if (player.mode === 'defend') player.mode = 'idle';

  if (world.input.attackPressed && player.attackCooldownRemaining === 0 && !player.crouching) {
    player.mode = 'attack';
    player.attackElapsed = 0;
    player.attackHitbox = null;
  }
}
