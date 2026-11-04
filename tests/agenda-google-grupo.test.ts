// =============================================================================
// Ticket #42 (Código Inmobiliario, 3/11/2026): MaKo decía que no tenía acceso a Google Calendar teniéndolo
// =============================================================================
// «De hecho si tienes acceso al google calendar y puedes configurarlo todo, esa respuesta que diste está mal». Medido el 3/11: el
// negocio tiene su agenda conectada desde el 8/10 y las dos herramientas existen. Pero nombrar el LUGAR sólo traía el área
// `integraciones` —sin `crm` no viajaba `proponer_agendar_agenda`—, «agrégalo a mi google calendar» caía en charla, y en una
// pregunta el modelo deducía el «no puedo» de las herramientas que le llegaban.
//
// Lo que fija, por el mismo camino del turno del grupo (clasificador + selección, y la clase de la IA encima):
//   1. pedirlo trae la herramienta, también si la IA lo clasifica y las reglas no lo vieron;
//   2. la pregunta y el reclamo son una consulta del área de la agenda;
//   3. el dato del estado real: conectado, sin conexión, sin permiso, sin rol, y va en los DOS turnos;
//   4. los runners reales en canal whatsapp: se propone, con el «sí» queda en Google, y sin conexión o permiso dice cuál falta.
//
// Probado rompiéndolo (3/11/2026), una rotura por vez y con todo en verde antes (fallos / pases, de 11):
//   · sacar `calendar\b|gcal\b` del área crm: 2 / 9 · sacar la línea de LUGAR_GOOGLE de esPedidoAgenda: 1 / 10
//   · sacar LUGAR_GOOGLE de la regla de la pregunta: 1 / 10 · sacar `${ctxGoogle}` del doer o del turno de la app: 1 / 10 c/u
//   · sacar la guarda de `crear_evento_google.preparar`: 2 / 9 · el hecho sin mirar el rol: 1 / 10 · sin mirar la conexión: 1 / 10
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { clasificarIntencion, nombraGoogleCalendar } from '../lib/mako-intencion';
import { herramientasDelTurno } from '../lib/doer-herramientas';
import { veredictoDeClase } from '../lib/mako-intencion-ia';
import { hechoGoogleCalendar } from '../lib/agenda-sin-ia';
import { porId, visible, type Vista } from '../lib/api-mako/registro';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

function nombresDeSiempre(): string[] {
  const url = (rel: string) => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);
  const codigo = `import { MAKO_TOOLS } from ${url('lib/mako-tools.ts')}; import { MAKO_ACCION_TOOLS } from ${url('lib/mako-doer-acciones.ts')}; process.stdout.write(JSON.stringify([...MAKO_TOOLS, ...MAKO_ACCION_TOOLS].map((t) => t.name)))`;
  return JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  })) as string[];
}
const DE_SIEMPRE = nombresDeSiempre().map((name) => ({ name }));
const vista: Vista = { canal: 'whatsapp', alcance: 'ejecutar', ws: 13, rol: 'admin', tabs: null };

const turnoCon = (veredicto: ReturnType<typeof clasificarIntencion>, texto: string) => herramientasDelTurno({
  veredicto, texto, contextoDelSi: null, hilo: null, agendaAbierta: false, deSiempre: DE_SIEMPRE, vista, hayPendientes: false, resumenesPendientes: [], sinCalendly: true,
});
const nombres = (veredicto: ReturnType<typeof clasificarIntencion>, texto: string) => turnoCon(veredicto, texto).tools.map((t) => t.name);

const PEDIDOS = [
  'crea un evento en mi Google Calendar mañana a las 9',
  'creá un evento en mi Google Calendar mañana a las 9',
  'Agrégalo a mi google calendar',
  'podes cargar el evento en google calendar',
  'agrégame esto al calendar: reunión con Pablo el jueves a las 10',
  '¿puedes crear eventos en mi Google Calendar?',
];

