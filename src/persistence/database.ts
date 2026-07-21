import Dexie, { type EntityTable } from 'dexie';
import type { AssetCategory, CampaignProgress, ElFuegoProject } from '../types/project';

type ProjectRecord = { id: string; name: string; updatedAt: string; data: ElFuegoProject };
type BackupRecord = { id: string; projectId: string; createdAt: string; data: ElFuegoProject };
type CampaignProgressRecord = { projectId: string; updatedAt: string; data: CampaignProgress };
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
  campaignProgress!: EntityTable<CampaignProgressRecord, 'projectId'>;

  constructor() {
    super('el-fuego-studio');
    this.version(1).stores({ projects: 'id, name, updatedAt', backups: 'id, projectId, createdAt' });
    this.version(2).stores({ projects: 'id, name, updatedAt', backups: 'id, projectId, createdAt', assets: 'id, projectId, category, createdAt, checksum' });
    this.version(3).stores({ projects: 'id, name, updatedAt', backups: 'id, projectId, createdAt', assets: 'id, projectId, category, createdAt, checksum', campaignProgress: 'projectId, updatedAt' });
  }
}

export const db = new ElFuegoDatabase();
