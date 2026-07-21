import { create } from 'zustand';
import { createEmptyProject, createEmptyScene } from '../project/projectFactory';
import type { ElFuegoProject, ProjectScene } from '../types/project';

type SaveStatus = 'Salvo' | 'Alterações não salvas' | 'Salvando...' | 'Erro ao salvar' | 'Backup recuperado';

type EditorState = {
  project: ElFuegoProject;
  selectedSceneId: string;
  saveStatus: SaveStatus;
  zoom: number;
  gridEnabled: boolean;
  setProject: (project: ElFuegoProject, status?: SaveStatus) => void;
  setSaveStatus: (status: SaveStatus) => void;
  renameProject: (name: string) => void;
  selectScene: (sceneId: string) => void;
  addScene: () => void;
  duplicateScene: (sceneId: string) => void;
  deleteScene: (sceneId: string) => void;
  updateScene: (sceneId: string, patch: Partial<Pick<ProjectScene, 'name' | 'width' | 'height'>>) => void;
  moveScene: (sceneId: string, direction: -1 | 1) => void;
  setZoom: (zoom: number) => void;
  toggleGrid: () => void;
  newProject: () => void;
};

const touch = (project: ElFuegoProject): ElFuegoProject => ({
  ...project,
  project: { ...project.project, updatedAt: new Date().toISOString() },
});

const normalizeSceneOrder = (scenes: ProjectScene[]) => scenes.map((scene, order) => ({ ...scene, order }));

export const useEditorStore = create<EditorState>((set, get) => {
  const initialProject = createEmptyProject('Minha primeira fase');
  return {
    project: initialProject,
    selectedSceneId: initialProject.scenes[0].id,
    saveStatus: 'Alterações não salvas',
    zoom: 0.55,
    gridEnabled: true,
    setProject: (project, status = 'Alterações não salvas') => set({ project, selectedSceneId: project.scenes[0]?.id ?? '', saveStatus: status }),
    setSaveStatus: (saveStatus) => set({ saveStatus }),
    renameProject: (name) => set((state) => ({ project: touch({ ...state.project, project: { ...state.project.project, name } }), saveStatus: 'Alterações não salvas' })),
    selectScene: (selectedSceneId) => set({ selectedSceneId }),
    addScene: () => set((state) => {
      const scene = createEmptyScene(state.project.scenes.length);
      return { project: touch({ ...state.project, scenes: [...state.project.scenes, scene] }), selectedSceneId: scene.id, saveStatus: 'Alterações não salvas' };
    }),
    duplicateScene: (sceneId) => set((state) => {
      const source = state.project.scenes.find((scene) => scene.id === sceneId);
      if (!source) return state;
      const duplicate = { ...source, id: crypto.randomUUID(), name: `${source.name} cópia`, objects: source.objects.map((object) => ({ ...object, id: crypto.randomUUID(), sceneId: '' })) };
      duplicate.objects = duplicate.objects.map((object) => ({ ...object, sceneId: duplicate.id }));
      const index = state.project.scenes.findIndex((scene) => scene.id === sceneId);
      const scenes = [...state.project.scenes];
      scenes.splice(index + 1, 0, duplicate);
      return { project: touch({ ...state.project, scenes: normalizeSceneOrder(scenes) }), selectedSceneId: duplicate.id, saveStatus: 'Alterações não salvas' };
    }),
    deleteScene: (sceneId) => set((state) => {
      if (state.project.scenes.length === 1) return state;
      const scenes = normalizeSceneOrder(state.project.scenes.filter((scene) => scene.id !== sceneId));
      return { project: touch({ ...state.project, scenes }), selectedSceneId: scenes[0].id, saveStatus: 'Alterações não salvas' };
    }),
    updateScene: (sceneId, patch) => set((state) => ({
      project: touch({ ...state.project, scenes: state.project.scenes.map((scene) => scene.id === sceneId ? { ...scene, ...patch } : scene) }),
      saveStatus: 'Alterações não salvas',
    })),
    moveScene: (sceneId, direction) => set((state) => {
      const index = state.project.scenes.findIndex((scene) => scene.id === sceneId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= state.project.scenes.length) return state;
      const scenes = [...state.project.scenes];
      [scenes[index], scenes[target]] = [scenes[target], scenes[index]];
      return { project: touch({ ...state.project, scenes: normalizeSceneOrder(scenes) }), saveStatus: 'Alterações não salvas' };
    }),
    setZoom: (zoom) => set({ zoom: Math.min(1.2, Math.max(0.2, zoom)) }),
    toggleGrid: () => set((state) => ({ gridEnabled: !state.gridEnabled })),
    newProject: () => {
      const project = createEmptyProject('Minha fase');
      set({ project, selectedSceneId: project.scenes[0].id, saveStatus: 'Alterações não salvas', zoom: 0.55 });
    },
  };
});
