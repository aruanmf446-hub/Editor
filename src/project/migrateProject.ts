import type { ElFuegoProject, SceneBackgroundSettings } from '../types/project';

export const DEFAULT_BACKGROUND_SETTINGS: SceneBackgroundSettings = {
  fit: 'cover',
  positionX: 50,
  positionY: 50,
  scale: 1,
  editorOpacity: 1,
};

/**
 * Normaliza arquivos antigos antes da validação. A função não altera o objeto
 * recebido e só preenche campos editoriais ausentes, mantendo o formato v1.
 */
export function migrateProject(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input;
  const source = structuredClone(input) as Record<string, unknown>;
  if (!Array.isArray(source.scenes)) return source;

  source.scenes = source.scenes.map((sceneValue) => {
    if (!sceneValue || typeof sceneValue !== 'object') return sceneValue;
    const scene = sceneValue as Record<string, unknown>;
    const current = scene.background && typeof scene.background === 'object'
      ? scene.background as Partial<SceneBackgroundSettings>
      : {};
    return {
      ...scene,
      background: {
        ...DEFAULT_BACKGROUND_SETTINGS,
        ...current,
      },
    };
  });

  return source;
}

export function normalizeProject(input: unknown): ElFuegoProject {
  return migrateProject(input) as ElFuegoProject;
}
