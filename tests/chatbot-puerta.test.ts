import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { abrirGuiaVoz, marcarWhatsappAlCargar } from '../lib/chatbot-puerta';

// =============================================================================
// /automations: el dato gana al tilde (#745, #328, #786 — 06/10/2026)
// =============================================================================
// Los casos son los medidos en producción el 06/10: el ws9 con el tilde de «Tu WhatsApp»
// y cero líneas; el ws1 conectado y con el tilde; Código Inmobiliario con la línea caída
// y sin tilde; el ws9 y Código Inmobiliario con el tilde de «Tu forma de escribir» y sin
// guía de voz.
//
// Probado rompiéndolo (06/10/2026), una rotura por vez, restaurando de memoria:
//  (1) y (2) eran de `abreEnQR`, que se fue con la puerta del QR (12/10/2026)
//  (3) abrirGuiaVoz abriendo con guiaVoz null   → 1 rojo (el de la red caída)
//  (4) la pantalla decidiendo por el tilde      → 1 rojo (el del cableado)
//  (5) el GET de secuencias sin envioWhatsapp   → 1 rojo (el del envío apagado)
//  (6) el lienzo sin pasarle onEnvioAuto al nodo → 1 rojo (el de «Sale sola»)
//  (7) el perfil sin el prop onEnvioAuto         → 1 rojo (el de «Sale sola»)
//  (8) era de `puertaAlRecargar`, que se fue con la puerta del QR (12/10/2026)
// Duodécima tanda (12/10/2026, wf-duodecima/ui-entrada-probar/romper.mjs). Base 5 / 0, restaurado 5 / 0:
//  (9) el aviso rojo sin marcar el paso al vincular → 4 / 1 (el de la pantalla)

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const leer = (r: string) => readFileSync(`${RAIZ}${r}`, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// ⛔ ACÁ IBAN LOS TESTS DE `abreEnQR` Y `puertaAlRecargar` (la puerta del QR y su recargue). Se fueron el 12/10/2026
// con la puerta (duodécima tanda, §2.12): la tab ya no tiene onboarding. Lo que la reemplaza lo fija
// tests/automations-duodecima-entrada.test.ts.

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

test('la pantalla marca el paso «Tu WhatsApp» al cargar con la línea conectada y al vincular desde el aviso rojo', () => {
  const app = sinComentarios(leer('app/automations/ChatAgentApp.tsx'));
  // Duodécima tanda: el onboarding ya no decide qué se ve; se lee sólo para rellenar el paso.
  assert.doesNotMatch(app, /abreEnQR|puertaAlRecargar|setEnOnboarding/);
  assert.match(app, /action: 'paso', paso: 'wa_no_oficial', tab: 'setting'/);
  // Se marca al cargar con la línea ya conectada y al vincular desde el aviso rojo (`ConectarMedio`).
  assert.ok(app.includes('if (marcarWhatsappAlCargar({ onboarding, canal: estadoCanal })) {'));
  assert.match(app, /<ConectarMedio medio="whatsapp" onCerrar=\{\(\) => setConectarWa\(false\)\} onConectado=\{\(\) => \{\n\s+setConectarWa\(false\);\n\s+setCanal\(\{ estado: 'conectado', desde: null \}\);\n\s+void marcarPasoWhatsapp\(\)\.catch\(\(\) => \{\}\);\n\s+void load\(\);/);
  // El onboarding contesta si hay guía de voz, leyéndola de forma estricta (un error no es «no hay»).
  const ruta = sinComentarios(leer('app/api/chat-agent/onboarding/route.ts'));
  assert.ok(ruta.includes("m.hayVozGuiaEstricto()).catch(() => null)"));
  assert.match(ruta, /def: tabOnboardingDef\(TAB\), guiaVoz \}/);
});

// ⚠️ REESCRITO EL 08/10/2026: «Sale sola» SALIÓ de la tarjeta de entrada (punto 6: «mucho
// menos se entiende el checkbox de "Sale sola"») y pasó a CADA mensaje: «Revisar antes de
// enviar» (`paso.revisar`). Ausente en el paso, manda la secuencia (`envio_automatico`), así
// que el editor se pinta con el valor HEREDADO — si no, un mensaje de una secuencia que sale
// sola se vería como «revisar» y viceversa. Probado rompiéndolo: el heredado sin negar
// (`revisarHeredado={envioAutoSecuencia}`) → 1 fallo; el perfil sin pasar
// `envio_automatico` → 1 fallo; volver a dibujar «Sale sola» en el CRON → 1 fallo.
// Desde la revisión del 08/10 (costuras-3) el heredado sale de `revisarHeredado` (lib/
// flujo-conversacion.ts), que además sabe que un «MaKo contesta» de «Si responde» sin
// `revisar` deja borrador; lo que hace esa función lo prueba tests/lienzo-revision.test.ts.
test('«Sale sola» es de cada mensaje («Revisar antes de enviar»), con el valor heredado de la secuencia', () => {
  const lienzo = sinComentarios(leer('app/automations/FlujoLienzo.tsx'));
  assert.match(lienzo, /mostrarRevisar=\{!recordatorio\}\s+revisarHeredado=\{revisarHeredado\(pasos, id, envioAutoSecuencia\)\}/);
  assert.doesNotMatch(lienzo, /label="Sale sola"|onEnvioAuto/, 'volvió «Sale sola» a la tarjeta del disparador');
  const perfil = sinComentarios(leer('app/automations/SecuenciaPerfil.tsx'));
  assert.match(perfil, /envioAutoSecuencia=\{est\?\.envio_automatico === true\}/);
});

test('el envío apagado viaja en el GET de secuencias y la pantalla lo avisa (#328)', () => {
  const ruta = sinComentarios(leer('app/api/chat-agent/secuencias/route.ts'));
  assert.ok(ruta.includes('envioWhatsapp: await envioWhatsappHabilitadoEstricto().catch(() => null),'));
  const app = sinComentarios(leer('app/automations/ChatAgentApp.tsx'));
  // Sólo si una secuencia activa manda por WhatsApp: una de puro email no está «sin mandar nada».
  // Y cuentan los MENSAJES: un paso «⚡ Acción» corre con el envío apagado (08/10/2026).
  assert.ok(app.includes("!canalCaido && envioWa === false && (secuencias ?? []).some((s) => s.activa && s.pasos.some((p) => p.canal === 'whatsapp' && !esPasoAccion(p)))"));
  assert.match(app, /fetch\('\/api\/whatsapp\/envio'/);
  // Prender exige un número conectado: CUALQUIER línea, no sólo la de por default.
  const envio = sinComentarios(leer('app/api/whatsapp/envio/route.ts'));
  assert.ok(envio.includes("evolutionConectado: lineas.some((l) => l.estado === 'conectado'),"));
});
