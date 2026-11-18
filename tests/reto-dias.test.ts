// El reto de 7 días (lib/reto/dias.ts), 18/11/2026: qué día está abierto, cómo está cada uno, qué falta, y las reglas de Martín
// (sin botones de atajo, WhatsApp escribiendo ELLOS, nada invasivo el día 3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DIAS_RETO, RETO_SUB, diaAbierto, estadoDeLosDias, leerEstado, mensajeEscrito, proximaTarea, type EstadoReto } from '../lib/reto/dias';

const h = (iso: string) => Date.parse(iso);
const base: EstadoReto = { v: 1, inicio: '2026-11-18T15:00:00Z', adelantado: 1, hechas: {} }; // 12:00 en Argentina

test('el día 1 se abre al empezar; los que siguen, al otro día a la hora del aviso (o antes si lo adelanta)', () => {
  assert.equal(diaAbierto(base, h('2026-11-18T23:00:00Z')), 1, 'el mismo día, el 1');
  assert.equal(diaAbierto(base, h('2026-11-19T11:30:00Z')), 1, 'al otro día a las 8:30 de Argentina, todavía el 1');
  assert.equal(diaAbierto(base, h('2026-11-19T12:00:00Z')), 2, 'a las 9:00 de Argentina, el 2');
  assert.equal(diaAbierto({ ...base, horaWa: '18:00' }, h('2026-11-19T12:00:00Z')), 1, 'con el aviso a las 18:00, todavía el 1');
  assert.equal(diaAbierto({ ...base, adelantado: 3 }, h('2026-11-18T23:00:00Z')), 3, 'adelantado');
  assert.equal(diaAbierto(base, h('2026-12-30T12:00:00Z')), 7, 'nunca más de 7');
});

test('cada día: hecho, a medias, hoy o luego; y lo pendiente va primero', () => {
  const e: EstadoReto = { ...base, adelantado: 2, hechas: { '1:offer': 'x', '1:funnel': 'x' } };
  const ahora = h('2026-11-18T23:00:00Z');
  const r = estadoDeLosDias(e, ahora);
  assert.equal(r.abierto, 2);
  assert.deepEqual(r.dias.slice(0, 3), ['hecho', 'hoy', 'luego']);
  assert.equal(r.hechos, 1);
  assert.equal(proximaTarea(e, ahora)?.tarea.id, 'app', 'el día 2 empieza por la app');
  const sinFunnel: EstadoReto = { ...base, adelantado: 2, hechas: { '1:offer': 'x' } };
  assert.deepEqual(estadoDeLosDias(sinFunnel, ahora).dias.slice(0, 2), ['medias', 'hoy']);
  assert.equal(proximaTarea(sinFunnel, ahora)?.tarea.id, 'funnel', 'lo del día anterior, primero');
  // Lo guardado antes de las dos tareas (sólo `1:funnel`): el día 1 queda a medias, con la oferta como lo que falta.
  const deAntes: EstadoReto = { ...base, adelantado: 2, hechas: { '1:funnel': 'x' } };
  assert.equal(estadoDeLosDias(deAntes, ahora).dias[0], 'medias');
  assert.equal(proximaTarea(deAntes, ahora)?.tarea.id, 'offer');
  assert.equal(estadoDeLosDias(null, ahora).abierto, 0);
});

test('lo guardado se valida: algo raro es «sin reto»', () => {
  assert.equal(leerEstado('no es json'), null);
  assert.equal(leerEstado({ inicio: 'ayer' }), null);
  const e = leerEstado(JSON.stringify({ inicio: '2026-11-18T15:00:00Z', adelantado: 99, hechas: { '1:funnel': 'x', raro: 'y' }, horaWa: '3:00' }));
  assert.ok(e);
  assert.equal(e.adelantado, 7);
  assert.deepEqual(e.hechas, { '1:funnel': 'x' });
  assert.equal(e.horaWa, undefined, 'una hora fuera de las del reto no se guarda');
});

