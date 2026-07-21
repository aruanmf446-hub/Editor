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
  if (availableWidth <= 0 || availableHeight <= 0 || sceneWidth <= 0 || sceneHeight <= 0) {
    return minZoom;
  }
  const usableWidth = Math.max(1, availableWidth - padding * 2);
  const usableHeight = Math.max(1, availableHeight - padding * 2);
  const zoom = Math.min(usableWidth / sceneWidth, usableHeight / sceneHeight);
  return Math.min(maxZoom, Math.max(minZoom, zoom));
}
