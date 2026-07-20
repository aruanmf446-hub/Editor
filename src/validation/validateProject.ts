import { projectSchema } from '../project/projectSchema';
import type { ElFuegoProject } from '../types/project';

export type ValidationIssue = { severity: 'error' | 'warning'; code: string; message: string; sceneId?: string };

export function validateProject(input: unknown): { valid: boolean; project?: ElFuegoProject; issues: ValidationIssue[] } {
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) return { valid:false, issues:parsed.error.issues.map((issue)=>({severity:'error',code:'SCHEMA_INVALID',message:`${issue.path.join('.')}: ${issue.message}`})) };
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  for (const scene of parsed.data.scenes) {
    if (ids.has(scene.id)) issues.push({severity:'error',code:'DUPLICATE_ID',message:'ID de cena duplicado.',sceneId:scene.id});
    ids.add(scene.id);
    for (const object of scene.objects) {
      if (ids.has(object.id)) issues.push({severity:'error',code:'DUPLICATE_ID',message:`ID duplicado: ${object.name}`,sceneId:scene.id});
      ids.add(object.id);
    }
    if (!scene.backgroundAssetId) issues.push({severity:'warning',code:'SCENE_WITHOUT_BACKGROUND',message:`${scene.name} não possui cenário.`,sceneId:scene.id});
  }
  return { valid:!issues.some((issue)=>issue.severity==='error'), project:parsed.data as ElFuegoProject, issues };
}