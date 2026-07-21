import { useEditorStore } from '../state/editorStore';

const groups = ['Cenário', 'Fluxo', 'Física', 'Recargas', 'Inimigos', 'Objetos'];

export function EditorToolbar() {
  const { gridEnabled, toggleGrid, zoom, setZoom } = useEditorStore();
  return (
    <nav className="toolbar" aria-label="Ferramentas do editor">
      <div className="tool-groups">{groups.map((group) => <button key={group} disabled title="Será habilitado nas próximas etapas">{group}</button>)}</div>
      <div className="view-tools">
        <button onClick={toggleGrid}>{gridEnabled ? 'Grade ligada' : 'Grade desligada'}</button>
        <button onClick={() => setZoom(0.55)}>Enquadrar</button>
        <span>{Math.round(zoom * 100)}%</span>
      </div>
    </nav>
  );
}
