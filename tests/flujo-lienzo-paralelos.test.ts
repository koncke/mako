// =============================================================================
// El lienzo de la segunda tanda: un solo CRON, flechas en paralelo, dos familias de tarjetas
// =============================================================================
// Pedido literal de Martín (08/10/2026, segunda tanda):
//   1. «No pueden haber 2 flujos por separado. Solo 1 CRON y de ahí desprende todo.»
//   2. «Del CRON inicial debería poder sacar varias flechas... de un mismo cron puedo sacar toda
//      una secuencia para WhatsApp y toda otra secuencia de email.»
//   5. «Las tarjetas de condición, esperar y etiqueta, deberían tener un diseño diferente a las de
//      mensaje y CRON.»
//   6. «Falta la tarjeta de etiqueta, para poder colocar una etiqueta al lead.»
// Las decisiones (docs/chatbot-flujo-ramas-diseno.md, «SEGUNDA TANDA»): 1, 2 (el dibujo), 5, 6, 9,
// 10, 11 y 15. El modelo (lib/flujo-grafo.ts) es de sólo lectura para esta parte: acá se mide lo
// que el LIENZO hace con él, ejecutando `grafoDeSecuencia` con flujos de verdad.
//
// PROBADO ROMPIÉNDOLO (08/10/2026; con todo puesto: 12 pasan, 0 fallan). Cada rotura de a una,
// aplicada y restaurada DE MEMORIA por un arnés (nunca con `git checkout`). Pasan / fallan:
//   1. el CRON vuelve a usar ⚡                                                     -> 11 / 1
//   2. «Si responde» deja de ser hijo del CRON (no entra en sus destinos)           -> 11 / 1
//   3. las flechas en paralelo con el tono de siempre ('normal')                    -> 10 / 2
//   4. un nodo con paralelos NO se trata como multi (los hijos se pisan)            -> 11 / 1
//   5. se ofrece `paralelo` también dentro de «Si responde»                         -> 11 / 1
//   6. `lugarDesdeLienzo` manda el ＋ del CRON en paralelo a «al principio»         -> 10 / 2
//   7. el editor del «Ir a» ofrece tarjetas de OTRO hilo desde la salida            -> 11 / 1
//   8. la espera deja de ser una píldora (alto de tarjeta normal)                   -> 11 / 1
//   9. la columna se calcula con el ancho de la tarjeta (las columnas se corren)    -> 11 / 1
//  10. la tarjeta de etiqueta sin su color                                          -> 11 / 1
//  11. `nodoNuevo('email')` sin preheader                                           -> 11 / 1
//  12. `tinteDeControl` usa un token que no se redefine en oscuro (--mako-lite)     -> 11 / 1
//  13. SecuenciaPerfil sin el `beforeunload`                                        -> 11 / 1
//  14. la tab cambia de automatización sin preguntar con cambios sin publicar       -> 11 / 1
//
// Correr: node --import tsx --test tests/flujo-lienzo-paralelos.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  grafoDeSecuencia, insertarDesdeLienzo, nodoNuevo, crearRespuesta, faltaEscribir, nombreDeTarjeta, tarjetasParaIrA,
  lugarDesdeLienzo, ID_ENTRADA, PUERTO_RESPUESTA, ICONO_CRON, ALTO_PILDORA, ANCHO_PILDORA, ALTO_COMPACTO, ANCHO_ETIQUETA,
  type PasoParaGrafo, type NodoFlujo,
} from '../lib/flujo-conversacion';
import { ANCHO_NODO, ALTO_MIN, ALTO_PUERTO, yDePuerto } from '../lib/lienzo-grafo';
import { validarGrafo, nodoPorId, claseDe, ID_INICIO, TOPE_PARALELOS } from '../lib/flujo-grafo';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const rndDe = (semilla = 1) => { let s = semilla; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };
const msg = (id: string, extra: Partial<PasoParaGrafo> = {}): PasoParaGrafo => ({ id, canal: 'whatsapp', delay_horas: 0, cuerpo: 'hola', siguiente: null, ...extra });
const mail = (id: string, extra: Partial<PasoParaGrafo> = {}): PasoParaGrafo => msg(id, { canal: 'email', asunto: 'Asunto', cuerpo: 'Cuerpo del mail', ...extra });
const inicio = (siguiente: string | null, paralelos: string[]): PasoParaGrafo => ({ id: ID_INICIO, nodo: 'inicio', siguiente, paralelos, canal: 'whatsapp', delay_horas: 0, cuerpo: '' });
const nodo = (g: { nodos: NodoFlujo[] }, id: string): NodoFlujo => { const n = g.nodos.find((x) => x.id === id); assert.ok(n, `no está el nodo ${id}`); return n; };
const sePisan = (a: NodoFlujo, b: NodoFlujo) => a.x < b.x + b.ancho && b.x < a.x + a.ancho && a.y < b.y + b.alto && b.y < a.y + a.alto;
const sinPisarse = (g: { nodos: NodoFlujo[] }) => {
  for (let i = 0; i < g.nodos.length; i++) for (let j = i + 1; j < g.nodos.length; j++) {
    assert.ok(!sePisan(g.nodos[i], g.nodos[j]), `${g.nodos[i].id} y ${g.nodos[j].id} se pisan`);
  }
};

