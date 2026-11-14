/**
 * Dosya erişimi.
 *
 * Tauri: Rust tarafındaki `open_alg`, `save_alg`, `save_text_file`,
 * `save_binary_file` komutları yerel diyalogları açar. Tarayıcı önizlemesinde
 * (pnpm dev) dosya seçici / indirme ile aynı işlevselliğin sade bir yedeği
 * kullanılır.
 */

import { invoke } from '@tauri-apps/api/core';

export interface OpenResult {
  path: string;
  content: string;
  sidecar: string | null;
}

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function download(name: string, blob: Blob): string {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return name;
}

function ensureExt(name: string, ext: string): string {
  return name.toLowerCase().endsWith(ext) ? name : `${name}${ext}`;
}

function filterLabel(ext: string): string {
  return ext.replace(/^\./, '').toUpperCase();
}

/** .alg dosyası açar; Tauri'de yanındaki .alg.json varsa onu da döndürür. */
export async function openAlgFile(): Promise<OpenResult | null> {
  if (isTauri()) {
    return await invoke<OpenResult | null>('open_alg');
  }
  return await new Promise<OpenResult | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.alg,.txt,text/plain';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) { resolve(null); return; }
      resolve({ path: f.name, content: await f.text(), sidecar: null });
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

/** .alg + yan dosyayı kaydeder. Dönüş: gerçek dosya yolu (tarayıcıda ad). */
export async function saveAlgFile(
  path: string | null,
  defaultName: string,
  content: string,
  sidecar: string | null,
): Promise<string | null> {
  const name = ensureExt(defaultName || 'adsiz', '.alg');
  if (isTauri()) {
    return await invoke<string | null>('save_alg', {
      path, defaultName: name, content, sidecar,
    });
  }
  const saved = download(name, new Blob([content], { type: 'text/plain;charset=utf-8' }));
  if (sidecar) {
    // Tarayıcı önizlemesinde ikinci indirme; Tauri'de Rust tarafı otomatik yazar.
    setTimeout(() => download(`${name}.json`, new Blob([sidecar], { type: 'application/json' })), 100);
  }
  return saved;
}

/** Metin dosyası (JSON / SVG) kaydeder. */
export async function saveTextFile(
  defaultName: string,
  content: string,
  filterName: string,
  ext: string,
): Promise<string | null> {
  const name = ensureExt(defaultName, ext);
  if (isTauri()) {
    return await invoke<string | null>('save_text_file', {
      defaultName: name, content, filterName: filterLabel(ext), ext,
    });
  }
  return download(name, new Blob([content], { type: `${filterName};charset=utf-8` }));
}

/** İkili dosya (PNG) kaydeder. */
export async function saveBinaryFile(
  defaultName: string,
  bytes: Uint8Array,
  filterName: string,
  ext: string,
): Promise<string | null> {
  const name = ensureExt(defaultName, ext);
  if (isTauri()) {
    return await invoke<string | null>('save_binary_file', {
      defaultName: name, bytes: Array.from(bytes), filterName: filterLabel(ext), ext,
    });
  }
  return download(name, new Blob([bytes as unknown as BlobPart], { type: filterName }));
}
