// =============================================================================
// Ticket #56: «los leads de la campaña X, con nombre y teléfono» (4/11/2026)
// =============================================================================
// Natalia (ws 19), por WhatsApp: «vamos a necesitar una lista de TODOS los leads entrantes de la campaña, con nombre, apellido y
// número de contacto» y «de la campaña: Campaña recon Finca Cortesin». MaKo contestó «No encontré leads con ese filtro. ¿De qué
// fecha es la campaña…? Lo demás no lo llegué a hacer en este mensaje: pídemelo otra vez y lo hago.», con 113 leads en la
// cartera. Ninguna herramienta filtraba por campaña (`buscar_leads` mira nombre, teléfono, email y empresa; `listar_leads`, etapa,
// fechas y personas), y en un lead de landing la campaña ni está escrita: es el ID. La regla: lib/leads-por-campana.ts; la
// lectura: lib/leads-por-campana-server.ts. Acá corre la regla pura y, en un hijo (tests/_leads-por-campana-hijo.ts, con un
// PostgREST de mentira), `buscar_leads` y `listar_leads` REALES y el turno real de WhatsApp.
//
// PROBADO ROMPIÉNDOLO (4/11/2026), base 9 / 0, una rotura por vez y restaurada:
//   · `buscar_leads` sin mirar campañas cuando nadie se llama así                         → 7 / 2 (el 5 y el 6)
//   · la lista sin `aPersona` (el modelo recibe las filas también en WhatsApp)              → 8 / 1 (el 5)
//   · las palabras por SUBCADENA y no por principio de palabra («ana» en «campaña»)         → 8 / 1 (el 1)
//   · sin el filtro `tambien` (la fecha de listar_leads no filtra la campaña)               → 8 / 1 (el 7)
//   · `preguntaUnDato` que siempre dice false (vuelve el «pídemelo otra vez»)              → 8 / 1 (el 4)
//   · el doer sin pasarle `aPersona` a `runMakoTool`                                        → 8 / 1 (el 9)
// Correr: node --import tsx --test tests/leads-por-campana.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  campanasDelTexto, campanasConocidas, listaParaLaPersona, palabrasDelPedido, type CampanaConLeads,
} from '../lib/leads-por-campana';
import { sanearSalida, SIN_HACER_LO_DEMAS, SIN_HACER } from '../lib/doer-salida';

const RAIZ = join(__dirname, '..');
const C = (key: string, nombre: string, leads: number): CampanaConLeads => ({ key, nombre, leads });
const CAMPANAS = [
  C('120200000000000001', 'RECON - Finca Cortesín 2026', 113),
  C('120200000000000003', 'Recon Finca Cortesin copia', 2),
  C('120200000000000002', 'Recon Sotogrande', 0),
  C('n:Prospección Marbella', 'Prospección Marbella', 9),
];

test('1. el texto nombra la campaña por partes, sin tildes ni «campaña», y una palabra corta no pesca cualquiera', () => {
  assert.deepEqual(palabrasDelPedido('de la campaña: Campaña recon Finca Cortesin'), ['recon', 'finca', 'cortesin']);
  const r = campanasDelTexto('Campaña recon Finca Cortesin', CAMPANAS);
  assert.deepEqual(r.coinciden.map((c) => c.nombre), ['RECON - Finca Cortesín 2026', 'Recon Finca Cortesin copia'], 'las dos que tienen todas las palabras, la de más leads primero');
  assert.deepEqual(campanasDelTexto('cortesin', CAMPANAS).coinciden.length, 2);
  assert.deepEqual(campanasDelTexto('Recon Finca Cortesin copia', CAMPANAS).coinciden.map((c) => c.nombre), ['Recon Finca Cortesin copia'], 'el nombre entero es ésa sola');
  assert.deepEqual(campanasDelTexto('120200000000000002', CAMPANAS).coinciden.map((c) => c.nombre), ['Recon Sotogrande'], 'el id de Meta también');
  assert.equal(campanasDelTexto('ana', [C('1', 'Campaña Marbella', 3)]).coinciden.length, 0, '«ana» no es el principio de ninguna palabra de «campaña marbella»');
});

