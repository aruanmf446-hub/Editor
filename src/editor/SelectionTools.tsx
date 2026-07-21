import { useEditorStore } from '../state/editorStore';
import type { ElFuegoProject, ProjectScene, SceneObjectBase } from '../types/project';
import { alignObjects, distributeObjects, reorderObjects, type AlignMode, type DistributeMode, type LayerMode } from './selectionGeometry';

const snapshot = (project: ElFuegoProject) => structuredClone(project);
const touch = (project: ElFuegoProject): ElFuegoProject => ({ ...project, project: { ...project.project, updatedAt: new Date().toISOString() } });

function commitScene(sceneId: string, change: (scene: ProjectScene, selectedIds: string[]) => ProjectScene) {
  useEditorStore.setState(state => {
    const scene = state.project.scenes.find(item => item.id === sceneId);
    if (!scene) return state;
    const selected = scene.objects.filter(object => state.selectedObjectIds.includes(object.id) && !object.locked);
    if (!selected.length) return state;
    const before = snapshot(state.project);
    const selectedIds = selected.map(object => object.id);
    const scenes = state.project.scenes.map(item => item.id === sceneId ? change(item, selectedIds) : item);
    return { project: touch({ ...state.project, scenes }), past: [...state.past.slice(-49), before], future: [], saveStatus: 'Alterações não salvas' };
  });
}

function align(sceneId: string, mode: AlignMode) {
  commitScene(sceneId, (scene, selectedIds) => alignObjects(scene, selectedIds, mode));
}

function distribute(sceneId: string, mode: DistributeMode) {
  commitScene(sceneId, (scene, selectedIds) => distributeObjects(scene, selectedIds, mode));
}

function layer(sceneId: string, mode: LayerMode) {
  commitScene(sceneId, (scene, selectedIds) => reorderObjects(scene, selectedIds, mode));
}

export function SelectionTools() {
  const { project, selectedSceneId, selectedObjectIds } = useEditorStore();
  const scene = project.scenes.find(item => item.id === selectedSceneId);
  const editableCount = scene?.objects.filter((object: SceneObjectBase) => selectedObjectIds.includes(object.id) && !object.locked).length ?? 0;
  const canAlign = editableCount >= 2;
  const canDistribute = editableCount >= 3;
  const hasSelection = editableCount > 0;
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
