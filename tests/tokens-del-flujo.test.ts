// =============================================================================
// tokens-del-flujo — Publicar valida los datos de TODA tarjeta (undécima tanda, 11/10/2026)
// =============================================================================
// Martín, punto 4: «En el mensaje dice "{{Mensaje de MaKo}}", ese dato NO existe... No es trackeable, no tiene
// sentido eso». Diseño: docs/diseno-undecima-tanda.md §5 («Publicar valida los tokens de TODA tarjeta»).
//
// Hasta acá sólo el recordatorio validaba sus tokens: un `{{link_crm}}` en un WhatsApp al lead, un dato de la
// charla fuera de la charla o un `{{inventado}}` salían CRUDOS al teléfono del lead. Se fija:
//   1. el CONTEXTO de cada tarjeta (a quién le llega y qué trae), que es el del «{ }» (`datosOfrecidos`);
//   2. `{{mensaje_mako}}` se rechaza SIEMPRE, aunque el evento lo traiga;
//   3. un dato del equipo en un mensaje al lead, y uno de otro evento, se rechazan;
//   4. el recordatorio (su emisor, su catálogo) se saltea hasta la limpieza;
//   5. se leen TODOS los lugares de una tarjeta (las partes de «MaKo en WhatsApp», el asunto y el HTML del email,
//      las variantes que se sortean), y no los que no salen (las variantes de un audio).
//
// PROBADO ROMPIÉNDOLO: ver las roturas al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contextoDeTarjeta, problemasDeTokens, textosDeTarjeta, RETIRADOS } from '../lib/tokens-del-flujo';
import { datosDelEvento } from '../lib/aviso-evento';
import { TRIGGER_AVISO_MAKO, TRIGGER_SOLO_GRUPO } from '../lib/disparadores';
import { TRIGGER_RECORDATORIO } from '../lib/recordatorio-automatizacion';
import { CLAVE_MENSAJE_MAKO } from '../lib/variables-aviso';
import type { PasoGrafo } from '../lib/flujo-grafo';

const RELLENO = { orden: 0, canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: '', template_wa: null, proveedor: 'no_oficial' } as const;
const wa = (id: string, cuerpo: string, extra: Record<string, unknown> = {}): PasoGrafo => ({ ...RELLENO, id, cuerpo, siguiente: null, ...extra }) as PasoGrafo;
const email = (id: string, asunto: string, cuerpo: string, extra: Record<string, unknown> = {}): PasoGrafo =>
  ({ ...RELLENO, id, canal: 'email', proveedor: undefined, asunto, cuerpo, siguiente: null, ...extra }) as PasoGrafo;
const mako = (id: string, params: Record<string, unknown>): PasoGrafo =>
  ({ ...RELLENO, id, siguiente: null, accion: { operacion: 'avisar_al_equipo', params: { leadId: 'evento', ...params } } }) as PasoGrafo;
const esperar = (id: string): PasoGrafo => ({ ...RELLENO, id, nodo: 'esperar', espera: { modo: 'tiempo', minutos: 60 }, siguiente: null }) as PasoGrafo;
const ETAPA = 'etapa_actual';

test('el CONTEXTO de cada tarjeta: al lead, oficial, al equipo con lead, el grupo solo y el evento', () => {
  const lead = { trigger_tipo: ETAPA };
  assert.deepEqual(contextoDeTarjeta(wa('a', 'x'), lead), { tipo: 'catalogo', datos: { destino: 'lead', conLead: true } });
  assert.deepEqual(contextoDeTarjeta(email('e', 'x', 'y'), lead), { tipo: 'catalogo', datos: { destino: 'lead', conLead: true } });
  assert.deepEqual(contextoDeTarjeta(wa('i', 'x', { canal: 'instagram', proveedor: undefined }), lead), { tipo: 'catalogo', datos: { destino: 'lead', conLead: true } });
  // El oficial lo decide `proveedorDelPaso`: explícito, o una plantilla de Meta puesta.
  assert.deepEqual(contextoDeTarjeta(wa('o', 'x', { proveedor: 'oficial' }), lead), { tipo: 'oficial' });
  assert.deepEqual(contextoDeTarjeta(wa('o', 'x', { proveedor: undefined, template_wa: 'bienvenida' }), lead), { tipo: 'oficial' });
  assert.deepEqual(contextoDeTarjeta(mako('m', { mensaje: 'x' }), lead), { tipo: 'catalogo', datos: { destino: 'equipo', conLead: true } });
  assert.deepEqual(contextoDeTarjeta(mako('m', { mensaje: 'x' }), { trigger_tipo: TRIGGER_SOLO_GRUPO }), { tipo: 'catalogo', datos: { destino: 'equipo', conLead: false } }, 'sin cohorte no hay lead');
  for (const sub of ['lead_agendo', 'lead_contesta', 'cuota_vencida', 'pago_recibido']) {
    assert.deepEqual(contextoDeTarjeta(mako('m', { mensaje: 'x' }), { trigger_tipo: TRIGGER_AVISO_MAKO, subtipo: sub }), { tipo: 'catalogo', datos: datosDelEvento(sub) }, sub);
  }
  assert.equal(contextoDeTarjeta(esperar('d'), lead), null, 'un DELAY no manda texto');
  assert.equal(contextoDeTarjeta({ ...RELLENO, id: 'x', accion: { operacion: 'mover_etapa', params: {} } } as PasoGrafo, lead), null, 'otra ⚡ Acción no es un mensaje');
});

