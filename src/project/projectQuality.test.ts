import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { calculateFitZoom } from '../editor/calculateFitZoom';
import { exportProjectArchive, importProjectArchive } from '../persistence/projectArchive';
import type { ElFuegoProject, ProjectScene, SceneObjectBase, SceneObjectType } from '../types/project';
import { validateProject } from '../validation/validateProject';
import { createEmptyProject, createEmptyScene } from './projectFactory';
import { DEFAULT_BACKGROUND_SETTINGS, migrateProject } from './migrateProject';

const transform = { x: 20, y: 20, z: 0, width: 80, height: 120, scaleX: 1, scaleY: 1, rotation: 0 };
const makeObject = (sceneId: string, type: SceneObjectType, id: string = crypto.randomUUID(), patch: Partial<SceneObjectBase> = {}): SceneObjectBase => ({
  id, sceneId, type, name: type, transform: { ...transform }, visible: true, locked: false, editorOnly: false, gameOnly: false, ...patch,
});
const projectWithSpawn = (): ElFuegoProject => {
  const project = createEmptyProject('Teste');
  const scene = project.scenes[0];
  scene.objects.push(makeObject(scene.id, 'player-spawn', undefined, { entryId: 'principal', defaultEntry: true }));
  return project;
};
const codes = (project: unknown) => validateProject(project).issues.map((issue) => issue.code);

describe('migração de projetos antigos', () => {
  it('preenche o fundo antes da validação sem corromper o arquivo', () => {const project=createEmptyProject('Antigo') as ElFuegoProject;const legacy=structuredClone(project) as unknown as {scenes:Array<Record<string,unknown>>};delete legacy.scenes[0].background;const migrated=migrateProject(legacy) as ElFuegoProject;expect(migrated.scenes[0].background).toEqual(DEFAULT_BACKGROUND_SETTINGS);expect(validateProject(legacy).issues.some(issue=>issue.code==='SCHEMA_INVALID')).toBe(false);});
  it('é idempotente e não compartilha referências', () => {const original=createEmptyProject('Idempotente');original.scenes[0].objects.push(makeObject(original.scenes[0].id,'finish'));const once=migrateProject(original) as ElFuegoProject;const twice=migrateProject(once) as ElFuegoProject;expect(twice).toEqual(once);expect(once).not.toBe(original);expect(once.scenes).not.toBe(original.scenes);expect(once.scenes[0]).not.toBe(original.scenes[0]);expect(once.scenes[0].objects).not.toBe(original.scenes[0].objects);expect(once.scenes[0].objects[0].endingMode).toBe('next-scene');});
  it('preserva valores editoriais já existentes', () => {const project=createEmptyProject('Atual');project.scenes[0].background={fit:'contain',positionX:10,positionY:80,scale:1.5,editorOpacity:.4};const migrated=migrateProject(project) as ElFuegoProject;expect(migrated.scenes[0].background).toEqual(project.scenes[0].background);});
});

