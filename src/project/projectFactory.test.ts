import { describe, expect, it } from 'vitest';
import { createEmptyProject } from './projectFactory';
import { validateProject } from '../validation/validateProject';

describe('createEmptyProject',()=>{
  it('cria exatamente uma cena vazia',()=>{const project=createEmptyProject();expect(project.scenes).toHaveLength(1);expect(project.scenes[0].objects).toEqual([]);expect(project.scenes[0].backgroundAssetId).toBeNull();});
  it('gera um projeto válido',()=>{expect(validateProject(createEmptyProject()).valid).toBe(true);});
  it('rejeita valores não finitos',()=>{const project=createEmptyProject();project.settings.gravity=Number.NaN;expect(validateProject(project).valid).toBe(false);});
});