test('⚠️ `{{mensaje_mako}}` NO EXISTE: se rechaza siempre, también en el evento que lo trae', () => {
  assert.ok(RETIRADOS.has(CLAVE_MENSAJE_MAKO));
  assert.equal(datosDelEvento('lead_agendo').conMensaje, true, 'el evento lo sigue trayendo (compatibilidad del motor)');
  assert.deepEqual(problemasDeTokens([mako('ma_aviso', { mensaje: '{{mensaje_mako}}' })], TRIGGER_AVISO_MAKO, 'lead_agendo'),
    [{ tarjeta: 'ma_aviso', motivo: 'No existe: {{mensaje_mako}}' }]);
  assert.equal(problemasDeTokens([mako('m', { mensaje: 'Ojo: {{MENSAJE_MAKO}}' })], ETAPA).length, 1, 'en mayúsculas también');
  // Con espacios adentro y con una llave sola: el motor (`aplicarVariables`) los resuelve igual (cierre de la ola 3).
  // Probado rompiéndolo (wf-undecima/enchufador/roturas.cjs): buscar lo retirado con `tokensDe` → 5 / 1 (base 6 / 0).
  for (const escrito of ['{{ mensaje_mako }}', '{mensaje_mako}', '{{mensaje_mako}']) {
    assert.deepEqual(problemasDeTokens([mako('m', { mensaje: `Ojo: ${escrito}` })], TRIGGER_AVISO_MAKO, 'lead_agendo'),
      [{ tarjeta: 'm', motivo: 'No existe: {{mensaje_mako}}' }], `«${escrito}» pasaba y el motor lo resolvía`);
  }
  // Y lo que lo reemplaza sí pasa: los datos citables del evento.
  const agendo = '🎯 *Nuevo agendado*: {{nombre_completo}} reservó su {{reunion_cual}} para {{reunion_cuando}} a las {{reunion_hora}}.\n📱 {{lead_telefono}}\n{{lead_respuestas_agenda}}\n\n👉 {{link_lead}}';
  assert.deepEqual(problemasDeTokens([mako('a', { mensaje: agendo })], TRIGGER_AVISO_MAKO, 'lead_agendo'), []);
  assert.deepEqual(problemasDeTokens([mako('a', { mensaje: agendo })], ETAPA), [], 'y en un flujo de lead («Un Lead Agendó Llamada»)');
});

test('⚠️ un dato del EQUIPO en un mensaje al lead, o de OTRO evento, se rechaza', () => {
  assert.deepEqual(problemasDeTokens([wa('w1', 'Hola {{nombre}}, mira {{link_crm}} y {{lead_estado}}')], ETAPA),
    [{ tarjeta: 'w1', motivo: 'No existe: {{link_crm}}, {{lead_estado}}' }]);
  assert.deepEqual(problemasDeTokens([wa('w1', 'Hola {{nombre}}, te escribo de {{inventado}}')], ETAPA), [{ tarjeta: 'w1', motivo: 'No existe: {{inventado}}' }]);
  // El pago, sólo en «Entra un pago»; lo que escribió, sólo en la charla.
  assert.deepEqual(problemasDeTokens([mako('p', { mensaje: '💰 {{pago_monto}} por {{pago_pasarela}}' })], TRIGGER_AVISO_MAKO, 'pago_recibido'), []);
  assert.equal(problemasDeTokens([mako('p', { mensaje: '💰 {{pago_monto}}' })], TRIGGER_AVISO_MAKO, 'cuota_vencida').length, 1);
  assert.deepEqual(problemasDeTokens([mako('c', { mensaje: '«{{lead_escribio}}»' })], TRIGGER_AVISO_MAKO, 'lead_contesta'), []);
  assert.equal(problemasDeTokens([mako('c', { mensaje: '«{{lead_escribio}}»' })], ETAPA).length, 1, 'un flujo de lead no trae lo que escribió');
  // Al equipo no le llega la llave del portal de un alumno; al lead sí.
  assert.equal(problemasDeTokens([mako('m', { mensaje: '{{curso_link}}' })], ETAPA).length, 1);
  assert.deepEqual(problemasDeTokens([wa('w', '{{curso_link}}')], ETAPA), []);
  // Los nombres viejos (ocultos) se resuelven: no son un problema.
  assert.deepEqual(problemasDeTokens([mako('m', { mensaje: '{{lead_nombre}} · {{lead_empresa}}' })], ETAPA), []);
  // Sin lead (el grupo solo), nada del lead.
  assert.equal(problemasDeTokens([mako('m', { mensaje: '{{lead_telefono}}' })], TRIGGER_SOLO_GRUPO).length, 1);
});