test('2. si no nombra ninguna, las parecidas; si habla de una campaña y no se parece ninguna, las que más leads trajeron', () => {
  const r = campanasDelTexto('campaña recon Málaga', CAMPANAS);
  assert.equal(r.coinciden.length, 0);
  assert.deepEqual(r.parecidas.map((c) => c.nombre).slice(0, 2), ['RECON - Finca Cortesín 2026', 'Recon Finca Cortesin copia']);
  assert.deepEqual(campanasDelTexto('la campaña de Ibiza', CAMPANAS).parecidas.map((c) => c.nombre), ['RECON - Finca Cortesín 2026', 'Prospección Marbella', 'Recon Finca Cortesin copia'], 'sólo las que tienen leads');
  assert.deepEqual(campanasDelTexto('Pedro Inexistente', CAMPANAS), { coinciden: [], parecidas: [] }, 'un nombre de persona no trae campañas');
  // Las de las métricas sin leads también existen (otra respuesta que «no la encontré»).
  const conocidas = campanasConocidas([{ key: '9', nombre: 'A' }, { key: '9', nombre: 'A' }, { key: null, nombre: null }], { 9: 'A', 8: 'B' });
  assert.deepEqual(conocidas, [C('9', 'A', 2), C('8', 'B', 0)]);
});

test('3. la lista la escribe el código: nombre y teléfono de cada uno, el email si no hay teléfono, y lo que no entra se dice', () => {
  const filas = [
    { id: 1, nombre: 'Lucía Ferrer', telefono: '+34 611 222 333', email: null, entro: '2026-10-28', campana: 'A' },
    { id: 2, nombre: 'Marcos Gil', telefono: null, email: 'marcos@correo.test', entro: '2026-10-21', campana: 'A' },
    { id: 3, nombre: null, telefono: null, email: null, entro: null, campana: 'A' },
  ];
  const t = listaParaLaPersona([C('1', 'A', 3)], filas);
  assert.equal(t, '*Leads de «A»* (3)\n\n1. Lucía Ferrer — +34 611 222 333\n2. Marcos Gil — sin teléfono · marcos@correo.test\n3. Sin nombre — sin teléfono ni email');
  assert.match(listaParaLaPersona([C('1', 'A', 3)], filas, 2), /…y 1 más que no entran en este mensaje\.$/);
});

test('4. la respuesta que pregunta un dato no lleva «pídemelo otra vez y lo hago»', () => {
  const pregunta = 'No encontré leads con ese filtro. ¿De qué fecha es la campaña o cuándo empezó a entregar?';
  // Con herramientas: la espera del final se saca (como siempre) y no se le pega «Lo demás no lo llegué a hacer».
  const conHerramientas = sanearSalida(`${pregunta} Dame un momento y te la paso.`, { corrioHerramientas: true, finDeTurno: true });
  assert.equal(conHerramientas.texto, pregunta);
  assert.ok(!conHerramientas.texto.includes(SIN_HACER_LO_DEMAS));
  // Sin herramientas, igual.
  const sin = sanearSalida('¿Cuál de las dos campañas? Dame un momento y te la paso.', { corrioHerramientas: false });
  assert.ok(!sin.texto.includes(SIN_HACER), sin.texto);
  // Lo que no pregunta un dato sigue llevando la verdad: «¿Te sirve?» no pide nada.
  const noPide = sanearSalida('Tus ventas de octubre fueron 12. ¿Te sirve? Dame un rato y te paso el detalle.', { corrioHerramientas: true, finDeTurno: true });
  assert.ok(noPide.texto.endsWith(SIN_HACER_LO_DEMAS), noPide.texto);
});

