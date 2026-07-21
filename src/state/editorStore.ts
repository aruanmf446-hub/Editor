import { create } from 'zustand';
import { createEmptyProject, createEmptyScene } from '../project/projectFactory';
import type { ElFuegoProject, ProjectScene, SceneObjectBase, SceneObjectType, Transform2D } from '../types/project';

type SaveStatus = 'Salvo' | 'Alterações não salvas' | 'Salvando...' | 'Erro ao salvar' | 'Backup recuperado';
type EditableObjectPatch = Partial<Pick<SceneObjectBase, 'name' | 'visible' | 'locked' | 'transform'>>;

type EditorState = {
  project: ElFuegoProject;
  selectedSceneId: string;
  selectedObjectId: string | null;
  saveStatus: SaveStatus;
  zoom: number;
  gridEnabled: boolean;
  past: ElFuegoProject[];
  future: ElFuegoProject[];
  setProject: (project: ElFuegoProject, status?: SaveStatus) => void;
  setSaveStatus: (status: SaveStatus) => void;
  renameProject: (name: string) => void;
  selectScene: (sceneId: string) => void;
  selectObject: (objectId: string | null) => void;
  addScene: () => void;
  duplicateScene: (sceneId: string) => void;
  deleteScene: (sceneId: string) => void;
  updateScene: (sceneId: string, patch: Partial<Pick<ProjectScene, 'name' | 'width' | 'height'>>) => void;
  moveScene: (sceneId: string, direction: -1 | 1) => void;
  addObject: (type: SceneObjectType) => void;
  updateObject: (objectId: string, patch: EditableObjectPatch) => void;
  previewObjectTransform: (objectId: string, transform: Transform2D) => void;
  commitTransformPreview: (beforeProject: ElFuegoProject) => void;
  cancelTransformPreview: (beforeProject: ElFuegoProject) => void;
  duplicateObject: (objectId: string) => void;
  deleteObject: (objectId: string) => void;
  toggleObjectVisibility: (objectId: string) => void;
  toggleObjectLock: (objectId: string) => void;
  undo: () => void;
  redo: () => void;
  setZoom: (zoom: number) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  newProject: () => void;
};

const touch = (project: ElFuegoProject): ElFuegoProject => ({ ...project, project: { ...project.project, updatedAt: new Date().toISOString() } });
const normalizeSceneOrder = (scenes: ProjectScene[]) => scenes.map((scene, order) => ({ ...scene, order }));
const snapshot = (project: ElFuegoProject) => structuredClone(project);

const objectLabels: Partial<Record<SceneObjectType, string>> = {
  decoration: 'Decoração', obstacle: 'Obstáculo', checkpoint: 'Checkpoint', trigger: 'Gatilho', collectible: 'Coletável', 'dialogue-zone': 'Área de diálogo',
};

function createVisualObject(type: SceneObjectType, sceneId: string, index: number): SceneObjectBase {
  return {
    id: crypto.randomUUID(), sceneId, type, name: `${objectLabels[type] ?? type} ${index + 1}`,
    transform: { x: 160 + index * 30, y: 160 + index * 24, z: 0, width: 180, height: 120, scaleX: 1, scaleY: 1, rotation: 0 },
    visible: true, locked: false, editorOnly: false, gameOnly: false,
  };
}

