import { useEditorStore } from '../state/editorStore';

const MODEL_OBJECT_TYPES = new Set([
  'player-spawn',
  'enemy-cactus',
  'boss',
  'decoration',
  'obstacle',
]);

const isBaseModel = (originalName: string) => {
  const extension = originalName.toLowerCase().split('.').pop();
  return extension === 'glb' || extension === 'gltf' || extension === 'fbx' || extension === 'obj';
};

export function ModelAssetPanel() {
  const project = useEditorStore((state) => state.project);
  const selectedSceneId = useEditorStore((state) => state.selectedSceneId);
  const selectedObjectId = useEditorStore((state) => state.selectedObjectId);
  const updateObject = useEditorStore((state) => state.updateObject);

  const scene = project.scenes.find((item) => item.id === selectedSceneId) ?? project.scenes[0];
  const object = scene?.objects.find((item) => item.id === selectedObjectId);
  if (!object || !MODEL_OBJECT_TYPES.has(object.type)) return null;

  const models = project.assets.filter((asset) => asset.category === 'model' && isBaseModel(asset.originalName));
  const selectedModel = models.find((asset) => asset.id === object.assetId);

  return (
    <section className="panel inspector model-asset-panel" aria-label="Modelo 3D do objeto">
      <h2>Modelo 3D</h2>
      <label>
        Arquivo do personagem
        <select
          value={object.assetId ?? ''}
          onChange={(event) => updateObject(object.id, { assetId: event.target.value || undefined })}
        >
          <option value="">Nenhum modelo</option>
          {models.map((asset) => (
            <option key={asset.id} value={asset.id}>{asset.name} ({asset.originalName.split('.').pop()?.toUpperCase()})</option>
          ))}
        </select>
      </label>

      {models.length === 0 ? (
        <p className="panel-hint">Importe um arquivo GLB, GLTF, FBX ou OBJ em Assets.</p>
      ) : selectedModel ? (
        <div className="model-asset-summary">
          <strong>{selectedModel.name}</strong>
          <span>{selectedModel.originalName.split('.').pop()?.toUpperCase()} vinculado ao objeto</span>
          <button type="button" onClick={() => updateObject(object.id, { assetId: undefined })}>Remover modelo</button>
        </div>
      ) : (
        <p className="panel-hint">Selecione um dos modelos importados acima.</p>
      )}
    </section>
  );
}
