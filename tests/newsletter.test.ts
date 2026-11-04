// El Newsletter (29/10/2026, aprobado por Martín: «Sí, armalo así»). Lo puro: el segmento de una edición, la etapa que se
// calcula de la lectura, la config, la próxima edición, la charla de apertura, las métricas, el guion del Copywriter y el
// renglón del Calendario. Y los contratos que viven en archivos que no se pueden importar sin la base (el envío, la baja,
// el cron), leídos del fuente.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  APAGADAS_NEWSLETTER, CONFIG_VACIA, DORMIDO_TRAS_DEFAULT, ETAPAS_NEWSLETTER, ETAPA_BAJA, ETAPA_DORMIDO, ETAPA_LEE, ETAPA_SUSCRIPTO,
  HORAS_PARA_ABRIR, edicionDelDoc, entraEnSegmento, esEdicion, etapaPorLectura, frecuenciaDeTexto, leerConfig, mensajesDeApertura,
  metricasDe, preguntaDeApertura, proximaEdicion, segmentoDeNewsletter, segmentoNewsletter, type EntregaEdicion, type SegmentoNewsletter,
} from '../lib/newsletter-reglas';
import { PROMPTS_NEWSLETTER, leerPropuesta } from '../lib/newsletter-ia-reglas';
import { docDeEdicion } from '../lib/newsletter-copy';
import { bloquesDelDoc, docDeEstructura, textoDeNodo } from '../lib/copywriter/doc';
import { itemDeEdicion, CAPAS_CALENDARIO } from '../lib/calendario-modelo';
import { IA_FEATURE_LABEL } from '../lib/ia-labels';
import { deriveStageKey, conTerminales, generateFunnel } from '../lib/pipeline';

const leer = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DIA = 86400_000;
const AHORA = Date.parse('2026-11-20T15:00:00Z');
const hace = (dias: number) => new Date(AHORA - dias * DIA).toISOString();
const env = (dias: number, abierto: boolean, estado = 'enviado'): EntregaEdicion => ({ enviadoAt: hace(dias), abierto, estado });

test('el segmento de una edición: todo el CRM o una etapa; la baja y lo mal formado no existen', () => {
  assert.deepEqual(segmentoNewsletter('newsletter:12'), { funnelId: 12, etapa: null });
  assert.deepEqual(segmentoNewsletter('newsletter:12:nl_lee'), { funnelId: 12, etapa: ETAPA_LEE });
  assert.deepEqual(segmentoNewsletter(segmentoDeNewsletter(7, ETAPA_DORMIDO)), { funnelId: 7, etapa: ETAPA_DORMIDO });
  assert.equal(segmentoNewsletter(`newsletter:12:${ETAPA_BAJA}`), null, 'a los dados de baja no se les escribe');
  for (const malo of ['newsletter:', 'newsletter:0', 'newsletter:-3', 'newsletter:1.5', 'newsletter:abc', 'newsletter:12:otra', 'newsletter:12:nl_lee:x', 'activos', 'etiqueta:3', null, 12]) {
    assert.equal(segmentoNewsletter(malo), null, String(malo));
  }
  assert.equal(esEdicion('newsletter:3'), true);
  assert.equal(esEdicion('activos'), false);
});

test('a quién le llega: nunca a las bajas ni a las salidas; «Compró» sigue suscripto', () => {
  const todo: SegmentoNewsletter = { funnelId: 1, etapa: null };
  assert.equal(entraEnSegmento(todo, ETAPA_SUSCRIPTO), true);
  assert.equal(entraEnSegmento(todo, null), true, 'sin etapa = la de entrada');
  assert.equal(entraEnSegmento(todo, 'ganado'), true);
  for (const fuera of [ETAPA_BAJA, 'perdido', 'descal', 'noresp']) assert.equal(entraEnSegmento(todo, fuera), false, fuera);
  const lee: SegmentoNewsletter = { funnelId: 1, etapa: ETAPA_LEE };
  assert.equal(entraEnSegmento(lee, ETAPA_LEE), true);
  assert.equal(entraEnSegmento(lee, ETAPA_DORMIDO), false);
});

