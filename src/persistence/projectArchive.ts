import JSZip from 'jszip';
import { validateProject } from '../validation/validateProject';
import type { ElFuegoProject, ProjectAsset } from '../types/project';
import { getAsset, saveAsset } from './assetRepository';

const MAX_ASSET_BYTES = 50 * 1024 * 1024;
const MAX_PROJECT_BYTES = 250 * 1024 * 1024;
const SAFE_MIME: Record<ProjectAsset['category'], RegExp> = {
  background: /^image\//, model: /^(model\/gltf-binary|application\/octet-stream)$/, texture: /^image\//,
  audio: /^audio\//, thumbnail: /^image\//, other: /^[\w.+-]+\/[\w.+-]+$/,
};
type ManifestAsset={id:string;path:string;mimeType:string;size:number;checksum?:string};
type Manifest={format:string;version:number;assets:ManifestAsset[]};

function safePath(path:string):boolean{return path.length>0&&!path.startsWith('/')&&!path.includes('\\')&&!path.split('/').some(part=>part==='..'||part==='.'||part==='');}
async function sha256(blob:Blob):Promise<string>{const hash=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());return [...new Uint8Array(hash)].map(value=>value.toString(16).padStart(2,'0')).join('');}

export async function exportProjectArchive(project: ElFuegoProject): Promise<Blob> {
  const validation=validateProject(project);if(!validation.valid||!validation.project)throw new Error('Projeto inválido.');
  const zip=new JSZip(),manifestAssets:ManifestAsset[]=[];
  for(const metadata of validation.project.assets){const stored=await getAsset(metadata.id);if(!stored)throw new Error(`Asset declarado ausente: ${metadata.name}.`);const checksum=metadata.checksum||await sha256(stored.blob);const path=`assets/${metadata.id}/${metadata.originalName}`;if(!safePath(path))throw new Error(`Nome de asset inseguro: ${metadata.originalName}.`);manifestAssets.push({id:metadata.id,path,mimeType:metadata.mimeType,size:stored.blob.size,checksum});zip.file(path,stored.blob);}
  zip.file('manifest.json',JSON.stringify({format:project.format,version:project.version,assets:manifestAssets},null,2));zip.file('project.json',JSON.stringify(validation.project,null,2));
  return zip.generateAsync({type:'blob',compression:'DEFLATE'});
}

export async function importProjectArchive(file: Blob): Promise<ElFuegoProject> {
  if(file.size>MAX_PROJECT_BYTES)throw new Error('Arquivo .elfuego excede o tamanho máximo.');
  const zip=await JSZip.loadAsync(file),projectFile=zip.file('project.json'),manifestFile=zip.file('manifest.json');
  if(!projectFile)throw new Error('Arquivo project.json ausente.');if(!manifestFile)throw new Error('Arquivo manifest.json ausente.');
  const validation=validateProject(JSON.parse(await projectFile.async('string')) as unknown);if(!validation.valid||!validation.project)throw new Error('Projeto importado inválido.');const project=validation.project;
  const manifest=JSON.parse(await manifestFile.async('string')) as Manifest;if(manifest.format!==project.format||manifest.version!==project.version||!Array.isArray(manifest.assets))throw new Error('Manifesto incompatível.');
  const metadataById=new Map(project.assets.map(asset=>[asset.id,asset])),seenIds=new Set<string>(),seenPaths=new Set<string>();const pending:Array<{metadata:ProjectAsset;blob:Blob;checksum:string}>=[];let total=0;
  for(const item of manifest.assets){if(!item||typeof item.id!=='string'||typeof item.path!=='string'||typeof item.mimeType!=='string'||!Number.isInteger(item.size)||item.size<0)throw new Error('Entrada inválida no manifesto.');if(seenIds.has(item.id))throw new Error(`Asset ID duplicado: ${item.id}.`);if(seenPaths.has(item.path))throw new Error(`Caminho duplicado: ${item.path}.`);if(!safePath(item.path))throw new Error(`Caminho inseguro: ${item.path}.`);seenIds.add(item.id);seenPaths.add(item.path);const metadata=metadataById.get(item.id);if(!metadata)throw new Error(`Asset não declarado no projeto: ${item.id}.`);if(item.mimeType!==metadata.mimeType||!SAFE_MIME[metadata.category].test(item.mimeType))throw new Error(`MIME incompatível para ${metadata.name}.`);const entry=zip.file(item.path);if(!entry)throw new Error(`Arquivo binário ausente: ${item.path}.`);const blob=await entry.async('blob');if(blob.size!==item.size||blob.size!==metadata.size)throw new Error(`Tamanho divergente para ${metadata.name}.`);if(blob.size>MAX_ASSET_BYTES)throw new Error(`Asset excede o tamanho máximo: ${metadata.name}.`);total+=blob.size;if(total>MAX_PROJECT_BYTES)throw new Error('Conteúdo descompactado excede o tamanho máximo.');const checksum=await sha256(blob);if(item.checksum&&checksum!==item.checksum)throw new Error(`Checksum divergente para ${metadata.name}.`);if(metadata.checksum&&checksum!==metadata.checksum)throw new Error(`Checksum do projeto divergente para ${metadata.name}.`);pending.push({metadata,blob,checksum});}
  for(const metadata of project.assets)if(!seenIds.has(metadata.id))throw new Error(`Asset declarado sem arquivo: ${metadata.name}.`);
  for(const {metadata,blob,checksum} of pending)await saveAsset({id:metadata.id,projectId:project.project.id,name:metadata.name,originalName:metadata.originalName,category:metadata.category,mimeType:metadata.mimeType,size:metadata.size,checksum,createdAt:new Date().toISOString(),blob});
  return project;
}
