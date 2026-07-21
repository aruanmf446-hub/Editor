import type { ElFuegoProject, ProjectScene, SceneObjectBase } from '../types/project';
import { validateProject } from '../validation/validateProject';

export type RuntimeProjectSnapshot = { project: ElFuegoProject; initialScene: ProjectScene; spawn: SceneObjectBase };

export function loadRuntimeProject(input: unknown): RuntimeProjectSnapshot {
  const result = validateProject(input);
  if (!result.valid || !result.project) {
    const messages = result.issues.filter((issue) => issue.severity === 'error').map((issue) => issue.message);
    throw new Error(messages.join('\n') || 'Projeto inválido para teste.');
  }
  const project = structuredClone(result.project);
  const initialScene = [...project.scenes].sort((a, b) => a.order - b.order)[0];
  const spawns = initialScene?.objects.filter((object) => object.type === 'player-spawn' && object.visible && !object.editorOnly) ?? [];
  const spawn = spawns.find((object) => object.defaultEntry) ?? spawns[0];
  if (!initialScene || !spawn) throw new Error('A primeira cena precisa de uma entrada do player.');
  return { project, initialScene, spawn };
}
