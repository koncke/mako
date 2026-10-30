// =============================================================================
// El goteo de una automatización, con 50 inscriptos a la vez, «Sale sola» y PARA APROBAR (AU1 del plan del Cerebro, 22/10/2026)
// =============================================================================
// #289 «Sprint · apertura» (ws1) nace para aprobar (su estrategia es null y «Sale sola» da false) y tiene goteo de 5 minutos y
// 50 por día. La sospecha del relevamiento: el goteo contaba sólo los WhatsApp 'enviado', así que con aprobación el motor
// dejaba los 50 borradores de una, y aprobarlos los mandaba en el acto. Se confirmó, y lo arreglan:
//   · el motor: el borrador CUENTA para el goteo (`cuentaParaElGoteo`, en `usoDelGoteo` y en la corrida, lib/nutricion.ts);
//   · aprobar: la única puerta de envío de un borrador respeta el goteo (`frenoDelGoteoAlAprobar`, lib/borrador-camino.ts).
// El caso se corre con la MISMA vuelta del motor (un tick por minuto, lo vencido en orden de cola, lo frenado a su turno con
// `turnoDeGoteo` como `quedaFrenada`) y las mismas funciones de lib/goteo.ts.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { frenoDeGoteo, turnoDeGoteo, conEnvio, cuentaParaElGoteo, frenoAlAprobar, SIN_USO, type Goteo, type UsoGoteo } from '../lib/goteo';

const leer = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');
const MIN = 60_000;
const T0 = Date.UTC(2026, 9, 24, 12, 0);
const GOTEO: Goteo = { minutos: 5, dia: 50 };

/**
 * La vuelta del motor, minuto a minuto: lo vencido en orden de cola; si el goteo frena, a su turno (`quedaFrenada`); si no,
 * sale (o queda para aprobar) y suma al uso si cuenta para el goteo. Devuelve cuándo salió cada uno.
 */
function correr(n: number, modo: 'sola' | 'aprobar', minutos: number, g: Goteo = GOTEO): number[] {
  let uso: UsoGoteo = SIN_USO;
  const filas = Array.from({ length: n }, (_, id) => ({ id, proximo: T0 }));
  const salieron: number[] = [];
  for (let t = T0; t <= T0 + minutos * MIN; t += MIN) {
    const vencidas = filas.filter((f) => f.proximo <= t).sort((a, b) => a.proximo - b.proximo || a.id - b.id);
    let k = 0;
    for (const f of vencidas) {
      const freno = frenoDeGoteo(g, uso, t);
      if (freno.frena) { f.proximo = turnoDeGoteo(freno.desdeMs, k++, g); continue; }
      const estado = modo === 'sola' ? 'enviado' : 'borrador';
      if (cuentaParaElGoteo(estado)) uso = conEnvio(uso, t);
      salieron.push(t);
      filas.splice(filas.indexOf(f), 1);
    }
  }
  return salieron;
}

// rotura (`ESTADOS_DEL_GOTEO` sólo con 'enviado', lo de antes) → 3 rojos de 4 (éste: con aprobación salen los 50 juntos; el de 60 y el cableado).
test('50 inscriptos a la vez, en los dos modos: de a uno cada 5 minutos, y los 50 en 4 horas y 5 minutos', () => {
  for (const modo of ['sola', 'aprobar'] as const) {
    const t = correr(50, modo, 300);
    assert.equal(t.length, 50, `${modo}: salieron los 50`);
    assert.equal(t[0], T0, `${modo}: el primero, en el acto`);
    for (let i = 1; i < t.length; i++) assert.equal(t[i] - t[i - 1], 5 * MIN, `${modo}: el ${i + 1}º, 5 minutos después del anterior`);
    assert.equal(t[49], T0 + 245 * MIN);
  }
});

// rotura (`frenoDeGoteo` sin el tope del día) → 2 rojos de 4 (éste y el de aprobar).
test('con 60 inscriptos, como mucho 50 en 24 horas, en los dos modos', () => {
  for (const modo of ['sola', 'aprobar'] as const) {
    const t = correr(60, modo, 24 * 60 - 1);
    assert.equal(t.length, 50, `${modo}: el tope del día`);
  }
});

// rotura (`frenoAlAprobar` que siempre deja salir) → 1 rojo de 4 (éste).
test('aprobar respeta el goteo: el segundo, recién 5 minutos después del primero; y no más de 50 en 24 horas', () => {
  const nombre = 'Sprint · apertura';
  const uno: UsoGoteo = { enviados: 1, ultimoMs: T0, primeroMs: T0 };
  assert.match(String(frenoAlAprobar(GOTEO, uno, T0 + 2 * MIN, nombre)), /^Todavía no: «Sprint · apertura» manda uno cada 5 minutos \(su goteo, en Configuraciones\)\. Apruébalo en 3 minutos\.$/);
  assert.equal(frenoAlAprobar(GOTEO, uno, T0 + 5 * MIN, nombre), null, 'a los 5 minutos, sale');
  assert.equal(frenoAlAprobar(GOTEO, SIN_USO, T0, nombre), null, 'el primero, sale');
  const cincuenta: UsoGoteo = { enviados: 50, ultimoMs: T0 + 245 * MIN, primeroMs: T0 };
  assert.match(String(frenoAlAprobar(GOTEO, cincuenta, T0 + 300 * MIN, nombre)), /ya mandó 50 en 24 horas.*El próximo sale en 19 horas\./);
  assert.equal(frenoAlAprobar(undefined, cincuenta, T0, nombre), null, 'sin goteo, lo de siempre');
});

// roturas (`usoDelGoteo` sólo con 'enviado'; la corrida sin `cuentaParaElGoteo`; la puerta de aprobar sin el goteo) → 1 rojo de 4 cada una (éste).
test('el cableado: el motor cuenta los borradores y la puerta de aprobar mira el goteo antes de mandar', () => {
  const motor = leer('lib/nutricion.ts');
  const uso = motor.slice(motor.indexOf('async function usoDelGoteo('), motor.indexOf('async function usoDelGoteo(') + 1200);
  assert.match(uso, /\.in\('estado', \[\.\.\.ESTADOS_DEL_GOTEO\]\)/);
  assert.match(motor, /cuentaParaElGoteo\(estado\) && goteos\.has\(insc\.secuencia_id\)\) \{\s+const clave = claveDeGoteo\(canalDelGoteo\(paso\.canal\), insc\.secuencia_id\);\s+usoGoteo\.set\(clave, conEnvio\(/);
  assert.equal(cuentaParaElGoteo('borrador'), true);
  assert.equal(cuentaParaElGoteo('fallo'), false);
  const puerta = leer('lib/borrador-camino.ts');
  const envio = puerta.slice(puerta.indexOf('export async function enviarBorradorPorSuCanal('));
  const freno = envio.indexOf('const freno = await frenoDelGoteoAlAprobar(b.secuencia_id);');
  assert.ok(freno > 0 && freno < envio.indexOf('return enviarBorrador(id, porEmail);'), 'el goteo, antes de mandar');
  assert.match(envio, /if \(freno\) return \{ ok: false, error: freno \};/);
  assert.match(puerta, /\.eq\('secuencia_id', secuenciaId\)\.eq\('estado', 'enviado'\)\.gte\('enviado_at', desde\)/, 'lo aprobado cuenta por cuándo SALIÓ');
});
