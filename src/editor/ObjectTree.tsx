import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditorStore } from '../state/editorStore';
import type { SceneObjectType } from '../types/project';
import { validateProject } from '../validation/validateProject';

const typeLabels: Record<SceneObjectType, string> = {
  'player-spawn': 'Player', finish: 'Fim', checkpoint: 'Checkpoint', platform: 'Plataforma', wall: 'Parede',
  'drop-zone': 'Zona de queda', 'no-collision-zone': 'Sem colisão', 'pickup-health': 'Vida',
  'pickup-attack': 'Ataque', 'pickup-defense': 'Defesa', 'enemy-cactus': 'Cacto', boss: 'Boss',
  decoration: 'Decoração', obstacle: 'Obstáculo', trigger: 'Gatilho', 'dialogue-zone': 'Diálogo', collectible: 'Coletável',
};

export function ObjectTree() {
  const state = useEditorStore();
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'all' | SceneObjectType>('all');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [dragged, setDragged] = useState<{ sceneId: string; objectId: string } | null>(null);
  const selectedRef = useRef<HTMLDivElement>(null);
  const validation = useMemo(() => validateProject(state.project), [state.project]);
  const issuesByObject = useMemo(() => {
    const map = new Map<string, 'error' | 'warning' | 'info'>();
    const rank = { info: 1, warning: 2, error: 3 } as const;
    for (const issue of validation.issues) {
      if (!issue.objectId) continue;
      const current = map.get(issue.objectId);
      if (!current || rank[issue.severity] > rank[current]) map.set(issue.objectId, issue.severity);
    }
    return map;
  }, [validation]);

  useEffect(() => { selectedRef.current?.scrollIntoView({ block: 'nearest' }); }, [state.selectedObjectId, state.selectedSceneId]);

  const reorder = (sceneId: string, sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    useEditorStore.setState(current => {
      const before = structuredClone(current.project);
      const scenes = current.project.scenes.map(scene => {
        if (scene.id !== sceneId) return scene;
        const objects = [...scene.objects];
        const from = objects.findIndex(object => object.id === sourceId);
        const to = objects.findIndex(object => object.id === targetId);
        if (from < 0 || to < 0) return scene;
        const [moved] = objects.splice(from, 1);
        objects.splice(to, 0, moved);
        return { ...scene, objects };
      });
      return {
        project: { ...current.project, project: { ...current.project.project, updatedAt: new Date().toISOString() }, scenes },
        past: [...current.past.slice(-49), before], future: [], saveStatus: 'Alterações não salvas',
      };
    });
  };

  return <aside className="panel object-tree">
    <header><h2>Objetos</h2><span>{state.project.scenes.reduce((sum, scene) => sum + scene.objects.length, 0)}</span></header>
    <div className="object-tree-filters">
      <input aria-label="Pesquisar objetos" placeholder="Pesquisar..." value={query} onChange={event => setQuery(event.target.value)} />
      <select aria-label="Filtrar por tipo" value={type} onChange={event => setType(event.target.value as 'all' | SceneObjectType)}>
        <option value="all">Todos os tipos</option>
        {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </div>
    <div className="object-tree-list">
      {state.project.scenes.map(scene => {
        const objects = scene.objects.filter(object => (type === 'all' || object.type === type) && object.name.toLowerCase().includes(query.trim().toLowerCase()));
        const isCollapsed = collapsed[scene.id] ?? false;
        return <section key={scene.id} className={`tree-scene ${scene.id === state.selectedSceneId ? 'active' : ''}`}>
          <button className="tree-scene-title" onClick={() => { state.selectScene(scene.id); setCollapsed(value => ({ ...value, [scene.id]: !isCollapsed })); }}>
            <span>{isCollapsed ? '▸' : '▾'} {scene.name}</span><em>{objects.length}</em>
          </button>
          {!isCollapsed && <div className="tree-scene-objects">
            {objects.map(object => {
              const selected = state.selectedObjectIds.includes(object.id);
              const missingAsset = Boolean(object.assetId && !state.project.assets.some(asset => asset.id === object.assetId));
              const issue = issuesByObject.get(object.id);
              return <div key={object.id} ref={state.selectedObjectId === object.id ? selectedRef : undefined}
                className={`tree-object ${selected ? 'selected' : ''} ${missingAsset ? 'missing-asset' : ''}`}
                draggable onDragStart={() => setDragged({ sceneId: scene.id, objectId: object.id })} onDragEnd={() => setDragged(null)}
                onDragOver={event => event.preventDefault()} onDrop={() => { if (dragged?.sceneId === scene.id) reorder(scene.id, dragged.objectId, object.id); setDragged(null); }}
                onClick={event => { if (state.selectedSceneId !== scene.id) state.selectScene(scene.id); state.selectObject(object.id, event.ctrlKey || event.metaKey || event.shiftKey); }}>
                <span className="drag-handle" title="Arrastar para ordenar">⋮⋮</span>
                <input className="tree-object-name" value={object.name} onClick={event => event.stopPropagation()} onChange={event => state.updateObject(object.id, { name: event.target.value })} />
                {issue && <span className={`tree-issue ${issue}`} title="Este objeto possui problemas">{issue === 'error' ? '!' : issue === 'warning' ? '⚠' : 'i'}</span>}
                {missingAsset && <span title="Asset ausente">⛓</span>}
                <button title={object.visible ? 'Ocultar' : 'Mostrar'} onClick={event => { event.stopPropagation(); state.toggleObjectVisibility(object.id); }}>{object.visible ? '◉' : '○'}</button>
                <button title={object.locked ? 'Desbloquear' : 'Bloquear'} onClick={event => { event.stopPropagation(); state.toggleObjectLock(object.id); }}>{object.locked ? '🔒' : '🔓'}</button>
                <button title="Duplicar" onClick={event => { event.stopPropagation(); state.duplicateObject(object.id); }}>⧉</button>
                <button title="Excluir" onClick={event => { event.stopPropagation(); state.deleteObject(object.id); }}>×</button>
              </div>;
            })}
            {!objects.length && <div className="tree-empty">Nenhum objeto neste filtro.</div>}
          </div>}
        </section>;
      })}
    </div>
  </aside>;
}