test('las reglas de Martín (18/11): sin atajos, WhatsApp escribiendo ELLOS, nada invasivo', () => {
  assert.equal(RETO_SUB, 'Cada día un video para que avances con tu negocio. Puedes adelantar días cuando quieras.');
  assert.equal(DIAS_RETO.length, 7);
  for (const d of DIAS_RETO) {
    assert.ok(d.tareas.length > 0, `el día ${d.n} tiene tareas`);
    for (const t of d.tareas) assert.ok(t.marcas.length > 0 && t.marcas.every((m) => m.sel && m.haz), `${d.n}:${t.id} se marca (sin botón de atajo)`);
    assert.equal(d.video, `reto-dia-${d.n}`, 'su video es el SUYO (nunca el de la landing)');
  }
  // EL DÍA 1, EN DOS CHATS (Martín, 15/11: «Oferta y Funnel Coach en DOS chats separados»): primero la oferta con el Offer Coach y
  // después el sistema para conseguir clientes con el Funnel Coach, y la marca lleva de la fila de uno a la del otro.
  const d1 = DIAS_RETO[0];
  assert.equal(d1.mensaje, 'Hoy es tu día 1. Tu onboarding ya está; ahora tu oferta, con Offer Coach, y después tu sistema para conseguir clientes, con Funnel Coach.');
  assert.deepEqual(d1.tareas.map((t) => [t.id, t.titulo]), [
    ['offer', 'Tu oferta, con Offer Coach'],
    ['funnel', 'Tu sistema para conseguir clientes, con Funnel Coach'],
  ]);
  assert.deepEqual(d1.tareas.map((t) => t.marcas.map((m) => m.sel)), [['[data-recorrido="sb-offer"]'], ['[data-recorrido="sb-funnel"]']]);
  // Las dos marcas existen en la barra (las filas de los coaches, con la prop `marca` de FilaDeChat), sólo con los dos coaches.
  const barra = readFileSync(new URL('../app/second-brain/ChatSecondBrain.tsx', import.meta.url), 'utf8');
  assert.match(barra, /<FilaDeChat titulo=\{ORIGEN_OFFER_COACH\} marca="sb-offer"/);
  assert.match(barra, /<FilaDeChat titulo=\{ORIGEN_FUNNEL_COACH\} marca="sb-funnel"/);
  const d3 = DIAS_RETO[2];
  assert.doesNotMatch(JSON.stringify(d3), /planilla|mándame/i, 'el día 3 no pide la lista de clientes');
  assert.ok(d3.whatsapp?.audio, 'el día 3 prueba un audio a MaKo');
  assert.equal(DIAS_RETO[5].whatsapp, undefined, 'el día 6 no tiene WhatsApp');
  assert.equal(mensajeEscrito(DIAS_RETO[1].whatsapp!, '18:00'), 'Hola MaKo, prefiero que me escribas a las 18:00 sobre el reto.');
  const chat = readFileSync(new URL('../app/second-brain/reto/ChatDelReto.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(chat, />\s*Hacerlo\s*</, 'sin «Hacerlo»');
});

test('el correo de cada día: «Día N del reto de MaKo», una vez, y el día 1 no lleva', async () => {
  const { correoDelDia, diaParaAvisar } = await import('../lib/reto/dias');
  const m = correoDelDia(3, 'https://app/second-brain?reto=1');
  assert.equal(m.asunto, 'Día 3 del reto de MaKo', 'Martín, 18/11: el asunto');
  assert.match(m.cuerpo, /Carga tus clientes en el CRM/);
  assert.match(m.cuerpo, /https:\/\/app\/second-brain\?reto=1/);
  assert.doesNotMatch(m.cuerpo, /tu video de hoy/i);
  const ahora = h('2026-11-19T12:30:00Z'); // el día 2 ya abrió
  assert.equal(diaParaAvisar(base, h('2026-11-18T23:00:00Z')), null, 'el día 1 no lleva correo');
  assert.equal(diaParaAvisar(base, ahora), 2);
  assert.equal(diaParaAvisar({ ...base, avisado: 2 }, ahora), null, 'una vez por día');
});

test('el día 3 es tu primera automatización, sin atarla a WhatsApp (Martín, 18/11)', () => {
  const d3 = DIAS_RETO[2];
  assert.doesNotMatch(JSON.stringify(d3), /difusi/i, 'sin «difusión»');
  const t = d3.tareas.find((x) => x.id === 'automatizacion');
  assert.ok(t, 'la tarea de la automatización');
  assert.equal(t.donde, 'En Automations');
  assert.match(t.detalle, /WhatsApp, Instagram o email/, 'el canal que usa la persona');
  assert.ok(t.marcas.some((m) => /chb-nueva/.test(m.sel)), 'marca «Nueva automatización»');
  assert.deepEqual(d3.tareas.map((x) => x.id), ['contactos', 'automatizacion', 'calendar']);
});
