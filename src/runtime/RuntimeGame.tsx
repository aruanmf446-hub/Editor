import { useEffect, useMemo, useRef, useState } from 'react';
import { useAssetStore } from '../state/assetStore';
import { useEditorStore } from '../state/editorStore';
import { RuntimeDebugOverlay } from './RuntimeDebugOverlay';
import { RuntimeInput } from './RuntimeInput';
import { RuntimeLoop } from './RuntimeLoop';
import { loadRuntimeProject } from './RuntimeProjectLoader';

type Props = { onExit: () => void };

type RuntimeLoadResult = ReturnType<typeof loadRuntimeProject> | { error: string };

export function RuntimeGame({ onExit }: Props) {
  const sourceProject = useEditorStore((state) => state.project);
  const assets = useAssetStore((state) => state.assets);
  const [paused, setPaused] = useState(false);
  const [debug, setDebug] = useState(false);
  const [fps, setFps] = useState(0);
  const loopRef = useRef<RuntimeLoop | null>(null);

  const loadResult = useMemo<RuntimeLoadResult>(() => {
    try { return loadRuntimeProject(sourceProject); }
    catch (reason) { return { error: reason instanceof Error ? reason.message : 'Projeto inválido.' }; }
  }, [sourceProject]);

  const urls = useMemo(() => {
    const map: Record<string, string> = {};
    for (const asset of assets) if (asset.mimeType.startsWith('image/')) map[asset.id] = URL.createObjectURL(asset.blob);
    return map;
  }, [assets]);

  useEffect(() => () => Object.values(urls).forEach(URL.revokeObjectURL), [urls]);

  useEffect(() => {
    if ('error' in loadResult) return;
    const input = new RuntimeInput();
    input.start();
    let fpsTimer = 0;
    const loop = new RuntimeLoop((frame) => {
      fpsTimer += frame.delta;
      if (fpsTimer >= .25) { fpsTimer = 0; setFps(frame.fps); }
    });
    loop.start(); loopRef.current = loop;
    const onBlur = () => setPaused(true);
    window.addEventListener('blur', onBlur);
    return () => { window.removeEventListener('blur', onBlur); loop.stop(); input.stop(); loopRef.current = null; };
  }, [loadResult]);

  useEffect(() => { loopRef.current?.setPaused(paused); }, [paused]);

  if ('error' in loadResult) return <section className="runtime-error"><h2>Não foi possível iniciar o teste</h2><pre>{loadResult.error}</pre><button onClick={onExit}>Voltar ao editor</button></section>;

  const snapshot = loadResult;
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
