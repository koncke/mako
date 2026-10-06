// =============================================================================
// La ficha del lead, pedido del 06/10/2026 (seis puntos)
// =============================================================================
// 1. el desplegable de productos en el pop-up · 2. «Web» en lugar de «Dirección» ·
// 3. un solo botón de WhatsApp · 4. la foto de perfil (WhatsApp → email) · 5. sin
// «Reactivar» · 6. las sesiones de ENTREGA no son R2 (y los desplegables a la derecha).
//
// Lo puro se EJECUTA; el cableado se fija leyendo el fuente sin comentarios.
// PROBADO ROMPIÉNDOLO — el resultado de cada rotura está al lado de su test.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { esGrabacionDeEntrega } from '../lib/insights-llamada-reparto';
import { hrefDeWeb, candidatasDeFoto } from '../lib/contacto-lead';

const leer = (p: string) => readFileSync(p, 'utf8');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// ── 6. Entrega ≠ R2 ───────────────────────────────────────────────────────────
// Los casos son los MEDIDOS en producción (lead #21 del cliente más grande y los tres
// cierres en el mismo día de la R2).
//
// PROBADO ROMPIÉNDOLO: con `>=` en lugar de `>`, cae el caso «el mismo día del cierre»;
// comparando contra `fecha_primer_pago`, cae el caso del #21.
test('una sesión POSTERIOR al cierre ganado es entrega; la R2 del día del cierre o después del pago, no', () => {
  const ganado = { estado_lead: 'ganado', fecha_cierre: '2026-06-09' };
  assert.equal(esGrabacionDeEntrega({ fecha: '2026-07-08' }, ganado), true, 'sesión de julio: entrega');
  assert.equal(esGrabacionDeEntrega({ fecha: '2026-06-09' }, ganado), false, 'R2 el MISMO día del cierre: venta');
  // El #21 pagó el apartado el 29/05 (en la R1) y su R2 fue el 01/06: sigue siendo venta.
  assert.equal(esGrabacionDeEntrega({ fecha: '2026-06-01' }, ganado), false, 'R2 posterior al primer pago: venta');
  // Sin ganar, o sin fecha de cierre, nada es entrega por fecha.
  assert.equal(esGrabacionDeEntrega({ fecha: '2026-07-08' }, { estado_lead: 'abierto', fecha_cierre: '2026-06-09' }), false);
  assert.equal(esGrabacionDeEntrega({ fecha: '2026-07-08' }, { estado_lead: 'ganado', fecha_cierre: null }), false);
  // La categoría del Closing Analyst, cuando existe, decide sola.
  assert.equal(esGrabacionDeEntrega({ fecha: null, categoria: 'entrega_servicio' }, { estado_lead: 'abierto' }), true);
  // Con hora adentro se compara el día.
  assert.equal(esGrabacionDeEntrega({ fecha: '2026-06-10T01:00:00Z' }, { estado_lead: 'ganado', fecha_cierre: '2026-06-09T00:00:00Z' }), true);
});

// PROBADO ROMPIÉNDOLO: con la guarda borrada del webhook, cae.
test('el webhook de Fathom NO engancha una sesión de entrega como R2 (y sale antes de aplicar nada)', () => {
  const w = sinComentarios(leer('app/api/webhooks/fathom/route.ts'));
  const guarda = w.indexOf('if (esGrabacionDeEntrega({ fecha }, lead)) {');
  assert.ok(guarda > 0, 'falta la guarda');
  assert.match(w.slice(guarda, guarda + 400), /return Response\.json\(\{ ok: true, ignored: true, reason: 'sesion de entrega' \}\)/);
  // Y va ANTES de escribir, de disparar el evento y de pagar el análisis.
  assert.ok(guarda < w.indexOf('applyFathomRecording(lead,'), 'la guarda tiene que ir antes de applyFathomRecording');
  assert.ok(guarda < w.indexOf("dispararEvento('reunion.ocurrio'"), 'y antes del evento de R2');
});

// ── 2. Web ────────────────────────────────────────────────────────────────────
// PROBADO ROMPIÉNDOLO: sin el chequeo de esquema, `javascript:` pasa como link y cae.
test('la web se linkea con https:// si no trae esquema, y un esquema que no es http(s) NO se linkea', () => {
  assert.equal(hrefDeWeb('acme.com'), 'https://acme.com');
  assert.equal(hrefDeWeb('http://acme.com/x'), 'http://acme.com/x');
  assert.equal(hrefDeWeb('  https://acme.com  '), 'https://acme.com');
  assert.equal(hrefDeWeb('javascript:alert(1)'), null);
  assert.equal(hrefDeWeb('data:text/html,hola'), null);
  assert.equal(hrefDeWeb('dos palabras'), null);
  assert.equal(hrefDeWeb(''), null);
  assert.equal(hrefDeWeb(null), null);
});

test('«Dirección» se fue y «Web» se guarda, se audita, se deshace y tiene su columna', () => {
  const card = sinComentarios(leer('app/crm/lead-view/InfoPrincipalCard.tsx'));
  assert.doesNotMatch(card, /label="Dirección"/);
  assert.match(card, /label="Web"[\s\S]{0,200}onGuardar=\{guardar\('web', web\)\}/);
  const leads = sinComentarios(leer('lib/leads.ts'));
  assert.match(leads, /\{ k: 'web', label: 'Web' \}/, 'el historial lo audita');
  assert.match(leads, /if \(meta\.web !== undefined\) payload\.web = meta\.web;/, 'saveLeadMeta lo escribe');
  const acc = sinComentarios(leer('app/crm/actions.ts'));
  assert.match(acc, /case 'Web': await saveLeadMeta\(leadId, \{ web: v \}\); break;/, 'y se deshace desde el historial');
  assert.ok(existsSync('supabase/migrations/0194_lead_web.sql'));
  assert.match(leer('supabase/migrations/0194_lead_web.sql'), /alter table leads add column if not exists web text;/);
});

