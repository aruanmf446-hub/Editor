import Dexie, { type EntityTable } from 'dexie';
import type { ElFuegoProject } from '../types/project';

type ProjectRecord = { id:string; name:string; updatedAt:string; data:ElFuegoProject };
type BackupRecord = { id:string; projectId:string; createdAt:string; data:ElFuegoProject };

class ElFuegoDatabase extends Dexie {
  projects!: EntityTable<ProjectRecord, 'id'>;
  backups!: EntityTable<BackupRecord, 'id'>;
  constructor() {
    super('el-fuego-studio');
    this.version(1).stores({ projects:'id, name, updatedAt', backups:'id, projectId, createdAt' });
  }
}
export const db = new ElFuegoDatabase();