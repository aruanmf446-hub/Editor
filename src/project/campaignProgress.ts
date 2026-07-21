import type { CampaignProgress, ElFuegoProject } from '../types/project';
import { campaignLevels } from './campaign';

const unique = (values: string[]) => [...new Set(values)];

export function createInitialCampaignProgress(project: ElFuegoProject): CampaignProgress | null {
  const levels = campaignLevels(project.campaign);
  if (!levels.length) return null;
  const initiallyUnlocked = levels.filter((level, index) => index === 0 || !level.unlockAfterLevelId).map((level) => level.id);
  return {
    projectId: project.project.id,
    unlockedLevelIds: unique(initiallyUnlocked),
    completedLevelIds: [],
    checkpoints: {},
    lives: 3,
    attack: 1,
    defense: 1,
    collectedObjectIds: [],
    bestResults: {},
    lastLevelId: levels[0].id,
    storyVariables: {},
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeCampaignProgress(project: ElFuegoProject, value?: CampaignProgress | null): CampaignProgress | null {
  const initial = createInitialCampaignProgress(project);
  if (!initial) return null;
  if (!value || value.projectId !== project.project.id) return initial;
  const levels = campaignLevels(project.campaign);
  const validIds = new Set(levels.map((level) => level.id));
  const unlocked = value.unlockedLevelIds.filter((id) => validIds.has(id));
  const completed = value.completedLevelIds.filter((id) => validIds.has(id));
  const lastLevelId = value.lastLevelId && validIds.has(value.lastLevelId) && unlocked.includes(value.lastLevelId)
    ? value.lastLevelId
    : initial.lastLevelId;
  return {
    ...initial,
    ...value,
    unlockedLevelIds: unique([...initial.unlockedLevelIds, ...unlocked]),
    completedLevelIds: unique(completed),
    checkpoints: Object.fromEntries(Object.entries(value.checkpoints).filter(([id]) => validIds.has(id))),
    collectedObjectIds: unique(value.collectedObjectIds),
    lastLevelId,
    updatedAt: value.updatedAt || initial.updatedAt,
  };
}
