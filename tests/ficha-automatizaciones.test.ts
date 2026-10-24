// =============================================================================
// El bloque «Automatizaciones» de la ficha del lead, y el título de cualquier bloque (23/10/2026)
// =============================================================================
// Martín, 23/10/2026 ~20:40 UTC: «Tal vez sería bueno crear un bloque dentro del detail de cada lead que esté relacionado
// a las automatizaciones, no? Para tener más claridad de lo que pasa... Y que claro, sea editable como el resto de
// bloques». Lo motivó el lead 3099: lo sacó de «Prospección activa» y lo volvió a meter para que «Sprint · apertura» le
// volviera a escribir, y no pasó nada (entra una sola vez y seguía adentro), sin que nada lo dijera.
// Se prueba EJECUTANDO lo que el bloque dice (app/crm/automatizacion-lead.ts), el título de los bloques (lib/ficha/config.ts
// y lib/ficha/api.ts) y, leyendo el fuente, que el bloque está enchufado donde corresponde.
//
// Correr: node --import tsx --test tests/ficha-automatizaciones.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (23/10/2026, base 11/0), de a una rotura y restaurada: ver el final del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  chipDeInscripcion, lineaDelBloque, noEntroDelMovimiento, preguntaDeEmpezarDeNuevo,
  textoDeNoEntro, vistaDeDetalle, vistaDeEnAutomatizacion, vistaVacia, type InscripcionVista,
} from '../app/crm/automatizacion-lead';
import { bloqueDef } from '../lib/ficha/catalogo';
import { aplicarCambio, describirCambio, fichaEfectiva, sanearCambio, sanearFicha, type ResultadoCambio } from '../lib/ficha/config';
import { cambioDeInputApi } from '../lib/ficha/api';
import { plantillaTabDeEntrada } from '../lib/ficha/plantillas-tab';
import { IDS_PLANTILLA } from '../lib/ficha/plantillas';
import { REGLAS_RESUMEN } from '../app/crm/lead-view/ficha/reglas-resumen';
import { filaDeAutomatizaciones, PIEZA_DE_BLOQUE } from '../app/m/crm/ficha-bloques';

const sinComentarios = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');
const fecha = (iso: string) => `F(${iso.slice(11, 16)})`;
const R = { resumen: {}, apagados: [] };
const ok = (r: ResultadoCambio) => { assert.ok(r.ok, r.ok ? '' : r.error); return r as Extract<ResultadoCambio, { ok: true }>; };

const base: InscripcionVista = {
  secuenciaId: 289, nombre: 'Sprint · apertura', link: '/automations?sec=289', estado: 'activa', automatizacionActiva: true,
  paso: { numero: 2, titulo: 'WHATSAPP: Si no me das tu email…', total: 5 }, proximo: { at: '2026-10-24T16:12:00Z', titulo: 'WHATSAPP: Si no me das tu email…' },
  frenado: null, termino: null, enviados: [], puede: { frenar: true, empezarDeNuevo: true }, reentrada: 'una_vez',
};

test('el estado de cada inscripción, en un chip corto (el «Active / Paused / Finished» de HubSpot)', () => {
  assert.deepEqual(chipDeInscripcion(base), { texto: 'Activa', tono: 'mako' });
  assert.equal(chipDeInscripcion({ ...base, estado: 'respondio' }).texto, 'Respondió');
  assert.equal(chipDeInscripcion({ ...base, estado: 'completada' }).texto, 'Terminó');
  assert.equal(chipDeInscripcion({ ...base, estado: 'no_responde' }).texto, 'Terminó sin respuesta');
  assert.equal(chipDeInscripcion({ ...base, estado: 'cancelada' }).texto, 'La frenaron');
  assert.equal(chipDeInscripcion({ ...base, automatizacionActiva: false }).texto, 'Automatización en pausa');
  assert.deepEqual(chipDeInscripcion({ ...base, frenado: { texto: 'No salió: fuera del horario.', corto: 'Sale mañana 9:00' } }), { texto: 'Sale mañana 9:00', tono: 'gris' });
});

// (24/10/2026) «En qué paso va / qué sale después» y «lo que ya le salió» pasaron al riel de la tarjeta:
// tests/ficha-automatizaciones-tarjeta.test.ts.