/** WhatsApp por la principal y dos hilos de email en paralelo desde el CRON, y «Si responde». */
const conHilosDelCron = (): PasoParaGrafo[] => {
  const base = [msg('m1', { siguiente: 'm2' }), msg('m2'), mail('e1', { siguiente: 'e2' }), mail('e2'), mail('f1'), inicio('m1', ['e1', 'f1'])];
  return crearRespuesta(base, rndDe(3)).pasos;
};

test('⚠️ el CRON: SIN filas (ni «Al entrar» ni «Si responde»), su propio ícono y la familia de contenido', () => {
  const g = grafoDeSecuencia([msg('a')], { disparador: 'Agendó una reunión' });
  const e = nodo(g, ID_ENTRADA);
  assert.equal(e.icono, ICONO_CRON);
  // SEXTA TANDA, CRON 10: «que el emoji de CRON sea el rayo». El que se mudó es el de la Acción: las dos
  // tarjetas siguen sin compartir el ícono (R3).
  assert.equal(ICONO_CRON, '⚡', 'el CRON no es el rayo');
  const accion = nodo(grafoDeSecuencia([msg('ac', { accion: { operacion: 'mover_lead', params: {} } })], { disparador: 'X' }), 'ac');
  assert.notEqual(accion.icono, ICONO_CRON, 'la Acción comparte el ícono con el CRON (R3)');
  assert.equal(e.familia, 'contenido');
  // Cuarta tanda, punto 4: «se va el texto "Si responde" del CRON, y también quita el texto "Al
  // entrar"». Una sola salida sin rótulo, de la que salen las flechas en paralelo.
  assert.deepEqual(e.puertos!.map((p) => p.rotulo), [undefined]);
  assert.equal(e.puertos![0].paralelo, true, 'el CRON con salida tiene que ofrecer una flecha en paralelo');
  // Sin salida, está vacía (su ＋ continúa) y no ofrece paralelo: no hay a qué ir al lado.
  const vacio = nodo(grafoDeSecuencia([], { disparador: 'X' }), ID_ENTRADA);
  assert.deepEqual(vacio.puertos![0], { id: 'sig', vacio: true });
  // El ＋ en paralelo desde el CRON pide el inicio del modelo, exista o no todavía.
  assert.deepEqual(lugarDesdeLienzo(ID_ENTRADA, 'par'), { nodo: ID_INICIO, puerto: 'par' });
  assert.deepEqual(lugarDesdeLienzo(ID_ENTRADA, 'par:e1'), { nodo: ID_INICIO, puerto: 'par:e1' });
  assert.deepEqual(lugarDesdeLienzo(ID_ENTRADA, 'sig'), { inicio: true });
});

