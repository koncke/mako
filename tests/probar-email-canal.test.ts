// =============================================================================
// «Probar en Email» no mostraba el mail: el lead de la prueba tenía WhatsApp SIEMPRE
// =============================================================================
// Sexta tanda (09/10/2026), «Probar» 1, textual: «Mira la captura que te paso, está configurado el
// email y en PROBAR no salió nada. Al igual que WhatsApp, el email debe salir con su animación...».
//
// El flujo de la captura es el de abajo, COPIADO de la base (la #226 del ws1, «Felicitación al
// terminar clase», leída en sólo lectura el 09/10/2026): CRON → CONDITION «Tiene WhatsApp» → «Sí»:
// WhatsApp y la etiqueta; «Si no»: el EMAIL. Con el lead de la prueba de antes (teléfono y email
// SIEMPRE) la condición salía por el «Sí» y el email no llegaba nunca. Lo de acá EJECUTA el
// recorrido (`mensajesDelRecorrido`, `contactoParaProbar`, lib/simulador-grafo.ts); el panel lo
// enchufa en `arrancarRefs` (lo fija tests/panel-probar-ancho.test.ts).
//
// PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { PasoGrafo } from '../lib/flujo-grafo';
import {
  mensajesDelRecorrido, contactoParaProbar, hechosDeLeadNuevo, CONTACTO_COMPLETO, sanearEmisorPrueba, lineaDePrueba,
} from '../lib/simulador-grafo';

/** Los pasos de la #226, tal cual están guardados (sin los campos que no tocan el recorrido). */
const FELICITACION: PasoGrafo[] = [
  { id: 'n55o7wc', nodo: 'condicion', canal: 'whatsapp', cuerpo: '', ramas: [{ id: 'n7mgord', modo: 'todas', filas: [{ campo: 'tiene_telefono' }], siguiente: 'n6d53dw' }], si_no: 'nepy1b8' },
  { id: 'n6d53dw', canal: 'whatsapp', cuerpo: 'Hola estimado {{nombre}}! ¡Felicitaciones por haber completado la clase!', siguiente: 'niyic71' },
  { id: 'nepy1b8', canal: 'email', asunto: '¡Felicitaciones por tu progreso!', cuerpo: 'Hola {{nombre}},\n\n¡Enhorabuena por terminar la clase!', siguiente: null },
  { id: 'niyic71', canal: 'whatsapp', cuerpo: '', accion: { operacion: 'poner_etiqueta_lead', params: { leadId: 'evento', etiquetaId: 2 } }, siguiente: null },
] as PasoGrafo[];

const AHORA = Date.parse('2026-10-09T20:00:00Z');
const esEmail = (p: PasoGrafo) => p.canal === 'email';
const esWa = (p: PasoGrafo) => p.canal !== 'email';
const ids = (ps: PasoGrafo[]) => ps.map((p) => p.id);

test('el síntoma, medido: con teléfono y email el email del «Si no» no llega nunca', () => {
  assert.deepEqual(ids(mensajesDelRecorrido(FELICITACION, { ahoraMs: AHORA })), ['n6d53dw'], 'con los dos, la condición va por el «Sí»: un WhatsApp');
});

test('«Probar en Email»: el lead de la prueba es el que no tiene WhatsApp, y el email LLEGA', () => {
  const c = contactoParaProbar(FELICITACION, esEmail, 'tieneEmail', { ahoraMs: AHORA });
  assert.deepEqual(c, { tieneTelefono: false, tieneEmail: true });
  assert.deepEqual(ids(mensajesDelRecorrido(FELICITACION, { ...c, ahoraMs: AHORA })), ['nepy1b8']);
});

test('«Probar en WhatsApp» sobre el mismo flujo: el de siempre (los dos), que ya recibe el WhatsApp', () => {
  assert.deepEqual(contactoParaProbar(FELICITACION, esWa, 'tieneTelefono', { ahoraMs: AHORA }), CONTACTO_COMPLETO);
});

