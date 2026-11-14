<script lang="ts">
  import { app } from './state.svelte.js';
  import { t } from './i18n';
  import { formatValue } from '../lib/interp/format';

  const vars = $derived(app.memory.vars);
</script>

<div class="panel memory-panel">
  <div class="panel-head">
    <h2 class="panel-title">{t(app.lang, 'tabMemory')}</h2>
    {#if app.memory.lastChanged}
      <span class="chip">{t(app.lang, 'lastChanged')}: {app.memory.lastChanged}</span>
    {/if}
    <span class="spacer"></span>
    {#if app.active}
      <span class="chip">{app.steps} {t(app.lang, 'stats')}</span>
    {/if}
  </div>

  {#if vars.length === 0}
    <div class="empty-state">
      {app.active ? t(app.lang, 'memoryRunning') : t(app.lang, 'memoryEmpty')}
    </div>
  {:else}
    <div class="var-list">
      {#each vars as v (v.key)}
        {#if v.kind === 'scalar'}
          <section class="scalar" class:changed={app.memory.lastChanged === v.name}>
            <header>
              <span class="var-name mono">{v.name}</span>
              <span class="spacer"></span>
              <span class="current-value mono">{formatValue(v.value)}</span>
            </header>
            {#if v.history.length > 0}
              <div class="history mono" aria-label={t(app.lang, 'history')}>
                {#each v.history as h, i}
                  {#if i > 0}<span class="arrow">→</span>{/if}
                  <span class="hist-val" class:now={i === v.history.length - 1}>{formatValue(h)}</span>
                {/each}
              </div>
            {/if}
          </section>
        {:else}
          <section class="arr" class:changed={app.memory.lastChanged === v.name || app.memory.lastChanged?.startsWith(`${v.name}[`)}>
            <header>
              <span class="var-name mono">{v.name}</span>
              <span class="arr-size">{t(app.lang, 'array')}{v.size !== null ? ` [${v.size}]` : ''}</span>
              <span class="spacer"></span>
              <span class="faint">{v.cells.filter((c) => c.value !== null).length}/{v.cells.length}</span>
            </header>
            <div class="cells">
              {#each v.cells as cell (cell.index)}
                <div class="cell" class:changed={cell.changed} class:unset={cell.value === null}>
                  <span class="idx mono">{cell.index}</span>
                  <span class="val mono">{cell.value === null ? '·' : formatValue(cell.value)}</span>
                </div>
              {/each}
            </div>
          </section>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .memory-panel { overflow: auto; }
  .var-list { display: flex; flex-direction: column; gap: 8px; }

  .scalar, .arr {
    border: 1px solid var(--border);
    background: var(--bg-panel);
    padding: 6px 8px;
    border-radius: var(--radius);
  }
  .scalar.changed, .arr.changed { border-color: var(--accent-line); }

  .scalar header, .arr header {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-height: 20px;
  }
  .var-name { font-size: 12px; color: var(--text); font-weight: 600; }
  .current-value { font-size: 14px; color: var(--text); }
  .arr-size { font-size: 10px; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.05em; }

  .history {
    margin-top: 3px;
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
    font-size: 11px;
    color: var(--text-muted);
  }
  .arrow { color: var(--text-faint); }
  .hist-val { padding: 0 2px; }
  .hist-val.now { background: var(--text); color: var(--bg); }

  .cells {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    margin-top: 6px;
    max-height: 240px;
    overflow: auto;
  }
  .cell {
    display: flex;
    flex-direction: column;
    min-width: 34px;
    border: 1px solid var(--border);
    background: var(--bg);
    padding: 1px 3px;
    align-items: center;
    border-radius: 1px;
  }
  .cell.changed {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .cell.unset .val { color: var(--text-faint); }
  .idx { font-size: 9px; color: var(--text-faint); line-height: 11px; }
  .val { font-size: 11.5px; color: var(--text); line-height: 15px; }
</style>
