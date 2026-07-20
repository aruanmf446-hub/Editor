import {
  EL_FUEGO_PROJECT_FORMAT,
  EL_FUEGO_PROJECT_VERSION,
  type ElFuegoProject,
  type ProjectScene,
} from '../types/project';

const DEFAULT_SCENE_WIDTH = 1920;
const DEFAULT_SCENE_HEIGHT = 1080;

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `elfuego-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createEmptyScene(order = 0): ProjectScene {
  return {
    id: createId(),
    name: `Cena ${order + 1}`,
    order,
    width: DEFAULT_SCENE_WIDTH,
    height: DEFAULT_SCENE_HEIGHT,
    backgroundAssetId: null,
    objects: [],
  };
}

export function createEmptyProject(name = 'Minha fase'): ElFuegoProject {
  const now = new Date().toISOString();

  return {
    format: EL_FUEGO_PROJECT_FORMAT,
    version: EL_FUEGO_PROJECT_VERSION,
    project: {
      id: createId(),
      name,
      createdAt: now,
      updatedAt: now,
    },
    settings: {
      gravity: -24,
      gridSize: 16,
      snapEnabled: true,
      defaultSceneWidth: DEFAULT_SCENE_WIDTH,
      defaultSceneHeight: DEFAULT_SCENE_HEIGHT,
    },
    assets: [],
    scenes: [createEmptyScene()],
  };
}
