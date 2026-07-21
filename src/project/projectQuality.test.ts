import { describe, expect, it } from 'vitest';
import { calculateFitZoom } from '../editor/calculateFitZoom';
import { exportProjectArchive, importProjectArchive } from '../persistence/projectArchive';
import { validateProject } from '../validation/validateProject';
import { createEmptyProject, createEmptyScene } from './projectFactory';
import { DEFAULT_BACKGROUND_SETTINGS, migrateProject } from './migrateProject';
import type { ElFuegoProject, ProjectScene, SceneObjectBase, SceneObjectType } from '../types/project';

const transform = { x: 20, y: 20, z: 0, width: 80, height: 120, scaleX: 1, scaleY: 1, rotation: 0 };
const makeObject = (sceneId: string, type: SceneObjectType, id = crypto.randomUUID(), patch: Partial<SceneObjectBase> = {}): SceneObjectBase => ({
  id, sceneId, type, name: type, transform: { ...transform }, visible: true, locked: false, editorOnly: false, gameOnly: false, ...patch,
});
const projectWithSpawn = (): ElFuegoProject => {
  const project = createEmptyProject('Teste');
  const scene = project.scenes[0];
  scene.objects.push(makeObject(scene.id, 'player-spawn'));
  return project;
};
const codes = (project: unknown) => validateProject(project).issues.map((issue) => issue.code);

describe('migração de projetos antigos', () => {
  it('preenche o fundo antes da validação sem corromper o arquivo', () => {
    const project = createEmptyProject('Antigo') as ElFuegoProject;
    const legacy = structuredClone(project) as unknown as { scenes: Array<Record<string, unknown>> };
    delete legacy.scenes[0].background;
    const migrated = migrateProject(legacy) as ElFuegoProject;
    expect(migrated.scenes[0].background).toEqual(DEFAULT_BACKGROUND_SETTINGS);
    expect(validateProject(legacy).issues.some((issue) => issue.code === 'SCHEMA_INVALID')).toBe(false);
  });

  it('preserva valores editoriais já existentes', () => {
    const project = createEmptyProject('Atual');
    project.scenes[0].background = { fit: 'contain', positionX: 10, positionY: 80, scale: 1.5, editorOpacity: 0.4 };
    const migrated = migrateProject(project) as ElFuegoProject;
    expect(migrated.scenes[0].background).toEqual(project.scenes[0].background);
  });
});

describe('validação editorial', () => {
  it('detecta IDs duplicados e assets ausentes', () => {
    const project = projectWithSpawn();
    const scene = project.scenes[0];
    const duplicateId = scene.objects[0].id;
    scene.objects.push(makeObject(scene.id, 'decoration', duplicateId, { assetId: 'asset-ausente' }));
    expect(codes(project)).toEqual(expect.arrayContaining(['DUPLICATE_ID', 'MISSING_ASSET']));
  });

  it('detecta todas as relações inválidas do cacto', () => {
    const project = projectWithSpawn();
    const scene = project.scenes[0];
    scene.objects.push(makeObject(scene.id, 'enemy-cactus', undefined, {
      patrolLeft: 500, patrolRight: 300, walkSpeed: 200, runSpeed: 100,
      visionDistance: 100, attackDistance: 150, attackCooldownMs: 0,
    }));
    expect(codes(project)).toEqual(expect.arrayContaining(['CACTUS_PATROL_ORDER', 'CACTUS_SPEED_ORDER', 'CACTUS_ATTACK_VISION', 'CACTUS_COOLDOWN']));
  });

  it('detecta múltiplos spawns globais', () => {
    const project = projectWithSpawn();
    project.scenes[0].objects.push(makeObject(project.scenes[0].id, 'player-spawn'));
    expect(codes(project)).toContain('MULTIPLE_GLOBAL_SPAWNS');
  });

  it('detecta destino inexistente e auto-referência', () => {
    const project = projectWithSpawn();
    const scene = project.scenes[0];
    scene.objects.push(makeObject(scene.id, 'finish', undefined, { targetSceneId: 'inexistente' }));
    expect(codes(project)).toContain('FINISH_TARGET_MISSING');
    scene.objects[1].targetSceneId = scene.id;
    expect(codes(project)).toContain('FINISH_SELF_TARGET');
  });

  it('trata ciclos entre cenas como aviso', () => {
    const project = projectWithSpawn();
    const second = createEmptyScene(1);
    project.scenes.push(second);
    project.scenes[0].objects.push(makeObject(project.scenes[0].id, 'finish', undefined, { targetSceneId: second.id }));
    second.objects.push(makeObject(second.id, 'finish', undefined, { targetSceneId: project.scenes[0].id }));
    const result = validateProject(project);
    expect(result.issues.find((issue) => issue.code === 'SCENE_TRANSITION_CYCLE')?.severity).toBe('warning');
  });
});

describe('enquadramento', () => {
  it('usa o menor eixo disponível e respeita limites', () => {
    expect(calculateFitZoom({ availableWidth: 1200, availableHeight: 700, sceneWidth: 1920, sceneHeight: 1080, padding: 0 })).toBeCloseTo(700 / 1080);
    expect(calculateFitZoom({ availableWidth: 100000, availableHeight: 100000, sceneWidth: 100, sceneHeight: 100 })).toBe(2);
    expect(calculateFitZoom({ availableWidth: 0, availableHeight: 0, sceneWidth: 1920, sceneHeight: 1080 })).toBe(0.1);
  });
});

describe('dimensão e arquivo portátil', () => {
  it('mantém fundo e objetos válidos após mudança de dimensão', () => {
    const project = projectWithSpawn();
    const scene: ProjectScene = project.scenes[0];
    scene.width = 640; scene.height = 360;
    scene.objects[0].transform = { ...scene.objects[0].transform, x: 560, y: 240, width: 80, height: 120 };
    expect(codes(project)).not.toContain('OBJECT_OUTSIDE_SCENE');
  });

  it('exporta e reimporta preservando as propriedades editoriais', async () => {
    const project = projectWithSpawn();
    project.scenes[0].background = { fit: 'original', positionX: 25, positionY: 75, scale: 1.25, editorOpacity: 0.55 };
    const archive = await exportProjectArchive(project);
    const restored = await importProjectArchive(archive);
    expect(restored.scenes[0].background).toEqual(project.scenes[0].background);
    expect(restored.scenes[0].objects).toHaveLength(1);
  });
});
