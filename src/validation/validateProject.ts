import { migrateProject } from '../project/migrateProject';
import { projectSchema } from '../project/projectSchema';
import type { ElFuegoProject, ProjectScene, SceneObjectBase } from '../types/project';

export type ValidationIssue = {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  sceneId?: string;
  objectId?: string;
};

const overlaps = (a: SceneObjectBase, b: SceneObjectBase) =>
  a.transform.x < b.transform.x + b.transform.width
  && a.transform.x + a.transform.width > b.transform.x
  && a.transform.y < b.transform.y + b.transform.height
  && a.transform.y + a.transform.height > b.transform.y;

function visibleEntries(scene: ProjectScene): SceneObjectBase[] {
  return scene.objects.filter((object) => object.type === 'player-spawn' && object.visible && !object.editorOnly);
}

function entryExists(scene: ProjectScene | undefined, entryId: string | undefined): boolean {
  if (!entryId?.trim()) return true;
  return Boolean(scene && visibleEntries(scene).some((entry) => entry.entryId?.trim() === entryId.trim()));
}

function buildGraph(project: ElFuegoProject): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  const ordered = [...project.scenes].sort((a, b) => a.order - b.order);

  for (let index = 0; index < ordered.length; index += 1) {
    const scene = ordered[index];
    const targets: string[] = [];

    for (const finish of scene.objects.filter((object) => object.type === 'finish')) {
      const mode = finish.endingMode ?? (finish.targetSceneId ? 'target-scene' : 'next-scene');
      if (mode === 'target-scene' && finish.targetSceneId) targets.push(finish.targetSceneId);
      if (mode === 'next-scene' && ordered[index + 1]) targets.push(ordered[index + 1].id);
    }

    for (const trigger of scene.objects.filter((object) => object.type === 'trigger')) {
      for (const action of trigger.triggerActions ?? []) {
        if (action.type === 'transition-scene' && action.targetSceneId) targets.push(action.targetSceneId);
      }
    }

    graph.set(scene.id, [...new Set(targets)]);
  }

  return graph;
}

