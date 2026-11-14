<script lang="ts">
  import { onMount } from 'svelte';
  import { app, type Tab } from './ui/state.svelte.js';
  import { t } from './ui/i18n';
  import {
    continueRun, newAlgorithm, openAlgorithm, runTests, saveAlgorithm,
    startRun, stepRun, stopRun, toggleBreakpoint,
  } from './ui/actions';
  import { saveDraft } from './lib/storage';
  import Toolbar from './ui/Toolbar.svelte';
  import Editor from './ui/Editor.svelte';
  import ConsolePanel from './ui/ConsolePanel.svelte';
  import MemoryPanel from './ui/MemoryPanel.svelte';
  import TestsPanel from './ui/TestsPanel.svelte';
  import FlowPanel from './ui/FlowPanel.svelte';
  import ProblemsPanel from './ui/ProblemsPanel.svelte';
  import SettingsDialog from './ui/SettingsDialog.svelte';

  const TABS: { id: Tab; key: 'tabConsole' | 'tabMemory' | 'tabTests' | 'tabFlow' | 'tabProblems' }[] = [
    { id: 'console', key: 'tabConsole' },
    { id: 'memory', key: 'tabMemory' },
    { id: 'tests', key: 'tabTests' },
    { id: 'flow', key: 'tabFlow' },
    { id: 'problems', key: 'tabProblems' },
  ];

  let mq: MediaQueryList | null = null;
  let systemDark = $state(false);

  const passedCount = $derived(app.testsState.results.filter((r) => r.equal).length);
  const hasNoStart = $derived(app.warnings.some((w) => w.code === 'W_NO_START'));
  const hasNoStop = $derived(app.warnings.some((w) => w.code === 'W_NO_STOP'));

  function phaseText(): string {
    switch (app.phase) {
      case 'running': return t(app.lang, 'running');
      case 'paused': return t(app.lang, 'paused');
      case 'error': return t(app.lang, 'statusError');
      case 'done': return t(app.lang, 'statusDone');
      case 'stopped': return t(app.lang, 'stopped');
      default: return t(app.lang, 'ready');
    }
  }

  function phaseClass(): string {
    switch (app.phase) {
      case 'running': return 'running';
      case 'paused': return 'paused';
      case 'error': return 'error';
      case 'done': return 'ok';
      default: return '';
    }
  }

  function selectTab(id: Tab): void {
    app.tab = id;
  }

  function tabKey(e: KeyboardEvent): void {
    const i = TABS.findIndex((x) => x.id === app.tab);
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      app.tab = TABS[(i + 1) % TABS.length].id;
      focusTab(app.tab);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      app.tab = TABS[(i - 1 + TABS.length) % TABS.length].id;
      focusTab(app.tab);
    }
  }

  function focusTab(id: Tab): void {
    const el = document.querySelector<HTMLButtonElement>(`[data-tab="${id}"]`);
    el?.focus();
  }

  function onKey(e: KeyboardEvent): void {
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key;

    if (key === 'F5') { e.preventDefault(); startRun(false); return; }
    if (key === 'F10') { e.preventDefault(); stepRun(); return; }
    if (key === 'F8') { e.preventDefault(); if (app.phase === 'paused') continueRun(); return; }
    if (key === 'F9') {
      e.preventDefault();
      toggleBreakpoint(app.cursorLine);
      return;
    }
    if (key === 'F6') { e.preventDefault(); runTests(); return; }

    if (mod && key === 'Enter') { e.preventDefault(); startRun(false); return; }
    if (mod && (key === 's' || key === 'S')) {
      e.preventDefault();
      void saveAlgorithm(e.shiftKey);
      return;
    }
    if (mod && (key === 'o' || key === 'O')) { e.preventDefault(); void openAlgorithm(); return; }
    if (mod && (key === 'n' || key === 'N')) {
      e.preventDefault();
      if (app.source.trim() !== '' && !confirm(`${t(app.lang, 'newLine')}?`)) return;
      newAlgorithm();
      return;
    }
    if (mod && e.shiftKey && (key === 'f' || key === 'F')) {
      e.preventDefault();
      app.tab = 'flow';
      return;
    }
    if (mod && (key === 't' || key === 'T')) { e.preventDefault(); runTests(); return; }
    if (mod && key === ',') { e.preventDefault(); app.settingsOpen = true; return; }
    if (mod && (key === 'g' || key === 'G')) {
      e.preventDefault();
      const raw = window.prompt(t(app.lang, 'goToLine'));
      if (raw !== null) {
        const n = Number(raw);
        if (Number.isFinite(n) && n > 0) app.requestGoto(Math.round(n));
      }
      return;
    }
  }

  onMount(() => {
    mq = window.matchMedia('(prefers-color-scheme: dark)');
    systemDark = mq.matches;
    const onChange = (e: MediaQueryListEvent): void => { systemDark = e.matches; };
    mq.addEventListener('change', onChange);
    window.addEventListener('keydown', onKey);
    return () => {
      mq?.removeEventListener('change', onChange);
      window.removeEventListener('keydown', onKey);
    };
  });

  let themeTick = 0;
  $effect(() => {
    const dark = app.settings.theme === 'dark'
      || (app.settings.theme === 'system' && systemDark);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.lang = app.lang;
    themeTick += 1;
    app.themeRevision = themeTick;
  });

  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  $effect(() => {
    // Taslak: kaynak, testler ve dosya bilgisi değişince gecikmeli yaz.
    const payload = {
      source: app.source,
      tests: app.tests,
      problemId: app.problemId,
      inputQueue: app.inputQueue,
      path: app.path,
      fileName: app.fileName,
    };
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveDraft(payload), 400);
    return () => { if (saveTimer) clearTimeout(saveTimer); };
  });
