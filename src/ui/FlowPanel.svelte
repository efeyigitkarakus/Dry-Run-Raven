<script lang="ts">
  import { app } from './state.svelte.js';
  import { t } from './i18n';
  import { persistSettings } from './actions';
  import { prepare } from '../lib/interp/run';
  import { buildCfg } from '../lib/cfg';
  import { layoutFlow, type FlowLayout, type FlowMode } from '../lib/flow/layout';
  import { renderFlowSvg, type FlowPalette } from '../lib/flow/svg';
  import { resolvePalette, svgToPng } from '../lib/flow/export';
  import { saveBinaryFile, saveTextFile } from '../lib/platform';
  import { formatIssue } from '../lib/lang/messages';

  let viewport = $state<HTMLDivElement | null>(null);
  let scale = $state(1);
  let tx = $state(0);
  let ty = $state(0);
  let palette = $state<FlowPalette>(resolvePalette());
  let lastFitKey = '';
  let dragging = $state(false);
  let dragX = 0;
  let dragY = 0;

  const built = $derived.by(() => {
    const p = prepare(app.source);
    if (!p.ok || !p.compiled) {
      return { layout: null as FlowLayout | null, error: p.errors[0] ?? null };
    }
    const cfg = buildCfg(p.compiled, t(app.lang, 'startNode'), t(app.lang, 'stopNode'));
    const layout = layoutFlow(cfg, {
      mode: app.settings.flowMode,
      loopHex: app.settings.loopHex,
      yesLabel: t(app.lang, 'yes'),
      noLabel: t(app.lang, 'no'),
      loopLabel: t(app.lang, 'loopLabel'),
      activeLine: app.currentLine,
    });
    return { layout, error: null };
  });

  const svg = $derived(built.layout ? renderFlowSvg(built.layout, palette) : '');

  $effect(() => {
    // Tema değişince paleti yenile.
    void app.themeRevision;
    palette = resolvePalette();
  });

  $effect(() => {
    const l = built.layout;
    if (!l || !viewport) return;
    const key = `${l.width}x${l.height}:${app.settings.flowMode}:${app.settings.loopHex}`;
    if (key === lastFitKey) return;
    lastFitKey = key;
    requestAnimationFrame(fit);
  });

  function fit(): void {
    const l = built.layout;
    if (!l || !viewport) return;
    const w = viewport.clientWidth;
    const h = viewport.clientHeight;
    const s = Math.min(1, (w - 28) / l.width, (h - 28) / l.height);
    scale = Math.max(0.2, s);
    tx = (w - l.width * scale) / 2;
    ty = (h - l.height * scale) / 2;
  }

  function zoomBy(factor: number, cx?: number, cy?: number): void {
    const l = built.layout;
    if (!l || !viewport) return;
    const next = Math.min(3, Math.max(0.2, scale * factor));
    if (next === scale) return;
    const rect = viewport.getBoundingClientRect();
    const mx = cx === undefined ? rect.width / 2 : cx - rect.left;
    const my = cy === undefined ? rect.height / 2 : cy - rect.top;
    tx = mx - (mx - tx) * (next / scale);
    ty = my - (my - ty) * (next / scale);
    scale = next;
  }

  function onWheel(e: WheelEvent): void {
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY);
  }

  function onPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    dragging = true;
    dragX = e.clientX - tx;
    dragY = e.clientY - ty;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent): void {
    if (!dragging) return;
    tx = e.clientX - dragX;
    ty = e.clientY - dragY;
  }

  function onPointerUp(e: PointerEvent): void {
    dragging = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  }

  function setMode(e: Event): void {
    const mode = (e.currentTarget as HTMLSelectElement).value as FlowMode;
    app.settings = { ...app.settings, flowMode: mode };
    persistSettings(app.settings);
  }

  function setLoopHex(e: Event): void {
    const on = (e.currentTarget as HTMLInputElement).checked;
    app.settings = { ...app.settings, loopHex: on };
    persistSettings(app.settings);
  }

  async function exportSvg(): Promise<void> {
    if (!built.layout) return;
    try {
      const text = renderFlowSvg(built.layout, resolvePalette());
      await saveTextFile('akis-semasi.svg', text, 'image/svg+xml', '.svg');
    } catch {
      app.notice = { text: t(app.lang, 'exportError'), kind: 'err' };
    }
  }

  async function exportPng(): Promise<void> {
    if (!built.layout) return;
    try {
      const text = renderFlowSvg(built.layout, resolvePalette());
      const bytes = await svgToPng(text, 2);
      await saveBinaryFile('akis-semasi.png', bytes, 'image/png', '.png');
    } catch {
      app.notice = { text: t(app.lang, 'exportError'), kind: 'err' };
    }
  }
</script>

<div class="flow">
  <div class="flow-bar">
    <label class="check">
      {t(app.lang, 'flowMode')}
      <select class="select" value={app.settings.flowMode} onchange={setMode}>
        <option value="number">{t(app.lang, 'flowModeNumber')}</option>
        <option value="expr">{t(app.lang, 'flowModeExpr')}</option>
      </select>
    </label>
    <label class="check">
      <input type="checkbox" checked={app.settings.loopHex} onchange={setLoopHex} />
      {t(app.lang, 'loopHex')}
    </label>
    <span class="spacer"></span>
    <button class="btn small" type="button" onclick={() => zoomBy(1.2)} title={t(app.lang, 'zoomIn')}>+</button>
    <button class="btn small" type="button" onclick={() => zoomBy(1 / 1.2)} title={t(app.lang, 'zoomOut')}>−</button>
    <button class="btn small" type="button" onclick={fit} title={t(app.lang, 'fitHint')}>{t(app.lang, 'fit')}</button>
    <span class="zoom mono">{Math.round(scale * 100)}%</span>
    <button class="btn small" type="button" onclick={exportSvg} disabled={!built.layout}>{t(app.lang, 'exportSvg')}</button>
    <button class="btn small" type="button" onclick={exportPng} disabled={!built.layout}>{t(app.lang, 'exportPng')}</button>
  </div>

  {#if built.error}
    <div class="flow-error">
      <div class="err-text mono">{formatIssue(built.error, app.lang).message}</div>
      <div class="panel-hint">{t(app.lang, 'flowEmpty')}</div>
    </div>
  {:else if built.layout}
    <div
      class="viewport"
      bind:this={viewport}
      onwheel={onWheel}
      onpointerdown={onPointerDown}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onpointercancel={onPointerUp}
      class:dragging
      role="presentation"
    >
      <div
        class="canvas"
        style={`transform: translate(${tx}px, ${ty}px) scale(${scale}); transform-origin: 0 0;`}
      >{@html svg}</div>
    </div>
    <div class="flow-hint panel-hint">{t(app.lang, 'flowHint')}</div>
  {:else}
    <div class="empty-state">{t(app.lang, 'flowEmpty')}</div>
  {/if}
</div>

<style>
  .flow {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .flow-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 8px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-panel);
    flex-wrap: wrap;
  }
  .flow-bar .select { width: auto; height: 22px; font-size: 11px; }
  .zoom { font-size: 10.5px; color: var(--text-faint); min-width: 36px; text-align: center; }

  .viewport {
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
    background: var(--bg-sunken);
    cursor: grab;
    touch-action: none;
    position: relative;
  }
  .viewport.dragging { cursor: grabbing; }

  .canvas { position: absolute; top: 0; left: 0; will-change: transform; }
  .canvas :global(svg) { display: block; }

  .flow-error { padding: 12px; }
  .flow-hint { padding: 2px 8px; border-top: 1px solid var(--border-muted); }
</style>
