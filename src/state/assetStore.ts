import { create } from 'zustand';
import { deleteAsset, listAssets, renameAsset, saveAsset } from '../persistence/assetRepository';
import type { AssetRecord } from '../persistence/database';
import type { AssetCategory, ProjectAsset } from '../types/project';
import { useEditorStore } from './editorStore';

function classifyName(name: string, mimeType = ''): AssetCategory {
  const normalized = name.trim().toLowerCase().split(/[?#]/)[0];
  if (/\.(glb|gltf|fbx|obj)$/.test(normalized)) return 'model';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('image/')) return normalized.includes('scene') || normalized.includes('background') || normalized.includes('cenario') ? 'background' : 'texture';
  return 'other';
}

function classify(file: File): AssetCategory {
  return classifyName(file.name, file.type);
}

function normalizeAssetCategory(asset: AssetRecord): AssetRecord {
  const expected = classifyName(asset.originalName || asset.name, asset.mimeType);
  return expected === asset.category ? asset : { ...asset, category: expected };
}

async function checksum(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function toProjectAsset(record: AssetRecord): ProjectAsset {
  return {
    id: record.id,
    name: record.name,
    originalName: record.originalName,
    mimeType: record.mimeType,
    size: record.size,
    checksum: record.checksum,
    category: record.category,
  };
}

function replaceProjectAssets(assets: ProjectAsset[]) {
  const editor = useEditorStore.getState();
  editor.setProject({ ...editor.project, assets, project: { ...editor.project.project, updatedAt: new Date().toISOString() } }, 'Alterações não salvas');
}

type AssetState = {
  assets: AssetRecord[];
  loading: boolean;
  load: (projectId: string) => Promise<void>;
  importFiles: (files: FileList | File[]) => Promise<void>;
  remove: (id: string) => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
};

export const useAssetStore = create<AssetState>((set, get) => ({
  assets: [], loading: false,
  load: async (projectId) => {
    set({ loading: true });
    const stored = await listAssets(projectId);
    const normalized = stored.map(normalizeAssetCategory);
    const changed = normalized.filter((asset, index) => asset.category !== stored[index].category);
    await Promise.all(changed.map((asset) => saveAsset(asset)));
    if (changed.length) replaceProjectAssets(normalized.map(toProjectAsset));
    set({ assets: normalized, loading: false });
  },
  importFiles: async (files) => {
    const editor = useEditorStore.getState();
    const projectId = editor.project.project.id;
    const current = get().assets.map(normalizeAssetCategory);
    const records = [...current];
    for (const file of Array.from(files)) {
      const hash = await checksum(file);
      const duplicateIndex = records.findIndex((asset) => asset.checksum === hash);
      if (duplicateIndex >= 0) {
        const existing = normalizeAssetCategory(records[duplicateIndex]);
        records[duplicateIndex] = existing;
        await saveAsset(existing);
        continue;
      }
      const record: AssetRecord = {
        id: crypto.randomUUID(),
        projectId,
        name: file.name.replace(/\.[^.]+$/, ''),
        originalName: file.name,
        category: classify(file),
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        checksum: hash,
        createdAt: new Date().toISOString(),
        blob: file,
      };
      await saveAsset(record);
      records.push(record);
    }
    replaceProjectAssets(records.map(toProjectAsset));
    set({ assets: records });
  },
  remove: async (id) => {
    await deleteAsset(id);
    const editor = useEditorStore.getState();
    replaceProjectAssets(editor.project.assets.filter((asset) => asset.id !== id));
    set((state) => ({ assets: state.assets.filter((asset) => asset.id !== id) }));
  },
  rename: async (id, name) => {
    await renameAsset(id, name);
    const editor = useEditorStore.getState();
    replaceProjectAssets(editor.project.assets.map((asset) => asset.id === id ? { ...asset, name } : asset));
    set((state) => ({ assets: state.assets.map((asset) => asset.id === id ? { ...asset, name } : asset) }));
  },
}));