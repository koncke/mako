// =============================================================================
// Los mensajes largos de Martín y lo que escribe en la app, enteros y a tiempo (18/10/2026)
// =============================================================================
// Martín: «debería poder enviar mensajes mucho más largos» (el de su feedback tenía ~12.000 caracteres, y el Ops Center
// decía «Acórtalo a 8000»), y «envié este mensaje por aquí y no me aparece en el chat de Ops Center». Medido ese día: el
// mensaje no se perdía, llegaba con la vuelta completa del Runner (minutos después), y lo largo se cortaba a 4000.
// Lo que se fija:
//   1. el servidor y la PC aceptan IGUAL hasta 40.000, y los dos rechazan uno más;
//   2. la caja ofrece más de 8000 sólo a un Runner que también lo acepta (`aceptaTextoLargo`): uno de antes rechazaría
//      el trabajo entero;
//   3. lo que escribió Martín (rol «yo») no se corta; lo demás, como siempre;
//   4. `vigilar` da la vuelta completa cuando un transcript creció, como mucho una cada 10 s (cartero 1.15.8).
//
// Probado rompiéndolo (18/10/2026, con la base en 0 fallos):
//   · el cartero con el tope de 8000 → 1 fallo (1);
//   · `topeDe` sin mirar la versión → 1 fallo (2);
//   · `sanearTurnos` cortando también lo de Martín → 1 fallo (3);
//   · `vigilar` sin `crecio` en la condición de la vuelta → 1 fallo (4).
//   · la burbuja sin «En la app de Claude» (18/10, antes «desde la app»; o mostrándolo también en lo que salió por el Ops Center) → 1 fallo (5).
//   · la burbuja sin `max-width: 100%` → 1 fallo (6).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MAX_TEXTO_LARGO, aceptaTextoLargo, armarFirmable, leerFirmable, nuevoPayload, sanearTurnos, TOPE_TURNO,
} from '../lib/operaciones-reglas';

const S = 'local_11111111-1111-4111-8111-111111111111';
const AHORA = Date.parse('2026-10-18T12:00:00Z');
const firmable = (n: number) => armarFirmable(nuevoPayload({ id: 'aaaaaaaa-1111-4222-8333-444444444444', texto: 'x'.repeat(n), destino: S, cuenta: 'claude1', titulo: 'Cerebro', alcance: 'solo_esto' }, AHORA));

test('1. el servidor y la PC aceptan IGUAL hasta 40.000 (el feedback de Martín tenía ~12.000)', async () => {
  const pc = await import('../scripts/operaciones/cartero.mjs');
  for (const n of [12_000, MAX_TEXTO_LARGO]) {
    assert.equal(leerFirmable(firmable(n), AHORA).ok, true, `MaKo acepta ${n}`);
    assert.equal(pc.leerFirmable(firmable(n), AHORA).ok, true, `la PC acepta ${n}`);
  }
  assert.equal(leerFirmable(firmable(MAX_TEXTO_LARGO + 1), AHORA).ok, false);
  assert.equal(pc.leerFirmable(firmable(MAX_TEXTO_LARGO + 1), AHORA).ok, false);
});

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');

test('2. la caja ofrece más de 8000 sólo si el Runner de esa cuenta lo acepta', () => {
  assert.equal(aceptaTextoLargo('1.15.7'), false);
  assert.equal(aceptaTextoLargo('1.15.8'), true);
  assert.equal(aceptaTextoLargo(null), false);
  const motor = leer('app/admin/operaciones/useCentro.ts');
  assert.match(motor, /aceptaTextoLargo\(k\.version\)\) \? MAX_TEXTO_LARGO : MAX_TEXTO/, 'el tope sale de la versión del Runner');
  assert.match(motor, /const tope = topeDe\(c\);[\s\S]*titulo: c\.titulo, tope \}, texto, 'solo_esto', como, subidos, voz\)/, 'la caja lo usa al mandar');
  assert.match(leer('app/admin/operaciones/mandar.ts'), /tope: number = MAX_TEXTO\): string \| null \{/, 'sin tope, el de siempre');
});

test('3. lo que escribió Martín no se corta; y desde el 25/10/2026 lo que contesta el chat tampoco (tests/turnos-enteros)', async () => {
  const largo = 'y'.repeat(12_000);
  const [yo, el] = sanearTurnos([
    { local: S, uuid: 'u-yo-00000001', rol: 'yo', de: null, texto: largo, at: '2026-10-18T12:00:00Z', trabajo: null },
    { local: S, uuid: 'u-el-00000001', rol: 'el', de: null, texto: largo, at: '2026-10-18T12:01:00Z', trabajo: null },
  ]);
  assert.equal(yo.texto.length, 12_000, 'MaKo guarda entero lo de Martín');
  assert.equal(el.texto.length, 12_000, 'y lo del chat (hasta el 25/10 se cortaba a 4000)');
  assert.ok(TOPE_TURNO >= 200_000, 'el tope es técnico, no un corte');
  const { turnosDeLineas } = await import('../scripts/operaciones/cartero.mjs');
  const linea = JSON.stringify({ type: 'user', uuid: 'u-yo-00000002', timestamp: '2026-10-18T12:02:00Z', message: { content: largo } });
  assert.equal(turnosDeLineas([linea]).turnos[0].texto.length, 12_000, 'y la PC lo sube entero');
});

test('4. `vigilar` da la vuelta completa cuando un transcript creció (lo escrito en la app), una cada 10 s', () => {
  const src = leer('scripts/operaciones/cartero.mjs');
  assert.match(src, /const crecio = ahora\(\) - ultima >= CADA_TURNOS_MS && transcriptsCrecidos\(cuenta, cfg, propio\);/);
  assert.match(src, /if \(\(hay > 0 \|\| fallo \|\| crecio \|\| r\.salteada\) && ahora\(\) - ultima >= /, 'cuenta como «hay algo»');
  assert.match(src, /if \(tam > marca\.offset\) return true;/, 'creció más allá de lo que ya subió');
  assert.match(src, /CARTERO_TURNOS_MS\) \|\| 10_000\)/, 'como mucho una vuelta cada 10 s');
});

test('5. lo que Martín escribió directo en la app lo dice, sutil, junto a la hora', () => {
  const hilo = leer('app/admin/operaciones/Hilo.tsx');
  // Sin `trabajo` = no pasó por la cola del Ops Center: lo escribió en la app de Claude.
  assert.match(hilo, /\{t\.rol === 'yo' && !t\.trabajo && <span className="co-burbuja__desde" title="Lo escribiste directo en la app de Claude">En la app de Claude<\/span>\}\{hora\}/);
  assert.match(leer('app/admin/operaciones/centro.css'), /\.co-burbuja__desde \{[^}]*color: var\(--faint\)/, 'en gris, que no compita con el mensaje');
});

test('6. la burbuja con una cita no se sale de la pantalla (Martín en su Android, 18/10)', () => {
  const css = leer('app/admin/operaciones/centro.css');
  // La cita va en un renglón: sin tope, la burbuja toma el ancho de la frase entera y se sale por la izquierda.
  assert.match(css, /\.co-cita__texto \{[^}]*white-space: nowrap/);
  assert.match(css, /\.co-yo \.co-burbuja \{ max-width: 100%; min-width: 0; \}/, 'la burbuja no pasa del ancho de su fila');
});
