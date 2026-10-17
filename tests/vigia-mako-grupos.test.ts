// =============================================================================
// El vigía de los grupos de MaKo: qué cuenta como incidente, y que no escribe nada
// =============================================================================
// El pedido (Martín, 17/10/2026): leer SIEMPRE todos los grupos de MaKo con clientes y que los errores se debugeen solos.
// scripts/vigia-mako-grupos.mts lee producción cada 15 minutos; lo que decide qué es un incidente vive en
// lib/vigia-mako-grupos.ts y se prueba acá con las filas REALES del grupo del ws18 del 16/10 (mako_doer_conv, ids
// inventados) y las del ws13 del 13/10.
//
// Probado rompiéndolo (17/10/2026): ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { incidentesDe, noPuedeDe, quejaDe, ESPERA_RESPUESTA_MS, type FilaConv, type FilaUso } from '../lib/vigia-mako-grupos';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const G = '120363433396678694@g.us';
let id = 0;
const fila = (role: 'user' | 'assistant', content: string, at: string, ws = 18): FilaConv => ({ id: ++id, workspace_id: ws, grupo_jid: G, role, content, created_at: at });

const PABLO: FilaConv[] = [
  fila('user', 'probá el calendario de google', '2026-10-16T18:16:43Z'),
  fila('assistant', 'Para usar Google Calendar con MaKo primero debes activar la integración en la sección de Calendario.', '2026-10-16T18:17:52Z'),
  fila('user', 'mentira, ya esta conectado, que tiene que hacer pablo hoy, que tareas les quedan agendadas?', '2026-10-16T18:36:45Z'),
  fila('assistant', 'Perdón, me colgué con el desvío. Déjame ver el plan y las tareas para Pablo en este momento.', '2026-10-16T18:37:00Z'),
  fila('user', 'Hola MaKo, ¿cómo estás? ¿Me agendás una visita en el Google Calendar mañana a las 9:30 horas?', '2026-10-16T21:14:03Z'),
  fila('assistant', '¡Hola! Google Calendar está conectado y listo. Para dejártela agendada mañana sábado 17 a las 9:30, pásame el nombre o email del cliente y la dirección de la propiedad, así la creo con todos los datos.', '2026-10-16T21:14:24Z'),
  fila('user', 'El nombre es Nancy y la dirección es Alem 1987', '2026-10-16T22:26:29Z'),
  fila('assistant', 'Te voy a ser sincero: te prometí agendártela recién, pero desde este chat no tengo acceso directo para escribir en tu Google Calendar.', '2026-10-16T22:27:24Z'),
  fila('user', 'Malísimo', '2026-10-16T22:28:15Z'),
  fila('assistant', 'Te entiendo perfecto, la cagada es real. Quedé como un vendehumo prometiendo algo que por acá no puedo hacer.', '2026-10-16T22:28:28Z'),
];
const DESPUES = Date.parse('2026-10-16T23:30:00Z');

test('las filas del grupo de Pablo dan los incidentes que se vieron, uno por mensaje', () => {
  const inc = incidentesDe(PABLO, [], DESPUES);
  const tipos = inc.map((i) => `${i.at.slice(11, 16)} ${i.tipos.join('+')}`);
  assert.deepEqual(tipos, [
    '18:17 no-puede', // «primero debes activar la integración», con Google conectado
    '18:36 queja', // «mentira, ya está conectado»
    '18:37 no-puede+promesa', // «me colgué» + «déjame ver el plan»
    '22:27 no-puede', // «desde este chat no tengo acceso»
    '22:28 queja', // «Malísimo»
    '22:28 no-puede+voz', // «por acá no puedo» + «cagada», «vendehumo»
  ]);
  // Un incidente sabe qué contestaba: el mensaje de la persona de antes, y cuándo (para encontrar las filas de la IA).
  const nancy = inc.find((i) => i.at.startsWith('2026-10-16T22:27'))!;
  assert.match(nancy.antes ?? '', /Nancy/);
  assert.equal(nancy.antesAt, '2026-10-16T22:26:29Z');
  // Y las claves son estables: la segunda vuelta no repite nada.
  assert.deepEqual(incidentesDe(PABLO, [], DESPUES).map((i) => i.clave), inc.map((i) => i.clave));
});

test('lo que no es un incidente no se marca', () => {
  for (const t of [
    'Listo, quedó propuesta la visita con Nancy mañana a las 9:30. ¿Confirmas con un «sí»?',
    'No puedo creer lo bien que vienen las campañas esta semana.',
    'Hay 3 tareas para hoy: llamar a los dueños, revisar precios y subir fotos.',
  ]) assert.deepEqual(noPuedeDe(t), [], `«${t}» se leyó como «no puedo»`);
  for (const t of ['dale, cargalas otra vez mañana', 'agendame de nuevo la visita', 'ok, gracias']) {
    assert.deepEqual(quejaDe(t), [], `«${t}» se leyó como una queja`);
  }
});

