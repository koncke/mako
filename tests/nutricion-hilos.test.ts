// =============================================================================
// Los HILOS de una inscripción: varias flechas en paralelo corriendo A LA VEZ
// =============================================================================
// Segunda tanda del chatbot (08/10/2026), decisiones 2, 3, 4 y 7 de
// docs/chatbot-flujo-ramas-diseno.md. Lo puro vive en lib/nutricion-hilos.ts y en
// `resolverControl` (lib/nutricion-grafo-motor.ts); el que escribe es `procesarEnvios`.
//
// Y lo que más importa: los 6 flujos vigentes (ninguno tiene flechas en paralelo) se comportan
// EXACTAMENTE igual — el último bloque lo fija sobre la forma real de #198 y #212, leída de
// producción (sólo lectura) el 08/10/2026, sin los textos.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  sanearHilos, hilosIniciales, hilosVencidos, aplicarAHilo, repartosDe, hilosNuevos, hiloSigueEn, hayOtrosHilos,
  planDePosicion, nodosDeLaFila, esFilaNueva, proximoDeEntrada, mensajeAnteriorDe, type Hilo,
} from '../lib/nutricion-hilos';
import { resolverControl, indiceActual, pasoDeEntrada, esNodoDeControl, esPrimerPaso, necesitaHechos } from '../lib/nutricion-grafo-motor';
import { ID_INICIO, raicesSalida, type PasoGrafo, type HechosLead } from '../lib/flujo-grafo';

const AHORA = Date.parse('2026-10-08T15:00:00Z');
const HORA = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();
const msg = (id: string, x: Partial<PasoGrafo> = {}): PasoGrafo => ({ id, canal: 'whatsapp', cuerpo: id, ...x });
const ctl = (id: string, x: Partial<PasoGrafo>): PasoGrafo => ({ id, canal: 'whatsapp', cuerpo: '', ...x });
const H = (x: Partial<HechosLead> = {}): HechosLead => ({
  etiquetas: new Set(), etapa: null, etapasPorProducto: new Map(), agendo: false, pago: false, yaContactado: false,
  respondio: false, creadoMs: AHORA - HORA, tieneTelefono: true, tieneEmail: true, ahoraMs: AHORA, ...x,
});

// Un CRON que saca dos caminos: WhatsApp (w1 → espera → w2) y email (e1 → e2), y un mensaje con
// una flecha en paralelo a una acción.
const P: PasoGrafo[] = [
  msg('w1', { siguiente: 'esp', paralelos: ['acc'] }),
  ctl('esp', { nodo: 'esperar', espera: { modo: 'tiempo', minutos: 60 * 24 }, siguiente: 'w2' }),
  msg('w2', { siguiente: null }),
  msg('e1', { canal: 'email', siguiente: 'e2' }),
  msg('e2', { canal: 'email', siguiente: null }),
  { id: 'acc', canal: 'whatsapp', cuerpo: '', accion: { operacion: 'mover_etapa', params: {} }, siguiente: null } as PasoGrafo,
  ctl(ID_INICIO, { nodo: 'inicio', siguiente: 'w1', paralelos: ['e1'] }),
];
const proximoDe = (n: string) => iso(AHORA + (n === 'e1' ? 0 : HORA));

// ── Las funciones puras ─────────────────────────────────────────────────────

test('hilosIniciales: un hilo por raíz (la principal es «p»); con una sola raíz, NULL', () => {
  // Probado rompiéndolo (08/10/2026): `hilosIniciales` sin el corte de una sola raíz → 21 pasan /
  // 2 fallan (éste y el de los vigentes, que dejaba de ser un cursor).
  assert.deepEqual(raicesSalida(P), ['w1', 'e1']);
  assert.deepEqual(hilosIniciales(P, proximoDe), [
    { h: 'p', nodo: 'w1', proximo: iso(AHORA + HORA) },
    { h: 'e1', nodo: 'e1', proximo: iso(AHORA) },
  ]);
  const sinInicio = P.filter((p) => p.id !== ID_INICIO);
  assert.equal(hilosIniciales(sinInicio, proximoDe), null, 'una sola raíz: la inscripción sigue siendo de un cursor');
});