test('una plantilla OFICIAL sólo lleva los datos que el motor registra en Meta', () => {
  assert.deepEqual(problemasDeTokens([wa('o', 'Hola {{nombre}} de {{empresa}} ({{negocio}})', { proveedor: 'oficial' })], ETAPA), []);
  assert.deepEqual(problemasDeTokens([wa('o', 'Tu reunión: {{reunion_cuando}}', { proveedor: 'oficial' })], ETAPA),
    [{ tarjeta: 'o', motivo: 'No existe: {{reunion_cuando}}' }], 'el catálogo entero no viaja en una plantilla de Meta');
});

test('el recordatorio (su emisor y su catálogo de cinco) se saltea hasta la limpieza', () => {
  assert.deepEqual(problemasDeTokens([wa('t', 'Hola {{nombre}}, {{cuando}} a las {{hora}}: {{link}}')], TRIGGER_RECORDATORIO), []);
  assert.equal(problemasDeTokens([wa('t', 'Hola {{nombre}}, {{cuando}}: {{link}}')], ETAPA).length, 1, 'fuera del recordatorio, {{cuando}} no existe');
});

test('se leen TODOS los lugares de una tarjeta: las partes de «MaKo en WhatsApp», el email y las variantes que salen', () => {
  // «MaKo en WhatsApp» con partes (decisión 2 de la décima): el problema puede estar en la SEGUNDA.
  const conPartes = mako('mk', { mensaje: 'Nuevo: {{nombre_completo}}', partes: [{ tipo: 'texto', cuerpo: '📱 {{lead_telefono}}' }, { tipo: 'texto', cuerpo: '{{inventado}}' }, { tipo: 'audio', audio_id: 3 }] });
  assert.deepEqual(problemasDeTokens([conPartes], ETAPA), [{ tarjeta: 'mk', motivo: 'No existe: {{inventado}}' }]);
  assert.deepEqual(textosDeTarjeta(mako('t', { titulo: '{{nombre}}', mensaje: 'x' })), ['{{nombre}}'], 'el título también sale');
  // El email: el asunto, el preheader y el HTML (un `href` también es un lugar).
  assert.deepEqual(problemasDeTokens([email('e', 'Hola {{link_crm}}', 'ok')], ETAPA), [{ tarjeta: 'e', motivo: 'No existe: {{link_crm}}' }]);
  assert.deepEqual(problemasDeTokens([email('e', 'ok', 'ok', { cuerpo_html: '<a href="{{lead_utm_source}}">x</a>' })], ETAPA).length, 1);
  assert.equal(problemasDeTokens([email('e', 'ok', 'ok', { preheader: '{{fantasma}}' })], ETAPA).length, 1);
  // Las variantes de un texto se SORTEAN (salen); las de un audio no salen (`textoDelPaso`) y no se miran.
  assert.equal(problemasDeTokens([wa('v', 'hola', { variantes: ['hola {{fantasma}}'] })], ETAPA).length, 1);
  assert.deepEqual(problemasDeTokens([wa('v', 'pie', { tipo: 'audio', audio_id: 4, variantes: ['viejo {{fantasma}}'] })], ETAPA), []);
  // Las partes de un WhatsApp al lead.
  assert.equal(problemasDeTokens([wa('p', 'a', { partes: [{ tipo: 'texto', cuerpo: 'a' }, { tipo: 'media', media_id: 2, cuerpo: '{{link_plan}}' }] })], ETAPA).length, 1);
  // Varias tarjetas: una entrada por tarjeta con problema, con su id (o `o<índice>` sin id).
  const sinId = { ...RELLENO, cuerpo: '{{fantasma}}' } as PasoGrafo;
  assert.deepEqual(problemasDeTokens([wa('ok', 'Hola {{nombre}}'), esperar('d'), sinId], ETAPA), [{ tarjeta: 'o2', motivo: 'No existe: {{fantasma}}' }]);
});

// ── Roturas (11/10/2026, arnés scratchpad/wf-undecima/w1-datos-catalogo/romper.mjs) ───────────────────────────
// Una por vez, restaurada desde la copia en memoria y verificada con md5 (nunca `git checkout`). Este archivo solo:
// base 6 / 0, restaurado 6 / 0.
//   R4.  `problemasDeTokens` deja pasar `{{mensaje_mako}}` (sin la lista RETIRADOS)          → 5 / 1
//   R11. la plantilla OFICIAL se valida con el catálogo entero                                → 4 / 2
//   R12. «MaKo en WhatsApp» sin leer sus `partes`                                             → 5 / 1
//   R13. las variantes de un AUDIO también se miran (no salen: frenaría por algo invisible)   → 5 / 1
// Con tests/variables-aviso (base 37 / 0):
//   R5.  `tokensFueraDe` sin mirar el destino (al lead le pasaría `{{link_crm}}`)            → 34 / 3
// Con tests/aviso-evento (base 28 / 0):
//   R9.  `datosDelEvento` sin `conPago`                                                       → 26 / 2
//   R10. «Un lead contesta» sin `escrito` en lo que trae                                      → 26 / 2
// Con tests/variables-aviso, aviso-evento y datos-mensaje (base 70 / 0):
//   R2.  el alcance `pago` cae en `conCuota` (el bug de antes del 11/10)                      → 66 / 4
