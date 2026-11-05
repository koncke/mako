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
//    ⚠️ UNDÉCIMA TANDA (11/10/2026, decisión 4 de la décima): sin zona ya NO es Ciudad de México. Es el ÚNICO default
//    de la casa, `ZONA_POR_DEFECTO` (Tijuana), el mismo de las pantallas: `zonaDelMotor` ES `zonaDeLoGuardado`.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  frenadoPorAntiBan, anotarEnCorrida, canalDelFreno, zonaValida, horaEnZona, dentroDeVentanaEn,
  type EnviadoEnCorrida,
} from '../lib/nutricion-grafo-motor';
import { ZONA_POR_DEFECTO, zonaDeLoGuardado } from '../lib/zona-negocio-reglas';

/** La zona que el motor usaba sin `mako.timezone` hasta la undécima tanda (`ZONA_SIN_CONFIGURAR`, ya borrada). */
const CDMX = 'America/Mexico_City';

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
  // 23/10/2026: `conEnvioRecienteDe` devuelve SIN_VENTANA (sin «Misma persona»); lo que frena es lo de la corrida.
  assert.match(PROC, /frenadoPorAntiBan\(insc\.lead_id, paso\.canal, conEnvioRecienteDe\(insc\.secuencia_id\), enviadoEnCorrida\)/);
  assert.match(PROC, /if \(estado === 'enviado' \|\| estado === 'simulado' \|\| estado === 'borrador'\) anotarEnCorrida\(enviadoEnCorrida, insc\.lead_id, paso\.canal\);/);
  // El set nace UNA vez por corrida, afuera del bucle de lotes: por lote se perdería entre lotes.
  const decl = PROC.indexOf('const enviadoEnCorrida: EnviadoEnCorrida = new Map();');
  const bucle = PROC.indexOf('while ((!cupoLleno() || sinTopeWa.length > 0) && rondas < 6)');
  assert.ok(decl > 0 && bucle > decl, 'el set de la corrida tiene que nacer antes del bucle de lotes');
});

test('la base ya no se lee para el freno (23/10/2026, sin «Misma persona»): queda el de la MISMA corrida, por canal', () => {
  // Hasta el 23/10/2026 `leadsConEnvioReciente` leía la base partida en dos: WhatsApp (con la excepción de la reunión
  // cercana) y email (con el masivo). Martín: «elimina "Misma persona"». Se fue la lectura y sus dos ventanas: el motor trae
  // un `SIN_VENTANA` y el freno sólo mira lo que salió en esta vuelta.
  assert.doesNotMatch(NUTRI, /leadsConEnvioReciente|HS_MIN_PREPARACION|HS_REUNION_CERCA|desdeCorto|qEspejo/, 'volvió la lectura de la ventana');
  assert.match(PROC, /const SIN_VENTANA: RecientesPorCanal = \{ whatsapp: new Set<number>\(\), email: new Set<number>\(\) \};/);
  assert.match(PROC, /const conEnvioRecienteDe = \(_secId: number\): RecientesPorCanal => SIN_VENTANA;/);
  // El freno de la corrida sigue siendo por canal: lo que salió por WhatsApp no frena al email, ni al revés.
  const vacia = { whatsapp: new Set<number>(), email: new Set<number>() };
  const corrida: EnviadoEnCorrida = new Map();
  anotarEnCorrida(corrida, 5, 'email');
  assert.equal(frenadoPorAntiBan(5, 'email', vacia, corrida), true);
  assert.equal(frenadoPorAntiBan(5, 'whatsapp', vacia, corrida), false, 'un email de esta vuelta frenaba al WhatsApp');
  // El masivo y la nutrición de afuera de la corrida ya no frenan al email (era parte de la ventana de la base).
  assert.doesNotMatch(NUTRI, /from\('email_broadcast_envios'\)\.select\('lead_id'\)\s*\.in\('lead_id', pend\)/);
});

