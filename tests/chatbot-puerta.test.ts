import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { abreEnQR, abrirGuiaVoz, marcarWhatsappAlCargar, puertaAlRecargar } from '../lib/chatbot-puerta';

// =============================================================================
// /chatbot: el dato gana al tilde (#745, #328, #786 — 06/10/2026)
// =============================================================================
// Los casos son los medidos en producción el 06/10: el ws9 con el tilde de «Tu WhatsApp»
// y cero líneas; el ws1 conectado y con el tilde; Código Inmobiliario con la línea caída
// y sin tilde; el ws9 y Código Inmobiliario con el tilde de «Tu forma de escribir» y sin
// guía de voz.
//
// Probado rompiéndolo (06/10/2026), una rotura por vez, restaurando de memoria:
//  (1) abreEnQR sin la regla de 'sin_vincular'  → 1 rojo (el del ws9)
//  (2) abreEnQR sin la regla de 'conectado'     → 1 rojo (el de quien vinculó desde /chatbot)
//  (3) abrirGuiaVoz abriendo con guiaVoz null   → 1 rojo (el de la red caída)
//  (4) la pantalla decidiendo por el tilde      → 1 rojo (el del cableado)
//  (5) el GET de secuencias sin envioWhatsapp   → 1 rojo (el del envío apagado)
//  (6) el lienzo sin pasarle onEnvioAuto al nodo → 1 rojo (el de «Sale sola»)
//  (7) el perfil sin el prop onEnvioAuto         → 1 rojo (el de «Sale sola»)
//  (8) la puerta recalculada en cada recargue    → 1 rojo (el de puertaAlRecargar, revisión del 06/10)

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const leer = (r: string) => readFileSync(`${RAIZ}${r}`, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('abreEnQR: sin línea abre el QR aunque el tilde diga que está (ws9)', () => {
  assert.equal(abreEnQR({ onboarding: 'hecho', canal: 'sin_vincular' }), true);
});

test('abreEnQR: con la línea conectada abre el lienzo aunque falte el tilde', () => {
  // Quien vinculó desde el mismo /chatbot no tenía tilde: veía «Vincula tu WhatsApp» en cada visita.
  assert.equal(abreEnQR({ onboarding: 'pendiente', canal: 'conectado' }), false);
  assert.equal(abreEnQR({ onboarding: 'hecho', canal: 'conectado' }), false);   // ws1
});

test('abreEnQR: sin dato de la línea decide el tilde, y el setter ve siempre el lienzo', () => {
  assert.equal(abreEnQR({ onboarding: 'pendiente', canal: 'desconectado' }), true);   // Código Inmobiliario
  assert.equal(abreEnQR({ onboarding: 'hecho', canal: 'desconectado' }), false);
  assert.equal(abreEnQR({ onboarding: 'pendiente', canal: 'desconocido' }), true);
  assert.equal(abreEnQR({ onboarding: 'no_se_pudo', canal: 'desconocido' }), true);
  assert.equal(abreEnQR({ onboarding: 'sin_permiso', canal: 'sin_vincular' }), false);
});

test('puertaAlRecargar: con el lienzo a la vista, sólo un sin_vincular comprobado lo cambia', () => {
  // Revisión del 06/10: un recargue con la línea en 'conectando' sacaba al dueño a mitad de una edición.
  for (const canal of ['conectando', 'desconocido', 'desconectado']) {
    assert.equal(puertaAlRecargar({ actual: false, calculada: true, canal }), false, canal);
  }
  assert.equal(puertaAlRecargar({ actual: false, calculada: true, canal: 'sin_vincular' }), true);
  // La primera vez (todavía no se sabe nada) decide la puerta calculada.
  assert.equal(puertaAlRecargar({ actual: null, calculada: true, canal: 'desconocido' }), true);
  assert.equal(puertaAlRecargar({ actual: true, calculada: false, canal: 'conectado' }), false);
});

test('marcarWhatsappAlCargar: la línea conectada con el paso pendiente se marca', () => {
  assert.equal(marcarWhatsappAlCargar({ onboarding: 'pendiente', canal: 'conectado' }), true);
  assert.equal(marcarWhatsappAlCargar({ onboarding: 'hecho', canal: 'conectado' }), false);
  assert.equal(marcarWhatsappAlCargar({ onboarding: 'pendiente', canal: 'conectando' }), false);
  assert.equal(marcarWhatsappAlCargar({ onboarding: 'sin_permiso', canal: 'conectado' }), false);
});

test('abrirGuiaVoz: sólo si el server CONTESTÓ que no hay guía', () => {
  assert.equal(abrirGuiaVoz({ ok: true, guiaVoz: false }), true);
  assert.equal(abrirGuiaVoz({ ok: true, guiaVoz: true }), false);
  assert.equal(abrirGuiaVoz({ ok: true, guiaVoz: null }), false, 'no se pudo leer: no se abre');
  assert.equal(abrirGuiaVoz({ ok: false, guiaVoz: false }), false);
  assert.equal(abrirGuiaVoz(null), false);
});

test('la pantalla decide la puerta con abreEnQR y marca el paso al vincular desde ahí', () => {
  const app = sinComentarios(leer('app/chatbot/ChatAgentApp.tsx'));
  assert.ok(app.includes('const calculada = abreEnQR({ onboarding, canal: estadoCanal });'));
  assert.ok(app.includes('setEnOnboarding((actual) => puertaAlRecargar({ actual, calculada, canal: estadoCanal }));'));
  assert.doesNotMatch(app, /setEnOnboarding\(falta\)/);
  assert.match(app, /action: 'paso', paso: 'wa_no_oficial', tab: 'setting'/);
  // Se marca al vincular desde el QR y al cargar con la línea ya conectada.
  assert.ok(app.includes('if (marcarWhatsappAlCargar({ onboarding, canal: estadoCanal })) void marcarPasoWhatsapp()'));
  assert.ok(app.includes("setCanal({ estado: 'conectado', desde: null });"));
  // El onboarding contesta si hay guía de voz, leyéndola de forma estricta (un error no es «no hay»).
  const ruta = sinComentarios(leer('app/api/chat-agent/onboarding/route.ts'));
  assert.ok(ruta.includes("m.hayVozGuiaEstricto()).catch(() => null)"));
  assert.match(ruta, /def: tabOnboardingDef\(TAB\), guiaVoz \}/);
});