test('⚠️ las flechas en paralelo del CRON: hijos en la columna 1, apilados sin pisarse, «Si responde» abajo de todo', () => {
  const pasos = conHilosDelCron();
  assert.deepEqual(validarGrafo(pasos), [], 'el fixture tiene que ser un flujo válido');
  const g = grafoDeSecuencia(pasos, { disparador: 'X' });
  sinPisarse(g);
  const resp = g.nodos.find((n) => n.tipo === 'respuesta')!;
  const col1 = ['m1', 'e1', 'f1'].map((id) => nodo(g, id));
  for (const n of [...col1, resp]) assert.equal(n.x, nodo(g, 'm1').x, `${n.id} no está en la columna 1`);
  assert.ok(col1[0].y < col1[1].y && col1[1].y < col1[2].y && col1[2].y < resp.y, 'el orden es [principal, …paralelos, «Si responde»]');
  // El inicio NO se dibuja: ES el CRON. Una tarjeta por paso (menos el inicio) y el CRON.
  assert.ok(!g.nodos.some((n) => n.id !== ID_ENTRADA && n.titulo === 'CRON'));
  assert.equal(g.nodos.length, pasos.length);
  // Las flechas: todas desde el CRON, de su fila «Al entrar», y las en paralelo con OTRO tono.
  const cron = nodo(g, ID_ENTRADA);
  const yAlEntrar = yDePuerto(cron, 'sig');
  for (const [hasta, puerto, tono] of [['m1', 'sig', 'normal'], ['e1', 'par:e1', 'condicional'], ['f1', 'par:f1', 'condicional']] as const) {
    const a = g.aristas.find((x) => x.hasta === hasta);
    assert.equal(a?.desde, ID_ENTRADA, `${hasta} no sale del CRON`);
    assert.equal(a?.puerto, puerto);
    assert.equal(a?.tono, tono, `la flecha a ${hasta} no se distingue`);
    assert.equal(yDePuerto(cron, a!.puerto), yAlEntrar, `la flecha a ${hasta} no sale de «Al entrar»`);
  }
  // Lo de adentro de cada hilo sigue en fila, a la derecha.
  assert.equal(nodo(g, 'e2').y, nodo(g, 'e1').y);
  assert.ok(nodo(g, 'e2').x > nodo(g, 'e1').x);
});

test('⚠️ una tarjeta con paralelos apila [siguiente, …paralelos] arriba y abajo de su salida, sin pisarse', () => {
  const pasos = [msg('m1', { siguiente: 'm2', paralelos: ['e1', 'w1'] }), msg('m2', { siguiente: 'm3' }), msg('m3'), mail('e1'), msg('w1')];
  assert.deepEqual(validarGrafo(pasos), []);
  const g = grafoDeSecuencia(pasos, { disparador: 'X' });
  sinPisarse(g);
  const m1 = nodo(g, 'm1');
  const salida = yDePuerto(m1, 'sig');
  const hijos = ['m2', 'e1', 'w1'].map((id) => nodo(g, id));
  for (const h of hijos) assert.equal(h.x, m1.x + ANCHO_NODO + 92, `${h.id} no está en la columna siguiente`);
  assert.ok(hijos[0].y < hijos[1].y && hijos[1].y < hijos[2].y);
  assert.ok(hijos[0].y + hijos[0].alto / 2 < salida && hijos[2].y + hijos[2].alto / 2 > salida, 'los hijos no quedan arriba y abajo de la salida');
  assert.equal(g.aristas.find((a) => a.hasta === 'e1')?.tono, 'condicional');
  assert.equal(g.aristas.find((a) => a.hasta === 'm2')?.tono, 'normal');
  // La salida ocupada ofrece otra flecha en paralelo (le quedan: 2 de 3).
  assert.deepEqual(m1.puertos, [{ id: 'sig', vacio: false, paralelo: true }]);
});

