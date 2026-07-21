import { describe, expect, it } from 'vitest';
import { validateProject } from '../validation/validateProject';
import { createEmptyProject } from './projectFactory';
import { projectSchema } from './projectSchema';

describe('createEmptyProject', () => {
  it('cria exatamente uma cena vazia', () => {
    const project = createEmptyProject();
    expect(project.scenes).toHaveLength(1);
    expect(project.scenes[0].objects).toEqual([]);
    expect(project.scenes[0].backgroundAssetId).toBeNull();
  });

  it('gera um projeto estruturalmente válido', () => {
    expect(projectSchema.safeParse(createEmptyProject()).success).toBe(true);
  });

  it('informa que o projeto vazio ainda precisa de entrada inicial', () => {
    expect(validateProject(createEmptyProject()).issues.map((issue) => issue.code)).toContain('MISSING_INITIAL_SCENE_ENTRY');
  });

  it('rejeita valores não finitos', () => {
    const project = createEmptyProject();
    project.settings.gravity = Number.NaN;
    expect(validateProject(project).valid).toBe(false);
  });
});
