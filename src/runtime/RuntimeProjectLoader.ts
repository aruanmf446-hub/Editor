import type { ElFuegoProject, ProjectScene, SceneObjectBase } from '../types/project';
import { campaignLevels } from '../project/campaign';
import { validateProject } from '../validation/validateProject';

export type RuntimeSequenceSegment = {
  sceneId: string;
  name: string;
  x: number;
  width: number;
  height: number;
  backgroundAssetId: string | null;
  background: ProjectScene['background'];
};

export type RuntimeProjectSnapshot = {
  project: ElFuegoProject;
  initialScene: ProjectScene;
  spawn: SceneObjectBase;
  levelId: string | null;
  sequenceSegments: RuntimeSequenceSegment[];
};

function createContinuousSequence(project: ElFuegoProject, requestedSceneId?: string): {
  scene: ProjectScene;
  spawn: SceneObjectBase | undefined;
  segments: RuntimeSequenceSegment[];
} {
  const ordered = [...project.scenes].sort((a, b) => a.order - b.order);
  const lastScene = ordered.at(-1);
  const segments: RuntimeSequenceSegment[] = [];
  const objects: SceneObjectBase[] = [];
  let offsetX = 0;
  let requestedSpawn: SceneObjectBase | undefined;

  for (const scene of ordered) {
    segments.push({
      sceneId: scene.id,
      name: scene.name,
      x: offsetX,
      width: scene.width,
      height: scene.height,
      backgroundAssetId: scene.backgroundAssetId,
      background: scene.background,
    });

    const sceneSpawns = scene.objects.filter((object) => object.type === 'player-spawn' && object.visible && !object.editorOnly);
    const sourceSpawn = sceneSpawns.find((object) => object.defaultEntry) ?? sceneSpawns[0];

    for (const object of scene.objects) {
      if (object.type === 'finish' && scene.id !== lastScene?.id) continue;
      const copy: SceneObjectBase = {
        ...structuredClone(object),
        sceneId: 'runtime-continuous-sequence',
        transform: { ...object.transform, x: object.transform.x + offsetX },
      };
      if (copy.type === 'finish') {
        copy.endingMode = 'complete-game';
        copy.targetSceneId = undefined;
        copy.targetEntryId = undefined;
      }
      objects.push(copy);
      if (scene.id === requestedSceneId && sourceSpawn?.id === object.id) requestedSpawn = copy;
    }
    offsetX += scene.width;
  }

  if (!objects.some((object) => object.type === 'finish') && offsetX > 0) {
    objects.push({
      id: 'runtime-sequence-finish', sceneId: 'runtime-continuous-sequence', type: 'finish', name: 'Fim do plano-sequência',
      transform: { x: Math.max(0, offsetX - 96), y: Math.max(0, Math.max(...ordered.map((scene) => scene.height), 1080) - 220), z: 0, width: 64, height: 160, scaleX: 1, scaleY: 1, rotation: 0 },
      visible: true, locked: false, editorOnly: false, gameOnly: false, endingMode: 'complete-game',
    });
  }

  const scene: ProjectScene = {
    id: 'runtime-continuous-sequence',
    name: 'Plano-sequência',
    order: 0,
    width: Math.max(1, offsetX),
    height: Math.max(...ordered.map((candidate) => candidate.height), 1),
    backgroundAssetId: null,
    background: { fit: 'cover', positionX: 50, positionY: 50, scale: 1, editorOpacity: 1 },
    objects,
  };

  const fallbackSpawn = objects.find((object) => object.type === 'player-spawn' && object.visible && !object.editorOnly);
  return { scene, spawn: requestedSpawn ?? fallbackSpawn, segments };
}

export function loadRuntimeProject(input: unknown, requestedLevelId?: string | null): RuntimeProjectSnapshot {
  const result = validateProject(input);
  if (!result.valid || !result.project) {
    const messages = result.issues.filter((issue) => issue.severity === 'error').map((issue) => issue.message);
    throw new Error(messages.join('\n') || 'Projeto inválido para teste.');
  }
  const project = structuredClone(result.project);
  const levels = campaignLevels(project.campaign);
  const level = levels.find((candidate) => candidate.id === requestedLevelId) ?? levels[0];
  const requestedSceneId = level?.initialSceneId ?? [...project.scenes].sort((a, b) => a.order - b.order)[0]?.id;
  const sequence = createContinuousSequence(project, requestedSceneId);
  if (!sequence.spawn) throw new Error('A primeira cena precisa de uma entrada do player.');
  return { project, initialScene: sequence.scene, spawn: sequence.spawn, levelId: level?.id ?? null, sequenceSegments: sequence.segments };
}
