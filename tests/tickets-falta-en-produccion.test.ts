// =============================================================================
// Un ticket desplegado al que todavía le falta un paso en producción no se cierra ni se avisa (13/11/2026, el #93)
// =============================================================================
// El hito «Hecho» con `tickets: [93]` hizo que el cron cerrara el #93 al desplegar (18:45 UTC) y le mandara a Mauricio
// «Arreglamos… Ya anda» a las 18:46. Pero su caso necesitaba además escrituras en producción después del deploy (prender su
// email, el tope y las columnas, con el sí de Martín), y todavía no estaban: le llegó «ya anda» con el email apagado.
// LO QUE SE CUIDA:
//   1. el hito puede decir qué falta (`faltaEnProduccion`), de cualquier hito que nombre el ticket (`ticketsDeHitos`);
//   2. el cierre REAL (tests/_tickets-falta-en-produccion-hijo.ts): con algo que falta, el deploy no cierra ni avisa, deja UNA
//      vez qué falta, y cierra lo demás; con el paso marcado hecho, el cron siguiente lo cierra (con su duplicado) y avisa; sin
//      poder leer el historial, no cierra a ciegas;
//   3. cómo se marca (`scripts/tickets.ts paso-hecho`) y la regla escrita en AGENTS.md.
//
// PROBADO ROMPIÉNDOLO (13/11/2026), con el archivo en verde (4 / 0), una rotura por vez y restaurada (pasan / fallan):
//   · `loCierraElDeploy` siempre `true` (lo de antes: el deploy cierra todo lo que nombra)                     → 1 / 3 (1, 2 y 3)
//   · `ticketsDeHitos` sin `falta` (el campo no llega al cierre)                                               → 3 / 1 (1)
//   · sin poder leer el historial, `hechos` = todos (cerrar ante la duda)                                      → 3 / 1 (3)
//   · el renglón de qué falta sin la guarda de `anotados` (se repite cada 15 minutos)                         → 2 / 2 (2 y 3)
// ⚠️ El negocio del hijo es el 77 a propósito: el 1 (Mauricio) y el 11 (Leila) tienen la regla de Martín (`aprobadoPorRegla`)
// y su aviso sale por el grupo (otras tablas). Y la base del hijo falla con 500: postgrest-js reintenta solo los 503.
// Correr: node --import tsx --test tests/tickets-falta-en-produccion.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loCierraElDeploy, ticketsDeHitos, TIPO_FALTA_EN_PRODUCCION, TIPO_PASO_HECHO } from '../lib/tickets-reglas';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

let cache: ReturnType<typeof JSON.parse> | null = null;
function hijo(): ReturnType<typeof JSON.parse> {
  if (cache) return cache;
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--conditions=react-server', join(RAIZ, 'tests/_tickets-falta-en-produccion-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 120_000,
  });
  const salida = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  const linea = salida.split('\n').find((l) => l.startsWith('@@FALTA@@'));
  assert.ok(linea, `el hijo no contestó (${r.status}):\n${salida.slice(-2000)}`);
  cache = JSON.parse(linea.slice('@@FALTA@@'.length));
  return cache;
}

test('1. el hito dice qué falta, y lo dice aunque el que avisa no sea el primero que nombra el ticket', () => {
  const m = ticketsDeHitos([
    { area: 'email', bitacora: [{ titulo: 'El freno de email', tickets: [93] }, { titulo: 'Otra cosa', tickets: [12] }] },
    { area: 'crm', bitacora: [{ titulo: 'Las columnas', tickets: [93], faltaEnProduccion: 'prender su email (con el sí de Martín)' }] },
    { area: 'plan', bitacora: [{ titulo: 'El tope', tickets: [93], faltaEnProduccion: '  el tope de 1.600  ' }] },
  ]);
  assert.deepEqual(m.get(93), { area: 'email', titulo: 'El freno de email', falta: 'prender su email (con el sí de Martín) · el tope de 1.600' });
  assert.deepEqual(m.get(12), { area: 'email', titulo: 'Otra cosa' }, 'sin nada que falte, la forma de siempre');
  assert.equal(loCierraElDeploy({}, false), true, 'sin nada que falte, el deploy cierra');
  assert.equal(loCierraElDeploy({ falta: 'x' }, false), false, 'con algo que falta, no');
  assert.equal(loCierraElDeploy({ falta: 'x' }, true), true, 'con el paso hecho, sí');
  assert.equal(loCierraElDeploy({ falta: '   ' }, false), true, 'un texto vacío no frena nada');
  assert.ok(TIPO_PASO_HECHO.length <= 40 && TIPO_FALTA_EN_PRODUCCION.length <= 40, 'ticket_eventos.tipo tiene un CHECK de 1 a 40 (mig 0311)');
});

