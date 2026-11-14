<script lang="ts">
  import { app } from './state.svelte.js';
  import { t } from './i18n';
  import { applySettings } from './actions';
  import type { Settings } from '../lib/settings';

  let draft = $state<Settings>({ ...app.settings, inputAliases: [...app.settings.inputAliases] });
  let aliasText = $state(app.settings.inputAliases.join(', '));

  function close(): void {
    app.settingsOpen = false;
  }

  function submit(e: SubmitEvent): void {
    e.preventDefault();
    const aliases = aliasText.split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);
    const next: Settings = {
      ...draft,
      maxSteps: Math.min(10_000_000, Math.max(1_000, Math.round(draft.maxSteps) || 1_000_000)),
      maxOutput: Math.min(1_000_000, Math.max(100, Math.round(draft.maxOutput) || 10_000)),
      compareTrials: Math.min(50, Math.max(10, Math.round(draft.compareTrials) || 20)),
      inputAliases: aliases,
    };
    applySettings(next);
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') close();
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="modal-backdrop" role="presentation">
  <div class="modal" role="dialog" aria-modal="true" aria-label={t(app.lang, 'settingsTitle')}>
    <h2>{t(app.lang, 'settingsTitle')}</h2>
    <form onsubmit={submit}>
      <label class="check block">
        <input type="checkbox" bind:checked={draft.autoNumber} />
        {t(app.lang, 'autoNumber')}
      </label>
      <div class="panel-hint indent">{t(app.lang, 'autoNumberHint')}</div>

      <div class="grid2">
        <div class="field">
          <label for="set-theme">{t(app.lang, 'theme')}</label>
          <select id="set-theme" class="select" bind:value={draft.theme}>
            <option value="system">{t(app.lang, 'themeSystem')}</option>
            <option value="light">{t(app.lang, 'themeLight')}</option>
            <option value="dark">{t(app.lang, 'themeDark')}</option>
          </select>
        </div>
        <div class="field">
          <label for="set-lang">{t(app.lang, 'language')}</label>
          <select id="set-lang" class="select" bind:value={draft.lang}>
            <option value="tr">Türkçe</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>

      <div class="grid2">
        <div class="field">
          <label for="set-steps">{t(app.lang, 'maxSteps')}</label>
          <input id="set-steps" class="input" type="number" min="1000" max="10000000" step="1000" bind:value={draft.maxSteps} />
        </div>
        <div class="field">
          <label for="set-out">{t(app.lang, 'maxOutput')}</label>
          <input id="set-out" class="input" type="number" min="100" max="1000000" step="100" bind:value={draft.maxOutput} />
        </div>
      </div>

      <div class="field">
        <label for="set-alias">{t(app.lang, 'inputAliases')}</label>
        <textarea id="set-alias" class="textarea" rows="2" bind:value={aliasText} spellcheck="false"></textarea>
        <span class="panel-hint">{t(app.lang, 'inputAliasesHint')}</span>
      </div>

      <div class="grid2">
        <div class="field">
          <label for="set-flow">{t(app.lang, 'flowMode')}</label>
          <select id="set-flow" class="select" bind:value={draft.flowMode}>
            <option value="number">{t(app.lang, 'flowModeNumber')}</option>
            <option value="expr">{t(app.lang, 'flowModeExpr')}</option>
          </select>
        </div>
        <div class="field">
          <label for="set-trials">{t(app.lang, 'trials')}</label>
          <input id="set-trials" class="input" type="number" min="10" max="50" bind:value={draft.compareTrials} />
        </div>
      </div>

      <label class="check block">
        <input type="checkbox" bind:checked={draft.loopHex} />
        {t(app.lang, 'loopHex')}
      </label>

      <div class="sep"></div>
      <div class="row">
        <button class="btn primary" type="submit">{t(app.lang, 'apply')}</button>
        <button class="btn" type="button" onclick={close}>{t(app.lang, 'close')}</button>
      </div>
    </form>
  </div>
</div>

<style>
  .block { display: flex; margin: 2px 0; }
  .indent { margin: 0 0 8px 20px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
</style>