test('hilosVencidos: los que ya tocan, del más viejo al más nuevo (y por nombre si empatan)', () => {
  const hs: Hilo[] = [{ h: 'p', nodo: 'w1', proximo: iso(AHORA + HORA) }, { h: 'b', nodo: 'x', proximo: iso(AHORA - HORA) }, { h: 'a', nodo: 'y', proximo: iso(AHORA - HORA) }];
  assert.deepEqual(hilosVencidos(hs, AHORA).map((x) => x.h), ['a', 'b']);
  assert.deepEqual(hilosVencidos(hs, AHORA + 2 * HORA).map((x) => x.h), ['a', 'b', 'p']);
});

test('sanearHilos: lo que no es un hilo no viaja, y vacío es NULL (un cursor)', () => {
  assert.equal(sanearHilos(null), null);
  assert.equal(sanearHilos([]), null);
  assert.deepEqual(sanearHilos([{ h: 'p', nodo: 'w1', proximo: 'x' }, { h: 'p', nodo: 'otro', proximo: 'y' }, { nodo: 'z' }, 3]), [{ h: 'p', nodo: 'w1', proximo: 'x' }]);
});

test('aplicarAHilo: se mueve UN hilo; las columnas de siempre resumen el que vence primero', () => {
  const hs = hilosIniciales(P, proximoDe)!;
  const r = aplicarAHilo(P, hs, 'e1', { nodo: 'e2', proximo: iso(AHORA + 3 * HORA) });
  assert.deepEqual(r.hilos, [{ h: 'p', nodo: 'w1', proximo: iso(AHORA + HORA) }, { h: 'e1', nodo: 'e2', proximo: iso(AHORA + 3 * HORA) }]);
  assert.deepEqual(r.resumen, { paso_actual: 0, nodo_actual: 'w1', proximo_envio_at: iso(AHORA + HORA), estado: 'activa' });
});

test('⚠️ un hilo que termina cierra SÓLO su camino; la inscripción termina cuando no queda ninguno', () => {
  // Probado rompiéndolo (08/10/2026): `aplicarAHilo` cerrando la inscripción con el primer cierre
  // (sin mirar los otros hilos) → 21 pasan / 2 fallan (éste y el del email que no mata al WhatsApp).
  const hs = hilosIniciales(P, proximoDe)!;
  const uno = aplicarAHilo(P, hs, 'e1', { cierra: true });
  assert.equal(uno.resumen.estado, 'activa', 'el email terminó y el WhatsApp sigue');
  assert.deepEqual(uno.hilos, [{ h: 'p', nodo: 'w1', proximo: iso(AHORA + HORA) }]);
  const dos = aplicarAHilo(P, uno.hilos!, 'p', { cierra: true });
  assert.deepEqual(dos, { hilos: null, resumen: { nodo_actual: null, proximo_envio_at: null, estado: 'completada' }, descartados: 0 });
});

test('aplicarAHilo: un reparto a un hilo que ya corre, o pasado el tope, no arranca (y se cuenta)', () => {
  const hs: Hilo[] = [{ h: 'p', nodo: 'w1', proximo: iso(AHORA) }];
  const r = aplicarAHilo(P, hs, 'p', { nodo: 'esp' }, [{ h: 'acc', nodo: 'acc', proximo: iso(AHORA) }, { h: 'acc', nodo: 'acc', proximo: iso(AHORA) }]);
  assert.equal(r.hilos!.length, 2);
  assert.equal(r.descartados, 1, 'la misma tarjeta dos veces = el mismo mensaje dos veces al lead');
  const lleno = Array.from({ length: 6 }, (_, k) => ({ h: `h${k}`, nodo: 'w1', proximo: iso(AHORA) }));
  assert.equal(aplicarAHilo(P, lleno, 'h0', {}, [{ h: 'x', nodo: 'e1', proximo: iso(AHORA) }]).descartados, 1, 'el tope de hilos es la red');
});

