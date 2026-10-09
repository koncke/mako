// =============================================================================
// El freno anti-ban y los topes POR CANAL, y la ventana horaria en la zona del NEGOCIO
// =============================================================================
// Segunda tanda del chatbot (08/10/2026), decisiones 5 y 6 de docs/chatbot-flujo-ramas-diseno.md:
//
//  · el freno de 20 h, el tope diario y el de la corrida miran SÓLO WhatsApp (con la excepción de
//    la reunión cercana); el email tiene su propio freno de 20 h y su propio tope diario. Contados
//    juntos, el ejemplo de Martín —WhatsApp y email desde el mismo CRON— salía con un día de
//    diferencia, y un email se comía el cupo de la línea;
//  · el freno de la base se lee UNA vez por lote, así que además se mira lo que salió EN ESTA
//    corrida (`enviadoEnCorrida`): sin eso, dos hilos de WhatsApp del mismo lead salían juntos;
//  · la ventana 9-21 va en `mako.timezone`; sin zona, Ciudad de México (lo de `TZ_OFFSET_MX`).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  frenadoPorAntiBan, anotarEnCorrida, canalDelFreno, zonaDelMotor, zonaValida, horaEnZona, dentroDeVentanaEn,
  ZONA_SIN_CONFIGURAR, type EnviadoEnCorrida,
} from '../lib/nutricion-grafo-motor';

const raiz = join(__dirname, '..');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (r: string): string => readFileSync(join(raiz, r), 'utf8').replace(/\r\n/g, '\n');
const NUTRI = sinComentarios(leer('lib/nutricion.ts'));
const cuerpo = (src: string, abre: string, cierra: string): string => {
  const i = src.indexOf(abre);
  assert.ok(i >= 0, `no encontré «${abre}»`);
  const f = src.indexOf(cierra, i + abre.length);
  assert.ok(f > i, `no encontré el cierre de «${abre}»`);
  return src.slice(i, f);
};
const PROC = cuerpo(NUTRI, 'export async function procesarEnvios(', '\nexport async function pausarPorRespuesta(');

// ── El freno: por canal y mirando las DOS cosas ─────────────────────────────

test('el freno de 20 h es POR CANAL: un email no frena al WhatsApp ni al revés', () => {
  // Probado rompiéndolo (08/10/2026): `frenadoPorAntiBan` sin el canal (mirando
  // `deLaBase.whatsapp` siempre) → 7 pasan / 2 fallan (éste y el de la corrida).
  const base = { whatsapp: new Set([1]), email: new Set([2]) };
  const vacio: EnviadoEnCorrida = new Map();
  assert.equal(frenadoPorAntiBan(1, 'whatsapp', base, vacio), true, 'le salió un WhatsApp hace poco');
  assert.equal(frenadoPorAntiBan(1, 'email', base, vacio), false, 'un WhatsApp reciente frenaba al email');
  assert.equal(frenadoPorAntiBan(2, 'whatsapp', base, vacio), false, 'un email reciente frenaba al WhatsApp');
  assert.equal(frenadoPorAntiBan(2, 'email', base, vacio), true);
  // Un canal que no es email frena como WhatsApp (los pasos de antes no traen otro).
  assert.equal(canalDelFreno(undefined), 'whatsapp');
  assert.equal(canalDelFreno('email'), 'email');
});

test('⚠️ la guarda mira la BASE y lo que salió EN ESTA CORRIDA (dos hilos del mismo lead)', () => {
  // Probado rompiéndolo (08/10/2026): `frenadoPorAntiBan` sin `enCorrida` → 8 pasan / 1 falla
  // (éste); sin `deLaBase` → 7 pasan / 2 fallan (éste y el de arriba).
  const base = { whatsapp: new Set<number>(), email: new Set<number>() };
  const corrida: EnviadoEnCorrida = new Map();
  assert.equal(frenadoPorAntiBan(7, 'whatsapp', base, corrida), false, 'sin nada, sale');
  anotarEnCorrida(corrida, 7, 'whatsapp');
  assert.equal(frenadoPorAntiBan(7, 'whatsapp', base, corrida), true, 'el segundo hilo de WhatsApp salía en la misma vuelta');
  assert.equal(frenadoPorAntiBan(7, 'email', base, corrida), false, 'el WhatsApp de esta corrida no frena al email');
  base.whatsapp.add(8);
  assert.equal(frenadoPorAntiBan(8, 'whatsapp', base, corrida), true, 'lo de la base sigue frenando');
});