describe('validação editorial', () => {
  it('detecta IDs duplicados e assets ausentes', () => {const project=projectWithSpawn(),scene=project.scenes[0],duplicateId=scene.objects[0].id;scene.objects.push(makeObject(scene.id,'decoration',duplicateId,{assetId:'asset-ausente'}));expect(codes(project)).toEqual(expect.arrayContaining(['DUPLICATE_ID','MISSING_ASSET']));});
  it('detecta todas as relações inválidas do cacto', () => {const project=projectWithSpawn(),scene=project.scenes[0];scene.objects.push(makeObject(scene.id,'enemy-cactus',undefined,{patrolLeft:500,patrolRight:300,walkSpeed:200,runSpeed:100,visionDistance:100,attackDistance:150,attackCooldownMs:0}));expect(codes(project)).toEqual(expect.arrayContaining(['CACTUS_PATROL_ORDER','CACTUS_SPEED_ORDER','CACTUS_ATTACK_VISION','CACTUS_COOLDOWN']));});
  it('aceita múltiplas entradas e detecta identificadores duplicados', () => {const project=projectWithSpawn();const scene=project.scenes[0];scene.objects.push(makeObject(scene.id,'player-spawn',undefined,{entryId:'secundaria'}));expect(codes(project)).not.toContain('MULTIPLE_GLOBAL_SPAWNS');scene.objects[1].entryId='principal';expect(codes(project)).toContain('DUPLICATE_ENTRY_ID');});
  it('valida os modos explícitos de encerramento', () => {const project=projectWithSpawn(),scene=project.scenes[0];scene.objects.push(makeObject(scene.id,'finish',undefined,{endingMode:'next-scene'}));expect(codes(project)).toContain('LAST_SCENE_WITHOUT_ENDING');scene.objects[1].endingMode='complete-game';expect(codes(project)).not.toContain('LAST_SCENE_WITHOUT_ENDING');scene.objects[1].endingMode='target-scene';scene.objects[1].targetSceneId=undefined;expect(codes(project)).toContain('FINISH_TARGET_REQUIRED');});
  it('detecta ciclo em componente desconectado', () => {const project=projectWithSpawn();project.scenes[0].objects.push(makeObject(project.scenes[0].id,'finish',undefined,{endingMode:'complete-game'}));const third=createEmptyScene(2),fourth=createEmptyScene(3);project.scenes.push(third,fourth);third.objects.push(makeObject(third.id,'finish',undefined,{endingMode:'target-scene',targetSceneId:fourth.id}));fourth.objects.push(makeObject(fourth.id,'finish',undefined,{endingMode:'target-scene',targetSceneId:third.id}));const result=validateProject(project);expect(result.issues.some(issue=>issue.code==='SCENE_TRANSITION_CYCLE')).toBe(true);expect(result.issues.some(issue=>issue.code==='UNREACHABLE_SCENE'&&issue.sceneId===third.id)).toBe(true);expect(result.issues.some(issue=>issue.code==='SCENE_CYCLE_WITHOUT_EXIT')).toBe(true);});
});

describe('enquadramento', () => {
  it('usa o menor eixo disponível e respeita limites', () => {expect(calculateFitZoom({availableWidth:1200,availableHeight:700,sceneWidth:1920,sceneHeight:1080,padding:0})).toBeCloseTo(Math.min(1200/1920,700/1080));expect(calculateFitZoom({availableWidth:100000,availableHeight:100000,sceneWidth:100,sceneHeight:100})).toBe(2);});
  it('retorna zoom seguro para dimensões inválidas', () => {for(const value of [0,-1,Number.NaN,Number.POSITIVE_INFINITY])expect(calculateFitZoom({availableWidth:value,availableHeight:700,sceneWidth:1920,sceneHeight:1080})).toBe(1);expect(calculateFitZoom({availableWidth:20,availableHeight:20,sceneWidth:1920,sceneHeight:1080,padding:1000})).toBeGreaterThan(0);});
});

describe('dimensão e arquivo portátil', () => {
  it('mantém fundo e objetos válidos após mudança de dimensão', () => {const project=projectWithSpawn();const scene:ProjectScene=project.scenes[0];scene.width=640;scene.height=360;scene.objects[0].transform={...scene.objects[0].transform,x:560,y:240,width:80,height:120};expect(codes(project)).not.toContain('OBJECT_OUTSIDE_SCENE');});
  it('exporta e reimporta preservando as propriedades editoriais', async () => {const project=projectWithSpawn();project.scenes[0].background={fit:'original',positionX:25,positionY:75,scale:1.25,editorOpacity:.55};const archive=await exportProjectArchive(project);const restored=await importProjectArchive(archive);expect(restored.scenes[0].background).toEqual(project.scenes[0].background);expect(restored.scenes[0].objects).toHaveLength(1);});
});
