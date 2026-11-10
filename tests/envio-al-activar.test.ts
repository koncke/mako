// =============================================================================
// #851: ACTIVAR una automatización que le escribe al lead por WhatsApp prende el envío de WhatsApp del negocio
// =============================================================================
// Decisión de Martín en la Ticketera (`envio-whatsapp-al-activar`, 17/10/2026): «B · Sí, y prenderlo ya». El envío era un
// interruptor aparte de la línea, apagado de fábrica para los clientes: medido el 17/10, prendido sólo en ws1, ws11 y
// ws13. Lo que fija este test:
//   1. cuándo una automatización «le escribe al lead por WhatsApp» (un mensaje por WhatsApp o un AI Step por WhatsApp);
//      la tarjeta MaKo al grupo no cuenta (es una ⚡ Acción por la línea de MaKo);
//   2. el cableado: sólo al ACTIVAR, después de escribir la activación, sólo PRENDE (nunca apaga), y un error no deshace
//      la activación.
//
// Probado rompiéndolo (17/10/2026, arnés `romper.py` + `roturas-851.json`; base 2 / 2): contando la tarjeta del grupo como
// mensaje al lead → 1 / 1 (cae el 1); prendiendo también al PAUSAR → 1 / 1 (el 2); apagándolo cuando no le escribe al
// lead → 1 / 1 (el 2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { enviosQuePrender, leEscribeAlLeadPorEmail, leEscribeAlLeadPorWhatsapp, textoDeLoQuePrendio } from '../lib/envio-al-activar';
import type { PasoGrafo } from '../lib/flujo-grafo';

