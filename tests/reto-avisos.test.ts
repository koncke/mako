// LOS AVISOS DEL RETO: A LA HORA QUE ELIGIÓ, Y POR WHATSAPP (20/11/2026).
//
// La auditoría del 20/11 (wa-01, wa-06, d24-02/03/04, R57-04/05/11, D1-04): lo único que salía era un correo a las 10:00 de Argentina
// para todos. Con una hora de las 12:00 en adelante, el día todavía no estaba abierto a las 10:00 y el correo llegaba un día tarde;
// no había WhatsApp, ni aviso en la app, ni recordatorio de la noche, ni el mensaje de Martín a quien abandona. Ahora una vuelta cada
// hora (app/api/cron/reto-avisos) manda lo de la maqueta: lib/reto/avisos.ts decide, lib/reto/avisos-salida.ts manda.
//
// PROBADO ROMPIÉNDOLO (20/11/2026), cada rotura por separado y vuelta atrás:
//   R1 sin `!adelantado` NO da rojo, y es correcto: con el `diaAbierto` de hoy el adelanto vale desde el inicio del reto, así que un
//      día adelantado nunca «se acaba de abrir» y la ventana (R2) ya lo deja afuera. La guarda queda por si `diaAbierto` pasa a
//      contar desde el último día abierto (la auditoría, d24-01): ahí sí haría falta.
//   R2 sin la ventana: un día abierto hace rato también se avisa              → falla «abierto hace rato»
//   R3 el WhatsApp sale sin haber elegido la hora                             → falla «sin la hora elegida»
//   R4 con BAJA sigue el WhatsApp de Martín                                   → falla «BAJA»
//   R5 el aviso de la noche sin «una vez por noche»                           → falla «cada hora, siete días»
//   R6 el abandono sin el tope de una vez por semana                          → falla «el abandono»
//   R7 la vuelta manda ANTES de guardar lo que va a salir                     → falla «primero se guarda»
//   R8 el WhatsApp para todos los negocios (sin `retoPorWhatsApp`)            → falla «primero se guarda»
//   R9 el cron vuelve a las 10:00 (`0 13 * * *`)                              → falla «cada hora»
//   R10 la hora o BAJA se toman en cualquier línea (no sólo la de MaKo)       → falla «la hora del día 2»
//   R11 la respuesta del reto lee la base con cualquier mensaje               → falla «la hora del día 2»
//   R12 lo del reto también pasa al bot (contestaría dos veces)               → falla «la hora del día 2»
//   R13 se guarda una hora que no es del reto                                 → falla «la hora del día 2»
//   X1 tocar una hora la guarda otra vez (sin que ella escriba)               → falla «la tarjeta de la hora»
//   X2 sin releer al volver de WhatsApp (la confirmación no aparece)          → falla «la tarjeta de la hora»
//   X3 el mensaje escrito con 9:00 fijo                                       → falla «la tarjeta de la hora»
//   F1 el correo con los días genéricos (sin su funnel)                       → falla «el correo del día lleva lo de SU funnel»
//   F2 `correoDelDia` ignora los días que recibe                              → falla «el correo del día lleva lo de SU funnel»
// La zona de la persona (`reto.estado.zona`, 20/11), cada una → falla «la noche y el WhatsApp de Martín, a la hora de SU zona»:
//   Z1 la hora de la noche y del mediodía en Argentina · Z2 «una noche por día» con el día de Argentina · Z3 los 21 días desde el
//   inicio contados en Argentina · Z4 el reloj de la hora ignora la zona · Z5 el del día también · Z6 el saludo del WhatsApp con la
//   hora de Argentina.
// El día 7 (20/11, d24-16 y R57-10: su audio, a Martín), cada una → falla «el día 7»:
//   P1 cualquier mensaje, no sólo un audio · P2 desde el día 6 · P3 con la prueba ya respondida · P4 sin «uno solo» (`cierre`)
//   P5 el reclamo no se lee de vuelta (`leerAvisos`) · P6 el «¡Gracias!» aunque a Martín no le llegó · P7 sin soltar el reclamo si
//   no salió · P8 el audio al grupo de SuperAdmin como imagen · P9 un audio no llega a mirarse.
// La noche con lo que de verdad pasó (20/11, d24-04), cada una → falla «la noche, con lo que de verdad pasó»:
//   A1 no relee antes de «Te falta» · A2 relee y no vuelve a decidir · A3 lo leído no entra como hecho · A4 lo leído pisa la fecha
//   de lo ya guardado · A5 los atendidos sin la automatización hecha · A6 los atendidos todas las noches · A7 «atendió a 0
//   clientes» · A8 sin guardar que ya se dijo · A9 `leerAvisos` pierde `atendio` · A10 las 0:00 de Argentina para todos
//   · A11 los grupos cuentan como clientes · A12 «Atiende MaKo» no se abre con el link.
// «No lo sé» no es «falta» (20/11, el ajuste del Cerebro a d24-04), cada una → falla «lo que no se puede leer no se nombra»:
//   N1 lo ilegible cuenta como falta (`paraDecidir` no lo saca) · N2 sin poder leer nada, «Te falta» igual · N3 la vuelta lee
//   con la sesión (`sinSesion` fuera) · N4 la app y la foto se intentan sin la persona · N5 una lectura que falla da «falta»
//   (`catch` → null) · N6 un conteo que falla da «falta» (`contar` → 0) · N7 el símbolo cuenta como hecha (`!!v`)
//   · N8 «no aplica» (sin la persona) en la app da «falta».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HORAS_WA, diaAbierto, type EstadoReto } from '../lib/reto/dias';
import {
  queMandar, leerAvisos, horaEnSuZona, diaEnSuZona, whatsappDelDia, whatsappDeAbandono, avisoDelDia, avisoDeLaNoche, esBaja, CLAVE_AVISOS,
  horaDelMensaje, respuestaDeLaHora, esElAudioDelCierre, audioParaMartin, GRACIAS_DIA_7, LEIDO_DIA_7,
  conLoLeido, inicioDelDia, quiereAtendidos, conAtendidos, avisoDeAtendidos, paraDecidir,
  type AvisosReto,
} from '../lib/reto/avisos';
import { fuenteSinComentarios } from './_fuente-sin-comentarios';

