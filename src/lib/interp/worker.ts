/// <reference lib="webworker" />
/**
 * Yorumlayıcı Web Worker'ı.
 *
 * Bir worker tek bir iş yapar: çalıştırma (adım/adım-durdur), test partisi veya
 * referans karşılaştırma. UI "Durdur" dediğinde worker'ı sonlandırır; böylece
 * sonsuz döngü arayüzü asla kilitlemez.
 *
 * Mesaj işleme mantığı `workerHost.ts` içindedir.
 */

import { createWorkerHost } from './workerHost';
import type { ToWorker } from './protocol';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

const handle = createWorkerHost((msg) => ctx.postMessage(msg));

ctx.onmessage = (ev: MessageEvent<ToWorker>) => handle(ev.data);
