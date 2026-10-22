// =============================================================================
// El Uso nunca esconde el último número (22/10/2026): lo que, roto, no da error
// =============================================================================
// Martín, con una captura: «Cuando no mide hace mucho tiempo no debería desaparecer los % de uso que tenía la última vez...
// Porque el caso de Leandro 2, esa cuenta ya estaba al 99% semanal, y ahora ya no aparece. Eso no me gusta, no puedo ver
// qué cuentas ya no me queda espacio...». La tarjeta de claude4 decía «Sin medir hace 14 h» con las barras vacías.
//
// MEDIDO (22/10/2026, 14:47 UTC, `operaciones_carteros` de producción): la medición NO se borraba. La fila de claude4 tenía
// `{ cinco: 11% (reinicio 22/10 01:59 UTC), semana: 99% (reinicio 27/10 19:59 UTC), medido: 22/10 00:44 UTC }`; `cicloCartero`
// sólo escribe la cuota cuando llega una nueva. La escondía la pantalla: pasadas las 6 h (USO_VENCIDO_MS) `Barra` dibujaba
// ancho 0 y «Sin medir hace X». El caso de abajo es esa fila, tal cual.
//
// Lo que se fija:
//   1. la tarjeta vieja muestra el último número de cada ventana, con su barra y su edad al lado, en gris, sin «usado»;
//   2. una ventana ya reiniciada muestra su último número y «Se reinició … (sin medir desde entonces)»;
//   3. SIN el chip «Sin lugar» (22/10/2026, Martín: «No pongas el chip de "Sin lugar", no necesito eso»): la semana llena se ve
//      por su número y su barra roja, y la tarjeta no lleva marca aparte;
//   4. lo que DECIDE con el número (el botón, «Automático») sigue sin usar lo reiniciado ni lo vencido.
//
// Probado ROMPIÉNDOLO (22/10/2026), con este archivo, tests/centro-uso.test.ts y tests/centro-ops5.test.ts en verde, una rotura
// por vez (el script restaura byte a byte y lo comprueba en un finally):
//   · `Barra` con el ancho y el número de `v.pct` en vez de `v.ultimo` (lo reiniciado vuelve a 0) → 2 fallos (2 y 3);
//   · el chip «Sin lugar» de vuelta en la tarjeta → 1 fallo (3);
//   · la edad sólo en la vencida (`u.vencido` en vez de `u.viejo`) → 1 fallo (el desplegable de centro-uso.test.ts);
//   · `usoDeCuenta` devolviendo `pct: v.pct` aunque haya pasado el reinicio → 3 fallos (4, y dos de centro-uso.test.ts).
//   Restaurado: todo en verde.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cuentasDeUso, textoReinicioPasado, usoDeCuenta, usoPrincipal, type Cuota } from '../lib/centro-uso';
import { libreDe } from '../lib/centro-cuentas';
import { ListaUso } from '../app/admin/operaciones/Uso';

// 22/10/2026 a las 11:47 de Argentina: cuando Martín mandó la captura.
const AHORA = Date.parse('2026-10-22T14:47:52Z');
// La fila de claude4 en producción a esa hora.
const LEANDRO_2: Cuota = {
  cinco: { pct: 11, reinicia: '2026-10-22T01:59:59.656Z' },
  semana: { pct: 99, reinicia: '2026-10-27T19:59:59.656Z' },
  medido: '2026-10-22T00:44:17.966Z',
};
const tarjetas = (h: string) => h.split('<section').slice(1).map((s) => `<section${s}`.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
const dibujar = (cuota: Cuota | null) =>
  renderToStaticMarkup(createElement(ListaUso, { cuentas: cuentasDeUso([{ cuenta: 'claude4', vistoAt: new Date(AHORA).toISOString(), cuota }], ['claude4']), ahora: AHORA }));

test('1: la cuenta sin medir hace 14 h muestra su último número, con la barra y la edad al lado, y no lo lee como de ahora', () => {
  const h = dibujar(LEANDRO_2);
  const [t] = tarjetas(h);
  assert.match(t, /Semana 99% · medido hace 14 h Se reinicia el mar 27 a las 16:59/);
  assert.doesNotMatch(t, /Sin medir/, 'nada de «Sin medir hace X»');
  assert.doesNotMatch(t, /% usado|Medido hace/, 'vieja: ni «usado» ni el renglón de la medición al día');
  assert.match(h, /co-uso__lleno--mal" style="width:99%"/, 'la barra de la semana, llena y en rojo');
  assert.match(h, /co-uso__edad/, 'la edad va en gris');
  // Al día (5 min), como siempre: «usado» y el renglón de abajo.
  const fresca = tarjetas(dibujar({ ...LEANDRO_2, medido: new Date(AHORA - 5 * 60_000).toISOString(), cinco: null }))[0];
  assert.match(fresca, /Semana 99% usado .*Medido hace 5 min$/);
});

test('2: una ventana ya reiniciada muestra su último número y desde cuándo no se mide', () => {
  const h = dibujar(LEANDRO_2);
  const [t] = tarjetas(h);
  assert.match(t, /Sesión de 5 horas 11% · medido hace 14 h Se reinició ayer a las 22:59 \(sin medir desde entonces\)/);
  assert.match(h, /co-uso__ventana--vencida.*co-uso__lleno--apagado" style="width:11%"/, 'apagada, pero con su ancho');
  assert.equal(textoReinicioPasado(Date.parse('2026-10-22T09:00:00Z'), AHORA), 'hoy a las 06:00');
  assert.equal(textoReinicioPasado(Date.parse('2026-10-20T09:00:00Z'), AHORA), 'el mar 20 a las 06:00');
});

test('3: sin el chip «Sin lugar»: la semana al 99% se ve por su número y su barra roja', () => {
  const h = dibujar(LEANDRO_2);
  assert.match(tarjetas(h)[0], /^Cuenta 4 /);
  assert.doesNotMatch(h, /Sin lugar|sin-lugar/, 'Martín, 22/10: «No pongas el chip de "Sin lugar", no necesito eso»');
  assert.match(h, /<section class="co-uso__cuenta" aria-label=/, 'la tarjeta sin marca aparte');
  assert.match(h, /co-uso__lleno--mal" style="width:99%"/);
  const reiniciada = dibujar({ ...LEANDRO_2, semana: { pct: 99, reinicia: '2026-10-22T12:00:00Z' } });
  assert.match(tarjetas(reiniciada)[0], /Semana 99% · medido hace 14 h Se reinició hoy a las 09:00 \(sin medir desde entonces\)/);
});

test('4: lo que DECIDE con el número sigue sin usar lo reiniciado ni lo vencido', () => {
  const u = usoDeCuenta(LEANDRO_2, AHORA);
  assert.equal(u.cinco?.pct, null, 'la 5 horas ya se reinició: no vale para decidir');
  assert.equal(u.cinco?.ultimo, 11, 'pero se dibuja');
  assert.equal(u.semana?.pct, 99);
  assert.equal(u.vencido, true);
  assert.equal(usoPrincipal([{ cuenta: 'claude4', cuota: LEANDRO_2 }], AHORA), null, 'el botón no usa una medición vencida');
  // «Automático» elige por lo libre: la 5 horas reiniciada cuenta como libre (0%), la semana 99% manda.
  assert.equal(libreDe(LEANDRO_2, AHORA), 1);
});

test('sin ninguna medición, lo de siempre: la cuenta no inventa un número', () => {
  const [t] = tarjetas(dibujar(null));
  assert.doesNotMatch(t, /%/);
});