const h = (s: string) => Date.parse(s);
const HORA = 3_600_000;
// Empezó el 19/11 a las 12:00 de Argentina (15:00 UTC).
const INICIO = '2026-11-19T15:00:00.000Z';
const reto = (x: Partial<EstadoReto> = {}): EstadoReto => ({ v: 1, inicio: INICIO, adelantado: 1, hechas: {}, ...x });
const nuevos = (e: EstadoReto): AvisosReto => leerAvisos(null, e);
const activo = (ahora: number) => ({ ultimaVisita: ahora, porWhatsApp: true });

test('el día se avisa cuando se abre, a la hora que eligió: no a las 10:00 para todos', () => {
  const e = reto({ horaWa: '18:00' });
  // El bug: a las 10:00 del 20/11 el día 2 todavía no se abrió (se abre a las 18:00): no hay nada que avisar.
  assert.equal(queMandar({ e, a: nuevos(e), ahora: h('2026-11-20T13:02:00Z'), ...activo(0) }).manana, undefined);
  const p = queMandar({ e, a: nuevos(e), ahora: h('2026-11-20T21:02:00Z'), ...activo(0) });
  assert.deepEqual(p.manana, { dia: 2, whatsapp: true }, 'a las 18:02 de Argentina, el día 2, con su WhatsApp');
  assert.equal(p.avisos.dia, 2);
  assert.equal(queMandar({ e, a: p.avisos, ahora: h('2026-11-20T22:02:00Z'), ...activo(0) }).manana, undefined, 'una vez');
});

test('sin la hora elegida: a las 9:00, en la app y por correo, sin WhatsApp (la maqueta lo manda sólo con la hora)', () => {
  const e = reto();
  const p = queMandar({ e, a: nuevos(e), ahora: h('2026-11-20T12:02:00Z'), ...activo(0) });
  assert.deepEqual(p.manana, { dia: 2, whatsapp: false });
  const sinV2 = queMandar({ e: reto({ horaWa: '9:00' }), a: nuevos(e), ahora: h('2026-11-20T12:02:00Z'), ultimaVisita: 0, porWhatsApp: false });
  assert.deepEqual(sinV2.manana, { dia: 2, whatsapp: false }, 'sin el número del V2 (o fuera de la revisión), tampoco');
});

test('un día adelantado no se avisa: lo abrió ella; y uno abierto hace rato tampoco (llegaría tarde)', () => {
  const ad = reto({ adelantado: 2 });
  const p = queMandar({ e: ad, a: nuevos(ad), ahora: h('2026-11-20T12:02:00Z'), ...activo(0) });
  assert.equal(p.manana, undefined, 'un día adelantado');
  assert.equal(p.avisos.dia, 2, 'pero queda dado por avisado');
  const e = reto({ horaWa: '9:00' });
  const tarde = queMandar({ e, a: nuevos(e), ahora: h('2026-11-21T20:02:00Z'), ...activo(0) });
  assert.equal(tarde.manana, undefined, 'abierto hace rato: el día 3 se abrió a las 9:00 y son las 17:02');
  assert.equal(tarde.avisos.dia, 3);
});

test('desde el correo de antes: lo que ya avisó (`avisado`) no se repite', () => {
  const e = reto({ avisado: 2 });
  assert.equal(leerAvisos(null, e).dia, 2);
  assert.equal(queMandar({ e, a: leerAvisos(null, e), ahora: h('2026-11-20T12:02:00Z'), ...activo(0) }).manana, undefined);
  assert.deepEqual(leerAvisos('{"v":1,"dia":4,"noche":20412,"baja":"2026-11-21T10:00:00.000Z"}', e), { v: 1, dia: 4, noche: 20412, baja: '2026-11-21T10:00:00.000Z' });
  assert.deepEqual(leerAvisos('basura', null), { v: 1, dia: 1 });
});