test('⚠️ el ＋ en paralelo se ofrece SÓLO donde se puede publicar', () => {
  // Al tope por tarjeta (3), no.
  const llena = [msg('m1', { siguiente: 'm2', paralelos: ['a', 'b', 'c'] }), msg('m2'), msg('a'), msg('b'), msg('c')];
  assert.equal(TOPE_PARALELOS, 3);
  assert.equal(nodo(grafoDeSecuencia(llena, { disparador: 'X' }), 'm1').puertos![0].paralelo, undefined, 'se ofreció una cuarta flecha en paralelo');
  // Dentro de «Si responde», no (validarGrafo lo rechaza: la respuesta corre en el momento).
  const r = crearRespuesta([msg('a')], rndDe());
  const aviso = nodoPorId(r.pasos, r.id)!.si_no!;
  const g = grafoDeSecuencia(r.pasos, { disparador: 'X' });
  assert.equal(nodo(g, aviso).puertos![0].paralelo, undefined, 'se ofreció paralelo dentro de «Si responde»');
  // Una condición tampoco (sus ramas se excluyen); una espera sí. (Sexta tanda: una espera en el MEDIO
  // de una flecha va como pastilla sobre ella, sin salida propia; la del FINAL es su píldora y reparte.)
  const conEspera = [msg('m1', { siguiente: 'w' }), { ...nodoNuevo('esperar', [], rndDe()), id: 'w', siguiente: null }];
  const ge = grafoDeSecuencia(conEspera, { disparador: 'X' });
  assert.equal(nodo(ge, 'w').puertos![0].paralelo, true);
  // Y al tope de CAMINOS de la automatización (6), ninguna.
  const seis = [msg('x', { siguiente: 'y', paralelos: ['p1', 'p2', 'p3'] }), msg('y', { paralelos: ['q1', 'q2'] }), ...['p1', 'p2', 'p3', 'q1', 'q2'].map((id) => msg(id))];
  const g6 = grafoDeSecuencia(seis, { disparador: 'X' });
  assert.ok(g6.nodos.every((n) => !n.puertos?.some((p) => p.paralelo)), 'se ofreció un séptimo camino');
});

test('⚠️ `insertarDesdeLienzo`: «en paralelo» (par) y el ＋ del medio de una flecha en paralelo (par:<id>)', () => {
  // Desde una tarjeta: una flecha más, la tarjeta nueva sin nada después.
  const base = [msg('m1', { siguiente: 'm2' }), msg('m2')];
  const r = insertarDesdeLienzo(base, 'm1', 'par', 'email', rndDe());
  assert.ok(r.id);
  assert.deepEqual(nodoPorId(r.pasos, 'm1')!.paralelos, [r.id]);
  assert.equal(nodoPorId(r.pasos, 'm1')!.siguiente, 'm2', 'la flecha en paralelo pisó la de siempre');
  assert.equal(nodoPorId(r.pasos, r.id)!.siguiente, null);
  assert.equal(nodoPorId(r.pasos, r.id)!.canal, 'email');
  assert.deepEqual(validarGrafo(r.pasos), []);
  // Desde el CRON sin inicio: el inicio se crea, con la salida de hoy como principal.
  const c = insertarDesdeLienzo(base, ID_ENTRADA, 'par', 'mensaje', rndDe(2));
  const ini = nodoPorId(c.pasos, ID_INICIO)!;
  assert.equal(claseDe(ini), 'inicio');
  assert.equal(ini.siguiente, 'm1');
  assert.deepEqual(ini.paralelos, [c.id]);
  assert.deepEqual(validarGrafo(c.pasos), []);
  // El ＋ del medio de esa flecha: la tarjeta nueva queda EN el medio y apunta a la de antes.
  const m = insertarDesdeLienzo(c.pasos, ID_ENTRADA, `par:${c.id}`, 'esperar', rndDe(3));
  assert.deepEqual(nodoPorId(m.pasos, ID_INICIO)!.paralelos, [m.id]);
  assert.equal(nodoPorId(m.pasos, m.id)!.siguiente, c.id);
  assert.deepEqual(validarGrafo(m.pasos), []);
  // (Hasta la tercera tanda acá se probaba que un «Ir a» no entraba en el medio: el ＋ ya no crea
  // «Ir a», decisión 3. Lo fija tests/flujo-conversacion.test.ts.)
});

/** Un «Ir a» sin destino al final de `desde`: ya no lo crea el ＋ (decisión 3), pero los que existen
 *  se siguen editando, así que el editor se prueba con uno armado a mano. */
const conIrA = (pasos: PasoParaGrafo[], desde: string, id: string): { pasos: PasoParaGrafo[]; id: string } => ({
  pasos: [...pasos.map((p) => (p.id === desde ? { ...p, siguiente: id } : p)), { id, canal: 'whatsapp', delay_horas: 0, cuerpo: '', nodo: 'ir_a', destino: null, siguiente: null }],
  id,
});

