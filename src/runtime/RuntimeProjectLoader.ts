import type { ElFuegoProject, ProjectScene, SceneObjectBase } from '../types/project';
import { validateProject } from '../validation/validateProject';

export type RuntimeProjectSnapshot = {
  project: ElFuegoProject;
  initialScene: ProjectScene;
  spawn: SceneObjectBase;
};

export function loadRuntimeProject(input: unknown): RuntimeProjectSnapshot {
  const result = validateProject(input);
  if (!result.valid || !result.project) {
    const messages = result.issues.filter((issue) => issue.severity === 'error').map((issue) => issue.message);
    throw new Error(messages.join('\n') || 'Projeto inválido para teste.');
  }
  const project = structuredClone(result.project);
  const spawnScene = project.scenes.find((scene) => scene.objects.some((object) => object.type === 'player-spawn'));
  const spawn = spawnScene?.objects.find((object) => object.type === 'player-spawn');
  if (!spawnScene || !spawn) throw new Error('Spawn global não encontrado.');
  return { project, initialScene: spawnScene, spawn };
}