function graphIssues(project: ElFuegoProject): ValidationIssue[] {
  const graph = buildGraph(project);
  const issues: ValidationIssue[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];
  const cycleKeys = new Set<string>();

  const visit = (id: string) => {
    if (visiting.has(id)) {
      const start = stack.indexOf(id);
      const cycle = stack.slice(start).concat(id);
      const key = [...new Set(cycle)].sort().join('|');
      if (!cycleKeys.has(key)) {
        cycleKeys.add(key);
        issues.push({ severity: 'warning', code: 'SCENE_TRANSITION_CYCLE', message: `Ciclo de cenas detectado: ${cycle.join(' → ')}.` });
      }
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    stack.push(id);
    for (const next of graph.get(id) ?? []) if (graph.has(next)) visit(next);
    stack.pop();
    visiting.delete(id);
    visited.add(id);
  };

  for (const id of graph.keys()) visit(id);

  const first = [...project.scenes].sort((a, b) => a.order - b.order)[0]?.id;
  const reachable = new Set<string>();
  const walk = (id: string) => {
    if (reachable.has(id)) return;
    reachable.add(id);
    for (const next of graph.get(id) ?? []) if (graph.has(next)) walk(next);
  };
  if (first) walk(first);

  for (const scene of project.scenes) {
    if (!reachable.has(scene.id)) {
      issues.push({ severity: 'warning', code: 'UNREACHABLE_SCENE', message: `${scene.name} não é alcançável a partir da primeira cena.`, sceneId: scene.id });
    }
  }

  for (const key of cycleKeys) {
    const members = key.split('|');
    const hasExit = members.some((id) => (graph.get(id) ?? []).some((next) => !members.includes(next)));
    if (!hasExit) issues.push({ severity: 'warning', code: 'SCENE_CYCLE_WITHOUT_EXIT', message: 'Há um ciclo de cenas sem saída para outro componente.' });
  }

  return issues;
}

function validateEntries(project: ElFuegoProject, issues: ValidationIssue[]): void {
  const ordered = [...project.scenes].sort((a, b) => a.order - b.order);
  const firstScene = ordered[0];

  for (const scene of project.scenes) {
    const entries = visibleEntries(scene);
    if (scene.id === firstScene?.id && entries.length === 0) {
      issues.push({ severity: 'error', code: 'MISSING_INITIAL_SCENE_ENTRY', message: `${scene.name} precisa de uma entrada do player para iniciar o jogo.`, sceneId: scene.id });
    } else if (entries.length === 0) {
      issues.push({ severity: 'warning', code: 'SCENE_WITHOUT_ENTRY', message: `${scene.name} não possui entrada própria; o runtime usará uma entrada automática de compatibilidade.`, sceneId: scene.id });
    }

    const ids = new Set<string>();
    let defaultCount = 0;
    for (const entry of entries) {
      const entryId = entry.entryId?.trim();
      if (entry.defaultEntry) defaultCount += 1;
      if (!entryId) {
        if (entries.length > 1) {
          issues.push({ severity: 'warning', code: 'UNNAMED_ENTRY', message: `${entry.name}: defina um identificador para permitir transições específicas.`, sceneId: scene.id, objectId: entry.id });
        }
        continue;
      }
      if (ids.has(entryId)) {
        issues.push({ severity: 'error', code: 'DUPLICATE_ENTRY_ID', message: `${scene.name} possui mais de uma entrada chamada “${entryId}”.`, sceneId: scene.id, objectId: entry.id });
      }
      ids.add(entryId);
    }

    if (defaultCount > 1) {
      issues.push({ severity: 'error', code: 'MULTIPLE_DEFAULT_ENTRIES', message: `${scene.name} possui mais de uma entrada marcada como padrão.`, sceneId: scene.id });
    }
    if (entries.length > 1 && defaultCount === 0) {
      issues.push({ severity: 'warning', code: 'MISSING_DEFAULT_ENTRY', message: `${scene.name} possui várias entradas, mas nenhuma foi marcada como padrão.`, sceneId: scene.id });
    }
  }
}

function validateFinish(
  project: ElFuegoProject,
  scene: ProjectScene,
  finish: SceneObjectBase,
  ordered: ProjectScene[],
  sceneIds: Set<string>,
  issues: ValidationIssue[],
): void {
  const mode = finish.endingMode ?? 'next-scene';
  const targetId = finish.targetSceneId;
  if (mode === 'target-scene' && !targetId) {
    issues.push({ severity: 'error', code: 'FINISH_TARGET_REQUIRED', message: `${finish.name}: escolha uma cena de destino.`, sceneId: scene.id, objectId: finish.id });
  }
  if (mode === 'target-scene' && targetId && !sceneIds.has(targetId)) {
    issues.push({ severity: 'error', code: 'FINISH_TARGET_MISSING', message: `${finish.name}: cena de destino inexistente.`, sceneId: scene.id, objectId: finish.id });
  }
  if (mode === 'target-scene' && targetId === scene.id) {
    issues.push({ severity: 'warning', code: 'FINISH_SELF_TARGET', message: `${finish.name}: destino aponta para a própria cena.`, sceneId: scene.id, objectId: finish.id });
  }
  if (mode === 'next-scene' && ordered.at(-1)?.id === scene.id) {
    issues.push({ severity: 'error', code: 'LAST_SCENE_WITHOUT_ENDING', message: `${finish.name}: a última cena precisa concluir o jogo ou apontar para outra cena.`, sceneId: scene.id, objectId: finish.id });
  }

  const currentIndex = ordered.findIndex((candidate) => candidate.id === scene.id);
  const targetScene = mode === 'target-scene'
    ? project.scenes.find((candidate) => candidate.id === targetId)
    : mode === 'next-scene'
      ? ordered[currentIndex + 1]
      : undefined;
  if (finish.targetEntryId?.trim() && !entryExists(targetScene, finish.targetEntryId)) {
    issues.push({ severity: 'error', code: 'FINISH_ENTRY_MISSING', message: `${finish.name}: a entrada “${finish.targetEntryId}” não existe na cena de destino.`, sceneId: scene.id, objectId: finish.id });
  }
}

function validateTriggerActions(project: ElFuegoProject, scene: ProjectScene, object: SceneObjectBase, issues: ValidationIssue[]): void {
  for (const action of object.triggerActions ?? []) {
    if (action.type !== 'transition-scene') continue;
    const target = project.scenes.find((candidate) => candidate.id === action.targetSceneId);
    if (!target) {
      issues.push({ severity: 'error', code: 'TRIGGER_SCENE_MISSING', message: `${object.name}: uma ação aponta para uma cena inexistente.`, sceneId: scene.id, objectId: object.id });
      continue;
    }
    if (action.targetEntryId?.trim() && !entryExists(target, action.targetEntryId)) {
      issues.push({ severity: 'error', code: 'TRIGGER_ENTRY_MISSING', message: `${object.name}: a entrada “${action.targetEntryId}” não existe em ${target.name}.`, sceneId: scene.id, objectId: object.id });
    }
  }
}

export function validateProject(input: unknown): { valid: boolean; project?: ElFuegoProject; issues: ValidationIssue[] } {
  const parsed = projectSchema.safeParse(migrateProject(input));
  if (!parsed.success) {
    return {
      valid: false,
      issues: parsed.error.issues.map((issue) => ({ severity: 'error', code: 'SCHEMA_INVALID', message: `${issue.path.join('.')}: ${issue.message}` })),
    };
  }

  const project = parsed.data as ElFuegoProject;
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  const assetIds = new Set(project.assets.map((asset) => asset.id));
  const sceneIds = new Set(project.scenes.map((scene) => scene.id));
  const ordered = [...project.scenes].sort((a, b) => a.order - b.order);

  validateEntries(project, issues);

  for (const scene of project.scenes) {
    if (ids.has(scene.id)) issues.push({ severity: 'error', code: 'DUPLICATE_ID', message: 'ID de cena duplicado.', sceneId: scene.id });
    ids.add(scene.id);

    if (!scene.backgroundAssetId) {
      issues.push({ severity: 'warning', code: 'SCENE_WITHOUT_BACKGROUND', message: `${scene.name} não possui cenário.`, sceneId: scene.id });
    } else if (!assetIds.has(scene.backgroundAssetId)) {
      issues.push({ severity: 'error', code: 'MISSING_BACKGROUND_ASSET', message: `O cenário de ${scene.name} não existe.`, sceneId: scene.id });
    }

    const finishes = scene.objects.filter((object) => object.type === 'finish');
    if (finishes.length > 1) issues.push({ severity: 'error', code: 'MULTIPLE_FINISHES', message: `${scene.name} possui mais de um fim de fase.`, sceneId: scene.id });

    const checkpoints = scene.objects.filter((object) => object.type === 'checkpoint');
    for (let first = 0; first < checkpoints.length; first += 1) {
      for (let second = first + 1; second < checkpoints.length; second += 1) {
        if (overlaps(checkpoints[first], checkpoints[second])) {
          issues.push({ severity: 'warning', code: 'OVERLAPPING_CHECKPOINTS', message: 'Checkpoints estão sobrepostos.', sceneId: scene.id, objectId: checkpoints[second].id });
        }
      }
    }

    for (const object of scene.objects) {
      if (ids.has(object.id)) issues.push({ severity: 'error', code: 'DUPLICATE_ID', message: `ID duplicado: ${object.name}`, sceneId: scene.id, objectId: object.id });
      ids.add(object.id);
      if (object.assetId && !assetIds.has(object.assetId)) issues.push({ severity: 'error', code: 'MISSING_ASSET', message: `Asset ausente em ${object.name}.`, sceneId: scene.id, objectId: object.id });

      const transform = object.transform;
      if (transform.x < 0 || transform.y < 0 || transform.x + transform.width > scene.width || transform.y + transform.height > scene.height) {
        issues.push({ severity: 'error', code: 'OBJECT_OUTSIDE_SCENE', message: `${object.name} está fora da cena.`, sceneId: scene.id, objectId: object.id });
      }

      if (object.type === 'enemy-cactus') {
        const left = object.patrolLeft ?? 0;
        const right = object.patrolRight ?? 0;
        const walk = object.walkSpeed ?? 0;
        const run = object.runSpeed ?? 0;
        const vision = object.visionDistance ?? 0;
        const attack = object.attackDistance ?? 0;
        if (left > right) issues.push({ severity: 'error', code: 'CACTUS_PATROL_ORDER', message: `${object.name}: limite esquerdo maior que o direito.`, sceneId: scene.id, objectId: object.id });
        if (left < 0 || right > scene.width) issues.push({ severity: 'error', code: 'CACTUS_PATROL_OUTSIDE', message: `${object.name}: patrulha fora da cena.`, sceneId: scene.id, objectId: object.id });
        if (walk > run) issues.push({ severity: 'error', code: 'CACTUS_SPEED_ORDER', message: `${object.name}: caminhada maior que corrida.`, sceneId: scene.id, objectId: object.id });
        if (attack > vision) issues.push({ severity: 'error', code: 'CACTUS_ATTACK_VISION', message: `${object.name}: ataque maior que visão.`, sceneId: scene.id, objectId: object.id });
        if ((object.attackCooldownMs ?? 0) <= 0) issues.push({ severity: 'error', code: 'CACTUS_COOLDOWN', message: `${object.name}: intervalo inválido.`, sceneId: scene.id, objectId: object.id });
      }

      if (object.type === 'finish') validateFinish(project, scene, object, ordered, sceneIds, issues);
      if (object.type === 'trigger') validateTriggerActions(project, scene, object, issues);
    }
  }

  issues.push(...graphIssues(project));
  return { valid: !issues.some((issue) => issue.severity === 'error'), project, issues };
}
