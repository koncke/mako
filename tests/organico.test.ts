// =============================================================================
// Instagram orgánico por Zernio, de punta a punta (28/10/2026)
// =============================================================================
// Martín a Teo (28/10, 00:16:26): «por WhatsApp preguntás cómo vienen las últimas publicaciones de Instagram». Lo de abajo
// corre la operación `ver_rendimiento_redes` y lib/zernio-organico.ts REALES en un node aparte (tests/_organico-hijo.ts),
// sobre la base y Zernio de mentira, en el ws 3. Lo que tiene que pasar:
//
//   1. LEE LA CUENTA CONECTADA, en el rango pedido: la cuenta (total_value), los seguidores (serie) y las publicaciones.
//   2. «NO PUDE LEER» NO ES «CERO»: lo que falta es null y va dicho en `faltan`; una lectura que falla no tumba a las otras.
//   3. EL COMPLEMENTO DE ANALYTICS (pago, de Zernio): sin él, se dice en palabras y no se inventa nada.
//   4. SIN INSTAGRAM CONECTADO, se dice; un rango de más de 89 días se corta ANTES de llamar a Zernio.
//   5. CON VARIAS CUENTAS, la que se nombra.
//
// Probado ROMPIÉNDOLO (28/10/2026), una rotura por vez y restaurando, con este test y tests/organico-reglas.test.ts (11 pases
// y 0 fallos con el código como está). Rota:
//   · una métrica que no vino da 0                                         → 10 / 1
//   · una respuesta sin lista es «no hay publicaciones»                    → 9 / 2
//   · el 402 del complemento como un error cualquiera                      → 9 / 2
//   · sin el tope de 89 días                                               → 9 / 2
//   · tres fallas iguales como tres líneas sueltas                         → 10 / 1
//   · una lectura que falla tumba a las otras (Promise.all)                → 7 / 4
//   · con varias cuentas, siempre la primera                               → 10 / 1
//
// Correr: node --import tsx --test tests/organico.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_organico-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 120_000,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;

test('el hijo corrió entero y no salió a la red', () => {
  assert.equal(R.tiro, undefined, String(R.tiro));
  assert.deepEqual(R.red, []);
});

test('lee la cuenta conectada en el rango: la cuenta, los seguidores y las publicaciones', () => {
  const a = R.a.r;
  assert.equal(a.cuenta, '@negocio.prueba');
  assert.deepEqual([a.desde, a.hasta], ['2026-10-01', '2026-10-28']);
  assert.deepEqual(a.seguidores, { actual: 1012, ganados: 40, perdidos: 8 });
  assert.equal(a.cuenta_metricas.alcance, 1520);
  assert.equal(a.cuenta_metricas.vistas, 4300);
  assert.deepEqual(a.publicaciones.map((p: { tipo: string }) => p.tipo), ['story', 'reel'], 'de la más nueva a la más vieja');
  assert.equal(a.publicaciones[1].link, 'https://www.instagram.com/reel/a/');
  assert.deepEqual(a.faltan, []);
  const p = R.a.pedidos as string[];
  const de = (ruta: string) => p.find((x) => x.startsWith(`GET ${ruta}?`)) ?? '';
  for (const ruta of ['/analytics/instagram/account-insights', '/analytics/instagram/follower-history', '/analytics']) {
    const q = new URLSearchParams(de(ruta).split('?')[1]);
    assert.equal(q.get('accountId'), 'acc_ig_1', ruta);
    assert.deepEqual([q.get('fromDate'), q.get('toDate')], ['2026-10-01', '2026-10-28'], ruta);
  }
  assert.equal(new URLSearchParams(de('/analytics/instagram/account-insights').split('?')[1]).get('metricType'), 'total_value');
  assert.equal(new URLSearchParams(de('/analytics/instagram/follower-history').split('?')[1]).get('metricType'), 'time_series');
  assert.equal(new URLSearchParams(de('/analytics').split('?')[1]).get('platform'), 'instagram');
});

test('lo que no vino es null, nunca 0, y una lectura que falla no tumba a las otras', () => {
  assert.equal(R.a.r.cuenta_metricas.guardados, null, 'saves no vino: null');
  assert.equal(R.a.r.publicaciones[0].vistas, null);
  assert.equal(R.c.seguidores, null);
  assert.equal(R.c.cuenta_metricas.alcance, 1520);
  assert.equal(R.c.publicaciones.length, 2);
  assert.equal(R.c.faltan.length, 1);
  assert.match(R.c.faltan[0], /^Los seguidores: /);
  assert.equal(R.e.publicaciones, null, 'una respuesta sin lista no es «no hay publicaciones»');
  assert.match(R.e.faltan[0], /^Las publicaciones: Zernio contestó algo que MaKo no sabe leer/);
});

test('sin el complemento de Analytics, se dice en palabras', () => {
  assert.deepEqual(R.b, { error: 'La cuenta de Zernio no tiene el complemento de Analytics: sin él, Zernio no entrega las métricas de Instagram. Se activa desde tu cuenta de Zernio (en sus planes, el complemento «Analytics») y lo paga el negocio.', motivo: 'sin-analytics' });
});

test('sin Instagram conectado se dice, y un rango de más de 89 días no llama a Zernio', () => {
  assert.equal(R.d.motivo, 'sin-cuenta');
  assert.match(R.f.r.errorDeLectura, /89 días/);
  assert.equal(R.f.pedidos, 0);
});

test('con varias cuentas, la que se nombra', () => {
  assert.equal(R.g.r.cuenta, '@otra.cuenta');
  assert.ok((R.g.pedidos as string[]).every((x) => x.includes('accountId=acc_ig_2')));
});
