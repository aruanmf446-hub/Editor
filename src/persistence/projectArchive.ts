import JSZip from 'jszip';
import { validateProject } from '../validation/validateProject';
import type { ElFuegoProject } from '../types/project';
import { getAsset, saveAsset } from './assetRepository';

export async function exportProjectArchive(project: ElFuegoProject): Promise<Blob> {
  const validation = validateProject(project);
  if (!validation.valid || !validation.project) throw new Error('Projeto inválido.');
  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify({ format: project.format, version: project.version, exportedAt: new Date().toISOString(), assets: project.assets.map((asset) => ({ id: asset.id, path: `assets/${asset.id}/${asset.originalName}` })) }, null, 2));
  zip.file('project.json', JSON.stringify(validation.project, null, 2));
  for (const metadata of project.assets) {
    const asset = await getAsset(metadata.id);
    if (asset) zip.file(`assets/${metadata.id}/${metadata.originalName}`, asset.blob);
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

export async function importProjectArchive(file: Blob): Promise<ElFuegoProject> {
  const zip = await JSZip.loadAsync(file);
  const projectFile = zip.file('project.json');
  if (!projectFile) throw new Error('Arquivo project.json ausente.');
  const input = JSON.parse(await projectFile.async('string')) as unknown;
  const validation = validateProject(input);
  if (!validation.valid || !validation.project) throw new Error('Projeto importado inválido.');
  const project = validation.project;
  for (const metadata of project.assets) {
    const entry = zip.file(`assets/${metadata.id}/${metadata.originalName}`);
    if (!entry) continue;
    const blob = await entry.async('blob');
    await saveAsset({ id: metadata.id, projectId: project.project.id, name: metadata.name, originalName: metadata.originalName, category: metadata.category, mimeType: metadata.mimeType, size: metadata.size, checksum: metadata.checksum ?? '', createdAt: new Date().toISOString(), blob });
  }
  return project;
}
