import { useEditorStore } from '../state/editorStore';
import { SelectionTools } from './SelectionTools';

const groups = [
  { label: 'Fluxo', items: [['Spawn', 'player-spawn'], ['Fim', 'finish'], ['Checkpoint', 'checkpoint']] },
  { label: 'Física', items: [['Plataforma', 'platform'], ['Parede', 'wall'], ['Queda', 'drop-zone']] },
  { label: 'Recargas', items: [['Vida', 'pickup-health'], ['Ataque', 'pickup-attack'], ['Defesa', 'pickup-defense']] },
  { label: 'Inimigos', items: [['Cacto', 'enemy-cactus'], ['Boss', 'boss']] },
  { label: 'Objetos', items: [['Obstáculo', 'obstacle'], ['Decoração', 'decoration'], ['Gatilho', 'trigger']] },
] as const;

export function EditorToolbar() {
  const { project, gridEnabled, toggleGrid, toggleSnap, zoom, requestFitScene, addObject, selectedObjectIds, clipboard, copySelected, pasteClipboard, duplicateSelected, deleteSelected } = useEditorStore();

  return <nav className="toolbar" aria-label="Ferramentas do editor">
    <div className="tool-groups">
      {groups.map((group) => <div className="tool-menu" key={group.label}>
        <span>{group.label}</span>
        {group.items.map(([label, type]) => <button key={type} onClick={() => addObject(type)}>{label}</button>)}
      </div>)}
      <div className="edit-actions" aria-label="Ações de edição">
        <button disabled={!selectedObjectIds.length} onClick={copySelected}>Copiar</button>
        <button disabled={!clipboard.length} onClick={pasteClipboard}>Colar</button>
        <button disabled={!selectedObjectIds.length} onClick={duplicateSelected}>Duplicar</button>
        <button disabled={!selectedObjectIds.length} onClick={deleteSelected}>Excluir</button>
      </div>
    </div>
    <SelectionTools />
    <div className="view-tools">
      <button className={project.settings.snapEnabled ? 'active-tool' : ''} onClick={toggleSnap} title={`Snap ${project.settings.snapEnabled ? 'ligado' : 'desligado'}`} aria-label={`Snap ${project.settings.snapEnabled ? 'ligado' : 'desligado'}`}>
        <span className="view-tool-icon" aria-hidden="true">⌁</span><span className="view-tool-label">Snap {project.settings.snapEnabled ? 'ligado' : 'desligado'}</span>
      </button>
      <button className={gridEnabled ? 'active-tool' : ''} onClick={toggleGrid} title={`Grade ${gridEnabled ? 'ligada' : 'desligada'}`} aria-label={`Grade ${gridEnabled ? 'ligada' : 'desligada'}`}>
        <span className="view-tool-icon" aria-hidden="true">#</span><span className="view-tool-label">Grade {gridEnabled ? 'ligada' : 'desligada'}</span>
      </button>
      <button onClick={requestFitScene} title="Enquadrar cena" aria-label="Enquadrar cena">
        <span className="view-tool-icon" aria-hidden="true">⛶</span><span className="view-tool-label">Enquadrar</span>
      </button>
      <span>{Math.round(zoom * 100)}%</span>
    </div>
  </nav>;
}
