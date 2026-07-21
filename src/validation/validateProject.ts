import { migrateProject } from '../project/migrateProject';
import { projectSchema } from '../project/projectSchema';
import type { ElFuegoProject, SceneObjectBase } from '../types/project';

export type ValidationIssue = { severity: 'error' | 'warning' | 'info'; code: string; message: string; sceneId?: string; objectId?: string };
const overlaps = (a: SceneObjectBase, b: SceneObjectBase) => a.transform.x < b.transform.x + b.transform.width && a.transform.x + a.transform.width > b.transform.x && a.transform.y < b.transform.y + b.transform.height && a.transform.y + a.transform.height > b.transform.y;

function buildGraph(project: ElFuegoProject): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  const ordered = [...project.scenes].sort((a,b)=>a.order-b.order);
  for (let index=0; index<ordered.length; index++) {
    const scene=ordered[index]; const targets:string[]=[];
    for (const finish of scene.objects.filter(o=>o.type==='finish')) {
      const mode=finish.endingMode??(finish.targetSceneId?'target-scene':'next-scene');
      if (mode==='target-scene'&&finish.targetSceneId) targets.push(finish.targetSceneId);
      if (mode==='next-scene'&&ordered[index+1]) targets.push(ordered[index+1].id);
    }
    graph.set(scene.id,[...new Set(targets)]);
  }
  return graph;
}

function graphIssues(project: ElFuegoProject): ValidationIssue[] {
  const graph=buildGraph(project), issues:ValidationIssue[]=[];
  const visiting=new Set<string>(), visited=new Set<string>(), stack:string[]=[], cycleKeys=new Set<string>();
  const visit=(id:string)=>{if(visiting.has(id)){const start=stack.indexOf(id);const cycle=stack.slice(start).concat(id);const key=[...new Set(cycle)].sort().join('|');if(!cycleKeys.has(key)){cycleKeys.add(key);issues.push({severity:'warning',code:'SCENE_TRANSITION_CYCLE',message:`Ciclo de cenas detectado: ${cycle.join(' → ')}.`});}return;}if(visited.has(id))return;visiting.add(id);stack.push(id);for(const next of graph.get(id)??[])if(graph.has(next))visit(next);stack.pop();visiting.delete(id);visited.add(id);};
  for(const id of graph.keys()) visit(id);
  const first=[...project.scenes].sort((a,b)=>a.order-b.order)[0]?.id;const reachable=new Set<string>();const walk=(id:string)=>{if(reachable.has(id))return;reachable.add(id);for(const next of graph.get(id)??[])if(graph.has(next))walk(next);};if(first)walk(first);
  for(const scene of project.scenes)if(!reachable.has(scene.id))issues.push({severity:'warning',code:'UNREACHABLE_SCENE',message:`${scene.name} não é alcançável a partir da primeira cena.`,sceneId:scene.id});
  for(const key of cycleKeys){const members=key.split('|');const hasExit=members.some(id=>(graph.get(id)??[]).some(next=>!members.includes(next)));if(!hasExit)issues.push({severity:'warning',code:'SCENE_CYCLE_WITHOUT_EXIT',message:'Há um ciclo de cenas sem saída para outro componente.'});}
  return issues;
}

