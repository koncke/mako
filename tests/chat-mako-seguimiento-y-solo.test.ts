// =============================================================================
// «Editar» de MaKo: el seguimiento lleva «No contestó», y «que sea sólo X» / «sacá Y» BORRA (23/10/2026, #289 del ws1)
// =============================================================================
// Martín, en #289 (modo Editar), por el Cerebro: pidió que la automatización sea «sólo de Apertura» y, al final, «un
// seguimiento si no responden», y que cuando alguien responda se corte y le avisen al grupo. MaKo agregó la espera de 2
// días y el mensaje SIN la condición «no respondió», y no sacó los mensajes de después. El arreglo:
//   · un seguimiento NUEVO (el pedido lo nombra) va detrás de «No contestó desde que entró» (`seguimientosConNoContesto`);
//   · un seguimiento que el modelo cuelga de «Si responde» va después del último mensaje (medido en seco con Haiku);
//   · los casos que el turno dejó vacíos se van (`sinCasosVaciados`): esas respuestas van por «Otra cosa»;
//   · el control de lo pedido también mira lo que había que SACAR (`sobrantesDelPedido`, `pideQueQuedeSolo`) y las piezas
//     pedidas (el seguimiento, el aviso cuando responde), y no pide volver a poner lo que pidió sacar.
// Medido en seco (Haiku, crédito del ws1, scratchpad medir-solo-apertura.mts, secuencia NEUTRA con la forma de #289): 8 de 8
// con el seguimiento detrás de «No contestó», el aviso debajo de «Si responde» y los mensajes de los casos fuera.
//
// PROBADO ROMPIÉNDOLO: ver el pie. Correr: node --import tsx --test tests/chat-mako-seguimiento-y-solo.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deIAEdicion, deIA, seguimientosConNoContesto, sinCasosVaciados, ultimoMensajeDelCamino, LISTA_BLANCA_IA, AVISO_SEGUIMIENTO,
  AVISO_CASOS_VACIOS, type CtxIA, type PasoIA,
} from '../lib/flujo-ia';
import {
  faltantesDelPedido, sobrantesDelPedido, pideQueQuedeSolo, REGLAS_EDITAR, NO_HECHO_SOLO_ESO,
} from '../lib/flujo-ia-intencion';
import { revisarEdicion } from '../lib/flujo-ia-revision-editar';
import { esperaAntesDe } from '../lib/flujo-conversacion';
import { raizRespuesta, nodoPorId, type PasoGrafo } from '../lib/flujo-grafo';
import { porId } from '../lib/api-mako/registro';

const acciones = LISTA_BLANCA_IA.map((id) => { const d = porId(id)!; return { id: d.id, titulo: d.titulo, parametros: d.parametros }; });
const ctxDe = (pedido: string): CtxIA => ({
  etiquetas: [], audios: [], archivos: [], acciones, links: {},
  productos: [{ funnelId: 44, productoId: null, nombre: 'Guía', esDefault: true, etapas: [{ value: 'st0', label: 'Prospección' }], etapasEntrega: [] }],
  disparadores: [{ value: 'venta:44:st0', label: 'Guía › Entra a «Prospección»' }], disparadorActual: 'venta:44:st0', pedido,
} as unknown as CtxIA);
const rnd = () => { let k = 0; return () => ((k++ * 0.137) % 1); };

