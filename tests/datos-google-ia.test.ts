// =============================================================================
// Datos de Google Calendar → SÓLO a un proveedor de IA que no entrena.
// =============================================================================
// Decisión de Martín (07/10/2026), al arrancar la verificación de la app de Google: el
// Uso Limitado prohíbe que los datos de la API terminen entrenando modelos, y el plan
// gratis de Gemini entrena con lo que recibe. La política de /privacidad lo promete.
//
// Lo que fija este archivo, de abajo hacia arriba:
//   1. qué proveedores pueden recibirlos (lib/datos-google-ia.ts);
//   2. que TODA operación del registro cuyo runner llega a la agenda lo DECLARE
//      (`datosDeGoogle`), incluso de rebote — una marca a mano que nadie verifica es
//      la etiqueta `pii` otra vez, que se pintaba y no gateaba nada;
//   3. que el loop de herramientas, el doer de WhatsApp y la extracción de reuniones
//      apliquen el filtro.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { REGISTRO } from '../lib/api-mako/registro';
import { puedeRecibirDatosDeGoogle, herramientasConDatosDeGoogle, HERRAMIENTAS_CON_DATOS_DE_GOOGLE } from '../lib/datos-google-ia';
import { causaDelFallo } from '../lib/fallo-ia-texto';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Las exportaciones de lib/google-calendar.ts, TODAS clasificadas. Una nueva sin
 * clasificar hace fallar el test: es la pregunta «¿esto le devuelve al modelo algo de la
 * agenda de alguien?», y no tiene default.
 */
const DEVUELVEN_DATOS = [
  'buscarEventosGoogle', 'invitadosDeReunionPorFecha', 'duracionDeReunionEnAgendaMin',
  'moverEventoDeReunion', 'crearEventoDeReunion', 'proximasReunionesCon', 'choquesEnAgenda',
  'horariosLibresDeGoogle',
];
const NO_DEVUELVEN_DATOS = [
  // configuración y conexión
  'GCAL_SCOPE_LECTURA', 'GCAL_SCOPE_ESCRITURA', 'GCAL_SCOPE', 'googleRedirectUri',
  'guardarRefreshTokenGoogle', 'desconectarGoogleCalendar', 'googleCalendarConectado',
  // de QUIÉN es la agenda y si se puede escribir: la misma cuenta que da el scope `email`
  'googleCalendarDueno', 'emailDelCalendario', 'permisoCalendarioGoogle',
  // la zona horaria del calendario: es la del negocio, no un dato de un tercero
  'tzDelCalendarioGoogle',
];

test('los proveedores que pueden recibir datos de Google son los que no entrenan', () => {
  for (const p of ['groq', 'openai', 'anthropic']) assert.equal(puedeRecibirDatosDeGoogle(p), true, p);
  for (const p of ['gemini', 'mistral', 'cerebras', 'openrouter', '']) assert.equal(puedeRecibirDatosDeGoogle(p), false, p);
});

test('cada exportación de lib/google-calendar.ts está clasificada', () => {
  const src = leer('lib/google-calendar.ts');
  const exportadas = [...src.matchAll(/^export (?:async )?(?:function|const) ([A-Za-z_]\w*)/gm)].map((m) => m[1]);
  const clasificadas = new Set([...DEVUELVEN_DATOS, ...NO_DEVUELVEN_DATOS]);
  const sinClasificar = exportadas.filter((e) => !clasificadas.has(e));
  assert.deepEqual(sinClasificar, [], `clasificalas en este test: ${sinClasificar.join(', ')}`);
});

