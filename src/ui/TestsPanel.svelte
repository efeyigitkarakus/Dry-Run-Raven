<script lang="ts">
  import { app } from './state.svelte.js';
  import { t } from './i18n';
  import { addScenario, compareReference, persistSettings, runTests, selfTest } from './actions';
  import { formatIssue } from '../lib/lang/messages';
  import { getProblem } from '../lib/problems';
  import { newScenarioId } from '../lib/tests/types';

  let editingId = $state<string | null>(null);
  let editingNew = $state(false);
  let draftName = $state('');
  let draftInputs = $state('');
  let draftExpected = $state('');

  const resultsById = $derived(new Map(app.testsState.results.map((r) => [r.scenarioId, r])));
  const passed = $derived(app.testsState.results.filter((r) => r.equal).length);
  const hasStoredSolution = $derived.by(() => {
    if (app.problemId === null) return false;
    const p = getProblem(app.problemId) ?? app.userProblems.find((x) => x.id === app.problemId);
    return !!p?.solution.trim();
  });

  function startAdd(): void {
    addScenario();
    const last = app.tests[app.tests.length - 1];
    if (!last) return;
    app.tests[app.tests.length - 1] = { ...last, name: '' };
    startEdit(last.id);
    editingNew = true;
  }

  function startEdit(id: string): void {
    const s = app.tests.find((x) => x.id === id);
    if (!s) return;
    editingNew = false;
    editingId = id;
    draftName = s.name;
    draftInputs = s.inputs;
    draftExpected = s.expected;
  }

  function cancelEdit(): void {
    if (editingNew && editingId) {
      app.tests = app.tests.filter((x) => x.id !== editingId);
    }
    editingNew = false;
    editingId = null;
  }

  function saveEdit(e: SubmitEvent): void {
    e.preventDefault();
    if (!editingId) return;
    app.tests = app.tests.map((x) => (x.id === editingId
      ? { ...x, name: draftName, inputs: draftInputs, expected: draftExpected }
      : x));
    app.resetTests();
    editingNew = false;
    editingId = null;
  }

  function removeScenario(id: string): void {
    app.tests = app.tests.filter((x) => x.id !== id);
    app.resetTests();
    if (editingId === id) editingId = null;
  }

  function firstDiffText(r: (typeof app.testsState.results)[number]): string {
    if (r.equal) return '';
    if (r.error) return formatIssue(r.error, app.lang).message;
    const empty = t(app.lang, 'emptyValue');
    return `${t(app.lang, 'firstDiff')}: #${r.diffIndex + 1} — `
      + `${t(app.lang, 'expected')}: ${r.expectedToken === null ? empty : `"${r.expectedToken}"`} · `
      + `${t(app.lang, 'actual')}: ${r.actualToken === null ? empty : `"${r.actualToken}"`}`;
  }

  function toggleTrials(v: number): void {
    const n = Math.min(50, Math.max(10, Math.round(v) || 20));
    app.settings = { ...app.settings, compareTrials: n };
    persistSettings(app.settings);
  }
</script>

