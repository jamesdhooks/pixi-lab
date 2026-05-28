import { useEffect, useId, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { fluidTankBareRuntimeScript } from './fluidTankBareRuntimeScript';

/**
 * Bare-metal port of the working fluids.html runtime.
 *
 * First parity layer: React owns the DOM and Pixi import, while the reference
 * simulation core remains intact. Reference controls/HUD are hidden compatibility
 * nodes only; Pixi Lab's own interface should be reintroduced above this layer.
 */
export function FluidTankBareRuntime() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const previousPixi = (window as typeof window & { PIXI?: typeof PIXI }).PIXI;
    (window as typeof window & { PIXI?: typeof PIXI }).PIXI = PIXI;

    const script = document.createElement('script');
    script.text = fluidTankBareRuntimeScript;
    root.appendChild(script);

    return () => {
      script.remove();
      if (previousPixi) {
        (window as typeof window & { PIXI?: typeof PIXI }).PIXI = previousPixi;
      } else {
        delete (window as typeof window & { PIXI?: typeof PIXI }).PIXI;
      }
    };
  }, []);

  return (
    <div ref={rootRef} data-fluid-runtime={uid} className="relative h-full w-full overflow-hidden bg-black">
      <canvas id="fluid-canvas" className="absolute inset-0 h-full w-full" />
      <div id="pixi-layer" className="absolute inset-0" />

      <div id="hud" className="hidden" aria-hidden="true">
        <div><strong>FPS</strong>: <span id="fps">0</span></div>
        <div><strong>Grid</strong>: <span id="grid">—</span></div>
        <div><strong>Mode</strong>: <span id="mode">finger stir</span></div>
        <div><strong>Stirs</strong>: <span id="stirs">0</span></div>
      </div>

      <section id="controls" className="hidden" aria-hidden="true" aria-label="Fluid simulation controls">
        <input id="cellSize" type="range" min="0.85" max="3.20" step="0.05" defaultValue="1.20" />
        <input id="fingerForce" type="range" min="1" max="32" step="0.5" defaultValue="8" />
        <input id="fingerRadius" type="range" min="0.010" max="0.060" step="0.001" defaultValue="0.026" />
        <input id="viscosity" type="range" min="0" max="1" step="0.01" defaultValue="0.22" />
        <input id="curl" type="range" min="0" max="24" step="0.5" defaultValue="6" />
        <input id="eddy" type="range" min="0" max="0.35" step="0.01" defaultValue="0.00" />
        <input id="dyePersistence" type="range" min="0.9950" max="1.0000" step="0.0001" defaultValue="0.9996" />
        <input id="pressure" type="range" min="10" max="36" step="1" defaultValue="24" />
        <output id="cellSizeValue" />
        <output id="forceValue" />
        <output id="radiusValue" />
        <output id="viscosityValue" />
        <output id="curlValue" />
        <output id="eddyValue" />
        <output id="dyeValue" />
        <output id="pressureValue" />
        <button id="randomizeBtn" type="button">New dye</button>
        <button id="settleBtn" type="button">Settle</button>
        <button id="ambientBtn" type="button">Ambient: off</button>
        <button id="resetBtn" type="button">Reset gentle</button>
      </section>

      <div id="fallback" className="hidden fixed inset-0 items-center justify-center bg-black p-8 text-center text-white">
        <div className="max-w-xl rounded-xl border border-white/15 bg-white/10 p-6">
          <h2 className="text-xl font-semibold">WebGL2 fluid simulation unavailable</h2>
          <p className="mt-2 text-sm text-white/75">
            This version needs WebGL2 with floating-point render targets. Try a recent desktop browser, iPad Safari, or Chrome/Edge with hardware acceleration enabled.
          </p>
        </div>
      </div>
    </div>
  );
}
