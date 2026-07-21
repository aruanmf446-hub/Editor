import { useEditorStore } from '../state/editorStore';

export function ObjectTree() {
  const { project, selectedSceneId, selectedObjectIds, selectObject, duplicateObject, deleteObject, toggleObjectVisibility, toggleObjectLock } = useEditorStore();
  const scene = project.scenes.find((item) => item.id === selectedSceneId) ?? project.scenes[0];

  return (
    <section className="object-tree">
      <div className="panel-title-row"><h2>Objetos</h2><span>{selectedObjectIds.length ? `${selectedObjectIds.length} selecionado(s)` : scene.objects.length}</span></div>
      {scene.objects.length === 0 ? <p className="empty-list">Nenhum objeto nesta cena.</p> : (
        <div className="object-list">
          {scene.objects.map((object) => (
            <div className={`object-row ${selectedObjectIds.includes(object.id) ? 'active' : ''}`} key={object.id}>
              <button className="object-name" onClick={(event) => selectObject(object.id, event.ctrlKey || event.metaKey || event.shiftKey)} title={`${object.type} · Ctrl/Shift para seleção múltipla`}>{object.name}</button>
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