<div class="tests">
  <section class="autotest">
    <div class="panel-head">
      <h2 class="panel-title">{t(app.lang, 'selfTest')}</h2>
      <span class="panel-hint">
        {hasStoredSolution ? t(app.lang, 'selfTestHintReference') : t(app.lang, 'selfTestHint')}
      </span>
      <span class="spacer"></span>
      <button
        class="btn primary small"
        type="button"
        onclick={selfTest}
        disabled={app.selfTestState.running}
      >{app.selfTestState.running ? t(app.lang, 'selfTestRunning') : t(app.lang, 'selfTest')}</button>
    </div>

    {#if app.selfTestState.outcome}
      {@const o = app.selfTestState.outcome}
      {#if o.kind === 'invalid'}
        <div class="cmp err">
          <span class="chip err">
            {o.which === 'source' ? t(app.lang, 'compareInvalidA') : t(app.lang, 'selfTestInvalidReference')}
          </span>
          {#each o.issues as issue}
            <div class="mono err-text">{formatIssue(issue, app.lang).message}</div>
          {/each}
        </div>
      {:else if o.kind === 'fuzz'}
        <div class="row">
          <span class="chip" class:ok={o.failures.length === 0} class:err={o.failures.length > 0}>
            {o.passed}/{o.trials} {t(app.lang, 'selfTestCleanOf')}
          </span>
          {#if o.noOutput > 0}
            <span class="panel-hint">{o.noOutput} {t(app.lang, 'selfTestNoOutput')}</span>
          {/if}
        </div>
        {#if o.failures.length > 0}
          {#each o.failures.slice(0, 3) as f}
            <div class="failure">
              <div class="row">
                <span class="chip err">{t(app.lang, 'trial')} {f.trial}</span>
                <span class="mono fail-inputs">
                  {f.inputs.slice(0, 10).join(' ')}{f.inputs.length > 10 ? ' …' : ''}
                </span>
              </div>
              <div class="err-text">
                {formatIssue(f.error, app.lang).message}{f.error.line ? ` — ${t(app.lang, 'line')} ${f.error.line}` : ''}
              </div>
            </div>
          {/each}
          {#if o.failures.length > 3}
            <p class="panel-hint">+{o.failures.length - 3} {t(app.lang, 'selfTestFailing')}</p>
          {/if}
        {/if}
        <p class="panel-hint auto-note">{t(app.lang, 'selfTestNote')}</p>
      {:else}
        {@const c = o.outcome}
        {#if c.kind === 'same'}
          <div class="row">
            <span class="chip ok">{t(app.lang, 'selfTestSame')}</span>
            <span class="mono">{o.trialsRun} {t(app.lang, 'stats')}</span>
          </div>
        {:else if c.kind === 'mismatch'}
          <div class="cmp err">
            <div class="row">
              <span class="chip err">{t(app.lang, 'selfTestDifferent')}</span>
              <span class="mono">{t(app.lang, 'trial')} {c.trial}</span>
            </div>
            <div class="io">
              <span class="io-label">{t(app.lang, 'trialInputs')}</span>
              <span class="mono io-val">
                {c.inputs.slice(0, 10).join(' ')}{c.inputs.length > 10 ? ' …' : ''}
              </span>
            </div>
            <div class="grid2">
              <div>
                <span class="io-label">{t(app.lang, 'selfTestYours')}</span>
                <pre class="mono diffbox">{c.errA ?? c.outA}</pre>
              </div>
              <div>
                <span class="io-label">{t(app.lang, 'selfTestStored')}</span>
                <pre class="mono diffbox">{c.errB ?? c.outB}</pre>
              </div>
            </div>
          </div>
        {/if}
      {/if}
    {/if}
  </section>

  <div class="panel-head">
    <h2 class="panel-title">{t(app.lang, 'testsTitle')}</h2>
    {#if app.testsState.done}
      <span class="chip" class:ok={passed === app.tests.length} class:err={passed !== app.tests.length}>
        {passed}/{app.tests.length} {t(app.lang, 'passedOf')}
      </span>
    {/if}
    <span class="spacer"></span>
    <button class="btn small" type="button" onclick={startAdd} disabled={editingId !== null}>
      {t(app.lang, 'addScenario')}
    </button>
    <button
      class="btn primary small"
      type="button"
      onclick={runTests}
      disabled={app.testsState.running || app.tests.length === 0}
    >{app.testsState.running ? t(app.lang, 'testRunning') : t(app.lang, 'runTests')}</button>
  </div>

  {#if app.tests.length === 0}
    <div class="empty-state">{t(app.lang, 'noTests')}</div>
  {/if}

  <div class="scenario-list">
    {#each app.tests as s, i (s.id)}
      <article class="scenario">
        <header>
          <span class="s-name">{s.name || `${t(app.lang, 'trial')} ${i + 1}`}</span>
          <span class="spacer"></span>
          {#if resultsById.get(s.id)}
            <span class="chip" class:ok={resultsById.get(s.id)!.equal} class:err={!resultsById.get(s.id)!.equal}>
              {resultsById.get(s.id)!.equal ? t(app.lang, 'pass') : t(app.lang, 'fail')}
            </span>
            <span class="s-stats mono">{resultsById.get(s.id)!.steps} {t(app.lang, 'stats')}
              · {Math.round(resultsById.get(s.id)!.ms)} {t(app.lang, 'ms')}</span>
          {/if}
          <button class="btn small" type="button" onclick={() => startEdit(s.id)}>{t(app.lang, 'edit')}</button>
          <button class="btn small" type="button" onclick={() => removeScenario(s.id)}>{t(app.lang, 'delete')}</button>
        </header>

        {#if editingId === s.id}
          <form class="edit-form" onsubmit={saveEdit}>
            <div class="field">
              <label for={`n-${s.id}`}>{t(app.lang, 'name')}</label>
              <input id={`n-${s.id}`} class="input" bind:value={draftName} />
            </div>
            <div class="grid2">
              <div class="field">
                <label for={`i-${s.id}`}>{t(app.lang, 'inputs')}</label>
                <textarea id={`i-${s.id}`} class="textarea" rows="2" bind:value={draftInputs} spellcheck="false"></textarea>
              </div>
              <div class="field">
                <label for={`e-${s.id}`}>{t(app.lang, 'expected')}</label>
                <textarea id={`e-${s.id}`} class="textarea" rows="2" bind:value={draftExpected} spellcheck="false"></textarea>
              </div>
            </div>
            <div class="row">
              <button class="btn primary small" type="submit">{t(app.lang, 'saveChanges')}</button>
              <button class="btn small" type="button" onclick={cancelEdit}>{t(app.lang, 'cancel')}</button>
            </div>
          </form>
        {:else}
          <div class="scenario-body">
            <div class="io">
              <span class="io-label">{t(app.lang, 'inputs')}</span>
              <span class="mono io-val">{s.inputs || '—'}</span>
            </div>
            <div class="io">
              <span class="io-label">{t(app.lang, 'expected')}</span>
              <pre class="mono io-val">{s.expected || '—'}</pre>
            </div>
          </div>
          {#if resultsById.get(s.id)}
            {@const r = resultsById.get(s.id)!}
            <div class="result" class:ok={r.equal} class:err={!r.equal}>
              <div class="res-head">
                <span class="res-label">{t(app.lang, 'actual')}</span>
                <span class="chip" class:ok={r.equal} class:err={!r.equal}>
                  {r.equal ? t(app.lang, 'allPassed') : t(app.lang, 'firstDiff')}
                </span>
                {#if !r.equal}<span class="res-diff">{firstDiffText(r)}</span>{/if}
              </div>
              <pre class="mono actual">{r.actual || '—'}</pre>
            </div>
          {/if}
        {/if}
      </article>
    {/each}
  </div>

  <div class="sep"></div>

  <details class="compare">
    <summary>
      <span class="panel-title">{t(app.lang, 'reference')}</span>
      <span class="panel-hint">{t(app.lang, 'referenceOptional')}</span>
    </summary>
    <div class="compare-body">
      <p class="panel-hint">{t(app.lang, 'referenceHint')}</p>
      <textarea
        class="textarea ref-box"
        rows="4"
        spellcheck="false"
        bind:value={app.referenceSource}
        aria-label={t(app.lang, 'reference')}
        placeholder={t(app.lang, 'referenceHint')}
      ></textarea>
      <div class="row">
        <label class="check">
          {t(app.lang, 'trials')}
          <input
            class="input trials"
            type="number"
            min="10"
            max="50"
            value={app.settings.compareTrials}
            onchange={(e) => toggleTrials(Number((e.currentTarget as HTMLInputElement).value))}
          />
        </label>
        <button
          class="btn primary small"
          type="button"
          onclick={() => compareReference(app.settings.compareTrials)}
          disabled={app.compareState.running}
        >{app.compareState.running ? t(app.lang, 'testRunning') : t(app.lang, 'compare')}</button>
        {#if app.compareState.running}
          <span class="panel-hint">{app.compareState.trialsRun} {t(app.lang, 'stats')}</span>
        {/if}
      </div>

      {#if app.compareState.outcome}
        {@const o = app.compareState.outcome}
        {#if o.kind === 'same'}
          <div class="cmp ok">
            <span class="chip ok">{t(app.lang, 'sameResult')}</span>
            <span class="mono">{o.trials} {t(app.lang, 'stats')}</span>
          </div>
        {:else if o.kind === 'invalid'}
          <div class="cmp err">
            <span class="chip err">{o.which === 'a' ? t(app.lang, 'compareInvalidA') : t(app.lang, 'referenceInvalid')}</span>
            {#each o.issues as issue}
              <div class="mono err-text">{issue.code} — {formatIssue(issue, app.lang).message}</div>
            {/each}
          </div>
        {:else}
          <div class="cmp err">
            <div class="row">
              <span class="chip err">{t(app.lang, 'mismatch')}</span>
              <span class="mono">{t(app.lang, 'trial')} {o.trial}</span>
            </div>
            <div class="io">
              <span class="io-label">{t(app.lang, 'trialInputs')}</span>
              <span class="mono io-val">{o.inputs.join(' ')}</span>
            </div>
            <div class="grid2">
              <div>
                <span class="io-label">{t(app.lang, 'actual')}</span>
                <pre class="mono diffbox">{o.errA ?? o.outA}</pre>
              </div>
              <div>
                <span class="io-label">{t(app.lang, 'reference')}</span>
                <pre class="mono diffbox">{o.errB ?? o.outB}</pre>
              </div>
            </div>
          </div>
        {/if}
      {/if}
    </div>
  </details>
</div>

<style>
  .tests {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    padding: 8px 10px;
  }
  .scenario-list { display: flex; flex-direction: column; gap: 6px; }

  .scenario {
    border: 1px solid var(--border);
    background: var(--bg-panel);
    border-radius: var(--radius);
    padding: 5px 7px;
  }
  .scenario > header { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .s-name { font-size: 12px; font-weight: 600; color: var(--text); }
  .s-stats { font-size: 10px; color: var(--text-faint); }

  .scenario-body { display: flex; gap: 12px; margin-top: 4px; flex-wrap: wrap; }
  .io { display: flex; gap: 5px; align-items: baseline; min-width: 120px; }
  .io-label {
    font-size: 9.5px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-faint);
    white-space: nowrap;
  }
  .io-val { margin: 0; font-size: 11.5px; color: var(--text-muted); white-space: pre-wrap; }

  .edit-form { margin-top: 6px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

  .result {
    margin-top: 5px;
    border-top: 1px dashed var(--border);
    padding-top: 4px;
  }
  .res-head { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .res-label {
    font-size: 9.5px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-faint);
  }
  .res-diff { font-size: 10.5px; color: var(--err); }
  .actual {
    margin: 3px 0 0;
    font-size: 11.5px;
    color: var(--text);
    background: var(--bg-sunken);
    border: 1px solid var(--border-muted);
    padding: 3px 5px;
    white-space: pre-wrap;
    max-height: 120px;
    overflow: auto;
  }

  .autotest {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg-panel);
    padding: 0 8px 7px;
    margin-bottom: 8px;
  }
  .autotest .panel-head { padding-top: 6px; margin-bottom: 4px; }
  .auto-note { margin: 6px 0 0; }
  .failure { border-top: 1px dashed var(--border); margin-top: 5px; padding-top: 4px; }
  .fail-inputs { font-size: 10.5px; color: var(--text-muted); overflow-wrap: anywhere; }

  .compare {
    margin-bottom: 8px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg-panel);
  }
  .compare > summary {
    padding: 6px 8px 6px 4px;
    cursor: pointer;
  }
  .compare > summary .panel-hint { margin-left: 8px; }
  .compare[open] > summary { border-bottom: 1px solid var(--border); }
  .compare-body { padding: 0 8px 7px; }
  .compare-body .panel-hint { margin: 6px 0; }
  .ref-box { min-height: 64px; margin-bottom: 6px; }
  .trials { width: 64px; margin-left: 4px; }
  .cmp { margin-top: 6px; display: flex; flex-direction: column; gap: 5px; }
  .cmp.err { border-left: 2px solid var(--err); padding-left: 7px; }
  .cmp.ok { border-left: 2px solid var(--ok); padding-left: 7px; }
  .diffbox {
    margin: 2px 0 0;
    font-size: 11px;
    background: var(--bg-sunken);
    border: 1px solid var(--border-muted);
    padding: 3px 5px;
    white-space: pre-wrap;
    max-height: 150px;
    overflow: auto;
  }
</style>
