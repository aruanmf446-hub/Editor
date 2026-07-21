import type { RuntimeWorld } from './RuntimeWorld';

type Props = { fps: number; world: RuntimeWorld };

export function RuntimeDebugOverlay({ fps, world }: Props) {
  const { player, camera } = world;
  return <div className="runtime-debug">
    <strong>Runtime debug</strong>
    <span>FPS {Math.round(fps)} · passos {world.physicsSteps}</span>
    <span>Acumulador {world.accumulator.toFixed(4)}</span>
    <span>Player {player.x.toFixed(2)}, {player.y.toFixed(2)}</span>
    <span>Anterior {player.previousX.toFixed(2)}, {player.previousY.toFixed(2)}</span>
    <span>Velocidade {player.velocityX.toFixed(2)}, {player.velocityY.toFixed(2)}</span>
    <span>{player.grounded ? 'No chão' : 'No ar'} · {player.crouching ? 'agachado' : 'em pé'}</span>
    <span>Estado {player.visualState}</span>
    <span>Coyote {player.coyoteRemaining.toFixed(3)} · buffer {player.jumpBufferRemaining.toFixed(3)}</span>
    <span>Colisão {player.lastCollisionSide ?? 'nenhuma'}</span>
    <span>Câmera {camera.x.toFixed(1)}, {camera.y.toFixed(1)}</span>
    <span>Hitbox {player.width.toFixed(1)} × {player.height.toFixed(1)}</span>
    <span>Colisores {world.platforms.length}</span>
  </div>;
}
