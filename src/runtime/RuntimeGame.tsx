import { useEffect, useMemo, useRef, useState } from 'react';
import { useAssetStore } from '../state/assetStore';
import { useEditorStore } from '../state/editorStore';
import { RuntimeDebugOverlay } from './RuntimeDebugOverlay';
import { RuntimeInput } from './RuntimeInput';
import { RuntimeLoop } from './RuntimeLoop';
import { loadRuntimeProject } from './RuntimeProjectLoader';
import { updateRuntimeWorld } from './RuntimePhysics';
import { createRuntimePlatforms, createRuntimePlayer, type RuntimeWorld } from './RuntimeWorld';

type Props = { onExit: () => void };
type PauseReason = 'manual' | 'blur' | null;
type RuntimeLoadResult = ReturnType<typeof loadRuntimeProject> | { error: string };

export function RuntimeGame({ onExit }: Props) {
  const sourceProject = useEditorStore((state) => state.project);
  const assets = useAssetStore((state) => state.assets);
  const viewportRef = useRef<HTMLDivElement>(null);
  const loopRef = useRef<RuntimeLoop | null>(null);
  const worldRef = useRef<RuntimeWorld | null>(null);
  const [pauseReason, setPauseReason] = useState<PauseReason>(null);
  const [debug, setDebug] = useState(false);
  const [fps, setFps] = useState(0);
  const [, forceRender] = useState(0);

  const loadResult = useMemo<RuntimeLoadResult>(() => {
    try { return loadRuntimeProject(sourceProject); }
    catch (reason) { return { error: reason instanceof Error ? reason.message : 'Projeto inválido.' }; }
  }, [sourceProject]);

  const urls = useMemo(() => {
    const map: Record<string, string> = {};
    if ('error' in loadResult) return map;
    const used = new Set(loadResult.project.scenes.map((scene) => scene.backgroundAssetId).filter((id): id is string => Boolean(id)));
    for (const asset of assets) if (used.has(asset.id) && asset.mimeType.startsWith('image/')) map[asset.id] = URL.createObjectURL(asset.blob);
    return map;
  }, [assets, loadResult]);

  useEffect(() => () => Object.values(urls).forEach(URL.revokeObjectURL), [urls]);

  useEffect(() => {
    if ('error' in loadResult) return;
    let disposed = false;
    const input = new RuntimeInput();
    input.start();
    const world: RuntimeWorld = {
      project: loadResult.project,
      scene: loadResult.initialScene,
      player: createRuntimePlayer(loadResult.spawn),
      platforms: createRuntimePlatforms(loadResult.initialScene),
      camera: { x: 0, y: 0, viewportWidth: 960, viewportHeight: 540 },
      input: input.state,
      paused: false,
      completed: false,
    };
    worldRef.current = world;
    let renderTimer = 0;
    const loop = new RuntimeLoop((frame) => {
      if (disposed || world.paused) return;
      updateRuntimeWorld(world, frame.delta);
      renderTimer += frame.delta;
      if (renderTimer >= 1 / 30) {
        renderTimer = 0;
        setFps(frame.fps);
        forceRender((value) => value + 1);
      }
    });
    loop.start(); loopRef.current = loop;
    const onBlur = () => setPauseReason((current) => current ?? 'blur');
    window.addEventListener('blur', onBlur);
    return () => {
      disposed = true;
      window.removeEventListener('blur', onBlur);
      loop.stop(); input.stop();
      loopRef.current = null; worldRef.current = null;
    };
  }, [loadResult]);

  useEffect(() => {
    const paused = pauseReason !== null;
    loopRef.current?.setPaused(paused);
    if (worldRef.current) worldRef.current.paused = paused;
  }, [pauseReason]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || 'error' in loadResult) return;
    const update = () => {
      if (!worldRef.current) return;
      worldRef.current.camera.viewportWidth = viewport.clientWidth;
      worldRef.current.camera.viewportHeight = viewport.clientHeight;
    };
    update();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(viewport);
    return () => observer?.disconnect();
  }, [loadResult]);

  if ('error' in loadResult) return <section className="runtime-error"><h2>Não foi possível iniciar o teste</h2><pre>{loadResult.error}</pre><button onClick={onExit}>Voltar ao editor</button></section>;

  const scene = worldRef.current?.scene ?? loadResult.initialScene;
  const player = worldRef.current?.player ?? createRuntimePlayer(loadResult.spawn);
  const camera = worldRef.current?.camera ?? { x: 0, y: 0, viewportWidth: 960, viewportHeight: 540 };
  const background = scene.background ?? { fit: 'cover', positionX: 50, positionY: 50, scale: 1, editorOpacity: 1 };
  const backgroundUrl = scene.backgroundAssetId ? urls[scene.backgroundAssetId] : undefined;
  const objectFit = background.fit === 'stretch' ? 'fill' : background.fit === 'original' ? 'none' : background.fit;

  return <section className="runtime-game">
    <div className="runtime-hud"><span>Vida {player.health}</span><span>Ataque {player.attack}</span><span>Defesa {player.defense}</span><span>{scene.name}</span><button onClick={() => setPauseReason((value) => value ? null : 'manual')}>{pauseReason ? 'Continuar' : 'Pausar'}</button><button onClick={() => setDebug((value) => !value)}>Debug</button><button onClick={onExit}>Sair</button></div>
    <div ref={viewportRef} className="runtime-viewport"><div className="runtime-world" style={{ width: scene.width, height: scene.height, transform: `translate(${-camera.x}px, ${-camera.y}px)` }}>
      {backgroundUrl && <img className="runtime-background" src={backgroundUrl} alt="" style={{ objectFit, objectPosition: `${background.positionX}% ${background.positionY}%`, transform: `scale(${background.scale})` }} />}
      {scene.objects.filter((object) => object.visible && !object.editorOnly && object.type !== 'player-spawn').map((object) => <div key={object.id} className={`runtime-entity runtime-${object.type}`} style={{ left: object.transform.x, top: object.transform.y, width: object.transform.width, height: object.transform.height }}><span>{object.name}</span></div>)}
      <div className={`runtime-player ${player.crouching ? 'crouching' : ''}`} style={{ left: player.x, top: player.y, width: player.width, height: player.height }}><span>🔥</span></div>
    </div></div>
    {pauseReason && <div className="runtime-pause"><h2>Teste pausado</h2><button onClick={() => setPauseReason(null)}>Continuar</button><button onClick={onExit}>Sair do teste</button></div>}
    {debug && <RuntimeDebugOverlay fps={fps} scene={scene.name} cameraX={camera.x} cameraY={camera.y} entityCount={scene.objects.length} />}
  </section>;
}
