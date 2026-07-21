import { useEffect, useMemo, useRef } from 'react';
import { useAssetStore } from '../state/assetStore';
import { useEditorStore } from '../state/editorStore';
import type { AssetRecord } from '../persistence/database';

const labels = { background: 'Cenários', model: 'Modelos 3D', texture: 'Imagens', audio: 'Áudio', other: 'Outros', thumbnail: 'Miniaturas' } as const;
const icons = { background: '▣', model: '◈', texture: '▧', audio: '♫', other: '◆', thumbnail: '▤' } as const;

export function AssetLibrary() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { assets, loading, load, importFiles, remove, rename } = useAssetStore();
  const projectId = useEditorStore((state) => state.project.project.id);
  const selectedSceneId = useEditorStore((state) => state.selectedSceneId);
  const selectedScene = useEditorStore((state) => state.project.scenes.find((scene) => scene.id === state.selectedSceneId));
  const updateScene = useEditorStore((state) => state.updateScene);

  useEffect(() => { void load(projectId); }, [load, projectId]);

  const previewUrls = useMemo(() => {
    const urls: Record<string, string> = {};
    for (const asset of assets) if (asset.mimeType.startsWith('image/')) urls[asset.id] = URL.createObjectURL(asset.blob);
    return urls;
  }, [assets]);

  useEffect(() => () => { Object.values(previewUrls).forEach((url) => URL.revokeObjectURL(url)); }, [previewUrls]);

  const applyBackground = (asset: AssetRecord) => {
    if (!selectedSceneId) return;
    updateScene(selectedSceneId, { backgroundAssetId: asset.id });
  };

  const instantiate = (asset: AssetRecord) => {
    if (asset.category === 'background') { applyBackground(asset); return; }
    if (asset.category === 'audio') return;
    useEditorStore.getState().addAssetInstance(asset.id);
  };

  return (
    <aside className="asset-library">
      <div className="asset-header"><div><strong>Assets</strong><span>{assets.length} arquivo(s)</span></div><button onClick={() => inputRef.current?.click()}>Importar</button></div>
      <div className="background-target"><span>Fundo da cena:</span><strong>{selectedScene?.name ?? 'Nenhuma cena'}</strong>{selectedScene?.backgroundAssetId && <button onClick={() => updateScene(selectedScene.id, { backgroundAssetId: null })}>Remover fundo</button>}</div>
      <input ref={inputRef} hidden multiple type="file" accept="image/*,.glb,.gltf,audio/*" onChange={(event) => { if (event.target.files) void importFiles(event.target.files); event.target.value = ''; }} />
      {loading ? <p className="asset-empty">Carregando...</p> : assets.length === 0 ? <p className="asset-empty">Importe imagens, GLB ou áudio.</p> : (
        <div className="asset-groups">
          {Object.entries(labels).map(([category, label]) => {
            const items = assets.filter((asset) => asset.category === category);
            if (!items.length) return null;
            return <section key={category}><h3>{label}</h3><div className="asset-grid">{items.map((asset) => {
              const canBeBackground = asset.mimeType.startsWith('image/');
              const activeBackground = selectedScene?.backgroundAssetId === asset.id;
              return <article className={`asset-card ${activeBackground ? 'active-background' : ''}`} key={asset.id} onDoubleClick={() => instantiate(asset)} draggable onDragStart={(event) => event.dataTransfer.setData('application/x-elfuego-asset', asset.id)}>
                <div className="asset-preview">{previewUrls[asset.id] ? <img src={previewUrls[asset.id]} alt="" /> : <span>{icons[asset.category]}</span>}</div>
                <button className="asset-name" title="Renomear" onClick={() => { const next = window.prompt('Nome do asset', asset.name); if (next?.trim()) void rename(asset.id, next.trim()); }}>{asset.name}</button>
                <small>{Math.ceil(asset.size / 1024)} KB</small>
                {canBeBackground && <button className="asset-background-button" disabled={activeBackground} onClick={() => applyBackground(asset)}>{activeBackground ? 'Fundo atual' : 'Usar como fundo'}</button>}
                <button className="asset-delete" title="Excluir asset" onClick={() => { if (window.confirm(`Excluir ${asset.name}?`)) void remove(asset.id); }}>×</button>
              </article>;
            })}</div></section>;
          })}
        </div>
      )}
    </aside>
  );
}
