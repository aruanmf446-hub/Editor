import { useEditorStore } from '../state/editorStore';

export function EditorToolbar() {
  const { gridEnabled, toggleGrid, zoom, setZoom, addObject } = useEditorStore();
  return (
    <nav className="toolbar" aria-label="Ferramentas do editor">
      <div className="tool-groups">
        <button disabled title="Importação de cenário entra na próxima entrega">Cenário</button>
        <button onClick={() => addObject('checkpoint')}>Checkpoint</button>
        <button onClick={() => addObject('obstacle')}>Obstáculo</button>
        <button onClick={() => addObject('decoration')}>Decoração</button>
        <button onClick={() => addObject('trigger')}>Gatilho</button>
        <button onClick={() => addObject('collectible')}>Coletável</button>
      </div>
      <div className="view-tools">
        <button onClick={toggleGrid}>{gridEnabled ? 'Grade ligada' : 'Grade desligada'}</button>
        <button onClick={() => setZoom(0.55)}>Enquadrar</button>
        <span>{Math.round(zoom * 100)}%</span>
      </div>
    </nav>
  );
}