test('el espejo: «Tiene email» → Sí: email, Si no: WhatsApp; probar WhatsApp elige al lead sin email', () => {
  const pasos: PasoGrafo[] = [
    { id: 'c', nodo: 'condicion', canal: 'whatsapp', cuerpo: '', ramas: [{ id: 'r', modo: 'todas', filas: [{ campo: 'tiene_email' }], siguiente: 'e' }], si_no: 'w' },
    { id: 'e', canal: 'email', asunto: 'Hola', cuerpo: 'mail', siguiente: null },
    { id: 'w', canal: 'whatsapp', cuerpo: 'wa', siguiente: null },
  ] as PasoGrafo[];
  assert.deepEqual(contactoParaProbar(pasos, esWa, 'tieneTelefono', { ahoraMs: AHORA }), { tieneTelefono: true, tieneEmail: false });
  assert.deepEqual(contactoParaProbar(pasos, esEmail, 'tieneEmail', { ahoraMs: AHORA }), CONTACTO_COMPLETO);
});

test('si dos leads reciben el email, gana el que TIENE email (no uno sin email que «lo recibe»)', () => {
  // «Tiene WhatsApp Y tiene email → Sí: WhatsApp; Si no: email». Con los dos, el «Sí». Sin WhatsApp o
  // sin email, los dos van al «Si no»: el lead de la prueba es el que tiene el canal que se prueba.
  const pasos: PasoGrafo[] = [
    { id: 'c', nodo: 'condicion', canal: 'whatsapp', cuerpo: '', ramas: [{ id: 'r', modo: 'todas', filas: [{ campo: 'tiene_telefono' }, { campo: 'tiene_email' }], siguiente: 'w' }], si_no: 'e' },
    { id: 'w', canal: 'whatsapp', cuerpo: 'wa', siguiente: null },
    { id: 'e', canal: 'email', asunto: 'Hola', cuerpo: 'mail', siguiente: null },
  ] as PasoGrafo[];
  assert.deepEqual(contactoParaProbar(pasos, esEmail, 'tieneEmail', { ahoraMs: AHORA }), { tieneTelefono: false, tieneEmail: true });
});

test('lo que SÍ se sabe de un lead nuevo no se elige: sin agenda sigue sin agenda', () => {
  // «Agendó → Sí: el email». Un lead nuevo no agendó: no hay contacto que lo haga llegar, y la prueba
  // no le inventa una agenda. Vuelve el de siempre.
  const pasos: PasoGrafo[] = [
    { id: 'c', nodo: 'condicion', canal: 'whatsapp', cuerpo: '', ramas: [{ id: 'r', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 'e' }], si_no: null },
    { id: 'e', canal: 'email', asunto: 'Hola', cuerpo: 'mail', siguiente: null },
  ] as PasoGrafo[];
  assert.deepEqual(contactoParaProbar(pasos, esEmail, 'tieneEmail', { ahoraMs: AHORA }), CONTACTO_COMPLETO);
  assert.deepEqual(mensajesDelRecorrido(pasos, { ahoraMs: AHORA }), []);
});

test('«ya le escribimos» cuenta en el recorrido de una vez, como en el panel', () => {
  // WhatsApp → «Ya le escribiste» → Sí: email. Sin marcar el contacto después del primer mensaje,
  // el email no llegaría y la prueba elegiría otro lead por nada.
  const pasos: PasoGrafo[] = [
    { id: 'w', canal: 'whatsapp', cuerpo: 'wa', siguiente: 'c' },
    { id: 'c', nodo: 'condicion', canal: 'whatsapp', cuerpo: '', ramas: [{ id: 'r', modo: 'todas', filas: [{ campo: 'ya_contactado' }], siguiente: 'e' }], si_no: null },
    { id: 'e', canal: 'email', asunto: 'Hola', cuerpo: 'mail', siguiente: null },
  ] as PasoGrafo[];
  assert.deepEqual(ids(mensajesDelRecorrido(pasos, { ahoraMs: AHORA })), ['w', 'e']);
});

test('los hechos del lead nuevo: ausente = los dos (lo de siempre); el contacto elegido pasa tal cual', () => {
  assert.equal(hechosDeLeadNuevo({}).tieneTelefono, true);
  assert.equal(hechosDeLeadNuevo({}).tieneEmail, true);
  const sinWa = hechosDeLeadNuevo({ tieneTelefono: false, tieneEmail: true });
  assert.equal(sinWa.tieneTelefono, false);
  assert.equal(sinWa.tieneEmail, true);
});