test('repartosDe / hilosNuevos: las flechas en paralelo de una tarjeta arrancan con su programación', () => {
  assert.deepEqual(repartosDe(P, 0), ['acc']);
  assert.deepEqual(repartosDe(P, 2), []);
  assert.deepEqual(hilosNuevos(['acc'], () => iso(AHORA)), [{ h: 'acc', nodo: 'acc', proximo: iso(AHORA) }]);
});

test('hiloSigueEn / hayOtrosHilos: lo que preguntan el compare-and-set y lo terminal de un email', () => {
  const hs = hilosIniciales(P, proximoDe)!;
  assert.equal(hiloSigueEn(hs, 'e1', 'e1'), true);
  assert.equal(hiloSigueEn(hs, 'e1', 'e2'), false, 'otra corrida ya movió este hilo: el cambio es de ella');
  assert.equal(hiloSigueEn(null, 'p', 'w1'), false);
  assert.equal(hayOtrosHilos(hs, 'e1'), true);
  assert.equal(hayOtrosHilos([hs[0]], 'p'), false);
  assert.equal(hayOtrosHilos(null, null), false, 'un cursor solo no tiene otros hilos');
});

// ── La puerta de la posición ────────────────────────────────────────────────

test('planDePosicion: sin hilos ni repartos, los campos van TAL CUAL (el camino de siempre)', () => {
  // Probado rompiéndolo (08/10/2026): `planDePosicion` siempre en modo hilos → 20 pasan / 3 fallan
  // (éste, el de los vigentes y el del reparto desde un cursor).
  const campos = { paso_actual: 3, nodo_actual: 'w2', proximo_envio_at: iso(AHORA), estado: 'activa', ultimo_paso_at: 'x' };
  assert.deepEqual(planDePosicion(P, { hilos: null, h: null, nodo: 'w1', proximo_envio_at: null }, campos), { modo: 'cursor', update: campos });
});

test('planDePosicion: la primera flecha en paralelo convierte el cursor en el hilo «p» y suma el nuevo', () => {
  const p = planDePosicion(P, { hilos: null, h: null, nodo: 'w1', proximo_envio_at: iso(AHORA) },
    { paso_actual: 1, nodo_actual: 'esp', proximo_envio_at: iso(AHORA + HORA), estado: 'activa', ultimo_paso_at: 'x' },
    { nuevos: [{ h: 'acc', nodo: 'acc', proximo: iso(AHORA) }] });
  assert.equal(p.modo, 'hilos');
  assert.deepEqual(p.modo === 'hilos' && p.hilos, [{ h: 'p', nodo: 'esp', proximo: iso(AHORA + HORA) }, { h: 'acc', nodo: 'acc', proximo: iso(AHORA) }]);
  assert.equal(p.update.ultimo_paso_at, 'x', 'lo que no es la posición viaja igual');
  assert.equal(p.update.nodo_actual, 'acc', 'las columnas de siempre resumen el que vence primero');
});

test('planDePosicion: con hilos, cerrar mueve UN hilo; el alcance «inscripción» cierra TODO', () => {
  const hs = hilosIniciales(P, proximoDe)!;
  const leido = { hilos: hs, h: 'e1', nodo: 'e1', proximo_envio_at: null };
  const cierraHilo = planDePosicion(P, leido, { estado: 'cancelada', proximo_envio_at: null });
  assert.deepEqual(cierraHilo.modo === 'hilos' && cierraHilo.hilos, [hs[0]], 'el email sin salida cierra SÓLO su hilo');
  assert.equal(cierraHilo.update.estado, 'activa');
  const todo = planDePosicion(P, leido, { estado: 'completada', proximo_envio_at: null }, { alcance: 'inscripcion' });
  assert.deepEqual(todo.update, { estado: 'completada', proximo_envio_at: null, nodo_actual: null, hilos: null });
});

// ── resolverControl devuelve los repartos ───────────────────────────────────

