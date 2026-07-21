import { useEditorStore } from '../state/editorStore';
import { SelectionTools } from './SelectionTools';

const groups=[
 {label:'Fluxo',items:[['Spawn','player-spawn'],['Fim','finish'],['Checkpoint','checkpoint']]},
 {label:'Física',items:[['Plataforma','platform'],['Parede','wall'],['Queda','drop-zone']]},
 {label:'Recargas',items:[['Vida','pickup-health'],['Ataque','pickup-attack'],['Defesa','pickup-defense']]},
 {label:'Inimigos',items:[['Cacto','enemy-cactus'],['Boss','boss']]},
 {label:'Objetos',items:[['Obstáculo','obstacle'],['Decoração','decoration'],['Gatilho','trigger']]},
] as const;

export function EditorToolbar(){
 const {project,gridEnabled,toggleGrid,toggleSnap,zoom,requestFitScene,addObject,selectedObjectIds,clipboard,copySelected,pasteClipboard,duplicateSelected,deleteSelected}=useEditorStore();
 return <nav className="toolbar" aria-label="Ferramentas do editor">
  <div className="tool-groups">
   {groups.map(group=><div className="tool-menu" key={group.label}><span>{group.label}</span>{group.items.map(([label,type])=><button key={type} onClick={()=>addObject(type)}>{label}</button>)}</div>)}
   <span className="toolbar-divider"/>
   <button disabled={!selectedObjectIds.length} onClick={copySelected}>Copiar</button>
   <button disabled={!clipboard.length} onClick={pasteClipboard}>Colar</button>
   <button disabled={!selectedObjectIds.length} onClick={duplicateSelected}>Duplicar</button>
   <button disabled={!selectedObjectIds.length} onClick={deleteSelected}>Excluir</button>
  </div>
  <SelectionTools />
  <div className="view-tools">
   <button className={project.settings.snapEnabled?'active-tool':''} onClick={toggleSnap}>Snap {project.settings.snapEnabled?'ligado':'desligado'}</button>
   <button className={gridEnabled?'active-tool':''} onClick={toggleGrid}>Grade {gridEnabled?'ligada':'desligada'}</button>
   <button onClick={requestFitScene}>Enquadrar</button><span>{Math.round(zoom*100)}%</span>
  </div>
 </nav>;
}