test('el detalle de Automations en la vista: vivas y terminadas, lo enviado con su paso, y lo que no entró con el paso en que está', () => {
  const v = vistaDeDetalle({
    zona: 'America/Tijuana',
    inscripciones: [
      { secuenciaId: 289, nombre: 'Sprint · apertura', link: '/automations?sec=289', automatizacionActiva: true, estado: 'activa', desde: '2026-10-23T04:47:00Z', termino: null,
        reentrada: 'una_vez', reentradaTexto: 'Una sola vez', paso: { numero: 2, titulo: 'W', total: 5 }, proximo: { at: '2026-10-24T16:12:00Z', titulo: 'W2', canal: 'whatsapp' },
        frenado: null, enviados: [{ at: '2026-10-23T16:00:00Z', paso: { numero: 1, titulo: 'Hola' }, canal: 'whatsapp', estado: 'enviado', error: null }], puede: { frenar: true, empezarDeNuevo: true } },
      { secuenciaId: 300, nombre: 'Vieja', link: '/automations?sec=300', automatizacionActiva: true, estado: 'completada', desde: null, termino: { at: '2026-10-20T10:00:00Z', texto: 'Terminó el recorrido.' },
        reentrada: 'siempre', reentradaTexto: 'Cada vez', paso: null, proximo: null, frenado: null, enviados: [], puede: { frenar: false, empezarDeNuevo: false, porQueNo: 'Terminó.' } },
      { secuenciaId: 301, nombre: 'Con persona', link: '/automations?sec=301', automatizacionActiva: true, estado: 'handoff', desde: null, termino: null,
        reentrada: 'una_vez', reentradaTexto: 'Una sola vez', paso: null, proximo: null, frenado: null, enviados: [], puede: { frenar: true, empezarDeNuevo: false, porQueNo: 'Está con una persona.' } },
    ],
    noEntro: [
      { secuenciaId: 289, nombre: 'Sprint · apertura', at: '2026-10-23T20:04:00Z', porque: 'una_sola_vez', texto: 'ya entró una vez y su reentrada es «Una sola vez»', quien: 'martin' },
      { secuenciaId: 289, nombre: 'Sprint · apertura', at: '2026-10-23T19:00:00Z', porque: 'una_sola_vez', texto: 'otra vez', quien: 'martin' },
    ],
  });
  assert.deepEqual(v.vivas.map((i) => i.secuenciaId), [289, 301], 'con una persona sigue viva');
  assert.deepEqual(v.terminadas.map((i) => i.secuenciaId), [300]);
  assert.equal(v.vivas[0].enviados[0].paso, 'Paso 1: Hola');
  assert.deepEqual(v.vivas[0].proximo, { at: '2026-10-24T16:12:00Z', titulo: 'W2', clase: null });
  assert.equal(chipDeInscripcion(v.vivas[1]).texto, 'Con una persona');
  assert.equal(v.vivas[1].puede.porQueNo, 'Está con una persona.');
  assert.deepEqual(v.noEntro.map((n) => n.texto), ['No volvió a entrar a «Sprint · apertura»: ya entró una vez y su reentrada es «Una sola vez».'], 'la última por automatización');
  const comp = sinComentarios('app/crm/lead-view/ficha/resumen/automatizaciones-datos.ts');
  assert.match(comp, /const r = await automatizacionesDelLeadDetalleAction\(leadId\);\s*return r \? vistaDeDetalle\(r\) : null;/);
  assert.match(comp, /return empezarDeNuevoEnAutomatizacionAction\(leadId, secuenciaId\);/);
});

test('por qué no entró al moverlo, y la pregunta antes de «Empezar de nuevo»', () => {
  assert.equal(textoDeNoEntro({ nombre: 'Sprint · apertura', porque: 'en_curso', paso: { numero: 2 } }), 'No volvió a empezar «Sprint · apertura»: ya está adentro.');
  assert.equal(textoDeNoEntro({ nombre: 'Sprint · apertura', porque: 'una_sola_vez' }), 'No volvió a entrar a «Sprint · apertura»: entra una sola vez.');
  assert.match(textoDeNoEntro({ nombre: 'X', porque: 'cancelada' }), /la frenaron/);
  assert.equal(textoDeNoEntro({ nombre: 'X', porque: 'otro' }), 'No entró a «X».');
  // 24/10/2026, el rediseño: corta, y con lo que pasa de verdad.
  const q = preguntaDeEmpezarDeNuevo({ nombre: 'Martin Koncke', aut: base });
  assert.deepEqual(q, { titulo: 'Empezar de nuevo «Sprint · apertura»', mensaje: 'A Martin le vuelve a salir todo desde el principio.' });
  assert.equal(preguntaDeEmpezarDeNuevo({ aut: { ...base, estado: 'completada' } }).mensaje, 'Le vuelve a salir todo desde el principio.');
});

