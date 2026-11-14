<script lang="ts">
  import { app } from './state.svelte.js';
  import { t } from './i18n';
  import { highlightLine } from '../lib/editor/highlight';
  import { toggleBreakpoint } from './actions';

  let ta = $state<HTMLTextAreaElement | null>(null);
  let overlay = $state<HTMLElement | null>(null);
  let gutter = $state<HTMLDivElement | null>(null);

  const lines = $derived(app.source.split('\n'));
  const digits = $derived(String(lines.length).length);
  const breakSet = $derived(new Set(app.breakpoints));
  const errorLine = $derived(app.error?.line ?? null);
  const activeLine = $derived(app.currentLine);
  const html = $derived(
    lines.map((ln, i) => {
      const cls = ['hl-line'];
      if (i + 1 === errorLine) cls.push('error');
      if (i + 1 === activeLine) cls.push('active');
      const body = highlightLine(ln);
      return `<span class="${cls.join(' ')}">${body}</span>`;
    }).join(''),
  );

  function syncScroll(): void {
    if (!ta) return;
    if (overlay) {
      overlay.scrollTop = ta.scrollTop;
      overlay.scrollLeft = ta.scrollLeft;
    }
    if (gutter) gutter.scrollTop = ta.scrollTop;
  }

  function updateCursor(): void {
    if (!ta) return;
    const pos = ta.selectionStart;
    const before = ta.value.slice(0, pos);
    const nl = before.lastIndexOf('\n');
    app.cursorLine = before.split('\n').length;
    app.cursorCol = pos - nl;
  }

  function replaceRange(start: number, end: number, text: string): void {
    if (!ta) return;
    ta.setRangeText(text, start, end, 'end');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    updateCursor();
    syncScroll();
  }

  function currentLineNo(): number {
    if (!ta) return 1;
    return app.source.slice(0, ta.selectionStart).split('\n').length;
  }

  function autoNumber(): void {
    if (!ta || ta.selectionStart !== ta.selectionEnd) return;
    const pos = ta.selectionStart;
    const lineStart = app.source.lastIndexOf('\n', pos - 1) + 1;
    const text = app.source.slice(lineStart, pos);
    const m = /^(\s*)(\d+(?:\.\d+)*)(?:\s*([-.)]))?(?=\s|$)/.exec(text);
    if (!m) return;
    const indent = m[1];
    const delim = m[3] ?? '';
    const segs = m[2].split('.').map((x) => Number(x));
    segs[segs.length - 1] += 1;
    const next = segs.join('.');
    const insert = `\n${indent}${next}${delim} `;
    replaceRange(pos, pos, insert);
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (!ta) return;
      replaceRange(ta.selectionStart, ta.selectionEnd, '    ');
      return;
    }
    if (e.key === 'Enter' && app.settings.autoNumber && !e.ctrlKey && !e.metaKey) {
      // Yalnızca basamak etiketli satır sonunda otomatik numaralandır.
      const pos = ta?.selectionStart ?? 0;
      const lineStart = app.source.lastIndexOf('\n', pos - 1) + 1;
      const lineEnd = app.source.indexOf('\n', pos);
      const atEnd = pos === (lineEnd === -1 ? app.source.length : lineEnd);
      const before = app.source.slice(lineStart, pos);
      if (ta && ta.selectionStart === ta.selectionEnd && atEnd
        && /^\s*\d+(?:\.\d+)*(?:\s*[-.)])?(?=\s|$)/.test(before)) {
        e.preventDefault();
        autoNumber();
      }
      return;
    }
    if (e.key === 'F9') {
      e.preventDefault();
      e.stopPropagation();
      toggleBreakpoint(currentLineNo());
    }
  }

  $effect(() => {
    // gotoNonce değişince istenen satıra git.
    void app.gotoNonce;
    if (!ta || app.gotoNonce === 0) return;
    const target = Math.min(Math.max(1, app.gotoLine), Math.max(1, app.source.split('\n').length));
    const parts = app.source.split('\n');
    let off = 0;
    for (let i = 0; i < target - 1; i++) off += parts[i].length + 1;
    ta.focus();
    ta.setSelectionRange(off, off + parts[target - 1].length);
    updateCursor();
    syncScroll();
  });
</script>

