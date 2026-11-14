// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import { mount, unmount } from 'svelte';
import App from '../App.svelte';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
  (globalThis as unknown as { requestAnimationFrame: (cb: () => void) => number })
    .requestAnimationFrame = (cb) => setTimeout(cb, 0) as unknown as number;
  class FakeWorker {
    onmessage: ((ev: MessageEvent) => void) | null = null;
    onerror: ((ev: ErrorEvent) => void) | null = null;
    postMessage(): void {}
    terminate(): void {}
  }
  (globalThis as unknown as { Worker: typeof FakeWorker }).Worker = FakeWorker;
});

describe('uygulama kabuğu', () => {
  it('araç çubuğu, editör ve sekmeleri bağlar', async () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const instance = mount(App, { target });
    await new Promise((r) => setTimeout(r, 0));
    expect(target.querySelector('.toolbar')).toBeTruthy();
    expect(target.querySelector('textarea.code-text')).toBeTruthy();
    expect(target.querySelectorAll('[role="tab"]').length).toBe(5);
    expect(target.querySelector('.statusbar')).toBeTruthy();
    unmount(instance);
    target.remove();
  });

  it('bellek, test, akış ve sorular sekmeleri açılır', async () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const instance = mount(App, { target });
    await new Promise((r) => setTimeout(r, 0));

    const clickTab = async (id: string) => {
      const btn = target.querySelector<HTMLButtonElement>(`[data-tab="${id}"]`);
      expect(btn).toBeTruthy();
      btn!.click();
      await new Promise((r) => setTimeout(r, 5));
    };

    await clickTab('memory');
    expect(target.querySelector('#panel-memory .memory-panel')).toBeTruthy();

    await clickTab('tests');
    expect(target.querySelector('#panel-tests .tests')).toBeTruthy();

    await clickTab('flow');
    expect(target.querySelector('#panel-flow .flow')).toBeTruthy();
    expect(target.querySelector('#panel-flow svg')).toBeTruthy();

    await clickTab('problems');
    expect(target.querySelectorAll('#panel-problems .p-item').length).toBeGreaterThan(20);

    unmount(instance);
    target.remove();
  });
});
