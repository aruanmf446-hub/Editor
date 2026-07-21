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
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        const state = useEditorStore.getState();
        state.setSaveStatus('Salvando...');
        void saveProject(state.project)
          .then(() => state.setSaveStatus('Salvo'))
          .catch(() => state.setSaveStatus('Erro ao salvar'));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <main className="app-shell">
      <EditorHeader />
      <EditorToolbar />
      <section className="workspace">
        <ScenePanel />
        <EditorCanvas />
        <Inspector />
      </section>
      <Timeline />
      <StatusBar />
    </main>
  );
}
