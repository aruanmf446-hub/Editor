import { describe, expect, it } from 'vitest';
import {
  EL_FUEGO_PROJECT_FORMAT,
  EL_FUEGO_PROJECT_VERSION,
  type ElFuegoProject,
  type ProjectScene,
  type SceneObjectBase,
} from '../types/project';
import { validateProject } from './validateProject';

const object = (
  sceneId: string,
  type: SceneObjectBase['type'],
  patch: Partial<SceneObjectBase> = {},
): SceneObjectBase => ({
  id: `${sceneId}-${type}-${crypto.randomUUID()}`,
  sceneId,
  type,
  name: type,
  transform: { x: 20, y: 20, z: 0, width: 50, height: 100, scaleX: 1, scaleY: 1, rotation: 0 },
  visible: true,
  locked: false,
  editorOnly: false,
  gameOnly: false,
  ...patch,
});

const scene = (id: string, order: number, objects: SceneObjectBase[]): ProjectScene => ({
  id,
  name: `Cena ${order + 1}`,
  order,
  width: 1000,
  height: 600,
  backgroundAssetId: null,
  background: { fit: 'cover', positionX: 50, positionY: 50, scale: 1, editorOpacity: 1 },
  objects,
});

function project(scenes: ProjectScene[]): ElFuegoProject {
  return {
    format: EL_FUEGO_PROJECT_FORMAT,
    version: EL_FUEGO_PROJECT_VERSION,
    project: { id: 'project', name: 'Projeto', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    settings: { gravity: 2200, gridSize: 16, snapEnabled: true, defaultSceneWidth: 1000, defaultSceneHeight: 600 },
    assets: [],
    scenes,
  };
}

describe('validação de entradas nomeadas', () => {
  it('aceita várias entradas por cena quando os IDs são únicos', () => {
    const initial = object('one', 'player-spawn', { entryId: 'inicio', defaultEntry: true });
    const finish = object('one', 'finish', { endingMode: 'target-scene', targetSceneId: 'two', targetEntryId: 'porta-direita' });
    const left = object('two', 'player-spawn', { entryId: 'porta-esquerda', defaultEntry: true });
    const right = object('two', 'player-spawn', { entryId: 'porta-direita' });
    const result = validateProject(project([scene('one', 0, [initial, finish]), scene('two', 1, [left, right])]));

    expect(result.issues.some((issue) => issue.code === 'MULTIPLE_GLOBAL_SPAWNS')).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'DUPLICATE_ENTRY_ID')).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'FINISH_ENTRY_MISSING')).toBe(false);
    expect(result.valid).toBe(true);
  });

  it('rejeita IDs duplicados e mais de uma entrada padrão na mesma cena', () => {
    const first = object('one', 'player-spawn', { entryId: 'porta', defaultEntry: true });
    const second = object('one', 'player-spawn', { entryId: 'porta', defaultEntry: true });
    const result = validateProject(project([scene('one', 0, [first, second])]));

    expect(result.issues.map((issue) => issue.code)).toContain('DUPLICATE_ENTRY_ID');
    expect(result.issues.map((issue) => issue.code)).toContain('MULTIPLE_DEFAULT_ENTRIES');
    expect(result.valid).toBe(false);
  });

  it('exige uma entrada na primeira cena', () => {
    const result = validateProject(project([scene('one', 0, [])]));
    expect(result.issues.map((issue) => issue.code)).toContain('MISSING_INITIAL_SCENE_ENTRY');
    expect(result.valid).toBe(false);
  });

  it('rejeita uma saída que aponta para entrada inexistente', () => {
    const spawn = object('one', 'player-spawn', { entryId: 'inicio', defaultEntry: true });
    const finish = object('one', 'finish', { endingMode: 'target-scene', targetSceneId: 'two', targetEntryId: 'nao-existe' });
    const target = object('two', 'player-spawn', { entryId: 'principal', defaultEntry: true });
    const result = validateProject(project([scene('one', 0, [spawn, finish]), scene('two', 1, [target])]));

    expect(result.issues.map((issue) => issue.code)).toContain('FINISH_ENTRY_MISSING');
    expect(result.valid).toBe(false);
  });

  it('rejeita ação de gatilho com entrada inexistente', () => {
    const spawn = object('one', 'player-spawn', { entryId: 'inicio', defaultEntry: true });
    const trigger = object('one', 'trigger', {
      triggerActions: [{ id: 'go', type: 'transition-scene', targetSceneId: 'two', targetEntryId: 'secreta' }],
    });
    const target = object('two', 'player-spawn', { entryId: 'principal', defaultEntry: true });
    const result = validateProject(project([scene('one', 0, [spawn, trigger]), scene('two', 1, [target])]));

    expect(result.issues.map((issue) => issue.code)).toContain('TRIGGER_ENTRY_MISSING');
    expect(result.valid).toBe(false);
  });
});