const salida = execFileSync(process.execPath, ['--conditions=react-server', '--experimental-test-module-mocks', '--import', 'tsx', join(RAIZ, 'tests', '_leads-por-campana-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 240_000,
  env: { ...process.env, NODE_TEST_CONTEXT: undefined },
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;
const LOS_SEIS = ['Inés Prado', 'Lucía Ferrer Díaz', 'Tomás Vidal', 'Elena Soler', 'Marcos Gil', 'Raúl Montes'];

test('5. WhatsApp: «Campaña recon Finca Cortesin» trae sus leads, la lista va aparte escrita por el código y el modelo sólo cuántos', () => {
  assert.equal(R.error, undefined, String(R.error));
  assert.deepEqual(R.red, [], 'no salió a la red');
  assert.equal(R.whatsapp.encontrados, 6, 'los 4 de la landing (por el id) y los 2 del formulario (por el anuncio)');
  assert.equal(R.whatsapp.lista, 'ya_va_aparte');
  assert.equal(R.whatsapp.leads, undefined, 'el modelo no copia teléfonos');
  assert.equal(R.aparte.length, 1);
  for (const n of LOS_SEIS) assert.ok(R.aparte[0].includes(n), `falta ${n} en la lista`);
  assert.ok(R.aparte[0].includes('Inés Prado — +34 644 555 666'), 'el teléfono exacto, pegado al nombre');
  assert.ok(!R.aparte[0].includes('Persona De Otro Negocio'), 'un lead de otro negocio con la misma campaña no sale');
});

test('6. sin el canal del código (la app, HTTP) las filas van en lo que lee el modelo; una persona se busca como siempre', () => {
  assert.deepEqual(R.sinCanal.leads.map((l: { nombre: string }) => l.nombre), LOS_SEIS, 'los más nuevos primero');
  assert.equal(R.sinCanal.omitidos, 0);
  assert.equal(R.persona.encontrados, 1);
  assert.equal(R.persona.por_campana, undefined, 'un nombre de persona no es una campaña');
  assert.deepEqual([R.muchos.encontrados, R.muchos.coinciden, R.muchos.omitidos], [20, 22, 2], 'con más de 20 se dice cuántos quedaron afuera');
  assert.deepEqual(R.nadie, { encontrados: 0, leads: [] }, 'nadie se llama así y no habla de una campaña: lo de siempre');
  assert.deepEqual(R.noExiste.campanas_parecidas.map((c: { nombre: string }) => c.nombre), ['RECON - Finca Cortesín 2026', 'Prospección Marbella']);
  assert.match(R.noExiste.instruccion, /No le pidas la fecha/);
});

test('7. listar_leads con `campana`: nombre parcial, sin fecha; con fecha también filtra; la que no tiene leads se dice', () => {
  assert.deepEqual(R.listar.leads.map((l: { nombre: string }) => l.nombre), LOS_SEIS);
  assert.deepEqual(R.listarConFecha.leads.map((l: { nombre: string }) => l.nombre), ['Inés Prado', 'Lucía Ferrer Díaz', 'Tomás Vidal']);
  assert.equal(R.listarSinLeads.encontrados, 0);
  assert.match(R.listarSinLeads.instruccion, /existe en Meta y no tiene ningún lead/);
  assert.equal(R.listarComun.leads[0].telefono, '+34 644 555 666', 'las filas de siempre traen el teléfono');
});

test('8. el turno real de WhatsApp trae con qué contestarlo', () => {
  assert.ok(R.turno.m3.includes('buscar_leads'), 'el tercer mensaje solo');
  assert.match(R.turno.descripcionBuscar, /campaña/, 'y el modelo sabe que buscar_leads entiende una campaña');
  assert.ok(R.turno.m2.includes('listar_leads'), 'el segundo mensaje');
  assert.ok(R.turno.m3ConHilo.includes('listar_leads'), 'el tercero como seguimiento del segundo');
});

test('9. el doer le pasa a buscar_leads el canal por donde el código le escribe a la persona', () => {
  const doer = readFileSync(join(RAIZ, 'lib/mako-doer-in.ts'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(doer, /NOMBRES_DE_SIEMPRE\.has\(name\) \? runMakoTool\(name, input, \{ aPersona: ctxApi\.aPersona \}\)/);
  const crm = readFileSync(join(RAIZ, 'lib/api-mako/areas/crm.run.ts'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(crm, /buscar_leads: \{ leer: \(input, ctx\) => runMakoTool\('buscar_leads', input, \{ aPersona: ctx\.aPersona \}\) \}/);
});
