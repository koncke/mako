// =============================================================================
// El vigía (MaKo Alert) cuenta lo que no veía: propuestas vencidas, «hecho» sin acción y quejas indirectas (27/10/2026, P10)
// =============================================================================
// Del 20 al 27/10 contó 4 incidentes en una semana con más de 20. Las frases son las REALES de esos grupos.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { incidentesDe, incidentesDeVencidas, noPuedeDe, quejaDe, ROTULO_INCIDENTE, SOLO_GRUPOS, type FilaPendiente, type FilaUso } from '../lib/vigia-mako-grupos';
import { sanearSalida, SANEO_HECHO } from '../lib/doer-salida';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const G = '120363433396678694@g.us';

test('1. las quejas indirectas de los grupos son quejas', () => {
  for (const t of ['y tú eres el servicio técnico', 'no puede analizar la llamada de fathom tras 4 intentos', 'Esto habla solo ? @joan', 'ya van 4 veces', 'no me dejó agendar el evento'])
    assert.ok(quejaDe(t).length, `«${t}» no se lee como queja`);
  for (const t of ['dale, cargalas otra vez mañana', 'pasame el servicio de mañana', 'ok, gracias', 'agendame la visita con Nancy'])
    assert.deepEqual(quejaDe(t), [], `«${t}» se lee como queja`);
});

test('2. las evasivas de MaKo cuentan como «no puede»', () => {
  for (const t of ['No puedo ver imágenes directamente', 'Ese dato no se lista nominalmente…', 'Puede deberse a un problema con la grabación'])
    assert.ok(noPuedeDe(t).length, `«${t}» no se lee como «no puede»`);
  assert.deepEqual(noPuedeDe('Hay 25 no-shows y 14 sin marcar esta semana.'), []);
});

test('3. el «hecho» que el doer atajó llega como «hecho sin acción», no como un saneo más', () => {
  const s: FilaUso = { id: 9200, workspace_id: 13, created_at: '2026-10-26T15:40:00Z', feature: 'saneo-doer', model: SANEO_HECHO, provider: 'mako', motivo: 'ws13 · actuar · 12 tools · 0 corridas · hecho sin acción: «He reportado el error al equipo de MaKo…»' };
  const [i] = incidentesDe([], [s], Date.parse('2026-10-26T16:00:00Z'));
  assert.deepEqual(i.tipos, ['hecho-sin-accion']);
  assert.equal(ROTULO_INCIDENTE[i.tipos[0]], 'dijo hecho algo que no hizo');
  assert.deepEqual(incidentesDe([], [{ ...s, model: 'saneo:promesa' }], Date.parse('2026-10-26T16:00:00Z'))[0].tipos, ['saneo']);
});

test('4. el doer APLICA el saneo del «hecho» aunque no haya promesa ni grosería, y lo deja escrito', () => {
  // La frase real de Leila: sin promesa ni grosería. Con la condición vieja, el texto saneado no se mandaba.
  const s = sanearSalida('He reportado el error al equipo de MaKo… solo queda esperar su respuesta.', { corrioHerramientas: true, finDeTurno: true, enElGrupo: { respaldado: false, propuesto: true } });
  assert.ok(s.sinRespaldo?.length && !s.promesas.length && !s.groserias.length);
  const doer = leer('lib/mako-doer-in.ts');
  assert.match(doer, /if \(saneo\.promesas\.length \|\| saneo\.groserias\.length \|\| sinRespaldo\.length\) \{/);
  assert.match(doer, /recordUsage\('saneo-doer', sinRespaldo\.length \? SANEO_HECHO :/);
});

test('5. una propuesta que venció sin el «sí» es un incidente; la vigente y la confirmada, no', () => {
  const p = (id: number, estado: string, vence: string): FilaPendiente => ({ id, workspace_id: 13, grupo_jid: G, tipo: 'levantar_ticket', resumen: 'Levantar un ticket: no analiza la llamada de Fathom', estado, vence_at: vence, origen: 'hola-mako' });
  const ahora = Date.parse('2026-10-26T17:00:00Z');
  const inc = incidentesDeVencidas([p(1, 'pendiente', '2026-10-26T16:30:00Z'), p(2, 'vencida', '2026-10-26T16:00:00Z'), p(3, 'pendiente', '2026-10-26T18:00:00Z'), p(4, 'confirmada', '2026-10-26T16:10:00Z')], ahora);
  assert.deepEqual(inc.map((i) => i.clave), ['pend:1', 'pend:2']);
  assert.deepEqual(inc[0].tipos, ['vencida']);
  assert.equal(inc[0].at, '2026-10-26T16:30:00Z');
  assert.deepEqual(inc[0].marcas, ['levantar_ticket', 'hola-mako']);
  // La ruta del cron las lee y las suma.
  const ruta = leer('app/api/cron/vigia-grupos/route.ts');
  assert.match(ruta, /leerTodo<FilaPendiente>\(db, 'mako_acciones_pendientes'/);
  assert.match(ruta, /\.\.\.incidentesDeVencidas\(pend, ahora\)/);
});

test('5b. sólo las propuestas de un GRUPO: una tarjeta de la app, un paso de una automatización o la API no son una falla de WhatsApp', () => {
  // La revisión adversarial de 92d23e11d: la tabla guarda también `app:<sesión>`, `app:flujo:…` y `api:<ws>`.
  const p = (id: number, grupo_jid: string): FilaPendiente => ({ id, workspace_id: 13, grupo_jid, tipo: 'crear_tarea', resumen: 'Crear una tarea', estado: 'pendiente', vence_at: '2026-10-26T16:30:00Z', origen: 'app' });
  const inc = incidentesDeVencidas([p(1, 'app:4567'), p(2, 'app:flujo:aviso:12'), p(3, 'api:13'), p(4, G)], Date.parse('2026-10-26T17:00:00Z'));
  assert.deepEqual(inc.map((i) => i.clave), ['pend:4']);
  assert.equal(SOLO_GRUPOS, '%@g.us');
  assert.match(leer('app/api/cron/vigia-grupos/route.ts'), /\.in\('estado', \['pendiente', 'vencida'\]\)\.like\('grupo_jid', SOLO_GRUPOS\)/);
});
