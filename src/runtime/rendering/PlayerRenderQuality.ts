import { RUNTIME_CONFIG } from '../RuntimeConfig';

export function calculatePlayerRendererPixelRatio(
  width: number,
  height: number,
  devicePixelRatio: number,
): number {
  const safeWidth = Math.max(1, Number.isFinite(width) ? width : 1);
  const safeHeight = Math.max(1, Number.isFinite(height) ? height : 1);
  const safeDeviceRatio = Math.max(1, Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1);
  const budgetRatio = Math.sqrt(RUNTIME_CONFIG.playerRendererPixelBudget / (safeWidth * safeHeight));

  return Math.max(
    RUNTIME_CONFIG.playerRendererMinPixelRatio,
    Math.min(safeDeviceRatio, RUNTIME_CONFIG.playerRendererMaxPixelRatio, budgetRatio),
  );
}
