import { useEffect, useState } from 'react';
import { saveProject } from '../persistence/projectRepository';
import { useEditorStore } from '../state/editorStore';
import { AssetLibrary } from './AssetLibrary';
import { EditorCanvas } from './EditorCanvas';
import { EditorHeader, type StudioMode } from './EditorHeader';
import { EditorToolbar } from './EditorToolbar';
import { Inspector } from './Inspector';
import { ObjectTree } from './ObjectTree';
import { ProblemsPanel } from './ProblemsPanel';
import { ScenePanel } from './ScenePanel';
import { StatusBar } from './StatusBar';
import { Timeline } from './Timeline';

const isTyping = (target: EventTarget | null) => target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;

export function EditorShell() {
  const [mode, setMode] = useState<StudioMode>('edit');

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const state = useEditorStore.getState();
      const key = event.key.toLowerCase();
      const command = event.ctrlKey || event.metaKey;
      if (event.key === 'Escape' && mode === 'test') {
        event.preventDefault(); setMode('edit'); return;
      }
      if (mode === 'test') return;
      if (command && key === 's') {
        event.preventDefault(); state.setSaveStatus('Salvando...');
        void saveProject(state.project).then(() => state.setSaveStatus('Salvo')).catch(() => state.setSaveStatus('Erro ao salvar'));
      } else if (command && key === 'z') {
        event.preventDefault(); if (event.shiftKey) state.redo(); else state.undo();
      } else if (command && key === 'y') {
        event.preventDefault(); state.redo();
      } else if (!isTyping(event.target) && command && key === 'a') {
        event.preventDefault(); state.selectAllObjects();
      } else if (!isTyping(event.target) && command && key === 'c') {
        event.preventDefault(); state.copySelected();
      } else if (!isTyping(event.target) && command && key === 'v') {
        event.preventDefault(); state.pasteClipboard();
      } else if (!isTyping(event.target) && command && key === 'd') {
        event.preventDefault(); state.duplicateSelected();
      } else if (!isTyping(event.target) && (event.key === 'Delete' || event.key === 'Backspace') && state.selectedObjectIds.length) {
        event.preventDefault(); state.deleteSelected();
      } else if (!isTyping(event.target) && state.selectedObjectIds.length && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        const amount = event.shiftKey ? 10 : 1;
        const dx = event.key === 'ArrowLeft' ? -amount : event.key === 'ArrowRight' ? amount : 0;
        const dy = event.key === 'ArrowUp' ? -amount : event.key === 'ArrowDown' ? amount : 0;
        state.moveSelected(dx, dy);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode]);

  return <main className={`app-shell mode-${mode}`}>
    <EditorHeader mode={mode} onModeChange={setMode} />
    {mode === 'edit' && <EditorToolbar />}
    <section className="workspace">
      {mode === 'edit' && <ScenePanel />}
      <div className="editor-columns">
        {mode === 'edit' && <div className="left-editor-stack"><ObjectTree /><AssetLibrary /></div>}
        <EditorCanvas testMode={mode === 'test'} />
        {mode === 'edit' && <div className="right-editor-stack"><Inspector /><ProblemsPanel /></div>}
      </div>
    </section>
    {mode === 'edit' && <Timeline />}
    <StatusBar />
  </main>;
}