test('⚠️ resolverControl devuelve las flechas de una espera AUNQUE la resolución siga de largo', () => {
  // Probado rompiéndolo (08/10/2026): sin el `repartir(...)` de la espera → 20 pasan / 3 fallan.
  const E: PasoGrafo[] = [
    ctl('e', { nodo: 'esperar', espera: { modo: 'antes_reunion', minutos: 60 }, siguiente: 'm', paralelos: ['x'] }),
    msg('m', { siguiente: null }), msg('x', { siguiente: null }),
  ];
  // La reunión es en 30 min: la espera «1 h antes» ya venció y se sigue de largo.
  const ya = resolverControl(E, 0, { hechos: null, ahoraMs: AHORA, reunionMs: AHORA + 30 * 60_000 });
  assert.equal(ya.tipo, 'nodo');
  assert.deepEqual(ya.tipo !== 'faltan_hechos' && ya.repartos, [{ destino: 'x', desdeMs: AHORA }], 'las flechas de una espera vencida se perdían');
  // La reunión es en 3 h: la espera frena y sus flechas arrancan cuando vence.
  const frena = resolverControl(E, 0, { hechos: null, ahoraMs: AHORA, reunionMs: AHORA + 3 * HORA });
  assert.deepEqual(frena.tipo !== 'faltan_hechos' && frena.repartos, [{ destino: 'x', desdeMs: AHORA + 2 * HORA }]);
  // Una espera SIN siguiente y con flechas: este camino termina, las flechas arrancan al vencer.
  const sola = resolverControl([ctl('e', { nodo: 'esperar', espera: { modo: 'tiempo', minutos: 60 }, siguiente: null, paralelos: ['x'] }), msg('x', { siguiente: null })], 0, { hechos: null, ahoraMs: AHORA, reunionMs: null });
  assert.equal(sola.tipo, 'fin');
  assert.deepEqual(sola.tipo !== 'faltan_hechos' && sola.repartos, [{ destino: 'x', desdeMs: AHORA + HORA }]);
});

test('el inicio nunca es un paso: no recibe un mensaje, se resuelve por su salida y no es «el primer paso»', () => {
  // Probado rompiéndolo (08/10/2026): `esControl` sin 'inicio' (lo de la parte 0) → 21 pasan / 2
  // fallan (éste: `esNodoDeControl` y `esPrimerPaso` de la primera tarjeta real).
  const ini = P.findIndex((p) => p.id === ID_INICIO);
  assert.equal(esNodoDeControl(P[ini]), true, 'setSecuenciaPasos le ponía el relleno de un mensaje');
  assert.equal(esPrimerPaso(P, 0), true, 'w1 cuelga del inicio: sigue siendo el primero de su hilo');
  assert.equal(esPrimerPaso(P, 3), true, 'e1 también: es la primera de su hilo');
  assert.equal(indiceActual(P, { paso_actual: 0, nodo_actual: null }), 0, 'una fila nueva arranca en la primera tarjeta REAL');
  const r = resolverControl(P, ini, { hechos: null, ahoraMs: AHORA, reunionMs: null });
  assert.deepEqual(r, { tipo: 'nodo', idx: 0, via: [ID_INICIO], repartos: [{ destino: 'e1', desdeMs: AHORA }] });
  assert.equal(necesitaHechos(P, ini), false);
});

test('nodosDeLaFila / esFilaNueva: qué tarjetas mira el lote para leer los hechos del lead', () => {
  assert.equal(esFilaNueva({ paso_actual: 0, nodo_actual: null }), true);
  assert.equal(esFilaNueva({ paso_actual: 0, nodo_actual: null, hilos: [{ h: 'p', nodo: 'w1', proximo: 'x' }] }), false);
  assert.deepEqual(nodosDeLaFila(P, { paso_actual: 0, nodo_actual: null }, 0), [0, 3], 'una fila nueva se va a repartir: sus raíces');
  assert.deepEqual(nodosDeLaFila(P, { paso_actual: 0, nodo_actual: 'w2', hilos: [{ h: 'p', nodo: 'w2', proximo: 'x' }, { h: 'e1', nodo: 'e2', proximo: 'x' }] }, 2), [2, 4]);
});

