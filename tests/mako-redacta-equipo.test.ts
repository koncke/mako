// =============================================================================
// El ✦ de MaKo para el EQUIPO (undécima tanda, decisión 2 de la décima): lib/mako-redacta.ts y su ruta
// =============================================================================
// Pedido de Martín (11/10/2026), textual: «2. Si, agregale esas opciones. Pero en audios, que se pueda configurar con
// ElevenLabs que salga la voz de MaKo. La que usamos para crear los VSL de la landing.» = la tarjeta «MaKo en
// WhatsApp» con las MISMAS opciones que el WhatsApp, también el ✦. Diseño: docs/diseno-undecima-tanda.md §2
// (decisión 2) y §9 (18-21). Lo que se fija, y por qué:
//   1. el pedido: el navegador manda el CONTEXTO de la tarjeta (unas banderas), nunca una lista de nombres, y
//      `{{mensaje_mako}}` nunca entra (punto 4: no es un dato que se pueda citar);
//   2. el ✦ del EQUIPO: otro prompt (el aviso que MaKo le manda al grupo, nunca al lead), sin la voz del negocio (no
//      la lee ni la ofrece: lo escribe MaKo, no el dueño), sin `brandSystem` (tú neutro), con los datos del equipo;
//   3. el ✦ al LEAD ofrece el árbol del lead (hasta la décima eran 4 datos y el resto se borraba en silencio);
//   4. lo que el modelo escribe se filtra con la MISMA pregunta que Publicar (`tokensFueraDe`): un dato del catálogo
//      con dígitos (`{{lead_fecha_r1}}`) se respeta, y en el equipo el guion pasa la regla de la Voz de MaKo.
//
// PROBADO ROMPIÉNDOLO (11/10/2026, arnés scratchpad/wf-undecima/w2-mako-editor/romper.mjs: una rotura por vez,
// restaurada byte a byte y comprobada con md5; base 4 / 0):
//   E1. el ✦ de equipo lee la voz del negocio (`lecturasDeRedacta` devuelve todas)            → 3 / 1 (el 2)
//   E2. el ✦ de equipo escribe con el prompt del lead (la voz del negocio, «con SU voz»)       → 3 / 1 (el 2)
//   E3. `sinVariablesAjenas` vuelve a filtrar con los datos del motor (`esVariableConocida`)  → 2 / 2 (el 3 y el 4)
//   E4. `contextoDeRedacta` deja pasar `conMensaje` (el ✦ escribiría `{{mensaje_mako}}`)       → 3 / 1 (el 4)
//
// Correr: node --import tsx --test tests/mako-redacta-equipo.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  pedidoDeRedacta, redactaSystem, userDeRedacta, revisarRedacta, sinVariablesAjenas, lecturasDeRedacta, variablesParaPrompt,
  esParaElEquipo, LECTURAS_REDACTA, LECTURA_VOZ_NEGOCIO, CONTEXTO_LEAD,
} from '../lib/mako-redacta';
import { datosOfrecidos, type ContextoDatos } from '../lib/variables-aviso';
import { datosDelEvento } from '../lib/aviso-evento';

const leer = (r: string): string => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** El contexto de una tarjeta «MaKo en WhatsApp» en un flujo de lead (`contextoDeTarjeta`, lib/tokens-del-flujo.ts). */
const EQUIPO: ContextoDatos = { destino: 'equipo', conLead: true };

test('1. el pedido: el contexto son banderas saneadas (sin «Lo que arma MaKo»); lo de antes, igual', () => {
  const p = pedidoDeRedacta({ pedido: 'avisa que agendó', permiteAudio: true, datos: { destino: 'equipo', conLead: true, conMensaje: true, conPago: 'si', claves: ['inventado'] } })!;
  assert.deepEqual(p.datos, { conLead: true, destino: 'equipo' }, 'del navegador entró algo más que las banderas, o «Lo que arma MaKo»');
  assert.equal(p.permiteAudio, true, 'con la voz de MaKo se propone una nota de voz');
  assert.equal(esParaElEquipo(p.datos), true);
  assert.equal(esParaElEquipo(pedidoDeRedacta({ pedido: 'x', datos: { destino: 'lead', conLead: true } })!.datos), false);
  assert.equal(pedidoDeRedacta({ pedido: 'x' })!.datos, 'motor');
  assert.equal(pedidoDeRedacta({ pedido: 'x', datos: ['link_lead'] })!.datos, 'motor', 'una lista de nombres no es un contexto');
  assert.equal(pedidoDeRedacta({ pedido: 'x', datos: 'recordatorio', permiteAudio: true })!.permiteAudio, false);
});