export const useEditorStore = create<EditorState>((set) => {
  const initialProject = createEmptyProject('Minha primeira fase');
  const commit = (mutate: (project: ElFuegoProject) => ElFuegoProject, extra: Partial<EditorState> = {}) => set((state) => ({
    project: touch(mutate(state.project)), past: [...state.past.slice(-49), snapshot(state.project)], future: [], saveStatus: 'Alterações não salvas', ...extra,
  }));

  return {
    project: initialProject, selectedSceneId: initialProject.scenes[0].id, selectedObjectId: null,
    saveStatus: 'Alterações não salvas', zoom: 0.55, gridEnabled: true, past: [], future: [],
    setProject: (project, status = 'Alterações não salvas') => set({ project, selectedSceneId: project.scenes[0]?.id ?? '', selectedObjectId: null, saveStatus: status, past: [], future: [] }),
    setSaveStatus: (saveStatus) => set({ saveStatus }),
    renameProject: (name) => commit((project) => ({ ...project, project: { ...project.project, name } })),
    selectScene: (selectedSceneId) => set({ selectedSceneId, selectedObjectId: null }),
    selectObject: (selectedObjectId) => set({ selectedObjectId }),
    addScene: () => set((state) => {
      const scene = createEmptyScene(state.project.scenes.length);
      return { project: touch({ ...state.project, scenes: [...state.project.scenes, scene] }), past: [...state.past.slice(-49), snapshot(state.project)], future: [], selectedSceneId: scene.id, selectedObjectId: null, saveStatus: 'Alterações não salvas' };
    }),
    duplicateScene: (sceneId) => set((state) => {
      const source = state.project.scenes.find((scene) => scene.id === sceneId); if (!source) return state;
      const duplicateId = crypto.randomUUID();
      const duplicate = { ...structuredClone(source), id: duplicateId, name: `${source.name} cópia`, objects: source.objects.map((object) => ({ ...structuredClone(object), id: crypto.randomUUID(), sceneId: duplicateId })) };
      const scenes = [...state.project.scenes]; scenes.splice(state.project.scenes.findIndex((scene) => scene.id === sceneId) + 1, 0, duplicate);
      return { project: touch({ ...state.project, scenes: normalizeSceneOrder(scenes) }), past: [...state.past.slice(-49), snapshot(state.project)], future: [], selectedSceneId: duplicateId, selectedObjectId: null, saveStatus: 'Alterações não salvas' };
    }),
    deleteScene: (sceneId) => set((state) => {
      if (state.project.scenes.length === 1) return state;
      const scenes = normalizeSceneOrder(state.project.scenes.filter((scene) => scene.id !== sceneId));
      return { project: touch({ ...state.project, scenes }), past: [...state.past.slice(-49), snapshot(state.project)], future: [], selectedSceneId: scenes[0].id, selectedObjectId: null, saveStatus: 'Alterações não salvas' };
    }),
    updateScene: (sceneId, patch) => commit((project) => ({ ...project, scenes: project.scenes.map((scene) => scene.id === sceneId ? { ...scene, ...patch } : scene) })),
    moveScene: (sceneId, direction) => set((state) => {
      const index = state.project.scenes.findIndex((scene) => scene.id === sceneId); const target = index + direction;
      if (index < 0 || target < 0 || target >= state.project.scenes.length) return state;
      const scenes = [...state.project.scenes]; [scenes[index], scenes[target]] = [scenes[target], scenes[index]];
      return { project: touch({ ...state.project, scenes: normalizeSceneOrder(scenes) }), past: [...state.past.slice(-49), snapshot(state.project)], future: [], saveStatus: 'Alterações não salvas' };
    }),
    addObject: (type) => set((state) => {
      const scene = state.project.scenes.find((item) => item.id === state.selectedSceneId); if (!scene) return state;
      const object = createVisualObject(type, scene.id, scene.objects.length);
      const project = touch({ ...state.project, scenes: state.project.scenes.map((item) => item.id === scene.id ? { ...item, objects: [...item.objects, object] } : item) });
      return { project, past: [...state.past.slice(-49), snapshot(state.project)], future: [], selectedObjectId: object.id, saveStatus: 'Alterações não salvas' };
    }),
    updateObject: (objectId, patch) => commit((project) => ({ ...project, scenes: project.scenes.map((scene) => ({ ...scene, objects: scene.objects.map((object) => object.id === objectId ? { ...object, ...patch } : object) })) })),
    previewObjectTransform: (objectId, transform) => set((state) => ({
      project: { ...state.project, scenes: state.project.scenes.map((scene) => ({ ...scene, objects: scene.objects.map((object) => object.id === objectId ? { ...object, transform } : object) })) },
      saveStatus: 'Alterações não salvas',
    })),
    commitTransformPreview: (beforeProject) => set((state) => ({
      project: touch(state.project), past: [...state.past.slice(-49), snapshot(beforeProject)], future: [], saveStatus: 'Alterações não salvas',
    })),
    cancelTransformPreview: (beforeProject) => set({ project: beforeProject }),
    duplicateObject: (objectId) => set((state) => {
      const scene = state.project.scenes.find((item) => item.objects.some((object) => object.id === objectId)); const source = scene?.objects.find((object) => object.id === objectId); if (!scene || !source) return state;
      const duplicate = { ...structuredClone(source), id: crypto.randomUUID(), name: `${source.name} cópia`, transform: { ...source.transform, x: source.transform.x + 32, y: source.transform.y + 32 } };
      const project = touch({ ...state.project, scenes: state.project.scenes.map((item) => item.id === scene.id ? { ...item, objects: [...item.objects, duplicate] } : item) });
      return { project, past: [...state.past.slice(-49), snapshot(state.project)], future: [], selectedObjectId: duplicate.id, saveStatus: 'Alterações não salvas' };
    }),
    deleteObject: (objectId) => commit((project) => ({ ...project, scenes: project.scenes.map((scene) => ({ ...scene, objects: scene.objects.filter((object) => object.id !== objectId) })) }), { selectedObjectId: null }),
    toggleObjectVisibility: (objectId) => set((state) => { const object = state.project.scenes.flatMap((scene) => scene.objects).find((item) => item.id === objectId); if (!object) return state; state.updateObject(objectId, { visible: !object.visible }); return state; }),
    toggleObjectLock: (objectId) => set((state) => { const object = state.project.scenes.flatMap((scene) => scene.objects).find((item) => item.id === objectId); if (!object) return state; state.updateObject(objectId, { locked: !object.locked }); return state; }),
    undo: () => set((state) => { const previous = state.past.at(-1); if (!previous) return state; return { project: previous, past: state.past.slice(0, -1), future: [snapshot(state.project), ...state.future].slice(0, 50), selectedObjectId: null, saveStatus: 'Alterações não salvas' }; }),
    redo: () => set((state) => { const next = state.future[0]; if (!next) return state; return { project: next, past: [...state.past, snapshot(state.project)].slice(-50), future: state.future.slice(1), selectedObjectId: null, saveStatus: 'Alterações não salvas' }; }),
    setZoom: (zoom) => set({ zoom: Math.min(1.2, Math.max(0.2, zoom)) }),
    toggleGrid: () => set((state) => ({ gridEnabled: !state.gridEnabled })),
    toggleSnap: () => commit((project) => ({ ...project, settings: { ...project.settings, snapEnabled: !project.settings.snapEnabled } })),
    newProject: () => { const project = createEmptyProject('Minha fase'); set({ project, selectedSceneId: project.scenes[0].id, selectedObjectId: null, saveStatus: 'Alterações não salvas', zoom: 0.55, past: [], future: [] }); },
  };
});