test('el motor consulta el freno con las dos fuentes y anota cada envío o borrador de la corrida', () => {
  // Probado rompiéndolo (08/10/2026): borrando el `anotarEnCorrida(...)` del motor → 8 pasan / 1 falla.
  assert.match(PROC, /frenadoPorAntiBan\(insc\.lead_id, paso\.canal, conEnvioReciente, enviadoEnCorrida\)/);
  assert.match(PROC, /if \(estado === 'enviado' \|\| estado === 'simulado' \|\| estado === 'borrador'\) anotarEnCorrida\(enviadoEnCorrida, insc\.lead_id, paso\.canal\);/);
  // El set nace UNA vez por corrida, afuera del bucle de lotes: por lote se perdería entre lotes.
  const decl = PROC.indexOf('const enviadoEnCorrida: EnviadoEnCorrida = new Map();');
  const bucle = PROC.indexOf('while ((!cupoLleno() || sinTopeWa.length > 0) && rondas < 6)');
  assert.ok(decl > 0 && bucle > decl, 'el set de la corrida tiene que nacer antes del bucle de lotes');
});

test('la lectura de la base parte el freno en dos: WhatsApp (con la reunión cercana) y email (con el masivo)', () => {
  const f = cuerpo(NUTRI, 'async function leadsConEnvioReciente(', '\nasync function leadIdsDe(');
  assert.match(f, /Promise<RecientesPorCanal>/);
  assert.match(f, /\.eq\('canal', canal\)/, 'la nutrición se cuenta por canal');
  assert.match(f, /porVentana\(fuera, desde, qNutri\('whatsapp'\), 'nutricion_envios'\)/);
  assert.match(f, /porVentana\(enPrep, desdeCorto, qNutri\('whatsapp'\), 'nutricion_envios'\)/, 'la excepción de la reunión cercana es del WhatsApp');
  assert.match(f, /porVentana\(leadIds, desde, qNutri\('email'\), 'nutricion_envios'\)/);
  // El masivo cuenta SÓLO para el email: el bloque del WhatsApp no lo nombra.
  const wa = f.slice(f.indexOf('const resultados = await Promise.all(['));
  assert.doesNotMatch(wa, /email_broadcast_envios/, 'un email masivo frenaba al WhatsApp');
  assert.match(f, /return \{ whatsapp: set, email \};/);
});

test('los topes: el diario y el de la corrida son de WhatsApp; el email, con el suyo', () => {
  // Probado rompiéndolo (08/10/2026): `cupoLleno` contando `res.enviados + res.simulados` (los dos
  // canales, lo de antes) → 8 pasan / 1 falla (éste).
  assert.match(PROC, /const presupuesto = MAX_POR_DIA - \(await enviosUltimas24h\('whatsapp'\)\);/);
  assert.match(PROC, /MAX_EMAIL_POR_DIA - \(await enviosUltimas24h\('email'\)\)/);
  assert.match(PROC, /const cupoLleno = \(\): boolean => waEnCorrida >= cupo;/);
  assert.match(PROC, /if \(paso\.canal === 'email'\) emailsEnCorrida \+= 1; else waEnCorrida \+= 1;/);
  assert.match(PROC, /paso\.canal === 'email' && emailLleno\(\)/, 'un email que se pasa de su tope diario sale igual');
  const tope = cuerpo(NUTRI, 'async function enviosUltimas24h(', '\n}');
  assert.match(tope, /\.eq\('canal', canal\)/);
  assert.match(NUTRI, /const MAX_EMAIL_POR_DIA = Number\(process\.env\.NUTRICION_MAX_EMAIL_POR_DIA \?\? '\d+'\);/);
});

// ── La ventana, en la zona del negocio ──────────────────────────────────────

/** La regla de antes, literal: hora de México con un offset fijo de -6. */
const ventanaDeAntes = (ms: number): boolean => {
  const h = (new Date(ms).getUTCHours() - 6 + 24) % 24;
  return h >= 9 && h < 21;
};