test('la etapa por la lectura: abrir → Lee; N sin abrir → Dormido; sin historia, se queda', () => {
  const n = { n: 3, ahoraMs: AHORA };
  assert.equal(etapaPorLectura(ETAPA_SUSCRIPTO, [env(10, false), env(5, true)], n), ETAPA_LEE);
  assert.equal(etapaPorLectura(ETAPA_LEE, [env(21, false), env(14, false), env(7, false)], n), ETAPA_DORMIDO);
  assert.equal(etapaPorLectura(ETAPA_DORMIDO, [env(21, false), env(14, false), env(7, true)], n), ETAPA_LEE, 'el dormido que abre se despierta');
  assert.equal(etapaPorLectura(ETAPA_SUSCRIPTO, [env(14, false), env(7, false)], n), null, 'con dos de tres no alcanza');
  assert.equal(etapaPorLectura(ETAPA_LEE, [env(7, true)], n), null, 'ya está donde va');
  // Abrió una vieja, pero las últimas 3 no: se duerme.
  assert.equal(etapaPorLectura(ETAPA_LEE, [env(28, true), env(21, false), env(14, false), env(7, false)], n), ETAPA_DORMIDO);
  // El default.
  assert.equal(DORMIDO_TRAS_DEFAULT, 3);
});

test('la etapa por la lectura: SÓLO cuentan los envíos reales (con el envío apagado nadie se duerme)', () => {
  const n = { n: 3, ahoraMs: AHORA };
  const simuladas = [env(21, false, 'simulado'), env(14, false, 'simulado'), env(7, false, 'simulado')];
  assert.equal(etapaPorLectura(ETAPA_SUSCRIPTO, simuladas, n), null);
  assert.equal(etapaPorLectura(ETAPA_LEE, [env(21, false, 'saltado'), env(14, false, 'fallo'), env(7, false)], n), null);
});

test('la etapa por la lectura: una edición de la que no llegó NINGUNA apertura no mide (su key de Resend, o sin webhook)', () => {
  const n = { n: 3, ahoraMs: AHORA };
  const sinMedir = [env(21, false), env(14, false), env(7, false)].map((x) => ({ ...x, medida: false }));
  assert.equal(etapaPorLectura(ETAPA_LEE, sinMedir, n), null, 'no se duerme a toda la lista por un tracking que no llega');
  assert.equal(etapaPorLectura(ETAPA_LEE, [...sinMedir, env(35, false), env(28, false), env(27, false)], n), ETAPA_DORMIDO, 'las medidas sí cuentan');
});

test('la etapa por la lectura: una sin abrir no cuenta hasta pasado el margen para abrirla', () => {
  const n = { n: 3, ahoraMs: AHORA };
  const recien = { enviadoAt: new Date(AHORA - (HORAS_PARA_ABRIR - 1) * 3600_000).toISOString(), abierto: false, estado: 'enviado' };
  assert.equal(etapaPorLectura(ETAPA_LEE, [env(14, false), env(7, false), recien], n), null, 'la de ayer todavía puede abrirse');
  assert.equal(etapaPorLectura(ETAPA_LEE, [env(21, false), env(14, false), env(7, false), recien], n), ETAPA_DORMIDO);
  const recienAbierta = { ...recien, abierto: true };
  assert.equal(etapaPorLectura(ETAPA_DORMIDO, [env(14, false), recienAbierta], n), ETAPA_LEE, 'una abierta cuenta en el acto');
});

test('la etapa por la lectura: la baja, «Compró» y las salidas no las mueve la lectura', () => {
  const abrio = [env(7, true)];
  for (const quieta of [ETAPA_BAJA, 'ganado', 'perdido', 'descal', 'noresp']) assert.equal(etapaPorLectura(quieta, abrio, { ahoraMs: AHORA }), null, quieta);
});

test('el CRM nace con sus etapas: Suscripto es la canónica de entrada, y el CRM no le agrega nada que no sea suyo', () => {
  assert.deepEqual(ETAPAS_NEWSLETTER.map((e) => e.label), ['Suscripto', 'Lee', 'Dormido', 'Dado de baja', 'Compró']);
  assert.equal(ETAPAS_NEWSLETTER[0].key, 'lead');
  assert.equal(ETAPAS_NEWSLETTER[0].kind, 'entrada');
  // Un lead de casa que nunca se movió deriva la etapa de entrada: el tablero lo dibuja en Suscripto.
  assert.equal(deriveStageKey({ estado_lead: 'abierto', fecha_agenda: null, fecha_junta_1: null, fecha_junta_2: null, asistio_j1: null, asistio_j2: null }), ETAPA_SUSCRIPTO);
  // El CRM pone siempre UN «ganado» al final: el nuestro ya está ahí y conserva su nombre.
  assert.deepEqual(conTerminales(ETAPAS_NEWSLETTER), ETAPAS_NEWSLETTER);
  const { stages } = generateFunnel(ETAPAS_NEWSLETTER, [...APAGADAS_NEWSLETTER]);
  const nutricion = stages.filter((s) => s.band === 'nutricion').map((s) => s.key);
  assert.deepEqual(nutricion, [], 'ni «No agendó» ni «Manual»: un newsletter no nutre');
  assert.deepEqual(stages.filter((s) => s.band === 'pipeline').map((s) => s.label), ['Suscripto', 'Lee', 'Dormido', 'Dado de baja', 'Compró']);
});

