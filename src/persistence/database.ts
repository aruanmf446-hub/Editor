import Dexie, { type EntityTable } from 'dexie';
import type { AssetCategory, ElFuegoProject } from '../types/project';

type ProjectRecord = { id: string; name: string; updatedAt: string; data: ElFuegoProject };
type BackupRecord = { id: string; projectId: string; createdAt: string; data: ElFuegoProject };
export type AssetRecord = {
  id: string;
  projectId: string;
  name: string;
  originalName: string;
  category: AssetCategory;
  mimeType: string;
  size: number;
  checksum: string;
  createdAt: string;
  blob: Blob;
  thumbnail?: Blob;
};

class ElFuegoDatabase extends Dexie {
  projects!: EntityTable<ProjectRecord, 'id'>;
  backups!: EntityTable<BackupRecord, 'id'>;
  assets!: EntityTable<AssetRecord, 'id'>;

  constructor() {
    super('el-fuego-studio');
    this.version(1).stores({ projects: 'id, name, updatedAt', backups: 'id, projectId, createdAt' });
    this.version(2).stores({ projects: 'id, name, updatedAt', backups: 'id, projectId, createdAt', assets: 'id, projectId, category, createdAt, checksum' });
  }
}

export const db = new ElFuegoDatabase();