/** La FORMA del borrador de #289 (apertura, «Si responde» con dos casos y sus mensajes, aviso en «Otra cosa»), textos neutros. */
const W = { canal: 'whatsapp', asunto: null, delay_horas: 0, template_wa: null };
const BASE = [
  { ...W, id: 'nzqh6wv', nodo: 'condicion', orden: 1, ramas: [{ id: 'n2er7x6', modo: 'todas', filas: [{ no: true, campo: 'ya_contactado' }], siguiente: 'npin7mc' }], si_no: null, cuerpo: '' },
  { ...W, id: 'npin7mc', orden: 2, cuerpo: 'Hola {{nombre}}, te escribo de Estudio Norte.', siguiente: 'ne2rblm' },
  { ...W, id: 'ne2rblm', orden: 3, cuerpo: '¿Te paso la guía para planear tu proyecto?', siguiente: null },
  { ...W, id: 'nhhcilm', nodo: 'respuesta', orden: 4, cuerpo: '', casos: [
    { id: 'nc1', titulo: 'Pregunta qué guía', cuando: 'Pregunta de qué se trata', siguiente: 'n1ugqas' },
    { id: 'nc2', titulo: 'No le interesa', cuando: 'Dice que no le interesa', siguiente: 'n2cjf2m' },
  ], si_no: 'nresp289' },
  { ...W, id: 'n1ugqas', orden: 5, cuerpo: 'Es la guía de Estudio Norte para ordenar tu proyecto en un mes', siguiente: 'notlxp0' },
  { ...W, id: 'notlxp0', orden: 6, cuerpo: 'Aquí la tienes: estudionorte.com/guia', siguiente: null },
  { ...W, id: 'n2cjf2m', orden: 7, cuerpo: 'Perfecto, gracias por tu tiempo. Si cambias de idea, aquí estoy', siguiente: null },
  { ...W, id: 'nresp289', orden: 8, cuerpo: '', siguiente: null, accion: { operacion: 'avisar_al_equipo', params: { leadId: 'evento', partes: [{ tipo: 'texto', cuerpo: '💬 {{nombre_completo}} respondió' }], mensaje: '💬 {{nombre_completo}} respondió' } } },
] as unknown as PasoGrafo[];
const PEDIDO = 'En realidad solo quiero que la automatización sea de "Apertura", y de última con un seguimiento si no responden con algo como "Hola querido {Nombre}, si no me confirmas no puedo reservarte la guía"... Y una vez que alguien responde en cualquier parte del flujo, se corta la automatización y le avisa a Ana por el grupo de WhatsApp de MaKo.';

/** La respuesta REAL de Haiku en la medición: el seguimiento colgado del «Si responde» por su «sig», con su espera. */
const HAIKU_SEGUIMIENTO_EN_SI_RESPONDE = {"cambiar":[{"id":"nzqh6wv","ramas":[{"id":"n2er7x6","si":[{"campo":"ya_contactado","no":true}],"sigue":"npin7mc"}],"si_no":null},{"id":"ne2rblm","sigue":"nhhcilm"},{"id":"nhhcilm","casos":[{"id":"nc1","titulo":"Pregunta qué guía","cuando":"Pregunta de qué se trata","sigue":"n1ugqas"},{"id":"nc2","titulo":"No le interesa","cuando":"Dice que no le interesa","sigue":"n2cjf2m"}],"otra_cosa":"nresp289"}],"quitar":["n1ugqas","notlxp0","n2cjf2m","nresp289"],"agregar":[{"despues_de":"nhhcilm","salida":"sig","tarjetas":[{"id":"t1","tipo":"esperar","dias":3,"sigue":"t2","contesto":false},{"id":"t2","tipo":"mensaje","canal":"whatsapp","texto":"Hola querido {{nombre}}, si no me confirmas no puedo reservarte la guía","sigue":"t3"},{"id":"t3","tipo":"accion","operacion":"avisar_al_equipo","datos":{"mensaje":"💬 {{nombre_completo}} respondió en apertura"},"sigue":null}]},{"despues_de":"nhhcilm","salida":"otra_cosa","tarjetas":[{"id":"t4","tipo":"accion","operacion":"avisar_al_equipo","datos":{"mensaje":"💬 {{nombre_completo}} respondió en apertura"},"sigue":null}]}]};

const sigDe = (pasos: readonly PasoGrafo[], id: string | null | undefined) => (id ? nodoPorId(pasos, id) : null);
const esNoContesto = (p: PasoGrafo | null) => !!p && p.nodo === 'condicion' && (p.ramas ?? []).length === 1 && p.ramas![0].filas.length === 1 && p.ramas![0].filas[0].campo === 'contesto' && p.ramas![0].filas[0].no === true && p.si_no == null;