</script>

<div class="app-shell">
  <Toolbar />

  <main class="workspace">
    <section class="editor-pane" aria-label={t(app.lang, 'raven')}>
      <Editor />
    </section>

    <section class="right-pane">
      <div class="tabs" role="tablist" aria-label={t(app.lang, 'raven')} tabindex="0" onkeydown={tabKey}>
        {#each TABS as tb}
          <button
            class="tab"
            class:active={app.tab === tb.id}
            type="button"
            role="tab"
            id={`tab-${tb.id}`}
            data-tab={tb.id}
            aria-selected={app.tab === tb.id}
            aria-controls={`panel-${tb.id}`}
            tabindex={app.tab === tb.id ? 0 : -1}
            onclick={() => selectTab(tb.id)}
          >
            {t(app.lang, tb.key)}
            {#if tb.id === 'tests' && app.testsState.results.length > 0}
              <span class="tab-badge mono">{passedCount}/{app.tests.length}</span>
            {/if}
          </button>
        {/each}
      </div>

      <div class="panel-body">
        <div
          class="panel-host"
          class:hidden={app.tab !== 'console'}
          id="panel-console"
          role="tabpanel"
          aria-labelledby="tab-console"
        ><ConsolePanel /></div>

        {#if app.tab === 'memory'}
          <div class="panel-host" id="panel-memory" role="tabpanel" aria-labelledby="tab-memory">
            <MemoryPanel />
          </div>
        {/if}

        <div
          class="panel-host"
          class:hidden={app.tab !== 'tests'}
          id="panel-tests"
          role="tabpanel"
          aria-labelledby="tab-tests"
        ><TestsPanel /></div>

        {#if app.tab === 'flow'}
          <div class="panel-host" id="panel-flow" role="tabpanel" aria-labelledby="tab-flow">
            <FlowPanel />
          </div>
        {/if}

        <div
          class="panel-host"
          class:hidden={app.tab !== 'problems'}
          id="panel-problems"
          role="tabpanel"
          aria-labelledby="tab-problems"
        ><ProblemsPanel /></div>
      </div>
    </section>
  </main>

  <footer class="statusbar">
    <span class="file cut">{app.fileName || t(app.lang, 'untitled')}</span>
    <span class="mono">{t(app.lang, 'line')} {app.cursorLine}:{app.cursorCol}</span>
    {#if app.breakpoints.length > 0}
      <span class="mono">{t(app.lang, 'breakpoints')}: {app.breakpoints.length}</span>
    {/if}
    <span class="status">
      <span class="status-dot {phaseClass()}"></span>{phaseText()}
    </span>
    {#if app.active || app.phase === 'done' || app.phase === 'error' || app.phase === 'stopped'}
      <span class="mono">{app.steps} {t(app.lang, 'stats')} · {Math.round(app.ms)} {t(app.lang, 'ms')}</span>
    {/if}
    <span class="spacer"></span>
    {#if hasNoStart}<span class="chip">{t(app.lang, 'noStart')}</span>{/if}
    {#if hasNoStop}<span class="chip">{t(app.lang, 'noStop')}</span>{/if}
    {#if app.notice}
      <span class="notice cut" class:err-text={app.notice.kind === 'err'} class:ok-text={app.notice.kind === 'ok'}>
        {app.notice.text}
      </span>
    {/if}
  </footer>
</div>

{#if app.settingsOpen}
  <SettingsDialog />
{/if}

<style>
  .panel-body {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .panel-host {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .panel-host.hidden { display: none; }

  .tab-badge {
    margin-left: 4px;
    font-size: 9.5px;
    color: var(--text-faint);
  }
  .tab.active .tab-badge { color: var(--accent); }

  .status { display: inline-flex; align-items: center; }
  .notice { max-width: 40%; font-family: var(--font-ui); }
</style>
