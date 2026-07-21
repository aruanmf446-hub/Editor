import { useEffect, useRef } from 'react';
import { RUNTIME_CONFIG } from '../RuntimeConfig';
import type { RuntimeWorld } from '../RuntimeWorld';

export function RuntimeEnemiesLayer({ world, modelReadyIds = new Set<string>() }: { world: RuntimeWorld; modelReadyIds?: ReadonlySet<string> }) {
  const worldRef = useRef(world);
  const nodesRef = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    worldRef.current = world;
  }, [world]);

  useEffect(() => {
    let frameId = 0;
    const render = () => {
      const currentWorld = worldRef.current;
      const alpha = RUNTIME_CONFIG.fixedStep > 0
        ? Math.min(1, Math.max(0, currentWorld.accumulator / RUNTIME_CONFIG.fixedStep))
        : 1;

      for (const enemy of currentWorld.enemies) {
        const node = nodesRef.current.get(enemy.id);
        if (!node) continue;
        const x = enemy.renderPreviousX + (enemy.x - enemy.renderPreviousX) * alpha;
        const y = enemy.renderPreviousY + (enemy.y - enemy.renderPreviousY) * alpha;
        node.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        node.style.display = enemy.removed || modelReadyIds.has(enemy.id) ? 'none' : 'flex';
        node.dataset.state = enemy.visualState;
        node.dataset.direction = enemy.direction;
        const stateLabel = node.querySelector<HTMLElement>('[data-enemy-state]');
        if (stateLabel && stateLabel.textContent !== enemy.visualState) stateLabel.textContent = enemy.visualState;
      }
      frameId = requestAnimationFrame(render);
    };

    frameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameId);
  }, [modelReadyIds]);

  return <>
    {world.enemies.map((enemy) => (
      <div
        key={enemy.id}
        ref={(node) => {
          if (node) nodesRef.current.set(enemy.id, node);
          else nodesRef.current.delete(enemy.id);
        }}
        className={`runtime-entity runtime-enemy-${enemy.kind} runtime-enemy-live`}
        data-state={enemy.visualState}
        data-direction={enemy.direction}
        style={{ left: 0, top: 0, width: enemy.width, height: enemy.height }}
      >
        <span aria-hidden="true">{enemy.kind === 'boss' ? '🌶️' : '🌵'}</span>
        <small data-enemy-state>{enemy.visualState}</small>
      </div>
    ))}
  </>;
}