const leer = (rel: string): string => readFileSync(join(import.meta.dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const RELLENO = { orden: 0, canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: '', template_wa: null, proveedor: 'no_oficial', siguiente: null } as const;
const p = (x: Record<string, unknown>): PasoGrafo => ({ ...RELLENO, id: 'x', ...x }) as PasoGrafo;

test('1. le escribe al lead por WhatsApp: un mensaje o un AI Step por WhatsApp; la tarjeta del grupo no', () => {
  assert.equal(leEscribeAlLeadPorWhatsapp([p({ cuerpo: 'Hola {{nombre}}' })]), true);
  assert.equal(leEscribeAlLeadPorWhatsapp([p({ nodo: 'respuesta', paso_ia: true })]), true, 'el AI Step contesta por WhatsApp');
  assert.equal(leEscribeAlLeadPorWhatsapp([p({ nodo: 'respuesta', paso_ia: true, medio: 'instagram' })]), false, 'por Instagram no usa este interruptor');
  assert.equal(leEscribeAlLeadPorWhatsapp([p({ canal: 'email', asunto: 'Hola', cuerpo: 'x' })]), false, 'un email tiene su propio interruptor');
  assert.equal(leEscribeAlLeadPorWhatsapp([p({ accion: { operacion: 'avisar_al_equipo', params: { mensaje: 'x' } } })]), false,
    'la tarjeta MaKo al grupo es una ⚡ Acción: no depende del envío del negocio');
  assert.equal(leEscribeAlLeadPorWhatsapp([p({ nodo: 'esperar', espera: { modo: 'tiempo', minutos: 5 } }), p({ nodo: 'condicion', ramas: [] })]), false);
});

test('2. el cableado: sólo al activar, después de escribirla, sólo prende, y un error no deshace la activación', () => {
  const src = leer('lib/nutricion.ts');
  const f = src.slice(src.indexOf('export async function setSecuenciaActiva('), src.indexOf('async function prenderEnvioAlActivar('));
  const iUpdate = f.indexOf(".update({ activa, updated_at: ahoraISO() })");
  const iPrende = f.indexOf('await prenderEnvioAlActivar(supabase, id).catch(');
  assert.ok(iUpdate > 0 && iPrende > iUpdate, 'se prende DESPUÉS de activar');
  const iSi = f.lastIndexOf('if (activa) {', iPrende);
  assert.ok(iSi > iUpdate && !/\n {2}\}\n/.test(f.slice(iSi, iPrende)), 'sólo al activar (adentro del `if (activa)`), nunca al pausar');
  const g = src.slice(src.indexOf('async function prenderEnvioAlActivar('), src.indexOf('\n}\n', src.indexOf('async function prenderEnvioAlActivar(')));
  // Desde el 10/11/2026 la decisión es pura (`enviosQuePrender`, el test 3) y el cableado sólo la aplica.
  assert.match(g, /const prender = enviosQuePrender\(pasos, \{ whatsapp, email \}\);\s*if \(prender\.whatsapp\) \{\s*await setEnvioWhatsapp\(true\);/);
  assert.match(g, /if \(prender\.email\) \{\s*await setEnvioEmail\(true\);/);
  assert.doesNotMatch(g, /setEnvioWhatsapp\(false\)|setEnvioEmail\(false\)/, 'activar nunca APAGA el envío');
});

// ── 3. El EMAIL también (10/11/2026, la auditoría de Automations para un usuario nuevo) ────────────────────────────────────
// Activar no tocaba el interruptor del email (apagado para un cliente sin la setting): «Activada ✓» y cada email «canal email
// apagado», reintentado cada 24 h para siempre. La misma decisión de Martín del 17/10, para el otro canal que tiene interruptor.
// Probado rompiéndolo (10/11/2026, base 3/0): `leEscribeAlLeadPorEmail` siempre false → 1 rojo; `enviosQuePrender` sin mirar
// si ya estaba prendido → 1 rojo.
test('3. activar prende el email del negocio sólo si la automatización le escribe al lead por email y está apagado', () => {
  const email = p({ canal: 'email', asunto: 'Hola', cuerpo: 'x' });
  const wa = p({ cuerpo: 'Hola' });
  assert.equal(leEscribeAlLeadPorEmail([email]), true);
  assert.equal(leEscribeAlLeadPorEmail([wa]), false);
  assert.equal(leEscribeAlLeadPorEmail([p({ accion: { operacion: 'avisar_al_equipo', params: { mensaje: 'x' } } })]), false);
  assert.deepEqual(enviosQuePrender([email], { whatsapp: false, email: false }), { whatsapp: false, email: true });
  assert.deepEqual(enviosQuePrender([email, wa], { whatsapp: false, email: false }), { whatsapp: true, email: true });
  assert.deepEqual(enviosQuePrender([email, wa], { whatsapp: true, email: true }), { whatsapp: false, email: false }, 'lo prendido no se vuelve a escribir');
  assert.deepEqual(enviosQuePrender([p({ nodo: 'esperar', espera: { modo: 'tiempo', minutos: 5 } })], { whatsapp: false, email: false }), { whatsapp: false, email: false });
});

// ── 4. Por la API se DICE lo que se prendió (10/11/2026): no hay otra pantalla que lo muestre ─────────────────────────────
// Probado rompiéndolo (10/11/2026): el resumen del doer sin `textoDeLoQuePrendio` → 1 rojo.
test('4. la activación por la API dice qué envío se prendió, y nada si no prendió ninguno', () => {
  assert.equal(textoDeLoQuePrendio({ whatsapp: false, email: false }), '');
  assert.match(textoDeLoQuePrendio({ whatsapp: false, email: true }), /email/);
  assert.match(textoDeLoQuePrendio({ whatsapp: true, email: true }), /WhatsApp y de email/);
  const doer = leer('lib/mako-doer-acciones.ts');
  const t = doer.slice(doer.indexOf("case 'nutricion_toggle': {"), doer.indexOf("case 'meta_nombre':"));
  assert.match(t, /const activacion = await setSecuenciaActiva\([^;]*\);\s*prendio = activacion\.prendio;/, 'el resumen lee lo que la activación prendió');
  assert.match(t, /const envio = textoDeLoQuePrendio\(prendio\);/);
  assert.match(t, /\$\{envio \? ` \$\{envio\}` : ''\}/, 'y lo pone en el resumen');
});
