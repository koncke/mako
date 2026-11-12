// =============================================================================
// El crédito de Claude del espacio de MaKo NO lo gasta un negocio (11/11/2026) — probado rompiéndolo, con lo de verdad
// =============================================================================
// Martín, 11/11/2026: «gastemos eso para todo esto en lugar de Gemini, porque es mucho más estable», y lo que NO cambia: cada
// cliente fuera de WhatsApp sigue con su propia IA. La frontera es «es la plataforma», calculado en la puerta
// (lib/anthropic.ts → `esElEspacioDeLaPlataforma`). Este test la corre de verdad (tests/_credito-plataforma-hijo.ts), con las
// claves del crédito cargadas, por los cuatro caminos que la usan: la cascada de texto (`spy`), la de herramientas (`mako-doer`),
// la lectura de imágenes (`mako-chat`) y la puerta 2 forzada con una cuenta.
//   1. desde un negocio (ws13): 0 llamadas al crédito y 0 filas con su marca;
//   2. desde el ws1 (OWNER_WS, Mauricio, donde cae un cron sin cookie) y sin ningún workspace: lo mismo;
//   3. el control: en el ws9 sí, por los cuatro caminos (sin esto, un «cero» podría no estar midiendo nada).
//
// Probado rompiéndolo (11/11/2026, una rotura por vez, restaurada): ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

type Medida = Record<'texto' | 'herramientas' | 'imagen' | 'puertaForzada', { credito: number; filas: number; r: string }>;
let cache: (Record<'ws13' | 'ws1' | 'sinWorkspace' | 'ws9', Medida> & { error?: string }) | null = null;
function correr() {
  if (cache) return cache;
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--conditions=react-server', fileURLToPath(new URL('./_credito-plataforma-hijo.ts', import.meta.url))], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 180_000 });
  const linea = (r.stdout ?? '').split('\n').find((l) => l.startsWith('@@FRONTERA@@'));
  assert.ok(linea, `el hijo no contestó (status ${r.status}): ${(r.stderr ?? '').slice(-1500)}`);
  cache = JSON.parse(linea.slice('@@FRONTERA@@'.length));
  assert.equal(cache!.error, undefined, String(cache!.error));
  return cache!;
}
const ceros = (m: Medida, quien: string) => {
  for (const [camino, v] of Object.entries(m)) {
    assert.equal(v.credito, 0, `${quien}, ${camino}: llamó al crédito de Claude de la plataforma (${v.r})`);
    assert.equal(v.filas, 0, `${quien}, ${camino}: dejó una fila con la marca del crédito`);
  }
  assert.equal(m.puertaForzada.r, 'sin permiso', `${quien}: la puerta 2 entregó una cuenta del crédito a quien no es la plataforma`);
};

test('1. un negocio (ws13) no gasta el crédito por ningún camino, aunque pida una cuenta a la fuerza', () => {
  ceros(correr().ws13, 'el ws13');
});

test('2. el ws1 (OWNER_WS, Mauricio: donde cae un cron sin cookie) y un pedido sin workspace, tampoco', () => {
  const r = correr();
  ceros(r.ws1, 'el ws1');
  ceros(r.sinWorkspace, 'sin workspace');
});

test('3. el control: en el espacio de MaKo (ws9) los cuatro caminos sí usan el crédito', () => {
  const r = correr().ws9;
  assert.deepEqual(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.credito])), { texto: 1, herramientas: 1, imagen: 1, puertaForzada: 0 },
    'en el ws9 algún camino no fue primero con el crédito');
  assert.equal(r.texto.r, 'respuesta del crédito');
  assert.equal(r.herramientas.r, 'respuesta del crédito');
  assert.equal(r.imagen.r, 'respuesta del crédito');
  assert.match(r.puertaForzada.r, /^PERMISO 2$/);
  for (const k of ['texto', 'herramientas', 'imagen'] as const) assert.equal(r[k].filas, 1, `el ws9, ${k}: el gasto del crédito no quedó con su marca`);
});

// ── Probado rompiéndolo (11/11/2026; cada rotura sola, restaurada después) ──────────────────────────────────────────────
//   F1 `esElEspacioDeLaPlataforma` → `return true` (un dato fijo en vez del workspace en curso)     → fallan el 1 y el 2
//   F2 «es la plataforma» comparado con OWNER_WS (el ws1) en vez de `wsSuperAdmin()`              → fallan el 2 y el 3
//   F3 la puerta 2 con `esLaPlataforma: true` fijo (sin preguntar el workspace)                     → fallan el 1 y el 2 (la puerta forzada)
//   F4 la cascada de texto sin el crédito primero                                                  → falla el 3
