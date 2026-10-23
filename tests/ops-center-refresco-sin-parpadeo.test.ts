// =============================================================================
// Un refresco que falla no cambia lo dibujado: ni silencio ni parpadeo (22/10/2026)
// =============================================================================
// El Cerebro, midiéndolo en producción en cada deploy (cada 30 minutos): durante uno o dos minutos varios POST a
// /admin/operaciones (el refresco de la Ticketera y de la lista) y algunos GET `?_rsc` dieron 503. Con cada uno la Ticketera
// volvía a «Cargando…» (la primera vez, trabada más de 12 s hasta recargar) y la lista perdía sus «Completado» y se reordenaba.
//   1. la pantalla se queda con el último `centro` que vio: un null de una vuelta del servidor que falló la desarmaba entera
//      (de `ConCentro` a `Cuerpo` solo: TODO se volvía a montar);
//   2. el refresco de la lista que tira (un 503 hace tirar a la acción) no toca nada, y el intervalo reintenta;
//   3. la Ticketera: una lectura colgada no traba las siguientes (tiene tope) y, con tickets a la vista, un tropiezo suelto no
//      se dice (sólo varios seguidos; sin tickets, a la primera). Lo que ya se ve no se borra nunca.
//
// Correr: node --import tsx --test tests/ops-center-refresco-sin-parpadeo.test.ts
// PROBADO ROMPIÉNDOLO (base 3/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FALLOS_PARA_DECIRLO, decirFalloDeLectura, lectorDeBandeja } from '../app/tickets/bandeja/mazo-reglas';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. una vuelta del servidor que falla no desarma el Ops Center: se queda el último `centro` que se vio', () => {
  const src = sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx'));
  const pantalla = src.slice(src.indexOf('export function ChatSecondBrain('), src.indexOf('function ConCentro('));
  assert.match(pantalla, /const visto = useRef<DatosCentro \| null>\(null\);\n\s*if \(props\.centro\) visto\.current = props\.centro;\n\s*const datos = props\.centro \?\? visto\.current;/);
  assert.match(pantalla, /return datos\n\s*\? <ConCentro datos=\{datos\}>/, 'el árbol sale de lo último visto, no de la prop cruda');
  assert.doesNotMatch(pantalla, /return props\.centro\n/, 'la prop cruda ya no decide el árbol');
});

test('2. el refresco de la lista que tira no toca nada (el intervalo reintenta)', () => {
  const src = sinComentarios(leer('app/admin/operaciones/useCentro.ts'));
  const refrescar = src.slice(src.indexOf('const refrescar = useCallback(async () => {'), src.indexOf('const apurado = hayEnCamino('));
  assert.match(refrescar, /const f = await leerCentro<FotoCentro>\('foto'\)\.catch\(\(\) => null\);\n\s*if \(f\?\.ok\) \{/);
  assert.match(src, /const t = setInterval\(\(\) => \{ if \(document\.visibilityState === 'visible'\) refrescar\(\); \}/, 'el intervalo es el reintento');
});

test('3. la Ticketera: una lectura colgada no traba las siguientes, y un tropiezo suelto con tickets a la vista no se dice', async () => {
  // Colgada: el tope la suelta, se aplica como fallida, y la próxima sale.
  const aplicados: Array<unknown> = [];
  let llamadas = 0;
  const colgada = lectorDeBandeja(() => { llamadas += 1; return llamadas === 1 ? new Promise<{ ok: boolean }>(() => {}) : Promise.resolve({ ok: true }); },
    (r) => { aplicados.push(r); }, 20);
  // Con un plazo PROPIO: sin el tope del lector, la colgada no termina nunca y el test quedaría «cancelado», no en rojo.
  const aTiempo = (p: Promise<void>) => Promise.race([p, new Promise<never>((_, no) => setTimeout(() => no(new Error('la lectura colgada trabó el lector')), 1000))]);
  await aTiempo(colgada());
  await aTiempo(colgada());
  assert.deepEqual(aplicados, [null, { ok: true }], 'la colgada se da por fallida y la siguiente lee');
  // Una que tira (el 503: la acción tira) también llega como fallida, sin romper el lector.
  const tirada: Array<unknown> = [];
  await lectorDeBandeja(() => Promise.reject(new Error('An unexpected response was received from the server.')), (r) => { tirada.push(r); }, 20)();
  assert.deepEqual(tirada, [null]);
  // Cuándo se dice: sin tickets, a la primera; con tickets, sólo varias seguidas.
  assert.equal(decirFalloDeLectura(1, false), true);
  assert.equal(decirFalloDeLectura(1, true), false, 'un tropiezo suelto, con tickets a la vista, no se dice');
  assert.equal(decirFalloDeLectura(FALLOS_PARA_DECIRLO, true), true);
  // La bandeja: lo que ya se ve no se borra nunca (nada vuelve los tickets a null), y el error pasa por esa regla.
  const bandeja = sinComentarios(leer('app/tickets/bandeja/BandejaTickets.tsx'));
  assert.doesNotMatch(bandeja, /setTickets\(null\)/);
  assert.match(bandeja, /if \(decirFalloDeLectura\(fallos\.current, hayTickets\.current\)\) setError\(/);
  assert.match(bandeja, /fallos\.current = 0;\n\s*hayTickets\.current = true;/);
});

// PROBADO ROMPIÉNDOLO (22/10/2026, base 3/0):
//   · la pantalla vuelve a decidir con la prop cruda          → 2/1 (1)
//   · el refresco de la lista sin su catch                    → 2/1 (2)
//   · el lector sin tope (la colgada traba)                   → 2/1 (3)
//   · cada tropiezo se dice                                   → 2/1 (3)