test('sin zona, la ventana es EXACTAMENTE la de antes (Ciudad de México), hora por hora', () => {
  // Probado rompiéndolo (08/10/2026): `ZONA_SIN_CONFIGURAR = 'America/Tijuana'` (el `TZ_DEFAULT`
  // de la casa) → 8 pasan / 1 falla (éste: las horas de Tijuana no son las de México).
  assert.equal(zonaDelMotor(null), ZONA_SIN_CONFIGURAR);
  assert.equal(zonaDelMotor(''), ZONA_SIN_CONFIGURAR);
  assert.equal(zonaDelMotor('Marte/Olympus'), ZONA_SIN_CONFIGURAR, 'una zona rota no puede tirar la corrida');
  assert.equal(zonaValida('America/Argentina/Buenos_Aires'), true);
  let distintas = 0;
  // Cuatro días: dos lejos de cualquier cambio de hora y los dos días del cambio de EE. UU.
  for (const dia of ['2026-01-15', '2026-03-08', '2026-07-15', '2026-11-01']) {
    for (let h = 0; h < 24; h++) {
      const ms = Date.parse(`${dia}T${String(h).padStart(2, '0')}:30:00Z`);
      if (dentroDeVentanaEn(ms, zonaDelMotor(null), 9, 21) !== ventanaDeAntes(ms)) distintas += 1;
    }
  }
  assert.equal(distintas, 0, 'los negocios sin zona cambiaron de horario sin que nadie lo pidiera');
});

test('Buenos Aires: la ventana corre con SU hora, no con la de México', () => {
  // Probado rompiéndolo (08/10/2026): `dentroDeVentana` con `TZ_OFFSET_MX` fijo (lo de antes) → los
  // asserts de Buenos Aires caen: 7 pasan / 2 fallan (éste y el del cambio de horario de abajo).
  const ba = 'America/Argentina/Buenos_Aires';
  // 00:30 UTC del 9/10 = 21:30 en Buenos Aires (fuera) y 18:30 en México (dentro).
  const t1 = Date.parse('2026-10-09T00:30:00Z');
  assert.equal(horaEnZona(t1, ba), 21);
  assert.equal(dentroDeVentanaEn(t1, ba, 9, 21), false, 'a Buenos Aires le salía a las 21:30');
  assert.equal(dentroDeVentanaEn(t1, ZONA_SIN_CONFIGURAR, 9, 21), true);
  // 12:30 UTC = 9:30 en Buenos Aires (dentro) y 6:30 en México (fuera).
  const t2 = Date.parse('2026-10-08T12:30:00Z');
  assert.equal(dentroDeVentanaEn(t2, ba, 9, 21), true, 'a Buenos Aires le llegaba recién a las 12');
  assert.equal(dentroDeVentanaEn(t2, ZONA_SIN_CONFIGURAR, 9, 21), false);
});

test('el día del cambio de horario la ventana sigue a la zona (Tijuana, 1/11/2026)', () => {
  // Argentina y México no cambian de hora: el caso es Tijuana, que el 1/11 pasa de UTC-7 a UTC-8.
  const tj = 'America/Tijuana';
  const sabado = Date.parse('2026-10-31T16:30:00Z');   // 9:30 PDT
  const domingo = Date.parse('2026-11-01T16:30:00Z');  // 8:30 PST
  assert.equal(horaEnZona(sabado, tj), 9);
  assert.equal(horaEnZona(domingo, tj), 8);
  assert.equal(dentroDeVentanaEn(sabado, tj, 9, 21), true);
  assert.equal(dentroDeVentanaEn(domingo, tj, 9, 21), false, 'el domingo del cambio salía a las 8');
});

test('el motor lee la zona UNA vez por corrida, antes de cortar por la ventana, y sin salir a la red', () => {
  assert.equal((PROC.match(/getSetting\(KEY_TIMEZONE\)/g) ?? []).length, 1, 'la zona se lee una vez');
  assert.match(PROC, /!dentroDeVentana\(zonaDelMotor\(await getSetting\(KEY_TIMEZONE\)\.catch\(\(\) => null\)\)\)/);
  assert.doesNotMatch(PROC, /tzDeWorkspace|tzActual\(/, '`tzDeWorkspace` averigua por la red: el cron no se cuelga por una zona');
  assert.ok(PROC.indexOf('getSetting(KEY_TIMEZONE)') < PROC.indexOf('while ((!cupoLleno()'));
  const v = cuerpo(NUTRI, 'function dentroDeVentana(', '\n}');
  assert.match(v, /dentroDeVentanaEn\(Date\.now\(\), tz, VENTANA_INICIO, VENTANA_FIN\)/);
  assert.doesNotMatch(NUTRI, /TZ_OFFSET_MX/, 'la ventana fija de México volvió');
});