<div class="editor">
  <div
    class="gutter"
    bind:this={gutter}
    style={`width:${18 + digits * 8 + 10}px`}
    aria-hidden="false"
  >
    {#each lines as _ln, i}
      <button
        class="gutter-line"
        class:error={i + 1 === errorLine}
        class:active={i + 1 === activeLine}
        type="button"
        tabindex="-1"
        title={t(app.lang, 'breakpointHint')}
        aria-label={`${t(app.lang, 'breakpoints')}: ${i + 1}`}
        aria-pressed={breakSet.has(i + 1)}
        onclick={() => toggleBreakpoint(i + 1)}
      >
        <span class="bp" aria-hidden="true">{breakSet.has(i + 1) ? '●' : ''}</span>
        <span class="lnum">{i + 1}</span>
      </button>
    {/each}
  </div>

  <div class="code-area">
    <pre class="overlay" bind:this={overlay} aria-hidden="true">{@html html}</pre>
    <textarea
      class="code-text"
      bind:this={ta}
      bind:value={app.source}
      aria-label={t(app.lang, 'raven')}
      spellcheck="false"
      autocapitalize="off"
      autocomplete="off"
      autocorrect="off"
      wrap="off"
      tabindex="0"
      onkeydown={onKeydown}
      oninput={updateCursor}
      onscroll={syncScroll}
      onclick={updateCursor}
      onkeyup={updateCursor}
      onselect={updateCursor}
    ></textarea>
  </div>
</div>

<style>
  .editor {
    flex: 1 1 auto;
    min-height: 0;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    overflow: hidden;
    background: var(--bg);
  }

  .gutter {
    min-height: 0;
    overflow: hidden;
    border-right: 1px solid var(--border-muted);
    background: var(--bg-sunken);
    padding: 8px 0;
    user-select: none;
  }

  .gutter-line {
    width: 100%;
    height: var(--line-h);
    line-height: var(--line-h);
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 0 6px 0 0;
    color: var(--text-faint);
    font-family: var(--font-code);
    font-size: 11px;
    white-space: nowrap;
    border: 0;
    background: transparent;
    text-align: right;
    cursor: pointer;
  }
  .gutter-line:hover { background: var(--bg-hover); }
  .gutter-line.active { background: var(--accent-soft); color: var(--accent); }
  .gutter-line.error { color: var(--err); font-weight: 700; text-decoration: underline; }

  .bp {
    width: 12px;
    height: var(--line-h);
    color: var(--accent);
    font-size: 10px;
    line-height: var(--line-h);
    flex: 0 0 12px;
  }
  .lnum { flex: 1 1 auto; text-align: right; }

  .code-area {
    position: relative;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .overlay,
  .code-text {
    position: absolute;
    inset: 0;
    margin: 0;
    padding: 8px 10px 24px;
    font-family: var(--font-code);
    font-size: var(--code-size);
    line-height: var(--line-h);
    letter-spacing: 0;
    tab-size: 4;
    white-space: pre;
    overflow-wrap: normal;
    border: 0;
  }

  .overlay {
    z-index: 0;
    overflow: hidden;
    pointer-events: none;
    color: var(--text);
    background: transparent;
  }
  .overlay :global(.hl-line) {
    display: block;
    min-height: var(--line-h);
    line-height: var(--line-h);
  }
  .overlay :global(.hl-line.active) {
    background: var(--accent-soft);
    border-left: 2px solid var(--accent);
    margin-left: -2px;
  }
  .overlay :global(.hl-line.error) {
    background: var(--err-soft);
    border-left: 2px solid var(--err);
    margin-left: -2px;
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 2px;
  }

  .overlay :global(.tok-kw) { color: var(--accent); font-weight: 600; }
  .overlay :global(.tok-str) { color: var(--text); }
  .overlay :global(.tok-num) { color: var(--text-muted); }
  .overlay :global(.tok-var) { color: var(--text); }
  .overlay :global(.tok-op) { color: var(--text-muted); }
  .overlay :global(.tok-plain) { color: var(--text); }
  .overlay :global(.tok-com) { color: var(--text-faint); font-style: italic; }

  .code-text {
    z-index: 1;
    color: transparent;
    background: transparent;
    caret-color: var(--text);
    resize: none;
    outline: none;
    overflow: auto;
  }
  .code-text:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
  .code-text::selection {
    background: color-mix(in srgb, var(--accent) 30%, transparent);
    color: transparent;
  }
</style>
