export const fluidRuntimeMarkup = `
  <canvas id="runtime-canvas" class="absolute inset-0 h-full w-full"></canvas>
  <div id="pixi-layer" class="absolute inset-0"></div>
  <div id="hud" class="hidden" aria-hidden="true">
    <div><strong>FPS</strong>: <span id="fps">0</span></div>
    <div><strong>Grid</strong>: <span id="grid">—</span></div>
    <div><strong>Mode</strong>: <span id="mode">finger stir</span></div>
    <div><strong>Stirs</strong>: <span id="stirs">0</span></div>
  </div>
  <section id="controls" class="hidden" aria-hidden="true" aria-label="Simulation controls">
    <input id="cellSize" type="range" min="0.85" max="3.20" step="0.05" value="1.20" />
    <input id="fingerForce" type="range" min="1" max="32" step="0.5" value="8" />
    <input id="fingerRadius" type="range" min="0.010" max="0.060" step="0.001" value="0.026" />
    <input id="viscosity" type="range" min="0" max="1" step="0.01" value="0.22" />
    <input id="curl" type="range" min="0" max="24" step="0.5" value="6" />
    <input id="eddy" type="range" min="0" max="0.35" step="0.01" value="0.00" />
    <input id="dyePersistence" type="range" min="0.9950" max="1.0000" step="0.0001" value="0.9996" />
    <input id="pressure" type="range" min="10" max="36" step="1" value="24" />
    <output id="cellSizeValue"></output>
    <output id="forceValue"></output>
    <output id="radiusValue"></output>
    <output id="viscosityValue"></output>
    <output id="curlValue"></output>
    <output id="eddyValue"></output>
    <output id="dyeValue"></output>
    <output id="pressureValue"></output>
    <button id="randomizeBtn" type="button">New dye</button>
    <button id="settleBtn" type="button">Settle</button>
    <button id="ambientBtn" type="button">Ambient: off</button>
    <button id="resetBtn" type="button">Reset gentle</button>
  </section>
  <div id="fallback" class="hidden fixed inset-0 items-center justify-center bg-black p-8 text-center text-white">
    <div class="max-w-xl rounded-xl border border-white/15 bg-white/10 p-6">
      <h2 class="text-xl font-semibold">WebGL2 simulation unavailable</h2>
      <p class="mt-2 text-sm text-white/75">This version needs WebGL2 with floating-point render targets.</p>
    </div>
  </div>
`;
