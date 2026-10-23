// =============================================================================
// El aviso al equipo no se queda vacío por un dato que falta (23/10/2026)
// =============================================================================
// La #289 «Sprint · apertura» del ws1: la rama «Contestó» avisaba con UN renglón
// («… Teléfono: {{lead_telefono}} | Email: {{lead_email}} | Chat: {{link_chat_lead}}»). La lead que contestó no tenía
// email, `sinRenglonesVacios` borró el renglón entero y el envío 183 quedó en 'fallo' con «El aviso quedó vacío.».
// `textoConDatosParaEquipo` (lib/variables-del-lead.ts) deja la regla de siempre y, si sin el renglón no queda nada,
// manda el texto entero con «—» en el dato que falta.
//
// Correr: node --import tsx --test tests/aviso-equipo-no-vacio.test.ts
// Probado rompiéndolo (23/10/2026, base 5/0): ver el pie del archivo.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { textoConDatos, textoConDatosParaEquipo, SIN_DATO_EQUIPO } from '../lib/variables-del-lead';

const UN_RENGLON = '{{nombre_completo}} respondió en la automatización de Apertura. Teléfono: {{lead_telefono}} | Email: {{lead_email}} | Chat: {{link_chat_lead}}';
const SIN_EMAIL = { nombre_completo: 'María del Carmen', lead_telefono: '526862506026', link_chat_lead: 'https://hola-mako.com/chats?lead=3100&ws=1' };

test('el renglón único de la #289, con una lead sin email, sale entero con «—» en el email', () => {
  assert.equal(textoConDatos(UN_RENGLON, SIN_EMAIL), '', 'la regla de siempre ya no lo vacía: este test mira otra cosa');
  const t = textoConDatosParaEquipo(UN_RENGLON, SIN_EMAIL);
  assert.equal(t, `María del Carmen respondió en la automatización de Apertura. Teléfono: 526862506026 | Email: ${SIN_DATO_EQUIPO} | Chat: https://hola-mako.com/chats?lead=3100&ws=1`);
});

test('con renglones, la regla de siempre: se va sólo el renglón del dato que falta, sin «—»', () => {
  const partido = '{{nombre_completo}} respondió.\nTeléfono: {{lead_telefono}}\nEmail: {{lead_email}}\nChat: {{link_chat_lead}}';
  const t = textoConDatosParaEquipo(partido, SIN_EMAIL);
  assert.equal(t, 'María del Carmen respondió.\nTeléfono: 526862506026\nChat: https://hola-mako.com/chats?lead=3100&ws=1');
  assert.ok(!t.includes(SIN_DATO_EQUIPO));
});

test('un texto que era SÓLO datos queda vacío (no se avisa un guion), y lo desconocido sigue crudo', () => {
  assert.equal(textoConDatosParaEquipo('{{lead_email}}', SIN_EMAIL), '');
  assert.equal(textoConDatosParaEquipo('📧 {{lead_email}}', SIN_EMAIL), '');
  const raro = 'Contestó {{lead_email}} {{no_existe_xyz}}';
  // Con un token desconocido el renglón se queda (`sinRenglonesVacios`): la red no hace falta y el email sale crudo, como siempre.
  assert.equal(textoConDatosParaEquipo(raro, SIN_EMAIL), textoConDatos(raro, SIN_EMAIL));
});

test('un dato puesto en vacío es un valor: no se reemplaza por «—»', () => {
  assert.equal(textoConDatosParaEquipo('Hola {{lead_email}}', { lead_email: '' }), 'Hola ');
});

test('el aviso de la tarjeta MaKo (`textoDelAviso`) usa la red del equipo', () => {
  const src = readFileSync(new URL('../lib/api-mako/areas/chatbot.run.ts', import.meta.url), 'utf8');
  const ini = src.indexOf('async function textoDelAviso(');
  const cuerpo = src.slice(ini, src.indexOf('\n}\n', ini));
  assert.ok(ini > 0 && cuerpo.length < 2_500, 'no encontré textoDelAviso');
  assert.match(cuerpo, /return textoConDatosParaEquipo\(/);
  assert.doesNotMatch(cuerpo.replace(/^\s*\/\/.*$/gm, ''), /\btextoConDatos\(/, 'volvió la regla que vacía el aviso');
});

// ── Probado rompiéndolo (23/10/2026), de a una y restaurando. Base 5/0 ──
// R1 `textoConDatosParaEquipo` devuelve `lleno` siempre                      → 4/1
// R2 sin el chequeo de texto propio (`if (!propio) return lleno;`)           → 4/1
// R3 `textoDelAviso` vuelve a `textoConDatos`                                → 4/1
