// =============================================================================
// MaKo Mobile — el Inbox v2 (app/m/inbox): lo que se decide en pantalla y no se ve sin un teléfono
// =============================================================================
// Fija lo que se rompe sin un solo error:
//   · la estrella de MaKo SÓLO en lo que MaKo propuso (el CRM automático, una pendiente que vino
//     de WhatsApp o del chat de la app); lo que vino por la API, Claude Code, una automatización
//     o la landing lleva su ícono gris. Se compara contra las MISMAS funciones que escriben la
//     etiqueta (etiquetaDeOrigen / etiquetaDeCanal), nunca contra un string a mano;
//   · cada ícono que dibuja existe en app/_components/icons.tsx (uno inventado dibuja un punto);
//   · la segunda línea, la consecuencia pegada al botón y el origen corto;
//   · `?vista=` y `?abrir=` validados (un `?abrir=` con basura no abre nada);
//   · `aDecisionM`: lo que el server escribe no viaja al cliente, la ficha sólo si el link es de
//     un lead, y lo complejo va a la computadora;
//   · voseo cero en lo que se dibuja.
//
// Nació en el scratchpad del agente del Inbox (11/10/2026) y se sumó al repo en la integración.
// Verificado ROMPIÉNDOLO (11/10/2026, base 6 / 0), de a una y restaurando (scratchpad/integ/romper.py):
//   · `propusoMako` con estrella para todo lo que no sea borrador     → 4 / 2
//   · `iconoDeRuta` de /m/crm con un ícono que no existe ('lead')     → 5 / 1
//   · `claveDeParam` aceptando cualquier cosa después de los dos puntos → 5 / 1
//   · `consecuenciaDe` de una pendiente sin el «Venció»               → 5 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  cuandoCorto, segundaDe, consecuenciaDe, origenCorto, cambioDeEtapa, esLineaCorta, vistaDeParam, claveDeParam, toastDeExito,
} from '../app/m/inbox/inbox-ui';
import { propusoMako, iconoDeDecision, iconoDeRuta, aDecisionM } from '../app/m/inbox/decision-m';
import { etiquetaDeOrigen } from '../lib/inbox-movil-reglas';
import { etiquetaDeCanal } from '../lib/api-mako/canal';
import { marcasDeVoseo } from '../lib/puestas-data';
import { NOMBRES_ICONO } from '../app/_components/icons';

const existe = (ic: string) => NOMBRES_ICONO.includes(ic);

test('la estrella sólo si la propuso MaKo', () => {
  assert.equal(propusoMako({ tipo: 'confirmacion', origen: 'vino del CRM automático' }), true);
  assert.equal(propusoMako({ tipo: 'pendiente', origen: etiquetaDeCanal('123@g.us') }), true);
  assert.equal(propusoMako({ tipo: 'pendiente', origen: etiquetaDeCanal('app:5') }), true);
  assert.equal(propusoMako({ tipo: 'pendiente', origen: etiquetaDeCanal('api:5') }), false);
  assert.equal(propusoMako({ tipo: 'pendiente', origen: etiquetaDeCanal('app:flujo:9') }), false);
  assert.equal(propusoMako({ tipo: 'accion', origen: etiquetaDeOrigen('claude-code') }), false);
  assert.equal(propusoMako({ tipo: 'accion', origen: etiquetaDeOrigen('landing') }), false);
  assert.equal(propusoMako({ tipo: 'accion', origen: etiquetaDeOrigen('whatsapp') }), true);
  assert.equal(propusoMako({ tipo: 'borrador', origen: etiquetaDeOrigen('fathom') }), false);
  assert.equal(propusoMako({ tipo: 'lead', origen: etiquetaDeOrigen('whatsapp') }), false);
  assert.equal(iconoDeDecision({ tipo: 'pendiente', origen: etiquetaDeCanal('api:5') }), 'api');
  assert.equal(iconoDeDecision({ tipo: 'pendiente', origen: etiquetaDeCanal('app:flujo:9') }), 'chatbot');
  assert.equal(iconoDeDecision({ tipo: 'borrador', origen: 'x' }), 'todo');
});

test('cada ícono que dibuja el Inbox existe en el set', () => {
  for (const r of ['/m/crm/12', '/m/ads', '/m/plan', '/m/dashboard', '/m/cs', '/m/automations', '/m/video', '/m/landing', '/m/mako', '/m/hoy', null, '/m/cuenta']) {
    const ic = iconoDeRuta(r);
    assert.ok(existe(ic), `${r} → ${ic}`);
  }
  assert.equal(iconoDeRuta('/m/crm/12'), 'crm');
  for (const ic of ['api', 'chatbot', 'web', 'todo', 'crm', 'rayo', 'computadora', 'chevron', 'bell']) assert.ok(existe(ic), ic);
});

test('cuándo: la hora si fue hoy, «ayer», y nada si no se lee', () => {
  const ahora = new Date(2026, 9, 11, 21, 0).getTime();
  assert.match(cuandoCorto(new Date(2026, 9, 11, 9, 40).toISOString(), ahora)!, /^0?9:40$/);
  assert.equal(cuandoCorto(new Date(2026, 9, 10, 23, 0).toISOString(), ahora), 'ayer');
  assert.equal(cuandoCorto('nope', ahora), null);
});