test('el emisor que manda el panel: la línea y el remitente se sanean; lo ilegible queda ausente', () => {
  assert.deepEqual(sanearEmisorPrueba({ linea: 'mako_ws13_2' }), { linea: 'mako_ws13_2' });
  assert.deepEqual(sanearEmisorPrueba({ linea: '' }), { linea: null }, '«la de por default» viaja vacía');
  assert.deepEqual(sanearEmisorPrueba({ linea: null }), { linea: null });
  assert.deepEqual(sanearEmisorPrueba({ linea: 'x y; drop' }), {}, 'un nombre de línea con espacios no es una línea');
  assert.deepEqual(sanearEmisorPrueba({}), {}, 'ausente = la de la automatización');
  assert.deepEqual(sanearEmisorPrueba({ remitente: 'Mi Negocio <Hola@MiNegocio.com>' }), { remitente: 'Mi Negocio <hola@minegocio.com>' });
  assert.deepEqual(sanearEmisorPrueba({ remitente: 'no es un mail' }), {});
  assert.deepEqual(sanearEmisorPrueba('basura'), {});
});

test('la línea que se pide: la elegida (vacía = por default) le gana a la de la automatización', () => {
  assert.equal(lineaDePrueba({ linea: 'mako_ws1_b' }, 'mako_ws1'), 'mako_ws1_b');
  assert.equal(lineaDePrueba({ linea: null }, 'mako_ws1_b'), null, 'eligió la de por default: no vuelve a la de la automatización');
  assert.equal(lineaDePrueba({}, 'mako_ws1_b'), 'mako_ws1_b', 'sin elegir, la de la automatización');
  assert.equal(lineaDePrueba(undefined, '  '), null);
});

test('el server: el emisor viaja, la línea la valida el envío y el remitente sólo del dominio del negocio', () => {
  const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const leer = (r: string) => sinComentarios(readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n'));
  const ruta = leer('app/api/chat-agent/simulador/route.ts');
  assert.match(ruta, /const emisor = sanearEmisorPrueba\(body\.emisor\);/);
  assert.match(ruta, /enviarPasoDePrueba\(\{ ws: a\.ws, secuenciaId: id, destino, mensaje, primero: body\.primero === true, emisor \}\)/);
  const prueba = leer('lib/prueba-paso.ts');
  assert.match(prueba, /const linea = lineaDePrueba\(p\.emisor, \(sec as \{ instance_name\?: string \| null \}\)\.instance_name\);/);
  // El remitente pedido: el del dominio del negocio, o se corta con su motivo (nunca sale por otro).
  assert.match(prueba, /const usable = remitenteDelPaso\(p\.emisor\.remitente, await getEmailFrom\(\)\);\n\s+if \(!usable\) return \{ ok: false, error: /);
  assert.match(prueba, /to: destino\.email!, \.\.\.\(from \? \{ from \} : \{\}\), subject: envio\.asunto,/);
  // Y se decide ANTES del tope: un pedido que se corta no gasta un lugar.
  assert.ok(prueba.indexOf('const usable = remitenteDelPaso(') < prueba.indexOf('hayLugar = await reclamarCupoPrueba('));
});

// ── ROTURAS (09/10/2026) ───────────────────────────────────────────────────────────────────────
// Con un arnés que rompe UNA cosa, corre este archivo junto con panel-probar-ancho, probar-lead-nuevo
// y chatbot-probar, y restaura DE MEMORIA verificando el md5 (nunca con git). Base: 53 / 0. Cayeron:
//   · R1 `contactoParaProbar` siempre con los dos (la regla vieja): 51 / 2.
//   · R2 `hechosDeLeadNuevo` con teléfono siempre: 51 / 2.
//   · R3 el recorrido de una vez sin marcar «ya le escribimos»: 52 / 1.
//   · R4 el orden con el lead del OTRO canal antes que el del propio: 53 / 0 ⚠ NO CAYÓ — ningún
//     flujo distinguía los dos. Se sumó «si dos leads reciben el email…» y con base 54 / 0 dio 53 / 1.
//   · R5 `sanearEmisorPrueba` aceptando cualquier nombre de línea: 52 / 1.
//   · R6 `lineaDePrueba` ignorando lo elegido: 52 / 1.
//   · S1 el remitente pedido sin `remitenteDelPaso`: 52 / 1. · S2 la línea de la secuencia siempre:
//     52 / 1. · S3 la ruta sin pasar el emisor: 52 / 1.
//   (Las del panel, en tests/panel-probar-ancho.test.ts.)
