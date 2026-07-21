import { describe, expect, it } from 'vitest';
import type { ProjectScene, SceneObjectBase } from '../types/project';
import { alignObjects, distributeObjects, getSelectionIntersection, normalizeRect, pointerToScene, reorderObjects } from './selectionGeometry';

const object = (id: string, x: number, y: number, width = 40, height = 40, patch: Partial<SceneObjectBase> = {}): SceneObjectBase => ({
  id, sceneId: 'scene', type: 'decoration', name: id, transform: { x, y, z: 0, width, height, scaleX: 1, scaleY: 1, rotation: 0 }, visible: true, locked: false, editorOnly: false, gameOnly: false, ...patch,
});
const scene = (objects: SceneObjectBase[]): ProjectScene => ({ id: 'scene', name: 'Cena', order: 0, width: 500, height: 300, backgroundAssetId: null, background: { fit: 'cover', positionX: 50, positionY: 50, scale: 1, editorOpacity: 1 }, objects });

describe('selectionGeometry', () => {
  it('normaliza retângulo invertido e converte ponteiro com zoom', () => {
    expect(normalizeRect(100, 80, 20, 10)).toEqual({ x: 20, y: 10, width: 80, height: 70 });
    expect(pointerToScene(300, 220, { left: 100, top: 20 }, 2, 500, 300)).toEqual({ x: 100, y: 100 });
  });

  it('seleciona por interseção e ignora ocultos', () => {
    const objects = [object('a', 10, 10), object('b', 100, 100, 40, 40, { visible: false }), object('c', 35, 35)];
    expect(getSelectionIntersection(objects, { x: 0, y: 0, width: 50, height: 50 })).toEqual(['a', 'c']);
  });

  it('alinha apenas objetos desbloqueados e mantém limites', () => {
    const input = scene([object('a', 20, 20), object('b', 100, 30), object('locked', 200, 40, 40, 40, { locked: true })]);
    const output = alignObjects(input, ['a', 'b', 'locked'], 'left');
    expect(output.objects[0].transform.x).toBe(20);
    expect(output.objects[1].transform.x).toBe(20);
    expect(output.objects[2].transform.x).toBe(200);
  });

  it('distribui por espaço vazio entre objetos de tamanhos diferentes', () => {
    const input = scene([object('a', 0, 0, 100), object('b', 150, 0, 20), object('c', 300, 0, 60)]);
    const output = distributeObjects(input, ['a', 'b', 'c'], 'horizontal');
    const [a, b, c] = output.objects;
    expect(b.transform.x - (a.transform.x + a.transform.width)).toBeCloseTo(c.transform.x - (b.transform.x + b.transform.width));
  });

  it('mantém posições quando não há espaço suficiente', () => {
    const input = scene([object('a', 0, 0, 180), object('b', 100, 0, 180), object('c', 200, 0, 180)]);
    const output = distributeObjects(input, ['a', 'b', 'c'], 'horizontal');
    expect(output).toBe(input);
  });

  it('preserva ordem relativa ao trazer seleção múltipla para frente', () => {
    const input = scene(['a', 'b', 'c', 'd', 'e'].map((id, index) => object(id, index * 20, 0)));
    const output = reorderObjects(input, ['b', 'd'], 'front');
    expect(output.objects.map(item => item.id)).toEqual(['a', 'c', 'e', 'b', 'd']);
  });

  it('não altera camada de objeto bloqueado', () => {
    const input = scene([object('a', 0, 0), object('b', 20, 0, 40, 40, { locked: true }), object('c', 40, 0)]);
    const output = reorderObjects(input, ['b'], 'front');
    expect(output.objects.map(item => item.id)).toEqual(['a', 'b', 'c']);
  });
});
