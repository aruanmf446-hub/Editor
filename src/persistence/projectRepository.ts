import { db } from './database';
import { validateProject } from '../validation/validateProject';
import type { ElFuegoProject } from '../types/project';

export async function saveProject(project: ElFuegoProject): Promise<void> {
  const validation = validateProject(project);
  if (!validation.valid || !validation.project) throw new Error('Projeto inválido e não pode ser salvo.');
  validation.project.project.updatedAt = new Date().toISOString();
  await db.projects.put({id:validation.project.project.id,name:validation.project.project.name,updatedAt:validation.project.project.updatedAt,data:validation.project});
}
export async function loadProject(id:string):Promise<ElFuegoProject|undefined>{ return (await db.projects.get(id))?.data; }
export async function listProjects():Promise<ElFuegoProject[]>{ return (await db.projects.orderBy('updatedAt').reverse().toArray()).map((record)=>record.data); }
export async function deleteProject(id:string):Promise<void>{ await db.transaction('rw',db.projects,db.backups,async()=>{await db.projects.delete(id);await db.backups.where('projectId').equals(id).delete();}); }