/** Los runners de un `.run.ts`: clave de primer nivel (2 espacios) → su cuerpo. */
function runners(src: string): Map<string, string> {
  const out = new Map<string, string>();
  const claves = [...src.matchAll(/^ {2}([a-z][a-z0-9_]*): \{/gm)];
  claves.forEach((m, i) => out.set(m[1], src.slice(m.index!, claves[i + 1]?.index ?? src.length)));
  return out;
}

/** Las funciones auxiliares del archivo que llegan a la agenda (un nivel de rebote). */
function auxiliaresConDatos(src: string, base: readonly string[]): string[] {
  const out: string[] = [];
  const defs = [...src.matchAll(/^(?:async )?function (\w+)\(|^const (\w+) = (?:async )?\(/gm)];
  defs.forEach((m) => {
    // Hasta SU cierre (la primera llave en la columna 0), no hasta la próxima función:
    // la última auxiliar antes de los runners se tragaba el objeto entero.
    const fin = src.slice(m.index!).search(/\n\};?\n/);
    const cuerpo = src.slice(m.index!, fin < 0 ? src.length : m.index! + fin);
    if (base.some((f) => new RegExp(`\\b${f}\\(`).test(cuerpo))) out.push(m[1] ?? m[2]);
  });
  return out;
}

/** Los `case` de lib/mako-tools.ts que llegan a la agenda: los llama `runMakoTool`. */
function casosDeMakoToolsConDatos(): string[] {
  const src = sinComentarios(leer('lib/mako-tools.ts'));
  const casos = [...src.matchAll(/^ {4}case '([a-z_]+)': \{/gm)];
  const rebote = ['buscarReunionesAutomatico', ...DEVUELVEN_DATOS];
  return casos
    .filter((m, i) => rebote.some((f) => src.slice(m.index!, casos[i + 1]?.index ?? src.length).includes(`${f}(`)))
    .map((m) => m[1]);
}

// Probado rompiéndolo (07/10/2026), una rotura por vez: sacando `datosDeGoogle` de
// reuniones_lead caen 2 (éste la nombra: llega de rebote, por mako-tools →
// auto-reuniones, y el de abajo); de horarios_libres_dia, 2; de proponer_mover_reunion, 2.
test('toda operación cuyo runner llega a la agenda de Google lo declara', () => {
  const defPorId = new Map(REGISTRO.map((d) => [d.id, d]));
  const viaMakoTools = casosDeMakoToolsConDatos();
  assert.ok(viaMakoTools.includes('reuniones_lead'), 'el detector de mako-tools no ve reuniones_lead: se rompió el parser');
  const faltan: string[] = [];
  const dir = join(RAIZ, 'lib/api-mako/areas');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.run.ts'))) {
    const src = sinComentarios(readFileSync(join(dir, f), 'utf8').replace(/\r\n/g, '\n'));
    const conDatos = [...DEVUELVEN_DATOS, ...auxiliaresConDatos(src, DEVUELVEN_DATOS)];
    for (const [id, cuerpo] of runners(src)) {
      const directo = conDatos.some((fn) => new RegExp(`\\b${fn}\\(`).test(cuerpo));
      const deRebote = viaMakoTools.some((t) => cuerpo.includes(`runMakoTool('${t}'`));
      if ((directo || deRebote) && !defPorId.get(id)?.datosDeGoogle) faltan.push(`${f} → ${id}`);
    }
  }
  assert.deepEqual(faltan, [], 'falta `datosDeGoogle: true` en su .def.ts');
});

test('las herramientas marcadas incluyen las de la agenda, y se buscan por nombre', () => {
  for (const id of ['reuniones_lead', 'horarios_libres_dia', 'reuniones_agenda_lead', 'proponer_agendar_agenda', 'proponer_mover_reunion']) {
    assert.ok(HERRAMIENTAS_CON_DATOS_DE_GOOGLE.has(id), id);
  }
  assert.deepEqual(herramientasConDatosDeGoogle([{ name: 'buscar_leads' }, { name: 'reuniones_agenda_lead' }]), ['reuniones_agenda_lead']);
  assert.deepEqual(herramientasConDatosDeGoogle([{ name: 'buscar_leads' }]), []);
});

// --- El filtro, donde corre cada pedido -------------------------------------

/** El cuerpo de una función, hasta la siguiente `export` de primer nivel. */
function cuerpoDe(src: string, firma: string): string {
  const ini = src.indexOf(firma);
  assert.ok(ini >= 0, `no encontré ${firma}`);
  const fin = src.indexOf('\nexport ', ini + firma.length);
  return src.slice(ini, fin < 0 ? src.length : fin);
}

// Probado rompiéndolo: borrando la guarda de chatCheapTools cae el primero (1 fallo);
// sacando el `.filter` de la cascada, el segundo (1); sacándolo de la red de plataforma
// del doer, el tercero (1); y sin `apartadas` en causaDelFallo, el cuarto (1).
test('chatCheapTools corta ANTES del primer pedido si el proveedor entrena', () => {
  const cuerpo = sinComentarios(cuerpoDe(leer('lib/ai-cheap.ts'), 'export async function chatCheapTools('));
  const guarda = cuerpo.search(/if \(deGoogle\.length && !puedeRecibirDatosDeGoogle\(p\.nombre\)\) throw new ProveedorQueEntrenaError/);
  const primerFetch = cuerpo.indexOf('fetch(');
  assert.ok(guarda >= 0, 'falta la guarda');
  assert.ok(primerFetch < 0 || guarda < primerFetch, 'la guarda tiene que ir antes del primer pedido');
});

test('la cascada de herramientas ni prueba los que entrenan si hay datos de Google', () => {
  const cuerpo = sinComentarios(cuerpoDe(leer('lib/ai-cheap.ts'), 'export async function chatCheapToolsCascade('));
  assert.match(cuerpo, /const pedidos = \(opts\.provs \?\? CASCADA_TOOLS\)\.filter\(\(p\) => !conGoogle \|\| puedeRecibirDatosDeGoogle\(p\)\)/);
});

test('el doer de WhatsApp filtra las cuentas del cliente Y la red de plataforma', () => {
  const src = sinComentarios(leer('lib/mako-doer-in.ts'));
  assert.match(src, /const cands = \[pin\.provider, 'groq', 'openai'\]\s*\.filter\(\(p, i, a\) => a\.indexOf\(p\) === i\)\s*\.filter\(\(p\) => !conDatosDeGoogle \|\| puedeRecibirDatosDeGoogle\(p\)\)/);
  assert.match(src, /const distintoPrimero = \[[\s\S]{0,200}?\]\.filter\(\(r\) => !conDatosDeGoogle \|\| puedeRecibirDatosDeGoogle\(r\.provider\)\)/);
  assert.match(src, /causaDelFallo\(errsIA, nKeys, \{[^}]*apartadas: ee\?\.apartadas/);
});

test('si apartamos su única key por datos de Google y la red no contesta, es nuestro', () => {
  assert.equal(causaDelFallo(['plataforma/groq: HTTP 500'], 1, { probadas: 0, contestaron: 0, apartadas: 1 }), 'fallo_nuestro');
  // Sin apartadas, cero probadas sigue siendo «no hay keys que anden».
  assert.equal(causaDelFallo([], 1, { probadas: 0, contestaron: 0 }), 'sin_keys');
});

// --- La extracción de reuniones ------------------------------------------------

// Probado rompiéndolo: armando `listaParticipantes` desde `participantes` (sin filtrar)
// cae (1 fallo); sacando `delCalendario: true` del mapeo, también (1).
test('los invitados que vienen de Google Calendar no entran al prompt de la extracción', () => {
  const src = sinComentarios(leer('lib/plan-fathom.ts'));
  const nucleo = cuerpoDe(src, 'export async function extraerTareasDeTexto(');
  assert.match(nucleo, /const paraElPrompt = participantes\.filter\(\(p\) => !p\.delCalendario\);/);
  assert.match(nucleo, /const listaParticipantes = paraElPrompt\.length\s*\?\s*paraElPrompt\.map/);
  // y la lista ENTERA sigue llegando a quien resuelve el dueño en código
  assert.match(nucleo, /coerceCandidatas\(obj, proyectos, yo, participantes\)/);
  assert.match(src, /delCal\.map\(\(i\) => \(\{ nombre: i\.nombre, email: i\.email, delCalendario: true as const \}\)\)/);
});