export function validateProject(input: unknown): { valid: boolean; project?: ElFuegoProject; issues: ValidationIssue[] } {
  const parsed = projectSchema.safeParse(migrateProject(input));
  if (!parsed.success) return { valid: false, issues: parsed.error.issues.map((issue) => ({ severity: 'error', code: 'SCHEMA_INVALID', message: `${issue.path.join('.')}: ${issue.message}` })) };
  const project=parsed.data as ElFuegoProject,issues:ValidationIssue[]=[],ids=new Set<string>(),assetIds=new Set(project.assets.map(a=>a.id)),sceneIds=new Set(project.scenes.map(s=>s.id));let spawnCount=0;
  const ordered=[...project.scenes].sort((a,b)=>a.order-b.order);
  for(const scene of project.scenes){if(ids.has(scene.id))issues.push({severity:'error',code:'DUPLICATE_ID',message:'ID de cena duplicado.',sceneId:scene.id});ids.add(scene.id);if(!scene.backgroundAssetId)issues.push({severity:'warning',code:'SCENE_WITHOUT_BACKGROUND',message:`${scene.name} não possui cenário.`,sceneId:scene.id});else if(!assetIds.has(scene.backgroundAssetId))issues.push({severity:'error',code:'MISSING_BACKGROUND_ASSET',message:`O cenário de ${scene.name} não existe.`,sceneId:scene.id});
    const finishes=scene.objects.filter(o=>o.type==='finish');if(finishes.length>1)issues.push({severity:'error',code:'MULTIPLE_FINISHES',message:`${scene.name} possui mais de um fim de fase.`,sceneId:scene.id});const checkpoints=scene.objects.filter(o=>o.type==='checkpoint');for(let i=0;i<checkpoints.length;i++)for(let j=i+1;j<checkpoints.length;j++)if(overlaps(checkpoints[i],checkpoints[j]))issues.push({severity:'warning',code:'OVERLAPPING_CHECKPOINTS',message:'Checkpoints estão sobrepostos.',sceneId:scene.id,objectId:checkpoints[j].id});
    for(const object of scene.objects){if(ids.has(object.id))issues.push({severity:'error',code:'DUPLICATE_ID',message:`ID duplicado: ${object.name}`,sceneId:scene.id,objectId:object.id});ids.add(object.id);if(object.type==='player-spawn')spawnCount++;if(object.assetId&&!assetIds.has(object.assetId))issues.push({severity:'error',code:'MISSING_ASSET',message:`Asset ausente em ${object.name}.`,sceneId:scene.id,objectId:object.id});const t=object.transform;if(t.x<0||t.y<0||t.x+t.width>scene.width||t.y+t.height>scene.height)issues.push({severity:'error',code:'OBJECT_OUTSIDE_SCENE',message:`${object.name} está fora da cena.`,sceneId:scene.id,objectId:object.id});
      if(object.type==='enemy-cactus'){const left=object.patrolLeft??0,right=object.patrolRight??0,walk=object.walkSpeed??0,run=object.runSpeed??0,vision=object.visionDistance??0,attack=object.attackDistance??0;if(left>right)issues.push({severity:'error',code:'CACTUS_PATROL_ORDER',message:`${object.name}: limite esquerdo maior que o direito.`,sceneId:scene.id,objectId:object.id});if(left<0||right>scene.width)issues.push({severity:'error',code:'CACTUS_PATROL_OUTSIDE',message:`${object.name}: patrulha fora da cena.`,sceneId:scene.id,objectId:object.id});if(walk>run)issues.push({severity:'error',code:'CACTUS_SPEED_ORDER',message:`${object.name}: caminhada maior que corrida.`,sceneId:scene.id,objectId:object.id});if(attack>vision)issues.push({severity:'error',code:'CACTUS_ATTACK_VISION',message:`${object.name}: ataque maior que visão.`,sceneId:scene.id,objectId:object.id});if((object.attackCooldownMs??0)<=0)issues.push({severity:'error',code:'CACTUS_COOLDOWN',message:`${object.name}: intervalo inválido.`,sceneId:scene.id,objectId:object.id});}
      if(object.type==='finish'){const mode=object.endingMode??'next-scene',target=object.targetSceneId;if(mode==='target-scene'&&!target)issues.push({severity:'error',code:'FINISH_TARGET_REQUIRED',message:`${object.name}: escolha uma cena de destino.`,sceneId:scene.id,objectId:object.id});if(mode==='target-scene'&&target&&!sceneIds.has(target))issues.push({severity:'error',code:'FINISH_TARGET_MISSING',message:`${object.name}: cena de destino inexistente.`,sceneId:scene.id,objectId:object.id});if(mode==='target-scene'&&target===scene.id)issues.push({severity:'warning',code:'FINISH_SELF_TARGET',message:`${object.name}: destino aponta para a própria cena.`,sceneId:scene.id,objectId:object.id});if(mode==='next-scene'&&ordered.at(-1)?.id===scene.id)issues.push({severity:'error',code:'LAST_SCENE_WITHOUT_ENDING',message:`${object.name}: a última cena precisa concluir o jogo ou apontar para outra cena.`,sceneId:scene.id,objectId:object.id});}
    }
  }
  if(spawnCount===0)issues.push({severity:'error',code:'MISSING_GLOBAL_SPAWN',message:'O projeto não possui spawn global do player.'});if(spawnCount>1)issues.push({severity:'error',code:'MULTIPLE_GLOBAL_SPAWNS',message:'O modelo atual aceita somente um spawn global do player.'});issues.push(...graphIssues(project));
  return{valid:!issues.some(i=>i.severity==='error'),project,issues};
}
