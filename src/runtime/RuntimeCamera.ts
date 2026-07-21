export type RuntimeCameraState = { x: number; y: number };
export function updateRuntimeCamera(camera: RuntimeCameraState, targetX: number, targetY: number, viewportWidth: number, viewportHeight: number, worldWidth: number, worldHeight: number, smoothing = 0.12): RuntimeCameraState {
  const maxX = Math.max(0, worldWidth - viewportWidth);
  const maxY = Math.max(0, worldHeight - viewportHeight);
  const desiredX = Math.min(maxX, Math.max(0, targetX - viewportWidth / 2));
  const desiredY = Math.min(maxY, Math.max(0, targetY - viewportHeight * 0.58));
  return { x: camera.x + (desiredX - camera.x) * smoothing, y: camera.y + (desiredY - camera.y) * Math.min(smoothing, 0.06) };
}