/** La vuelta de cada hora, a los :02, durante días: lo que sale y a qué hora de SU zona (de Argentina sin zona), y en UTC. */
function simular(e: EstadoReto, dias: number, o: { ultimaVisita?: number | null; porWhatsApp?: boolean; a?: AvisosReto } = {}) {
  let a = o.a ?? nuevos(e);
  const salio: Array<{ que: string; dia: number; hora: number; fecha: number; utc: number; wa?: boolean }> = [];
  const desde = Date.parse(INICIO) + 2 * 60_000;
  for (let t = desde; t < desde + dias * 24 * HORA; t += HORA) {
    const p = queMandar({ e, a, ahora: t, ultimaVisita: o.ultimaVisita === undefined ? t : o.ultimaVisita, porWhatsApp: o.porWhatsApp ?? true });
    const cuando = { hora: Math.floor(horaEnSuZona(t, e.zona)), fecha: diaEnSuZona(t, e.zona), utc: new Date(t).getUTCHours() };
    if (p.manana) salio.push({ que: 'manana', dia: p.manana.dia, ...cuando, wa: p.manana.whatsapp });
    if (p.noche) salio.push({ que: 'noche', dia: p.noche.dia, ...cuando });
    if (p.abandono) salio.push({ que: 'abandono', dia: p.abandono.dia, ...cuando, wa: p.manana?.whatsapp });
    a = p.avisos;
  }
  return salio;
}

test('cada hora, siete días: con cada hora elegida, del día 2 al 7 un aviso por día, a ESA hora, cuando se abre el día', () => {
  for (const hora of HORAS_WA) {
    const e = reto({ horaWa: hora });
    const manana = simular(e, 9).filter((x) => x.que === 'manana');
    assert.deepEqual(manana.map((x) => x.dia), [2, 3, 4, 5, 6, 7], `con las ${hora}`);
    const hh = Number(hora.split(':')[0]);
    for (const x of manana) assert.equal(x.hora, hh, `el día ${x.dia} sale a las ${hora}`);
    const ab = manana.map((x) => x.fecha);
    assert.equal(new Set(ab).size, 6, 'un aviso por día de calendario');
  }
  // La noche: con lo de cada día sin hacer, a las 20:00 de los días 1 a 6 (el 7 no: mañana no se abre otro), una vez por noche.
  const noche = simular(reto({ horaWa: '9:00' }), 9).filter((x) => x.que === 'noche');
  assert.deepEqual(noche.map((x) => x.hora), [20, 20, 20, 20, 20, 20]);
  assert.equal(new Set(noche.map((x) => x.fecha)).size, 6);
  // Con todo hecho, nada a la noche.
  const hechas: Record<string, string> = {};
  for (const d of [1, 2, 3, 4, 5, 6, 7]) for (const id of ['offer', 'funnel', 'app', 'extension', 'integraciones', 'perfil', 'contactos', 'automatizacion', 'calendar', 'spy', 'web', 'carrusel', 'guion', 'personaje', 'clip', 'copilot', 'semana']) hechas[`${d}:${id}`] = INICIO;
  assert.equal(simular(reto({ horaWa: '9:00', hechas }), 9).filter((x) => x.que === 'noche').length, 0);
});

test('el aviso coincide con `diaAbierto`: sale en la vuelta en que el día se abre, nunca antes', () => {
  const e = reto({ horaWa: '15:00' });
  const a = nuevos(e);
  const t = h('2026-11-20T18:02:00Z'); // 15:02 de Argentina
  assert.equal(diaAbierto(e, t), 2);
  assert.equal(diaAbierto(e, t - HORA), 1);
  assert.deepEqual(queMandar({ e, a, ahora: t, ...activo(0) }).manana, { dia: 2, whatsapp: true });
  assert.equal(queMandar({ e, a, ahora: t - HORA, ...activo(0) }).manana, undefined);
});

test('con la hora de las 20:00, el día nuevo sale a las 20:00 y no le «falta» nada esa noche', () => {
  const salio = simular(reto({ horaWa: '20:00' }), 9);
  assert.deepEqual(salio.filter((x) => x.que === 'manana').map((x) => x.hora), [20, 20, 20, 20, 20, 20]);
  const noches = salio.filter((x) => x.que === 'noche');
  assert.ok(noches.every((x) => x.fecha === diaEnSuZona(Date.parse(INICIO))), 'sólo la primera noche, antes del día 2');
});

test('el abandono: a los 2 días sin entrar, al mediodía, uno por semana, nunca con el de la mañana a la vez', () => {
  const e = reto({ horaWa: '9:00' });
  const nunca = Date.parse(INICIO);
  const ab = simular(e, 10, { ultimaVisita: nunca }).filter((x) => x.que === 'abandono');
  assert.equal(ab.length, 2, 'el 21/11 y el 28/11');
  assert.equal(ab[1].fecha - ab[0].fecha, 7);
  assert.ok(ab.every((x) => x.hora === 12 && x.dia === 1), 'al mediodía, y «quedó en el día 1»');
  // Con la hora de las 12:00 coinciden: sale el del día y el de Martín en la vuelta siguiente.
  const doce = simular(reto({ horaWa: '12:00' }), 4, { ultimaVisita: nunca }).filter((x) => x.que === 'abandono');
  assert.equal(doce.length, 1);
  assert.equal(doce[0].hora, 13);
  assert.equal(simular(e, 10, { ultimaVisita: null }).filter((x) => x.que === 'abandono').length, 0, 'sin saber cuándo entró, no');
  assert.equal(simular(e, 10, { ultimaVisita: nunca, porWhatsApp: false }).filter((x) => x.que === 'abandono').length, 0, 'sin el WhatsApp del V2, no');
  assert.equal(simular(e, 10).filter((x) => x.que === 'abandono').length, 0, 'entrando cada día, nunca');
});

