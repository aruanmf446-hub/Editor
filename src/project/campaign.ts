import type { CampaignDefinition, CampaignLevel, ElFuegoProject, ProjectScene, SceneObjectBase } from '../types/project';
import { createEmptyScene } from './projectFactory';

export const EL_FUEGO_LEVEL_COUNT = 10;

export function campaignLevels(campaign?: CampaignDefinition): CampaignLevel[] {
  return campaign?.chapters.flatMap((chapter) => chapter.levels) ?? [];
}

const transform = (x: number, y: number, width: number, height: number) => ({ x, y, z: 0, width, height, scaleX: 1, scaleY: 1, rotation: 0 });
const base = (sceneId: string, id: string, type: SceneObjectBase['type'], name: string, x: number, y: number, width: number, height: number): SceneObjectBase => ({ id, sceneId, type, name, transform: transform(x, y, width, height), visible: true, locked: false, editorOnly: false, gameOnly: false });

function buildPlayableScene(scene: ProjectScene, index: number): ProjectScene {
  if (scene.objects.length) return scene;
  const number = index + 1;
  const objects: SceneObjectBase[] = [];
  const spawn = base(scene.id, `${scene.id}-spawn`, 'player-spawn', 'Entrada principal', 80, 780, 72, 120);
  Object.assign(spawn, { entryId: 'entrada-principal', defaultEntry: true, direction: 'right', initialHealth: 3, initialAttack: 1, initialDefense: 0 });
  objects.push(spawn);
  const floor = base(scene.id, `${scene.id}-floor`, 'platform', 'Chão da fase', 0, 900, scene.width, 180);
  Object.assign(floor, { collisionType: 'solid', passThrough: false, visibleInGame: true });
  objects.push(floor);
  for (let platformIndex = 0; platformIndex < 3 + Math.min(3, Math.floor(index / 2)); platformIndex += 1) {
    const x = 330 + platformIndex * 260;
    const y = 790 - (platformIndex % 2) * 120 - Math.min(index * 8, 80);
    const platform = base(scene.id, `${scene.id}-platform-${platformIndex + 1}`, 'platform', `Plataforma ${platformIndex + 1}`, x, y, 190, 28);
    Object.assign(platform, { collisionType: 'one-way', passThrough: true, visibleInGame: true });
    objects.push(platform);
  }
  const checkpoint = base(scene.id, `${scene.id}-checkpoint`, 'checkpoint', 'Checkpoint', 920, 780, 48, 120);
  Object.assign(checkpoint, { checkpointOrder: 1, respawnHealth: 3 });
  objects.push(checkpoint);
  const enemyCount = Math.min(5, 1 + Math.floor(index / 2));
  for (let enemyIndex = 0; enemyIndex < enemyCount; enemyIndex += 1) {
    const x = 560 + enemyIndex * 230;
    const enemy = base(scene.id, `${scene.id}-cactus-${enemyIndex + 1}`, 'enemy-cactus', `Cacto ${enemyIndex + 1}`, x, 800, 80, 100);
    Object.assign(enemy, { direction: enemyIndex % 2 ? 'left' : 'right', patrolLeft: Math.max(0, x - 140), patrolRight: Math.min(scene.width, x + 140), visionDistance: 280 + index * 20, walkSpeed: 55 + index * 3, runSpeed: 120 + index * 5, attackDistance: 75, damage: 1, attackCooldownMs: Math.max(650, 1200 - index * 45), enemyHealth: 1 + Math.floor(index / 3), requiredForCompletion: index >= 6 });
    objects.push(enemy);
  }
  for (let collectibleIndex = 0; collectibleIndex < 3; collectibleIndex += 1) {
    const collectible = base(scene.id, `${scene.id}-collectible-${collectibleIndex + 1}`, 'collectible', `Brasa ${collectibleIndex + 1}`, 430 + collectibleIndex * 370, 700 - (collectibleIndex % 2) * 100, 42, 42);
    collectible.collectible = { id: `brasa-fase-${number}`, kind: 'coin', displayName: 'Brasa do deserto', value: 1, required: collectibleIndex === 2, collectOnce: true, respawnable: false, actions: [] };
    objects.push(collectible);
  }
  const dialogue = base(scene.id, `${scene.id}-dialogue`, 'dialogue-zone', 'História da fase', 170, 720, 170, 180);
  Object.assign(dialogue, { dialogueOnce: true, dialogueBlockPlayer: true, dialogueAdvanceMode: 'manual', dialogueLines: [{ id: `${scene.id}-line-1`, speaker: 'El Fuego', text: number === 1 ? 'A cidade está silenciosa. Preciso encontrar a origem desta fumaça.' : `A trilha continua. Esta é a fase ${number}.`, durationMs: 2500 }] });
  objects.push(dialogue);
  if (number === 10) {
    const boss = base(scene.id, `${scene.id}-malagueta`, 'boss', 'Malagueta', 1450, 720, 130, 180);
    Object.assign(boss, { direction: 'left', bossHealth: 20, bossPhaseCount: 3, visionDistance: 900, runSpeed: 145, attackDistance: 145, damage: 2, attackCooldownMs: 1100, requiredForCompletion: true, bossAttacks: [{ id: 'golpe-frontal', name: 'Golpe frontal', damage: 2, reach: 145, durationMs: 700, activeStartMs: 250, activeEndMs: 430, cooldownMs: 1400 }, { id: 'investida', name: 'Investida', damage: 3, reach: 220, durationMs: 950, activeStartMs: 300, activeEndMs: 720, cooldownMs: 2200, minimumPhase: 2, dashSpeed: 260 }], bossPhases: [{ id: 'fase-1', name: 'Confronto', healthThreshold: 1, speedMultiplier: 1, damageMultiplier: 1, cooldownMultiplier: 1, enabledAttackIds: ['golpe-frontal'], transitionDurationMs: 500 }, { id: 'fase-2', name: 'Fúria', healthThreshold: .6, speedMultiplier: 1.2, damageMultiplier: 1.2, cooldownMultiplier: .85, enabledAttackIds: ['golpe-frontal', 'investida'], transitionDurationMs: 700 }, { id: 'fase-3', name: 'Última chama', healthThreshold: .25, speedMultiplier: 1.4, damageMultiplier: 1.4, cooldownMultiplier: .7, enabledAttackIds: ['golpe-frontal', 'investida'], transitionDurationMs: 900 }] });
    objects.push(boss);
  }
  const finish = base(scene.id, `${scene.id}-finish`, number === 10 ? 'finish' : 'finish', number === 10 ? 'Fim da campanha' : 'Saída da fase', 1810, 740, 80, 160);
  Object.assign(finish, { endingMode: number === 10 ? 'complete-game' : 'next-scene', completionLogic: 'all', completionConditions: number === 10 ? [{ id: `${scene.id}-boss-condition`, type: 'boss-defeated', targetObjectId: `${scene.id}-malagueta` }] : [{ id: `${scene.id}-collect-condition`, type: 'collectible-count', collectibleId: `brasa-fase-${number}`, minimum: 3 }, ...(index >= 6 ? [{ id: `${scene.id}-enemy-condition`, type: 'required-enemies-defeated' as const }] : [])] });
  objects.push(finish);
  return { ...scene, name: number === 10 ? 'Fase 10 — Malagueta' : `Fase ${String(number).padStart(2, '0')}`, objects };
}