test('la lista de siempre (`EnAutomatizacion[]`) se ve en el bloque; «Empezar de nuevo» no se ofrece hasta que exista', () => {
  const v = vistaDeEnAutomatizacion([{ secuenciaId: 289, nombre: 'Sprint · apertura', automatizacionActiva: true, estado: 'activa', paso: { numero: 2, titulo: 'W' }, proximoEnvioAt: '2026-10-24T16:12:00Z', link: '/automations?sec=289', frenado: null }]);
  assert.equal(v.vivas.length, 1);
  assert.deepEqual(v.vivas[0].puede, { frenar: true, empezarDeNuevo: false });
  assert.deepEqual(v.vivas[0].proximo, { at: '2026-10-24T16:12:00Z', titulo: null });
  // Sin «paso N» desde el 24/10/2026: es el número de la tarjeta en el lienzo, no lo que le pasó al lead.
  assert.equal(lineaDelBloque(v), 'Sprint · apertura (Activa)');
  assert.ok(vistaVacia(vistaDeEnAutomatizacion([])), 'sin ninguna, se calla');
  assert.ok(!vistaVacia({ vivas: [], terminadas: [], noEntro: [{ secuenciaId: 289, nombre: 'S', at: null, texto: 't' }] }), 'lo que no entró se dice aunque no esté adentro');
});

