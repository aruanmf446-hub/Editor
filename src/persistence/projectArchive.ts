import JSZip from 'jszip';
import { validateProject } from '../validation/validateProject';
import type { ElFuegoProject } from '../types/project';

export async function exportProjectArchive(project:ElFuegoProject):Promise<Blob>{
  const validation=validateProject(project);
  if(!validation.valid||!validation.project) throw new Error('Projeto inválido.');
  const zip=new JSZip();
  zip.file('manifest.json',JSON.stringify({format:project.format,version:project.version,exportedAt:new Date().toISOString()},null,2));
  zip.file('project.json',JSON.stringify(validation.project,null,2));
  return zip.generateAsync({type:'blob',compression:'DEFLATE'});
}
export async function importProjectArchive(file:Blob):Promise<ElFuegoProject>{
  const zip=await JSZip.loadAsync(file);
  const projectFile=zip.file('project.json');
  if(!projectFile) throw new Error('Arquivo project.json ausente.');
  const input=JSON.parse(await projectFile.async('string')) as unknown;
  const validation=validateProject(input);
  if(!validation.valid||!validation.project) throw new Error('Projeto importado inválido.');
  return validation.project;
}