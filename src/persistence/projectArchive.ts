import JSZip from 'jszip';
import { validateProject } from '../validation/validateProject';
import type { ElFuegoProject, ProjectAsset } from '../types/project';
import { getAsset } from './assetRepository';
import { db, type AssetRecord } from './database';

const MAX_ASSET_BYTES = 50 * 1024 * 1024;
const MAX_PROJECT_BYTES = 250 * 1024 * 1024;
const MAX_ASSETS = 500;
const MAX_SCENES = 100;
const MAX_OBJECTS = 10_000;
const MAX_ZIP_ENTRIES = 1_005;
const MAX_NAME_LENGTH = 180;
const MAX_JSON_DEPTH = 40;
const SAFE_MIME: Record<ProjectAsset['category'], RegExp> = {
  background: /^image\//,
  model: /^(model\/gltf-binary|application\/octet-stream)$/,
  texture: /^image\//,
  audio: /^audio\//,
  thumbnail: /^image\//,
  other: /^[\w.+-]+\/[\w.+-]+$/,
};

type ManifestAsset = {
  id: string;
  path: string;
  mimeType: string;
  size: number;
  checksumAlgorithm: 'sha256';
  checksum: string;
};
type Manifest = {
  format: string;
  version: number;
  checksumAlgorithm: 'sha256';
  assets: ManifestAsset[];
};

function safePath(path: string): boolean {
  return path.length > 0
    && !path.startsWith('/')
    && !path.includes('\\')
    && !path.split('/').some((part) => part === '..' || part === '.' || part === '');
}

function canonicalAssetPath(metadata: ProjectAsset): string {
  return `assets/${metadata.id}/${metadata.originalName}`;
}

async function sha256(blob: Blob): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function jsonDepth(value: unknown, depth = 0): number {
  if (depth > MAX_JSON_DEPTH) return depth;
  if (!value || typeof value !== 'object') return depth;
  return Math.max(depth, ...Object.values(value as Record<string, unknown>).map((item) => jsonDepth(item, depth + 1)));
}

function extension(name: string): string {
  return name.toLowerCase().split('.').pop() ?? '';
}

