<script lang="ts">
  import { app } from './state.svelte.js';
  import { t } from './i18n';
  import {
    addUserProblem, deleteUserProblem, exportProblems, loadProblem,
  } from './actions';
  import { PROBLEMS, getProblem, skeletonFor, type Problem, type ProblemTest } from '../lib/problems';

  let filter = $state('');
  let selectedId = $state<number | null>(app.problemId);
  let showSolution = $state(false);
  let adding = $state(false);

  let titleTr = $state('');
  let titleEn = $state('');
  let textTr = $state('');
  let textEn = $state('');
  let solution = $state('');
  let newTests = $state<ProblemTest[]>([{ name: 'Test 1', inputs: '', expected: '' }]);

  const all = $derived([...PROBLEMS, ...app.userProblems]);
  const filtered = $derived.by(() => {
    const q = filter.trim().toLocaleLowerCase();
    if (!q) return all;
    return all.filter((p) => `${p.titleTr} ${p.titleEn} ${p.textTr} ${p.textEn}`
      .toLocaleLowerCase().includes(q));
  });
  const selected = $derived(selectedId === null ? null : (all.find((p) => p.id === selectedId) ?? null));

  let lastProblemId = app.problemId;
  $effect(() => {
    if (app.problemId === lastProblemId) return;
    lastProblemId = app.problemId;
    if (app.problemId !== null) {
      selectedId = app.problemId;
      showSolution = false;
    } else {
      selectedId = null;
    }
  });

  function title(p: Problem): string {
    return app.lang === 'en' ? (p.titleEn || p.titleTr) : (p.titleTr || p.titleEn);
  }

  function text(p: Problem): string {
    return app.lang === 'en' ? (p.textEn || p.textTr) : (p.textTr || p.textEn);
  }

  function select(p: Problem): void {
    selectedId = p.id;
    showSolution = false;
  }

  function doLoad(p: Problem): void {
    const skel = skeletonFor(p);
    if (app.source.trim() !== '' && app.source !== skel) {
      if (!confirm(t(app.lang, 'confirmLoad'))) return;
    }
    loadProblem(p.id);
    selectedId = p.id;
  }

  function doDelete(p: Problem): void {
    if (!p.user) return;
    if (!confirm(t(app.lang, 'confirmDeleteQuestion'))) return;
    deleteUserProblem(p.id);
    if (selectedId === p.id) selectedId = null;
  }

  function openAdd(): void {
    titleTr = '';
    titleEn = '';
    textTr = '';
    textEn = '';
    solution = '';
    newTests = [{ name: 'Test 1', inputs: '', expected: '' }];
    adding = true;
  }

  function closeAdd(): void {
    adding = false;
  }

  function addTestRow(): void {
    newTests = [...newTests, { name: `Test ${newTests.length + 1}`, inputs: '', expected: '' }];
  }

  function removeTestRow(i: number): void {
    newTests = newTests.filter((_, k) => k !== i);
  }

  function saveProblem(e: SubmitEvent): void {
    e.preventDefault();
    if (!titleTr.trim() && !titleEn.trim()) return;
    const tests = newTests
      .filter((x) => x.expected !== '' || x.inputs !== '')
      .map((x, i) => ({ name: x.name || `Test ${i + 1}`, inputs: x.inputs, expected: x.expected }));
    addUserProblem({
      titleTr: titleTr || titleEn,
      titleEn: titleEn || titleTr,
      textTr,
      textEn: textEn || textTr,
      tests,
      solution,
    });
    const last = app.userProblems[app.userProblems.length - 1];
    if (last) selectedId = last.id;
    adding = false;
  }

  function onKey(e: KeyboardEvent): void {
    if (adding && e.key === 'Escape') closeAdd();
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="problems">
  <aside class="list-pane">
    <div class="list-head">
      <input
        class="input"
        type="search"
        bind:value={filter}
        placeholder={t(app.lang, 'filterProblems')}
        aria-label={t(app.lang, 'filterProblems')}
      />
    </div>
    <div class="list" role="listbox" aria-label={t(app.lang, 'problemsTitle')}>
      {#each filtered as p (p.id)}
        <button
          type="button"
          class="p-item"
          class:active={p.id === selectedId}
          role="option"
          aria-selected={p.id === selectedId}
          onclick={() => select(p)}
        >
          <span class="p-id mono">{p.id}</span>
          <span class="p-title">{title(p)}</span>
          {#if p.user}<span class="chip tiny">{t(app.lang, 'userQuestion')}</span>{/if}
        </button>
      {/each}
      {#if filtered.length === 0}
        <div class="empty-state">{t(app.lang, 'noFilterResults')}</div>
      {/if}
    </div>
    <div class="list-foot">
      <button class="btn small" type="button" onclick={openAdd}>{t(app.lang, 'addQuestion')}</button>
      <button class="btn small" type="button" onclick={exportProblems}>{t(app.lang, 'exportQuestions')}</button>
    </div>
  </aside>

  <section class="detail">
    {#if !selected}
      <div class="empty-state">{t(app.lang, 'noProblemSelected')}</div>
    {:else}
      {@const p = selected}
      <div class="detail-head">
        <h2 class="detail-title">{title(p)}</h2>
        <span class="chip tiny">{p.tests.length} {t(app.lang, 'testCount')}</span>
        <span class="spacer"></span>
        <button class="btn primary small" type="button" onclick={() => doLoad(p)}>{t(app.lang, 'loadProblem')}</button>
        {#if p.user}
          <button class="btn small" type="button" onclick={() => doDelete(p)}>{t(app.lang, 'deleteQuestion')}</button>
        {/if}
      </div>

      <p class="problem-text">{text(p)}</p>

      <div class="tests-mini">
        {#each p.tests as tc, i}
          <div class="mini-test">
            <span class="mini-name">{tc.name || `Test ${i + 1}`}</span>
            <span class="mini-label">{t(app.lang, 'inputs')}</span>
            <span class="mono mini-val">{tc.inputs || '—'}</span>
            <span class="mini-label">{t(app.lang, 'expected')}</span>
            <span class="mono mini-val">{tc.expected || '—'}</span>
          </div>
        {/each}
      </div>

      <div class="solution-area">
        <button class="btn small" type="button" onclick={() => (showSolution = !showSolution)}>
          {showSolution ? t(app.lang, 'hideSolution') : t(app.lang, 'showSolution')}
        </button>
        {#if showSolution}
          {#if p.solution}
            <div class="solution-note">{t(app.lang, 'solutionNote')}</div>
            <pre class="solution mono">{p.solution}</pre>
          {:else}
            <div class="empty-state">{t(app.lang, 'noSolution')}</div>
          {/if}
        {/if}
      </div>
    {/if}
  </section>
</div>

{#if adding}
  <div class="modal-backdrop" role="presentation">
    <div class="modal" role="dialog" aria-modal="true" aria-label={t(app.lang, 'addQuestionTitle')}>
      <h2>{t(app.lang, 'addQuestionTitle')}</h2>
      <form onsubmit={saveProblem}>
        <div class="grid2">
          <div class="field">
            <label for="p-ttr">{t(app.lang, 'questionTitleTr')}</label>
            <input id="p-ttr" class="input" bind:value={titleTr} />
          </div>
          <div class="field">
            <label for="p-ten">{t(app.lang, 'questionTitleEn')}</label>
            <input id="p-ten" class="input" bind:value={titleEn} />
          </div>
        </div>
        <div class="grid2">
          <div class="field">
            <label for="p-xtr">{t(app.lang, 'questionTextTr')}</label>
            <textarea id="p-xtr" class="textarea" rows="3" bind:value={textTr}></textarea>
          </div>
          <div class="field">
            <label for="p-xen">{t(app.lang, 'questionTextEn')}</label>
            <textarea id="p-xen" class="textarea" rows="3" bind:value={textEn}></textarea>
          </div>
        </div>

        <div class="field">
          <span class="field-label">{t(app.lang, 'testsTitle')}</span>
          {#each newTests as tc, i}
            <div class="test-row">
              <input class="input tname" bind:value={tc.name} placeholder={t(app.lang, 'name')} aria-label={t(app.lang, 'name')} />
              <input class="input" bind:value={tc.inputs} placeholder={t(app.lang, 'inputs')} aria-label={t(app.lang, 'inputs')} />
              <input class="input" bind:value={tc.expected} placeholder={t(app.lang, 'expected')} aria-label={t(app.lang, 'expected')} />
              <button class="btn small" type="button" onclick={() => removeTestRow(i)}>{t(app.lang, 'removeTest')}</button>
            </div>
          {/each}
          <div><button class="btn small" type="button" onclick={addTestRow}>{t(app.lang, 'addTest')}</button></div>
        </div>

        <div class="field">
          <label for="p-sol">{t(app.lang, 'reference')}</label>
          <textarea id="p-sol" class="textarea" rows="4" bind:value={solution} spellcheck="false"></textarea>
        </div>

        <div class="row">
          <button class="btn primary" type="submit">{t(app.lang, 'saveChanges')}</button>
          <button class="btn" type="button" onclick={closeAdd}>{t(app.lang, 'cancel')}</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .problems {
    flex: 1 1 auto;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(190px, 34%) minmax(0, 1fr);
  }

  .list-pane {
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--border);
    background: var(--bg-panel);
  }
  .list-head { padding: 6px; border-bottom: 1px solid var(--border); }
  .list { flex: 1 1 auto; overflow: auto; min-height: 0; }
  .list-foot { display: flex; gap: 4px; padding: 5px; border-top: 1px solid var(--border); flex-wrap: wrap; }

  .p-item {
    display: flex;
    align-items: baseline;
    gap: 6px;
    width: 100%;
    text-align: left;
    padding: 4px 7px;
    border: 0;
    border-bottom: 1px solid var(--border-muted);
    background: transparent;
    color: var(--text);
    font-size: 11.5px;
    cursor: pointer;
    border-radius: 0;
  }
  .p-item:hover { background: var(--bg-hover); }
  .p-item.active { background: var(--accent-soft); border-left: 2px solid var(--accent); padding-left: 5px; }
  .p-id { font-size: 9.5px; color: var(--text-faint); min-width: 18px; }
  .p-title { flex: 1 1 auto; }
  .chip.tiny { height: 15px; font-size: 9px; padding: 0 3px; }

  .detail {
    min-width: 0;
    min-height: 0;
    overflow: auto;
    padding: 9px 11px;
  }
  .detail-head { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 6px; }
  .detail-title { margin: 0; font-size: 13px; font-weight: 600; color: var(--text); }

  .problem-text {
    white-space: pre-wrap;
    margin: 0 0 8px;
    padding: 6px 8px;
    border-left: 2px solid var(--accent-line);
    background: var(--bg-panel);
    font-size: 12px;
    line-height: 1.5;
  }

  .tests-mini { display: flex; flex-direction: column; gap: 3px; margin-bottom: 8px; }
  .mini-test {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    align-items: baseline;
    border: 1px solid var(--border-muted);
    padding: 3px 6px;
    font-size: 11px;
  }
  .mini-name { font-weight: 600; font-size: 10.5px; }
  .mini-label { font-size: 9px; text-transform: uppercase; color: var(--text-faint); letter-spacing: 0.05em; }
  .mini-val { white-space: pre-wrap; color: var(--text-muted); }

  .solution-note { font-size: 10.5px; color: var(--text-faint); margin: 5px 0 3px; }
  .solution {
    margin: 0;
    padding: 6px 8px;
    border: 1px solid var(--border);
    background: var(--bg-sunken);
    white-space: pre-wrap;
    font-size: 11.5px;
    line-height: 1.5;
    color: var(--text);
  }

  .test-row { display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 4px; margin-bottom: 3px; }
  .tname { min-width: 60px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .field-label {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
</style>
