import { RUNTIME_CONFIG } from '../RuntimeConfig';
import type { RuntimePlayerState } from '../RuntimePlayer';
import type { RuntimeBounds, RuntimeWorld } from '../RuntimeWorld';
import { respawnPlayerSafely } from './CollisionSystem';

export type PlayerDamageResult = 'ignored' | 'blocked' | 'damaged' | 'killed';
export type PlayerDamageType = 'physical' | 'environmental' | 'projectile' | 'unknown';
export type PlayerDamageInput = { amount: number; sourceX?: number | null; damageType?: PlayerDamageType };

function createAttackHitbox(player: RuntimePlayerState): RuntimeBounds {
  const height = player.standingHeight * RUNTIME_CONFIG.attackHeightFactor;
  return { x: player.direction === 'right' ? player.x + player.width : player.x - RUNTIME_CONFIG.attackReach, y: player.y + (player.height - height) / 2, width: RUNTIME_CONFIG.attackReach, height };
}

function getKnockbackDirection(player: RuntimePlayerState, sourceX?: number | null): -1 | 1 {
  if (sourceX == null || !Number.isFinite(sourceX)) return player.direction === 'right' ? -1 : 1;
  const playerCenterX = player.x + player.width / 2;
  if (playerCenterX === sourceX) return player.direction === 'right' ? -1 : 1;
  return playerCenterX >= sourceX ? 1 : -1;
}

function verticallyOverlaps(a: RuntimeBounds, b: RuntimeBounds): boolean {
  return a.y < b.y + b.height && a.y + a.height > b.y;
}

function physicalSourceTouchesPlayer(world: RuntimeWorld, sourceX?: number | null): boolean {
  if (sourceX == null || !Number.isFinite(sourceX)) return true;
  const source = world.enemies
    .filter((enemy) => !enemy.removed && enemy.health > 0)
    .sort((a, b) => Math.abs((a.x + a.width / 2) - sourceX) - Math.abs((b.x + b.width / 2) - sourceX))[0];
  return source ? verticallyOverlaps(world.player, source) : true;
}

/** Defense currently blocks every finite positive damage event while grounded. */
export function receivePlayerDamage(world: RuntimeWorld, input: number | PlayerDamageInput, legacySourceX?: number): PlayerDamageResult {
  const player = world.player;
  const damage = typeof input === 'number' ? { amount: input, sourceX: legacySourceX, damageType: 'unknown' as const } : input;
  if (player.mode === 'dead' || player.invulnerabilityRemaining > 0) return 'ignored';
  if (!Number.isFinite(damage.amount) || damage.amount <= 0) return 'ignored';
  if (damage.damageType === 'physical' && !physicalSourceTouchesPlayer(world, damage.sourceX)) return 'ignored';
  if (player.defending) return 'blocked';

  const applied = Math.max(1, Math.floor(damage.amount - player.defense));
  player.health = Math.max(0, player.health - applied);
  player.attackHitbox = null;
  player.defending = false;

  if (player.health === 0) {
    world.campaignDeaths = (world.campaignDeaths ?? 0) + 1;
    player.lives = Math.max(0, player.lives - 1);
    player.mode = 'dead'; player.visualState = 'dead'; player.deathRemaining = RUNTIME_CONFIG.deathDuration;
    player.invulnerabilityRemaining = 0; player.velocityX = 0; player.velocityY = 0;
    if (player.lives === 0) {
      world.gameOverReason = 'no-lives';
      world.completed = true;
      world.paused = true;
    }
    return 'killed';
  }

  player.mode = 'hurt'; player.visualState = 'hurt';
  player.hurtRemaining = RUNTIME_CONFIG.damageInvulnerability;
  player.invulnerabilityRemaining = RUNTIME_CONFIG.damageInvulnerability;
  const direction = getKnockbackDirection(player, damage.sourceX);
  player.velocityX = direction * RUNTIME_CONFIG.knockbackSpeedX;
  player.velocityY = -RUNTIME_CONFIG.knockbackSpeedY;
  player.grounded = false;
  return 'damaged';
}

export function updatePlayerCombat(world: RuntimeWorld, delta: number): void {
  const player = world.player;
  player.attackCooldownRemaining = Math.max(0, player.attackCooldownRemaining - delta);
  player.invulnerabilityRemaining = Math.max(0, player.invulnerabilityRemaining - delta);
  if (player.mode !== 'attack' && player.attackHitbox) player.attackHitbox = null;

  if (player.mode === 'dead') {
    player.deathRemaining = Math.max(0, player.deathRemaining - delta);
    if (!world.completed && player.deathRemaining === 0 && respawnPlayerSafely(world)) {
      player.health = Math.min(player.maxHealth, Math.max(1, player.respawnHealth));
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
    const previousElapsed = player.attackElapsed;
    const nextElapsed = previousElapsed + delta;
    player.attackElapsed = nextElapsed;
    const overlapsActiveWindow = previousElapsed < RUNTIME_CONFIG.attackActiveEnd && nextElapsed >= RUNTIME_CONFIG.attackActiveStart;
    player.attackHitbox = overlapsActiveWindow ? createAttackHitbox(player) : null;
    if (nextElapsed >= RUNTIME_CONFIG.attackDuration) {
      player.mode = player.grounded ? 'idle' : 'fall'; player.attackElapsed = 0; player.attackHitbox = null;
      player.attackCooldownRemaining = RUNTIME_CONFIG.attackCooldown;
    }
    return;
  }

  player.defending = Boolean(world.input.defend) && player.grounded && !player.crouching;
  if (player.defending) { player.mode = 'defend'; player.velocityX = 0; return; }
  if (player.mode === 'defend') player.mode = 'idle';

  if (world.input.attackPressed && player.attackCooldownRemaining === 0 && !player.crouching && !player.defending) {
    player.mode = 'attack'; player.attackSerial += 1; player.attackElapsed = 0; player.attackHitbox = null;
  }
}
