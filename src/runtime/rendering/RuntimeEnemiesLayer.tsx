import { useEffect, useRef } from 'react';
import { RUNTIME_CONFIG } from '../RuntimeConfig';
import type { RuntimeEnemyState } from '../RuntimeEnemy';
import type { RuntimeWorld } from '../RuntimeWorld';

function enemyLabel(enemy: RuntimeEnemyState): string {
  const phase = enemy.kind === 'boss' ? `Fase ${enemy.phase} · ` : '';
  return `${phase}${enemy.visualState}`;
}

export function RuntimeEnemiesLayer({ world }: { world: RuntimeWorld }) {
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
        node.style.display = enemy.removed ? 'none' : 'flex';
        const x = enemy.renderPreviousX + (enemy.x - enemy.renderPreviousX) * alpha;
        const y = enemy.renderPreviousY + (enemy.y - enemy.renderPreviousY) * alpha;
        node.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        node.dataset.state = enemy.visualState;
        node.dataset.direction = enemy.direction;
        node.dataset.phase = String(enemy.phase);
        const stateLabel = node.querySelector<HTMLElement>('[data-enemy-state]');
        const nextLabel = enemyLabel(enemy);
        if (stateLabel && stateLabel.textContent !== nextLabel) stateLabel.textContent = nextLabel;
        const health = node.querySelector<HTMLElement>('[data-enemy-health]');
        if (health) health.style.width = `${Math.max(0, enemy.health / enemy.maxHealth) * 100}%`;
      }
      frameId = requestAnimationFrame(render);
    };

    frameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return <>
    {world.enemies.filter((enemy) => !enemy.removed).map((enemy) => (
      <div
        key={enemy.id}
        ref={(node) => {
          if (node) nodesRef.current.set(enemy.id, node);
          else nodesRef.current.delete(enemy.id);
        }}
        className={`runtime-entity runtime-enemy-live runtime-${enemy.kind}`}
        data-state={enemy.visualState}
        data-direction={enemy.direction}
        data-phase={enemy.phase}
        style={{ left: 0, top: 0, width: enemy.width, height: enemy.height }}
      >
        <div className="runtime-enemy-health"><i data-enemy-health style={{ width: `${enemy.health / enemy.maxHealth * 100}%` }} /></div>
        <span aria-hidden="true">{enemy.kind === 'boss' ? '🌶️' : '🌵'}</span>
        <small data-enemy-state>{enemyLabel(enemy)}</small>
      </div>
    ))}
  </>;
}
