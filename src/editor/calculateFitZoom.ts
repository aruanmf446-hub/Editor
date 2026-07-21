export type FitZoomInput = {
  availableWidth: number;
  availableHeight: number;
  sceneWidth: number;
  sceneHeight: number;
  padding?: number;
  minZoom?: number;
  maxZoom?: number;
};

export function calculateFitZoom({
  availableWidth,
  availableHeight,
  sceneWidth,
  sceneHeight,
  padding = 48,
  minZoom = 0.1,
  maxZoom = 2,
}: FitZoomInput): number {
  const values = [availableWidth, availableHeight, sceneWidth, sceneHeight, padding, minZoom, maxZoom];
  if (values.some((value) => !Number.isFinite(value)) || availableWidth <= 0 || availableHeight <= 0 || sceneWidth <= 0 || sceneHeight <= 0) return 1;
  const safeMin = Math.max(0.01, Math.min(minZoom, maxZoom));
  const safeMax = Math.max(safeMin, maxZoom);
  const safePadding = Math.max(0, padding);
  const usableWidth = Math.max(1, availableWidth - Math.min(safePadding * 2, availableWidth - 1));
  const usableHeight = Math.max(1, availableHeight - Math.min(safePadding * 2, availableHeight - 1));
  const zoom = Math.min(usableWidth / sceneWidth, usableHeight / sceneHeight);
  if (!Number.isFinite(zoom) || zoom <= 0) return 1;
  return Math.min(safeMax, Math.max(safeMin, zoom));
}
