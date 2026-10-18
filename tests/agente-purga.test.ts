// =============================================================================
// La purga de los turnos del agente a los 90 días: SÓLO lo vencido, con modo seco (17/10/2026)
// =============================================================================
// Pendiente de docs/hallazgos-agente.md: «la purga de turnos a los 90 días se apoya en `purgar_despues` y no hay nada que la
// corra». Los turnos son lo único del agente que puede traer contenido del negocio del cliente: que no caduquen es una promesa
// rota. Lo que fija este archivo es lo que, roto, o no purga nada (y nadie se entera) o borra de más (y nadie lo puede deshacer):
//   1. SÓLO lo vencido: una sesión sin fecha de purga, o con una a futuro, no se toca; el acta (y la fila) se quedan;
//   2. el MODO SECO cuenta y no escribe;
//   3. cada sesión se purga UNA vez (`purgar_despues` queda en NULL), y una que se reportó entre la lectura y el update NO se vacía;
//   4. el tope por vuelta, con `hayMas`;
//   5. el cron pide el secreto, está en vercel.json, y la consulta de verdad lleva sus dos candados.
//
// Probado ROMPIENDO (17/10/2026; base 7 / 0). Una rotura por vez, restaurada y comprobada con `git diff --stat`:
//   · `vencidas` sin el `.lt('purgar_despues', …)` (purgaba todo lo que tuviera fecha)         → 6 / 1 (candado en el fuente)
//   · el update sin el `.lt('purgar_despues', …)` (sin el compare-and-set)                      → 6 / 1 (candado en el fuente)
//   · el modo seco llamando a `vaciar`                                                          → 6 / 1 (el seco)
//   · `hayMas` siempre false                                                                    → 6 / 1 (el tope)
//   · `pideSeco` verdadero para cualquier valor (un `?seco=0` dejaba de purgar)                 → 6 / 1 (el modo)
//   · la ruta sin `checkCronAuth`                                                               → 6 / 1 (el secreto; y lo exige también seguridad-crons-y-publicas)
//   · el update sin dejar `purgar_despues` en NULL (la sesión se volvería a leer cada día)       → 6 / 1 (candado en el fuente)
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TOPE_PURGA_AGENTE, pideSeco, purgarTurnosVencidos, type AccesoPurga } from '../lib/agente-purga';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const AHORA = new Date('2026-10-17T12:00:00Z');
const dia = (n: number) => new Date(AHORA.getTime() + n * 86_400_000).toISOString();

type Sesion = { id: number; purgar_despues: string | null; turnos: string[]; acta: string };

/** Una tabla en memoria con la MISMA semántica que las dos consultas de `accesoSupabase`. */
function tabla(filas: Sesion[]): { acceso: AccesoPurga; filas: Sesion[]; escrituras: number[][]; alVaciar?: () => void } {
  const t: { acceso: AccesoPurga; filas: Sesion[]; escrituras: number[][]; alVaciar?: () => void } = {
    filas,
    escrituras: [],
    acceso: {
      async vencidas(ahoraIso, tope) {
        return filas.filter((f) => f.purgar_despues !== null && f.purgar_despues < ahoraIso)
          .sort((a, b) => (a.purgar_despues ?? '').localeCompare(b.purgar_despues ?? ''))
          .slice(0, tope).map((f) => f.id);
      },
      async vaciar(ids, ahoraIso) {
        t.escrituras.push([...ids]);
        t.alVaciar?.();
        const tocadas = filas.filter((f) => ids.includes(f.id) && f.purgar_despues !== null && f.purgar_despues < ahoraIso);
        for (const f of tocadas) { f.turnos = []; f.purgar_despues = null; }
        return tocadas.map((f) => f.id);
      },
    },
  };
  return t;
}
const sesion = (id: number, purgar: string | null): Sesion => ({ id, purgar_despues: purgar, turnos: ['hola', 'chau'], acta: `acta ${id}` });

test('1. sólo lo vencido: lo de a futuro y lo sin fecha no se toca, y el acta se queda', async () => {
  const t = tabla([sesion(1, dia(-1)), sesion(2, dia(30)), sesion(3, null), sesion(4, dia(-100))]);
  const r = await purgarTurnosVencidos(t.acceso, { seco: false, ahora: AHORA });
  assert.deepEqual(r, { modo: 'borra', vencidas: 2, purgadas: 2, hayMas: false });
  const por = (id: number) => t.filas.find((f) => f.id === id)!;
  assert.deepEqual([por(1).turnos, por(4).turnos], [[], []], 'las vencidas quedan sin turnos');
  assert.deepEqual([por(2).turnos.length, por(3).turnos.length], [2, 2], 'la de a futuro y la sin fecha conservan sus turnos');
  assert.equal(t.filas.length, 4, 'no se borra ninguna fila');
  assert.equal(por(1).acta, 'acta 1', 'el acta sobrevive');
});

test('2. el modo seco cuenta y no escribe nada', async () => {
  const t = tabla([sesion(1, dia(-1)), sesion(2, dia(-5)), sesion(3, dia(10))]);
  const r = await purgarTurnosVencidos(t.acceso, { seco: true, ahora: AHORA });
  assert.deepEqual(r, { modo: 'seco', vencidas: 2, purgadas: 0, hayMas: false });
  assert.deepEqual(t.escrituras, [], 'ni siquiera llamó a vaciar');
  assert.deepEqual(t.filas.map((f) => f.turnos.length), [2, 2, 2]);
  assert.equal(pideSeco('1'), true);
  assert.equal(pideSeco('true'), true);
  assert.equal(pideSeco('0'), false, '?seco=0 no es seco');
  assert.equal(pideSeco(null), false, 'sin parámetro es la purga de verdad: es la retención prometida');
  assert.equal(pideSeco(''), false);
});

