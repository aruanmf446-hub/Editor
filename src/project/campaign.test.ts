import { describe, expect, it } from 'vitest';
import { validateProject } from '../validation/validateProject';
import { createTenLevelCampaign, EL_FUEGO_LEVEL_COUNT } from './campaign';
import { createEmptyProject } from './projectFactory';

describe('campanha do El Fuego', () => {
  it('prepara dez fases sem confundir fase com cena', () => {
    const project = createTenLevelCampaign(createEmptyProject());
    const levels = project.campaign?.chapters[0].levels ?? [];
    expect(levels).toHaveLength(EL_FUEGO_LEVEL_COUNT);
    expect(project.scenes).toHaveLength(EL_FUEGO_LEVEL_COUNT);
    expect(new Set(levels.map((level) => level.initialSceneId)).size).toBe(EL_FUEGO_LEVEL_COUNT);
    expect(levels[0].unlockAfterLevelId).toBeNull();
    expect(levels[1].unlockAfterLevelId).toBe(levels[0].id);
  });

  it('preserva as cenas existentes ao completar a campanha', () => {
    const source = createEmptyProject();
    const sceneId = source.scenes[0].id;
    expect(createTenLevelCampaign(source).scenes[0].id).toBe(sceneId);
  });

  it('detecta cena inicial inexistente na campanha', () => {
    const project = createTenLevelCampaign(createEmptyProject());
    project.campaign!.chapters[0].levels[0].initialSceneId = 'cena-inexistente';
    expect(validateProject(project).issues.map((issue) => issue.code)).toContain('LEVEL_INITIAL_SCENE_MISSING');
  });
});