test('un mensaje sin respuesta es silencio; con un cartel de IA en el medio, es el cartel', () => {
  const pedido = fila('user', 'MaKo pasame todas las reuniones que tengo hoy, nombre, apellido, número de teléfono y horario de la reunión.', '2026-10-13T12:25:43Z', 13);
  const ok = fila('user', 'ok', '2026-10-13T14:04:12Z', 13);
  const ahora = Date.parse('2026-10-13T14:30:00Z');
  const cartel: FilaUso = { id: 9001, workspace_id: 13, created_at: '2026-10-13T12:26:40Z', feature: 'cartel-ia', model: 'cartel:proveedor_caido', provider: 'mako', motivo: 'ws13 · actuar · 1 keys · 1 probadas · 0 contestaron · chatCheapTools(gemini): HTTP 503' };
  const sinCartel = incidentesDe([pedido, ok], [], ahora);
  assert.ok(sinCartel.some((i) => i.tipos[0] === 'sin-respuesta' && i.at === pedido.created_at), 'el pedido sin respuesta no se cuenta');
  const conCartel = incidentesDe([pedido, ok], [cartel], ahora);
  assert.ok(!conCartel.some((i) => i.tipos[0] === 'sin-respuesta' && i.at === pedido.created_at), 'con cartel, se contó como silencio');
  assert.ok(conCartel.some((i) => i.tipos[0] === 'cartel' && i.ws === 13), 'el cartel no se cuenta');
  // Y lo que todavía está dentro de la espera no es silencio (el buffer y la IA tardan).
  const reciente = fila('user', 'pasame el plan de hoy', new Date(ahora - ESPERA_RESPUESTA_MS + 60_000).toISOString(), 13);
  assert.ok(!incidentesDe([reciente], [], ahora).some((i) => i.tipos[0] === 'sin-respuesta'), 'un mensaje de hace 9 minutos ya es silencio');
});

test('lo que el doer atajó antes de mandar (saneo-doer) también llega al vigía', () => {
  const s: FilaUso = { id: 9100, workspace_id: 18, created_at: '2026-10-17T10:00:00Z', feature: 'saneo-doer', model: 'saneo:promesa', provider: 'mako', motivo: 'ws18 · consultar · 32 tools · 0 corridas · promesa sin hacer: «dejame ver»' };
  const inc = incidentesDe([], [s], Date.parse('2026-10-17T10:05:00Z'));
  assert.equal(inc.length, 1);
  assert.equal(inc[0].tipos[0], 'saneo');
  assert.equal(inc[0].ws, 18);
  // Las filas comunes del doer (las del modelo de cada turno) no son incidentes.
  assert.deepEqual(incidentesDe([], [{ ...s, id: 9101, feature: 'mako-doer-in' }], Date.parse('2026-10-17T10:05:00Z')), []);
});

test('el script sólo LEE: no importa nada que mande, y sin incidentes no imprime nada', () => {
  const src = leer('scripts/vigia-mako-grupos.mts');
  const codigo = src.replace(/^\s*\/\/.*$/gm, '');
  // (Ojo: el nombre del propio script contiene «mako-grupo», así que se buscan los MÓDULOS.)
  for (const prohibido of ['lib/mako-grupo.', 'lib/evolution', 'lib/resend', 'enviarAGrupoJid', '.insert(', '.update(', '.upsert(', '.delete(', '.rpc(']) {
    assert.ok(!codigo.includes(prohibido), `el vigía usa ${prohibido}: no puede escribir ni mandar nada`);
  }
  // Sin incidentes, sale ANTES de cualquier línea del informe.
  const sale = codigo.indexOf('if (!nuevos.length) process.exit(0);');
  assert.ok(sale > 0 && sale < codigo.indexOf('console.log('), 'sin incidentes, el vigía escribe igual');
  // Si no pudo leer, la marca no avanza: el estado se escribe DESPUÉS de leer todo.
  assert.ok(codigo.indexOf('fs.writeFileSync(ESTADO') > codigo.indexOf("todo<any>('anthropic_usage'"), 'la marca avanza antes de leer');
});

// Probado rompiéndolo (17/10/2026), una rotura por vez, todo en verde antes (5 de 5). 9 roturas, 1 fallo cada una:
//   · NO_PUEDE sin «primero (debes|…) (activar|conectar)» (el del calendario) · NO_PUEDE sin el «no puedo creer» ·
//     QUEJA sin «mentira» · sólo el primer tipo por mensaje · el silencio sin mirar el cartel · sin la espera de
//     ESPERA_RESPUESTA_MS · `saneo-doer` fuera de lo que se lee · el script con un `.insert(` · el informe impreso
//     antes del corte sin incidentes.
