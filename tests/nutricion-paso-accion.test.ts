// =============================================================================
// El paso «⚡ Acción de MaKo» de una secuencia del chatbot: corre, avanza, no se repite
// =============================================================================
// Decisión de Martín (08/10/2026), textual: un paso de un flujo «que pueda hacer todo, sin
// limitaciones». El dueño confirma la acción al CONFIGURAR el paso; cuando la secuencia
// llega ahí, se EJECUTA (`ejecutarDesdeFlujo`, lib/api-mako/flujo.ts), sin pedir un «sí».
//
// Un tipo de nodo nuevo son CINCO puertas (AGENTS.md) y este archivo cuida las cinco:
// el tipo del grafo, el constructor (`grafoDeSecuencia`), el panel (`FlujoLienzo`), el
// motor (`procesarEnvios`) y el saneo (`setSecuenciaPasos`), que reconstruye cada paso
// campo por campo y BORRA lo que no conoce. El motor y el saneo viven en un archivo con
// `server-only`: lo que decide se mudó a lib/nutricion-paso-accion.ts (puro) y acá se
// EJECUTA; lo que queda en el motor es el cableado, y eso se lee del fuente.
//
// PROBADO ROMPIÉNDOLO (08/10/2026; con todo puesto: 15 pasan, 0 fallan). Cada rotura de a
// una, restaurada de memoria (nunca con `git checkout`). Pasan / fallan:
//   · (08/10/2026, el assert del simulador mudado a lib/simulador-grafo.ts) la acción
//     devuelta como un evento de mensaje                                  -> 15 / 1
//   · `correrPasoAccion` ejecuta ANTES de reclamar                        -> 14 / 1
//   · `correrPasoAccion` ejecuta aunque otra corrida ya tomó el paso      -> 14 / 1
//   · un fallo de la acción se registra como 'accion' (no como 'fallo')   -> 13 / 2
//   · el reclamo sin `.eq('paso_actual', …)` (sin compare-and-set)        -> 14 / 1
//   · el motor registra la acción con estado 'enviado'                    -> 14 / 1
//   · el anti-ban de 20 h puesto DELANTE de la rama de la acción          -> 14 / 1
//   · el saneo sin la rama de la acción (`accion` se borra al guardar)    -> 14 / 1
//   · `sanearAccion` acepta una operación vacía                           -> 14 / 1
//   · el grafo dibuja la acción como un mensaje                           -> 14 / 1
//   · el ＋ del lienzo sin «⚡ Acción de MaKo»                              -> 14 / 1
//   · `canalOn` contando las acciones como enviables                      -> 14 / 1
//   · con el cupo lleno, `break` de nuevo (corta también a las acciones)  -> 14 / 1
//   · el PATCH del lienzo le saca `accion` a los pasos antes del saneo    -> 14 / 1
// El de «Enseguida» se sumó después (archivo en 16 / 0), con sus dos roturas:
//   · sin `vistos.delete(insc.id)` (la fila no vuelve a la cola)          -> 15 / 1
//   · el corte por cola drenada sin mirar `otraVuelta`                    -> 15 / 1
//
// Correr: npx tsx --test tests/nutricion-paso-accion.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  esPasoAccion, sanearAccion, correrPasoAccion, origenDelPaso,
  type DepsPasoAccion, type EntradaPasoAccion,
} from '../lib/nutricion-paso-accion';
import { grafoDeSecuencia, opcionesDelMas, nodoNuevo, type PasoParaGrafo } from '../lib/flujo-conversacion';
import { vuelveALaCola } from '../lib/nutricion-hilos';

const leer = (p: string): string => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// Las líneas ANTES que los bloques: un `/*` adentro de un `//` se comería código (AGENTS.md).
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** El bloque que empieza en `abre` y termina en `cierra`, con su largo controlado. */
const bloque = (src: string, abre: string, cierra: string, tope: number): string => {
  const ini = src.indexOf(abre);
  assert.ok(ini >= 0, `no encontré «${abre}»`);
  const fin = src.indexOf(cierra, ini + abre.length);
  assert.ok(fin > ini, `no encontré el cierre «${cierra}»`);
  const b = src.slice(ini, fin);
  assert.ok(b.length < tope, `el recorte mide ${b.length}: está mirando otra cosa`);
  return b;
};

