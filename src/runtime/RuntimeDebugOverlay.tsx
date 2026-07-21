type Props = { fps: number; scene: string; cameraX: number; cameraY: number; entityCount: number };
export function RuntimeDebugOverlay({ fps, scene, cameraX, cameraY, entityCount }: Props) {
  return <div className="runtime-debug"><strong>Runtime debug</strong><span>FPS {Math.round(fps)}</span><span>Cena {scene}</span><span>Câmera {Math.round(cameraX)}, {Math.round(cameraY)}</span><span>Entidades {entityCount}</span></div>;
}
