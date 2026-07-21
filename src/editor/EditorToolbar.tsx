import { useEditorStore } from '../state/editorStore';

export function EditorToolbar() {
  const { project, gridEnabled, toggleGrid, toggleSnap, zoom, setZoom, addObject, selectedObjectIds, clipboard, copySelected, pasteClipboard, duplicateSelected, deleteSelected } = useEditorStore();
  return (
    <nav className="toolbar" aria-label="Ferramentas do editor">
      <div className="tool-groups">
        <button disabled title="Importação de cenário entra na próxima entrega">Cenário</button>
        <button onClick={() => addObject('checkpoint')}>Checkpoint</button>
        <button onClick={() => addObject('obstacle')}>Obstáculo</button>
        <button onClick={() => addObject('decoration')}>Decoração</button>
        <button onClick={() => addObject('trigger')}>Gatilho</button>
        <button onClick={() => addObject('collectible')}>Coletável</button>
        <span className="toolbar-divider" />
        <button disabled={!selectedObjectIds.length} onClick={copySelected} title="Ctrl+C">Copiar</button>
        <button disabled={!clipboard.length} onClick={pasteClipboard} title="Ctrl+V">Colar</button>
        <button disabled={!selectedObjectIds.length} onClick={duplicateSelected} title="Ctrl+D">Duplicar</button>
        <button disabled={!selectedObjectIds.length} onClick={deleteSelected} title="Delete">Excluir</button>
      </div>
      <div className="view-tools">
        <button className={project.settings.snapEnabled ? 'active-tool' : ''} onClick={toggleSnap}>Snap {project.settings.snapEnabled ? 'ligado' : 'desligado'}</button>
        <button className={gridEnabled ? 'active-tool' : ''} onClick={toggleGrid}>Grade {gridEnabled ? 'ligada' : 'desligada'}</button>
        <button onClick={() => setZoom(0.55)}>Enquadrar</button>
        <span>{Math.round(zoom * 100)}%</span>
      </div>
    </nav>
  );
}