// ── Qué es un paso de acción ────────────────────────────────────────────────

test('un paso es una acción por la PRESENCIA de `accion`; sin ella, es un mensaje como siempre', () => {
  assert.equal(esPasoAccion({ accion: { operacion: 'mover_lead_etapa' } }), true);
  // Recién agregado, sin elegir: ya es una acción (se dibuja y se edita como tal).
  assert.equal(esPasoAccion({ accion: { operacion: '' } }), true);
  // Las filas de antes no tienen el campo: siguen siendo mensajes, sin migrar una.
  assert.equal(esPasoAccion({}), false);
  assert.equal(esPasoAccion({ accion: null }), false);
  assert.equal(esPasoAccion({ accion: [] as unknown }), false);
  assert.equal(esPasoAccion(null), false);
});

test('el saneo de la acción: guarda lo elegido, frena lo imposible y no inventa', () => {
  assert.equal(sanearAccion(undefined), null, 'un mensaje no es una acción inválida');
  assert.equal(sanearAccion(null), null);
  assert.deepEqual(sanearAccion({ operacion: ' mover_lead_etapa ', params: { etapa: 'contactado', leadId: 'evento' } }),
    { ok: true, accion: { operacion: 'mover_lead_etapa', params: { etapa: 'contactado', leadId: 'evento' } } });
  // Sin datos no se guarda un `params: {}` vacío.
  assert.deepEqual(sanearAccion({ operacion: 'crear_tarea', params: {} }), { ok: true, accion: { operacion: 'crear_tarea' } });
  // Por JSON y de vuelta: lo que se guarda es lo que el jsonb devuelve.
  assert.deepEqual(sanearAccion({ operacion: 'crear_tarea', params: { a: undefined, b: 1 } }), { ok: true, accion: { operacion: 'crear_tarea', params: { b: 1 } } });
  // Lo imposible se frena con su motivo, nunca se descarta en silencio.
  assert.deepEqual(sanearAccion({ operacion: '' }), { ok: false, motivo: 'es una acción sin elegir' });
  assert.deepEqual(sanearAccion({}), { ok: false, motivo: 'es una acción sin elegir' });
  assert.equal(sanearAccion({ operacion: 'DROP TABLE' })?.ok, false, 'un id del registro es snake_case');
  assert.equal(sanearAccion({ operacion: 'crear_tarea', params: [1, 2] })?.ok, false);
  assert.equal(sanearAccion({ operacion: 'crear_tarea', params: { texto: 'x'.repeat(25_000) } })?.ok, false);
});

// ── El motor: reclama, ejecuta, registra ────────────────────────────────────

type Llamada = { que: string; args?: unknown[] };
function arnes(o: { reclamo?: boolean | Error; resultado?: { ok: boolean; resumen: string } | Error } = {}) {
  const llamadas: Llamada[] = [];
  const deps: DepsPasoAccion = {
    reclamar: async () => {
      llamadas.push({ que: 'reclamar' });
      if (o.reclamo instanceof Error) throw o.reclamo;
      return o.reclamo ?? true;
    },
    ejecutar: async (...args) => {
      llamadas.push({ que: 'ejecutar', args });
      if (o.resultado instanceof Error) throw o.resultado;
      return o.resultado ?? { ok: true, resumen: 'Movido a Contactado.' };
    },
    registrar: async (r) => { llamadas.push({ que: 'registrar', args: [r] }); },
  };
  return { llamadas, deps };
}
const ENTRADA: EntradaPasoAccion = {
  accion: { operacion: 'mover_lead_etapa', params: { etapa: 'contactado' } },
  ws: 9, secuenciaId: 7, nombre: 'Bienvenida', orden: 2, leadId: 42,
};

