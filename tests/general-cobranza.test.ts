// =============================================================================
// «A quién cobrarle» en la tab General (reunión con Mauricio del 12/10/2026, Fathom 858927676, 86:17: «Número tres, en
// la tab general, la cobranza»). La lista del teléfono en escritorio: la misma lectura, el mismo renglón y la misma
// acción (app/general/Cobranza.tsx, `leerAQuienCobrar` en lib/datos-comercial-server.ts, `marcarPagoAction`).
// =============================================================================
// Probado ROMPIÉNDOLO (13/10/2026), con la base en verde y restaurando de memoria: los números van en el comentario
// de cada test. Re-probado el 14/10/2026 al mudarse a app/general/piezas.tsx (base 4 / 0): el renglón con `—` da
// 3 / 1, y el bloque sin su `error` da 3 / 1. Y otra vez el mismo día, al pasar los bloques a datos
// (app/general/datos.ts + app/general/bloques/Negocio.tsx; base 4 / 0): el renglón con `—` → 3 / 1, y la lectura
// caída dibujada con `error={null}` → 3 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

// Desde el 14/10/2026 la lista es un BLOQUE del editor de General (lib/general-piezas.ts): el server lee sus datos en
// app/general/datos.ts y el bloque se dibuja en app/general/bloques/Negocio.tsx.
const PAGINA = sinComentarios(leer('app/general/datos.ts'));
const BLOQUE = sinComentarios(leer('app/general/bloques/Negocio.tsx'));
const LISTA = sinComentarios(leer('app/general/Cobranza.tsx'));

// Rotura: renglón distinto en General (`· vence` → `— vence`): 1 fallo.
test('el renglón de cada cuota es el MISMO que el del teléfono', () => {
  const renglon = /linea: (`\$\{fmtValor\(f\.cuota\.monto, 'usd'\)\}[^`]*`)/;
  const deGeneral = renglon.exec(PAGINA)?.[1];
  const delTelefono = renglon.exec(sinComentarios(leer('app/m/dashboard/datos.ts')))?.[1];
  assert.ok(deGeneral && delTelefono, 'no encontré el renglón en alguno de los dos');
  assert.equal(deGeneral, delTelefono);
});

// Desde el 14/10/2026 «A quién cobrarle» es un bloque que la persona pone, saca y acomoda en su General (el editor del
// Dashboard con su informe): se dibuja donde lo puso, y vacío lo dice («Nadie con cuotas por cobrar.», ./Cobranza.tsx).
// Roturas (base en verde): la lectura con una ventana (`c.hoy, desde, hasta`): 1 fallo. Sin el error al bloque (una
// lectura caída dibujada como «nadie debe»): 1 fallo.
test('la lectura es TODO lo pendiente, y una lectura caída se dice en el bloque', () => {
  const lib = sinComentarios(leer('lib/datos-comercial-server.ts'));
  const fn = lib.slice(lib.indexOf('export async function leerAQuienCobrar'), lib.indexOf('export async function leerComercial'));
  assert.match(fn, /getOutstandingDetalle\(c\.hoy, null, null\)/);
  assert.match(fn, /armarCobranza\(out\.items, c\.hoy\)\.filas/);
  assert.match(PAGINA, /const cobranzaLeida = leerAQuienCobrar\(\);/);
  assert.match(PAGINA, /cobranza: !cobranza\.ok \? \{ ok: false, error: 'No pude leer la cobranza\.' \} : \{/);
  assert.match(BLOQUE, /if \(!d\.ok\) return <Cobranza filas=\{\[\]\} tz="" error=\{d\.error\} alcance=\{nombreFunnel\} \/>;/);
});

// Roturas: marcar sin `hoyEnTz(tz)` (la fecha en null): 1 fallo. Sin el candado `enCurso`: 1 fallo.
test('«Marcar cobrada» es la acción de siempre, con HOY en la zona del negocio, un clic a la vez y con Deshacer', () => {
  assert.match(LISTA, /await marcarPagoAction\(f\.pagoId, f\.leadId, true, hoyEnTz\(tz\)\);/);
  assert.match(LISTA, /await marcarPagoAction\(f\.pagoId, f\.leadId, false, null\);/);
  assert.match(LISTA, /if \(enCurso\.current\) return;\s*enCurso\.current = true;/);
  assert.match(LISTA, /show\('Cuota cobrada', \(\) => deshacer\(f\)\);/);
});

// Rotura: la guarda sin `porGeneral`: 1 fallo.
test('la guarda de «Marcar cobrada» deja marcar desde General (sólo el admin)', () => {
  const acciones = sinComentarios(leer('app/crm/actions.ts'));
  const guarda = acciones.slice(acciones.indexOf('async function exigirAccesoAMarcarPago'), acciones.indexOf('async function autorActual'));
  assert.match(guarda, /const porGeneral = rol === 'admin' && tabEnCapa\('general', capa\);/);
  assert.match(guarda, /if \(!porCrm && !porDashboard && !porGeneral\) throw/);
});
