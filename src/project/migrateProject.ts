import type { ElFuegoProject, SceneBackgroundSettings } from '../types/project';

export const DEFAULT_BACKGROUND_SETTINGS: SceneBackgroundSettings = {
  fit: 'cover',
  positionX: 50,
  positionY: 50,
  scale: 1,
  editorOpacity: 1,
};

/**
 * Normaliza entradas antigas antes do schema. É pura, idempotente e cria uma
 * cópia profunda para impedir compartilhamento de referências com a entrada.
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
    const objects = Array.isArray(scene.objects)
      ? scene.objects.map((objectValue) => {
          if (!objectValue || typeof objectValue !== 'object') return objectValue;
          const object = objectValue as Record<string, unknown>;
          if (object.type !== 'finish' || object.endingMode) return object;
          return {
            ...object,
            endingMode: typeof object.targetSceneId === 'string' && object.targetSceneId.length > 0
              ? 'target-scene'
              : 'next-scene',
          };
        })
      : scene.objects;

    return {
      ...scene,
      background: {
        ...DEFAULT_BACKGROUND_SETTINGS,
        ...current,
      },
      objects,
    };
  });

  return source;
}

export function normalizeProject(input: unknown): ElFuegoProject {
  return migrateProject(input) as ElFuegoProject;
}
