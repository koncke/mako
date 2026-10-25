// =============================================================================
// UN goteo y UN tope por día para TODOS los canales, cada canal con su cuenta (24/10/2026, f20 y f21)
// =============================================================================
// La llamada con Leandro (24/10, docs/feedback-24-10.md): «En las configuraciones solamente está el goteo en WhatsApp y en
// email, pero no está en Instagram» (f20) y «que sea un solo botón para todos y listo» (f21). Martín, 24/10 23:00 por el Ops
// Center: «Uno solo: un solo interruptor de goteo (y uno de tope por día) que valga para todos los canales».
// Fija:
//   · la regla (lib/goteo.ts): cada canal cuenta lo suyo (`canalDelGoteo`, `claveDeGoteo`), y el freno de un MENSAJE es el
//     goteo de su canal más, salvo el email, la línea de WhatsApp (`sinLugarDelMensaje`);
//   · EL BUG que estaba: desde 629500245 (24/10) un email con su goteo frenado salía igual mientras quedara cupo de email
//     (`noGastaTurnoDeWhatsapp` lo dejaba pasar). `noGastaTurno` ya no deja pasar ningún mensaje;
//   · lo guardado (lib/config-automatizacion.ts): `goteoEmail` se lee como el goteo de todos si no hay otro, y no se guarda;
//   · el motor (lib/nutricion.ts): una lectura del uso, por canal; el freno, las frenadas y lo que sale, por canal;
//   · la pantalla (UN bloque «Todos los canales»), la API de MaKo y lo que MaKo dice de esa pantalla (el bloque de Instagram
//     que le nombró a Leandro no existía: f22).
// Correr: node --import tsx --test tests/goteo-un-interruptor.test.ts
// ROTURAS (24/10/2026, una por vez y restaurada; base 7 / 0): `sinLugarDelMensaje` sin el goteo del email → 6 / 1; el motor
// con el uso de WhatsApp para todos los canales → 6 / 1; lo que sale contado siempre en WhatsApp → 6 / 1; el saneo sin leer el
// `goteoEmail` de antes → 6 / 1; un bloque «WhatsApp» otra vez en la pantalla → 6 / 1; «Instagram» como lugar real de
// Configuraciones → 6 / 1; `noGastaTurno` dejando pasar un email (lo de antes) → 6 / 1.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CANALES_DEL_GOTEO, canalDelGoteo, claveDeGoteo, conEnvio, frenoDeGoteo, noGastaTurno, sinLugarDelMensaje, SIN_USO,
} from '../lib/goteo';
import { RANGOS_GOTEO, configParaGuardar, sanearConfigAutomatizacion } from '../lib/config-automatizacion';
import { LO_QUE_NO_ES_TARJETA, errorDeRespuestaEnEditar } from '../lib/flujo-ia-intencion';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const AHORA = Date.parse('2026-10-25T03:00:00Z');
const MIN = 60_000;

test('la regla: cada canal cuenta lo suyo, y el email sólo lo frena su goteo', () => {
  assert.deepEqual([...CANALES_DEL_GOTEO], ['whatsapp', 'email', 'instagram', 'messenger']);
  assert.equal(canalDelGoteo('instagram'), 'instagram');
  assert.equal(canalDelGoteo('messenger'), 'messenger', 'los dos de Meta van aparte: son cuentas distintas');
  assert.equal(canalDelGoteo(null), 'whatsapp');
  assert.equal(canalDelGoteo('otro'), 'whatsapp');
  assert.notEqual(claveDeGoteo('whatsapp', 289), claveDeGoteo('instagram', 289));
  // Uno cada 11 min: el WhatsApp acaba de salir; el DM de Instagram de la MISMA automatización no espera por él.
  const g = { minutos: 11 };
  const uso = new Map([[claveDeGoteo('whatsapp', 289), conEnvio(SIN_USO, AHORA - MIN)]]);
  const frena = (c: (typeof CANALES_DEL_GOTEO)[number]) => frenoDeGoteo(g, uso.get(claveDeGoteo(c, 289)) ?? SIN_USO, AHORA).frena;
  assert.equal(sinLugarDelMensaje('whatsapp', false, frena), true, 'el WhatsApp siguiente espera sus 11 min');
  assert.equal(sinLugarDelMensaje('instagram', false, frena), false, 'el DM esperaba por el WhatsApp');
  assert.equal(sinLugarDelMensaje('email', false, frena), false);
  // La línea de WhatsApp llena frena lo que no es email; al email no.
  const nada = () => false;
  assert.equal(sinLugarDelMensaje('whatsapp', true, nada), true);
  assert.equal(sinLugarDelMensaje(null, true, nada), true);
  assert.equal(sinLugarDelMensaje('email', true, nada), false);
});

test('EL BUG: un email con su goteo frenado ya no sale (la puerta de los mensajes no lo deja pasar)', () => {
  // Lo que hace el motor en cada mirada: frena si no hay lugar Y el nodo no corre sin cupo (`sigueSinCupo`).
  const g = { minutos: 10 };
  const uso = new Map([[claveDeGoteo('email', 7), conEnvio(SIN_USO, AHORA - 2 * MIN)]]);
  const frena = (c: (typeof CANALES_DEL_GOTEO)[number]) => frenoDeGoteo(g, uso.get(claveDeGoteo(c, 7)) ?? SIN_USO, AHORA).frena;
  const queda = sinLugarDelMensaje('email', false, frena) && !noGastaTurno('mensaje');
  assert.equal(queda, true, 'el email salía con su goteo frenado (desde 629500245 hasta el 24/10/2026)');
  // Lo que no es un mensaje sigue corriendo en el acto (la condición «Contestó» no se come un turno).
  for (const clase of ['condicion', 'esperar', 'ir_a', 'accion']) assert.equal(noGastaTurno(clase), true, clase);
});