test('la config: lo que no se entiende vuelve a vacío, nunca a un valor inventado', () => {
  assert.deepEqual(leerConfig(null), CONFIG_VACIA);
  assert.deepEqual(leerConfig('no es json'), CONFIG_VACIA);
  assert.deepEqual(leerConfig({ funnelId: 9, frecuencia: 'semanal', tema: '  Consejos   de mi rubro ', dormidoTras: 4 }),
    { funnelId: 9, frecuencia: 'semanal', tema: 'Consejos de mi rubro', dormidoTras: 4 });
  assert.deepEqual(leerConfig(JSON.stringify({ funnelId: -1, frecuencia: 'diaria', tema: '', dormidoTras: 99 })), CONFIG_VACIA);
  assert.equal(leerConfig({ tema: 'x'.repeat(500) }).tema?.length, 200);
});

test('la próxima edición: se ancla en la anterior, nunca antes de mañana, y sin frecuencia no se inventa', () => {
  assert.equal(proximaEdicion(null, hace(3), AHORA), null);
  const desdeLaAnterior = proximaEdicion('semanal', '2026-11-18T13:00:00.000Z', AHORA);
  assert.equal(desdeLaAnterior, '2026-11-25T13:00:00.000Z');
  // La anterior es de hace mucho: salta de a una frecuencia hasta pasar mañana (no se ancla en hoy).
  assert.equal(proximaEdicion('semanal', '2026-10-01T13:00:00.000Z', AHORA), '2026-11-26T13:00:00.000Z');
  // Sin anterior: mañana.
  assert.equal(proximaEdicion('mensual', null, AHORA), '2026-11-21T13:00:00.000Z');
  // Abrir la tab dos días seguidos no corre la fecha.
  assert.equal(proximaEdicion('quincenal', '2026-11-18T13:00:00.000Z', AHORA), proximaEdicion('quincenal', '2026-11-18T13:00:00.000Z', AHORA + DIA));
});

test('la apertura: UNA pregunta por vez, con pastillas, sin IA; lo contestado queda en la charla', () => {
  assert.equal(preguntaDeApertura({ frecuencia: null, tema: null })?.id, 'frecuencia');
  assert.equal(preguntaDeApertura({ frecuencia: 'semanal', tema: null })?.id, 'tema');
  assert.equal(preguntaDeApertura({ frecuencia: 'semanal', tema: 'x' }), null);
  const uno = mensajesDeApertura({ frecuencia: null, tema: null });
  assert.equal(uno.length, 1);
  assert.equal(uno[0].texto, '¿Cada cuánto quieres mandar tu newsletter?');
  assert.deepEqual(uno[0].opciones, ['Cada semana', 'Cada 15 días', 'Una vez al mes']);
  const dos = mensajesDeApertura({ frecuencia: 'quincenal', tema: null });
  assert.deepEqual(dos.map((m) => [m.de, m.texto]), [['mako', '¿Cada cuánto quieres mandar tu newsletter?'], ['yo', 'Cada 15 días'], ['mako', '¿De qué trata?']]);
  assert.equal(dos[0].opciones, undefined, 'las pastillas sólo en la pregunta que falta');
  assert.ok(dos[2].opciones?.length);
  const tres = mensajesDeApertura({ frecuencia: 'quincenal', tema: 'Recetas' }, { texto: 'Para la primera…', opciones: ['A'] });
  assert.deepEqual(tres.slice(-2).map((m) => [m.de, m.texto]), [['yo', 'Recetas'], ['mako', 'Para la primera…']]);
  // Texto corto y de «tú», sin voseo.
  for (const m of [...uno, ...dos]) assert.doesNotMatch(m.texto, /\b(querés|tenés|podés|vos)\b/i);
});

