import type { ElFuegoProject, ProjectScene, SceneObjectBase } from '../types/project';
import { campaignLevels } from '../project/campaign';
import { validateProject } from '../validation/validateProject';

export type RuntimeProjectSnapshot = { project: ElFuegoProject; initialScene: ProjectScene; spawn: SceneObjectBase; levelId: string | null };

export function loadRuntimeProject(input: unknown, requestedLevelId?: string | null): RuntimeProjectSnapshot {
  const result = validateProject(input);
  if (!result.valid || !result.project) {
    const messages = result.issues.filter((issue) => issue.severity === 'error').map((issue) => issue.message);
    throw new Error(messages.join('\n') || 'Projeto inválido para teste.');
  }
  const project = structuredClone(result.project);
  const levels = campaignLevels(project.campaign);
  const level = levels.find((candidate) => candidate.id === requestedLevelId) ?? levels[0];
  const initialScene = level
    ? project.scenes.find((scene) => scene.id === level.initialSceneId)
    : [...project.scenes].sort((a, b) => a.order - b.order)[0];
  const spawns = initialScene?.objects.filter((object) => object.type === 'player-spawn' && object.visible && !object.editorOnly) ?? [];
  const spawn = spawns.find((object) => object.defaultEntry) ?? spawns[0];
  if (!initialScene || !spawn) throw new Error('A primeira cena precisa de uma entrada do player.');
  return { project, initialScene, spawn, levelId: level?.id ?? null };
}