test('⚠️ el «Ir a» de la salida no ofrece tarjetas de OTRO hilo; el de «Si responde», todas', () => {
  const pasos = conHilosDelCron();
  const conSalto = conIrA(pasos, 'e2', 'irx');
  const ofrece = tarjetasParaIrA(conSalto.pasos, conSalto.id!);
  assert.ok(ofrece.includes('e1') && ofrece.includes('e2'), 'el «Ir a» no ofrece las de su propio hilo');
  for (const otro of ['m1', 'm2', 'f1']) assert.ok(!ofrece.includes(otro), `ofreció ${otro}, de otro hilo: el mismo mensaje saldría dos veces`);
  assert.ok(!ofrece.includes(ID_INICIO), 'el CRON no es un destino');
  // Desde «Si responde» (la respuesta pausa todo y retoma UN hilo), todas las de la salida.
  const resp = pasos.find((p) => claseDe(p) === 'respuesta')!;
  const avisoId = resp.si_no!;
  const desdeResp = conIrA(conSalto.pasos, avisoId, 'iry');
  const todas = tarjetasParaIrA(desdeResp.pasos, desdeResp.id!);
  for (const t of ['m1', 'm2', 'e1', 'e2', 'f1']) assert.ok(todas.includes(t), `desde «Si responde» falta ${t}`);
  // SEXTA TANDA (punto 12, «"Go to" desaparece directamente»): el editor del «Ir a» ya no elige un
  // destino; el que queda se pasa a una flecha (o se quita) con la MISMA conversión que el lienzo al
  // abrir (`quitarIrA`). `tarjetasParaIrA` queda para lo de antes (la IA, los tests de arriba).
  const flujo = sinComentarios(leer('../app/chatbot/FlujoLienzo.tsx'));
  assert.match(flujo, /onPasos\(\(prev\) => quitarIrA\(prev, \{ solo: id \}\)\.pasos, true\)/);
  assert.doesNotMatch(flujo, /tarjetasParaIrA\(/, 'el editor del «Ir a» vuelve a ofrecer destinos');
});

test('⚠️ dos familias: las de control son compactas (la espera, una píldora) y las columnas siguen alineadas', () => {
  const espera = (id: string, siguiente: string | null) => ({ ...nodoNuevo('esperar', [], rndDe()), id, siguiente });
  // SEXTA TANDA (DELAY 1): una espera EN EL MEDIO de una flecha ya no es una tarjeta (va sobre la flecha,
  // lo mide tests/lienzo-sexta-tanda.test.ts). La píldora es la espera del FINAL de un camino, y ésa es
  // la que se mide acá: «w» cierra la rama de arriba. La tarjeta angosta de la columna es la etiqueta «t».
  const pasos: PasoParaGrafo[] = [
    { id: 'c', canal: 'whatsapp', delay_horas: 0, cuerpo: '', nodo: 'condicion', si_no: 'mb', ramas: [{ id: 'r1', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 't' }] },
    msg('t', { accion: { operacion: 'poner_etiqueta_lead', params: { leadId: 'evento', etiquetaId: 7 } }, siguiente: 'ma' }),
    msg('ma', { siguiente: 'w' }), espera('w', null),
    msg('mb', { siguiente: 'mc' }), msg('mc', { siguiente: 'ir' }),
    { id: 'ir', canal: 'whatsapp', delay_horas: 0, cuerpo: '', nodo: 'ir_a', destino: { nodo: 'mb' } },
  ];
  const g = grafoDeSecuencia(pasos, { disparador: 'X' });
  sinPisarse(g);
  const w = nodo(g, 'w');
  assert.equal(w.familia, 'control');
  assert.equal(w.tipo, 'espera');
  assert.equal(w.alto, ALTO_PILDORA, 'la espera no es una píldora');
  assert.ok(w.ancho >= ANCHO_PILDORA && w.ancho <= ANCHO_NODO, `la píldora mide ${w.ancho} de ancho`);
  assert.equal(w.detalle, '1 día', 'la píldora dice cuánto espera, en una línea (`textoEspera` sin «Esperar»)');
  assert.equal(yDePuerto(w, 'sig'), w.y + ALTO_PILDORA / 2, 'la flecha no sale de la mitad de la píldora');
  assert.equal(nodo(g, 'c').familia, 'control');
  assert.equal(nodo(g, 'ir').familia, 'control');
  assert.equal(nodo(g, 'ir').alto, ALTO_COMPACTO);
  assert.equal(nodo(g, 'mb').familia, 'contenido');
  assert.equal(nodo(g, ID_ENTRADA).familia, 'contenido');
  // Las columnas no se corren aunque una tarjeta sea más angosta: «ma» (después de la etiqueta) y «mc»
  // (después de un mensaje) en la misma columna, y la píldora con el «Ir a» en la siguiente.
  assert.equal(nodo(g, 'ma').x, nodo(g, 'mc').x, 'una tarjeta angosta corrió su columna');
  assert.equal(w.x, nodo(g, 'ir').x);
});

test('⚠️ la tarjeta de ETIQUETA: la ⚡ Acción de poner/sacar dibujada como lo que hace, con su color', () => {
  const poner = msg('t1', { accion: { operacion: 'poner_etiqueta_lead', params: { leadId: 'evento', etiquetaId: 7 } }, siguiente: 't2' });
  const sacar = msg('t2', { accion: { operacion: 'sacar_etiqueta_lead', params: { leadId: 'evento', etiquetaId: 8 } }, siguiente: 't3' });
  const sinElegir = msg('t3', { accion: { operacion: 'poner_etiqueta_lead', params: { leadId: 'evento' } } });
  const nombres = { etiqueta: (id: number) => ({ 7: 'Cualificado', 8: 'Seguimiento' } as Record<number, string>)[id] ?? null };
  const colores: Record<number, string> = { 7: '#22aa66', 8: '#cc8800' };
  const g = grafoDeSecuencia([poner, sacar, sinElegir], { disparador: 'X', nombres, colorEtiqueta: (id) => colores[id] });
  const a = nodo(g, 't1');
  assert.equal(a.tipo, 'etiqueta');
  assert.equal(a.titulo, 'TAG', 'los títulos van en inglés (tercera tanda, decisión 5)');
  assert.equal(a.icono, '🏷️');
  assert.equal(a.familia, 'control');
  // Sexta tanda, TAG 1: «En lugar de "Poner" y "Sacar"... "Agregar" y "Eliminar"» (antes, «+ » y «− »).
  // Probado rompiéndolo (arnés scratchpad/editores-v6/romper.mjs, B25): con «+ »/«− » de vuelta → 50 / 1.
  assert.equal(a.detalle, 'Agregar Cualificado');
  assert.equal(a.color, '#22aa66', 'la tarjeta de etiqueta no lleva el color de la etiqueta');
  // Sexta tanda, punto 4: su salida va al pie («Entonces ●»), una fila más.
  assert.equal(a.alto, ALTO_COMPACTO + ALTO_PUERTO);
  assert.equal(a.salidaAlPie, true);
  assert.equal(a.ancho, ANCHO_ETIQUETA);
  assert.equal(nodo(g, 't2').detalle, 'Eliminar Seguimiento');
  assert.equal(nodo(g, 't3').detalle, 'Sin elegir');
  assert.ok(nodo(g, 't3').advertencia, 'una etiqueta sin elegir no se marca');
  assert.equal(nombreDeTarjeta([poner, sacar], 't1', nombres), 'TAG: Agregar Cualificado');
  // Una acción que no es de etiquetas sigue siendo una Acción.
  const otra = grafoDeSecuencia([msg('x', { accion: { operacion: 'mover_etapa', params: {} } })], { disparador: 'X' });
  assert.equal(nodo(otra, 'x').tipo, 'accion');
});

test('⚠️ el ＋ crea un EMAIL (con su vista previa) y una ETIQUETA sobre el lead del evento', () => {
  const e = nodoNuevo('email', [], rndDe());
  assert.equal(e.canal, 'email');
  assert.equal(e.asunto, '');
  assert.equal(e.preheader, '');
  assert.equal(e.cuerpo, '');
  assert.equal(claseDe(e), 'mensaje');
  const t = nodoNuevo('etiqueta', [], rndDe());
  assert.deepEqual(t.accion, { operacion: 'poner_etiqueta_lead', params: { leadId: 'evento' } });
  // El email nuevo se dibuja como EMAIL y no deja publicar sin asunto.
  const r = insertarDesdeLienzo([msg('a')], 'a', 'sig', 'email', rndDe(5));
  const g = grafoDeSecuencia(r.pasos, { disparador: 'X' });
  const n = nodo(g, r.id!);
  // Tercera tanda (decisión 5): el título en inglés, el sobre de Gmail y la identidad de la app.
  assert.equal(n.titulo, 'EMAIL');
  assert.equal(n.icono, 'gmail');
  assert.equal(n.canal, 'email');
  assert.equal(n.advertencia, 'Sin escribir');
  assert.equal(faltaEscribir(r.pasos)?.id, r.id);
  // Con asunto, vista previa y cuerpo, el alto cuenta la caja del mail.
  const lleno = grafoDeSecuencia([mail('m', { preheader: 'Lo que vas a ver', cuerpo: 'x'.repeat(200) })], { disparador: 'X' });
  assert.ok(nodo(lleno, 'm').alto > ALTO_MIN, 'el email no cuenta su caja');
  assert.equal(nodo(lleno, 'm').advertencia, undefined);
});

test('⚠️ el tinte de las tarjetas de control usa SÓLO tokens que se redefinen en oscuro', () => {
  const lienzo = sinComentarios(leer('../app/_components/Lienzo.tsx'));
  const ini = lienzo.indexOf('export function tinteDeControl(');
  // Hasta el cierre de la función (la de la identidad de WhatsApp/Email va después, con su test).
  const fin = lienzo.indexOf('\n}\n', ini);
  assert.ok(ini >= 0 && fin > ini);
  const fn = lienzo.slice(ini, fin);
  assert.ok(fn.length < 1_200, `el recorte mide ${fn.length}: está mirando otra cosa`);
  const tokens = [...new Set([...fn.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]))];
  assert.ok(tokens.length >= 4, 'el tinte no usa tokens');
  const css = leer('../app/globals.css');
  const oscuro = css.slice(css.indexOf('[data-tema="oscuro"] {'), css.indexOf('}', css.indexOf('[data-tema="oscuro"] {')));
  for (const t of tokens) assert.match(oscuro, new RegExp(`\\n\\s*${t}:`), `${t} no se redefine en oscuro: en oscuro queda un rectángulo pastel`);
  // La condición, en el primario; la etiqueta, con SU color como `ChipEtiqueta` (color+24, color+66).
  assert.match(fn, /n\.tipo === 'condicion'\) return \{ fondo: 'var\(--primary-bg\)', borde: 'var\(--primary-weak\)'/);
  assert.match(fn, /return \{ fondo: `\$\{n\.color\}24`, borde: `\$\{n\.color\}66`/);
  assert.match(fn, /\/\^#\[0-9a-f\]\{6\}\$\/i\.test\(n\.color\)/, 'un color que no es #rrggbb + «24» no pinta');
  assert.match(fn, /if \(n\.familia !== 'control'\) return null;/, 'el tinte se le aplicó a /mensajes');
});

test('⚠️ lo no publicado: se pregunta al cambiar de automatización, y cerrar la pestaña también avisa', () => {
  const perfil = sinComentarios(leer('../app/chatbot/SecuenciaPerfil.tsx'));
  // Lo que la persona cambió (NO `sinPublicar`: una secuencia de antes abre convertida sin que
  // nadie toque nada, y preguntar ahí afirmaría algo falso).
  assert.match(perfil, /const cambiosPropios = rolAdmin && JSON\.stringify\(pasos\) !== visto;/);
  assert.match(perfil, /useEffect\(\(\) => \{ avisarSinPublicar\.current\?\.\(cambiosPropios\); \}, \[cambiosPropios\]\);/);
  assert.match(perfil, /if \(!cambiosPropios\) return;\n\s+const alSalir = \(e: BeforeUnloadEvent\) => \{ e\.preventDefault\(\); e\.returnValue = ''; \};\n\s+window\.addEventListener\('beforeunload', alSalir\);/);
  // Publicar deja lo visto al día (si no, preguntaría después de publicar).
  const pub = perfil.slice(perfil.indexOf('const publicar = async () => {'), perfil.indexOf('const publicar = async () => {') + 4_000);
  assert.match(pub, /setPublicado\(JSON\.stringify\(pasos\)\);\n\s+setVisto\(JSON\.stringify\(pasos\)\);/);
  const tab = sinComentarios(leer('../app/chatbot/SimuladorWhatsApp.tsx'));
  assert.match(tab, /if \(sinPublicar\) \{ setPendiente\(\{ ir: id \}\); return; \}/, 'cambiar de automatización no pregunta');
  // Con el pedido de «Armar una» (que también pasa por esta puerta: tests/chatbot-crear-nueva.test.ts).
  assert.match(tab, /if \(sinPublicar\) \{ setPendiente\(\{ ir: 'nueva', pedido \}\); return; \}/, '«Nueva secuencia» no pregunta');
  assert.match(tab, /<Confirm\n\s+message="Tienes cambios sin publicar"\n\s+confirmLabel="Descartar cambios" cancelLabel="Seguir editando"/);
  assert.match(tab, /onSinPublicar=\{setSinPublicar\}/);
});

test('el lienzo de /chatbot: sin la tarjeta fantasma, la fila «Si responde» crea la tarjeta, el editor sigue a `muelles`', () => {
  const flujo = sinComentarios(leer('../app/chatbot/FlujoLienzo.tsx'));
  assert.doesNotMatch(flujo, /ID_NUEVA_RESPUESTA|function Fantasma/, 'volvió la tarjeta fantasma');
  assert.match(flujo, /if \(id === ID_ENTRADA && puerto === PUERTO_RESPUESTA\) \{\n\s+const r = onCrearRespuesta \? onCrearRespuesta\(\) : null;/);
  assert.match(flujo, /const formaPanel: 'apaisado' \| 'columna' = muelles\?\.editorForma === 'apaisado' \? 'apaisado' : 'columna';/);
  // Cuarta tanda, punto 1: el tamaño del panel sale del TIPO de la tarjeta abierta (`editorDeTarjeta`,
  // con test en tests/lienzo-muelles.test.ts), no del editor de WhatsApp para todas.
  assert.match(flujo, /const talla = editorDeTarjeta\(muelles, sel != null \? grafo\.nodos\.find\(\(n\) => n\.id === sel\)\?\.tipo : null\);/);
  assert.match(flujo, /panelForma=\{formaPanel\} panelAlto=\{talla\.alto\}/);
  // EditorDeNodo: una rama por clase, con los editores de la parte E ENCHUFADOS (integración):
  // el email es el tipo Gmail (su vista previa la fija tests/editor-email-gmail.test.ts) y la
  // etiqueta es la frase. Verificado volviendo a montar el editor de tres campos: 1 fallo.
  assert.match(flujo, /if \(etiquetaDeAccion\(paso\)\) return <EditorEtiquetaLienzo /);
  assert.match(flujo, /if \(paso\.canal === 'email'\) return <EditorEmail /);
  assert.match(flujo, /<EditorEmailGmail key=\{`email-\$\{id\}`\}/, 'el email no usa el editor tipo Gmail');
  assert.match(flujo, /<EditorEtiqueta key=\{`etq-\$\{p\.id\}`\}/, 'la etiqueta no usa la frase');
  // ⚠️ Tercera tanda (decisión 1): el WhatsApp va en UNA columna, siempre. Partido en dos (el chat a
  // un costado y el composer al otro) Martín lo leyó «bugeado». Y el panel mide lo que dice `muelles`.
  assert.doesNotMatch(flujo, /disposicion=/, 'volvió el WhatsApp partido en dos columnas');
  assert.match(flujo, /panelAncho=\{talla\.ancho\}/);
  assert.equal(PUERTO_RESPUESTA, 'resp');
});