test('proximoDeEntrada: el mínimo entre las raíces (un email «ya» no espera a un WhatsApp «en 1 h»)', () => {
  // Probado rompiéndolo (08/10/2026): devolviendo la principal (lo de antes) → 22 pasan / 1 falla.
  const r = proximoDeEntrada(P, (p) => (p?.id === 'e1' ? iso(AHORA) : iso(AHORA + HORA)));
  assert.equal(r, iso(AHORA));
  assert.equal(proximoDeEntrada([], () => 'sin-raiz'), 'sin-raiz');
});

test('mensajeAnteriorDe: la acción espera el borrador de SU mensaje, subiendo por las de control', () => {
  assert.equal(mensajeAnteriorDe(P, 5), 0, 'acc cuelga de w1 por la flecha en paralelo');
  const C: PasoGrafo[] = [msg('m', { siguiente: 'c' }), ctl('c', { nodo: 'condicion', ramas: [{ id: 'r', modo: 'todas', filas: [], siguiente: 'a' }], si_no: null }),
    { id: 'a', canal: 'whatsapp', cuerpo: '', accion: { operacion: 'x', params: {} }, siguiente: null } as PasoGrafo];
  assert.equal(mensajeAnteriorDe(C, 2), 0, 'una condición en el medio no corta');
  assert.equal(mensajeAnteriorDe(P, 0), -1, 'la primera del hilo no tiene mensaje arriba');
});

// ── El motor ────────────────────────────────────────────────────────────────

const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const NUTRI = sinComentarios(readFileSync(join(__dirname, '..', 'lib', 'nutricion.ts'), 'utf8').replace(/\r\n/g, '\n'));
const PROC = NUTRI.slice(NUTRI.indexOf('export async function procesarEnvios('), NUTRI.indexOf('\nexport async function pausarPorRespuesta('));

