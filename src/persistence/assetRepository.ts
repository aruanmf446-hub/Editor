import { db, type AssetRecord } from './database';

export async function saveAsset(record: AssetRecord): Promise<void> {
  await db.assets.put(record);
}

export async function listAssets(projectId: string): Promise<AssetRecord[]> {
  return db.assets.where('projectId').equals(projectId).sortBy('createdAt');
}

export async function getAsset(id: string): Promise<AssetRecord | undefined> {
  return db.assets.get(id);
}

export async function deleteAsset(id: string): Promise<void> {
  await db.assets.delete(id);
}

export async function renameAsset(id: string, name: string): Promise<void> {
  await db.assets.update(id, { name });
}
