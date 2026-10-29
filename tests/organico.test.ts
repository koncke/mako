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
//   5. CON VARIAS CUENTAS, la que se nombra; una nombrada que no está es un error con las conectadas (no los números de otra).
//   6. EL DÍA DE CADA POST, en la zona del negocio (Zernio lo manda en UTC).
//   7. MIENTRAS ZERNIO SINCRONIZA manda 0: ese post va sin números y dicho. Lo que Zernio dice que no entregó, también dicho.
//   8. CON LA CLAVE DE LA CUENTA DE MaKo (el ws 1, o la prestada), ni «tu cuenta» ni quién paga; tampoco en Conectar.
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
// ROTO 28/10 noche (los arreglos de la verificación, con este test y el de reglas: 21 pases y 0 fallos como está):
//   · la fecha del post cortada en UTC                                     → 20 / 1
//   · un post sin sincronizar con sus ceros                                → 19 / 2
//   · lo no entregado sin decirlo                                          → 20 / 1
//   · una cuenta nombrada que no está cae a la primera                     → 20 / 1
//   · con la clave de MaKo, los textos del negocio                         → 20 / 1
//   · Conectar: la cuenta prestada no es «de la casa» (lib/zernio-conectar) → 20 / 1
// Y sin la ruta REST de programar_publicacion, tests/api-mako-rest.test.ts da 6 / 2.
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

// ── La verificación del 28/10 (C:/dev/revisiones/2810-verificacion-zernio-bef5bfcd3.md) ──────────────────────────────────────

test('la fecha de cada post es el día en la zona del negocio: lo publicado de noche no cae al día siguiente', () => {
  assert.deepEqual(R.h.publicaciones.map((p: { fecha: string }) => p.fecha), ['2026-10-28', '2026-10-27', '2026-10-27']);
});

test('un post que Zernio todavía no sincronizó va sin números y DICHO; un 0 sincronizado queda en 0', () => {
  const ps = R.i.publicaciones as Array<{ alcance: number | null; vistas: number | null; sin_metricas?: string }>;
  assert.deepEqual(ps.map((p) => p.alcance), [null, 0, null, null]);
  assert.equal(ps[0].vistas, null);
  assert.match(ps[0].sin_metricas ?? '', /todavía no las trajo/);
  assert.equal(ps[1].sin_metricas, undefined);
  assert.match(ps[2].sin_metricas ?? '', /Instagram no las entrega/);
  assert.ok((R.i.faltan as string[]).some((f) => /2 todavía no tienen métricas en Zernio/.test(f)), JSON.stringify(R.i.faltan));
  assert.ok((R.i.faltan as string[]).some((f) => /de una, Instagram no entrega métricas/.test(f)));
});

test('lo que Zernio dice que no entregó va null y DICHO, con su motivo', () => {
  assert.deepEqual(R.j.seguidores, { actual: null, ganados: null, perdidos: null });
  assert.ok((R.j.faltan as string[]).includes('Los seguidores: el total de seguidores no vino de Instagram (motivo de Zernio: not_enrolled).'), JSON.stringify(R.j.faltan));
});

test('una cuenta nombrada que no está no contesta con los números de otra', () => {
  assert.equal(R.k.r.motivo, 'sin-cuenta');
  assert.match(R.k.r.error, /@otra\.cuentaa no está conectada/);
  assert.match(R.k.r.error, /@negocio\.prueba, @otra\.cuenta\./);
  assert.equal(R.k.pedidos, 0);
});

test('con la clave de la cuenta de MaKo (el ws 1, o la cuenta prestada) el 402 no le habla de «tu cuenta» ni de quién paga', () => {
  for (const r of [R.l.ws1, R.l.prestada]) {
    assert.equal(r.motivo, 'sin-analytics', JSON.stringify(r));
    assert.match(r.error, /Lo resuelve el equipo de MaKo/);
    assert.doesNotMatch(r.error, /tu cuenta|lo paga el negocio/);
  }
  assert.deepEqual(R.l.clavesPrestada, ['sk_zernio_de_la_plataforma']);
});

test('Conectar: con la cuenta prestada, un 402 es un error genérico y sin el link de pago de MaKo; con la propia, su cuenta pausada', () => {
  assert.deepEqual(R.m.conectarPrestada, { motivo: 'error', pagoUrl: null });
  assert.equal(R.m.conectarPropia?.motivo, 'pausada');
});
