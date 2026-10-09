// =============================================================================
// El MOTOR de las secuencias como flujo con ramas (08/10/2026, parte M)
// =============================================================================
// Pedido de Martín (08/10/2026): una secuencia de /chatbot deja de ser una lista y pasa a ser un
// flujo con tarjetas (condición, espera, «Si responde», «Ir a»). El modelo vive en
// lib/flujo-grafo.ts; lo que decide el MOTOR, en lib/nutricion-grafo-motor.ts (puro, con test
// acá); el cableado, en lib/nutricion.ts y compañía (con `server-only`: se lee el FUENTE, sin
// comentarios y normalizado a LF).
//
// Lo que se cuida, de a una:
//   1. dónde está una inscripción (`nodo_actual`, y una fila que nunca avanzó está en la ENTRADA);
//   2. cómo se resuelven las tarjetas de control antes de las guardas;
//   3. qué queda alcanzable (la regla del canal apagado) y qué es «el primer mensaje»;
//   4. «sale sola» por tarjeta; el «saltear» por el grafo y no por el índice;
//   5. el saneo de los campos del flujo y lo que `setSecuenciaPasos` rechaza;
//   6. un caso enseñado entra a «Si responde» como rama;
//   7. el trigger «Le ponen la etiqueta»;
//   8. «Si responde» usa el MISMO redactor (refactor, no copia);
//   9. la operación `avisar_al_equipo` y las puertas del servidor.
//
// Probado rompiéndolo (08/10/2026), una rotura por vez y restaurada DE MEMORIA (arnés en el
// scratchpad, nunca `git checkout`). Como está: 21 pasan / 0 fallan. Cada rotura (20/1 cada una):
//   (1)  indiceActual sin traducir «nunca avanzó» a la entrada          → 1 falla (1)
//   (2)  resolverControl frenando en una espera cuyo momento ya pasó    → 1 falla (2)
//   (3)  alcanzablesDesde por el RESTO DEL ARRAY (lo de antes)          → 1 falla (3)
//   (4)  esPrimerPaso contando una tarjeta de control como mensaje      → 1 falla (3)
//   (5)  saleSolo ignorando `revisar`                                   → 1 falla (4)
//   (6)  siguienteSin por índice + 1                                    → 1 falla (4)
//   (7)  camposDelFlujo dejando `revisar` en una tarjeta de control     → 1 falla (5)
//   (8)  agregarCasoAlGrafo con «revisar» siempre en true               → 1 falla (6)
//   (9)  secuenciasDeEtiqueta sin exigir la etiqueta                    → 1 falla (7)
//   (10) setSecuenciaPasos sin `validarGrafo`                           → 1 falla (5)
//   (11) asistirRespuesta sin despachar a responderConGrafo             → 1 falla (8)
//   (12) responderConGrafo sin `redactarRespuesta` para «MaKo contesta» → 1 falla (8)
//   (13) avisar_al_equipo sin el canal 'app' (el de los flujos)         → 1 falla (9)
//   (14) el runner del aviso sin la deduplicación por lead              → 1 falla (9)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TOPE_SALTOS, indiceActual, indiceEntrada, resolverControl, necesitaHechos, alcanzablesDesde, esPrimerPaso,
  minutosAntesDeReunion, saleSolo, siguienteSin, siguienteCon, hechosDeLead, esTablaInexistente, mediaDeAdjunto,
  camposDelFlujo, RELLENO_CONTROL, esNodoDeControl, tieneTarjetasDeControl, esLineal, relinear, agregarCasoAlGrafo,
} from '../lib/nutricion-grafo-motor';
import { normalizar, validarGrafo, raizRespuesta, nodoPorId, TOPE_CASOS, type PasoGrafo, type HechosLead } from '../lib/flujo-grafo';
import { OP_AVISAR } from '../lib/flujo-legado';
import { secuenciasDeEtiqueta, TRIGGER_ETIQUETA } from '../lib/nutricion-etapa';
import { DEFS } from '../lib/api-mako/areas/chatbot.def';

const AHORA = Date.parse('2026-10-08T15:00:00Z');
const HORA = 3_600_000;

