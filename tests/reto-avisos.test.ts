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
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HORAS_WA, diaAbierto, type EstadoReto } from '../lib/reto/dias';
import {
  queMandar, leerAvisos, horaAr, diaAr, whatsappDelDia, whatsappDeAbandono, avisoDelDia, avisoDeLaNoche, esBaja, CLAVE_AVISOS,
  horaDelMensaje, respuestaDeLaHora,
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

/** La vuelta de cada hora, a los :02, durante días: lo que sale y a qué hora de Argentina. */
function simular(e: EstadoReto, dias: number, o: { ultimaVisita?: number | null; porWhatsApp?: boolean; a?: AvisosReto } = {}) {
  let a = o.a ?? nuevos(e);
  const salio: Array<{ que: string; dia: number; hora: number; fecha: number; wa?: boolean }> = [];
  const desde = Date.parse(INICIO) + 2 * 60_000;
  for (let t = desde; t < desde + dias * 24 * HORA; t += HORA) {
    const p = queMandar({ e, a, ahora: t, ultimaVisita: o.ultimaVisita === undefined ? t : o.ultimaVisita, porWhatsApp: o.porWhatsApp ?? true });
    if (p.manana) salio.push({ que: 'manana', dia: p.manana.dia, hora: Math.floor(horaAr(t)), fecha: diaAr(t), wa: p.manana.whatsapp });
    if (p.noche) salio.push({ que: 'noche', dia: p.noche.dia, hora: Math.floor(horaAr(t)), fecha: diaAr(t) });
    if (p.abandono) salio.push({ que: 'abandono', dia: p.abandono.dia, hora: Math.floor(horaAr(t)), fecha: diaAr(t), wa: p.manana?.whatsapp });
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
  assert.ok(noches.every((x) => x.fecha === diaAr(Date.parse(INICIO))), 'sólo la primera noche, antes del día 2');
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
  assert.match(r, /if \(!baja && !hora\) return null;/, 'sin uno de los dos mensajes no toca la base');
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