test('el motor: reparte al entrar, toma UN hilo por vuelta y vuelve a la cola si quedan otros', () => {
  // Probado rompiéndolo (08/10/2026): sin el `vistos.delete(insc.id); otraVuelta = true;` de la
  // selección → 22 pasan / 1 falla (éste).
  assert.match(PROC, /if \(sec && !hs && esFilaNueva\(insc\) && raicesSalida\(sec\.pasos\)\.length > 1\) \{\s*hs = await repartirAlEntrar\(/);
  assert.match(PROC, /const libres = hilosVencidos\(hs, Date\.now\(\)\)\.filter\(\(x\) => !hilosVistos\.has\(`\$\{insc\.id\}:\$\{x\.h\}:\$\{x\.nodo\}`\)\);/);
  assert.match(PROC, /if \(libres\.length > 1\) \{ vistos\.delete\(insc\.id\); otraVuelta = true; \}/);
  // Toda escritura de la posición pasa por la puerta, y la puerta decide si hay hilos.
  assert.match(PROC, /if \(planDePosicion\(pasosInsc, leidoDePosicion\(insc, pasosInsc\), campos, o\)\.modo === 'hilos'\) return escribirHilos\(/);
  // Los únicos `update` de la fila en el motor: los dos de la puerta (`moverConCas` y el de
  // `escribir`, los dos con `...campos`) y la reunión del paso, que no es la posición.
  const updates = [...PROC.matchAll(/from\('nutricion_inscripciones'\)\s*\.update\(\{\s*([\w.]+)/g)].map((m) => m[1]);
  assert.deepEqual(updates.sort(), ['...campos', '...campos', 'reunion_at'], `una escritura de la posición por fuera de la puerta: ${updates.join(', ')}`);
  // El compare-and-set por la revisión, con la relectura que no confunde «otro hilo» con «este hilo».
  const eh = NUTRI.slice(NUTRI.indexOf('async function escribirHilos('), NUTRI.indexOf('async function repartirAlEntrar('));
  assert.match(eh, /\.eq\('id', insc\.id\)\.eq\('estado', 'activa'\)\.eq\('hilos_rev', rev\)/);
  assert.match(eh, /hiloSigueEn\(hs, leido\.h \?\? HILO_PRINCIPAL, leido\.nodo\)/);
});

test('decisión 7: lo terminal de un email cierra SÓLO su hilo si hay otros vivos', () => {
  assert.match(PROC, /terminal = hayOtrosHilos\(sanearHilos\(insc\.hilos\), insc\.h \?\? null\);/, 'el remitente sandbox, con otros hilos, cierra el hilo');
  assert.match(PROC, /if \(paso\.canal === 'email' && hayOtrosHilos\(sanearHilos\(insc\.hilos\), insc\.h \?\? null\)\) \{\s*await escribir\(insc, \{ estado: 'completada', proximo_envio_at: null \}, \{ modo: 'fila' \}\);\s*await anotarCierreSinEnvio\(insc, paso, lead, 'canal email apagado'\);/);
  // Los cierres de la INSCRIPCIÓN entera: la reunión que ya pasó, el residuo, el tope de saltos.
  assert.ok((PROC.match(/alcance: 'inscripcion'/g) ?? []).length >= 2);
  assert.match(PROC, /await cerrar\('la reunión ya pasó', true, 'inscripcion'\)/);
  assert.match(PROC, /await cerrar\(`el flujo da más de \$\{TOPE_SALTOS\} saltos sin esperar: se cortó`, true, 'inscripcion'\)/);
});

// ── Los 6 flujos vigentes: EXACTAMENTE igual ────────────────────────────────

// La forma de #198 y #212 en producción (sólo lectura, 08/10/2026), sin los textos.
const W = { canal: 'whatsapp', cuerpo: '', delay_horas: 0 };
const F198: PasoGrafo[] = [
  { ...W, id: 'n2199q6', nodo: 'condicion', ramas: [{ id: 'nym10zg', modo: 'todas', filas: [{ campo: 'antiguedad', valor: 72 }], siguiente: 'nv8c28e' }], si_no: null },
  { ...W, id: 'nv8c28e', nodo: 'esperar', espera: { modo: 'tiempo', minutos: 60 }, siguiente: 'nz7zsf8' },
  { ...W, id: 'nz7zsf8', nodo: 'condicion', ramas: [{ id: 'nwvn741', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 'nnv67mk' }], si_no: 'o0' },
  { ...W, id: 'nnv67mk', nodo: 'ir_a', destino: { secuencia_id: 212 } },
  { ...W, id: 'o0', tipo: 'audio', orden: 1, revisar: false, audio_id: 1, proveedor: 'no_oficial', siguiente: 'nmcf843' },
  { ...W, id: 'nmcf843', nodo: 'esperar', espera: { modo: 'tiempo', minutos: 1440 }, siguiente: 'npkwvnc' },
  { ...W, id: 'npkwvnc', nodo: 'condicion', ramas: [{ id: 'n8nwuyi', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 'nys2los' }], si_no: null },
  { ...W, id: 'nys2los', nodo: 'ir_a', destino: { secuencia_id: 212 } },
  { ...W, id: 'n1b5m7i', nodo: 'respuesta', casos: [], si_no: 'nloy67n' },
  { ...W, id: 'nloy67n', accion: { params: { leadId: 'evento', mensaje: 'x' }, operacion: 'avisar_al_equipo' }, siguiente: null },
] as PasoGrafo[];
const F212: PasoGrafo[] = [
  { ...W, id: 'n546kbu', nodo: 'esperar', espera: { modo: 'tiempo', minutos: 60 }, siguiente: 'o0' },
  { ...W, id: 'o0', tipo: 'audio', orden: 1, revisar: false, audio_id: 5, proveedor: 'no_oficial', siguiente: 'nmuhchv' },
  { ...W, id: 'nmuhchv', nodo: 'esperar', espera: { modo: 'tiempo', minutos: 1440 }, siguiente: 'o1' },
  { ...W, id: 'o1', tipo: 'ia', orden: 2, revisar: false, proveedor: 'no_oficial', siguiente: 'n0gmnw2' },
  { ...W, id: 'n0gmnw2', nodo: 'esperar', espera: { modo: 'tiempo', minutos: 720 }, siguiente: 'nvknkdc' },
  { ...W, id: 'nvknkdc', accion: { params: { leadId: 'evento' }, operacion: 'avisar_al_equipo' }, siguiente: null },
  { ...W, id: 'ne0ue2g', nodo: 'respuesta', casos: [{ id: 'noytn1p', siguiente: 'nlqg1qu' }, { id: 'ntt950k', siguiente: 'neps1ug' }, { id: 'nw12fhe', siguiente: 'n7xhnta' }, { id: 'nn8r1wu', siguiente: 'naymz66' }], si_no: 'ncsthxl' },
  { ...W, id: 'nlqg1qu', tipo: 'ia', revisar: false, proveedor: 'no_oficial', siguiente: null },
  { ...W, id: 'neps1ug', tipo: 'ia', revisar: true, proveedor: 'no_oficial', siguiente: null },
  { ...W, id: 'n7xhnta', tipo: 'ia', revisar: true, proveedor: 'no_oficial', siguiente: null },
  { ...W, id: 'naymz66', tipo: 'ia', revisar: false, proveedor: 'no_oficial', siguiente: null },
  { ...W, id: 'ncsthxl', accion: { params: { leadId: 'evento' }, operacion: 'avisar_al_equipo' }, siguiente: null },
] as PasoGrafo[];

for (const [nombre, F] of [['#198', F198], ['#212', F212]] as const) {
  test(`⚠️ ${nombre} (hilos NULL) no entra NUNCA al modo hilos: cada escritura es la de siempre, tal cual`, () => {
    // Probado rompiéndolo (08/10/2026): `repartosDe` devolviendo la salida principal además de los
    // paralelos → caen los dos tests de vigentes (y 3 más): sus escrituras pasaban a modo hilos.
    assert.equal(raicesSalida(F).length, 1, 'una sola raíz: no se reparte al entrar');
    assert.equal(hilosIniciales(F, () => iso(AHORA)), null);
    assert.equal(proximoDeEntrada(F, (p) => (p ? `entrada:${p.id}` : 'nada')), `entrada:${pasoDeEntrada(F)?.id}`, 'el primer envío es el de la entrada, como siempre');
    const nueva = { paso_actual: 0, nodo_actual: null };
    assert.deepEqual(nodosDeLaFila(F, nueva, indiceActual(F, nueva)), [indiceActual(F, nueva)]);
    // Recorro TODAS las tarjetas: ningún mensaje ni acción reparte, ninguna resolución trae repartos,
    // y cualquier escritura que el motor haría pasa por la puerta como `cursor`, sin tocarle nada.
    const camposPosibles: Array<Record<string, unknown>> = [
      { paso_actual: 1, nodo_actual: 'x', proximo_envio_at: iso(AHORA), estado: 'activa', ultimo_paso_at: iso(AHORA) },
      { estado: 'completada', proximo_envio_at: null },
      { estado: 'cancelada', proximo_envio_at: null },
      { proximo_envio_at: iso(AHORA + 6 * HORA) },
      { proximo_envio_at: null },
    ];
    F.forEach((p, i) => {
      assert.deepEqual(repartosDe(F, i), [], `${nombre}: la tarjeta ${p.id} repartía`);
      for (const hechos of [H(), H({ agendo: true }), H({ creadoMs: AHORA - 100 * HORA })]) {
        const r = resolverControl(F, i, { hechos, ahoraMs: AHORA, reunionMs: AHORA + 48 * HORA });
        if (r.tipo !== 'faltan_hechos') assert.deepEqual(r.repartos, [], `${nombre}: resolver desde ${p.id} trajo repartos`);
      }
      for (const campos of camposPosibles) {
        for (const alcance of [undefined, 'hilo', 'inscripcion'] as const) {
          const plan = planDePosicion(F, { hilos: null, h: null, nodo: p.id ?? null, proximo_envio_at: iso(AHORA) }, campos, { alcance, nuevos: [] });
          assert.deepEqual(plan, { modo: 'cursor', update: campos }, `${nombre}: la escritura desde ${p.id} cambió`);
        }
      }
    });
  });
}