test('⚠️ corre la acción con `ejecutarDesdeFlujo` y lo que pide: ws, origen del paso, nombre y el lead', async () => {
  const { llamadas, deps } = arnes();
  const r = await correrPasoAccion(ENTRADA, deps);
  assert.deepEqual(r, { estado: 'accion', nota: 'Movido a Contactado.' });
  const ej = llamadas.find((l) => l.que === 'ejecutar');
  assert.ok(ej, 'no corrió la acción');
  assert.deepEqual(ej!.args, ['mover_lead_etapa', { etapa: 'contactado' }, { ws: 9, origen: 'secuencia:7:paso:2', nombre: 'Bienvenida', leadId: 42 }]);
  assert.equal(origenDelPaso(7, 2), 'secuencia:7:paso:2');
  assert.deepEqual(llamadas.find((l) => l.que === 'registrar')!.args, [{ estado: 'accion', operacion: 'mover_lead_etapa', resumen: 'Movido a Contactado.' }]);
});

test('⚠️ «NO DOS VECES»: reclama ANTES de ejecutar, y si otra corrida lo tomó no corre nada', async () => {
  const a = arnes();
  await correrPasoAccion(ENTRADA, a.deps);
  assert.deepEqual(a.llamadas.map((l) => l.que), ['reclamar', 'ejecutar', 'registrar'],
    'ejecutar antes de reclamar corre la acción dos veces cuando el cron y un evento coinciden');

  const b = arnes({ reclamo: false });
  const rb = await correrPasoAccion(ENTRADA, b.deps);
  assert.equal(rb.estado, 'saltado');
  assert.deepEqual(b.llamadas.map((l) => l.que), ['reclamar'], 'otra corrida ya tomó el paso: no se ejecuta ni se registra');

  // La base no contestó al reclamar: no se sabe, y no se corre.
  const c = arnes({ reclamo: new Error('timeout') });
  const rc = await correrPasoAccion(ENTRADA, c.deps);
  assert.equal(rc.estado, 'saltado');
  assert.match(rc.nota, /timeout/);
  assert.ok(!c.llamadas.some((l) => l.que === 'ejecutar'));
});

test('⚠️ una acción que falla se REGISTRA como fallo, con el motivo, y no se reintenta', async () => {
  const a = arnes({ resultado: { ok: false, resumen: 'El lead #42 ya no existe.' } });
  const r = await correrPasoAccion(ENTRADA, a.deps);
  assert.deepEqual(r, { estado: 'fallo', nota: 'El lead #42 ya no existe.' });
  assert.deepEqual(a.llamadas.find((l) => l.que === 'registrar')!.args, [{ estado: 'fallo', operacion: 'mover_lead_etapa', resumen: 'El lead #42 ya no existe.' }]);
  // El reclamo ya avanzó la inscripción: no hay una segunda vuelta acá adentro.
  assert.equal(a.llamadas.filter((l) => l.que === 'ejecutar').length, 1);

  // Un import que tira también es un fallo registrado, no una excepción que corta el cron.
  const b = arnes({ resultado: new Error('import roto') });
  const rb = await correrPasoAccion(ENTRADA, b.deps);
  assert.equal(rb.estado, 'fallo');
  assert.match(String((b.llamadas.find((l) => l.que === 'registrar')!.args![0] as { resumen: string }).resumen), /import roto/);
});

test('sin workspace no se corre nada ajeno: se registra el fallo', async () => {
  const a = arnes();
  const r = await correrPasoAccion({ ...ENTRADA, ws: null }, a.deps);
  assert.equal(r.estado, 'fallo');
  assert.ok(!a.llamadas.some((l) => l.que === 'ejecutar'));
  assert.ok(a.llamadas.some((l) => l.que === 'registrar'));
});

// ── El motor, cableado (lib/nutricion.ts, con `server-only`) ─────────────────

const MOTOR = sinComentarios(leer('lib/nutricion.ts'));
// El tope es contra un recorte que se fue de largo (otra función adentro), no contra el motor.
// Medido el 09/10/2026 sin comentarios: 39.984 con las esperas cortas de la quinta tanda, 40.583 con
// la rama del mensaje de VARIAS partes (cuarta tanda, punto 15), y 42.457 con las dos juntas.
// Si se pasa, que se mire qué creció antes de subirlo.
// (Undécima tanda: el carril del recordatorio y lo de una respuesta, M3 y M4, sumaron ~7.000 al motor.)
const PROC = bloque(MOTOR, 'export async function procesarEnvios(', '\nexport async function pausarPorRespuesta(', 56_000);
// Hasta la primera guarda que es sólo del mensaje que sigue a la rama (`canalOn`). Perezoso:
// si la rama se mueve de lugar, que caigan los tests que la miran, no el archivo entero.
const rama = (): string => bloque(PROC, 'if (esPasoAccion(paso)) {', 'const canalOn = ', 4_000);