test('3. cada sesión se purga una vez, y una que se reportó entre la lectura y el update no se vacía', async () => {
  const t = tabla([sesion(1, dia(-1)), sesion(2, dia(-2))]);
  // Entre `vencidas` y `vaciar` la sesión 2 vuelve a reportar: el upsert del hook le pone +90 días.
  t.alVaciar = () => { t.filas[1].purgar_despues = dia(90); };
  const r = await purgarTurnosVencidos(t.acceso, { seco: false, ahora: AHORA });
  assert.deepEqual([r.vencidas, r.purgadas], [2, 1], 'vio dos y vació una');
  assert.equal(t.filas[1].turnos.length, 2, 'la que volvió a reportar conserva sus turnos nuevos');
  // La segunda vuelta no encuentra la ya purgada: `purgar_despues` quedó en NULL.
  t.alVaciar = undefined;
  const otra = await purgarTurnosVencidos(t.acceso, { seco: false, ahora: AHORA });
  assert.deepEqual([otra.vencidas, otra.purgadas], [0, 0]);
  assert.equal(t.filas[0].purgar_despues, null);
});

test('4. el tope por vuelta: lo que sobra espera a mañana, y se avisa', async () => {
  const filas = Array.from({ length: 5 }, (_, i) => sesion(i + 1, dia(-(i + 1))));
  const t = tabla(filas);
  const r = await purgarTurnosVencidos(t.acceso, { seco: false, ahora: AHORA, tope: 3 });
  assert.deepEqual([r.vencidas, r.purgadas, r.hayMas], [3, 3, true]);
  assert.deepEqual(t.filas.map((f) => f.turnos.length), [2, 2, 0, 0, 0], 'las MÁS viejas primero (la 5, la 4 y la 3)');
  const resto = await purgarTurnosVencidos(t.acceso, { seco: false, ahora: AHORA, tope: 3 });
  assert.deepEqual([resto.vencidas, resto.purgadas, resto.hayMas], [2, 2, false]);
  assert.ok(TOPE_PURGA_AGENTE >= 100 && TOPE_PURGA_AGENTE <= 1000, 'un tope que cabe en los 60 s del cron');
});

test('5. sin nada vencido no escribe', async () => {
  const t = tabla([sesion(1, dia(5)), sesion(2, null)]);
  const r = await purgarTurnosVencidos(t.acceso, { seco: false, ahora: AHORA });
  assert.deepEqual(r, { modo: 'borra', vencidas: 0, purgadas: 0, hayMas: false });
  assert.deepEqual(t.escrituras, []);
});

test('6. la consulta de verdad lleva sus dos candados: leer sólo lo vencido y re-preguntar al escribir', () => {
  const src = sinComentarios(leer('lib/agente-purga.ts'));
  const lectura = src.slice(src.indexOf('async vencidas('), src.indexOf('async vaciar('));
  assert.match(lectura, /\.not\('purgar_despues', 'is', null\)\.lt\('purgar_despues', ahoraIso\)/, 'la lectura: no nulo Y anterior a ahora');
  assert.match(lectura, /\.order\('purgar_despues', \{ ascending: true \}\)\.limit\(tope\)/, 'las más viejas primero, con tope');
  const escritura = src.slice(src.indexOf('async vaciar('));
  assert.match(escritura, /update\(\{ turnos: \[\], purgar_despues: null \}\)/, 'vacía los turnos y deja la fecha en NULL; no toca el acta');
  assert.match(escritura, /\.in\('id', \[\.\.\.ids\]\)\.not\('purgar_despues', 'is', null\)\.lt\('purgar_despues', ahoraIso\)/, 'el update vuelve a preguntar «sigue vencida» (compare-and-set)');
  assert.doesNotMatch(src, /\.delete\(\)/, 'no borra filas: el acta se queda');
  assert.doesNotMatch(src, /\.update\(\{[^}]*\bacta\b/, 'no toca el acta');
});

test('7. el cron pide el secreto, está programado una vez al día, y el modo seco viene del parámetro', () => {
  const ruta = sinComentarios(leer('app/api/cron/agente-purga/route.ts'));
  assert.match(ruta, /import \{ checkCronAuth \} from '@\/lib\/cron-auth';/);
  assert.match(ruta, /export async function GET\(req: NextRequest\) \{\n  const denied = checkCronAuth\(req\);\n  if \(denied\) return denied;/, 'empieza pidiendo el secreto');
  assert.match(ruta, /seco: pideSeco\(req\.nextUrl\.searchParams\.get\('seco'\)\)/);
  const v = JSON.parse(leer('vercel.json')) as { crons: Array<{ path: string; schedule: string }> };
  const filas = v.crons.filter((c) => c.path === '/api/cron/agente-purga');
  assert.equal(filas.length, 1, 'una sola programación');
  assert.match(filas[0].schedule, /^\d+ \d+ \* \* \*$/, 'diario, a una hora fija');
});
