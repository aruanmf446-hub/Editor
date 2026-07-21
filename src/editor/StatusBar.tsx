import { useEditorStore } from '../state/editorStore';

export function StatusBar() {
  const { saveStatus, project, selectedSceneId, zoom } = useEditorStore();
  const scene = project.scenes.find((item) => item.id === selectedSceneId);
  return (
    <footer className="statusbar">
      <span>{saveStatus}</span>
      <span>{scene?.name ?? 'Sem cena'} · {Math.round(zoom * 100)}% · IndexedDB · .elfuego · Zod</span>
    </footer>
  );
}
