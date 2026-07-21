import { useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useEditorStore } from '../state/editorStore';
import type { ElFuegoProject, SceneObjectBase, Transform2D } from '../types/project';

const symbols: Record<string, string> = { decoration: '◆', obstacle: '▰', checkpoint: '⚑', trigger: '◎', collectible: '✦' };
type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
type Interaction = {
  objectId: string;
  mode: 'move' | ResizeHandle;
  pointerId: number;
  startX: number;
  startY: number;
  startTransform: Transform2D;
  beforeProject: ElFuegoProject;
};

type Guides = { vertical: boolean; horizontal: boolean };
const handles: ResizeHandle[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function EditorCanvas() {
  const {
    project, selectedSceneId, selectedObjectId, selectObject, zoom, setZoom, gridEnabled,
    previewObjectTransform, commitTransformPreview, cancelTransformPreview,
  } = useEditorStore();
  const [interaction, setInteraction] = useState<Interaction | null>(null);
  const [guides, setGuides] = useState<Guides>({ vertical: false, horizontal: false });
  const scene = project.scenes.find((item) => item.id === selectedSceneId) ?? project.scenes[0];

  const snapValue = (value: number) => {
    if (!project.settings.snapEnabled) return Math.round(value);
    return Math.round(value / project.settings.gridSize) * project.settings.gridSize;
  };

  const startInteraction = (
    event: ReactPointerEvent<HTMLElement>,
    object: SceneObjectBase,
    mode: 'move' | ResizeHandle,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (object.locked) return;
    selectObject(object.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    setInteraction({
      objectId: object.id,
      mode,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startTransform: { ...object.transform },
      beforeProject: structuredClone(project),
    });
  };

  const updateInteraction = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!interaction || event.pointerId !== interaction.pointerId) return;
    const dx = (event.clientX - interaction.startX) / zoom;
    const dy = (event.clientY - interaction.startY) / zoom;
    const start = interaction.startTransform;
    const next = { ...start };
    const minSize = 32;

    if (interaction.mode === 'move') {
      next.x = snapValue(clamp(start.x + dx, 0, Math.max(0, scene.width - start.width)));
      next.y = snapValue(clamp(start.y + dy, 0, Math.max(0, scene.height - start.height)));
    } else {
      const east = interaction.mode.includes('e');
      const west = interaction.mode.includes('w');
      const north = interaction.mode.includes('n');
      const south = interaction.mode.includes('s');

      if (east) next.width = snapValue(clamp(start.width + dx, minSize, scene.width - start.x));
      if (south) next.height = snapValue(clamp(start.height + dy, minSize, scene.height - start.y));
      if (west) {
        const right = start.x + start.width;
        next.x = snapValue(clamp(start.x + dx, 0, right - minSize));
        next.width = snapValue(Math.max(minSize, right - next.x));
      }
      if (north) {
        const bottom = start.y + start.height;
        next.y = snapValue(clamp(start.y + dy, 0, bottom - minSize));
        next.height = snapValue(Math.max(minSize, bottom - next.y));
      }
    }

    const centerX = next.x + next.width / 2;
    const centerY = next.y + next.height / 2;
    const guideTolerance = 8 / zoom;
    const vertical = Math.abs(centerX - scene.width / 2) <= guideTolerance;
    const horizontal = Math.abs(centerY - scene.height / 2) <= guideTolerance;
    if (vertical && interaction.mode === 'move') next.x = snapValue(scene.width / 2 - next.width / 2);
    if (horizontal && interaction.mode === 'move') next.y = snapValue(scene.height / 2 - next.height / 2);

    setGuides({ vertical, horizontal });
    previewObjectTransform(interaction.objectId, next);
  };

  const finishInteraction = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!interaction || event.pointerId !== interaction.pointerId) return;
    commitTransformPreview(interaction.beforeProject);
    setInteraction(null);
    setGuides({ vertical: false, horizontal: false });
  };

  const cancelInteraction = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!interaction || event.pointerId !== interaction.pointerId) return;
    cancelTransformPreview(interaction.beforeProject);
    setInteraction(null);
    setGuides({ vertical: false, horizontal: false });
  };

  return (
    <section className={`canvas-area ${gridEnabled ? 'grid-enabled' : ''}`} onClick={() => selectObject(null)}>
      <div className="canvas-scroll">
        <div
          className={`scene-canvas ${interaction ? 'is-transforming' : ''}`}
          style={{ width: scene.width * zoom, height: scene.height * zoom }}
          aria-label={`Canvas da cena ${scene.name}`}
          onPointerMove={updateInteraction}
          onPointerUp={finishInteraction}
          onPointerCancel={cancelInteraction}
        >
          <div className="scene-canvas-label"><strong>{scene.name}</strong><span>{scene.width} × {scene.height}</span></div>
          {guides.vertical && <div className="alignment-guide vertical" />}
          {guides.horizontal && <div className="alignment-guide horizontal" />}
          {scene.objects.length === 0 && <div className="empty-scene"><span>Área vazia</span><small>Use as ferramentas para construir esta cena.</small></div>}
          {scene.objects.filter((object) => object.visible).map((object) => {
            const selected = selectedObjectId === object.id;
            return (
              <div
                key={object.id}
                className={`canvas-object ${selected ? 'selected' : ''} ${object.locked ? 'locked' : ''}`}
                style={{
                  left: object.transform.x * zoom,
                  top: object.transform.y * zoom,
                  width: object.transform.width * zoom,
                  height: object.transform.height * zoom,
                  transform: `rotate(${object.transform.rotation}deg)`,
                }}
                onPointerDown={(event) => startInteraction(event, object, 'move')}
                onClick={(event) => { event.stopPropagation(); selectObject(object.id); }}
                title={object.name}
                role="button"
                tabIndex={0}
              >
                <span className="object-symbol">{symbols[object.type] ?? '■'}</span>
                <small>{object.name}</small>
                {selected && !object.locked && handles.map((handle) => (
                  <span
                    key={handle}
                    className={`resize-handle handle-${handle}`}
                    onPointerDown={(event) => startInteraction(event, object, handle)}
                    aria-hidden="true"
                  />
                ))}
                {selected && <span className="object-size">{Math.round(object.transform.width)} × {Math.round(object.transform.height)}</span>}
              </div>
            );
          })}
        </div>
      </div>
      <div className="zoom-control"><button onClick={() => setZoom(zoom - 0.1)}>−</button><input aria-label="Zoom" type="range" min="0.2" max="1.2" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /><button onClick={() => setZoom(zoom + 0.1)}>＋</button></div>
    </section>
  );
}