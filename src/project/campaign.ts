import type {
  CampaignDefinition,
  CampaignLevel,
  ElFuegoProject,
} from '../types/project';
import { createEmptyScene } from './projectFactory';

export const EL_FUEGO_LEVEL_COUNT = 10;

export function campaignLevels(campaign?: CampaignDefinition): CampaignLevel[] {
  return campaign?.chapters.flatMap((chapter) => chapter.levels) ?? [];
}

export function createTenLevelCampaign(project: ElFuegoProject): ElFuegoProject {
  const scenes = [...project.scenes];
  while (scenes.length < EL_FUEGO_LEVEL_COUNT) {
    const scene = createEmptyScene(scenes.length);
    scene.name = `Fase ${String(scenes.length + 1).padStart(2, '0')}`;
    scenes.push(scene);
  }

  const previousLevels = campaignLevels(project.campaign);
  const levels: CampaignLevel[] = scenes.slice(0, EL_FUEGO_LEVEL_COUNT).map((scene, index) => ({
    id: previousLevels[index]?.id ?? `fase-${String(index + 1).padStart(2, '0')}`,
    name: previousLevels[index]?.name ?? `Fase ${String(index + 1).padStart(2, '0')}`,
    initialSceneId: previousLevels[index]?.initialSceneId && scenes.some((candidate) => candidate.id === previousLevels[index].initialSceneId)
      ? previousLevels[index].initialSceneId
      : scene.id,
    unlockAfterLevelId: index === 0 ? null : previousLevels[index]?.unlockAfterLevelId ?? (previousLevels[index - 1]?.id ?? `fase-${String(index).padStart(2, '0')}`),
  }));

  return {
    ...project,
    scenes: scenes.map((scene, order) => ({ ...scene, order })),
    campaign: {
      chapters: [{
        id: project.campaign?.chapters[0]?.id ?? 'cidade-desertica',
        name: project.campaign?.chapters[0]?.name ?? 'Cidade desértica',
        levels,
      }],
    },
  };
}
