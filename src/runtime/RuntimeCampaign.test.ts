import { describe, expect, it } from 'vitest';
import { createTenLevelCampaign } from '../project/campaign';
import { createInitialCampaignProgress, normalizeCampaignProgress } from '../project/campaignProgress';
import { createEmptyProject } from '../project/projectFactory';
import type { RuntimeWorld } from './RuntimeWorld';
import { enterCampaignScene, recordCampaignLevelCompletion } from './RuntimeCampaign';

describe('progresso da campanha', () => {
  it('libera somente a primeira fase no progresso novo', () => {
    const project = createTenLevelCampaign(createEmptyProject());
    const progress = createInitialCampaignProgress(project);
    expect(progress?.unlockedLevelIds).toEqual(['fase-01']);
    expect(progress?.lastLevelId).toBe('fase-01');
  });

  it('remove referências a fases apagadas sem perder progresso compatível', () => {
    const project = createTenLevelCampaign(createEmptyProject());
    const progress = createInitialCampaignProgress(project)!;
    progress.unlockedLevelIds.push('fase-removida');
    progress.completedLevelIds.push('fase-removida');
    progress.checkpoints['fase-removida'] = { sceneId: 'x', objectId: 'y', x: 1, y: 2, respawnHealth: 3 };
    const normalized = normalizeCampaignProgress(project, progress)!;
    expect(normalized.unlockedLevelIds).not.toContain('fase-removida');
    expect(normalized.completedLevelIds).not.toContain('fase-removida');
    expect(normalized.checkpoints['fase-removida']).toBeUndefined();
  });

  it('conclui uma fase e libera a próxima', () => {
    const project = createTenLevelCampaign(createEmptyProject());
    const progress = createInitialCampaignProgress(project)!;
    const world = {
      project,
      currentLevelId: 'fase-01',
      campaignProgress: progress,
      campaignProgressRevision: 0,
      campaignElapsed: 12.5,
      campaignDeaths: 1,
      player: { health: 2, attack: 3, defense: 1 },
      variables: { encontrouMapa: true },
    } as unknown as RuntimeWorld;

    recordCampaignLevelCompletion(world);

    expect(progress.completedLevelIds).toContain('fase-01');
    expect(progress.unlockedLevelIds).toContain('fase-02');
    expect(progress.bestResults['fase-01']).toMatchObject({ deaths: 1, elapsedMs: 12_500 });
    expect(progress.storyVariables).toEqual({ encontrouMapa: true });
    expect(world.campaignProgressRevision).toBe(1);
  });

  it('reconhece a entrada na cena inicial da fase seguinte', () => {
    const project = createTenLevelCampaign(createEmptyProject());
    const progress = createInitialCampaignProgress(project)!;
    const world = {
      project,
      currentLevelId: 'fase-01',
      campaignProgress: progress,
      campaignProgressRevision: 0,
      campaignElapsed: 20,
      campaignDeaths: 2,
      player: { health: 3, attack: 1, defense: 1 },
      variables: {},
    } as unknown as RuntimeWorld;

    enterCampaignScene(world, project.campaign!.chapters[0].levels[1].initialSceneId);

    expect(progress.completedLevelIds).toContain('fase-01');
    expect(world.currentLevelId).toBe('fase-02');
    expect(progress.lastLevelId).toBe('fase-02');
    expect(world.campaignElapsed).toBe(0);
    expect(world.campaignDeaths).toBe(0);
  });
});