test('2. el cierre REAL: el deploy no cierra ni avisa al que le falta un paso, y deja UNA vez qué falta', () => {
  const r = hijo();
  assert.equal(r.error, undefined, r.error);
  assert.deepEqual(r.sinMock, [], 'una tabla que el hijo no preparó');
  assert.deepEqual(r.primerCron.cerrados, [94], 'el que no espera nada se cierra como siempre');
  assert.deepEqual(r.primerCron.estados['93'], { estado: 'arreglado', avisado: false }, 'el #93 sigue abierto y nadie le dijo «ya anda»');
  assert.deepEqual(r.primerCron.estados['95'], { estado: 'nuevo', avisado: false }, 'su duplicado tampoco');
  assert.deepEqual(r.primerCron.estados['94'], { estado: 'resuelto', avisado: true });
  assert.deepEqual(r.primerCron.eventos93, ['falta_en_produccion']);
  assert.match(r.textoFalta, /^En producción: El freno de email ya no frena por un rebote\. Falta antes de avisarle: prender su email/);
  // Quince minutos después: lo mismo, y el renglón no se repite.
  assert.deepEqual(r.segundoCron.cerrados, []);
  assert.equal(r.segundoCron.avisos.avisados, 0);
  assert.deepEqual(r.segundoCron.eventos93, ['falta_en_produccion'], 'un renglón, no uno cada 15 minutos');
});

test('3. con el paso marcado hecho se cierra con su duplicado y se avisa; sin poder leer el historial, no a ciegas', () => {
  const r = hijo();
  assert.equal(r.error, undefined, r.error);
  assert.deepEqual(r.historialCaido.cerrados, [], 'sin leer si el paso está hecho, no se cierra');
  assert.deepEqual(r.historialCaido.estados['93'], { estado: 'arreglado', avisado: false });
  assert.deepEqual(r.historialCaido.eventos93, ['falta_en_produccion', 'paso_en_produccion_hecho'], 'ni se repite el renglón');
  assert.deepEqual(r.conElPaso.cerrados, [93]);
  assert.deepEqual(r.conElPaso.estados['93'], { estado: 'resuelto', avisado: true });
  assert.deepEqual(r.conElPaso.estados['95'], { estado: 'resuelto', avisado: true }, 'su duplicado, con él');
});

test('4. cómo se marca el paso, y la regla donde todos la leen', () => {
  const tipos = leer('app/admin/dev/_registro/tipos.ts');
  assert.match(tipos, /\n {2}faltaEnProduccion\?: string;/);
  const script = leer('scripts/tickets.ts');
  assert.match(script, /\} else if \(cmd === 'paso-hecho'\) \{/);
  assert.match(script, /await anotar\(db, id, TIPO_PASO_HECHO, nota\);/);
  assert.match(script, /\['tomar', 'reclasificar', 'arreglado', 'paso-hecho'\]\.includes\(cmd \?\? ''\)/, 'tampoco sobre la cuenta de revisión de las tiendas');
  const agents = leer('AGENTS.md');
  assert.match(agents, /\*\*Un hito «Hecho» con `tickets` se anota cuando no le falta NADA al cliente\*\*/);
  assert.match(agents, /faltaEnProduccion/);
});
