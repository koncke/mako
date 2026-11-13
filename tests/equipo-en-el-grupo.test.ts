// =============================================================================
// El closer y el setter del negocio están en SU grupo de la app, y MaKo les contesta con lo que su rol ve (13/11/2026)
// =============================================================================
// El Cerebro (13/11/2026), con los grupos de WhatsApp dejados: «un closer o un setter que hoy le habla a MaKo por WhatsApp no puede quedarse afuera en la app. Que el
// grupo del negocio incluya a TODO el equipo del negocio, y que MaKo le conteste a cada uno con lo que su rol puede ver en la app… Nunca más de lo que su rol ve en
// pantalla.» Hasta hoy entraban sólo invitados (sin herramientas ni datos), y lo decía tests/grupos-ops-puerta.test.ts.
// El hijo corre el POST real, el cron real y el turno real: tests/_equipo-en-el-grupo-hijo.ts. Quien administra es el control.
//
// PROBADO ROMPIÉNDOLO: al final del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
let corrida: Record<string, any> | null = null;
function R(): Record<string, any> {
  if (corrida) return corrida;
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--experimental-test-module-mocks', '--import', 'tsx', join(RAIZ, 'tests', '_equipo-en-el-grupo-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 240_000, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });
  corrida = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;
  return corrida;
}
type Def = { tab: string | null; admin: boolean; google: boolean };
const def = (id: string): Def => R().defs[id];
const toolsDe = (k: string): string[] => R()[k].flatMap((t: { tools: string[] }) => t.tools);
const todoDe = (k: string): string => R()[k].map((t: { todo: string }) => t.todo).join('\n');
const SEMILLAS_DEL_NEGOCIO = ['SEMILLA-PERFIL', 'SEMILLA-OBJETIVO', 'SEMILLA-TICKET', 'SEMILLA-PENDIENTE', 'SEMILLA-CHARLA-DEL-DUENO', 'SEMILLA-RESPUESTA-AL-DUENO', 'SEMILLA-RECIBO'];
const SIN_PESTANA = ['confirmar_accion', 'cancelar_accion', 'levantar_ticket', 'mis_tickets', 'quien_soy', 'listar_capacidades_mako', 'buscar_tutorial'];
/** Las pestañas que un closer ve en la app (app/_components/nav.ts, `rolesWs`), con operaciones de MaKo. */
const DEL_CLOSER = ['crm', 'whatsapp', 'chats', 'todo', 'graphics', 'calendario', 'mako', 'perfil', 'tickets'];

test('⛔ el closer del negocio entra a su grupo, sin el recibo; el de otro negocio, no', () => {
  const h = R().hilo;
  assert.equal(h.cris, 200, 'el closer se quedaba afuera: sólo entraba invitado');
  assert.ok(h.crisTextos.includes('Llegó un lead nuevo: Pedro.'));
  assert.ok(!h.crisTextos.some((t: string) => t.includes('SEMILLA-RECIBO')), 'el recibo (plata) no lo ve el equipo');
  assert.ok(h.anaTextos.some((t: string) => t.includes('SEMILLA-RECIBO')), 'el control: quien administra sí lo ve');
  assert.equal(h.ajena, 404, 'el closer de otro negocio');
});

test('⛔ MaKo le contesta al closer, con lo de SUS pestañas y nada de quien administra', () => {
  assert.equal(R().cris.status, 200);
  assert.deepEqual(R().cris.hilo, ['Entraron 2.'], 'MaKo no le contestó');
  const deCris = R().cris.turnos.flatMap((t: { tools: string[] }) => t.tools) as string[];
  assert.ok(deCris.length > 0, 'sin herramientas no le sirve: lee los leads como en su pantalla');
  assert.ok(deCris.includes('buscar_leads') && deCris.includes('ficha_lead'), 'los leads del CRM sí');
  for (const t of deCris) {
    const d = def(t);
    assert.ok(d, `${t} no es del registro: no pasa por la vista de su rol`);
    assert.equal(d.admin, false, `${t} es de quien administra`);
    assert.equal(d.google, false, `${t} lee la agenda de Google del dueño`);
    assert.ok(d.tab ? DEL_CLOSER.includes(d.tab) : SIN_PESTANA.includes(t), `${t} (${d.tab ?? 'sin pestaña'}) no está en la pantalla de un closer`);
  }
  const todo = R().cris.turnos.map((t: { todo: string }) => t.todo).join('\n');
  for (const s of SEMILLAS_DEL_NEGOCIO) assert.ok(!todo.includes(s), `⛔ ${s} le llegó al turno del closer`);
  assert.match(todo, /QUIEN TE ESCRIBE ES DEL EQUIPO DEL NEGOCIO \(closer\)/);
});