async function hasExpectedSignature(blob: Blob, metadata: ProjectAsset): Promise<boolean> {
  const bytes = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const ext = extension(metadata.originalName);
  if (ext === 'png') return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (ext === 'jpg' || ext === 'jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (ext === 'webp') return String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (ext === 'glb') return String.fromCharCode(...bytes.slice(0, 4)) === 'glTF';
  return true;
}

function enforceUniqueAssetIds(project: ElFuegoProject): void {
  const ids = new Set<string>();
  for (const asset of project.assets) {
    if (ids.has(asset.id)) throw new Error(`Asset ID duplicado no projeto: ${asset.id}.`);
    ids.add(asset.id);
  }
}

function enforceProjectLimits(project: ElFuegoProject): void {
  if (project.assets.length > MAX_ASSETS) throw new Error('Quantidade máxima de assets excedida.');
  if (project.scenes.length > MAX_SCENES) throw new Error('Quantidade máxima de cenas excedida.');
  const objectCount = project.scenes.reduce((sum, scene) => sum + scene.objects.length, 0);
  if (objectCount > MAX_OBJECTS) throw new Error('Quantidade máxima de objetos excedida.');
  const names = [
    project.project.name,
    ...project.assets.flatMap((asset) => [asset.name, asset.originalName]),
    ...project.scenes.flatMap((scene) => [scene.name, ...scene.objects.map((object) => object.name)]),
  ];
  if (names.some((name) => name.length > MAX_NAME_LENGTH)) throw new Error('Um nome excede o comprimento máximo permitido.');
  if (jsonDepth(project) > MAX_JSON_DEPTH) throw new Error('Estrutura JSON profunda demais.');
  enforceUniqueAssetIds(project);
}

function parseJson(text: string, label: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${label} contém JSON inválido.`);
  }
}

function parseManifest(raw: unknown): Manifest {
  if (!raw || typeof raw !== 'object') throw new Error('Manifesto inválido.');
  const candidate = raw as Partial<Manifest>;
  if (
    typeof candidate.format !== 'string'
    || !Number.isInteger(candidate.version)
    || candidate.checksumAlgorithm !== 'sha256'
    || !Array.isArray(candidate.assets)
  ) {
    throw new Error('Manifesto incompatível.');
  }
  return candidate as Manifest;
}

async function validateStoredAsset(metadata: ProjectAsset, blob: Blob): Promise<string> {
  if (blob.size !== metadata.size) throw new Error(`Tamanho armazenado divergente para ${metadata.name}.`);
  if (blob.size > MAX_ASSET_BYTES) throw new Error(`Asset excede o tamanho máximo: ${metadata.name}.`);
  if (!SAFE_MIME[metadata.category].test(metadata.mimeType)) throw new Error(`MIME incompatível para ${metadata.name}.`);
  if (!(await hasExpectedSignature(blob, metadata))) throw new Error(`Assinatura binária incompatível para ${metadata.name}.`);
  const checksum = await sha256(blob);
  if (metadata.checksum && checksum !== metadata.checksum) throw new Error(`Checksum armazenado divergente para ${metadata.name}.`);
  return checksum;
}

export async function exportProjectArchive(project: ElFuegoProject): Promise<Blob> {
  const validation = validateProject(project);
  if (!validation.valid || !validation.project) throw new Error('Projeto inválido.');
  const normalizedProject = validation.project;
  enforceProjectLimits(normalizedProject);

  const zip = new JSZip();
  const manifestAssets: ManifestAsset[] = [];
  let totalAssetBytes = 0;

  for (const metadata of normalizedProject.assets) {
    const stored = await getAsset(metadata.id);
    if (!stored) throw new Error(`Asset declarado ausente: ${metadata.name}.`);
    const checksum = await validateStoredAsset(metadata, stored.blob);
    const path = canonicalAssetPath(metadata);
    if (!safePath(path)) throw new Error(`Nome de asset inseguro: ${metadata.originalName}.`);
    totalAssetBytes += stored.blob.size;
    if (totalAssetBytes > MAX_PROJECT_BYTES) throw new Error('Conteúdo do projeto excede o tamanho máximo.');

    manifestAssets.push({
      id: metadata.id,
      path,
      mimeType: metadata.mimeType,
      size: stored.blob.size,
      checksumAlgorithm: 'sha256',
      checksum,
    });
    zip.file(path, stored.blob);
  }

  const manifest: Manifest = {
    format: normalizedProject.format,
    version: normalizedProject.version,
    checksumAlgorithm: 'sha256',
    assets: manifestAssets,
  };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('project.json', JSON.stringify(normalizedProject, null, 2));
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

export async function importProjectArchive(file: Blob): Promise<ElFuegoProject> {
  if (file.size > MAX_PROJECT_BYTES) throw new Error('Arquivo .elfuego excede o tamanho máximo.');
  const zip = await JSZip.loadAsync(file);
  const entryNames = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
  if (entryNames.length > MAX_ZIP_ENTRIES) throw new Error('Quantidade máxima de entradas do ZIP excedida.');
  if (entryNames.some((name) => !safePath(name))) throw new Error('O pacote contém um caminho inseguro.');

  const projectFile = zip.file('project.json');
  const manifestFile = zip.file('manifest.json');
  if (!projectFile) throw new Error('Arquivo project.json ausente.');
  if (!manifestFile) throw new Error('Arquivo manifest.json ausente.');

  const rawProject = parseJson(await projectFile.async('string'), 'project.json');
  if (jsonDepth(rawProject) > MAX_JSON_DEPTH) throw new Error('Estrutura JSON profunda demais.');
  const validation = validateProject(rawProject);
  if (!validation.valid || !validation.project) throw new Error('Projeto importado inválido.');
  const project = validation.project;
  enforceProjectLimits(project);

  const manifest = parseManifest(parseJson(await manifestFile.async('string'), 'manifest.json'));
  if (manifest.format !== project.format || manifest.version !== project.version) throw new Error('Manifesto incompatível.');
  if (manifest.assets.length > MAX_ASSETS) throw new Error('Quantidade máxima de assets excedida.');
  if (manifest.assets.length !== project.assets.length) throw new Error('Manifesto e projeto possuem quantidades diferentes de assets.');

  const allowedPaths = new Set(['manifest.json', 'project.json', ...manifest.assets.map((item) => item.path)]);
  const unexpected = entryNames.find((name) => !allowedPaths.has(name));
  if (unexpected) throw new Error(`Arquivo inesperado no pacote: ${unexpected}.`);

  const metadataById = new Map(project.assets.map((asset) => [asset.id, asset]));
  const seenIds = new Set<string>();
  const seenPaths = new Set<string>();
  const pending: AssetRecord[] = [];
  let total = 0;

  for (const item of manifest.assets) {
    if (
      !item
      || typeof item.id !== 'string'
      || typeof item.path !== 'string'
      || typeof item.mimeType !== 'string'
      || !Number.isInteger(item.size)
      || item.size < 0
      || item.checksumAlgorithm !== 'sha256'
      || typeof item.checksum !== 'string'
      || !/^[a-f0-9]{64}$/i.test(item.checksum)
    ) {
      throw new Error('Entrada inválida no manifesto.');
    }
    if (seenIds.has(item.id)) throw new Error(`Asset ID duplicado: ${item.id}.`);
    if (seenPaths.has(item.path)) throw new Error(`Caminho duplicado: ${item.path}.`);
    if (!safePath(item.path)) throw new Error(`Caminho inseguro: ${item.path}.`);
    seenIds.add(item.id);
    seenPaths.add(item.path);

    const metadata = metadataById.get(item.id);
    if (!metadata) throw new Error(`Asset não declarado no projeto: ${item.id}.`);
    const expectedPath = canonicalAssetPath(metadata);
    if (item.path !== expectedPath) throw new Error(`Caminho não canônico para ${metadata.name}.`);
    if (item.mimeType !== metadata.mimeType || !SAFE_MIME[metadata.category].test(item.mimeType)) {
      throw new Error(`MIME incompatível para ${metadata.name}.`);
    }

    const entry = zip.file(item.path);
    if (!entry) throw new Error(`Arquivo binário ausente: ${item.path}.`);
    const blob = await entry.async('blob');
    if (blob.size !== item.size || blob.size !== metadata.size) throw new Error(`Tamanho divergente para ${metadata.name}.`);
    if (blob.size > MAX_ASSET_BYTES) throw new Error(`Asset excede o tamanho máximo: ${metadata.name}.`);
    total += blob.size;
    if (total > MAX_PROJECT_BYTES) throw new Error('Conteúdo descompactado excede o tamanho máximo.');
    if (!(await hasExpectedSignature(blob, metadata))) throw new Error(`Assinatura binária incompatível para ${metadata.name}.`);

    const checksum = await sha256(blob);
    if (checksum !== item.checksum) throw new Error(`Checksum divergente para ${metadata.name}.`);
    if (metadata.checksum && checksum !== metadata.checksum) throw new Error(`Checksum do projeto divergente para ${metadata.name}.`);
    pending.push({
      id: metadata.id,
      projectId: project.project.id,
      name: metadata.name,
      originalName: metadata.originalName,
      category: metadata.category,
      mimeType: metadata.mimeType,
      size: metadata.size,
      checksum,
      createdAt: new Date().toISOString(),
      blob,
    });
  }

  for (const metadata of project.assets) {
    if (!seenIds.has(metadata.id)) throw new Error(`Asset declarado sem arquivo: ${metadata.name}.`);
  }

  await db.transaction('rw', db.projects, db.assets, async () => {
    await db.assets.where('projectId').equals(project.project.id).delete();
    await db.projects.put({
      id: project.project.id,
      name: project.project.name,
      updatedAt: project.project.updatedAt,
      data: project,
    });
    if (pending.length) await db.assets.bulkPut(pending);
  });
  return project;
}
