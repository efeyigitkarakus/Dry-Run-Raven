<script lang="ts">
  import { app } from './state.svelte.js';
  import { t } from './i18n';
  import { sendInput } from './actions';
  import { formatIssue } from '../lib/lang/messages';

  let inputValue = $state('');
  let outEl = $state<HTMLDivElement | null>(null);
  let inputEl = $state<HTMLInputElement | null>(null);

  const warningTexts = $derived(app.warnings.map((w) => formatIssue(w, app.lang).message));

  function submitInput(e: SubmitEvent): void {
    e.preventDefault();
    sendInput(inputValue);
    inputValue = '';
  }

  $effect(() => {
    // Yeni çıktı geldiğinde en alta kaydır (yalnızca konsol açıkken).
    void app.consoleLines.length;
    if (outEl && app.tab === 'console') outEl.scrollTop = outEl.scrollHeight;
  });

  $effect(() => {
    if (app.waitingInput && app.tab === 'console' && inputEl) inputEl.focus();
  });
</script>

<div class="console">
  <div class="queue">
    <div class="queue-head">
      <label class="panel-title" for="input-queue">{t(app.lang, 'inputQueue')}</label>
      <span class="panel-hint">{t(app.lang, 'inputQueueHint')}</span>
    </div>
    <textarea
      id="input-queue"
      class="textarea queue-box"
      rows="2"
      bind:value={app.inputQueue}
      spellcheck="false"
    ></textarea>
  </div>

  <div class="out-head">
    <span class="panel-title">{t(app.lang, 'output')}</span>
    <span class="stats mono">{app.steps} {t(app.lang, 'stats')}
      {#if app.phase === 'done' || app.phase === 'error' || app.phase === 'stopped'}
        · {Math.round(app.ms)} {t(app.lang, 'ms')}
      {/if}
    </span>
    <span class="spacer"></span>
    <button class="btn small" type="button" onclick={() => (app.consoleLines = [])}>{t(app.lang, 'clear')}</button>
  </div>

  <div class="out" bind:this={outEl} aria-live="polite" aria-atomic="false">
    {#if app.consoleLines.length === 0}
      <div class="empty-state">{t(app.lang, 'noOutput')}</div>
    {/if}
    {#each app.consoleLines as line}
      <div class="cline {line.kind}">{line.text}</div>
    {/each}
  </div>

  {#if warningTexts.length > 0}
    <div class="warns">
      {#each warningTexts as w}
        <span class="chip warn">{w}</span>
      {/each}
    </div>
  {/if}

  {#if app.waitingInput}
    <form class="input-prompt" onsubmit={submitInput}>
      <label for="console-input" class="prompt-label">
        {t(app.lang, 'waitingInput')} <span class="mono">{app.inputTarget}</span>
      </label>
      <input
        id="console-input"
        class="input mono"
        bind:this={inputEl}
        bind:value={inputValue}
        autocomplete="off"
        spellcheck="false"
        aria-label={t(app.lang, 'waitingInput')}
      />
      <button class="btn primary" type="submit">{t(app.lang, 'send')}</button>
    </form>
  {/if}
</div>

<style>
  .console {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 8px 10px;
    gap: 6px;
  }

  .queue { display: flex; flex-direction: column; gap: 3px; }
  .queue-head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
  .queue-box { min-height: 38px; height: 38px; resize: none; font-size: 11.5px; }

  .out-head { display: flex; align-items: center; gap: 8px; margin-top: 2px; }
  .stats { font-size: 10.5px; color: var(--text-faint); }

  .out {
    flex: 1 1 auto;
    min-height: 60px;
    overflow: auto;
    border-top: 1px solid var(--border-muted);
    border-bottom: 1px solid var(--border-muted);
    padding: 6px 2px;
    font-family: var(--font-code);
    font-size: 12px;
    line-height: 18px;
    background: var(--bg-sunken);
  }

  .cline {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    padding: 0 4px;
  }
  .cline.out { color: var(--text); }
  .cline.info { color: var(--text-faint); }
  .cline.in { color: var(--text-muted); }
  .cline.err {
    color: var(--err);
    font-weight: 700;
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 2px;
    background: var(--err-soft);
  }

  .warns { display: flex; gap: 4px; flex-wrap: wrap; }
  .chip.warn {
    color: var(--text-muted);
    border-color: var(--border-strong);
    background: var(--bg-panel);
  }

  .input-prompt {
    display: flex;
    align-items: center;
    gap: 8px;
    border-top: 1px solid var(--border);
    padding-top: 6px;
  }
  .prompt-label { font-size: 11px; color: var(--text-muted); white-space: nowrap; }
  .input-prompt .input { flex: 1 1 auto; height: 26px; }
</style>
