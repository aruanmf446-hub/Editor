import { useEditorStore } from '../state/editorStore';

export function ObjectTree() {
  const { project, selectedSceneId, selectedObjectId, selectObject, duplicateObject, deleteObject, toggleObjectVisibility, toggleObjectLock } = useEditorStore();
  const scene = project.scenes.find((item) => item.id === selectedSceneId) ?? project.scenes[0];

  return (
    <section className="object-tree">
      <div className="panel-title-row"><h2>Objetos</h2><span>{scene.objects.length}</span></div>
      {scene.objects.length === 0 ? <p className="empty-list">Nenhum objeto nesta cena.</p> : (
        <div className="object-list">
          {scene.objects.map((object) => (
            <div className={`object-row ${selectedObjectId === object.id ? 'active' : ''}`} key={object.id}>
              <button className="object-name" onClick={() => selectObject(object.id)} title={object.type}>{object.name}</button>
              <div className="object-actions">
                <button onClick={() => toggleObjectVisibility(object.id)} title="Mostrar ou ocultar">{object.visible ? '👁' : '◌'}</button>
                <button onClick={() => toggleObjectLock(object.id)} title="Bloquear edição">{object.locked ? '🔒' : '🔓'}</button>
                <button onClick={() => duplicateObject(object.id)} title="Duplicar">⧉</button>
                <button onClick={() => deleteObject(object.id)} title="Excluir">×</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}