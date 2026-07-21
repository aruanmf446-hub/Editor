import { campaignLevels } from '../project/campaign';
import type { CampaignProgress } from '../types/project';
import type { RuntimeWorld } from './RuntimeWorld';

export function restoreCampaignProgress(world: RuntimeWorld, progress: CampaignProgress | null): void {
  if (!progress || !world.currentLevelId) return;
  world.campaignProgress = structuredClone(progress);
  world.collectedObjectIds = Object.fromEntries(progress.collectedObjectIds.map((id) => [id, true]));
  world.collectibleTotals = { ...(progress.collectibleTotals ?? {}) };
  world.variables = { ...progress.storyVariables };
  world.player.maxHealth = Math.max(world.player.maxHealth, progress.lives);
  world.player.health = Math.min(world.player.maxHealth, Math.max(1, progress.lives));
  world.player.attack = Math.max(0, progress.attack);
  world.player.defense = Math.max(0, progress.defense);
  const checkpoint = progress.checkpoints[world.currentLevelId];
  if (checkpoint?.sceneId === world.scene.id) {
    world.activeCheckpoint = { ...checkpoint, order: 0 };
    world.player.spawnX = checkpoint.x;
    world.player.spawnY = checkpoint.y;
    world.player.x = checkpoint.x;
    world.player.y = checkpoint.y;
    world.player.respawnHealth = checkpoint.respawnHealth;
  }
}

function changed(world: RuntimeWorld): void {
  if (!world.campaignProgress) return;
  world.campaignProgress.updatedAt = new Date().toISOString();
  world.campaignProgressRevision = (world.campaignProgressRevision ?? 0) + 1;
}

export function recordCampaignCheckpoint(world: RuntimeWorld): void {
  const progress = world.campaignProgress;
  const levelId = world.currentLevelId;
  const checkpoint = world.activeCheckpoint;
  if (!progress || !levelId || !checkpoint) return;
  progress.checkpoints[levelId] = { sceneId: checkpoint.sceneId, objectId: checkpoint.objectId, x: checkpoint.x, y: checkpoint.y, respawnHealth: checkpoint.respawnHealth };
  progress.lastLevelId = levelId;
  progress.lives = world.player.health;
  progress.attack = world.player.attack;
  progress.defense = world.player.defense;
  changed(world);
}

export function recordCampaignCollectible(world: RuntimeWorld, objectId: string, collectibleId = objectId, value = 1, persistent = true): void {
  const progress = world.campaignProgress;
  if (!progress) return;
  const firstPersistentCollection = !progress.collectedObjectIds.includes(objectId);
  if (persistent && firstPersistentCollection) progress.collectedObjectIds.push(objectId);
  progress.collectibleTotals ??= {};
  progress.collectibleTotals[collectibleId] = (progress.collectibleTotals[collectibleId] ?? 0) + Math.max(0, value);
  progress.lives = world.player.health;
  progress.attack = world.player.attack;
  progress.defense = world.player.defense;
  changed(world);
}

export function recordCampaignStats(world: RuntimeWorld): void {
  const progress = world.campaignProgress;
  if (!progress) return;
  progress.lives = world.player.health;
  progress.attack = world.player.attack;
  progress.defense = world.player.defense;
  progress.storyVariables = { ...(world.variables ?? {}) };
  progress.collectibleTotals = { ...(world.collectibleTotals ?? {}) };
  changed(world);
}

export function recordCampaignLevelCompletion(world: RuntimeWorld): void {
  const progress = world.campaignProgress;
  const levelId = world.currentLevelId;
  if (!progress || !levelId) return;
  if (!progress.completedLevelIds.includes(levelId)) progress.completedLevelIds.push(levelId);
  for (const level of campaignLevels(world.project.campaign)) {
    if (!level.unlockAfterLevelId || progress.completedLevelIds.includes(level.unlockAfterLevelId)) {
      if (!progress.unlockedLevelIds.includes(level.id)) progress.unlockedLevelIds.push(level.id);
    }
  }
  progress.lastLevelId = levelId;
  progress.lives = world.player.health;
  progress.attack = world.player.attack;
  progress.defense = world.player.defense;
  progress.storyVariables = { ...(world.variables ?? {}) };
  progress.collectibleTotals = { ...(world.collectibleTotals ?? {}) };
  const result = { completedAt: new Date().toISOString(), deaths: world.campaignDeaths ?? 0, elapsedMs: Math.round((world.campaignElapsed ?? 0) * 1000) };
  const previous = progress.bestResults[levelId];
  if (!previous || result.elapsedMs < previous.elapsedMs) progress.bestResults[levelId] = result;
  changed(world);
}

export function enterCampaignScene(world: RuntimeWorld, sceneId: string): void {
  const targetLevel = campaignLevels(world.project.campaign).find((level) => level.initialSceneId === sceneId);
  if (!targetLevel || targetLevel.id === world.currentLevelId) return;
  if (world.currentLevelId) recordCampaignLevelCompletion(world);
  if (world.campaignProgress && !world.campaignProgress.unlockedLevelIds.includes(targetLevel.id)) return;
  world.currentLevelId = targetLevel.id;
  world.campaignElapsed = 0;
  world.campaignDeaths = 0;
  if (world.campaignProgress) {
    world.campaignProgress.lastLevelId = targetLevel.id;
    changed(world);
  }
}