test('lo guardado: UN goteo; el del email de antes vale para todos si no hay otro, y ya no se guarda aparte', () => {
  assert.deepEqual(sanearConfigAutomatizacion('{"goteo":{"minutos":11,"dia":65}}'), { goteo: { minutos: 11, dia: 65 } });
  assert.deepEqual(sanearConfigAutomatizacion('{"goteoEmail":{"minutos":5,"dia":300}}'), { goteo: { minutos: 5, dia: 300 } });
  assert.deepEqual(sanearConfigAutomatizacion('{"goteo":{"minutos":11},"goteoEmail":{"minutos":5}}'), { goteo: { minutos: 11 } }, 'con los dos, el de WhatsApp');
  const no = configParaGuardar({}, { goteoEmail: { dia: 30 } });
  assert.equal(no.ok, false);
  // El tope llega al más alto de las líneas (el de email): los WhatsApp los sigue cortando su línea.
  assert.equal(RANGOS_GOTEO.dia[1], 500);
  assert.equal(configParaGuardar({}, { goteo: { dia: 400 } }).ok, true);
  assert.equal(configParaGuardar({}, { goteo: { dia: 501 } }).ok, false);
  // Guardar de nuevo deja sólo el goteo único (lo de antes se va de la clave).
  const r = configParaGuardar(sanearConfigAutomatizacion('{"goteoEmail":{"minutos":5}}'), { goteo: { dia: 40 } });
  assert.ok(r.ok);
  assert.deepEqual(r.ok && JSON.parse(r.valor), { goteo: { minutos: 5, dia: 40 } });
});

test('el motor: una lectura del uso por canal; el freno, las frenadas y lo que sale, cada uno en su canal', () => {
  const motor = leer('lib/nutricion.ts');
  const i = motor.indexOf('async function usoDelGoteo(');
  const uso = motor.slice(i, motor.indexOf('\n}\n', i));
  assert.match(uso, /'id, secuencia_id, canal, created_at'/, 'el uso no lee el canal');
  assert.match(uso, /const clave = claveDeGoteo\(canalDelGoteo\(f\.canal\), Number\(f\.secuencia_id\)\);/, 'el uso se juntaba sin el canal');
  const ini = motor.indexOf('export async function procesarEnvios(');
  const proc = motor.slice(ini, motor.indexOf('\n}\n', ini));
  assert.match(proc, /frenoDeGoteo\(goteos\.get\(secId\), usoGoteo\.get\(claveDeGoteo\(canalDelGoteo\(canal\), secId\)\) \?\? SIN_USO, Date\.now\(\)\);/);
  assert.match(proc, /sinLugarDelMensaje\(canal, sinLugarEnLaLinea\(insc\.lead_id\), \(c\) => frenoGoteo\(insc\.secuencia_id, c\)\.frena\)/);
  assert.match(proc, /const clave = claveDeGoteo\(canalDelGoteo\(canal\), insc\.secuencia_id\);\s+const k = frenadasGoteo\.get\(clave\) \?\? 0;/, 'las frenadas no van por canal');
  assert.match(proc, /const clave = claveDeGoteo\(canalDelGoteo\(paso\.canal\), insc\.secuencia_id\);\s+usoGoteo\.set\(clave, conEnvio\(/, 'lo que sale no cuenta en su canal');
  assert.doesNotMatch(proc, /goteoEmail|goteosEmail|noGastaTurnoDeWhatsapp/);
});

test('la pantalla: UN bloque «Todos los canales» con Goteo y Tope por día, y nada por canal', () => {
  const p = sinComentarios(leer('app/automations/ConfigAutomatizacionPanel.tsx'));
  const aj = p.slice(p.indexOf('export function AjustesDeLaAutomatizacion('));
  assert.equal((aj.match(/<TarjetaOpciones /g) ?? []).length, 1, 'más de un bloque de goteo');
  assert.match(aj, /<GrupoOpciones titulo="Todos los canales" info=\{auto\.info\} primero \/>/);
  assert.doesNotMatch(p, /goteoEmail|data-goteo-canal|titulo="WhatsApp"|titulo="Email"|titulo="Instagram"/);
  const info = /export const INFO_TODOS_LOS_CANALES = '([^']+)'/.exec(p)?.[1] ?? '';
  assert.match(info, /WhatsApp, email, Instagram y Messenger/);
  assert.match(info, /cada canal cuenta sus mensajes/);
});

test('la API de MaKo y lo que MaKo dice de esa pantalla: un goteo, en «Todos los canales»; un bloque de un canal no existe', () => {
  assert.doesNotMatch(sinComentarios(leer('lib/api-mako/areas/chatbot.def.ts')), /goteoEmail/);
  assert.doesNotMatch(sinComentarios(leer('lib/api-mako/areas/chatbot.run.ts')), /goteoEmail|goteo_email/);
  assert.match(LO_QUE_NO_ES_TARJETA, /el bloque «Todos los canales»/);
  const sin = { esPregunta: false, charlaConTextos: false };
  assert.equal(errorDeRespuestaEnEditar('que salgan de a uno', 'Va en Configuraciones › Todos los canales › Goteo.', sin), null);
  assert.match(String(errorDeRespuestaEnEditar('que salgan de a uno en Instagram', 'Va en Configuraciones › Instagram › Goteo.', sin)), /«Configuraciones › Instagram» no existe/);
});

test('la medición de antes de juntarlos queda en el repo (sólo lectura)', () => {
  const m = leer('scripts/medir-goteo-un-interruptor.mts');
  assert.match(m, /SÓLO LECTURA/);
  assert.doesNotMatch(m, /\.(insert|update|upsert|delete)\(/, 'la medición escribe');
});