// ── 3. Un solo WhatsApp ───────────────────────────────────────────────────────
test('queda UN botón de WhatsApp en la ficha: el link al oficial se fue', () => {
  const card = sinComentarios(leer('app/crm/lead-view/InfoPrincipalCard.tsx'));
  assert.doesNotMatch(card, /\/whatsapp\?lead=/);
  assert.match(card, /<EnviarNoOficial /);
});

// ── 4. La foto ────────────────────────────────────────────────────────────────
// PROBADO ROMPIÉNDOLO: sin el `return []` de lo elegido, cae el primer assert.
test('la foto: lo elegido gana, después WhatsApp (con el ?ws=) y después el email; el email nunca va crudo', () => {
  assert.deepEqual(candidatasDeFoto({ avatarUrl: 'https://x/y.jpg', telefono: '5215555555555', fotoEmail: 'https://www.gravatar.com/avatar/abc?d=404&s=160' }, 7), []);
  const c = candidatasDeFoto({ telefono: '+52 1 55 5555 5555', fotoEmail: 'https://www.gravatar.com/avatar/abc?d=404&s=160' }, 7);
  assert.equal(c.length, 2);
  assert.match(c[0], /avatarimg=5215555555555/);
  assert.match(c[0], /[?&]ws=7/, 'sin el ?ws=, el super admin pediría la foto a SU línea');
  assert.match(c[1], /gravatar\.com\/avatar\/abc\?d=404/);
  assert.ok(c.every((u) => !u.includes('@')), 'un email crudo no viaja en una URL');
  assert.deepEqual(candidatasDeFoto({ telefono: '1234' }, null), [], 'menos de 8 dígitos no es un WhatsApp');
});

test('la cara va en la CABECERA de las dos puertas, y la tarjeta ya no dibuja otra', () => {
  for (const f of ['app/crm/LeadSheet.tsx', 'app/crm/[id]/LeadDetailBody.tsx']) {
    assert.match(sinComentarios(leer(f)), /<CaraDelLead nombre=/, `${f} no dibuja la cara`);
  }
  assert.doesNotMatch(sinComentarios(leer('app/crm/lead-view/InfoPrincipalCard.tsx')), /LeadFoto/);
  // La foto del email sale armada del server en las dos puertas.
  assert.match(sinComentarios(leer('app/crm/actions.ts')), /const fotoEmail = lead\.email\?\.trim\(\) \? urlGravatar\(lead\.email, 160\) : null;/);
  assert.match(sinComentarios(leer('app/crm/[id]/page.tsx')), /fotoEmail=\{lead\.email\?\.trim\(\) \? urlGravatar\(lead\.email, 160\) : null\}/);
});

// ── 1. El producto en el pop-up, con el NOMBRE del producto ─────────────────────
// PROBADO ROMPIÉNDOLO: con `nombre: f.nombre` de vuelta en la ruta, cae.
test('el pop-up tiene el desplegable de producto, y las dos puertas muestran el nombre del PRODUCTO', () => {
  const sheet = sinComentarios(leer('app/crm/LeadSheet.tsx'));
  assert.match(sheet, /<ProductoDelLead leadId=\{lead\.id\} funnelId=\{lead\.funnel_id \?\? null\} productos=\{productos\} \/>/);
  assert.ok(sheet.indexOf('<ProductoDelLead') < sheet.indexOf('ariaLabel="Cambiar etapa"'), 'el producto va ANTES de la etapa');
  for (const f of ['app/crm/actions.ts', 'app/crm/[id]/page.tsx']) {
    assert.match(sinComentarios(leer(f)), /nombre: f\.producto\?\.trim\(\) \|\| f\.nombre/, `${f} muestra «Funnel principal»`);
  }
});

// ── 5. Sin «Reactivar» ─────────────────────────────────────────────────────────
test('el aviso de datos sin marcar es siempre el mismo: sin «Reactivar»', () => {
  const card = sinComentarios(leer('app/crm/lead-view/DatosSinMarcarCard.tsx'));
  assert.doesNotMatch(card, /Reactivar|onReactivar|ignorado/);
  for (const f of ['app/crm/LeadSheet.tsx', 'app/crm/[id]/LeadDetailBody.tsx']) {
    assert.match(sinComentarios(leer(f)), /<DatosSinMarcarCard faltantes=\{faltantes\} onSolucionar=\{solucionar\} \/>/);
  }
});

// ── 6b. Los desplegables a la DERECHA ─────────────────────────────────────────
// PROBADO ROMPIÉNDOLO: sin el `marginLeft: 'auto'`, cae.
test('en la ruta, el bloque del nombre cede y la columna de producto/etapa queda a la derecha', () => {
  const b = sinComentarios(leer('app/crm/[id]/LeadDetailBody.tsx'));
  assert.match(b, /flex: '1 1 320px'/);
  assert.match(b, /alignItems: 'flex-end', gap: 8, flex: 'none', marginLeft: 'auto'/);
});