test('«Sale sola» se edita en la tarjeta de entrada y viaja al guardar (#786)', () => {
  // Su único control vivía en un wizard que desde el 05/10 no abre nada.
  const lienzo = sinComentarios(leer('app/chatbot/FlujoLienzo.tsx'));
  assert.match(lienzo, /checked=\{estrategia\?\.envio_automatico === true\}/);
  assert.match(lienzo, /onChange=\{\(v\) => onEnvioAuto\(v\)\}/);
  assert.match(lienzo, /onAntiguedad=\{onAntiguedad\} onEnvioAuto=\{onEnvioAuto\}/, 'el lienzo no se lo pasa al editor del nodo');
  const perfil = sinComentarios(leer('app/chatbot/SecuenciaPerfil.tsx'));
  assert.match(perfil, /onEnvioAuto=\{rolAdmin \? setEnvioAuto : undefined\}/);
  assert.match(perfil, /envio_automatico: envioAuto,/);
});

test('el envío apagado viaja en el GET de secuencias y la pantalla lo avisa (#328)', () => {
  const ruta = sinComentarios(leer('app/api/chat-agent/secuencias/route.ts'));
  assert.ok(ruta.includes('envioWhatsapp: await envioWhatsappHabilitadoEstricto().catch(() => null),'));
  const app = sinComentarios(leer('app/chatbot/ChatAgentApp.tsx'));
  // Sólo si una secuencia activa manda por WhatsApp: una de puro email no está «sin mandar nada».
  // Y cuentan los MENSAJES: un paso «⚡ Acción» corre con el envío apagado (08/10/2026).
  assert.ok(app.includes("!canalCaido && envioWa === false && (secuencias ?? []).some((s) => s.activa && s.pasos.some((p) => p.canal === 'whatsapp' && !esPasoAccion(p)))"));
  assert.match(app, /fetch\('\/api\/whatsapp\/envio'/);
  // Prender exige un número conectado: CUALQUIER línea, no sólo la de por default.
  const envio = sinComentarios(leer('app/api/whatsapp/envio/route.ts'));
  assert.ok(envio.includes("evolutionConectado: lineas.some((l) => l.estado === 'conectado'),"));
});