test('la respuesta REAL de Haiku: el seguimiento colgado de «Si responde» va después del último mensaje, detrás de «No contestó»', () => {
  const r = deIAEdicion(HAIKU_SEGUIMIENTO_EN_SI_RESPONDE, BASE, ctxDe(PEDIDO), rnd());
  // ne2rblm (la última de la apertura) → espera de 3 días → «No contestó desde que entró» → el seguimiento.
  const espera = sigDe(r.pasos, sigDe(r.pasos, 'ne2rblm')?.siguiente);
  assert.equal(espera?.nodo, 'esperar', 'el seguimiento no quedó después del último mensaje');
  assert.equal((espera as { espera?: { minutos?: number } }).espera?.minutos, 3 * 1440);
  const cond = sigDe(r.pasos, espera?.siguiente);
  assert.ok(esNoContesto(cond), 'el seguimiento no va detrás de «No contestó desde que entró»');
  assert.match(String(sigDe(r.pasos, cond?.ramas?.[0]?.siguiente)?.cuerpo), /^Hola querido \{\{nombre\}\}, si no me confirmas/);
  assert.ok(r.avisos.includes('El seguimiento iba colgado de «Si responde»: lo puse después del último mensaje'));
  assert.ok(r.avisos.includes(AVISO_SEGUIMIENTO));
  // Los mensajes de los casos, fuera; los casos vacíos, también: toda respuesta va por «Otra cosa», que avisa.
  for (const id of ['n1ugqas', 'notlxp0', 'n2cjf2m']) assert.ok(r.quitadas.includes(id), `${id} sigue`);
  const resp = nodoPorId(r.pasos, raizRespuesta(r.pasos))!;
  assert.deepEqual(resp.casos, [], 'quedaron casos vacíos que se tragan la respuesta');
  assert.ok(r.avisos.includes(AVISO_CASOS_VACIOS));
  assert.equal((nodoPorId(r.pasos, resp.si_no) as { accion?: { operacion?: string } } | null)?.accion?.operacion, 'avisar_al_equipo');
  // Y el control de lo pedido no tiene nada que decir.
  const rev = revisarEdicion({ obj: HAIKU_SEGUIMIENTO_EN_SI_RESPONDE, base: BASE, ctx: ctxDe(PEDIDO), pedido: PEDIDO, historial: [], intencion: 'editar' });
  assert.deepEqual(rev.errores, []);
  assert.equal(rev.r.noHecho, undefined);
});

test('«No contestó» sólo con un seguimiento NUEVO y pedido: no a un recordatorio, ni a lo que ya estaba, ni dos veces', () => {
  const agregar = (pedido: string, extra: Record<string, unknown> = {}) => deIAEdicion({ agregar: [{ despues_de: 'ne2rblm', salida: 'sig', tarjetas: [{ id: 't1', tipo: 'esperar', dias: 2, sigue: 't2', ...extra }, { id: 't2', tipo: 'mensaje', texto: '¿Pudiste verla, {{nombre}}?' }] }] }, BASE, ctxDe(pedido), rnd());
  const conSeg = agregar('Agrega un seguimiento a los 2 días');
  assert.ok(esNoContesto(sigDe(conSeg.pasos, sigDe(conSeg.pasos, sigDe(conSeg.pasos, 'ne2rblm')?.siguiente)?.siguiente)));
  assert.equal(conSeg.agregadas.length, 3);
  // «Agrega un recordatorio» le llega aunque haya contestado: sin condición.
  const rec = agregar('Agrega un recordatorio a los 2 días');
  assert.equal(sigDe(rec.pasos, sigDe(rec.pasos, sigDe(rec.pasos, 'ne2rblm')?.siguiente)?.siguiente)?.canal, 'whatsapp');
  assert.equal(rec.agregadas.length, 2);
  // La espera «antes de la reunión» prepara una reunión: sin condición.
  const reunion = agregar('si no responde, que le llegue antes de la reunión', { antes_de_reunion: true });
  assert.ok(!reunion.pasos.some((p) => esNoContesto(p as PasoGrafo)));
  // Ya con la condición puesta por el modelo: no se duplica.
  const yaPuesta = deIAEdicion({ agregar: [{ despues_de: 'ne2rblm', salida: 'sig', tarjetas: [{ id: 't1', tipo: 'esperar', dias: 2, sigue: 't2' }, { id: 't2', tipo: 'condicion', ramas: [{ si: [{ campo: 'contesto', no: true }], sigue: 't3' }] }, { id: 't3', tipo: 'mensaje', texto: '¿Pudiste verla?' }] }] }, BASE, ctxDe('un seguimiento si no responde'), rnd());
  assert.equal(yaPuesta.pasos.filter((p) => esNoContesto(p as PasoGrafo)).length, 1);
  // Una espera+mensaje que YA estaba (no es de este turno) no se toca.
  const base2 = [...BASE.slice(0, 2), { ...BASE[2], siguiente: 'e1' }, { id: 'e1', nodo: 'esperar', espera: { modo: 'tiempo', minutos: 1440 }, siguiente: 'm9' }, { id: 'm9', canal: 'whatsapp', cuerpo: 'Otro', siguiente: null }, ...BASE.slice(3)] as unknown as PasoIA[];
  assert.deepEqual(seguimientosConNoContesto(base2, new Set(), 'un seguimiento si no responde').puestas, []);
  // Una espera justo después del CRON (sin mensaje antes) no es un seguimiento.
  const crear = deIA({ disparador: 'd1', inicio: 't1', tarjetas: [{ id: 't1', tipo: 'esperar', horas: 24, sigue: 't2' }, { id: 't2', tipo: 'mensaje', canal: 'whatsapp', texto: 'Hola {{nombre}}' }] }, ctxDe('un mensaje al día siguiente, y seguimiento si no responde'), rnd());
  assert.ok(!crear.pasos.some((p) => esNoContesto(p as PasoGrafo)));
  // Al crear, un seguimiento pedido también la lleva.
  const crear2 = deIA({ disparador: 'd1', inicio: 't1', tarjetas: [{ id: 't1', tipo: 'mensaje', canal: 'whatsapp', texto: 'Hola {{nombre}}', sigue: 't2' }, { id: 't2', tipo: 'esperar', horas: 24, sigue: 't3' }, { id: 't3', tipo: 'mensaje', canal: 'whatsapp', texto: '¿Lo viste, {{nombre}}?' }] }, ctxDe('un saludo y un seguimiento si no responde'), rnd());
  assert.equal(crear2.pasos.filter((p) => esNoContesto(p as PasoGrafo)).length, 1);
  assert.ok(crear2.avisos.includes(AVISO_SEGUIMIENTO));
});

