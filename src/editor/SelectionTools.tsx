import { useEditorStore } from '../state/editorStore';
import type { ElFuegoProject, ProjectScene, SceneObjectBase, Transform2D } from '../types/project';

type AlignMode = 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom';
type DistributeMode = 'horizontal' | 'vertical';
type LayerMode = 'front' | 'forward' | 'backward' | 'back';

const snapshot = (project: ElFuegoProject) => structuredClone(project);
const touch = (project: ElFuegoProject): ElFuegoProject => ({ ...project, project: { ...project.project, updatedAt: new Date().toISOString() } });

function commitScene(sceneId: string, change: (scene: ProjectScene, selected: SceneObjectBase[]) => ProjectScene) {
  useEditorStore.setState(state => {
    const selectedIds = new Set(state.selectedObjectIds);
    const scene = state.project.scenes.find(item => item.id === sceneId);
    if (!scene) return state;
    const selected = scene.objects.filter(object => selectedIds.has(object.id) && !object.locked);
    if (!selected.length) return state;
    const before = snapshot(state.project);
    const scenes = state.project.scenes.map(item => item.id === sceneId ? change(item, selected) : item);
    return { project: touch({ ...state.project, scenes }), past: [...state.past.slice(-49), before], future: [], saveStatus: 'Alterações não salvas' };
  });
}

function align(sceneId: string, mode: AlignMode) {
  commitScene(sceneId, (scene, selected) => {
    if (selected.length < 2) return scene;
    const left = Math.min(...selected.map(object => object.transform.x));
    const right = Math.max(...selected.map(object => object.transform.x + object.transform.width));
    const top = Math.min(...selected.map(object => object.transform.y));
    const bottom = Math.max(...selected.map(object => object.transform.y + object.transform.height));
    const centerX = (left + right) / 2;
    const centerY = (top + bottom) / 2;
    const selectedIds = new Set(selected.map(object => object.id));
    const transform = (object: SceneObjectBase): Transform2D => {
      const current = object.transform;
      if (mode === 'left') return { ...current, x: left };
      if (mode === 'center-x') return { ...current, x: centerX - current.width / 2 };
      if (mode === 'right') return { ...current, x: right - current.width };
      if (mode === 'top') return { ...current, y: top };
      if (mode === 'center-y') return { ...current, y: centerY - current.height / 2 };
      return { ...current, y: bottom - current.height };
    };
    return { ...scene, objects: scene.objects.map(object => selectedIds.has(object.id) ? { ...object, transform: transform(object) } : object) };
  });
}

function distribute(sceneId: string, mode: DistributeMode) {
  commitScene(sceneId, (scene, selected) => {
    if (selected.length < 3) return scene;
    const sorted = [...selected].sort((a, b) => mode === 'horizontal' ? a.transform.x - b.transform.x : a.transform.y - b.transform.y);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const totalSize = sorted.reduce((sum, object) => sum + (mode === 'horizontal' ? object.transform.width : object.transform.height), 0);
    const span = mode === 'horizontal'
      ? last.transform.x + last.transform.width - first.transform.x
      : last.transform.y + last.transform.height - first.transform.y;
    const gap = (span - totalSize) / (sorted.length - 1);
    let cursor = mode === 'horizontal' ? first.transform.x : first.transform.y;
    const next = new Map<string, Transform2D>();
    for (const object of sorted) {
      next.set(object.id, mode === 'horizontal' ? { ...object.transform, x: cursor } : { ...object.transform, y: cursor });
      cursor += (mode === 'horizontal' ? object.transform.width : object.transform.height) + gap;
    }
    return { ...scene, objects: scene.objects.map(object => next.has(object.id) ? { ...object, transform: next.get(object.id)! } : object) };
  });
}

function layer(sceneId: string, mode: LayerMode) {
  commitScene(sceneId, (scene, selected) => {
    const selectedIds = new Set(selected.map(object => object.id));
    const objects = [...scene.objects];
    if (mode === 'front' || mode === 'back') {
      const chosen = objects.filter(object => selectedIds.has(object.id));
      const rest = objects.filter(object => !selectedIds.has(object.id));
      return { ...scene, objects: mode === 'front' ? [...rest, ...chosen] : [...chosen, ...rest] };
    }
    if (mode === 'forward') {
      for (let index = objects.length - 2; index >= 0; index--) {
        if (selectedIds.has(objects[index].id) && !selectedIds.has(objects[index + 1].id)) [objects[index], objects[index + 1]] = [objects[index + 1], objects[index]];
      }
    } else {
      for (let index = 1; index < objects.length; index++) {
        if (selectedIds.has(objects[index].id) && !selectedIds.has(objects[index - 1].id)) [objects[index], objects[index - 1]] = [objects[index - 1], objects[index]];
      }
    }
    return { ...scene, objects };
  });
}

export function SelectionTools() {
  const { selectedSceneId, selectedObjectIds } = useEditorStore();
  const canAlign = selectedObjectIds.length >= 2;
  const canDistribute = selectedObjectIds.length >= 3;
  const hasSelection = selectedObjectIds.length > 0;
  return <div className="selection-tools" aria-label="Organização da seleção">
    <span>Alinhar</span>
    <button disabled={!canAlign} title="Alinhar à esquerda" onClick={() => align(selectedSceneId, 'left')}>⇤</button>
    <button disabled={!canAlign} title="Centralizar horizontalmente" onClick={() => align(selectedSceneId, 'center-x')}>↔</button>
    <button disabled={!canAlign} title="Alinhar à direita" onClick={() => align(selectedSceneId, 'right')}>⇥</button>
    <button disabled={!canAlign} title="Alinhar ao topo" onClick={() => align(selectedSceneId, 'top')}>⇡</button>
    <button disabled={!canAlign} title="Centralizar verticalmente" onClick={() => align(selectedSceneId, 'center-y')}>↕</button>
    <button disabled={!canAlign} title="Alinhar à base" onClick={() => align(selectedSceneId, 'bottom')}>⇣</button>
    <span>Distribuir</span>
    <button disabled={!canDistribute} title="Distribuir horizontalmente" onClick={() => distribute(selectedSceneId, 'horizontal')}>⋯</button>
    <button disabled={!canDistribute} title="Distribuir verticalmente" onClick={() => distribute(selectedSceneId, 'vertical')}>⋮</button>
    <span>Camada</span>
    <button disabled={!hasSelection} title="Enviar para trás" onClick={() => layer(selectedSceneId, 'back')}>⤓</button>
    <button disabled={!hasSelection} title="Recuar uma camada" onClick={() => layer(selectedSceneId, 'backward')}>↓</button>
    <button disabled={!hasSelection} title="Avançar uma camada" onClick={() => layer(selectedSceneId, 'forward')}>↑</button>
    <button disabled={!hasSelection} title="Trazer para frente" onClick={() => layer(selectedSceneId, 'front')}>⤒</button>
  </div>;
}
