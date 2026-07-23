import { useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useEditorStore } from '../state/editorStore';
import type { ProjectScene, SceneObjectBase } from '../types/project';

type HandleKind = 'patrol-left' | 'patrol-right' | 'vision';
type RangeValues = { left: number; right: number; vision: number };
type DragState = { kind: HandleKind; pointerId: number; startClientX: number; startLeft: number; startRight: number; startVision: number };
type PursuitVillain = SceneObjectBase<'enemy-cactus'> & { pursuitMode?: boolean };
type Props = { scene: ProjectScene; object: SceneObjectBase<'enemy-cactus'>; zoom: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function EnemyRangeHandles({ scene, object, zoom }: Props) {
  const updateObject = useEditorStore((state) => state.updateObject);
  const pursuitMode = Boolean((object as PursuitVillain).pursuitMode);
  const initial = useMemo<RangeValues>(() => {
    const maxX = Math.max(0, scene.width - object.transform.width);
    const left = clamp(object.patrolLeft ?? object.transform.x - 160, 0, maxX);
    const right = clamp(object.patrolRight ?? object.transform.x + 160, left, maxX);
    return { left, right, vision: Math.max(0, object.visionDistance ?? 420) };
  }, [object.patrolLeft, object.patrolRight, object.transform.width, object.transform.x, object.visionDistance, scene.width]);
  const [draft, setDraft] = useState<RangeValues>(initial);
  const [drag, setDrag] = useState<DragState | null>(null);
  const values = drag ? draft : initial;

  useEffect(() => {
    if (!drag) return;
    const move = (event: PointerEvent) => {
      if (event.pointerId !== drag.pointerId) return;
      const dx = (event.clientX - drag.startClientX) / Math.max(zoom, 0.01);
      if (drag.kind === 'patrol-left') setDraft((current) => ({ ...current, left: clamp(drag.startLeft + dx, 0, current.right) }));
      if (drag.kind === 'patrol-right') setDraft((current) => ({ ...current, right: clamp(drag.startRight + dx, current.left, Math.max(0, scene.width - object.transform.width)) }));
      if (drag.kind === 'vision') setDraft((current) => ({ ...current, vision: clamp(drag.startVision + dx, 0, scene.width) }));
    };
    const finish = (event: PointerEvent) => {
      if (event.pointerId !== drag.pointerId) return;
      const patch: Partial<SceneObjectBase> = {
        patrolLeft: draft.left,
        patrolRight: draft.right,
        visionDistance: draft.vision,
      };
      if (pursuitMode && drag.kind === 'vision') {
        const centerX = object.transform.x + object.transform.width / 2;
        const maxX = Math.max(0, scene.width - object.transform.width);
        const pursuitLeft = clamp(centerX - draft.vision, 0, maxX);
        patch.patrolLeft = pursuitLeft;
        patch.patrolRight = clamp(centerX + draft.vision - object.transform.width, pursuitLeft, maxX);
      }
      updateObject(object.id, patch);
      setDrag(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }, [drag, draft.left, draft.right, draft.vision, object.id, object.transform.width, object.transform.x, pursuitMode, scene.width, updateObject, zoom]);

  const begin = (kind: HandleKind) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraft(values);
    setDrag({ kind, pointerId: event.pointerId, startClientX: event.clientX, startLeft: values.left, startRight: values.right, startVision: values.vision });
  };

  const centerX = object.transform.x + object.transform.width / 2;
  const patrolY = Math.min(scene.height - 18, object.transform.y + object.transform.height + 24);
  const visionY = Math.max(20, object.transform.y - 22);
  return <div className="enemy-range-editor" aria-label="Limites do vilão">
    {!pursuitMode && <div className="enemy-patrol-line" style={{ left: values.left * zoom, top: patrolY * zoom, width: Math.max(1, values.right - values.left) * zoom }}>
      <span>Andar</span>
      <button type="button" className="enemy-range-handle left" style={{ left: 0 }} onPointerDown={begin('patrol-left')} aria-label="Arrastar limite esquerdo de caminhada do vilão" />
      <button type="button" className="enemy-range-handle right" style={{ right: 0 }} onPointerDown={begin('patrol-right')} aria-label="Arrastar limite direito de caminhada do vilão" />
    </div>}
    <div className="enemy-vision-line" style={{ left: Math.max(0, centerX - values.vision) * zoom, top: visionY * zoom, width: Math.min(scene.width, values.vision * 2) * zoom }}>
      <span>{pursuitMode ? 'Perseguição' : 'Visão'} {Math.round(values.vision)}</span>
      <i style={{ left: values.vision * zoom }} />
      <button type="button" className="enemy-range-handle vision" style={{ left: Math.min(scene.width - centerX, values.vision) * zoom + values.vision * zoom }} onPointerDown={begin('vision')} aria-label="Arrastar alcance de visão do vilão" />
    </div>
  </div>;
}
