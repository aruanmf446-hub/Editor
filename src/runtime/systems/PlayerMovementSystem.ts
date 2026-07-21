import { RUNTIME_CONFIG } from '../RuntimeConfig';
import { canPlayerStand, setPlayerCrouching } from '../RuntimePlayer';
import type { RuntimeWorld } from '../RuntimeWorld';

const approach = (value: number, target: number, amount: number) => value < target ? Math.min(value + amount, target) : Math.max(value - amount, target);

export function updatePlayerMovement(world: RuntimeWorld, delta: number) {
  const { player, input } = world;
  const movementLocked = player.mode === 'dead' || player.mode === 'hurt' || player.mode === 'attack' || player.mode === 'defend';

  if (movementLocked) {
    if (player.mode === 'attack' || player.mode === 'defend' || player.mode === 'dead') {
      player.velocityX = approach(player.velocityX, 0, RUNTIME_CONFIG.playerDeceleration * delta);
    }
    return;
  }

  const axis = Number(input.right) - Number(input.left);
  const targetSpeed = axis * RUNTIME_CONFIG.playerMaxSpeed;
  player.velocityX = approach(player.velocityX, targetSpeed, (axis === 0 ? RUNTIME_CONFIG.playerDeceleration : RUNTIME_CONFIG.playerAcceleration) * delta);
  if (axis !== 0) player.direction = axis < 0 ? 'left' : 'right';

  if (player.grounded) {
    player.coyoteRemaining = RUNTIME_CONFIG.coyoteTime;
    player.airJumpsRemaining = player.doubleJumpEnabled ? 1 : 0;
  } else player.coyoteRemaining = Math.max(0, player.coyoteRemaining - delta);

  if (input.jumpPressed) player.jumpBufferRemaining = RUNTIME_CONFIG.jumpBuffer;
  else player.jumpBufferRemaining = Math.max(0, player.jumpBufferRemaining - delta);

  if (input.jumpReleased && player.velocityY < 0) player.velocityY *= RUNTIME_CONFIG.jumpReleaseMultiplier;

  if (input.crouch && !player.crouching) setPlayerCrouching(player, true);
  else if (!input.crouch && player.crouching && canPlayerStand(player, world.platforms)) setPlayerCrouching(player, false);

  if (player.crouching) player.velocityX = approach(player.velocityX, 0, RUNTIME_CONFIG.playerDeceleration * delta);
  if (player.crouching || player.jumpBufferRemaining <= 0) return;

  const canGroundJump = player.grounded || player.coyoteRemaining > 0;
  const canAirJump = !canGroundJump && player.doubleJumpEnabled && player.airJumpsRemaining > 0;
  if (!canGroundJump && !canAirJump) return;

  player.velocityY = -RUNTIME_CONFIG.playerJumpSpeed;
  player.grounded = false;
  player.coyoteRemaining = 0;
  player.jumpBufferRemaining = 0;
  if (canAirJump) player.airJumpsRemaining -= 1;
}