test('2. el ✦ del EQUIPO: sin la voz del negocio ni brandSystem, tú neutro, nunca al lead, con los datos del equipo', () => {
  const sys = redactaSystem(EQUIPO);
  for (const k of ['nombre_completo', 'lead_telefono', 'link_lead', 'lead_utm_campaign', 'reunion_cuando', 'lead_respuestas_agenda']) {
    assert.ok(sys.includes(`{{${k}}}`), `el prompt del equipo no ofrece {{${k}}}`);
  }
  assert.ok(!sys.includes('{{variables}}'));
  assert.match(sys, /le manda al EQUIPO/);
  assert.match(sys, /NUNCA el lead/);
  assert.match(sys, /de «tú»/);
  assert.match(sys, /sin voseo/);
  assert.doesNotMatch(sys, /guía de voz|con SU voz/i, 'el aviso al equipo escribe con la voz del negocio');
  // No LEE la voz del negocio (y la ruta no pregunta por ella: no ofrece configurarla).
  assert.ok(!lecturasDeRedacta(EQUIPO).some((l) => l.id === LECTURA_VOZ_NEGOCIO), 'el ✦ del equipo lee la guía de voz del negocio');
  assert.equal(lecturasDeRedacta(EQUIPO).length, LECTURAS_REDACTA.length - 1, 'se cayó otra lectura además de la voz');
  assert.ok(lecturasDeRedacta('motor').some((l) => l.id === LECTURA_VOZ_NEGOCIO), 'al lead sí, con la voz del negocio');
  const ruta = sinComentarios(leer('app/api/chat-agent/redactar/route.ts'));
  assert.match(ruta, /leer\(ctx, lecturasDeRedacta\(p\.datos\)\)/);
  assert.match(ruta, /equipo \? Promise\.resolve\(true\) : hayVozGuiaEstricto\(\)\.catch\(\(\) => null\)/);
  // Sin `brandSystem` (la persona de MaKo es rioplatense; lo que lee un cliente va en tú neutro): ni la lib ni la ruta.
  for (const f of ['lib/mako-redacta.ts', 'app/api/chat-agent/redactar/route.ts']) {
    assert.doesNotMatch(sinComentarios(leer(f)), /brandSystem|campaign-structurer/, `${f} pasa por brandSystem`);
  }
  // El `user` lo dice, con la voz de MaKo.
  const u = userDeRedacta(pedidoDeRedacta({ pedido: 'avisa', permiteAudio: true, datos: EQUIPO })!, []);
  assert.ok(u.includes('AVISO AL EQUIPO'));
  assert.ok(u.includes('voz de MaKo: sí'));
});

test('3. el ✦ al LEAD ofrece el árbol del lead (no los 4 del motor), y nada del equipo', () => {
  const sys = redactaSystem();
  for (const g of datosOfrecidos(CONTEXTO_LEAD)) for (const v of g.items) assert.ok(sys.includes(`{{${v.key}}}`), `falta {{${v.key}}}`);
  assert.ok(!sys.includes('{{link_lead}}'), 'al lead se le ofrece el link al CRM');
  assert.ok(variablesParaPrompt().split('}} (').length > 40, 'volvieron los 4 datos del motor');
  assert.match(sys, /guía de voz del negocio/, 'al lead, con la voz del negocio');
  assert.equal(sinVariablesAjenas('El {{lead_fecha_r1}} a las {{lead_hora_r1}}'), 'El {{lead_fecha_r1}} a las {{lead_hora_r1}}', 'un dato del lead del catálogo se borró');
});

test('4. lo que escribe el modelo: la MISMA pregunta que Publicar; las claves con dígitos se respetan; «Lo que arma MaKo» nunca', () => {
  // Las claves con dígitos (la regex de antes, `[a-z_]+`, ni las veía) y con espacios o mayúsculas, normalizadas.
  assert.equal(sinVariablesAjenas('El {{lead_fecha_r1}} a las {{ LEAD_HORA_R1 }}', EQUIPO), 'El {{lead_fecha_r1}} a las {{lead_hora_r1}}');
  assert.equal(sinVariablesAjenas('{{link_lead}} y {{nombre}}'), ' y {{nombre}}', 'al lead le llega el link al CRM');
  assert.equal(sinVariablesAjenas('{{link_lead}} y {{nombre}}', EQUIPO), '{{link_lead}} y {{nombre}}');
  assert.equal(sinVariablesAjenas('{{pago_monto}}', datosDelEvento('pago_recibido')), '{{pago_monto}}', 'el pago en «Entra un pago»');
  assert.equal(sinVariablesAjenas('{{pago_monto}}', EQUIPO), '', 'el pago fuera de «Entra un pago»');
  // `{{mensaje_mako}}` no se escribe aunque el evento lo traiga (la fila lo resuelve hasta la limpieza; el ✦ no lo usa).
  assert.equal(sinVariablesAjenas('{{mensaje_mako}}', datosDelEvento('lead_agendo')), '', '«Lo que arma MaKo» no es un dato (punto 4)');
  assert.ok(!variablesParaPrompt(datosDelEvento('lead_agendo')).includes('{{mensaje_mako}}'));
  // `revisarRedacta` filtra igual, y en el equipo el guion tiene que servir para la Voz de MaKo (su tope de caracteres).
  const largo = Array.from({ length: 150 }, () => 'palabras').join(' ');
  const eq = revisarRedacta({ mensajes: ['🎯 {{nombre_completo}} agendó para el {{lead_fecha_r1}} {{inventado}}'], audio: largo }, '', true, EQUIPO);
  assert.deepEqual(eq.mensajes, ['🎯 {{nombre_completo}} agendó para el {{lead_fecha_r1}} ']);
  assert.equal(eq.audio, null, 'un guion que la Voz de MaKo no puede decir se propone igual');
  assert.ok(eq.descartes.some((d) => d.includes('voz de MaKo')));
  assert.equal(revisarRedacta({ audio: largo }, '', true, 'motor').audio, largo, 'al lead lo graba el dueño: ahí no hay tope de la Voz de MaKo');
});