test('la frecuencia dicha con palabras', () => {
  assert.equal(frecuenciaDeTexto('Cada semana'), 'semanal');
  assert.equal(frecuenciaDeTexto('cada 15 dias'), 'quincenal');
  assert.equal(frecuenciaDeTexto('Una vez al MES'), 'mensual');
  assert.equal(frecuenciaDeTexto('una vez por semana'), 'semanal');
  assert.equal(frecuenciaDeTexto('cuando pinte'), null);
});

test('las métricas de una edición: aperturas, clics y bajas sobre lo que salió de verdad', () => {
  const m = metricasDe([
    { estado: 'enviado', abierto_at: 'x', clic_at: 'x', baja_at: null },
    { estado: 'enviado', abierto_at: 'x', clic_at: null, baja_at: 'x' },
    { estado: 'enviado', abierto_at: null, clic_at: null },
    { estado: 'simulado', abierto_at: 'x', clic_at: 'x', baja_at: 'x' },
    { estado: 'saltado', abierto_at: null, clic_at: null },
  ]);
  assert.deepEqual(m, { enviados: 3, simulados: 1, abiertos: 2, clics: 1, bajas: 1 });
});

test('el guion del Copywriter → el email de la edición, y al revés', () => {
  const doc = docDeEdicion(null, { asunto: 'Tres ideas para vender más', preheader: 'La segunda es la que más cuesta', cuerpo: 'Hola {nombre}:\n\nPrimer párrafo.' });
  const bloques = bloquesDelDoc(doc);
  assert.deepEqual(bloques.filter((b) => b.tipo === 'seccion').map((b) => b.seccion), ['ASUNTO', 'VISTA PREVIA', 'CUERPO', 'BOTON']);
  const vuelta = edicionDelDoc(bloques, 'Título del guion');
  assert.deepEqual(vuelta, { asunto: 'Tres ideas para vender más', preheader: 'La segunda es la que más cuesta', cuerpo: 'Hola {nombre}:\n\nPrimer párrafo.' });
  // Sin ASUNTO, el título; el botón va al final del cuerpo; lo que está fuera de una sección no se pierde.
  const libre = edicionDelDoc([
    { tipo: 'texto', seccion: null, texto: 'Un renglón suelto' },
    { tipo: 'seccion', seccion: 'BOTON', texto: 'Botón' },
    { tipo: 'texto', seccion: 'BOTON', texto: 'Agenda tu llamada' },
  ], 'El título');
  assert.deepEqual(libre, { asunto: 'El título', preheader: null, cuerpo: 'Un renglón suelto\n\nAgenda tu llamada' });
  // Con un esqueleto de otra plantilla (sin VISTA PREVIA), lo que no tiene dónde ir va al final.
  const otra = docDeEdicion(docDeEstructura(['ASUNTO', 'CUERPO']), { asunto: 'A', preheader: 'P', cuerpo: 'C' });
  assert.deepEqual((otra.content ?? []).map((n) => textoDeNodo(n)).filter(Boolean), ['Asunto', 'A', 'Cuerpo', 'C', 'P']);
});

test('el Calendario: cada edición programada o enviada es un renglón de la capa Newsletter, que lleva a la edición', () => {
  assert.ok(CAPAS_CALENDARIO.some((c) => c.id === 'newsletters'));
  const prog = itemDeEdicion({ id: 4, asunto: 'Novedades', estado: 'programado', programadoAt: '2026-11-25T13:00:00.000Z', enviadoAt: null });
  assert.deepEqual(prog && [prog.id, prog.fuente, prog.capa, prog.titulo, prog.inicio, prog.href, prog.hecho],
    ['newsletter:4', 'newsletter', 'newsletters', 'Novedades', '2026-11-25T13:00:00.000Z', '/newsletters?edicion=4', false]);
  const env2 = itemDeEdicion({ id: 5, asunto: '', estado: 'enviado', programadoAt: null, enviadoAt: '2026-11-18T13:05:00.000Z' });
  assert.equal(env2?.titulo, 'Edición sin asunto');
  assert.equal(env2?.hecho, true);
  assert.equal(itemDeEdicion({ id: 6, asunto: 'x', estado: 'borrador', programadoAt: '2026-11-25T13:00:00.000Z', enviadoAt: null }), null, 'un borrador no está en ningún día');
});