test('los casos que el turno dejó vacíos se van; uno que ya estaba vacío, no', () => {
  const pasos = BASE.map((p) => (p.id === 'nhhcilm' ? { ...p, casos: p.casos!.map((c) => ({ ...c, siguiente: null })) } : p)) as unknown as PasoIA[];
  assert.equal(sinCasosVaciados(pasos, BASE).sacados, 2);
  const yaVacio = BASE.map((p) => (p.id === 'nhhcilm' ? { ...p, casos: [{ id: 'nc9', titulo: 'x', cuando: 'y', siguiente: null }] } : p)) as unknown as PasoGrafo[];
  assert.equal(sinCasosVaciados(yaVacio as unknown as PasoIA[], yaVacio).sacados, 0);
  assert.equal(ultimoMensajeDelCamino(BASE), 'ne2rblm');
});

test('lo que pidió SACAR no es «lo que falta», y si sigue, sobra; «que sea sólo X» sólo cuando restringe el flujo', () => {
  const sacar = 'Sacá el mensaje «Perfecto, gracias por tu tiempo. Si cambias de idea, aquí estoy» y agregá «Hola {Nombre}, te escribo otra vez de Estudio Norte»';
  assert.deepEqual(faltantesDelPedido(sacar, ['Hola {{nombre}}, te escribo otra vez de Estudio Norte']), [], 'pedía volver a poner lo que había que sacar');
  assert.deepEqual(sobrantesDelPedido(sacar, ['Perfecto, gracias por tu tiempo. Si cambias de idea, aquí estoy']), ['Perfecto, gracias por tu tiempo. Si cambias de idea, aquí estoy']);
  assert.deepEqual(sobrantesDelPedido(sacar, ['otra cosa']), []);
  // «borrador» no es «borrar».
  assert.deepEqual(faltantesDelPedido('Que quede en el borrador «Hola {Nombre}, te escribo otra vez de Estudio Norte»', []), ['Hola {Nombre}, te escribo otra vez de Estudio Norte']);
  for (const si of [PEDIDO, 'que sea solo de apertura', 'dejá sólo el primer mensaje', 'Sólo quiero que el flujo tenga el saludo']) assert.equal(pideQueQuedeSolo(si), true, si);
  for (const no of ['sólo cambia el segundo mensaje', 'No cambies nada, sólo explícamelo', 'agrega solo un mensaje más']) assert.equal(pideQueQuedeSolo(no), false, no);
  assert.match(REGLAS_EDITAR, /«Que sea sólo X», «sólo quiero X» o «saca Y» es QUITAR lo que sobra: .*X se queda/);
});