test('los topes: el diario y el de la corrida son de WhatsApp; el email, con el suyo', () => {
  // Probado rompiéndolo (08/10/2026): `cupoLleno` contando `res.enviados + res.simulados` (los dos
  // canales, lo de antes) → 8 pasan / 1 falla (éste).
  // Desde la décima tanda (11/10/2026) los topes son del negocio (Configuraciones › Límites, `limites`):
  // lo cuida tests/automations-configuraciones.test.ts. Acá sigue lo de los canales.
  // Con la rampa del número desde el 5/11/2026 (`lineaWa`: los límites con el tope de hoy).
  assert.match(PROC, /const presupuesto = lineaWa\.dia - \(await enviosUltimas24h\('whatsapp'\)\);/);
  // El email, con SU tope (desde el 4/11/2026, con la rampa del dominio: `topeEmailHoy` sale de `limites.email`).
  assert.match(PROC, /topeEmailHoy - \(await enviosUltimas24h\('email'\)\)/);
  assert.match(PROC, /topeDeLineaDeHoy\(supabase, 'email', limites\.email,/);
  assert.match(PROC, /const cupoLleno = \(\): boolean => waEnCorrida >= cupo;/);
  assert.match(PROC, /if \(paso\.canal === 'email'\) emailsEnCorrida \+= 1; else waEnCorrida \+= 1;/);
  assert.match(PROC, /paso\.canal === 'email' && emailLleno\(\)/, 'un email que se pasa de su tope diario sale igual');
  const tope = cuerpo(NUTRI, 'async function enviosUltimas24h(', '\n}');
  assert.match(tope, /\.eq\('canal', canal\)/);
  // El tope de email de fábrica (100, o el env NUTRICION_MAX_EMAIL_POR_DIA) vive en lib/limites-envio.ts.
});

// ── La ventana, en la zona del negocio ──────────────────────────────────────

/** La regla de antes de la segunda tanda, literal: hora de México con un offset fijo de -6. */
const ventanaDeAntes = (ms: number): boolean => {
  const h = (new Date(ms).getUTCHours() - 6 + 24) % 24;
  return h >= 9 && h < 21;
};

test('sin zona, la ventana corre en la zona por defecto de la CASA (Tijuana), la misma de las pantallas', () => {
  // UNDÉCIMA TANDA (11/10/2026): era «sin zona, EXACTAMENTE Ciudad de México» (`ZONA_SIN_CONFIGURAR`), y ése era el
  // bug: el ws1 (Baja California, sin zona guardada, horario de 9 a 21) recibió el envío #22 a las 08:00 de Tijuana
  // mientras Configuraciones › Horario le mostraba otra zona. Ahora el motor usa `zonaDeLoGuardado` (el alias
  // `zonaDelMotor` se borró en el cierre de la ola 3).
  // Probado rompiéndolo (11/10/2026): `zonaDelMotor` volviendo a caer a Ciudad de México sin zona → cae éste (R1 en tests/undecima-motor-integracion.test.ts: 48 / 3).
  for (const nada of [null, undefined, '', 'Marte/Olympus', 42]) {
    assert.equal(zonaDeLoGuardado(nada), ZONA_POR_DEFECTO, `«${String(nada)}»: una zona rota o ausente no puede tirar la corrida`);
  }
  assert.equal(ZONA_POR_DEFECTO, 'America/Tijuana');
  // El alias `zonaDelMotor` se borró (cierre de la ola 3): el motor usa `zonaDeLoGuardado` por su nombre.
  const motor = leer('lib/nutricion-grafo-motor.ts').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(motor, /zonaDelMotor|ZONA_SIN_CONFIGURAR/, 'el motor volvió a tener su propia regla de zona');
  assert.match(motor, /const zona = zonaDeLoGuardado\(tz\);/, 'la fecha de la reunión no lee la zona como las pantallas');
  // Un alias es la MISMA zona que la pantalla (Cal.com guardó el alias viejo en el ws13).
  assert.equal(zonaDeLoGuardado('America/Buenos_Aires'), 'America/Argentina/Buenos_Aires');
  assert.equal(zonaValida('America/Argentina/Buenos_Aires'), true);
  // Y por qué importa: con la zona de antes, la misma mañana y la misma noche salían distinto en el ws1.
  let distintas = 0;
  for (const dia of ['2026-01-15', '2026-03-08', '2026-07-15', '2026-11-01']) {
    for (let h = 0; h < 24; h++) {
      const ms = Date.parse(`${dia}T${String(h).padStart(2, '0')}:30:00Z`);
      if (dentroDeVentanaEn(ms, zonaDeLoGuardado(null), 9, 21) !== ventanaDeAntes(ms)) distintas += 1;
    }
  }
  assert.ok(distintas >= 4 * 2, `la ventana sin zona sigue siendo la de Ciudad de México (${distintas} horas distintas)`);
});

test('Buenos Aires: la ventana corre con SU hora, no con la de México', () => {
  // Probado rompiéndolo (08/10/2026): `dentroDeVentana` con `TZ_OFFSET_MX` fijo (lo de antes) → los
  // asserts de Buenos Aires caen: 7 pasan / 2 fallan (éste y el del cambio de horario de abajo).
  const ba = 'America/Argentina/Buenos_Aires';
  // 00:30 UTC del 9/10 = 21:30 en Buenos Aires (fuera) y 18:30 en México (dentro).
  const t1 = Date.parse('2026-10-09T00:30:00Z');
  assert.equal(horaEnZona(t1, ba), 21);
  assert.equal(dentroDeVentanaEn(t1, ba, 9, 21), false, 'a Buenos Aires le salía a las 21:30');
  assert.equal(dentroDeVentanaEn(t1, CDMX, 9, 21), true);
  // 12:30 UTC = 9:30 en Buenos Aires (dentro) y 6:30 en México (fuera).
  const t2 = Date.parse('2026-10-08T12:30:00Z');
  assert.equal(dentroDeVentanaEn(t2, ba, 9, 21), true, 'a Buenos Aires le llegaba recién a las 12');
  assert.equal(dentroDeVentanaEn(t2, CDMX, 9, 21), false);
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

test('⚠️ sin horario NO hay ventana (sexta tanda): el motor corta sólo con el horario que puso el negocio', () => {
  // Decisión de Martín (09/10/2026): «Sin límite, editable». La ventana fija de 9 a 21 se fue; el
  // horario es opcional y apagado (lib/horario-envio.ts, tests/horario-envio.test.ts).
  // Probado rompiéndolo (09/10/2026): devolver `VENTANA_INICIO = 9` (y su uso) → cae éste.
  assert.doesNotMatch(NUTRI, /VENTANA_INICIO|VENTANA_FIN/, 'volvió la ventana fija de 9 a 21');
  assert.doesNotMatch(NUTRI, /TZ_OFFSET_MX/, 'la ventana fija de México volvió');
  // El corte, UNA vez por corrida, antes del bucle, con el horario leído ESTRICTO. (Undécima tanda, M3 f: fuera del
  // horario —o con el horario ilegible— ya no se corta TODO: corren sólo el carril del recordatorio y «MaKo en
  // WhatsApp», y sin ninguno de los dos, el corte de siempre. Ver tests/motor-carril-recordatorio.test.ts.)
  // 20/10/2026: cada automatización con SU horario (lib/config-automatizacion.ts): lo propio de todas en UNA lectura
  // estricta, y «fuera» es «todas cerradas» (las de a una van en `cerradas`). Sin horario en ninguna, no hay ventana.
  assert.match(PROC, /const horario = await horarioDeEnvio\(\);\s*if \(horario === 'ilegible' \|\| configs === 'ilegible'\) fueraDeHorario = 'horario-ilegible';/);
  // Revisión del 20/10/2026 (tests/automations-config-revision.test.ts): sin la zona, cerradas SÓLO las que tienen horario (la de los anuncios sigue).
  assert.match(PROC, /if \(conHorario && tz === ZONA_ILEGIBLE\) \{[\s\S]{0,500}?cerradas = cerradasAhora\(ids, configs, horario, Date\.now\(\), null\);\s*if \(!ids\.length \|\| cerradas\.size === ids\.length\) fueraDeHorario = 'zona-ilegible';/);
  assert.match(PROC, /cerradas = cerradasAhora\(ids, configs, horario, Date\.now\(\), tz\);[\s\S]{0,200}?if \(ids\.length \? cerradas\.size === ids\.length : !\(await dentroDeVentana\(horario\)\)\) fueraDeHorario = 'fuera-de-horario';/);
  assert.match(PROC, /if \(fueraDeHorario && !corrensFuera\.length\) return \{ \.\.\.res, saltado: fueraDeHorario \};/);
  assert.ok(PROC.indexOf('horarioDeEnvio()') < PROC.indexOf('while ((!cupoLleno()'));
  const h = cuerpo(NUTRI, 'async function horarioDeEnvio(', '\n}');
  assert.match(h, /horarioVigente\(await getSettingEstricto\(KEY_HORARIO_ENVIO\)\)/, '«no pude leer» no es «no hay horario»');
  assert.match(h, /catch \{ return 'ilegible'; \}/);
  // La zona (undécima tanda): sólo con horario, la del NEGOCIO por la lectura ESTRICTA de lib/timezone.ts (la misma
  // de las pantallas, con memo y sin red), y «no pude leer» corta la corrida como el horario ilegible.
  const v = cuerpo(NUTRI, 'async function dentroDeVentana(', '\n}');
  assert.match(v, /if \(!horario\) return true;/, 'sin horario, siempre');
  assert.match(v, /const tz = await zonaDeLaVentana\(\);\s*return tz !== ZONA_ILEGIBLE && dentroDelHorario\(Date\.now\(\), tz, horario\);/);
  const z = cuerpo(NUTRI, 'async function zonaDeLaVentana(', '\n}');
  assert.match(z, /return await zonaDelNegocioEstricta\(ws\);/);
  assert.match(z, /catch \{\s*return ZONA_ILEGIBLE;/, '«no pude leer» no es «no hay zona»');
  // 20/10/2026: la zona se lee si ALGUNA automatización tiene horario (el suyo o el del negocio).
  assert.match(PROC, /const tz = conHorario \? await zonaDeLaVentana\(\) : null;\s*if \(conHorario && tz === ZONA_ILEGIBLE\) \{/);
  assert.doesNotMatch(NUTRI, /getSetting\(KEY_TIMEZONE\)|zonaDelMotor\(/, 'el motor volvió a leer la zona por su cuenta');
  assert.doesNotMatch(PROC + v + z, /tzDeWorkspace/, 'la zona del motor es la estricta: un 5xx no es «sin zona»');
});

test('⚠️ el cupo de WhatsApp de las corridas del cron es el de la HORA de reloj, compartido', () => {
  // Con el tick de cada minuto, 6 por corrida serían 360 por hora desde la línea del cliente.
  // Probado rompiéndolo (09/10/2026): el cupo sin `- enLaHora` → cae éste.
  assert.match(PROC, /const enLaHora = opts\?\.cupoPorHora \? await enviosEnLaHora\('whatsapp'\) : 0;/);
  assert.match(PROC, /const cupo = Math\.max\(0, Math\.min\(limites\.wa\.hora - enLaHora, presupuesto\)\);/);
  const hora = cuerpo(NUTRI, 'async function enviosEnLaHora(', '\n}');
  assert.match(hora, /Math\.floor\(Date\.now\(\) \/ 3_600_000\) \* 3_600_000/, 'la hora de RELOJ, no 60 minutos móviles');
  assert.match(hora, /\.eq\('estado', 'enviado'\)/);
  assert.match(hora, /\.eq\('canal', canal\)/);
});