test('⛔ el control: con quien administra, el contexto del negocio y sus herramientas SÍ viajan', () => {
  const todo = todoDe('ana');
  for (const s of ['SEMILLA-PERFIL', 'SEMILLA-TICKET', 'SEMILLA-PENDIENTE', 'SEMILLA-CHARLA-DEL-DUENO']) assert.ok(todo.includes(s), `${s} no llegó: el control no prueba nada`);
  assert.ok(toolsDe('ana').some((t) => def(t)?.admin), 'quien administra corre con lo suyo');
  assert.ok(toolsDe('anaPlata').some((t) => def(t)?.google), 'y con la agenda de Google');
});

test('⛔ lo de plata, objetivos y la agenda del dueño: a quien administra sí, al closer no', () => {
  const cris = toolsDe('crisPlata');
  assert.ok(!cris.some((t) => def(t)?.admin || def(t)?.google), `viajaron: ${cris.filter((t) => def(t)?.admin || def(t)?.google)}`);
  assert.ok(!cris.some((t) => ['general', 'graphics', 'ads-manager', 'analisis'].includes(def(t)?.tab ?? '') && def(t)?.admin), 'objetivos, métricas o anuncios');
  assert.ok(!todoDe('crisPlata').includes('SEMILLA-OBJETIVO'));
  assert.ok(toolsDe('anaPlata').some((t) => def(t)?.tab === 'general'), 'el control');
});

test('cada rol, lo suyo: el setter ve Email y Automations, el closer no', () => {
  const sofi = toolsDe('sofiEmail');
  const cris = toolsDe('crisEmail');
  assert.ok(sofi.some((t) => def(t)?.tab === 'email'), 'el setter tiene Email en su pantalla');
  assert.ok(sofi.some((t) => def(t)?.tab === 'setting'), 'y Automations');
  assert.ok(!cris.some((t) => def(t)?.tab === 'email' || def(t)?.tab === 'setting'), `al closer le viajaron: ${cris.filter((t) => ['email', 'setting'].includes(def(t)?.tab ?? ''))}`);
  assert.ok(!sofi.some((t) => def(t)?.admin), 'nada de quien administra');
  assert.ok(toolsDe('anaEmail').some((t) => def(t)?.tab === 'email' && def(t)?.admin), 'el control: quien administra tiene lo de email que sólo administra');
});

test('⛔ lo que el closer habla con MaKo vive en SU clave: no se mezcla con lo del dueño', () => {
  const conv = R().cris.conv as Array<{ jid: string; role: string }>;
  const suyo = conv.filter((c) => c.jid.endsWith('#equipo:cris@fiesta.test'));
  assert.deepEqual(suyo.map((c) => c.role), ['user', 'assistant'], 'su turno se guardaba en la memoria del grupo: el dueño lo vería como suyo y el closer, lo del dueño');
  assert.equal(conv.filter((c) => c.jid === '120363000000000010@g.us').length, 2, 'lo del dueño quedó como estaba');
});

test('el push: un aviso de un lead le suena al equipo; un recibo, no', () => {
  const p = R().push;
  assert.deepEqual(p.recibo, ['https://push.test/ana']);
  assert.deepEqual([...p.lead].sort(), ['https://push.test/ana', 'https://push.test/cris']);
});

// PROBADO ROMPIÉNDOLO (13/11/2026), sobre el código real, corriendo este archivo, y restaurado:
//   · lib/grupo-reglas.ts de main 661c4d7bf (el closer, sólo invitado) → 7 en rojo (el hijo ni carga: no existe la letra del equipo).
//   · lib/api-mako/vista.ts de main (sin `soloTabs`: el closer como 'miembro' con TODAS las pestañas de la capa) → 3 en rojo: «MaKo le contesta al closer…»,
//     «lo de plata, objetivos y la agenda del dueño» (viajaba `agenda_del_dia`, la agenda de Google del dueño) y «cada rol, lo suyo» (al closer le viajaba Email).
