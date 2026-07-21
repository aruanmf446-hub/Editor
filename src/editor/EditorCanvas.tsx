import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useAssetStore } from '../state/assetStore';
import { useEditorStore } from '../state/editorStore';
import type { ElFuegoProject, ProjectScene, SceneObjectBase, Transform2D } from '../types/project';
import { calculateFitZoom } from './calculateFitZoom';
import { getSelectionIntersection, normalizeRect, pointerToScene } from './selectionGeometry';

const symbols: Record<string, string> = { 'player-spawn': '🔥', finish: '🏁', checkpoint: '⚑', platform: '▬', wall: '▮', 'drop-zone': '⌄', 'no-collision-zone': '◇', 'pickup-health': '♥', 'pickup-attack': '⚔', 'pickup-defense': '◆', 'enemy-cactus': '🌵', boss: '♛', decoration: '◆', obstacle: '▰', trigger: '◎', 'dialogue-zone': '💬', collectible: '✦' };
type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
type Interaction = { sceneId: string; objectId: string; objectIds: string[]; mode: 'move' | ResizeHandle; pointerId: number; startX: number; startY: number; startTransforms: Record<string, Transform2D>; beforeProject: ElFuegoProject };
type SelectionBox = { sceneId: string; pointerId: number; startX: number; startY: number; x: number; y: number; width: number; height: number; additive: boolean };
const handles: ResizeHandle[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

type EditorCanvasProps = { testMode?: boolean };

export function EditorCanvas({ testMode = false }: EditorCanvasProps) {
  const store = useEditorStore();
  const assets = useAssetStore((state) => state.assets);
  const areaRef = useRef<HTMLElement>(null);
  const [interaction, setInteraction] = useState<Interaction | null>(null);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [guides, setGuides] = useState({ vertical: false, horizontal: false });
  const [areaHeight, setAreaHeight] = useState(720);
  const maxSceneHeight = Math.max(...store.project.scenes.map((scene) => scene.height), 1);
  const totalSceneWidth = store.project.scenes.reduce((sum, scene) => sum + scene.width, 0);

  const backgroundUrls = useMemo(() => {
    const urls: Record<string, string> = {};
    for (const asset of assets) if (asset.mimeType.startsWith('image/')) urls[asset.id] = URL.createObjectURL(asset.blob);
    return urls;
  }, [assets]);

  useEffect(() => () => { Object.values(backgroundUrls).forEach(URL.revokeObjectURL); }, [backgroundUrls]);

  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    let frame = 0;
    const selected = store.project.scenes.find((scene) => scene.id === store.selectedSceneId) ?? store.project.scenes[0];
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setAreaHeight(Math.max(1, area.clientHeight));
        if (!testMode && selected) {
          store.setZoom(calculateFitZoom({ availableWidth: area.clientWidth, availableHeight: area.clientHeight, sceneWidth: selected.width, sceneHeight: selected.height }));
        }
      });
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(area);
    document.addEventListener('fullscreenchange', measure);
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); document.removeEventListener('fullscreenchange', measure); };
  }, [store, testMode]);

  const snap = (value: number) => store.project.settings.snapEnabled ? Math.round(value / store.project.settings.gridSize) * store.project.settings.gridSize : Math.round(value);

  const startObject = (event: ReactPointerEvent<HTMLElement>, scene: ProjectScene, object: SceneObjectBase, mode: 'move' | ResizeHandle) => {
    if (testMode) return;
    event.preventDefault(); event.stopPropagation();
    if (store.selectedSceneId !== scene.id) store.selectScene(scene.id);
    const additive = event.ctrlKey || event.metaKey || event.shiftKey;
    if (additive && mode === 'move') { store.selectObject(object.id, true); return; }
    if (object.locked) { store.selectObject(object.id); return; }
    const ids = mode === 'move' && store.selectedObjectIds.includes(object.id) && store.selectedObjectIds.length > 1 ? store.selectedObjectIds : [object.id];
    if (!store.selectedObjectIds.includes(object.id)) store.selectObject(object.id);
    const startTransforms = Object.fromEntries(scene.objects.filter((item) => ids.includes(item.id)).map((item) => [item.id, { ...item.transform }]));
    event.currentTarget.setPointerCapture(event.pointerId);
    setInteraction({ sceneId: scene.id, objectId: object.id, objectIds: ids, mode, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, startTransforms, beforeProject: structuredClone(store.project) });
  };

  const beginSelection = (event: ReactPointerEvent<HTMLDivElement>, scene: ProjectScene) => {
    if (testMode || event.target !== event.currentTarget) return;
    event.preventDefault();
    if (store.selectedSceneId !== scene.id) store.selectScene(scene.id);
    const point = pointerToScene(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect(), store.zoom, scene.width, scene.height);
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectionBox({ sceneId: scene.id, pointerId: event.pointerId, startX: point.x, startY: point.y, x: point.x, y: point.y, width: 0, height: 0, additive: event.ctrlKey || event.metaKey || event.shiftKey });
  };

  const move = (event: ReactPointerEvent<HTMLDivElement>, scene: ProjectScene) => {
    if (selectionBox && selectionBox.sceneId === scene.id && event.pointerId === selectionBox.pointerId) {
      const point = pointerToScene(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect(), store.zoom, scene.width, scene.height);
      setSelectionBox({ ...selectionBox, ...normalizeRect(selectionBox.startX, selectionBox.startY, point.x, point.y) });
      return;
    }
    if (!interaction || interaction.sceneId !== scene.id || event.pointerId !== interaction.pointerId) return;
    let dx = (event.clientX - interaction.startX) / store.zoom;
    let dy = (event.clientY - interaction.startY) / store.zoom;
    const primary = interaction.startTransforms[interaction.objectId];
    if (!primary) return;
    const next: Record<string, Transform2D> = {};
    if (interaction.mode === 'move') {
      const starts = Object.values(interaction.startTransforms);
      dx = clamp(dx, Math.max(...starts.map((item) => -item.x)), Math.min(...starts.map((item) => scene.width - item.x - item.width)));
      dy = clamp(dy, Math.max(...starts.map((item) => -item.y)), Math.min(...starts.map((item) => scene.height - item.y - item.height)));
      dx = snap(primary.x + dx) - primary.x; dy = snap(primary.y + dy) - primary.y;
      for (const [id, transform] of Object.entries(interaction.startTransforms)) next[id] = { ...transform, x: transform.x + dx, y: transform.y + dy };
      const current = next[interaction.objectId];
      setGuides({ vertical: Math.abs(current.x + current.width / 2 - scene.width / 2) <= 8 / store.zoom, horizontal: Math.abs(current.y + current.height / 2 - scene.height / 2) <= 8 / store.zoom });
    } else {
      const transform = { ...primary }, mode = interaction.mode, min = 32;
      if (mode.includes('e')) transform.width = snap(clamp(primary.width + dx, min, scene.width - primary.x));
      if (mode.includes('s')) transform.height = snap(clamp(primary.height + dy, min, scene.height - primary.y));
      if (mode.includes('w')) { const right = primary.x + primary.width; transform.x = snap(clamp(primary.x + dx, 0, right - min)); transform.width = snap(Math.max(min, right - transform.x)); }
      if (mode.includes('n')) { const bottom = primary.y + primary.height; transform.y = snap(clamp(primary.y + dy, 0, bottom - min)); transform.height = snap(Math.max(min, bottom - transform.y)); }
      next[interaction.objectId] = transform;
      setGuides({ vertical: false, horizontal: false });
    }
    store.previewObjectTransforms(next);
  };

  const finish = (event: ReactPointerEvent<HTMLDivElement>, scene: ProjectScene) => {
    if (selectionBox && selectionBox.sceneId === scene.id && event.pointerId === selectionBox.pointerId) {
      const hit = getSelectionIntersection(scene.objects, selectionBox);
      useEditorStore.setState((state) => {
        const ids = selectionBox.additive ? Array.from(new Set([...state.selectedObjectIds, ...hit])) : hit;
        return { selectedObjectIds: ids, selectedObjectId: ids.at(-1) ?? null };
      });
      setSelectionBox(null); return;
    }
    if (!interaction || interaction.sceneId !== scene.id || event.pointerId !== interaction.pointerId) return;
    store.commitTransformPreview(interaction.beforeProject); setInteraction(null); setGuides({ vertical: false, horizontal: false });
  };

  const cancel = (event: ReactPointerEvent<HTMLDivElement>, scene: ProjectScene) => {
    if (selectionBox && selectionBox.sceneId === scene.id && event.pointerId === selectionBox.pointerId) { setSelectionBox(null); return; }
    if (!interaction || interaction.sceneId !== scene.id || event.pointerId !== interaction.pointerId) return;
    store.cancelTransformPreview(interaction.beforeProject); setInteraction(null); setGuides({ vertical: false, horizontal: false });
  };

  const zoom = testMode ? Math.min(1, Math.max(0.2, areaHeight / maxSceneHeight)) : store.zoom;

  return <section ref={areaRef} className={`canvas-area sequence-canvas-area ${store.gridEnabled && !testMode ? 'grid-enabled' : ''} ${testMode ? 'test-mode-canvas' : ''}`}>
    {testMode && <div className="test-mode-banner"><strong>Modo Testar</strong><span>Prévia contínua do plano-sequência · pressione Esc para voltar</span></div>}
    <div className="canvas-scroll sequence-scroll">
      <div className="scene-sequence-canvas" style={{ width: totalSceneWidth * zoom, height: maxSceneHeight * zoom }}>
        {store.project.scenes.map((scene, sceneIndex) => {
          const background = scene.background ?? { fit: 'cover', positionX: 50, positionY: 50, scale: 1, editorOpacity: 1 };
          const backgroundUrl = scene.backgroundAssetId ? backgroundUrls[scene.backgroundAssetId] : undefined;
          const objectFit = background.fit === 'stretch' ? 'fill' : background.fit === 'original' ? 'none' : background.fit;
          return <div key={scene.id} className={`scene-canvas sequence-scene ${scene.id === store.selectedSceneId ? 'active-sequence-scene' : ''}`} style={{ width: scene.width * zoom, height: scene.height * zoom }} onPointerDown={(event) => beginSelection(event, scene)} onPointerMove={(event) => move(event, scene)} onPointerUp={(event) => finish(event, scene)} onPointerCancel={(event) => cancel(event, scene)}>
            {backgroundUrl && <img className="scene-background" src={backgroundUrl} alt="" draggable={false} style={{ objectFit, objectPosition: `${background.positionX}% ${background.positionY}%`, opacity: testMode ? 1 : background.editorOpacity, transform: `scale(${background.scale})` }} />}
            {!testMode && <div className="sequence-scene-label"><span>{sceneIndex + 1}</span><strong>{scene.name}</strong></div>}
            {!testMode && scene.id === store.selectedSceneId && guides.vertical && <div className="alignment-guide vertical" />}
            {!testMode && scene.id === store.selectedSceneId && guides.horizontal && <div className="alignment-guide horizontal" />}
            {!testMode && selectionBox?.sceneId === scene.id && <div className="selection-marquee" style={{ left: selectionBox.x * zoom, top: selectionBox.y * zoom, width: selectionBox.width * zoom, height: selectionBox.height * zoom }} />}
            {!backgroundUrl && scene.objects.length === 0 && <div className="empty-scene"><span>Área vazia</span><small>Importe um cenário ou adicione objetos.</small></div>}
            {scene.objects.filter((object) => object.visible && (!testMode || !object.editorOnly)).map((object, index) => {
              const selected = !testMode && store.selectedObjectIds.includes(object.id);
              const primary = !testMode && store.selectedObjectId === object.id;
              return <div key={object.id} className={`canvas-object object-${object.type} ${selected ? 'selected' : ''} ${primary ? 'primary-selected' : ''} ${object.locked ? 'locked' : ''} ${testMode ? 'runtime-preview-object' : ''}`} style={{ left: object.transform.x * zoom, top: object.transform.y * zoom, width: object.transform.width * zoom, height: object.transform.height * zoom, transform: `rotate(${object.transform.rotation}deg)`, zIndex: index + 2 }} onPointerDown={(event) => startObject(event, scene, object, 'move')} onClick={(event) => event.stopPropagation()} title={object.name}>
                <span className="object-symbol">{symbols[object.type] ?? '■'}</span><small>{object.name}</small>
                {!testMode && object.assetId && store.project.assets.find((asset) => asset.id === object.assetId)?.category === 'model' && <em className="model-placeholder">Modelo vinculado · prévia 3D pendente</em>}
                {primary && store.selectedObjectIds.length === 1 && !object.locked && handles.map((handle) => <span key={handle} className={`resize-handle handle-${handle}`} onPointerDown={(event) => startObject(event, scene, object, handle)} />)}
                {primary && <span className="object-size">{store.selectedObjectIds.length > 1 ? `${store.selectedObjectIds.length} objetos` : `${Math.round(object.transform.width)} × ${Math.round(object.transform.height)}`}</span>}
              </div>;
            })}
          </div>;
        })}
      </div>
    </div>
    {!testMode && <div className="zoom-control"><button onClick={() => store.setZoom(store.zoom - .1)}>−</button><input aria-label="Zoom" type="range" min="0.1" max="2" step="0.05" value={store.zoom} onChange={(event) => store.setZoom(Number(event.target.value))} /><button onClick={() => store.setZoom(store.zoom + .1)}>＋</button></div>}
  </section>;
}
