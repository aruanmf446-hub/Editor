import { create } from 'zustand';
import { deleteAsset, listAssets, renameAsset, saveAsset } from '../persistence/assetRepository';
import type { AssetRecord } from '../persistence/database';
import type { AssetCategory, ProjectAsset } from '../types/project';
import { useEditorStore } from './editorStore';

function classify(file: File): AssetCategory {
  const name = file.name.toLowerCase();
  if (name.endsWith('.glb') || name.endsWith('.gltf')) return 'model';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('image/')) return name.includes('scene') || name.includes('background') || name.includes('cenario') ? 'background' : 'texture';
  return 'other';
}

async function checksum(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
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
  assets: [],
  loading: false,
  load: async (projectId) => {
    set({ loading: true });
    set({ assets: await listAssets(projectId), loading: false });
  },
  importFiles: async (files) => {
    const editor = useEditorStore.getState();
    const projectId = editor.project.project.id;
    for (const file of Array.from(files)) {
      const hash = await checksum(file);
      if (get().assets.some((asset) => asset.checksum === hash)) continue;
      const record: AssetRecord = {
        id: crypto.randomUUID(), projectId, name: file.name.replace(/\.[^.]+$/, ''), originalName: file.name,
        category: classify(file), mimeType: file.type || 'application/octet-stream', size: file.size,
        checksum: hash, createdAt: new Date().toISOString(), blob: file,
      };
      await saveAsset(record);
      const metadata: ProjectAsset = { id: record.id, name: record.name, originalName: record.originalName, mimeType: record.mimeType, size: record.size, checksum: record.checksum, category: record.category };
      editor.registerAsset(metadata);
    }
    await get().load(projectId);
  },
  remove: async (id) => {
    await deleteAsset(id);
    useEditorStore.getState().unregisterAsset(id);
    set((state) => ({ assets: state.assets.filter((asset) => asset.id !== id) }));
  },
  rename: async (id, name) => {
    await renameAsset(id, name);
    useEditorStore.getState().renameAssetMetadata(id, name);
    set((state) => ({ assets: state.assets.map((asset) => asset.id === id ? { ...asset, name } : asset) }));
  },
}));
