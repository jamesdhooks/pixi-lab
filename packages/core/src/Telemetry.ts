/**
 * packages/core/src/Telemetry.ts
 *
 * Dev-only FPS counter, physics body count, draw call proxy.
 * Writes to an optional DOM overlay element.
 * Toggle with Shift+D or ?dev=1 URL param.
 */

export class Telemetry {
  private enabled: boolean;
  private el: HTMLElement | null = null;
  private _fps = 0;
  private _bodyCount = 0;
  private _particleCount = 0;
  private _drawCalls = 0;
  private _sceneName = '';
  private _mode = '';

  constructor() {
    this.enabled =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('dev') === '1';
  }

  mount(container: HTMLElement) {
    if (!this.enabled) return;
    this.el = document.createElement('div');
    this.el.style.cssText = [
      'position:absolute',
      'top:8px',
      'left:8px',
      'background:rgba(0,0,0,0.55)',
      'color:#0f0',
      'font:11px/1.4 monospace',
      'padding:4px 8px',
      'border-radius:4px',
      'pointer-events:none',
      'z-index:9999',
      'user-select:none',
    ].join(';');
    container.appendChild(this.el);

    // Toggle with Shift+D
    document.addEventListener('keydown', this.onKeyDown);
  }

  unmount() {
    this.el?.remove();
    this.el = null;
    document.removeEventListener('keydown', this.onKeyDown);
  }

  update(data: {
    fps?: number;
    bodyCount?: number;
    particleCount?: number;
    drawCalls?: number;
    sceneName?: string;
    mode?: string;
  }) {
    if (data.fps !== undefined) this._fps = data.fps;
    if (data.bodyCount !== undefined) this._bodyCount = data.bodyCount;
    if (data.particleCount !== undefined) this._particleCount = data.particleCount;
    if (data.drawCalls !== undefined) this._drawCalls = data.drawCalls;
    if (data.sceneName !== undefined) this._sceneName = data.sceneName;
    if (data.mode !== undefined) this._mode = data.mode;
    this.render();
  }

  private render() {
    if (!this.el || !this.enabled) return;
    this.el.textContent = [
      `FPS: ${this._fps}`,
      `Bodies: ${this._bodyCount}`,
      `Particles: ${this._particleCount}`,
      this._drawCalls > 0 ? `DC: ${this._drawCalls}` : null,
      this._sceneName ? `Scene: ${this._sceneName}` : null,
      this._mode ? `Mode: ${this._mode}` : null,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.shiftKey && e.key === 'D') {
      this.enabled = !this.enabled;
      if (this.el) this.el.style.display = this.enabled ? 'block' : 'none';
    }
  };

  get isEnabled() {
    return this.enabled;
  }
}
