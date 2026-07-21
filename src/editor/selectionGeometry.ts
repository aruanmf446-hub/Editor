import type { ProjectScene, SceneObjectBase, Transform2D } from '../types/project';

export type AlignMode = 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom';
export type DistributeMode = 'horizontal' | 'vertical';
export type LayerMode = 'front' | 'forward' | 'backward' | 'back';
export type Rect = { x: number; y: number; width: number; height: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function normalizeRect(startX: number, startY: number, endX: number, endY: number): Rect {
  return { x: Math.min(startX, endX), y: Math.min(startY, endY), width: Math.abs(endX - startX), height: Math.abs(endY - startY) };
}

export function pointerToScene(clientX: number, clientY: number, canvasRect: Pick<DOMRect, 'left' | 'top'>, zoom: number, sceneWidth: number, sceneHeight: number): { x: number; y: number } {
  if (!Number.isFinite(zoom) || zoom <= 0) return { x: 0, y: 0 };
  return { x: clamp((clientX - canvasRect.left) / zoom, 0, sceneWidth), y: clamp((clientY - canvasRect.top) / zoom, 0, sceneHeight) };
}

export function getSelectionIntersection(objects: SceneObjectBase[], rect: Rect): string[] {
  return objects.filter(object => object.visible && object.transform.x < rect.x + rect.width && object.transform.x + object.transform.width > rect.x && object.transform.y < rect.y + rect.height && object.transform.y + object.transform.height > rect.y).map(object => object.id);
}

function bounded(transform: Transform2D, scene: ProjectScene): Transform2D {
  const width = clamp(transform.width, 1, scene.width);
  const height = clamp(transform.height, 1, scene.height);
  return { ...transform, width, height, x: clamp(transform.x, 0, Math.max(0, scene.width - width)), y: clamp(transform.y, 0, Math.max(0, scene.height - height)) };
}

export function alignObjects(scene: ProjectScene, selectedIds: string[], mode: AlignMode): ProjectScene {
  const selectedSet = new Set(selectedIds);
  const selected = scene.objects.filter(object => selectedSet.has(object.id) && !object.locked);
  if (selected.length < 2) return scene;
  const left = Math.min(...selected.map(object => object.transform.x));
  const right = Math.max(...selected.map(object => object.transform.x + object.transform.width));
  const top = Math.min(...selected.map(object => object.transform.y));
  const bottom = Math.max(...selected.map(object => object.transform.y + object.transform.height));
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;
  return { ...scene, objects: scene.objects.map(object => {
    if (!selectedSet.has(object.id) || object.locked) return object;
    const current = object.transform;
    const next = mode === 'left' ? { ...current, x: left }
      : mode === 'center-x' ? { ...current, x: centerX - current.width / 2 }
        : mode === 'right' ? { ...current, x: right - current.width }
          : mode === 'top' ? { ...current, y: top }
            : mode === 'center-y' ? { ...current, y: centerY - current.height / 2 }
              : { ...current, y: bottom - current.height };
    return { ...object, transform: bounded(next, scene) };
  }) };
}

export function distributeObjects(scene: ProjectScene, selectedIds: string[], mode: DistributeMode): ProjectScene {
  const selectedSet = new Set(selectedIds);
  const selected = scene.objects.filter(object => selectedSet.has(object.id) && !object.locked);
  if (selected.length < 3) return scene;
  const sorted = [...selected].sort((a, b) => mode === 'horizontal' ? a.transform.x - b.transform.x : a.transform.y - b.transform.y);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const totalSize = sorted.reduce((sum, object) => sum + (mode === 'horizontal' ? object.transform.width : object.transform.height), 0);
  const span = mode === 'horizontal' ? last.transform.x + last.transform.width - first.transform.x : last.transform.y + last.transform.height - first.transform.y;
  if (span < totalSize) return scene;
  const gap = (span - totalSize) / (sorted.length - 1);
  let cursor = mode === 'horizontal' ? first.transform.x : first.transform.y;
  const next = new Map<string, Transform2D>();
  for (const object of sorted) {
    next.set(object.id, bounded(mode === 'horizontal' ? { ...object.transform, x: cursor } : { ...object.transform, y: cursor }, scene));
    cursor += (mode === 'horizontal' ? object.transform.width : object.transform.height) + gap;
  }
  return { ...scene, objects: scene.objects.map(object => next.has(object.id) ? { ...object, transform: next.get(object.id)! } : object) };
}

export function reorderObjects(scene: ProjectScene, selectedIds: string[], mode: LayerMode): ProjectScene {
  const movable = new Set(scene.objects.filter(object => selectedIds.includes(object.id) && !object.locked).map(object => object.id));
  if (!movable.size) return scene;
  const objects = [...scene.objects];
  if (mode === 'front' || mode === 'back') {
    const chosen = objects.filter(object => movable.has(object.id));
    const rest = objects.filter(object => !movable.has(object.id));
    return { ...scene, objects: mode === 'front' ? [...rest, ...chosen] : [...chosen, ...rest] };
  }
  if (mode === 'forward') {
    for (let index = objects.length - 2; index >= 0; index--) if (movable.has(objects[index].id) && !movable.has(objects[index + 1].id)) [objects[index], objects[index + 1]] = [objects[index + 1], objects[index]];
  } else {
    for (let index = 1; index < objects.length; index++) if (movable.has(objects[index].id) && !movable.has(objects[index - 1].id)) [objects[index], objects[index - 1]] = [objects[index - 1], objects[index]];
  }
  return { ...scene, objects };
}
