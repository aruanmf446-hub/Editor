import { migrateProject } from '../project/migrateProject';
import { projectSchema } from '../project/projectSchema';
import type { ElFuegoProject, SceneObjectBase } from '../types/project';

export type ValidationIssue = { severity: 'error' | 'warning' | 'info'; code: string; message: string; sceneId?: string; objectId?: string };
const overlaps = (a: SceneObjectBase, b: SceneObjectBase) => a.transform.x < b.transform.x + b.transform.width && a.transform.x + a.transform.width > b.transform.x && a.transform.y < b.transform.y + b.transform.height && a.transform.y + a.transform.height > b.transform.y;

function findTransitionCycles(project: ElFuegoProject): string[][] {
  const graph = new Map<string, string[]>();
  for (const scene of project.scenes) {
    const targets = scene.objects.filter((object) => object.type === 'finish' && object.targetSceneId).map((object) => object.targetSceneId as string);
    graph.set(scene.id, targets);
  }
  const cycles: string[][] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];
  const visit = (id: string) => {
    if (visiting.has(id)) {
      const start = stack.indexOf(id);
      cycles.push(stack.slice(start).concat(id));
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id); stack.push(id);
    for (const next of graph.get(id) ?? []) if (graph.has(next)) visit(next);
    stack.pop(); visiting.delete(id); visited.add(id);
  };
  for (const id of graph.keys()) visit(id);
  return cycles;
}

export function validateProject(input: unknown): { valid: boolean; project?: ElFuegoProject; issues: ValidationIssue[] } {
  const migrated = migrateProject(input);
  const parsed = projectSchema.safeParse(migrated);
  if (!parsed.success) return { valid: false, issues: parsed.error.issues.map((issue) => ({ severity: 'error', code: 'SCHEMA_INVALID', message: `${issue.path.join('.')}: ${issue.message}` })) };

  const project = parsed.data as ElFuegoProject;
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  const assetIds = new Set(project.assets.map((asset) => asset.id));
  const sceneIds = new Set(project.scenes.map((scene) => scene.id));
  let spawnCount = 0;

  for (const scene of project.scenes) {
    if (ids.has(scene.id)) issues.push({ severity: 'error', code: 'DUPLICATE_ID', message: 'ID de cena duplicado.', sceneId: scene.id });
    ids.add(scene.id);
    if (!scene.backgroundAssetId) issues.push({ severity: 'warning', code: 'SCENE_WITHOUT_BACKGROUND', message: `${scene.name} não possui cenário.`, sceneId: scene.id });
    else if (!assetIds.has(scene.backgroundAssetId)) issues.push({ severity: 'error', code: 'MISSING_BACKGROUND_ASSET', message: `O cenário de ${scene.name} não existe.`, sceneId: scene.id });

    const finishes = scene.objects.filter((object) => object.type === 'finish');
    if (finishes.length > 1) issues.push({ severity: 'error', code: 'MULTIPLE_FINISHES', message: `${scene.name} possui mais de um fim de fase.`, sceneId: scene.id });
    const checkpoints = scene.objects.filter((object) => object.type === 'checkpoint');
    for (let i = 0; i < checkpoints.length; i++) for (let j = i + 1; j < checkpoints.length; j++) if (overlaps(checkpoints[i], checkpoints[j])) issues.push({ severity: 'warning', code: 'OVERLAPPING_CHECKPOINTS', message: 'Checkpoints estão sobrepostos.', sceneId: scene.id, objectId: checkpoints[j].id });

    for (const object of scene.objects) {
      if (ids.has(object.id)) issues.push({ severity: 'error', code: 'DUPLICATE_ID', message: `ID duplicado: ${object.name}`, sceneId: scene.id, objectId: object.id });
      ids.add(object.id);
      if (object.type === 'player-spawn') spawnCount++;
      if (object.assetId && !assetIds.has(object.assetId)) issues.push({ severity: 'error', code: 'MISSING_ASSET', message: `Asset ausente em ${object.name}.`, sceneId: scene.id, objectId: object.id });
      const t = object.transform;
      if (t.x < 0 || t.y < 0 || t.x + t.width > scene.width || t.y + t.height > scene.height) issues.push({ severity: 'error', code: 'OBJECT_OUTSIDE_SCENE', message: `${object.name} está fora da cena.`, sceneId: scene.id, objectId: object.id });

      if (object.type === 'enemy-cactus') {
        const left = object.patrolLeft ?? 0, right = object.patrolRight ?? 0, walk = object.walkSpeed ?? 0, run = object.runSpeed ?? 0, vision = object.visionDistance ?? 0, attack = object.attackDistance ?? 0;
        if (left > right) issues.push({ severity: 'error', code: 'CACTUS_PATROL_ORDER', message: `${object.name}: limite esquerdo maior que o direito.`, sceneId: scene.id, objectId: object.id });
        if (left < 0 || right > scene.width) issues.push({ severity: 'error', code: 'CACTUS_PATROL_OUTSIDE', message: `${object.name}: patrulha fora da cena.`, sceneId: scene.id, objectId: object.id });
        if (walk > run) issues.push({ severity: 'error', code: 'CACTUS_SPEED_ORDER', message: `${object.name}: caminhada maior que corrida.`, sceneId: scene.id, objectId: object.id });
        if (attack > vision) issues.push({ severity: 'error', code: 'CACTUS_ATTACK_VISION', message: `${object.name}: ataque maior que visão.`, sceneId: scene.id, objectId: object.id });
        if ((object.attackCooldownMs ?? 0) <= 0) issues.push({ severity: 'error', code: 'CACTUS_COOLDOWN', message: `${object.name}: intervalo inválido.`, sceneId: scene.id, objectId: object.id });
      }

      if (object.type === 'finish') {
        const target = object.targetSceneId;
        if (target && !sceneIds.has(target)) issues.push({ severity: 'error', code: 'FINISH_TARGET_MISSING', message: `${object.name}: cena de destino inexistente.`, sceneId: scene.id, objectId: object.id });
        if (target === scene.id) issues.push({ severity: 'warning', code: 'FINISH_SELF_TARGET', message: `${object.name}: destino aponta para a própria cena.`, sceneId: scene.id, objectId: object.id });
        if (!target && scene.order < project.scenes.length - 1) issues.push({ severity: 'info', code: 'FINISH_USES_NEXT_SCENE', message: `${object.name}: usará a próxima cena pela ordem.`, sceneId: scene.id, objectId: object.id });
        if (!target && scene.order === project.scenes.length - 1) issues.push({ severity: 'warning', code: 'LAST_SCENE_WITHOUT_ENDING', message: `${object.name}: última cena sem destino ou encerramento final explícito.`, sceneId: scene.id, objectId: object.id });
      }
    }
  }

  if (spawnCount === 0) issues.push({ severity: 'error', code: 'MISSING_GLOBAL_SPAWN', message: 'O projeto não possui spawn global do player.' });
  if (spawnCount > 1) issues.push({ severity: 'error', code: 'MULTIPLE_GLOBAL_SPAWNS', message: 'O modelo atual aceita somente um spawn global do player.' });
  for (const cycle of findTransitionCycles(project)) issues.push({ severity: 'warning', code: 'SCENE_TRANSITION_CYCLE', message: `Ciclo de cenas detectado: ${cycle.join(' → ')}.` });

  return { valid: !issues.some((issue) => issue.severity === 'error'), project, issues };
}
