// =============================================================================
// El ws13 sin avisos de leads nuevos del 13 al 22/10/2026: medio emoji en un resumen, un motivo que no viajaba y una
// inscripción que se cerraba sin reintento
// =============================================================================
// Medido contra producción (23/10/2026): 20 envíos seguidos en 'fallo', todos del ws13, con «No se pudo registrar la acción
// pendiente.». El texto del aviso de #241 y #264 mide 184 unidades y `mensaje.slice(0, 120)` dejaba la primera mitad de un
// emoji (U+D83D) al final del resumen: `JSON.stringify` la manda como «\ud83d» y Postgres rechaza el pedido («invalid input
// syntax for type json», medido con un `select …::jsonb` sin tocar tablas). El diagnóstico obvio —«el INSERT falla por el
// esquema o el payload»— era el equivocado: el payload va entero.
//
// PROBADO ROMPIÉNDOLO: ver el pie. Correr: node --import tsx --test tests/pendiente-medio-emoji.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sinMediosEmojis, cortarSinPartir, datosSinMediosEmojis } from '../lib/unicode-seguro';
import { correrPasoAccion, REINTENTOS_ACCION_MS, type DepsPasoAccion, type ResultadoEjecucion } from '../lib/nutricion-paso-accion';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sueltos = (s: string) => [...s].filter((c) => c.length === 1 && c.charCodeAt(0) >= 0xd800 && c.charCodeAt(0) <= 0xdfff).length;

/** La forma del texto de #241 / #264: 119 unidades y un emoji que empieza en la 119 (184 en total). */
const AVISO = `${'x'.repeat(119)}🏠${'y'.repeat(63)}`;

test('el corte a 120 de la forma del ws13 deja medio emoji con `slice` y ninguno con `cortarSinPartir`', () => {
  assert.equal(AVISO.length, 184);
  assert.equal(sueltos(AVISO.slice(0, 120)), 1, 'la forma no reproduce el caso');
  assert.match(JSON.stringify(AVISO.slice(0, 120)), /\\ud83c/, 'JSON.stringify manda el surrogate escapado: lo que Postgres rechaza');
  const corte = cortarSinPartir(AVISO, 120);
  assert.equal(sueltos(corte), 0);
  assert.equal(corte, 'x'.repeat(119));
  assert.equal(cortarSinPartir(AVISO, 121), `${'x'.repeat(119)}🏠`, 'un emoji entero no se toca');
  assert.equal(cortarSinPartir('hola', 120), 'hola');
});

test('sin mitades: se sacan el alto y el bajo sueltos; los pares y lo que no es texto quedan', () => {
  const alto = String.fromCharCode(0xd83d);
  const bajo = String.fromCharCode(0xde00);
  assert.equal(sinMediosEmojis(`a${alto}b${bajo}c 😀`), 'abc 😀');
  const d = datosSinMediosEmojis({ resumen: `Avisar: «x${alto}»`, n: 3, ok: true, nada: null, lista: [`y${bajo}`, 7], adentro: { m: `z${alto}` } });
  assert.deepEqual(d, { resumen: 'Avisar: «x»', n: 3, ok: true, nada: null, lista: ['y', 7], adentro: { m: 'z' } });
  assert.doesNotMatch(JSON.stringify(d), /\\ud[89a-f]/i);
});