test('la noche y el WhatsApp de Martín, a la hora de SU zona (`reto.estado.zona`); sin zona, la de Argentina', () => {
  const nunca = Date.parse(INICIO);
  // [zona, la mañana de las 9:00, las 20:00 y el mediodía, en UTC]. México: UTC−6 (sin horario de verano desde 2022). Madrid: UTC+1
  // en noviembre. Medido en UTC, no con el reloj de avisos.ts: así un reloj que ignore la zona no se da la razón a sí mismo.
  const casos: Array<[string | undefined, number, number, number]> = [[undefined, 12, 23, 15], ['America/Mexico_City', 15, 2, 18], ['Europe/Madrid', 8, 19, 11]];
  for (const [zona, manana, noche, mediodia] of casos) {
    const donde = zona ?? 'sin zona (Argentina)';
    const salio = simular(reto({ horaWa: '9:00', ...(zona ? { zona } : {}) }), 10, { ultimaVisita: nunca });
    assert.deepEqual(salio.filter((x) => x.que === 'manana').map((x) => x.utc), Array(6).fill(manana), `la mañana, ${donde}`);
    assert.deepEqual(salio.filter((x) => x.que === 'noche').map((x) => x.utc), Array(6).fill(noche), `las 20:00, una por noche, ${donde}`);
    assert.deepEqual(salio.filter((x) => x.que === 'abandono').map((x) => x.utc), [mediodia, mediodia], `el mediodía, uno por semana, ${donde}`);
  }
  // Los 21 días se cuentan en SU zona: empezó a las 22:00 de México, que en Argentina ya es la 01:00 del día siguiente.
  const tarde = reto({ horaWa: '9:00', zona: 'America/Mexico_City', inicio: '2026-11-20T04:00:00.000Z' });
  const deMartin = (iso: string) => queMandar({ e: tarde, a: nuevos(tarde), ahora: h(iso), ultimaVisita: Date.parse(tarde.inicio), porWhatsApp: true }).abandono;
  assert.ok(deMartin('2026-12-10T18:02:00Z'), 'el día 21 en México, al mediodía: todavía');
  assert.equal(deMartin('2026-12-11T18:02:00Z'), undefined, 'el 22 en México ya no (contado en Argentina serían 21)');
  // El saludo del WhatsApp de la mañana («¡Buenas tardes»), con la hora de SU zona; y ningún reloj de Argentina fijo en los avisos.
  assert.ok(fuenteSinComentarios('lib/reto/avisos-salida.ts').includes('whatsappDelDia(v2.nombre, dia, Math.floor(horaEnSuZona(ahora, e.zona)))'));
  assert.doesNotMatch(fuenteSinComentarios('lib/reto/avisos.ts'), /HORA_AR|horaAr|diaAr/);
});

test('BAJA: ningún WhatsApp más del reto (la app y el correo siguen)', () => {
  const e = reto({ horaWa: '9:00' });
  const a: AvisosReto = { ...nuevos(e), baja: '2026-11-19T20:00:00.000Z' };
  const salio = simular(e, 10, { ultimaVisita: Date.parse(INICIO), a });
  assert.equal(salio.filter((x) => x.que === 'abandono').length, 0);
  assert.ok(salio.filter((x) => x.que === 'manana').every((x) => x.wa === false));
  assert.equal(salio.filter((x) => x.que === 'manana').length, 6);
  assert.ok(esBaja('BAJA') && esBaja(' baja. ') && esBaja('Baja!'));
  assert.ok(!esBaja('no me des de baja') && !esBaja('bajá el precio'));
});

test('los textos de la maqueta', () => {
  assert.equal(whatsappDelDia('Antonio Pérez', 2, 9), '¡Buen día, Antonio! Ya está tu día 2 del reto: conecta todo: la app, la extensión y tus integraciones. Te espera en MaKo.');
  assert.match(whatsappDelDia('Antonio', 7, 18), /^¡Buenas tardes, Antonio! Ya está tu día 7 del reto: tu Marketing CoPilot\. Te espera en MaKo\.$/);
  assert.match(whatsappDelDia('', 3, 20), /^¡Buenas noches! Ya está tu día 3/);
  assert.doesNotMatch(whatsappDelDia('Antonio', 3, 9), /https?:/, 'sin link');
  assert.deepEqual(avisoDelDia(4), { titulo: 'Día 4 de tu reto', texto: 'Copia lo que le funciona a tu competencia.' });
  assert.deepEqual(avisoDeLaNoche('Carga tus clientes en el CRM'), { titulo: 'Te falta: carga tus clientes en el CRM', texto: 'Mañana te lo dejo primero.' });
  assert.equal(whatsappDeAbandono('Antonio', 3), 'Hola, Antonio. Soy Martín, el creador de MaKo. Vi que tu reto quedó en el día 3. ¿Te trabaste en algo?\n\nSi prefieres que no te escriba, respóndeme BAJA.');
});

