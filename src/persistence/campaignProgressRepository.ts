import type { CampaignProgress, ElFuegoProject } from '../types/project';
import { createInitialCampaignProgress, normalizeCampaignProgress } from '../project/campaignProgress';
import { db } from './database';

export async function loadCampaignProgress(project: ElFuegoProject): Promise<CampaignProgress | null> {
  const stored = await db.campaignProgress.get(project.project.id);
  return normalizeCampaignProgress(project, stored?.data);
}

export async function saveCampaignProgress(progress: CampaignProgress): Promise<void> {
  const data = structuredClone(progress);
  data.updatedAt = new Date().toISOString();
  await db.campaignProgress.put({ projectId: data.projectId, updatedAt: data.updatedAt, data });
}

export async function resetCampaignProgress(project: ElFuegoProject): Promise<CampaignProgress | null> {
  await db.campaignProgress.delete(project.project.id);
  return createInitialCampaignProgress(project);
}