test('segunda línea, consecuencia, origen y el cambio de etapa', () => {
  assert.equal(segundaDe({ tipo: 'pendiente', titulo: 'Mover a X', resumen: 'Mover de etapa', detalle: [] }, 42), 'Mover de etapa · vence en 42 min');
  assert.equal(segundaDe({ tipo: 'pendiente', titulo: 'Mover a X', resumen: 'Mover de etapa', detalle: [] }, -1), 'Mover de etapa · Vencida');
  assert.equal(segundaDe({ tipo: 'confirmacion', titulo: 'T', resumen: 'Ana', detalle: [{ rotulo: 'Etapa', valor: 'Asistió → Ganado' }] }, null), 'Etapa: Asistió → Ganado');
  assert.equal(segundaDe({ tipo: 'accion', titulo: 'Igual', resumen: 'Igual', detalle: [] }, null), null);
  assert.equal(consecuenciaDe({ tipo: 'confirmacion', accionMovil: 'resolver-confirmacion', opciones: [{ decision: 'confirmar', label: 'Dejar el cambio', tono: 'primary' }] }, false), 'MaKo ya hizo este cambio.');
  assert.equal(consecuenciaDe({ tipo: 'confirmacion', accionMovil: 'resolver-confirmacion', opciones: [{ decision: 'op:a', label: 'Pasar a X', tono: 'neutral' }] }, false), 'Todavía no se aplicó.');
  assert.equal(consecuenciaDe({ tipo: 'pendiente', accionMovil: 'confirmar-pendiente', deshacer: false }, false), 'Se ejecuta ahora y no se puede deshacer.');
  assert.equal(consecuenciaDe({ tipo: 'pendiente', accionMovil: 'confirmar-pendiente', deshacer: false }, true), 'Venció: ya no se puede ejecutar.');
  assert.equal(consecuenciaDe({ tipo: 'lead', accionMovil: 'computadora' }, false), 'Se revisa en la computadora.');
  for (const [o, e] of [['vino por WhatsApp', 'WhatsApp'], ['vino del chat de la app', 'Chat de la app'], ['vino por la API', 'API'], ['vino de una automatización', 'Automatización'], ['vino del CRM automático', 'CRM automático'], ['vino de MaKo', 'MaKo'], ['vino de un archivo', 'Archivo']]) {
    assert.equal(origenCorto(o), e);
  }
  const e = cambioDeEtapa([{ rotulo: 'Grabación Fathom', valor: 'agregada' }, { rotulo: 'Etapa', valor: 'No responde → Nutrición - Reactivación' }]);
  assert.deepEqual(e && [e.antes, e.despues], ['No responde', 'Nutrición - Reactivación']);
  assert.equal(cambioDeEtapa([{ rotulo: 'Etapa', valor: 'Ganado' }]), null);
  assert.equal(esLineaCorta('US$ 1.500'), true);
  assert.equal(esLineaCorta('Hola, ¿pudiste ver la clase?'), false);
  assert.equal(vistaDeParam('avisos', false), 'decidir');
  assert.equal(vistaDeParam('avisos', true), 'avisos');
  assert.equal(claveDeParam('pendiente:12'), 'pendiente:12');
  assert.equal(claveDeParam('pendiente:12<script>'), null);
  assert.equal(claveDeParam(['pendiente:12']), null);
  assert.equal(toastDeExito('confirmacion', true, 'rechazar'), 'Cambio deshecho');
});

test('aDecisionM: `escribe` no viaja, la ficha sólo de un lead, lo complejo a la computadora', () => {
  const d = aDecisionM({ tipo: 'confirmacion', key: 'confirmacion:3', id: 3, accionMovil: 'resolver-confirmacion', opciones: [], titulo: 't', resumen: 'Ana', origen: 'vino del CRM automático', linkEscritorio: '/crm/45', detalle: [], escribe: 'tabla x' }, true);
  assert.equal(d.escribe, null);
  assert.equal(d.ficha, '/m/crm/45');
  assert.equal(d.deMako, true);
  assert.equal(d.enTelefono, true);
  const c = aDecisionM({ tipo: 'accion', key: 'accion:p', id: 'p', accionMovil: 'computadora', complejidad: 'compleja', operacion: 'op', parametros: [], titulo: 't', resumen: 'op', origen: 'vino por la API', linkEscritorio: '/mako/revisar/p', detalle: [] }, true);
  assert.equal(c.enTelefono, false);
  assert.equal(c.ficha, null);
  assert.equal(c.deMako, false);
});

test('voseo cero en lo que dibuja el Inbox', () => {
  const sin = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const f of ['InboxM.tsx', 'inbox-ui.ts', 'decision-m.ts', 'page.tsx', 'acciones.ts']) {
    const m = marcasDeVoseo(sin(readFileSync(join(__dirname, '..', 'app', 'm', 'inbox', f), 'utf8')));
    assert.deepEqual(m, [], `${f}: ${m.join(', ')}`);
  }
});