test('⚠️ el motor corre el paso con `correrPasoAccion` → `ejecutarDesdeFlujo`, y RECLAMA con compare-and-set', () => {
  assert.match(rama(), /await correrPasoAccion\(/);
  assert.match(rama(), /ejecutar: async \(operacion, params, o\) => \(await import\('@\/lib\/api-mako\/flujo'\)\)\.ejecutarDesdeFlujo\(operacion, params, o\)/);
  // El reclamo avanza SÓLO si la fila sigue en este paso y activa: es lo que impide correrla dos veces.
  // Desde la segunda tanda (08/10/2026) el reclamo es la PUERTA de la posición (`escribir`) en
  // modo compare-and-set: la misma comparación, en `moverConCas`, que es por donde pasan todas.
  const reclamo = bloque(rama(), 'reclamar: () => escribir(insc, {', 'ejecutar:', 1_500);
  assert.match(reclamo, /\{ modo: 'cas'/, 'el reclamo de la acción tiene que comparar lo leído');
  const cas = bloque(PROC, 'const moverConCas = async (', '\n  };', 1_200);
  // (Undécima tanda, M4: contra el estado LEÍDO —'activa', o 'respondio' con el carril del recordatorio vivo—.)
  assert.match(cas, /\.eq\('id', insc\.id\)\.eq\('estado', estadoLeido\(insc\)\)\.eq\('paso_actual', insc\.paso_actual\)/);
  // Desde el 08/10/2026 (flujo con ramas) avanza al SIGUIENTE DEL NODO, no al de abajo en el
  // array, escribe `nodo_actual` y el reclamo compara también el nodo: dos corridas que leyeron
  // la misma fila no pueden reclamarla las dos aunque `paso_actual` coincida.
  // Probado rompiéndolo (08/10/2026): el reclamo sin comparar el nodo → 1 falla (15/1).
  assert.match(reclamo, /paso_actual: siguientePaso \? sigIdx : n,/, 'avanza como si hubiera salido el mensaje');
  assert.match(reclamo, /nodo_actual: siguientePaso \? idDe\(siguientePaso, sigIdx\) : null,/);
  assert.match(cas, /insc\.nodo_actual == null \? q\.is\('nodo_actual', null\) : q\.eq\('nodo_actual', insc\.nodo_actual\)/);
  assert.match(rama(), /const sigIdx = siguienteIndice\(sec\.pasos, insc\.paso_actual\);/);
  assert.match(reclamo, /proximo_envio_at: proximo,/);
  assert.match(rama(), /const proximo = siguientePaso \? proximoEnvioDePaso\(siguientePaso, lead\) : null;/, 'la misma programación que un mensaje');
  assert.match(rama(), /ws: wsCorrida, secuenciaId: sec\.id, nombre: sec\.nombre, orden: n, leadId: insc\.lead_id,/);
});

test('⚠️ la acción queda en `nutricion_envios` con estado PROPIO, nunca como un mensaje enviado', () => {
  // Todo lector de esa tabla cuenta MENSAJES por estado: el anti-ban, el tope diario,
  // «¿ya le hablamos?», el silencio del desenlace. Como 'enviado', una acción frenaría el
  // próximo WhatsApp del lead 20 h.
  const registro = bloque(rama(), 'registrar: async (x) => {', '\n          },', 1_000);
  assert.match(registro, /from\('nutricion_envios'\)\.insert\(\{/);
  assert.match(registro, /estado: x\.estado,/);
  assert.doesNotMatch(registro, /'enviado'/);
  assert.match(registro, /error: x\.estado === 'fallo' \? x\.resumen : null,/, 'el motivo del fallo tiene que quedar escrito');
});

test('⚠️ la acción va DESPUÉS de las guardas de la inscripción y ANTES de las del mensaje', () => {
  const i = PROC.indexOf('if (esPasoAccion(paso)) {');
  // Después: lo que es de la inscripción entera (reunión pasada, residuo, antigüedad, condiciones).
  // (08/10/2026: «anclada» suma la espera «antes de la reunión» del flujo al `ancla` de siempre, y
  // «el primero» es `esPrimerPaso`, que con ramas no es el índice 0.)
  for (const antes of ['if (anclada || preparaReunion(sec))', 'if (esPrimerPaso(sec.pasos, insc.paso_actual) && topeAntig != null', "if (paso.requiere === 'respondio') {"]) {
    const j = PROC.indexOf(antes);
    assert.ok(j > 0 && j < i, `la acción tiene que respetar «${antes}»`);
  }
  // Antes: lo que es del MENSAJE. El anti-ban de 20 h frenaría «mover a Contactado» por el
  // mensaje que acaba de salir; el canal apagado y el [relleno] no le dicen nada a una acción.
  // (08/10/2026, segunda tanda: el freno de 20 h es `frenadoPorAntiBan`, por canal y con lo de la corrida.)
  // (Undécima tanda: el carril del recordatorio mira el [relleno] ANTES, para no reclamar un toque que no puede
  // salir; la guarda del MENSAJE es la de `if (!opts?.simularApagados && pasoConRelleno(paso))`.)
  for (const despues of ['if (!opts?.simularApagados && pasoConRelleno(paso))', 'const canalApagado', 'frenadoPorAntiBan(insc.lead_id', 'residuoEnCorrida >= RESIDUO_POR_CORRIDA']) {
    const j = PROC.indexOf(despues);
    assert.ok(j > i, `la acción quedó detrás de «${despues}», que es una guarda del mensaje`);
  }
  // Y una acción no cuenta como «enviable por un canal prendido».
  assert.match(PROC, /const canalOn = \(p: PasoSecuencia\) => !esPasoAccion\(p\) && /);
});

test('el cupo de mensajes no frena a las acciones: con el tope cumplido el motor sigue mirando SÓLO esas', () => {
  assert.match(PROC, /const conAcciones = secuencias\.filter\(\(s\) => s\.pasos\.some\(esPasoAccion\)\)\.map\(\(s\) => s\.id\);/);
  // Desde la segunda tanda (08/10/2026, decisión 5) el cupo es de WHATSAPP: con él cumplido siguen
  // las acciones y, mientras quede su propio tope, los emails (`sinTopeWa`, `sigueSinCupoWa`).
  // (Undécima tanda, M3 e: y el carril del recordatorio, que no frenan los topes.)
  assert.match(PROC, /const sinTopeWa = \[\.\.\.new Set\(\[\.\.\.conAcciones, \.\.\.conCarril, \.\.\.\(presupuestoEmail > 0 \? conEmail : \[\]\)\]\)\];/);
  assert.match(PROC, /if \(presupuesto <= 0 && !sinTopeWa\.length\) return \{ \.\.\.res, saltado: 'tope-diario' \};/, 'sin acciones ni emails, el corte de siempre');
  assert.match(PROC, /while \(\(!cupoLleno\(\) \|\| sinTopeWa\.length > 0\) && rondas < 6\)/);
  assert.match(PROC, /if \(cupoLleno\(\)\) q = q\.in\('secuencia_id', sinTopeWa\);/);
  assert.match(PROC, /const sigueSinCupoWa = \(p: PasoSecuencia\): boolean => esPasoAccion\(p\) \|\| /);
  // Con el cupo lleno un MENSAJE se deja sin tocar (era un `break`), una acción sigue. Desde el
  // 08/10/2026 se mira el nodo LEÍDO (`indiceActual`) y otra vez el que quedó después de resolver
  // las tarjetas de control: una condición puede llevar a un mensaje o a una acción.
  // (Undécima tanda: por su LUGAR en el flujo, `sigueSinCupo`, que suma el carril a `sigueSinCupoWa`.)
  // (Y lo que se deja, si la fila tiene el carril pendiente, se aplaza para no taparlo: `aplazarSiTapa`.)
  assert.match(PROC, /if \(cupoLleno\(\) && !\(pasoLeido && sec && sigueSinCupo\(sec\.pasos, idxLeido\)\)\) \{ if \(sec\) await aplazarSiTapa\(insc, sec\); continue; \}/);
  assert.match(PROC, /if \(cupoLleno\(\) && !sigueSinCupo\(sec\.pasos, r\.idx\)\) \{ await aplazarSiTapa\(insc, sec\); continue; \}/);
  assert.match(PROC, /!!pasos\[idx\] && \(sigueSinCupoWa\(pasos\[idx\]\) \|\| esHiloDelCarril\(pasos, idx\)\)/);
  // Y la ventana horaria vale para todo: el corte sigue ANTES de mirar nada.
  assert.ok(PROC.indexOf("saltado: 'fuera-de-ventana-horaria'") < PROC.indexOf('const conAcciones'));
});

test('«Enseguida» quiere decir enseguida: lo que sigue a una acción ya vencido se mira en la MISMA corrida', () => {
  // La fila ya está en `vistos`: sin devolverla a la cola, tres pasos a 0 h (mover, crear la
  // tarea, el mensaje) salían de a uno por hora de cron, con el lienzo diciendo «Enseguida».
  // (09/10/2026: la condición pasó a `vuelveALaCola`, que mira además los hilos que la acción
  // arrancó por sus flechas en paralelo; su test, en tests/nutricion-hilos.test.ts.)
  assert.match(rama(), /if \(r\.estado !== 'saltado' && vuelveALaCola\(proximo, nuevosAccion, Date\.now\(\)\)\) \{\s*vistos\.delete\(insc\.id\);\s*otraVuelta = true;\s*\}/);
  const t = Date.parse('2026-10-09T15:00:00Z');
  assert.equal(vuelveALaCola(new Date(t).toISOString(), [], t), true, 'lo que sigue ya vencido vuelve a la cola');
  assert.equal(vuelveALaCola(new Date(t + 3_600_000).toISOString(), [], t), false);
  assert.match(PROC, /if \(fetched\.length < LOTE && !otraVuelta\) break;/, 'la vuelta que sigue no se da si la cola «parece» drenada');
  // La marca es POR VUELTA: si no se reinicia, el bucle gira hasta el tope sin nada nuevo.
  assert.match(PROC, /rondas \+= 1;\s*let otraVuelta = false;/);
});

// ── El saneo: `setSecuenciaPasos` reconstruye campo por campo ────────────────

test('⚠️ `setSecuenciaPasos` conserva la acción, frena la inválida y no le deja nada de un mensaje', () => {
  // (08/10/2026: lo que se escribe es el GRAFO normalizado y validado, y los rechazos son
  // `PasosInvalidosError`, que la ruta contesta 400.)
  const saneo = bloque(MOTOR, 'export async function setSecuenciaPasos(', '.update({ pasos: grafo', 12_000);
  assert.match(saneo, /const acciones = pasos\.filter\(esPaso\)\.map\(\(p\) => sanearAccion\(/);
  assert.match(saneo, /\.filter\(esPaso\)\s*\.map\(\(p, i\): PasoSecuencia => \{/, 'el mismo filtro: `acciones[i]` tiene que ser el paso `i`');
  assert.match(saneo, /if \(malas\.length\) throw new PasosInvalidosError\(/, 'una acción sin elegir se descartaba en silencio');
  assert.match(saneo, /porId\(op\); return !d \|\| !esAccion\(d\);/, 'una operación que el registro no tiene se guardaba');
  assert.match(saneo, /if \(a\?\.ok\) return \{ \.\.\.comun, asunto: null, preheader: null, cuerpo: '', template_wa: null, accion: a\.accion \};/);
});

test('las puertas de escritura dejan pasar el paso entero (no lo reconstruyen sin `accion`)', () => {
  // El PATCH del lienzo pasa los pasos tal cual; el de email y el doer los SPREADEAN.
  assert.match(sinComentarios(leer('app/api/whatsapp/secuencias/route.ts')), /await setSecuenciaPasos\(id, body\.pasos as PasoSecuencia\[\]\);/);
  assert.match(sinComentarios(leer('app/api/email/secuencias/route.ts')), /\(body\.pasos as PasoSecuencia\[\]\)\.map\(\(p\) => \(\{ \.\.\.p, /);
  const doer = sinComentarios(leer('lib/api-mako/areas/chatbot.run.ts'));
  assert.match(doer, /s\.pasos\.map\(\(p\) => \(p\.orden === orden \? \{ \.\.\.p, delay_horas: horas \} : p\)\)/);
  assert.match(doer, /const p = \{ \.\.\.base, \.\.\.cambiosPaso, orden: i \+ 1 \}/);
});

// ── El grafo y el lienzo ────────────────────────────────────────────────────
// Reescrito el 08/10/2026 con el flujo con ramas (la parte del lienzo): los nodos se llaman
// por su id (no `paso-<orden>`), el tiempo es su propia tarjeta (no un rótulo de la flecha)
// y el ＋ inserta EN un puerto. Probado rompiéndolo (con todo puesto, archivo en 16 / 0):
//   · el grafo dibuja la acción como un mensaje                           -> 15 / 1
//   · la key del editor de la acción sin la operación                     -> 15 / 1
//   · el menú del ＋ sin «⚡ Acción»                                       -> 15 / 1
//   · una flecha del árbol vuelve a apagar su ＋ (`sinMas`)                -> 15 / 1

const paso = (o: Partial<PasoParaGrafo> & { id: string }): PasoParaGrafo => ({ canal: 'whatsapp', delay_horas: 0, cuerpo: 'hola', siguiente: null, ...o });

test('⚠️ el grafo dibuja la acción como su propio nodo, con el TÍTULO de la acción', () => {
  const g = grafoDeSecuencia(
    [paso({ id: 'a', siguiente: 'b' }), paso({ id: 'b', cuerpo: '', accion: { operacion: 'mover_lead_etapa' } })],
    { disparador: 'X', tituloAccion: (op) => (op === 'mover_lead_etapa' ? 'Mover un lead de etapa' : null) },
  );
  const n = g.nodos.find((x) => x.id === 'b');
  assert.equal(n?.tipo, 'accion', 'dibujada como mensaje, una acción es una burbuja vacía que afirma que al lead le llegó algo');
  assert.equal(n?.titulo, 'ACTION', 'los títulos de las tarjetas van en inglés (tercera tanda, decisión 5)');
  assert.equal(n?.detalle, 'Mover un lead de etapa');
  assert.equal(n?.advertencia, undefined);
  // Cuelga de la salida del paso anterior, sin rótulo de tiempo: la espera es una tarjeta.
  const a = g.aristas.find((x) => x.hasta === 'b');
  assert.equal(a?.desde, 'a');
  assert.equal(a?.puerto, 'sig');
  assert.equal(a?.etiqueta, undefined);
  // Sin el catálogo (cargando, o quien mira no es admin) dice el id, que es feo y es verdad.
  const sin = grafoDeSecuencia([paso({ id: 'a', cuerpo: '', accion: { operacion: 'crear_tarea' } })], { disparador: 'X' });
  assert.equal(sin.nodos.find((x) => x.id === 'a')?.detalle, 'crear_tarea');
  // Sin elegir: se dice, con su marca.
  const vacia = grafoDeSecuencia([paso({ id: 'a', cuerpo: '', accion: { operacion: '' } })], { disparador: 'X' });
  const v = vacia.nodos.find((x) => x.id === 'a');
  assert.equal(v?.detalle, 'Sin elegir');
  assert.ok(v?.advertencia);
});

test('el ＋ del medio vive en TODA flecha del árbol, y cada una dice de qué salida sale', () => {
  // Antes el ＋ de una flecha insertaba «después del nodo de origen», y por eso las ramas lo
  // apagaban (`sinMas`): con N salidas, insertaba en otra. Ahora inserta EN el puerto de
  // la flecha, así que ninguna lo apaga.
  const g = grafoDeSecuencia([
    paso({ id: 'c', cuerpo: '', nodo: 'condicion', ramas: [{ id: 'r1', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 'x' }], si_no: 'y' }),
    paso({ id: 'x', siguiente: 'z' }), paso({ id: 'z', cuerpo: '', accion: { operacion: 'crear_tarea' } }), paso({ id: 'y' }),
  ], { disparador: 'X' });
  assert.equal(g.aristas.length, 4);
  for (const a of g.aristas) {
    assert.ok(!a.sinMas, `${a.desde} → ${a.hasta} perdió su ＋`);
    assert.ok(a.puerto, `${a.desde} → ${a.hasta} no dice de qué salida sale`);
  }
});

test('el lienzo ofrece «⚡ Acción», la edita con el editor compartido y la agrega sin elegir', () => {
  // El menú del ＋ es UNO, puro (`opcionesDelMas`), y el lienzo lo usa tal cual.
  const menu = opcionesDelMas([], 'entrada', false);
  assert.ok(menu.some((o) => o.value === 'accion' && o.label === 'Acción'));
  // Segunda tanda (parte L): «WhatsApp» y no «Mensaje», desde que el ＋ también crea un email; y
  // el menú recibe el puerto (la fila «Si responde» del CRON ofrece sólo crear «Si responde»).
  // Roto devolviendo el `puerto` a `_puerto` en FlujoLienzo: 1 falla.
  assert.ok(menu.some((o) => o.value === 'mensaje' && o.label === 'WhatsApp'));
  const lienzo = sinComentarios(leer('app/automations/FlujoLienzo.tsx'));
  assert.match(lienzo, /opcionesEn=\{\(nodo, puerto, medio\) => opcionesDelMas\(pasos, nodo, medio, puerto\)\}/);
  assert.match(lienzo, /import \{ EditorAccionMako, useTitulosAcciones, type ValorAccion \} from '@\/app\/_components\/EditorAccionMako';/);
  // Los títulos del nodo salen de la MISMA lectura que el desplegable del editor: el lienzo no
  // vuelve a pedir el catálogo por su cuenta.
  assert.doesNotMatch(lienzo, /fetch\('\/api\/flujos\/acciones'/);
  const editor = bloque(lienzo, 'function EditorAccion(', '\ntype Unidad', 1_800);
  assert.match(editor, /<EditorAccionMako\s+key=\{`accion-\$\{id\}-\$\{previa\}`\}/, 'sin la key, lo escrito para una acción se ve en la siguiente');
  assert.match(editor, /onCambio=\{\(v: ValorAccion\) => cambiar\(\{ accion: \{ operacion: v\.operacion \?\? '', params: v\.params \?\? \{\} \} \}, \(v\.operacion \?\? ''\) !== previa\)\}/);
  // La tarjeta nueva abre su panel (la acción nace SIN ELEGIR y así no se puede publicar).
  // Desde la duodécima (12/10/2026) el mismo `if` además pide el QR (`pedirConectar`): va entre llaves.
  // Roto dejando sólo `pedirConectar.current = nuevo` (sin `setSel`): 15 / 1, cae éste (base 16 / 0).
  assert.match(lienzo, /const nuevo = onAgregar!\(id, puerto, que as QueAgregar\);\s*if \(nuevo\) \{?\s*setSel\(nuevo\);/);
  const nueva = nodoNuevo('accion', []);
  assert.deepEqual(nueva.accion, { operacion: '', params: {} });
  assert.equal(nueva.delay_horas, 0);
  const perfil = sinComentarios(leer('app/automations/SecuenciaPerfil.tsx'));
  assert.match(perfil, /const r = insertarDesdeLienzo\(pasos, nodo, puerto, que\);/);
  assert.match(perfil, /onAgregar=\{rolAdmin \? agregarEn : undefined\}/);
  // El simulador muestra lo que le LLEGA al lead: una acción no le llega. ⚠️ MUDADO EL 08/10/2026:
  // «Probar» recorre el flujo con lib/simulador-grafo.ts, y ahí una acción es una PÍLDORA que la
  // nombra (no se ejecuta), nunca una burbuja. Antes era el filtro `pasosQueLlegan` de
  // SimuladorWhatsApp.tsx; lo ejecuta tests/simulador-grafo.test.ts.
  assert.match(sinComentarios(leer('lib/simulador-grafo.ts')), /case 'accion':\n(\s*\n)?\s+return \{ evento: \{ t: 'accion', nodo: id, texto: `⚡ \$\{nombreAccion\(p, nombres\)\}` \}/);
});