test('el control: la primera vez vuelve al modelo con todo lo que falta o sobra; después, en ROJO', () => {
  const rev = (pedido: string, obj: unknown, control = { yaPidioLoQueFalta: false }) => revisarEdicion({ obj, base: BASE, ctx: ctxDe(pedido), pedido, historial: [], intencion: 'editar', control });
  const SEG = { agregar: [{ despues_de: 'ne2rblm', salida: 'sig', tarjetas: [{ id: 't1', tipo: 'esperar', dias: 2, sigue: 't2' }, { id: 't2', tipo: 'mensaje', texto: 'Hola querido {{nombre}}, si no me confirmas no puedo reservarte la guía' }] }] };
  // «Sólo apertura» sin sacar nada: error la primera vez; en rojo la segunda.
  const c1 = { yaPidioLoQueFalta: false };
  assert.match(rev(PEDIDO, SEG, c1).errores.join(' '), /quede SÓLO con lo que dice y no quitaste nada/);
  assert.ok(rev(PEDIDO, SEG, c1).r.noHecho?.includes(NO_HECHO_SOLO_ESO));
  // Lo que pidió sacar y sigue.
  const sacar = 'Sacá el mensaje «Perfecto, gracias por tu tiempo. Si cambias de idea, aquí estoy»';
  const c2 = { yaPidioLoQueFalta: false };
  const cambiaOtra = { cambiar: [{ id: 'npin7mc', texto: 'Hola {{nombre}}, soy Ana de Estudio Norte.' }] };
  assert.match(rev(sacar, cambiaOtra, c2).errores.join(' '), /pidió SACAR «Perfecto, gracias/);
  assert.ok(rev(sacar, cambiaOtra, c2).r.noHecho?.some((t) => /Pediste sacarlo y sigue en el lienzo/.test(t)));
  // Un seguimiento pedido que no quedó (un mensaje sin espera).
  const sinEspera = { agregar: [{ despues_de: 'ne2rblm', salida: 'sig', tarjetas: [{ id: 't1', tipo: 'mensaje', texto: '¿Seguimos?' }] }] };
  assert.match(rev('agrega un seguimiento si no responde', sinEspera).errores.join(' '), /pidió un SEGUIMIENTO/);
  // «Cuando responde, avisale al grupo» sin aviso debajo de «Si responde».
  assert.match(rev('cuando responde le avisas al grupo y agrega un saludo más', { quitar: ['nresp289'], agregar: sinEspera.agregar }).errores.join(' '), /cuando el lead responda le avisen al grupo/);
  // «Sólo X» que se llevó X: el camino del lead sin mensajes.
  assert.match(rev(PEDIDO, { quitar: ['npin7mc', 'ne2rblm', 'n1ugqas', 'notlxp0', 'n2cjf2m'] }).errores.join(' '), /Con «sólo X» se queda X/);
});

test('la ventana de 24 h de Meta ve la espera a través de la condición', () => {
  const pasos = [
    { id: 'm1', canal: 'instagram', cuerpo: 'Hola', siguiente: 'e1' },
    { id: 'e1', nodo: 'esperar', espera: { modo: 'tiempo', minutos: 48 * 60 }, siguiente: 'c1' },
    { id: 'c1', nodo: 'condicion', ramas: [{ id: 'r1', modo: 'todas', filas: [{ no: true, campo: 'contesto' }], siguiente: 'm2' }], si_no: null },
    { id: 'm2', canal: 'instagram', cuerpo: '¿Lo viste?', siguiente: null },
  ] as unknown as PasoGrafo[];
  assert.equal(esperaAntesDe(pasos, 'm2'), 48 * 60);
});

// ── ROTURAS (23/10/2026) ───────────────────────────────────────────────────────────────────────────
// Una por vez, con romper.mjs del scratchpad (reemplaza un texto, corre este archivo, lo devuelve). Base 6 / 0:
//   S1. `seguimientosConNoContesto` no pone nada                                              → rojo
//   S2. el seguimiento colgado de «Si responde» no se mueve                                   → rojo
//   S3. los casos vaciados quedan                                                             → rojo
//   S4. `faltantesDelPedido` vuelve a contar lo que pidió sacar                               → rojo
//   S5. el control no mira «sólo X»                                                           → rojo
//   S6. la ventana de Meta no atraviesa la condición                                          → rojo
//   S7. un recordatorio también lleva «No contestó» (sin mirar el pedido)                     → rojo