const H = (o: Partial<HechosLead> = {}): HechosLead => ({
  etiquetas: new Set<number>(), etapa: null, agendo: false, pago: false, yaContactado: false, respondio: false,
  creadoMs: null, tieneTelefono: true, tieneEmail: false, ahoraMs: AHORA, ...o,
});
const msg = (id: string, extra: Partial<PasoGrafo> = {}): PasoGrafo =>
  ({ id, canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: `hola ${id}`, template_wa: null, ...extra } as PasoGrafo);
const ctl = (id: string, extra: Partial<PasoGrafo>): PasoGrafo => ({ id, ...RELLENO_CONTROL, ...extra } as PasoGrafo);

// «Si responde» PRIMERO en el array (el lienzo puede dejarlo ahí): la entrada es la condición.
//   0 r  💬 Si responde: «Precio» → rm
//   1 c  ◇ ¿Agendó? sí → mA · si no → e
//   2 mA ✉
//   3 e  ⏳ 1 h → mB
//   4 mB ✉ → mC
//   5 mC ✉ (requiere sin_respuesta)
//   6 rm ✉ MaKo contesta
const A: PasoGrafo[] = [
  ctl('r', { nodo: 'respuesta', casos: [{ id: 'c1', titulo: 'Precio', cuando: 'pregunta el precio', siguiente: 'rm' }], si_no: null }),
  ctl('c', { nodo: 'condicion', ramas: [{ id: 'ra', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 'mA' }], si_no: 'e' }),
  msg('mA', { siguiente: null }),
  ctl('e', { nodo: 'esperar', espera: { modo: 'tiempo', minutos: 60 }, siguiente: 'mB' }),
  msg('mB', { siguiente: 'mC' }),
  msg('mC', { siguiente: null, requiere: 'sin_respuesta' }),
  msg('rm', { tipo: 'ia', cuerpo: 'Dile que el precio se ve en la reunión', siguiente: null }),
];

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
/** La función de primer nivel `firma`, hasta la próxima declaración de primer nivel. */
const fn = (src: string, firma: string): string => {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré ${firma}`);
  const resto = src.slice(i + firma.length);
  const j = resto.search(/\n(?:export )?(?:async )?function |\nexport |\ntype |\nconst /);
  return src.slice(i, i + firma.length + (j >= 0 ? j : resto.length));
};
const NUTRI = sinComentarios(leer('../lib/nutricion.ts'));

test('el fixture es un flujo que se puede guardar', () => {
  assert.deepEqual(validarGrafo(normalizar(A)), []);
});

// ── 1. Dónde está una inscripción ────────────────────────────────────────────

test('(1) una fila que nunca avanzó está en la ENTRADA de la salida, no en el índice 0', () => {
  assert.equal(indiceEntrada(A), 1);
  assert.equal(indiceActual(A, { nodo_actual: null, paso_actual: 0 }), 1, '«Si responde» no es por dónde empieza la salida');
  // `nodo_actual` manda; si ya no existe, NINGUNO (revisión del 08/10/2026: el índice de siempre
  // podía ser otra rama — tests/motor-revision.test.ts); fuera de rango, ninguno.
  assert.equal(indiceActual(A, { nodo_actual: 'mB', paso_actual: 0 }), 4);
  assert.equal(indiceActual(A, { nodo_actual: 'ya-no-existe', paso_actual: 5 }), -1);
  assert.equal(indiceActual(A, { nodo_actual: null, paso_actual: 99 }), -1);
  // Una secuencia de antes (sin ids) sigue leyendo `pasos[paso_actual]`.
  const viejo = [{ canal: 'whatsapp', delay_horas: 0, cuerpo: 'a' }, { canal: 'whatsapp', delay_horas: 24, cuerpo: 'b' }] as PasoGrafo[];
  assert.equal(indiceActual(viejo, { nodo_actual: null, paso_actual: 0 }), 0);
  assert.equal(indiceActual(viejo, { paso_actual: 1 }), 1);
});

// ── 2. Las tarjetas de control ───────────────────────────────────────────────

test('(2) una condición sin hechos pide leerlos; con hechos, elige la rama', () => {
  // (Desde la segunda tanda, 08/10/2026, toda resolución trae `repartos`: las flechas en paralelo
  // que encontró en el camino. Sin paralelos, vacío.)
  assert.deepEqual(resolverControl(A, 1, { hechos: null, ahoraMs: AHORA, reunionMs: null }), { tipo: 'faltan_hechos' });
  assert.deepEqual(resolverControl(A, 1, { hechos: H({ agendo: true }), ahoraMs: AHORA, reunionMs: null }), { tipo: 'nodo', idx: 2, via: ['c'], repartos: [] });
  // «Si no» → la espera: programa el próximo y pasa la inscripción a lo que SIGUE a la espera.
  assert.deepEqual(resolverControl(A, 1, { hechos: H(), ahoraMs: AHORA, reunionMs: null }), { tipo: 'esperar', idx: 4, proximoMs: AHORA + HORA, via: ['c', 'e'], repartos: [] });
  // «Si responde» no corre en la salida.
  assert.equal(resolverControl(A, 0, { hechos: H(), ahoraMs: AHORA, reunionMs: null }).tipo, 'fin');
});

test('(2) una espera «antes de la reunión»: sin reunión cierra, ya pasada sigue de largo, futura espera', () => {
  const R = [ctl('e1', { nodo: 'esperar', espera: { modo: 'antes_reunion', minutos: 60 }, siguiente: 'm1' }), msg('m1', { siguiente: null })];
  assert.equal(resolverControl(R, 0, { hechos: null, ahoraMs: AHORA, reunionMs: null }).tipo, 'sin_reunion');
  assert.deepEqual(resolverControl(R, 0, { hechos: null, ahoraMs: AHORA, reunionMs: AHORA + 30 * 60_000 }), { tipo: 'nodo', idx: 1, via: ['e1'], repartos: [] });
  assert.deepEqual(resolverControl(R, 0, { hechos: null, ahoraMs: AHORA, reunionMs: AHORA + 3 * HORA }), { tipo: 'esperar', idx: 1, proximoMs: AHORA + 2 * HORA, via: ['e1'], repartos: [] });
  assert.equal(minutosAntesDeReunion(R, 1), 60, 'el mensaje que cuelga de esa espera es un recordatorio');
  assert.equal(minutosAntesDeReunion(A, 4), null, 'una espera de tiempo no ancla nada');
});

test('(2) «Ir a»: otra automatización la termina; a una tarjeta salta; un bucle corta en el tope', () => {
  assert.deepEqual(resolverControl([ctl('j', { nodo: 'ir_a', destino: { secuencia_id: 77 } })], 0, { hechos: null, ahoraMs: AHORA, reunionMs: null }),
    { tipo: 'ir_a_secuencia', secuenciaId: 77, via: ['j'], repartos: [] });
  assert.deepEqual(resolverControl([ctl('x', { nodo: 'ir_a', destino: { nodo: 'm' } }), msg('m')], 0, { hechos: null, ahoraMs: AHORA, reunionMs: null }),
    { tipo: 'nodo', idx: 1, via: ['x'], repartos: [] });
  const bucle = [ctl('a', { nodo: 'ir_a', destino: { nodo: 'b' } }), ctl('b', { nodo: 'ir_a', destino: { nodo: 'a' } })];
  const r = resolverControl(bucle, 0, { hechos: null, ahoraMs: AHORA, reunionMs: null });
  assert.equal(r.tipo, 'tope_saltos');
  assert.ok(TOPE_SALTOS >= 10);
});

test('(2) los hechos se leen sólo si en el camino hay una condición', () => {
  assert.equal(necesitaHechos(A, 1), true);
  assert.equal(necesitaHechos(A, 3), false, 'espera → mensaje: no hay nada que evaluar');
  const B = [ctl('e', { nodo: 'esperar', espera: { modo: 'tiempo', minutos: 5 }, siguiente: 'c' }), ctl('c', { nodo: 'condicion', ramas: [], si_no: null })];
  assert.equal(necesitaHechos(B, 0), true, 'detrás de una espera también cuenta');
});

// ── 3. Lo alcanzable y el primer mensaje ─────────────────────────────────────

test('(3) lo que queda después de un nodo sale de sus SALIDAS, no del resto del array', () => {
  assert.deepEqual(alcanzablesDesde(A, 1), [2, 3, 4, 5]);
  // mA termina: lo que está abajo en el array es OTRA rama que este lead no recorre.
  assert.deepEqual(alcanzablesDesde(A, 2), []);
  assert.deepEqual(alcanzablesDesde(A, 0), [6]);
});

test('(3) el primer mensaje es el primero que manda algo, aunque cuelgue de una condición', () => {
  assert.equal(esPrimerPaso(A, 2), true);
  assert.equal(esPrimerPaso(A, 4), true, 'detrás de la condición y la espera sigue siendo el primero');
  assert.equal(esPrimerPaso(A, 5), false);
});

// ── 4. Sale sola y el «saltear» ──────────────────────────────────────────────

test('(4) «sale sola» por tarjeta: `revisar` manda, ausente decide la secuencia', () => {
  assert.equal(saleSolo({ revisar: true }, true), false);
  assert.equal(saleSolo({ revisar: false }, false), true);
  assert.equal(saleSolo({}, true), true);
  assert.equal(saleSolo({}, false), false);
});

test('(4) saltear el paso que espera respuesta sigue el `siguiente`, no el índice', () => {
  const S = [msg('s0', { requiere: 'respondio', siguiente: 's2' }), msg('s1', { siguiente: null }), msg('s2', { siguiente: null })];
  assert.equal(siguienteSin(S, 0, 'respondio'), 2);
  assert.equal(siguienteCon(S, 0, 'respondio'), 0);
  assert.equal(siguienteCon(S, 1, 'respondio'), -1);
  assert.equal(siguienteSin(A, 5, 'sin_respuesta'), -1);
});

// ── 5. El saneo y lo que se rechaza ──────────────────────────────────────────

test('(5) camposDelFlujo: guarda lo válido y tira lo que no es un flujo', () => {
  assert.deepEqual(camposDelFlujo({ id: 'ok', siguiente: 'x', revisar: true }), { id: 'ok', siguiente: 'x', revisar: true });
  assert.deepEqual(camposDelFlujo({ id: 'mal id!' }), {});
  assert.deepEqual(camposDelFlujo({ nodo: 'esperar', espera: { minutos: 0 } }), { nodo: 'esperar' }, 'una espera sin minutos no viaja');
  assert.equal(camposDelFlujo({ nodo: 'esperar', espera: { minutos: 1e9 } }).espera?.minutos, 366 * 24 * 60);
  const c = camposDelFlujo({ nodo: 'condicion', ramas: [{ id: 'r1', filas: [{ campo: 'inventado' }, { campo: 'agendo' }], siguiente: 'z' }] });
  assert.deepEqual(c.ramas, [{ id: 'r1', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 'z' }]);
  assert.equal(c.si_no, null);
  assert.equal('revisar' in camposDelFlujo({ nodo: 'respuesta', revisar: true }), false, '«sale sola» es de un mensaje, no de una tarjeta');
  assert.deepEqual(camposDelFlujo({ nodo: 'ir_a', destino: { secuencia_id: '12' } }).destino, { secuencia_id: 12 });
  assert.equal(camposDelFlujo({ nodo: 'ir_a', destino: { nodo: 'no vale' } }).destino, null);
  assert.equal('nodo' in camposDelFlujo({ nodo: 'cualquiera' }), false);
});

test('(5) lo que guarda setSecuenciaPasos (relleno + campos del flujo) es un flujo válido; un salto roto no', () => {
  const guardado = A.map((p, i) => (esNodoDeControl(camposDelFlujo(p))
    ? { orden: i + 1, ...RELLENO_CONTROL, ...camposDelFlujo(p) }
    : { ...p, orden: i + 1, ...camposDelFlujo(p) })) as PasoGrafo[];
  assert.deepEqual(validarGrafo(normalizar(guardado)), []);
  const roto = guardado.map((p) => (p.id === 'mA' ? { ...p, siguiente: 'no-existe' } : p));
  assert.ok(validarGrafo(normalizar(roto)).length > 0);
});

test('(5) setSecuenciaPasos normaliza, VALIDA y rechaza con PasosInvalidosError; la ruta contesta 400', () => {
  const g = fn(NUTRI, 'export async function setSecuenciaPasos(');
  assert.match(g, /if \(esNodoDeControl\(flujo\)\) return \{ orden: i \+ 1, \.\.\.RELLENO_CONTROL, \.\.\.flujo \}/);
  assert.match(g, /\.\.\.flujo,\n/, 'los campos del flujo de un mensaje se pierden en el saneo');
  const valida = g.indexOf('const errores = validarGrafo(grafo);');
  assert.ok(g.indexOf('const grafo = normalizar(limpio);') >= 0 && valida > 0, 'se guarda sin validar el flujo');
  assert.match(g, /if \(errores\.length\) throw new PasosInvalidosError\(/);
  assert.ok(valida < g.indexOf('.update({ pasos: grafo,'), 'la validación va ANTES de escribir');
  assert.match(NUTRI, /export class PasosInvalidosError extends Error/);
  const ruta = sinComentarios(leer('../app/api/whatsapp/secuencias/route.ts'));
  assert.match(ruta, /if \(err instanceof PasosInvalidosError\) return Response\.json\(\{ ok: false, error: msg \}, \{ status: 400 \}\);/);
});

test('(5) las operaciones «por orden» de MaKo sólo tocan un flujo LINEAL', () => {
  const viejo = [{ canal: 'whatsapp', delay_horas: 0, cuerpo: 'a' }, { canal: 'whatsapp', delay_horas: 24, cuerpo: 'b' }] as PasoGrafo[];
  assert.equal(esLineal(viejo), true);
  assert.equal(esLineal(normalizar(viejo)), true);
  assert.equal(esLineal(A), false);
  assert.equal(esLineal([msg('a', { siguiente: 'c' }), msg('b', { siguiente: null }), msg('c', { siguiente: null })]), false);
  assert.ok(relinear(normalizar(viejo)).every((p) => !('siguiente' in p)));
  assert.equal(tieneTarjetasDeControl(A), true);
  assert.equal(tieneTarjetasDeControl(viejo), false);
  const run = sinComentarios(leer('../lib/api-mako/areas/chatbot.run.ts'));
  assert.match(run, /if \(!esLineal\(s\.pasos\)\) \{/);
  assert.match(run, /pasos: relinear\(pasos\)/);
});

// ── 6. Un caso enseñado entra a «Si responde» ───────────────────────────────

test('(6) un caso nuevo es una RAMA con su «MaKo contesta»; el mismo título lo actualiza', () => {
  let k = 1;
  const rnd = () => ((k++ * 0.1373) % 1);
  const r = agregarCasoAlGrafo(A, { titulo: 'Horario', cuando: 'pregunta el horario', comoResponder: 'Dile el horario' }, rnd);
  assert.ok('pasos' in r);
  if (!('pasos' in r)) return;
  const resp = nodoPorId(r.pasos, raizRespuesta(r.pasos))!;
  assert.equal(resp.casos?.length, 2);
  const nuevo = nodoPorId(r.pasos, resp.casos![1].siguiente)!;
  assert.equal(nuevo.tipo, 'ia');
  assert.equal(nuevo.revisar, true, 'sin «contesta solo», queda como borrador');
  assert.equal(nuevo.cuerpo, 'Dile el horario');
  assert.deepEqual(validarGrafo(r.pasos), []);
  const solo = agregarCasoAlGrafo(A, { titulo: 'Horario', cuando: 'x', comoResponder: 'y', contestaSolo: true }, rnd);
  assert.ok('pasos' in solo && nodoPorId(solo.pasos, nodoPorId(solo.pasos, raizRespuesta(solo.pasos))!.casos![1].siguiente)!.revisar === false);
  const mismo = agregarCasoAlGrafo(A, { titulo: 'precio', cuando: 'pregunta cuánto sale', comoResponder: 'guía nueva' }, rnd);
  assert.ok('pasos' in mismo);
  if (!('pasos' in mismo)) return;
  assert.equal(nodoPorId(mismo.pasos, 'r')!.casos!.length, 1);
  assert.equal(nodoPorId(mismo.pasos, 'r')!.casos![0].cuando, 'pregunta cuánto sale');
  assert.equal(nodoPorId(mismo.pasos, 'rm')!.cuerpo, 'guía nueva');
  assert.ok('error' in agregarCasoAlGrafo([msg('m')], { titulo: 'X', cuando: 'y', comoResponder: 'z' }));
  const lleno = [ctl('r', { nodo: 'respuesta', casos: Array.from({ length: TOPE_CASOS }, (_, i) => ({ id: `c${i}`, titulo: `c${i}`, cuando: 'x', siguiente: null })), si_no: null })];
  assert.ok('error' in agregarCasoAlGrafo(lleno, { titulo: 'otro', cuando: 'y', comoResponder: 'z' }));
  // Y el hand-off resuelto con una secuencia de tarjetas pasa por acá y por el guardado que valida.
  const h = sinComentarios(leer('../lib/chat-agent-handoff.ts'));
  assert.match(h, /if \(raizRespuesta\(pasos\) != null\) \{[\s\S]{0,400}agregarCasoAlGrafo\(pasos, escenario\)[\s\S]{0,300}await setSecuenciaPasos\(h\.secuencia_id, r\.pasos\)/);
  assert.match(h, /linkApp\(`\/chatbot\?sec=\$\{input\.secuenciaId\}`, ws\)/, 'el aviso del hand-off sin link a la automatización');
});

// ── 7. «Le ponen la etiqueta» ───────────────────────────────────────────────

test('(7) una etiqueta dispara SÓLO las secuencias de esa etiqueta; sin etiqueta, ninguna', () => {
  const lista = [
    { id: 1, trigger_tipo: TRIGGER_ETIQUETA, etiqueta_id: 5 },
    { id: 2, trigger_tipo: TRIGGER_ETIQUETA, etiqueta_id: null },
    { id: 3, trigger_tipo: 'etapa_actual', etiqueta_id: 5 },
    { id: 4, trigger_tipo: TRIGGER_ETIQUETA, etiqueta_id: '5' },
    { id: 6, trigger_tipo: TRIGGER_ETIQUETA, etiqueta_id: 9 },
  ];
  assert.deepEqual(secuenciasDeEtiqueta(lista, 5).map((s) => s.id), [1, 4]);
  assert.deepEqual(secuenciasDeEtiqueta(lista, '5').map((s) => s.id), [1, 4]);
  assert.deepEqual(secuenciasDeEtiqueta(lista, null), []);
  assert.deepEqual(secuenciasDeEtiqueta(lista, 0), []);
  // El motor: el evento, el filtro y la cohorte.
  assert.match(NUTRI, /etiqueta: \[TRIGGER_ETIQUETA\],/);
  assert.match(fn(NUTRI, 'export async function enrolarPorEvento('), /if \(evento === 'etiqueta'\) delEvento = secuenciasDeEtiqueta\(delEvento, ctx\?\.etiquetaId\);/);
  assert.match(NUTRI, /if \(triggerTipo === TRIGGER_ETIQUETA\) return leadsConEtiqueta\(/);
  // Y se cambia por la ruta del lienzo, con la validación en `setTriggerSecuencia`.
  const ruta = sinComentarios(leer('../app/api/chat-agent/secuencias/route.ts'));
  assert.match(ruta, /if \(body\.action === 'trigger'\) \{[\s\S]{0,400}await setTriggerSecuencia\(id, \{/);
  assert.match(ruta, /if \(e instanceof TriggerInvalidoError\) return Response\.json\(\{ ok: false, error: e\.message \}, \{ status: 400 \}\);/);
});

test('(7) los hechos del lead con la regla de siempre de «agendó» y «pagó»', () => {
  const h = hechosDeLead(
    { id: 1, created_at: new Date(AHORA - 2 * HORA).toISOString(), telefono: '+52 55 1234 5678', email: 'a@b.mx', junta_2_at: '2026-10-10T10:00:00Z' },
    { etapaCasa: 'nuevo', yaContactado: true, respondio: false }, AHORA,
  );
  assert.equal(h.agendo, true, 'la segunda reunión también es «agendó»');
  assert.equal(h.pago, false);
  assert.equal(h.creadoMs, AHORA - 2 * HORA);
  assert.equal(h.etapa, 'nuevo');
  assert.equal(h.tieneTelefono, true);
  assert.equal(hechosDeLead({ id: 2, cerro: true, telefono: '' }, { etapaCasa: null, yaContactado: false, respondio: false }, AHORA).pago, true);
  assert.equal(hechosDeLead({ id: 3, telefono: '' }, { etapaCasa: null, yaContactado: false, respondio: false }, AHORA).tieneTelefono, false);
  // Una COLUMNA que falta no es la tabla que falta: sólo lo segundo se tolera.
  assert.equal(esTablaInexistente({ code: 'PGRST205' }), true);
  assert.equal(esTablaInexistente({ code: '42P01' }), true);
  assert.equal(esTablaInexistente({ message: 'relation "crm_lead_etiquetas" does not exist' }), true);
  assert.equal(esTablaInexistente({ message: 'column nutricion_inscripciones.nodo_actual does not exist' }), false);
  assert.equal(esTablaInexistente(null), false);
});

test('(7) un archivo de la biblioteca sale con su forma, y un documento nunca sin nombre', () => {
  assert.deepEqual(mediaDeAdjunto({ media_mime: 'image/png' }), { tipo: 'image', mimetype: 'image/png' });
  assert.equal(mediaDeAdjunto({ media_mime: 'video/mp4' }).tipo, 'video');
  assert.equal(mediaDeAdjunto({ media_mime: 'application/pdf', titulo: 'Precios 2026' }).fileName, 'Precios 2026.pdf');
  assert.equal(mediaDeAdjunto({ media_mime: 'application/pdf', nombre_archivo: 'lista.pdf', titulo: 'x' }).fileName, 'lista.pdf');
  assert.equal(mediaDeAdjunto({ media_mime: 'application/pdf' }).fileName, 'archivo.pdf');
});

// ── 8. «Si responde» con el mismo redactor ───────────────────────────────────

test('(8) «Si responde» despacha a responderConGrafo, y «MaKo contesta» usa el MISMO redactor', () => {
  const asistir = fn(NUTRI, 'async function asistirRespuesta(');
  const despacho = asistir.indexOf('if (raizRespuesta(secuencia.pasos) != null) return responderConGrafo(c);');
  assert.ok(despacho > 0, 'una secuencia con «Si responde» cae al hand-off de antes');
  assert.ok(despacho < asistir.indexOf("update({ estado: 'handoff'"), 'el despacho va ANTES del hand-off');
  const grafo = fn(NUTRI, 'async function responderConGrafo(');
  assert.match(grafo, /const escenarios = escenariosDeRespuesta\(pasos\);/);
  assert.match(grafo, /await clasificarEscenario\(texto \?\? '', lista\)/, 'el clasificador de siempre, con los casos de la tarjeta');
  assert.match(grafo, /await redactarRespuesta\(c, \{/, '«MaKo contesta» redacta por otro camino');
  assert.ok(grafo.indexOf('await hayMensajeMasNuevo(c)') < grafo.indexOf('for (let vuelta'), 'la relectura va antes de recorrer la rama');
  assert.doesNotMatch(grafo, /estado: 'handoff'/, '«Si responde» no congela la inscripción');
  // REFACTOR, NO COPIA: el redactor se llama en UN lugar de todo el motor.
  assert.equal((NUTRI.match(/responderSimulador\(/g) ?? []).length, 1);
  // Un mensaje de la rama es una respuesta: sin el anti-ban de 20 h, con «sale sola» por tarjeta.
  const mandar = fn(NUTRI, 'async function mandarMensajeDeRespuesta(');
  assert.doesNotMatch(mandar, /leadsConEnvioReciente|conEnvioReciente/);
  assert.match(mandar, /saleSolo\(p, secuencia\.envio_automatico\)/);
  // Y una acción corre UNA vez por respuesta: se reclama antes de ejecutar.
  const accion = fn(NUTRI, 'async function correrAccionDeRespuesta(');
  assert.ok(accion.indexOf('reclamarEspaciado(') > 0 && accion.indexOf('reclamarEspaciado(') < accion.indexOf('ejecutarDesdeFlujo('));
});

test('(8) la posición se escribe y se compara: el motor lee y guarda `nodo_actual` y `nodo_id`', () => {
  const proc = fn(NUTRI, 'export async function procesarEnvios(');
  // (Segunda tanda, 08/10/2026: la cola lee también `hilos, hilos_rev` —mig 0228, ANTES del deploy—
  // y `proximo_envio_at`, que es el próximo del cursor cuando se convierte en el hilo principal.)
  assert.match(proc, /\.select\('id, lead_id, secuencia_id, paso_actual, nodo_actual, proximo_envio_at, hilos, hilos_rev'\)/);
  const mig0228 = leer('../supabase/migrations/0228_hilos_paralelos.sql');
  for (const col of ['hilos jsonb', 'hilos_rev integer not null default 0']) assert.ok(mig0228.includes(`add column if not exists ${col}`), `falta ${col} en la 0228`);
  assert.match(mig0228, /ANTES DEL DEPLOY/, 'la 0228 no dice en qué orden se aplica');
  assert.match(proc, /const idxLeido = sec \? indiceActual\(sec\.pasos, insc\) : -1;/);
  assert.ok((proc.match(/nodo_id: idDe\(paso, insc\.paso_actual\),/g) ?? []).length >= 3, 'un envío sin el nodo que lo dejó');
  // El tope de 20 «Ir a» seguidos va por `resolverControl`, que lo devuelve como un cierre.
  assert.match(proc, /resolverControl\(sec\.pasos, idxLeido, \{/);
  const mig = leer('../supabase/migrations/0223_flujo_grafo.sql');
  for (const col of ['nodo_actual text', 'nodo_id text', 'etiqueta_id bigint', 'audio_id bigint', 'adjunto_id bigint']) {
    assert.ok(mig.includes(`add column if not exists ${col}`), `falta ${col} en la 0223`);
  }
  assert.match(mig, /ANTES DEL DEPLOY/, 'la cabecera no dice en qué orden se aplica');
});

// ── 9. avisar_al_equipo ──────────────────────────────────────────────────────

test('(9) avisar_al_equipo: la acción que usa «Otra cosa», por el canal de los flujos', () => {
  const op = DEFS.find((d) => d.id === OP_AVISAR);
  assert.ok(op, 'el conversor y el lienzo usan una operación que el registro no tiene');
  assert.equal(op!.tipo, 'accion');
  assert.equal(op!.confirmacion, 'chat');
  assert.equal(op!.costo, 'gratis');
  assert.ok(op!.canales.includes('app'), 'un paso de flujo corre por el canal app: sin él, «Otra cosa» no avisa');
  assert.ok(op!.parametros.some((p) => p.nombre === 'mensaje' && p.obligatorio === true));
  const run = sinComentarios(leer('../lib/api-mako/areas/chatbot.run.ts'));
  const i = run.indexOf('\n  avisar_al_equipo: {');
  const b = run.slice(i, run.indexOf('\n  },\n', i));
  assert.match(b, /ws: ctx\.ws,/, 'sin ws explícito el aviso cae al grupo de la agencia');
  // Por lead, y por RESPUESTA cuando sale de «Si responde» (revisión del 08/10/2026).
  assert.match(b, /dedupKey: respuesta \? `lead:\$\{lead\.id\}:resp:\$\{respuesta\}` : `lead:\$\{lead\.id\}`, dedupTtlMin: 60 \* 12,/, 'dos automatizaciones del mismo lead son dos avisos');
  assert.match(b, /linkApp\(`\/crm\/\$\{lead\.id\}`, ctx\.ws\)/);
});
