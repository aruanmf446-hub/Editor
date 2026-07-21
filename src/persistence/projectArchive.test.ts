import 'fake-indexeddb/auto';
import JSZip from 'jszip';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  EL_FUEGO_PROJECT_FORMAT,
  EL_FUEGO_PROJECT_VERSION,
  type ElFuegoProject,
  type ProjectAsset,
  type SceneObjectBase,
} from '../types/project';
import { saveAsset } from './assetRepository';
import { db } from './database';
import { exportProjectArchive, importProjectArchive } from './projectArchive';

function spawn(): SceneObjectBase {
  return {
    id: 'spawn',
    sceneId: 'scene',
    type: 'player-spawn',
    name: 'Player',
    transform: { x: 20, y: 200, z: 0, width: 50, height: 100, scaleX: 1, scaleY: 1, rotation: 0 },
    visible: true,
    locked: false,
    editorOnly: false,
    gameOnly: false,
    direction: 'right',
    initialHealth: 3,
    initialAttack: 1,
    initialDefense: 1,
  };
}

function project(assets: ProjectAsset[] = []): ElFuegoProject {
  return {
    format: EL_FUEGO_PROJECT_FORMAT,
    version: EL_FUEGO_PROJECT_VERSION,
    project: { id: 'project', name: 'Projeto seguro', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    settings: { gravity: 2200, gridSize: 16, snapEnabled: true, defaultSceneWidth: 960, defaultSceneHeight: 540 },
    assets,
    scenes: [{
      id: 'scene',
      name: 'Cena 1',
      order: 0,
      width: 960,
      height: 540,
      backgroundAssetId: null,
      background: { fit: 'cover', positionX: 50, positionY: 50, scale: 1, editorOpacity: 1 },
      objects: [spawn()],
    }],
  };
}

async function sha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function pngFixture() {
  const blob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: 'image/png' });
  const checksum = await sha256(blob);
  const metadata: ProjectAsset = {
    id: 'background',
    name: 'Cenário',
    originalName: 'cenario.png',
    mimeType: 'image/png',
    size: blob.size,
    checksum,
    category: 'background',
  };
  return { blob, checksum, metadata };
}

beforeEach(async () => {
  db.close();
  await db.delete();
  await db.open();
});

afterAll(async () => {
  db.close();
  await db.delete();
});

describe('projectArchive', () => {
  it('exporta e importa projeto sem assets preservando os dados', async () => {
    const source = project();
    const archive = await exportProjectArchive(source);
    const imported = await importProjectArchive(archive);

    expect(imported).toEqual(source);
    expect(await db.projects.get(source.project.id)).toEqual(expect.objectContaining({ data: source }));
    expect(await db.assets.where('projectId').equals(source.project.id).count()).toBe(0);
  });

  it('faz roundtrip de asset com tamanho assinatura e checksum válidos', async () => {
    const { blob, checksum, metadata } = await pngFixture();
    const source = project([metadata]);
    await saveAsset({
      ...metadata,
      projectId: source.project.id,
      checksum,
      createdAt: '2026-01-01T00:00:00.000Z',
      blob,
    });

    const archive = await exportProjectArchive(source);
    await db.assets.clear();
    const imported = await importProjectArchive(archive);
    const restored = await db.assets.get(metadata.id);

    expect(imported.assets).toEqual([metadata]);
    expect(restored?.checksum).toBe(checksum);
    expect(restored?.blob.size).toBe(blob.size);
    expect(new Uint8Array(await restored!.blob.arrayBuffer())).toEqual(new Uint8Array(await blob.arrayBuffer()));
  });

  it('recusa checksum adulterado antes de gravar o projeto', async () => {
    const { blob, checksum, metadata } = await pngFixture();
    const source = project([metadata]);
    await saveAsset({ ...metadata, projectId: source.project.id, checksum, createdAt: '', blob });
    const validArchive = await exportProjectArchive(source);
    const zip = await JSZip.loadAsync(validArchive);
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string')) as { assets: Array<{ checksum: string }> };
    manifest.assets[0].checksum = '0'.repeat(64);
    zip.file('manifest.json', JSON.stringify(manifest));
    const tampered = await zip.generateAsync({ type: 'blob' });
    await db.projects.clear();

    await expect(importProjectArchive(tampered)).rejects.toThrow('Checksum divergente');
    expect(await db.projects.count()).toBe(0);
  });

  it('recusa caminho de asset diferente do formato canônico', async () => {
    const { blob, checksum, metadata } = await pngFixture();
    const source = project([metadata]);
    await saveAsset({ ...metadata, projectId: source.project.id, checksum, createdAt: '', blob });
    const validArchive = await exportProjectArchive(source);
    const zip = await JSZip.loadAsync(validArchive);
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string')) as { assets: Array<{ path: string }> };
    const originalPath = manifest.assets[0].path;
    const binary = await zip.file(originalPath)!.async('uint8array');
    manifest.assets[0].path = 'assets/outro/cenario.png';
    zip.file(manifest.assets[0].path, binary);
    zip.remove(originalPath);
    zip.file('manifest.json', JSON.stringify(manifest));

    await expect(importProjectArchive(await zip.generateAsync({ type: 'blob' }))).rejects.toThrow('Caminho não canônico');
  });

  it('recusa entradas extras no pacote', async () => {
    const zip = await JSZip.loadAsync(await exportProjectArchive(project()));
    zip.file('executavel.txt', 'não permitido');
    await expect(importProjectArchive(await zip.generateAsync({ type: 'blob' }))).rejects.toThrow('Arquivo inesperado');
  });

  it('remove assets antigos do mesmo projeto durante uma importação exata', async () => {
    await db.assets.put({
      id: 'stale',
      projectId: 'project',
      name: 'Antigo',
      originalName: 'antigo.bin',
      category: 'other',
      mimeType: 'application/octet-stream',
      size: 1,
      checksum: '0'.repeat(64),
      createdAt: '',
      blob: new Blob([new Uint8Array([1])]),
    });

    await importProjectArchive(await exportProjectArchive(project()));

    expect(await db.assets.get('stale')).toBeUndefined();
  });

  it('recusa exportação quando os metadados não correspondem ao binário armazenado', async () => {
    const { blob, checksum, metadata } = await pngFixture();
    const source = project([{ ...metadata, size: blob.size + 1 }]);
    await saveAsset({ ...metadata, projectId: source.project.id, checksum, createdAt: '', blob });

    await expect(exportProjectArchive(source)).rejects.toThrow('Tamanho armazenado divergente');
  });
});