test('pedirlo en el grupo trae la herramienta que lo crea en Google', () => {
  for (const frase of PEDIDOS) {
    const v = clasificarIntencion(frase, {});
    assert.equal(v.intencion, 'actuar', `«${frase}» → ${v.intencion}`);
    assert.ok(nombres(v, frase).includes('proponer_agendar_agenda'), `«${frase}» no trae proponer_agendar_agenda`);
  }
});

test('«el calendario de google» trae también crear_evento_google, que está disponible por WhatsApp', () => {
  const frase = 'crea un evento en el calendario de google mañana a las 9';
  assert.ok(nombres(clasificarIntencion(frase, {}), frase).includes('crear_evento_google'));
  const def = porId('crear_evento_google')!;
  assert.ok(def.canales.includes('whatsapp'));
  assert.ok(visible(def, vista), 'el grupo corre como admin: la tiene que ver');
  assert.ok(!def.canales.includes('http'), 'la agenda de Google no sale por HTTP');
});

test('si la clase la decide la IA y las reglas no lo vieron, el área de la agenda viaja igual', () => {
  // La frase que las reglas leen como material o charla, con la clase ACCION del modelo: la que corre en el grupo.
  const frase = 'che dale, mandalo al google calendar nomás';
  const reglas = clasificarIntencion(frase, {});
  const v = veredictoDeClase({ clase: 'ACCION', resumen: 'crear evento' } as never, reglas, { esSuperAdmin: false, escribeElDueno: false, texto: frase });
  assert.equal(v.intencion, 'actuar');
  assert.ok(nombres(v, frase).includes('proponer_agendar_agenda'), `llegaron: ${nombres(v, frase).join(', ')}`);
});

test('la pregunta y el reclamo del ticket son una consulta del área de la agenda, no material para anotar', () => {
  for (const frase of ['De hecho si tenes acceso al google calendar y podes configurarlo todo, esa respuesta que diste esta mal.', '¿tienes acceso a mi Google Calendar?']) {
    const v = clasificarIntencion(frase, {});
    assert.equal(v.intencion, 'consultar', `«${frase}» → ${v.intencion}`);
    assert.ok(turnoCon(v, frase).areas.includes('crm'), `«${frase}»: sin el área crm no hay agenda_del_dia`);
  }
});

test('«el calendario» a secas y un «content calendar» no son Google', () => {
  assert.equal(nombraGoogleCalendar('agendá el reel en el calendario'), false);
  assert.equal(nombraGoogleCalendar('armá un content calendar para el mes'), false);
  assert.equal(nombraGoogleCalendar('¿Tienes acceso al Google Calendar?'), true);
  assert.equal(nombraGoogleCalendar('míralo en el calendario de Google'), true);
});

test('el hecho dice el estado real y, si falta algo, CUÁL de las dos', () => {
  const hecho = (conectado: boolean, puedeMover: boolean, rol: 'admin' | 'miembro') => hechoGoogleCalendar({ conectado, puedeMover, rol });
  const bien = hecho(true, true, 'admin');
  assert.match(bien, /SÍ puedes crear eventos/);
  assert.match(bien, /Nunca digas que no tienes acceso/);
  assert.doesNotMatch(bien, /falta/);

  const sinConexion = hecho(false, false, 'admin');
  assert.match(sinConexion, /falta la conexión/);
  assert.match(sinConexion, /Settings → Integrations/);
  assert.doesNotMatch(sinConexion, /el rol/);

  assert.match(hecho(true, false, 'admin'), /falta el permiso/);

  const sinRol = hecho(true, true, 'miembro');
  assert.match(sinRol, /falta el rol/);
  assert.doesNotMatch(sinRol, /la conexión/);

  const lasDos = hecho(false, false, 'miembro');
  assert.match(lasDos, /la conexión/);
  assert.match(lasDos, /el rol/);
  for (const t of [sinConexion, sinRol, lasDos]) assert.match(t, /No digas que MaKo no tiene esa función/);
});