test('el bloque se mudó de la charla y está enchufado: sus tres diseños, arriba en el Resumen de entrada', () => {
  const reg = sinComentarios('app/crm/lead-view/ficha/registro-resumen.tsx');
  assert.match(reg, /'automatizaciones-en-curso': \{ Componente: AutomatizacionesDelLead, /);
  assert.doesNotMatch(sinComentarios('app/crm/lead-view/ficha/resumen/charla.tsx'), /export function AutomatizacionesEnCurso/, 'duplicado: el de la charla sigue');
  const comp = sinComentarios('app/crm/lead-view/ficha/resumen/automatizaciones.tsx');
  assert.doesNotMatch(comp, /from '@\/app\/automations\//, 'el bloque lee y actúa por ./automatizaciones-datos.ts, la única puerta');
  assert.match(comp, /const tz = useTzWorkspace\(\);/, 'las horas en la zona del negocio');
  assert.deepEqual([...REGLAS_RESUMEN['automatizaciones-en-curso'].disenos], bloqueDef('automatizaciones-en-curso')!.disenos.map((d) => d.id));
  for (const tipo of IDS_PLANTILLA) assert.ok(plantillaTabDeEntrada('resumen', tipo).bloques.some((b) => b.id === 'automatizaciones-en-curso'), tipo);
});

test('el título de CUALQUIER bloque: se cambia, vuelve al de siempre y no se guarda si es igual', () => {
  const c = sanearCambio({ op: 'opciones', tab: 'resumen', bloque: 'automatizaciones-en-curso', opciones: { titulo: '  Lo que pasa  ' } });
  assert.ok(!('error' in c));
  const g = ok(aplicarCambio({}, c as never, 'una-llamada', R)).ficha;
  const puesto = fichaEfectiva('una-llamada', g, R).tabs.resumen.find((b) => b.id === 'automatizaciones-en-curso')!;
  assert.equal(puesto.opciones?.titulo, 'Lo que pasa');
  // Vacío = el de siempre: la tab vuelve a seguir a su plantilla.
  const vuelve = ok(aplicarCambio(g, { op: 'opciones', tab: 'resumen', bloque: 'automatizaciones-en-curso', opciones: { titulo: '' } }, 'una-llamada', R));
  assert.deepEqual(vuelve.ficha, {});
  assert.equal(sanearFicha({ tabs: { resumen: [{ id: 'notas', opciones: { titulo: 'Notas' } }] } }).tabs!.resumen![0].opciones, undefined, 'igual al del catálogo: no se guarda');
  assert.equal(sanearFicha({ tabs: { resumen: [{ id: 'notas', opciones: { titulo: 'x'.repeat(90) } }] } }).tabs!.resumen![0].opciones!.titulo!.length, 40);
  assert.match(describirCambio({ op: 'opciones', tab: 'resumen', bloque: 'notas', opciones: { titulo: 'Lo hablado' } }), /se llama «Lo hablado»/);
  // La API de MaKo: «titulo=…» en cualquier bloque, también uno sin opciones.
  assert.deepEqual(cambioDeInputApi({ cambio: 'opciones', tab: 'resumen', bloque: 'notas', opcion: 'titulo=Lo hablado' }), { op: 'opciones', tab: 'resumen', bloque: 'notas', opciones: { titulo: 'Lo hablado' } });
});

test('la barra del bloque ofrece el título, y la grilla dibuja el que le pusieron', () => {
  const armador = sinComentarios('app/crm/lead-view/ficha/Armador.tsx');
  assert.match(armador, /const titulo = b\.puesto\.opciones\?\.titulo \|\| tituloDeBloque\(b\.def, ctx\.stages\);/);
  assert.match(armador, /onGuardar=\{\(t\) => \{ setMenu\(null\); if \(t !== \(b\.puesto\.opciones\?\.titulo \?\? ''\)\) opciones\(\{ titulo: t \}\); \}\}/);
});

test('el toast del movimiento dice POR QUÉ no entró (y no inventa nada si la respuesta no lo trae)', () => {
  assert.deepEqual(noEntroDelMovimiento({ ok: true }), []);
  assert.deepEqual(noEntroDelMovimiento(undefined), []);
  assert.deepEqual(noEntroDelMovimiento({ ok: true, automatizaciones: { entro: [], noEntro: [{ secuenciaId: 289, nombre: 'Sprint · apertura', porque: 'en_curso', paso: { numero: 2 } }] } }),
    ['No volvió a empezar «Sprint · apertura»: ya está adentro.']);
  assert.deepEqual(noEntroDelMovimiento({ automatizaciones: { noEntro: [{ texto: 'Ya estaba en «X»: no vuelve a empezar.' }, null, 3] } }), ['Ya estaba en «X»: no vuelve a empezar.']);
  // La forma de Automations: el motivo SIN el nombre, y el nombre aparte.
  assert.deepEqual(noEntroDelMovimiento({ ok: true, automatizaciones: { entro: [], noEntro: [{ secuenciaId: 289, nombre: 'Sprint · apertura', at: 'x', porque: 'una_sola_vez', texto: 'ya entró una vez y su reentrada es «Una sola vez»', quien: null }] } }),
    ['No volvió a entrar a «Sprint · apertura»: ya entró una vez y su reentrada es «Una sola vez».']);
  const board = sinComentarios('app/crm/CrmBoard.tsx');
  assert.equal((board.match(/const noEntro = noEntroDelMovimiento\(r\);/g) ?? []).length, 4, 'el arrastre, «¿Qué hacer ahora?», el asistente y el agregado');
  assert.match(board, /\{!!undoInfo\.noEntro\?\.length && \(/);
  assert.match(board, /if \(l\) openDetail\(l\);/, '«Ver» abre la ficha, donde está el bloque');
});

test('el teléfono destila el bloque en una fila: en cuál está, su estado y lo próximo; sin ninguna, no hay fila', () => {
  assert.equal(PIEZA_DE_BLOQUE['automatizaciones-en-curso'], 'automatizaciones');
  const v = { vivas: [base, { ...base, secuenciaId: 300, nombre: 'Otra' }], terminadas: [], noEntro: [] };
  // 24/10/2026, el rediseño: la que hay que mirar primero, y cuándo le sale lo próximo (o su estado en dos palabras).
  assert.equal(filaDeAutomatizaciones(v, fecha), 'Sprint · apertura · F(16:12) · +1');
  assert.equal(filaDeAutomatizaciones({ vivas: [], terminadas: [], noEntro: [] }, fecha), null);
  const datos = sinComentarios('app/m/crm/datos.ts');
  assert.match(datos, /const auts = delFunnel\.piezas\.some\(\(x\) => x\.pieza === 'automatizaciones'\)/, 'no se paga la lectura si la ficha no lo pone');
  assert.match(datos, /const vistaAuts = auts \? vistaDeEnAutomatizacion\(auts\) : null;/);
  assert.match(datos, /automatizaciones: vistaAuts \? filaDeAutomatizaciones\(vistaAuts, \(iso\) => fechaCorta\(iso, f\.tz, ahora\)\) : null,/);
});

// Roturas (23/10/2026, base 8/0): `chipDeInscripcion` sin el freno → 7 / 1; `lineaDelProximo` sin el freno → 7 / 1;
// el registro con el componente de la charla → 7 / 1; el bloque fuera de «Antes de la llamada» → 6 / 2; el título sin
// limpiar el vacío → 7 / 1; la API sin «titulo=» → 7 / 1; la grilla sin el título puesto → 7 / 1. Con el toast (base
// 9/0): el arrastre sin `noEntroDelMovimiento` → 8 / 1; el lector sin el texto que trae la respuesta → 8 / 1. Con el
// teléfono (base 10/0): el bloque sin pieza de teléfono → 9 / 1; el server sin armar la fila → 9 / 1.
// Con el detalle de Automations (base 11/0): lo que no entró sin la última por automatización → 10 / 1; «con una
// persona» contada como terminada → 10 / 1; «Empezar de nuevo» sin su acción → 10 / 1; el toast con el motivo sin el
// nombre → 10 / 1; un estado de envío desconocido pintado como enviado → 10 / 1.
