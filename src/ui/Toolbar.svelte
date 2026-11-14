<script lang="ts">
  import { app } from './state.svelte.js';
  import { t } from './i18n';
  import {
    continueRun, newAlgorithm, openAlgorithm, persistSettings, testOrSelfTest,
    saveAlgorithm, startRun, stepRun, stopRun,
  } from './actions';

  let fileOpen = $state(false);
  let fileEl = $state<HTMLDetailsElement | null>(null);

  function onWindowClick(e: MouseEvent): void {
    if (!fileOpen || !fileEl) return;
    const target = e.target as Node | null;
    if (target && !fileEl.contains(target)) fileOpen = false;
  }

  function doNew(): void {
    fileOpen = false;
    if (app.source.trim() !== '' && !confirm(`${t(app.lang, 'newLine')}?`)) return;
    newAlgorithm();
  }

  function doOpen(): void { fileOpen = false; void openAlgorithm(); }
  function doSave(): void { fileOpen = false; void saveAlgorithm(false); }
  function doSaveAs(): void { fileOpen = false; void saveAlgorithm(true); }

  function doTest(): void {
    fileOpen = false;
    testOrSelfTest();
  }

  function setLang(e: Event): void {
    const lang = (e.currentTarget as HTMLSelectElement).value as 'tr' | 'en';
    app.settings = { ...app.settings, lang };
    persistSettings(app.settings);
  }

  function setTheme(e: Event): void {
    const theme = (e.currentTarget as HTMLSelectElement).value as 'system' | 'light' | 'dark';
    app.settings = { ...app.settings, theme };
    persistSettings(app.settings);
  }
</script>

<svelte:window onclick={onWindowClick} />

<header class="toolbar">
  <span class="brand"><b>dry run</b> raven</span>

  <details class="menu" bind:this={fileEl} bind:open={fileOpen}>
    <summary>{t(app.lang, 'file')}</summary>
    <div class="menu-body">
      <button class="menu-item" type="button" onclick={doNew}>
        <span>{t(app.lang, 'newFile')}</span><span class="key">Ctrl+N</span>
      </button>
      <button class="menu-item" type="button" onclick={doOpen}>
        <span>{t(app.lang, 'open')}</span><span class="key">Ctrl+O</span>
      </button>
      <button class="menu-item" type="button" onclick={doSave}>
        <span>{t(app.lang, 'save')}</span><span class="key">Ctrl+S</span>
      </button>
      <button class="menu-item" type="button" onclick={doSaveAs}>
        <span>{t(app.lang, 'saveAs')}</span><span class="key">Ctrl+Shift+S</span>
      </button>
      <div class="menu-sep"></div>
      <button class="menu-item" type="button" onclick={() => { fileOpen = false; app.tab = 'flow'; }}>
        <span>{t(app.lang, 'tabFlow')}</span><span class="key">Ctrl+Shift+F</span>
      </button>
      <div class="menu-sep"></div>
      <button class="menu-item" type="button" onclick={() => { fileOpen = false; app.settingsOpen = true; }}>
        <span>{t(app.lang, 'settings')}</span><span class="key">Ctrl+,</span>
      </button>
    </div>
  </details>

  <button class="btn primary" type="button" onclick={() => startRun(false)} title={t(app.lang, 'shortcutRun')}>
    {t(app.lang, 'run')}<span class="key">F5</span>
  </button>
  <button class="btn" type="button" onclick={doTest} title={t(app.lang, 'shortcutTest')}>
    {t(app.lang, 'test')}<span class="key">Ctrl+T</span>
  </button>
  <button
    class="btn"
    type="button"
    onclick={stepRun}
    disabled={app.phase === 'running' || app.waitingInput}
    title={t(app.lang, 'shortcutStep')}
  >{t(app.lang, 'step')}<span class="key">F10</span></button>
  {#if app.phase === 'paused'}
    <button class="btn" type="button" onclick={continueRun} disabled={app.waitingInput}>
      {t(app.lang, 'resume')}<span class="key">F8</span>
    </button>
  {/if}
  <button
    class="btn"
    type="button"
    onclick={stopRun}
    disabled={!app.active && !app.selfTestState.running}
  >{t(app.lang, 'stop')}</button>

  <span class="spacer"></span>

  <select class="select lang-select" value={app.settings.lang} onchange={setLang} aria-label={t(app.lang, 'language')}>
    <option value="tr">TR</option>
    <option value="en">EN</option>
  </select>
  <select class="select theme-select" value={app.settings.theme} onchange={setTheme} aria-label={t(app.lang, 'theme')}>
    <option value="system">{t(app.lang, 'themeSystem')}</option>
    <option value="light">{t(app.lang, 'themeLight')}</option>
    <option value="dark">{t(app.lang, 'themeDark')}</option>
  </select>
  <button class="btn" type="button" onclick={() => (app.settingsOpen = true)} aria-label={t(app.lang, 'settings')}>
    {t(app.lang, 'settings')}
  </button>
</header>

<style>
  .lang-select { width: 54px; height: 22px; font-size: 11px; }
  .theme-select { width: 78px; height: 22px; font-size: 11px; }
  .toolbar :global(.btn.primary .key) { color: var(--text-faint); }
</style>