test('el hecho va en los dos turnos, sólo si nombra Google Calendar', () => {
  const doer = leer('lib/mako-doer-in.ts');
  assert.match(doer, /const ctxGoogle = nombraGoogleCalendar\(sinPrefijoDeLote\(texto\)\) \? hechoGoogleCalendar\(\{ \.\.\.\(await permisoCalendarioGoogle\(\)\), rol: 'admin' \}\) : ''/);
  assert.match(doer, /\$\{reglaDeLasMarcas\}\$\{ctxGoogle\}/);
  const app = leer('lib/mako-turno-app.ts');
  assert.match(app, /const ctxGoogle = nombraGoogleCalendar\(textoPersona\) \? hechoGoogleCalendar\(\{ \.\.\.\(await permisoCalendarioGoogle\(\)\), rol: persona\.rol \}\) : ''/);
  assert.match(app, /\$\{ctxOfrece\}\$\{ctxGoogle\}/);
});

type Hijo = Record<'googlePrep' | 'googleEjec' | 'agendarPrep' | 'agendarEjec' | 'googleSinConexion' | 'agendarSinConexion' | 'googleSoloLectura', { error?: string; resumen?: string; ok?: boolean; payload?: unknown }> & {
  googleEventos: Array<{ calendario: string; titulo: string; fecha: string; hora: string }>;
  agendarReuniones: Array<{ titulo: string; emailInvitado: string | null }>;
  eventosSinPermiso: unknown[];
};
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', join(RAIZ, 'tests', '_agenda-google-grupo-hijo.ts')], {
  // Sin NODE_TEST_CONTEXT: llamado desde un test, node toma al hijo por un test anidado.
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 200_000, env: { ...process.env, NODE_TEST_CONTEXT: undefined },
});
const H = JSON.parse(salida.slice(salida.indexOf('@@JSON@@') + 8, salida.indexOf('@@FIN@@'))) as Hijo;

test('crear_evento_google por WhatsApp: lo propone y, con el «sí», queda en Google', () => {
  assert.match(H.googlePrep.resumen ?? '', /Crear en tu Google Calendar: «Firma», 2031-03-14 a las 09:00/);
  assert.equal(H.googleEjec.ok, true);
  assert.deepEqual(H.googleEventos, [{ calendario: 'primary', titulo: 'Firma', fecha: '2031-03-14', hora: '09:00' }]);
});

test('proponer_agendar_agenda por WhatsApp: sin lead, un evento propio en Google', () => {
  assert.match(H.agendarPrep.resumen ?? '', /en tu Google Calendar, sin invitados/);
  assert.equal(H.agendarEjec.ok, true);
  assert.deepEqual(H.agendarReuniones.map((r) => [r.titulo, r.emailInvitado]), [['Firma', null]]);
});

test('sin conexión o con permiso de sólo lectura dice cuál falta ANTES del «sí», y a Google no le pide nada', () => {
  for (const r of [H.googleSinConexion, H.agendarSinConexion]) {
    assert.match(r.error ?? '', /no tiene una agenda de Google conectada/);
    assert.equal(r.payload, undefined, 'no se propone lo que no se puede crear');
  }
  assert.match(H.googleSoloLectura.error ?? '', /permiso de solo lectura/);
  assert.deepEqual(H.eventosSinPermiso, []);
});

test('la lógica de la conexión es UNA: crm.run y calendario.run la importan de lib/google-calendar.ts', () => {
  const gc = leer('lib/google-calendar.ts');
  assert.match(gc, /export async function agendaParaEscribir\(\)/);
  assert.match(gc, /if \(!p\.conectado\) return 'Este negocio no tiene una agenda de Google conectada\./);
  assert.match(gc, /if \(!p\.puedeMover\) return 'La agenda de Google está conectada con permiso de solo lectura/);
  assert.doesNotMatch(leer('lib/api-mako/areas/crm.run.ts'), /async function agendaParaEscribir/);
  assert.match(leer('lib/calendario-google.ts'), /export \{ agendaParaEscribir \} from '\.\/google-calendar';/);
  const cal = leer('lib/api-mako/areas/calendario.run.ts');
  assert.match(cal.slice(cal.indexOf('crear_evento_google: {'), cal.indexOf('programar_publicacion: {')), /const sinAgenda = await agendaParaEscribir\(\);\n\s+if \(sinAgenda\) return \{ error: sinAgenda \};/);
});
