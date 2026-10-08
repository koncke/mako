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
import { grafoDeSecuencia, type PasoParaGrafo } from '../lib/flujo-conversacion';

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
const PROC = bloque(MOTOR, 'export async function procesarEnvios(', '\nexport async function pausarPorRespuesta(', 40_000);
// Hasta la primera guarda que es sólo del mensaje que sigue a la rama (`canalOn`). Perezoso:
// si la rama se mueve de lugar, que caigan los tests que la miran, no el archivo entero.
const rama = (): string => bloque(PROC, 'if (esPasoAccion(paso)) {', 'const canalOn = ', 4_000);

test('⚠️ el motor corre el paso con `correrPasoAccion` → `ejecutarDesdeFlujo`, y RECLAMA con compare-and-set', () => {
  assert.match(rama(), /await correrPasoAccion\(/);
  assert.match(rama(), /ejecutar: async \(operacion, params, o\) => \(await import\('@\/lib\/api-mako\/flujo'\)\)\.ejecutarDesdeFlujo\(operacion, params, o\)/);
  // El reclamo avanza SÓLO si la fila sigue en este paso y activa: es lo que impide correrla dos veces.
  const reclamo = bloque(rama(), 'reclamar: async () => {', 'ejecutar:', 1_500);
  assert.match(reclamo, /\.eq\('id', insc\.id\)\.eq\('estado', 'activa'\)\.eq\('paso_actual', insc\.paso_actual\)/);
  assert.match(reclamo, /paso_actual: n,/, 'avanza como si hubiera salido el mensaje');
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
  for (const antes of ["if (paso.ancla === 'reunion' || preparaUnaReunion(sec.trigger_tipo))", 'if (insc.paso_actual === 0 && sec.antiguedad_max_horas != null', "if (paso.requiere === 'respondio') {"]) {
    const j = PROC.indexOf(antes);
    assert.ok(j > 0 && j < i, `la acción tiene que respetar «${antes}»`);
  }
  // Antes: lo que es del MENSAJE. El anti-ban de 20 h frenaría «mover a Contactado» por el
  // mensaje que acaba de salir; el canal apagado y el [relleno] no le dicen nada a una acción.
  for (const despues of ['pasoConRelleno(paso)', 'const canalApagado', 'conEnvioReciente.has(insc.lead_id)', 'residuoEnCorrida >= RESIDUO_POR_CORRIDA']) {
    const j = PROC.indexOf(despues);
    assert.ok(j > i, `la acción quedó detrás de «${despues}», que es una guarda del mensaje`);
  }
  // Y una acción no cuenta como «enviable por un canal prendido».
  assert.match(PROC, /const canalOn = \(p: PasoSecuencia\) => !esPasoAccion\(p\) && /);
});

test('el cupo de mensajes no frena a las acciones: con el tope cumplido el motor sigue mirando SÓLO esas', () => {
  assert.match(PROC, /const conAcciones = secuencias\.filter\(\(s\) => s\.pasos\.some\(esPasoAccion\)\)\.map\(\(s\) => s\.id\);/);
  assert.match(PROC, /if \(presupuesto <= 0 && !conAcciones\.length\) return \{ \.\.\.res, saltado: 'tope-diario' \};/, 'sin acciones, el corte de siempre');
  assert.match(PROC, /while \(\(!cupoLleno\(\) \|\| conAcciones\.length > 0\) && rondas < 6\)/);
  assert.match(PROC, /if \(cupoLleno\(\)\) q = q\.in\('secuencia_id', conAcciones\);/);
  // Con el cupo lleno un MENSAJE se deja sin tocar (era un `break`), una acción sigue.
  assert.match(PROC, /if \(cupoLleno\(\) && !\(paso && esPasoAccion\(paso\)\)\) continue;/);
  // Y la ventana horaria vale para todo: el corte sigue ANTES de mirar nada.
  assert.ok(PROC.indexOf("saltado: 'fuera-de-ventana-horaria'") < PROC.indexOf('const conAcciones'));
});

test('«Enseguida» quiere decir enseguida: lo que sigue a una acción ya vencido se mira en la MISMA corrida', () => {
  // La fila ya está en `vistos`: sin devolverla a la cola, tres pasos a 0 h (mover, crear la
  // tarea, el mensaje) salían de a uno por hora de cron, con el lienzo diciendo «Enseguida».
  assert.match(rama(), /if \(r\.estado !== 'saltado' && proximo != null && Date\.parse\(proximo\) <= Date\.now\(\)\) \{\s*vistos\.delete\(insc\.id\);\s*otraVuelta = true;\s*\}/);
  assert.match(PROC, /if \(fetched\.length < LOTE && !otraVuelta\) break;/, 'la vuelta que sigue no se da si la cola «parece» drenada');
  // La marca es POR VUELTA: si no se reinicia, el bucle gira hasta el tope sin nada nuevo.
  assert.match(PROC, /rondas \+= 1;\s*let otraVuelta = false;/);
});

// ── El saneo: `setSecuenciaPasos` reconstruye campo por campo ────────────────

test('⚠️ `setSecuenciaPasos` conserva la acción, frena la inválida y no le deja nada de un mensaje', () => {
  const saneo = bloque(MOTOR, 'export async function setSecuenciaPasos(', '.update({ pasos: limpio', 6_000);
  assert.match(saneo, /const acciones = pasos\.filter\(esPaso\)\.map\(\(p\) => sanearAccion\(/);
  assert.match(saneo, /\.filter\(esPaso\)\s*\.map\(\(p, i\): PasoSecuencia => \{/, 'el mismo filtro: `acciones[i]` tiene que ser el paso `i`');
  assert.match(saneo, /if \(malas\.length\) throw new Error\(/, 'una acción sin elegir se descartaba en silencio');
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

const paso = (o: Partial<PasoParaGrafo> & { orden: number }): PasoParaGrafo => ({ canal: 'whatsapp', delay_horas: 0, cuerpo: 'hola', ...o });

test('⚠️ el grafo dibuja la acción como su propio nodo, con el TÍTULO de la acción y la misma flecha de tiempo', () => {
  const g = grafoDeSecuencia(
    [paso({ orden: 1 }), paso({ orden: 2, delay_horas: 0, cuerpo: '', accion: { operacion: 'mover_lead_etapa' } })],
    null, 'X', [], (op) => (op === 'mover_lead_etapa' ? 'Mover un lead de etapa' : null),
  );
  const n = g.nodos.find((x) => x.id === 'paso-2');
  assert.equal(n?.tipo, 'accion', 'dibujada como mensaje, una acción es una burbuja vacía que afirma que al lead le llegó algo');
  assert.equal(n?.titulo, 'Acción de MaKo');
  assert.equal(n?.detalle, 'Mover un lead de etapa');
  assert.equal(n?.advertencia, undefined);
  assert.equal(g.aristas.find((a) => a.hasta === 'paso-2')?.etiqueta, 'Enseguida');
  // Sin el catálogo (cargando, o quien mira no es admin) dice el id, que es feo y es verdad.
  const sin = grafoDeSecuencia([paso({ orden: 1, cuerpo: '', accion: { operacion: 'crear_tarea' } })], null, 'X');
  assert.equal(sin.nodos.find((x) => x.id === 'paso-1')?.detalle, 'crear_tarea');
  // Sin elegir: se dice, con su marca.
  const vacia = grafoDeSecuencia([paso({ orden: 1, cuerpo: '', accion: { operacion: '' } })], null, 'X');
  const v = vacia.nodos.find((x) => x.id === 'paso-1');
  assert.equal(v?.detalle, 'Sin elegir');
  assert.ok(v?.advertencia);
});

test('el ＋ de una flecha sólo vive en la cadena principal: ni en «si contesta» ni después del desenlace', () => {
  const g = grafoDeSecuencia([paso({ orden: 1 }), paso({ orden: 2 })],
    { preguntas: ['¿Cuánto facturas?'], desenlace: { logradoSecuencia: 'a' } }, 'X', [{ clave: 'a', nombre: 'A' }]);
  const de = (d: string, h: string) => g.aristas.find((a) => a.desde === d && a.hasta === h);
  assert.equal(de('paso-2', 'cualifica')?.sinMas, true, 'el ＋ de «si contesta» insertaría en la cadena, no en la rama');
  assert.equal(de('desenlace', 'ir-logrado')?.sinMas, true);
  for (const [d, h] of [['entrada', 'paso-1'], ['paso-1', 'paso-2'], ['paso-2', 'desenlace']] as const) {
    assert.ok(!de(d, h)?.sinMas, `la cadena ${d} → ${h} perdió su ＋`);
  }
});

test('el lienzo ofrece «⚡ Acción de MaKo», la edita con el editor compartido y la agrega sin elegir', () => {
  const lienzo = sinComentarios(leer('app/chatbot/FlujoLienzo.tsx'));
  assert.match(lienzo, /\{ value: 'accion', label: '⚡ Acción de MaKo' \}/);
  assert.match(lienzo, /\{ value: 'mensaje', label: '💬 Mensaje' \}/);
  assert.match(lienzo, /import \{ EditorAccionMako, useTitulosAcciones, type ValorAccion \} from '@\/app\/_components\/EditorAccionMako';/);
  // Los títulos del nodo salen de la MISMA lectura que el desplegable del editor: el lienzo no
  // vuelve a pedir el catálogo por su cuenta.
  assert.doesNotMatch(lienzo, /fetch\('\/api\/flujos\/acciones'/);
  const editor = bloque(lienzo, "if (nodo.tipo === 'accion' && paso) {", "if (nodo.tipo === 'mensaje' && paso) {", 3_000);
  assert.match(editor, /<EditorAccionMako\s+key=\{`accion-\$\{paso\.orden\}-\$\{paso\.accion\?\.operacion \?\? ''\}`\}/, 'sin la key, lo escrito para una acción se ve en la siguiente');
  assert.match(editor, /onCambio=\{\(v\) => onAccion\?\.\(paso\.orden, v\)\}/);
  // La acción que nace sin elegir abre su panel.
  assert.match(lienzo, /if \(q === 'accion'\) \{ const m = \/\^paso-\(\\d\+\)\$\/\.exec\(id\); setSel\(`paso-\$\{m \? Number\(m\[1\]\) \+ 1 : 1\}`\); \}/);
  const perfil = sinComentarios(leer('app/chatbot/SecuenciaPerfil.tsx'));
  assert.match(perfil, /const agregarTras = \(idNodo: string, que: 'mensaje' \| 'accion' = 'mensaje'\) => \{/);
  assert.match(perfil, /template_wa: null, accion: \{ operacion: '', params: \{\} \},/);
  assert.match(perfil, /onAccion=\{rolAdmin \? editarAccion : undefined\}/);
  // El simulador muestra lo que le LLEGA al lead: una acción no le llega. ⚠️ MUDADO EL 08/10/2026:
  // «Probar» recorre el flujo con lib/simulador-grafo.ts, y ahí una acción es una PÍLDORA que la
  // nombra (no se ejecuta), nunca una burbuja. Antes era el filtro `pasosQueLlegan` de
  // SimuladorWhatsApp.tsx; lo ejecuta tests/simulador-grafo.test.ts.
  assert.match(sinComentarios(leer('lib/simulador-grafo.ts')), /case 'accion':\n(\s*\n)?\s+return \{ evento: \{ t: 'accion', nodo: id, texto: `⚡ \$\{nombreAccion\(p, nombres\)\}` \}/);
});