test('la IA del negocio: su feature, sus prompts editables en /configuraciones, y una salida que se lee o no', () => {
  assert.ok(IA_FEATURE_LABEL['newsletter-ia']);
  // El registro arrastra server-only: se lee del fuente, como tests/copywriter-ia.test.ts.
  const reg = leer('lib/prompt-registry.ts');
  assert.match(reg, /group: 'Newsletter'/, 'falta el grupo Newsletter en el registro de prompts');
  assert.match(reg, /key: PROMPTS_NEWSLETTER\.propuestaSystem\.key/);
  assert.match(reg, /key: PROMPTS_NEWSLETTER\.propuestaUser\.key/);
  for (const slot of ['tema', 'frecuencia', 'anteriores', 'negocio']) assert.match(reg, new RegExp(`v\\('${slot}'`), `falta la variable ${slot} en el registro`);
  for (const slot of ['tema', 'frecuencia', 'anteriores', 'negocio']) assert.match(PROMPTS_NEWSLETTER.propuestaUser.tpl, new RegExp(`\\{\\{${slot}\\}\\}`));
  assert.match(PROMPTS_NEWSLETTER.propuestaSystem.tpl, /No inventes/);
  assert.deepEqual(leerPropuesta({ asunto: '«Tres ideas»', idea: ' Una  idea. ' }), { asunto: 'Tres ideas', idea: 'Una idea.' });
  assert.equal(leerPropuesta({ asunto: 'x' }), null);
  assert.equal(leerPropuesta(['x']), null);
});

// ── Los contratos que viven donde no se puede importar sin la base ───────────
test('el envío: una edición es un broadcast, y su segmento lo resuelve el newsletter', () => {
  const em = leer('lib/email-marketing.ts');
  assert.match(em, /esSegmentoValido = \(s: string\): boolean => .*segmentoNewsletter\(s\) != null/);
  assert.match(em, /if \(nl\) return \(await import\('@\/lib\/newsletter'\)\)\.destinatariosDeNewsletter\(nl\)/);
  assert.match(em, /existeCrm\(nl\.funnelId\)/, 'validarSegmento mira que el CRM sea de este negocio');
  assert.match(em, /buildUnsubscribeUrl\(lead\.id, id\)/, 'la baja de cada envío queda atribuida a su edición');
  assert.match(em, /traerEdicionDelCopy\(id\)/, 'una programada sale con lo último de su guion');
});

test('la baja: primero el opt-out, después la estampa en el envío y la tarjeta del newsletter, sin frenarla', () => {
  const r = leer('app/api/email/unsubscribe/route.ts');
  const optOut = r.indexOf("update({ email_opt_out: true })");
  const despues = r.indexOf('await despuesDeLaBaja(');
  assert.ok(optOut > 0 && despues > optOut);
  assert.match(r, /\.update\(\{ baja_at: /);
  assert.match(r, /conciliarLeadDelNewsletter/);
});

test('el cron: la lectura se concilia SÓLO en los negocios con el envío real prendido', () => {
  const c = leer('app/api/cron/email-broadcasts/route.ts');
  const apagado = c.indexOf("if (!(await envioEmailHabilitado())) return");
  const concilia = c.indexOf('await conciliarLectores()');
  assert.ok(apagado > 0 && concilia > apagado);
});

test('la tab: «Enviar ahora» se niega con el envío apagado (no quema la edición) y la prueba va sólo a quien la pide', () => {
  const a = leer('app/newsletters/actions.ts');
  const enviar = a.slice(a.indexOf('export async function enviarAction'));
  assert.ok(enviar.indexOf('envioEmailHabilitado()') > 0 && enviar.indexOf('envioEmailHabilitado()') < enviar.indexOf('enviarBroadcast(id)'));
  const prueba = a.slice(a.indexOf('export async function pruebaAction'), a.indexOf('export async function programarAction'));
  assert.match(prueba, /getUsuarioActual\(\)\)\?\.email/);
  assert.doesNotMatch(prueba, /email:\s*string/, 'no recibe un destinatario de afuera');
  // Toda acción pasa por la puerta de la tab.
  const trozos = a.split('export async function ').slice(1);
  assert.ok(trozos.length >= 10);
  for (const t of trozos) {
    const nombre = t.slice(0, t.indexOf('('));
    // La primera línea del cuerpo: lo que sigue a la llave que cierra la firma (`> {` o `) {` al final del renglón).
    const cuerpo = t.slice(t.search(/[>)] \{\n/) + 3);
    const primera = cuerpo.split('\n').find((l) => l.trim());
    assert.equal(primera?.trim(), 'await puerta();', `${nombre} no abre con la puerta de la tab`);
  }
});