test('la fuente y el choke point: el aviso corta sin partir, y la pendiente entra saneada y dice por qué no entró', () => {
  const run = leer('lib/api-mako/areas/chatbot.run.ts');
  assert.match(run, /: «\$\{cortarSinPartir\(mensaje, 120\)\}»/);
  assert.doesNotMatch(run, /«\$\{mensaje\.slice\(0, 120\)\}»/);
  const pend = leer('lib/mako-pendientes.ts');
  const cuerpo = pend.slice(pend.indexOf('export async function crearPendiente'), pend.indexOf('async function avisarPendiente'));
  // El payload entra saneado CON quién la pidió en el grupo (28/10/2026, lib/confirmacion-pura.ts `conQuienPidio`).
  assert.match(cuerpo, /const payloadCrudo = conQuienPidio\(dataCruda\.payload \?\? \{\}, dataCruda\.pidio, salidaDelGrupo\(\)\?\.soloApp\);/);
  assert.match(cuerpo, /datosSinMediosEmojis\(\{ grupoJid: dataCruda\.grupoJid, tipo: dataCruda\.tipo, payload: payloadCrudo, resumen: dataCruda\.resumen, origen: dataCruda\.origen \}\)/);
  assert.match(cuerpo, /if \(error\) \{\n\s+console\.error\('\[pendientes\] crear:', error\.message\);\n\s+return \{ error: /);
  assert.doesNotMatch(cuerpo, /return null/);
  // El motivo viaja hasta la fila de la automatización, y nunca a una persona ni por HTTP.
  const acc = leer('lib/api-mako/acciones.ts');
  assert.match(acc, /if \('error' in c\) return \{ error: ERROR_PENDIENTE, motivo: c\.error \};/);
  assert.match(leer('lib/api-mako/ejecutar.ts'), /if \('error' in c\) return \{ ok: false, status: 500, error: c\.error, \.\.\.\(c\.motivo \? \{ motivo: c\.motivo \} : \{\}\), noCorrio: true \};/);
  // `aplicarEnElActo` lo deja APARTE: /api/v1 también pasa por ahí y devuelve sólo el `resumen`.
  const flujo = leer('lib/api-mako/flujo.ts');
  assert.match(flujo, /ok: r\.yaEstaba === true, resumen: r\.error, via: 'ninguna',\n\s+\.\.\.\(r\.motivo \? \{ motivo: r\.motivo \} : \{\}\), \.\.\.\(r\.noCorrio \? \{ noCorrio: true as const \} : \{\}\),/);
  assert.doesNotMatch(leer('lib/api-mako/rutas-http.ts'), /\.motivo\b|\bmotivo:/);
});

/** Dependencias falsas del paso de acción, con lo que pasó anotado. */
function deps(o: { ejecuta: ResultadoEjecucion; previos?: number; registrarFalla?: boolean; sinDevolver?: boolean }) {
  const log: { registros: string[]; devuelta: number[] } = { registros: [], devuelta: [] };
  const d: DepsPasoAccion = {
    reclamar: async () => true,
    ejecutar: async () => o.ejecuta,
    registrar: async (x) => { if (o.registrarFalla) throw new Error('la base no contestó'); log.registros.push(`${x.estado}: ${x.resumen}`); },
    ...(o.sinDevolver ? {} : { fallosPrevios: async () => o.previos ?? 0, devolver: async (ms: number) => { log.devuelta.push(ms); return true; } }),
  };
  return { d, log };
}
const ENTRADA = { accion: { operacion: 'avisar_al_equipo' }, ws: 13, secuenciaId: 264, nombre: 'Nueva automatización', orden: 1, leadId: 3098 };
const NO_ENTRO: ResultadoEjecucion = { ok: false, resumen: 'No se pudo registrar la acción pendiente.', motivo: 'invalid input syntax for type json', noCorrio: true };

test('una acción que NO corrió vuelve a su paso: 1 h, 6 h y 24 h, y después sigue como siempre', async () => {
  for (const [previos, ms] of REINTENTOS_ACCION_MS.map((m, i) => [i, m] as const)) {
    const { d, log } = deps({ ejecuta: NO_ENTRO, previos });
    const r = await correrPasoAccion(ENTRADA, d);
    assert.deepEqual(r.estado === 'fallo' && r.reintento, true, `intento ${previos + 1}: no se devolvió`);
    assert.deepEqual(log.devuelta, [ms]);
    assert.match(log.registros[0], new RegExp(`La base contestó: invalid input syntax for type json \\(intento ${previos + 1} de 4\\)$`));
  }
  const { d, log } = deps({ ejecuta: NO_ENTRO, previos: 3 });
  const ultimo = await correrPasoAccion(ENTRADA, d);
  assert.equal(ultimo.estado === 'fallo' && ultimo.reintento, undefined);
  assert.deepEqual(log.devuelta, []);
  assert.match(log.registros[0], /\(intento 4 de 4: no se reintenta más\)$/);
});

test('no se devuelve lo que pudo haber corrido, ni sin rastro, ni sin cómo devolverla', async () => {
  // Corrió y falló después (no se sabe qué hizo): no se repite.
  const hizo = deps({ ejecuta: { ok: false, resumen: 'Falló «Avisar al equipo»: se cortó Evolution' } });
  const r1 = await correrPasoAccion(ENTRADA, hizo.d);
  assert.equal(r1.estado, 'fallo');
  assert.deepEqual(hizo.log.devuelta, []);
  assert.equal(hizo.log.registros[0], 'fallo: Falló «Avisar al equipo»: se cortó Evolution');
  // Sin la fila del rastro, el conteo no avanza: devolverla sería un bucle.
  const sinRastro = deps({ ejecuta: NO_ENTRO, registrarFalla: true });
  await correrPasoAccion(ENTRADA, sinRastro.d);
  assert.deepEqual(sinRastro.log.devuelta, []);
  // Con hilos o en el carril el motor no pasa `devolver`: lo de siempre.
  const sinDevolver = deps({ ejecuta: NO_ENTRO, sinDevolver: true });
  const r3 = await correrPasoAccion(ENTRADA, sinDevolver.d);
  assert.equal(r3.estado === 'fallo' && r3.reintento, undefined);
  // El motivo va igual al rastro, aunque no haya reintento.
  assert.equal(sinDevolver.log.registros[0], 'fallo: No se pudo registrar la acción pendiente. La base contestó: invalid input syntax for type json');
  // Y lo que salió bien, bien.
  const bien = deps({ ejecuta: { ok: true, resumen: 'Avisé al equipo' } });
  assert.equal((await correrPasoAccion(ENTRADA, bien.d)).estado, 'accion');
  assert.deepEqual(bien.log.devuelta, []);
});

test('el motor devuelve sólo en el caso simple, contra lo que escribió el reclamo, y sin la «otra vuelta»', () => {
  const m = leer('lib/nutricion.ts');
  assert.match(m, /\.\.\.\(!carril && !sanearHilos\(insc\.hilos\) && !nuevosAccion\.length && estadoLeido\(insc\) === 'activa'/);
  assert.match(m, /devolver: \(enMs: number\) => moverConCas\(\n\s+\{ id: insc\.id, paso_actual: siguientePaso \? sigIdx : n, nodo_actual: siguientePaso \? idDe\(siguientePaso, sigIdx\) : null, estado: siguientePaso \? 'activa' : 'completada' \},\n\s+\{ paso_actual: insc\.paso_actual, nodo_actual: insc\.nodo_actual \?\? null, estado: 'activa', proximo_envio_at: /);
  assert.match(m, /\.eq\('inscripcion_id', insc\.id\)\.eq\('paso', n\)\.eq\('estado', 'fallo'\)\.eq\('asunto', String\(paso\.accion\?\.operacion \?\? ''\)\)/);
  assert.match(m, /if \(r\.estado !== 'saltado' && !\(r\.estado === 'fallo' && r\.reintento\) && vuelveALaCola\(/);
  assert.match(m, /error: x\.estado === 'fallo' \? sinMediosEmojis\(x\.resumen\) : null,/);
});

// ── ROTURAS (23/10/2026) ───────────────────────────────────────────────────────────────────────────
// Una por vez (reemplazar el texto, correr este archivo, devolverlo de memoria). Base 6 pasan / 0 fallan:
//   W1. `cortarSinPartir` = `slice` pelado                                                      → 1 falla
//   W2. el aviso vuelve a `mensaje.slice(0, 120)`                                               → 1 falla
//   W3. `crearPendiente` vuelve a `return null`                                                 → 1 falla
//   W4. `correrPasoAccion` reintenta sin mirar `noCorrio`                                       → 1 falla
//   W5. devuelve aunque el registro falló                                                       → 1 falla
//   W6. el motor ofrece `devolver` también con hilos                                            → 1 falla
