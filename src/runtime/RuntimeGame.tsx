import { useEffect, useMemo, useRef, useState } from 'react';
import { useAssetStore } from '../state/assetStore';
import { useEditorStore } from '../state/editorStore';
import { RuntimeDebugOverlay } from './RuntimeDebugOverlay';
import { RuntimeInput } from './RuntimeInput';
import { RuntimeLoop } from './RuntimeLoop';
import { loadRuntimeProject } from './RuntimeProjectLoader';

type Props = { onExit: () => void };

export function RuntimeGame({ onExit }: Props) {
  const sourceProject = useEditorStore((state) => state.project);
  const assets = useAssetStore((state) => state.assets);
  const [paused, setPaused] = useState(false);
  const [debug, setDebug] = useState(false);
  const [fps, setFps] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<RuntimeInput | null>(null);
  const loopRef = useRef<RuntimeLoop | null>(null);

  const snapshot = useMemo(() => {
    try { setError(null); return loadRuntimeProject(sourceProject); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Projeto inválido.'); return null; }
  }, [sourceProject]);

  const urls = useMemo(() => {
    const map: Record<string, string> = {};
    for (const asset of assets) if (asset.mimeType.startsWith('image/')) map[asset.id] = URL.createObjectURL(asset.blob);
    return map;
  }, [assets]);

  useEffect(() => () => Object.values(urls).forEach(URL.revokeObjectURL), [urls]);

  useEffect(() => {
    if (!snapshot) return;
    const input = new RuntimeInput();
    input.start(); inputRef.current = input;
    const loop = new RuntimeLoop((frame) => setFps(frame.fps));
    loop.setPaused(paused); loop.start(); loopRef.current = loop;
    const onBlur = () => setPaused(true);
    window.addEventListener('blur', onBlur);
    return () => { window.removeEventListener('blur', onBlur); loop.stop(); input.stop(); loopRef.current = null; inputRef.current = null; };
  }, [snapshot]);

  useEffect(() => { loopRef.current?.setPaused(paused); }, [paused]);

  if (error || !snapshot) return <section className="runtime-error"><h2>Não foi possível iniciar o teste</h2><pre>{error}</pre><button onClick={onExit}>Voltar ao editor</button></section>;

  const scene = snapshot.initialScene;
  const background = scene.background ?? { fit: 'cover', positionX: 50, positionY: 50, scale: 1, editorOpacity: 1 };
  const backgroundUrl = scene.backgroundAssetId ? urls[scene.backgroundAssetId] : undefined;
  const objectFit = background.fit === 'stretch' ? 'fill' : background.fit === 'original' ? 'none' : background.fit;

  return <section className="runtime-game">
    <div className="runtime-hud"><span>Vida {snapshot.spawn.initialHealth ?? 3}</span><span>Ataque {snapshot.spawn.initialAttack ?? 1}</span><span>Defesa {snapshot.spawn.initialDefense ?? 1}</span><span>{scene.name}</span><button onClick={() => setPaused((value) => !value)}>{paused ? 'Continuar' : 'Pausar'}</button><button onClick={() => setDebug((value) => !value)}>Debug</button><button onClick={onExit}>Sair</button></div>
    <div className="runtime-viewport"><div className="runtime-world" style={{ width: scene.width, height: scene.height }}>
      {backgroundUrl && <img className="runtime-background" src={backgroundUrl} alt="" style={{ objectFit, objectPosition: `${background.positionX}% ${background.positionY}%`, transform: `scale(${background.scale})` }} />}
      {scene.objects.filter((object) => object.visible && !object.editorOnly).map((object) => <div key={object.id} className={`runtime-entity runtime-${object.type}`} style={{ left: object.transform.x, top: object.transform.y, width: object.transform.width, height: object.transform.height, transform: `rotate(${object.transform.rotation}deg)` }}><span>{object.name}</span></div>)}
    </div></div>
    {paused && <div className="runtime-pause"><h2>Teste pausado</h2><button onClick={() => setPaused(false)}>Continuar</button><button onClick={onExit}>Sair do teste</button></div>}
    {debug && <RuntimeDebugOverlay fps={fps} scene={scene.name} cameraX={0} cameraY={0} entityCount={scene.objects.length} />}
  </section>;
}
