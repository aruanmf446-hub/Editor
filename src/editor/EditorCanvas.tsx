import { useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useEditorStore } from '../state/editorStore';
import type { ElFuegoProject, SceneObjectBase, Transform2D } from '../types/project';

const symbols: Record<string, string> = { decoration: '◆', obstacle: '▰', checkpoint: '⚑', trigger: '◎', collectible: '✦' };
type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
type Interaction = { objectId: string; objectIds: string[]; mode: 'move' | ResizeHandle; pointerId: number; startX: number; startY: number; startTransforms: Record<string, Transform2D>; beforeProject: ElFuegoProject };
type Guides = { vertical: boolean; horizontal: boolean };
const handles: ResizeHandle[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function EditorCanvas() {
  const { project, selectedSceneId, selectedObjectId, selectedObjectIds, selectObject, zoom, setZoom, gridEnabled, previewObjectTransforms, commitTransformPreview, cancelTransformPreview } = useEditorStore();
  const [interaction, setInteraction] = useState<Interaction | null>(null);
  const [guides, setGuides] = useState<Guides>({ vertical: false, horizontal: false });
  const scene = project.scenes.find((item) => item.id === selectedSceneId) ?? project.scenes[0];
  const snapValue = (value: number) => project.settings.snapEnabled ? Math.round(value / project.settings.gridSize) * project.settings.gridSize : Math.round(value);

  const startInteraction = (event: ReactPointerEvent<HTMLElement>, object: SceneObjectBase, mode: 'move' | ResizeHandle) => {
    event.preventDefault(); event.stopPropagation();
    const additive = event.ctrlKey || event.metaKey || event.shiftKey;
    if (additive && mode === 'move') { selectObject(object.id, true); return; }
    if (object.locked) { selectObject(object.id); return; }
    const groupIds = mode === 'move' && selectedObjectIds.includes(object.id) && selectedObjectIds.length > 1 ? selectedObjectIds : [object.id];
    if (!selectedObjectIds.includes(object.id)) selectObject(object.id);
    const startTransforms = Object.fromEntries(scene.objects.filter((item) => groupIds.includes(item.id)).map((item) => [item.id, { ...item.transform }]));
    event.currentTarget.setPointerCapture(event.pointerId);
    setInteraction({ objectId: object.id, objectIds: groupIds, mode, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, startTransforms, beforeProject: structuredClone(project) });
  };

  const updateInteraction = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!interaction || event.pointerId !== interaction.pointerId) return;
    let dx = (event.clientX - interaction.startX) / zoom;
    let dy = (event.clientY - interaction.startY) / zoom;
    const primary = interaction.startTransforms[interaction.objectId];
    if (!primary) return;
    const nextTransforms: Record<string, Transform2D> = {};

    if (interaction.mode === 'move') {
      const starts = Object.values(interaction.startTransforms);
      const minDx = Math.max(...starts.map((item) => -item.x));
      const maxDx = Math.min(...starts.map((item) => scene.width - item.x - item.width));
      const minDy = Math.max(...starts.map((item) => -item.y));
      const maxDy = Math.min(...starts.map((item) => scene.height - item.y - item.height));
      dx = clamp(dx, minDx, maxDx); dy = clamp(dy, minDy, maxDy);
      const snappedX = snapValue(primary.x + dx); const snappedY = snapValue(primary.y + dy);
      dx = snappedX - primary.x; dy = snappedY - primary.y;
      for (const [id, start] of Object.entries(interaction.startTransforms)) nextTransforms[id] = { ...start, x: start.x + dx, y: start.y + dy };
      const nextPrimary = nextTransforms[interaction.objectId];
      const vertical = Math.abs(nextPrimary.x + nextPrimary.width / 2 - scene.width / 2) <= 8 / zoom;
      const horizontal = Math.abs(nextPrimary.y + nextPrimary.height / 2 - scene.height / 2) <= 8 / zoom;
      setGuides({ vertical, horizontal });
    } else {
      const next = { ...primary }; const minSize = 32; const mode = interaction.mode;
      if (mode.includes('e')) next.width = snapValue(clamp(primary.width + dx, minSize, scene.width - primary.x));
      if (mode.includes('s')) next.height = snapValue(clamp(primary.height + dy, minSize, scene.height - primary.y));
      if (mode.includes('w')) { const right = primary.x + primary.width; next.x = snapValue(clamp(primary.x + dx, 0, right - minSize)); next.width = snapValue(Math.max(minSize, right - next.x)); }
      if (mode.includes('n')) { const bottom = primary.y + primary.height; next.y = snapValue(clamp(primary.y + dy, 0, bottom - minSize)); next.height = snapValue(Math.max(minSize, bottom - next.y)); }
      nextTransforms[interaction.objectId] = next;
      setGuides({ vertical: false, horizontal: false });
    }
    previewObjectTransforms(nextTransforms);
  };

  const finishInteraction = (event: ReactPointerEvent<HTMLDivElement>) => { if (!interaction || event.pointerId !== interaction.pointerId) return; commitTransformPreview(interaction.beforeProject); setInteraction(null); setGuides({ vertical: false, horizontal: false }); };
  const cancelInteraction = (event: ReactPointerEvent<HTMLDivElement>) => { if (!interaction || event.pointerId !== interaction.pointerId) return; cancelTransformPreview(interaction.beforeProject); setInteraction(null); setGuides({ vertical: false, horizontal: false }); };

  return (
    <section className={`canvas-area ${gridEnabled ? 'grid-enabled' : ''}`} onClick={() => selectObject(null)}>
      <div className="canvas-scroll"><div className={`scene-canvas ${interaction ? 'is-transforming' : ''}`} style={{ width: scene.width * zoom, height: scene.height * zoom }} onPointerMove={updateInteraction} onPointerUp={finishInteraction} onPointerCancel={cancelInteraction}>
        <div className="scene-canvas-label"><strong>{scene.name}</strong><span>{scene.width} × {scene.height}</span></div>
        {guides.vertical && <div className="alignment-guide vertical" />}{guides.horizontal && <div className="alignment-guide horizontal" />}
        {scene.objects.length === 0 && <div className="empty-scene"><span>Área vazia</span><small>Use as ferramentas para construir esta cena.</small></div>}
        {scene.objects.filter((object) => object.visible).map((object) => {
          const selected = selectedObjectIds.includes(object.id); const primary = selectedObjectId === object.id;
          return <div key={object.id} className={`canvas-object ${selected ? 'selected' : ''} ${primary ? 'primary-selected' : ''} ${object.locked ? 'locked' : ''}`} style={{ left: object.transform.x * zoom, top: object.transform.y * zoom, width: object.transform.width * zoom, height: object.transform.height * zoom, transform: `rotate(${object.transform.rotation}deg)` }} onPointerDown={(event) => startInteraction(event, object, 'move')} onClick={(event) => event.stopPropagation()} title={object.name} role="button" tabIndex={0}>
            <span className="object-symbol">{symbols[object.type] ?? '■'}</span><small>{object.name}</small>
            {primary && selectedObjectIds.length === 1 && !object.locked && handles.map((handle) => <span key={handle} className={`resize-handle handle-${handle}`} onPointerDown={(event) => startInteraction(event, object, handle)} />)}
            {primary && <span className="object-size">{selectedObjectIds.length > 1 ? `${selectedObjectIds.length} objetos` : `${Math.round(object.transform.width)} × ${Math.round(object.transform.height)}`}</span>}
          </div>;
        })}
      </div></div>
      <div className="zoom-control"><button onClick={() => setZoom(zoom - 0.1)}>−</button><input aria-label="Zoom" type="range" min="0.2" max="1.2" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /><button onClick={() => setZoom(zoom + 0.1)}>＋</button></div>
    </section>
  );
}