import { RUNTIME_CONFIG } from '../RuntimeConfig';
import { canStand } from '../RuntimeCollision';
import type { RuntimeWorld } from '../RuntimeWorld';

const approach = (value: number, target: number, amount: number) => value < target ? Math.min(value + amount, target) : Math.max(value - amount, target);

export function updatePlayerMovement(world: RuntimeWorld, delta: number) {
  const { player, input } = world;
  const axis = Number(input.right) - Number(input.left);
  const targetSpeed = axis * RUNTIME_CONFIG.playerMaxSpeed;
  player.velocityX = approach(player.velocityX, targetSpeed, (axis === 0 ? RUNTIME_CONFIG.playerDeceleration : RUNTIME_CONFIG.playerAcceleration) * delta);
  if (axis !== 0) player.direction = axis < 0 ? 'left' : 'right';

  if (input.jump) player.jumpBufferRemaining = RUNTIME_CONFIG.jumpBuffer;
  else player.jumpBufferRemaining = Math.max(0, player.jumpBufferRemaining - delta);
  player.coyoteRemaining = player.grounded ? RUNTIME_CONFIG.coyoteTime : Math.max(0, player.coyoteRemaining - delta);

  const wantsCrouch = input.down;
  if (wantsCrouch && !player.crouching) {
    const nextHeight = player.standingHeight * RUNTIME_CONFIG.crouchHeightFactor;
    player.y += player.height - nextHeight; player.height = nextHeight; player.crouching = true;
  } else if (!wantsCrouch && player.crouching && canStand(player, world.platforms, player.standingHeight)) {
    player.y -= player.standingHeight - player.height; player.height = player.standingHeight; player.crouching = false;
  }

  if (player.crouching) player.velocityX = approach(player.velocityX, 0, RUNTIME_CONFIG.playerDeceleration * delta);
  if (!player.crouching && player.jumpBufferRemaining > 0 && player.coyoteRemaining > 0) {
    player.velocityY = -RUNTIME_CONFIG.playerJumpSpeed;
    player.grounded = false; player.coyoteRemaining = 0; player.jumpBufferRemaining = 0;
  }
}