test('primero se guarda lo que va a salir, en su propia clave; el WhatsApp por el chat privado y sólo a la revisión', () => {
  const s = fuenteSinComentarios('lib/reto/avisos-salida.ts');
  const guarda = s.indexOf('cambiarSettingSi(CLAVE_AVISOS, crudoAvisos, JSON.stringify(plan.avisos))');
  const primerEnvio = Math.min(...['crearNotificacion(', 'enviarPush(', 'avisarDePlataforma(', 'enviarAPersonaMaKo(v2'].map((x) => s.indexOf(x, s.indexOf('export async function avisarDelReto'))));
  assert.ok(guarda > 0 && primerEnvio > guarda, 'primero se guarda (compare-and-set) y recién después se manda');
  assert.match(s, /if \(!gane\) continue;/);
  assert.doesNotMatch(s, /setSetting\(CLAVE_RETO|\.update\(\{ value/, 'nunca reescribe `reto.estado` (pisaba las tareas marcadas en el medio)');
  assert.match(s, /export const retoPorWhatsApp = \(ws: number\): boolean => PARA_TODOS \|\| WS_REVISION_V2\.includes\(ws\);/);
  assert.match(s, /porWhatsApp: !!v2 && retoPorWhatsApp\(ws\)/);
  assert.match(s, /v\?\.v2 === true && v\.verificado === true/, 'sólo al número verificado por el V2');
  assert.doesNotMatch(s, /enviarAlGrupoMaKo|enviarAGrupoJid|enviarTextoVozMaKo/, 'nunca a un grupo: por la puerta de los DM');
  assert.equal(CLAVE_AVISOS, 'reto.avisos');
});

test('el correo del día lleva lo de SU funnel (los días 4 a 6 cambian con lo que eligió en Funnel Coach)', async () => {
  const { correoDelDia, diasDelReto, DIAS_RETO } = await import('../lib/reto/dias');
  const suyo = diasDelReto('organico')[4].tareas[0].titulo;
  assert.notEqual(suyo, DIAS_RETO[4].tareas[0].titulo, 'el funnel de Instagram cambia el carrusel del día 5');
  assert.ok(correoDelDia(5, 'https://app/x', diasDelReto('organico')).cuerpo.includes(suyo));
  assert.match(fuenteSinComentarios('lib/reto/avisos-salida.ts'), /correoDelDia\(dia, link, diasDelReto\(funnelDe\(valor\(ws, KEY_PLAN_FUNNEL\)\)\)\)/);
});

test('cada hora, a los :02; el cron de las 10:00 ya no manda el reto', () => {
  assert.match(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'), /"path": "\/api\/cron\/reto-avisos",\s*"schedule": "2 \* \* \* \*"/);
  const r = fuenteSinComentarios('app/api/cron/reto-avisos/route.ts');
  assert.match(r, /const auth = checkCronAuth\(req\);\n  if \(auth\) return auth;/);
  assert.match(r, /await avisarDelReto\(\{ enSeco \}\)/);
  assert.doesNotMatch(fuenteSinComentarios('app/api/cron/aviso-fin-de-prueba/route.ts'), /reto/i);
});

test('la hora del día 2 sale de SU mensaje, y MaKo le contesta (D1-12, wa-02)', () => {
  assert.equal(horaDelMensaje('Hola MaKo, prefiero que me escribas a las 18:00 sobre el reto.', HORAS_WA), '18:00');
  assert.equal(horaDelMensaje('escríbeme a las 8', HORAS_WA), '8:00');
  assert.equal(horaDelMensaje('Prefiero que me escribas a las 12.00 hs', HORAS_WA), '12:00');
  assert.equal(horaDelMensaje('prefiero que me escribas a las 11:00', HORAS_WA), null, 'una hora que no es del reto');
  assert.equal(horaDelMensaje('¿Qué le está funcionando a mi competencia?', HORAS_WA), null);
  assert.equal(respuestaDeLaHora('Antonio', '18:00'), '¡Hecho, Antonio! Cada día te escribo a las 18:00 con tu día del reto. Guárdame en tus contactos para que no se pierda nada.');
  const r = fuenteSinComentarios('lib/reto/respuestas.ts');
  assert.match(r, /if \(!baja && !hora && !esAudio && !competencia\) return null;/, 'sin uno de sus mensajes (la hora, BAJA, un audio o la pregunta del día 4) no toca la base');
  assert.match(r, /if \(!quien \|\| !\(esNombreDeCanal\(instancia\) \|\| instancia === quien\.linea\)\) return null;/, 'sólo en una línea de MaKo');
  assert.match(r, /\.ilike\('value', '%"v2":true%'\)\.ilike\('value', '%"verificado":true%'\)/, 'sólo quien verificó por el V2');
  assert.match(r, /cambiarSettingSi\(CLAVE_RETO, esperado, JSON\.stringify\(\{ \.\.\.base, horaWa: hora \}\)\)/, 'la hora, sin pisar lo marcado en el medio');
  assert.match(r, /cambiarSettingSi\(CLAVE_AVISOS, crudo, JSON\.stringify\(\{ \.\.\.a, baja: new Date\(\)\.toISOString\(\) \}\)\)/);
  assert.doesNotMatch(r, /setSetting\(/);
  const hook = fuenteSinComentarios('app/api/webhooks/evolution/route.ts');
  const v2 = hook.indexOf('const v2 = await responderPedidoV2(instance, m)');
  const reto = hook.indexOf('const reto = await responderAlReto(instance, m)');
  const bot = hook.indexOf('manejarEntranteBot(instance, m)');
  assert.ok(v2 > 0 && reto > v2 && bot > reto, 'el pedido del código primero, después el reto, y lo demás al bot');
  assert.match(hook.slice(reto, bot), /deVerificacion\.add\(m\);[\s\S]*if \(reto\.responder\) after\(reto\.responder\);/, 'lo del reto no pasa al bot (no contesta dos veces)');
});

test('la tarjeta de la hora (día 2): tocar una hora sólo la elige; se guarda cuando ella escribe, y queda la confirmación (wa-08, D1-12)', () => {
  const c = fuenteSinComentarios('app/second-brain/reto/ChatDelReto.tsx');
  assert.match(c, /onHora=\{\(h\) => setHora\(h\)\}/, 'tocar una hora no la guarda');
  assert.doesNotMatch(c, /setHora\(h\); void hacer\(\{ accion: 'hora'/);
  assert.match(c, /onConfirmarHora=\{\(\) => \{ if \(ensayo\.activo\) void hacer\(\{ accion: 'hora', hora: horaWa \}\); \}\}/, 'sólo en el ensayo, que no tiene WhatsApp');
  for (const t of ['Una más: dile a MaKo a qué hora te escribe por WhatsApp sobre el reto. Le escribes tú primero, así WhatsApp no frena sus mensajes.',
    '¿A qué hora te escribe MaKo sobre el reto?', 'Al confirmar se abre tu WhatsApp con el mensaje ya escrito: lo mandas tú y MaKo te contesta.',
    'MaKo te escribe cada día a las {hora}.', '✓ MaKo te escribe cada día a las {guardada}, por WhatsApp.', 'Confirmar y abrir WhatsApp']) {
    assert.ok(c.includes(t), `falta «${t}»`);
  }
  assert.match(c, /const link = linkWaMe\(linea, mensajeEscrito\(p, hora\)\);/, 'el mensaje escrito con la hora elegida, no con 9:00');
  assert.match(c, /window\.addEventListener\('focus', alVolver\);/, 'al volver de WhatsApp se relee');
  assert.doesNotMatch(c, /no está conectada/, 'sin número no es «la línea está caída»');
});

test('el día 7: su audio le llega a Martín, la prueba queda respondida y MaKo le contesta «¡Gracias!» (d24-16, R57-10)', () => {
  const e = reto({ horaWa: '9:00' });
  const a = nuevos(e);
  const dia7 = h('2026-11-25T12:30:00Z'); // el 25/11 a las 9:30 de Argentina: el día 7 (empezó el 19/11)
  assert.equal(diaAbierto(e, dia7), 7);
  assert.equal(esElAudioDelCierre({ e, a, ahora: dia7, esAudio: true }), true);
  assert.equal(esElAudioDelCierre({ e, a, ahora: dia7, esAudio: false }), false, 'sólo un audio (la prueba: «mándale un audio»)');
  assert.equal(esElAudioDelCierre({ e, a, ahora: h('2026-11-24T12:30:00Z'), esAudio: true }), false, 'el día 6, todavía no');
  assert.equal(esElAudioDelCierre({ e: { ...e, pruebas: { 7: { en: INICIO } } }, a, ahora: dia7, esAudio: true }), false, 'ya respondida');
  assert.equal(esElAudioDelCierre({ e, a: { ...a, cierre: INICIO }, ahora: dia7, esAudio: true }), false, 'a Martín le llega uno solo');
  assert.equal(leerAvisos(JSON.stringify({ v: 1, dia: 7, cierre: INICIO }), e).cierre, INICIO, 'el reclamo se lee de vuelta');
  // Los textos: el de la maqueta (`d7`), el de la tarjeta y el que le llega a Martín.
  assert.equal(GRACIAS_DIA_7, '¡Gracias! Ya se lo pasé a Martín.');
  assert.equal(LEIDO_DIA_7, 'Le pasé tu audio a Martín.');
  assert.equal(audioParaMartin('Ana López', 3, true), 'Día 7 del reto: Ana López (ws 3) te cuenta cómo le fue.');
  assert.match(audioParaMartin('', 3, false), /^Día 7 del reto: Alguien \(ws 3\).*No pude bajar su audio/);
  // El orden: se reclama antes (uno solo), sale a Martín, y recién entonces la prueba y el «¡Gracias!»; si no salió, se suelta.
  const r = fuenteSinComentarios('lib/reto/respuestas.ts');
  assert.match(r, /if \(!baja && !hora && !esAudio && !competencia\) return null;/, 'un audio llega a mirarse');
  const reclama = r.indexOf('cambiarSettingSi(CLAVE_AVISOS, crudo, reclamo)');
  const responde = r.indexOf('responder: async () => {', reclama);
  const aMartin = r.indexOf('await enviarAlGrupoSuperAdmin(audioParaMartin(', responde);
  const noSalio = r.indexOf('if (!r.ok) {', aMartin);
  const prueba = r.indexOf('await pruebaRespondida(ws, 7, LEIDO_DIA_7)', aMartin);
  const gracias = r.indexOf('enviarAPersonaMaKo(destino, GRACIAS_DIA_7)', aMartin);
  assert.ok(reclama > 0 && responde > reclama && aMartin > responde, 'se reclama ANTES de mandar');
  assert.ok(noSalio > aMartin && prueba > noSalio && gracias > prueba, 'si no salió, nada más; si salió, la prueba y el «¡Gracias!»');
  const siNo = r.slice(noSalio, prueba);
  assert.ok(siNo.includes('cambiarSettingSi(CLAVE_AVISOS, reclamo, crudo ?? JSON.stringify(a))') && siNo.includes('return;'), 'se suelta el reclamo y no se le contesta');
  // El grupo de SuperAdmin manda el audio como audio (antes, todo lo que no era PDF salía como imagen).
  const g = fuenteSinComentarios('lib/mako-grupo.ts');
  assert.ok(g.includes("const esAudio = !!o.archivo?.mime.startsWith('audio/');"));
  assert.ok(g.includes("const partes: PartePreparada[] | null = o.archivo && esAudio\n    ? [{ tipo: 'texto', texto }, { tipo: 'audio', base64: o.archivo.base64, mime: o.archivo.mime }]"));
});

test('la noche, con lo que de verdad pasó: relee lo hecho antes de «Te falta…», y «MaKo atendió a N clientes por ti» una vez (d24-04)', async () => {
  const { DIAS_RETO } = await import('../lib/reto/dias');
  const { vistaDeLink, rutaChatsDeVista } = await import('../lib/chats-links');
  // 1) Relee: el día 1 a las 20:02, sin nada guardado, «le falta» lo primero; con lo que las señales leen, no le falta nada.
  const e = reto({ horaWa: '9:00' });
  const a = nuevos(e);
  const noche1 = h('2026-11-19T23:02:00Z');
  assert.ok(queMandar({ e, a, ahora: noche1, ...activo(noche1) }).noche, 'sin releer, «Te falta…»');
  const leidas = Object.fromEntries(DIAS_RETO[0].tareas.map((t) => [`1:${t.id}`, 'Leído.']));
  const leido = conLoLeido(e, leidas, noche1);
  assert.equal(queMandar({ e: leido, a, ahora: noche1, ...activo(noche1) }).noche, undefined, 'con lo leído, no le falta nada');
  assert.equal(conLoLeido(e, {}, noche1), e, 'sin nada leído, el mismo estado');
  const guardado = reto({ hechas: { '1:offer': INICIO } });
  assert.equal(conLoLeido(guardado, { '1:offer': 'Leído.', '1:funnel': 'Leído.' }, noche1).hechas['1:offer'], INICIO, 'lo ya guardado no se toca');
  // 2) Los atendidos: con la automatización hecha y la noche, una vez, con el número de hoy (0: nada; sin poder contar: nada).
  const conAuto = reto({ horaWa: '9:00', hechas: { '3:automatizacion': INICIO } });
  const noche3 = h('2026-11-21T23:02:00Z'); // el 21/11 a las 20:02 de Argentina, día 3
  const p = queMandar({ e: conAuto, a: nuevos(conAuto), ahora: noche3, ...activo(noche3) });
  assert.ok(p.noche);
  assert.equal(quiereAtendidos(conAuto, nuevos(conAuto), p), true);
  assert.equal(quiereAtendidos(e, a, queMandar({ e, a, ahora: noche3, ...activo(noche3) })), false, 'sin la automatización hecha, no');
  assert.equal(quiereAtendidos(conAuto, { ...nuevos(conAuto), atendio: 1 }, p), false, 'una sola vez');
  const con4 = conAtendidos(p, 4);
  assert.equal(con4.atendidos, 4);
  assert.equal(con4.avisos.atendio, p.avisos.noche, 'se guarda el día: no se repite');
  assert.equal(conAtendidos(p, 0), p, 'con 0, nada (otra noche)');
  assert.equal(conAtendidos(p, null), p, 'sin poder contar, nada');
  assert.equal(leerAvisos(JSON.stringify({ v: 1, dia: 3, atendio: 20413 }), conAuto).atendio, 20413, 'se lee de vuelta');
  assert.deepEqual(avisoDeAtendidos(4), { titulo: 'MaKo atendió a 4 clientes por ti', texto: 'Míralo en Chats, en «Atiende MaKo».' });
  assert.equal(avisoDeAtendidos(1).titulo, 'MaKo atendió a 1 cliente por ti');
  // 3) «Hoy» es el de SU zona.
  assert.equal(new Date(inicioDelDia(noche3)).toISOString(), '2026-11-21T03:00:00.000Z', 'Argentina');
  assert.equal(new Date(inicioDelDia(noche3, 'America/Mexico_City')).toISOString(), '2026-11-21T06:00:00.000Z', 'México');
  assert.equal(new Date(inicioDelDia(noche3, 'Europe/Madrid')).toISOString(), '2026-11-21T23:00:00.000Z', 'Madrid: ya es el 22');
  // 4) La vuelta: relee y vuelve a decidir ANTES de guardar; cuenta los chats de hoy sin los grupos; avisa primero lo que hizo MaKo.
  const v = fuenteSinComentarios('lib/reto/avisos-salida.ts');
  const relee = v.indexOf('if (plan.noche || plan.abandono) {\n        const lectura = await runWithWorkspace(ws, () => leerTareasDelReto(e, ahora, { sinSesion: true })).catch(() => null);');
  const decide = v.indexOf('plan = queMandar({ e: paraDecidir(e, lectura, ahora), ...datos });');
  const cuenta = v.indexOf('if (quiereAtendidos(leido, a, plan)) plan = conAtendidos(plan, await atendidosHoy(ws, leido, ahora));');
  const guarda = v.indexOf('if (!hayQueGuardar(a, plan.avisos)) continue;');
  assert.ok(relee > 0 && decide > relee && cuenta > decide && guarda > cuenta, 'relee, decide y cuenta antes de guardar');
  for (const x of [".eq('workspace_id', ws)", ".eq('from_me', true)", ".eq('automatico', true)", 'new Date(inicioDelDia(ahora, e.zona)).toISOString()', ".not('chat_jid', 'like', '%@g.us')"]) assert.ok(v.includes(x), x);
  const noche = v.slice(v.indexOf('if (plan.noche) {'));
  assert.ok(noche.indexOf('avisoDeAtendidos(plan.atendidos)') > 0 && noche.indexOf('avisoDeAtendidos(plan.atendidos)') < noche.indexOf('avisoDeLaNoche('), 'primero lo que hizo MaKo');
  assert.equal(rutaChatsDeVista('mako'), '/chats?vista=mako');
  assert.equal(vistaDeLink('mako'), 'mako', '«Atiende MaKo» se abre con el link');
});

test('lo que no se puede leer no se nombra: «Te falta…» sólo con lo que falta de verdad, y si todo es ilegible, nada (d24-04)', async () => {
  // El día 2 a las 20:02, con el día 1 hecho: le quedan la app, la extensión, las integraciones y la foto.
  const hechas: Record<string, string> = { '1:onboarding': INICIO, '1:offer': INICIO, '1:funnel': INICIO };
  const e = reto({ horaWa: '9:00', hechas });
  const a = nuevos(e);
  const noche2 = h('2026-11-20T23:02:00Z');
  const sin = (lectura: Parameters<typeof paraDecidir>[1]) => queMandar({ e: paraDecidir(e, lectura, noche2), a, ahora: noche2, ...activo(noche2) }).noche;
  const todo = sin({ hechas: {}, noSeLeen: [] });
  const { DIAS_RETO: dias } = await import('../lib/reto/dias');
  const app = dias[1].tareas.find((t) => t.id === 'app')!.titulo;
  assert.equal(todo?.tarea, app, 'todo leído y nada hecho: «Te falta…» la primera, la app');
  // La app no se puede leer sin la persona: la noche nombra la siguiente que falta de verdad, nunca la app.
  const n1 = sin({ hechas: {}, noSeLeen: ['2:app'] });
  assert.ok(n1 && n1.tarea !== app && n1.dia === 2, 'nombra otra, no la que no sabe');
  // La app y la foto no se leen, la extensión y las integraciones están hechas: no le falta nada que se sepa → no sale.
  assert.equal(sin({ hechas: { '2:extension': 'Leído.', '2:integraciones': 'Leído.' }, noSeLeen: ['2:app', '2:perfil'] }), undefined, 'todo lo que queda es ilegible: nada');
  assert.equal(sin(null), undefined, 'sin poder leer nada, nada');
  // Lo ilegible vale sólo para decidir: lo que se cuenta como hecho (la automatización de los atendidos) es lo leído de verdad.
  assert.equal(conLoLeido(e, {}, noche2).hechas['2:app'], undefined);
  // Las señales: «no se pudo leer» es un tercer estado, no un «no».
  const sg = fuenteSinComentarios('lib/reto/senales.ts');
  assert.ok(sg.includes("export const PIDEN_LA_PERSONA: readonly string[] = ['2:app', '2:perfil'];"));
  assert.ok(sg.includes('[k, o.sinSesion && PIDEN_LA_PERSONA.includes(k) ? NO_SE_LEE : await LECTURAS[k](e).catch((): Leida => NO_SE_LEE)]'), 'sin la persona, ni se intenta; y un error no es «falta»');
  assert.ok(sg.includes("hechas: Object.fromEntries(leidas.filter((x): x is readonly [string, string] => typeof x[1] === 'string')),"), 'el símbolo no cuenta como hecha');
  assert.ok(sg.includes('noSeLeen: leidas.filter(([, v]) => v === NO_SE_LEE).map(([k]) => k),'));
  assert.ok(sg.includes('return error ? null : count ?? 0;\n  } catch { return null; }'), 'un conteo que falla no es 0');
  assert.ok(sg.includes('if (!a.aplica) return NO_SE_LEE;'), 'la app sin la persona: no se sabe');
  const lecturas = sg.slice(sg.indexOf('const LECTURAS: Record<string'), sg.indexOf('export const TAREAS_CON_LECTURA'));
  assert.ok(!lecturas.includes('catch { return null; }'), 'ninguna lectura convierte un error en «falta»');
  assert.ok(sg.includes('return (await leerTareasDelReto(e, ahora)).hechas;'), 'el chat del reto sigue igual: lo hecho');
  // La vuelta lee SIN la sesión y decide con lo que se sabe.
  const v = fuenteSinComentarios('lib/reto/avisos-salida.ts');
  assert.ok(v.includes('leerTareasDelReto(e, ahora, { sinSesion: true })') && v.includes('queMandar({ e: paraDecidir(e, lectura, ahora), ...datos })'));
});
