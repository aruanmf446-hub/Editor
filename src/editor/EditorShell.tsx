import { useEffect } from 'react';
import { saveProject } from '../persistence/projectRepository';
import { useEditorStore } from '../state/editorStore';
import { EditorCanvas } from './EditorCanvas';
import { EditorHeader } from './EditorHeader';
import { EditorToolbar } from './EditorToolbar';
import { Inspector } from './Inspector';
import { ScenePanel } from './ScenePanel';
import { StatusBar } from './StatusBar';
import { Timeline } from './Timeline';

export function EditorShell() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const state = useEditorStore.getState();
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === 's') {
        event.preventDefault();
        state.setSaveStatus('Salvando...');
        void saveProject(state.project).then(() => state.setSaveStatus('Salvo')).catch(() => state.setSaveStatus('Erro ao salvar'));
      } else if ((event.ctrlKey || event.metaKey) && key === 'z') {
        event.preventDefault(); event.shiftKey ? state.redo() : state.undo();
      } else if ((event.ctrlKey || event.metaKey) && key === 'y') {
        event.preventDefault(); state.redo();
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && state.selectedObjectId && !(event.target instanceof HTMLInputElement)) {
        event.preventDefault(); state.deleteObject(state.selectedObjectId);
      } else if (state.selectedObjectId && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key) && !(event.target instanceof HTMLInputElement)) {
        event.preventDefault();
        const object = state.project.scenes.flatMap((scene) => scene.objects).find((item) => item.id === state.selectedObjectId);
        if (!object || object.locked) return;
        const amount = event.shiftKey ? 10 : 1;
        const dx = event.key === 'ArrowLeft' ? -amount : event.key === 'ArrowRight' ? amount : 0;
        const dy = event.key === 'ArrowUp' ? -amount : event.key === 'ArrowDown' ? amount : 0;
        state.updateObject(object.id, { transform: { ...object.transform, x: object.transform.x + dx, y: object.transform.y + dy } });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return <main className="app-shell"><EditorHeader /><EditorToolbar /><section className="workspace"><ScenePanel /><EditorCanvas /><Inspector /></section><Timeline /><StatusBar /></main>;
}