export function createTenLevelCampaign(project: ElFuegoProject): ElFuegoProject {
  const scenes = [...project.scenes];
  while (scenes.length < EL_FUEGO_LEVEL_COUNT) {
    const scene = createEmptyScene(scenes.length);
    scene.name = `Fase ${String(scenes.length + 1).padStart(2, '0')}`;
    scenes.push(scene);
  }
  const playableScenes = scenes.map((scene, index) => index < EL_FUEGO_LEVEL_COUNT ? buildPlayableScene(scene, index) : scene);
  const previousLevels = campaignLevels(project.campaign);
  const levels: CampaignLevel[] = playableScenes.slice(0, EL_FUEGO_LEVEL_COUNT).map((scene, index) => ({
    id: previousLevels[index]?.id ?? `fase-${String(index + 1).padStart(2, '0')}`,
    name: previousLevels[index]?.name ?? scene.name,
    initialSceneId: previousLevels[index]?.initialSceneId && playableScenes.some((candidate) => candidate.id === previousLevels[index].initialSceneId) ? previousLevels[index].initialSceneId : scene.id,
    unlockAfterLevelId: index === 0 ? null : previousLevels[index]?.unlockAfterLevelId ?? (previousLevels[index - 1]?.id ?? `fase-${String(index).padStart(2, '0')}`),
  }));
  return { ...project, scenes: playableScenes.map((scene, order) => ({ ...scene, order })), campaign: { chapters: [{ id: project.campaign?.chapters[0]?.id ?? 'cidade-desertica', name: project.campaign?.chapters[0]?.name ?? 'Cidade desértica', levels }] } };
}
