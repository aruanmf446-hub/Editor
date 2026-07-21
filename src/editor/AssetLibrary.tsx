import { useEffect, useRef, useState } from 'react';
import { useAssetStore } from '../state/assetStore';
import { useEditorStore } from '../state/editorStore';
import type { AssetRecord } from '../persistence/database';

const labels = { background: 'Cenários', model: 'Modelos 3D', texture: 'Imagens', audio: 'Áudio', other: 'Outros', thumbnail: 'Miniaturas' } as const;
const icons = { background: '▣', model: '◈', texture: '▧', audio: '♫', other: '◆', thumbnail: '▤' } as const;

export function AssetLibrary() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const { assets, loading, load, importFiles, remove, rename } = useAssetStore();
  const projectId = useEditorStore((state) => state.project.project.id);

  useEffect(() => { void load(projectId); }, [load, projectId]);
  useEffect(() => {
    const urls: Record<string, string> = {};
    for (const asset of assets) if (asset.mimeType.startsWith('image/')) urls[asset.id] = URL.createObjectURL(asset.blob);
    setPreviewUrls(urls);
    return () => Object.values(urls).forEach(URL.revokeObjectURL);
  }, [assets]);

  const instantiate = (asset: AssetRecord) => {
    const editor = useEditorStore.getState();
    if (asset.category === 'background') {
      editor.setProject({ ...editor.project, scenes: editor.project.scenes.map((scene) => scene.id === editor.selectedSceneId ? { ...scene, backgroundAssetId: asset.id } : scene) }, 'Alterações não salvas');
      return;
    }
    if (asset.category === 'audio') return;
    editor.addObject('decoration');
    const current = useEditorStore.getState();
    const objectId = current.selectedObjectId;
    if (!objectId) return;
    current.setProject({ ...current.project, scenes: current.project.scenes.map((scene) => ({ ...scene, objects: scene.objects.map((object) => object.id === objectId ? { ...object, assetId: asset.id, name: asset.name } : object) })) }, 'Alterações não salvas');
  };

  return (
    <aside className="asset-library">
      <div className="asset-header"><div><strong>Assets</strong><span>{assets.length} arquivo(s)</span></div><button onClick={() => inputRef.current?.click()}>Importar</button></div>
      <input ref={inputRef} hidden multiple type="file" accept="image/*,.glb,.gltf,audio/*" onChange={(event) => { if (event.target.files) void importFiles(event.target.files); event.target.value = ''; }} />
      {loading ? <p className="asset-empty">Carregando...</p> : assets.length === 0 ? <p className="asset-empty">Importe imagens, GLB ou áudio. Dê duplo clique para usar.</p> : (
        <div className="asset-groups">
          {Object.entries(labels).map(([category, label]) => {
            const items = assets.filter((asset) => asset.category === category);
            if (!items.length) return null;
            return <section key={category}><h3>{label}</h3><div className="asset-grid">{items.map((asset) => (
              <article className="asset-card" key={asset.id} onDoubleClick={() => instantiate(asset)} draggable onDragStart={(event) => event.dataTransfer.setData('application/x-elfuego-asset', asset.id)}>
                <div className="asset-preview">{previewUrls[asset.id] ? <img src={previewUrls[asset.id]} alt="" /> : <span>{icons[asset.category]}</span>}</div>
                <button className="asset-name" title="Renomear" onClick={() => { const next = window.prompt('Nome do asset', asset.name); if (next?.trim()) void rename(asset.id, next.trim()); }}>{asset.name}</button>
                <small>{Math.ceil(asset.size / 1024)} KB</small>
                <button className="asset-delete" title="Excluir asset" onClick={() => { if (window.confirm(`Excluir ${asset.name}?`)) void remove(asset.id); }}>×</button>
              </article>
            ))}</div></section>;
          })}
        </div>
      )}
    </aside>
  );
}
