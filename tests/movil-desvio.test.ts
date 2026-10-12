// Un teléfono no ve el escritorio (lib/movil-desvio.ts).
// Verificado rompiéndolo (11/10/2026), de a una: sin el chequeo de esRutaMovil → 1 fallo
// («/m no se tapa»); sacando '/onboarding' de SE_ABREN_IGUAL → 1 fallo; devolviendo 'computadora'
// en vez de 'ir' cuando hay equivalente → 2 fallos.
// v2 (11/10/2026): las secciones de More (Dashboard, Ads Manager, Customer Success, Automations,
// Video y Landing) dejaron de ser «en la computadora»: van a su sección de /m. Roto sacando
// `/ads-manager` de `rutaMovil` (lib/movil-rutas.ts): 5 pasan / 1 falla (el test v2).
// Integración v2 (11/10/2026, con MOVIL_ACTIVO prendido; base 9 / 0), de a una y restaurando
// (scratchpad/integ/romper.py):
//   · sin el `esPublica` (lo público se tapaba: el comprador que vuelve de pagar)   → 8 / 1
// 12/10/2026: el admin sin cliente ya NO queda afuera (era Martín y veía el escritorio): va a /m de SU
// negocio. Roto de a uno: destinoMovil sin el workspace propio, el layout sin wsPropio, el guard
// redirigiendo a /inicio, y /inicio mandándolo a /customer-success en el teléfono. Medido (base 9 / 0):
//   · el guard de vuelta a redirect('/inicio')                                     → 8 / 1
//   · destinoMovil devolviendo el destino sin el workspace propio                  → 8 / 1
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decidirDesvio, destinoMovil, seDesvia, MOVIL_ACTIVO } from '../lib/movil-desvio';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('/m y la landing pública no se tapan', () => {
  for (const p of ['/m', '/m/hoy', '/m/crm/12', '/m/mas', '/', '/vsl', '/login', '/privacidad']) {
    assert.deepEqual(decidirDesvio(p), { tipo: 'nada' }, p);
  }
});

test('lo PÚBLICO no se tapa nunca: lo abre un visitante sin cuenta de MaKo', () => {
  // El comprador que vuelve de pagar, los reembolsos, una landing publicada y el Pixel.
  for (const p of ['/pagar/abc123/listo', '/reembolsos', '/l/mi-landing', '/terminos', '/m.js', '/compartido/x']) {
    assert.deepEqual(decidirDesvio(p), { tipo: 'nada' }, p);
  }
});

test('el login, el wizard del onboarding y el alumno se abren igual', () => {
  for (const p of ['/login', '/onboarding', '/onboarding/paso-2', '/mi-curso', '/logout']) {
    assert.deepEqual(decidirDesvio(p), { tipo: 'nada' }, p);
  }
});

test('lo que tiene versión móvil va a /m', () => {
  assert.deepEqual(decidirDesvio('/general'), { tipo: 'ir', destino: '/m/hoy' });
  assert.deepEqual(decidirDesvio('/crm/412/resumen'), { tipo: 'ir', destino: '/m/crm/412' });
  assert.deepEqual(decidirDesvio('/mako/pendientes'), { tipo: 'ir', destino: '/m/inbox' });
  assert.deepEqual(decidirDesvio('/configuraciones', '?tab=notif'), { tipo: 'ir', destino: '/m/cuenta' });
});

test('v2: las secciones de More (y sus subrutas) van a su pantalla de /m, no a «en la computadora»', () => {
  const casos: [string, string, string?][] = [
    ['/dashboard', '/m/dashboard'], ['/marketing', '/m/dashboard'], ['/comercial', '/m/dashboard?hoja=comercial'],
    ['/dashboard', '/m/dashboard?hoja=comercial', '?hoja=comercial&ws=3'],
    ['/ads-manager', '/m/ads'], ['/ads-manager/120330001', '/m/ads'],
    ['/customer-success', '/m/cs'], ['/customer-success/curso', '/m/cs'],
    ['/automations', '/m/automations'], ['/setting', '/m/automations'], ['/chatbot', '/m/automations'],
    ['/video-generator', '/m/video'],
    ['/video-generator', '/m/video/3f2b8c1e-9a4d-4c6b-8e2f-0a1b2c3d4e5f', '?plan=3f2b8c1e-9a4d-4c6b-8e2f-0a1b2c3d4e5f'],
    ['/landing-generator', '/m/landing'], ['/landing-generator/42', '/m/landing/42'], ['/landing-writer', '/m/landing'],
  ];
  for (const [p, destino, q] of casos) assert.deepEqual(decidirDesvio(p, q ?? ''), { tipo: 'ir', destino }, `${p}${q ?? ''}`);
});

test('lo que no va al teléfono dice que se usa en la computadora', () => {
  for (const p of ['/whatsapp', '/configuraciones', '/marketing/salud', '/ads-writer', '/funnel', '/metodo', '/mensajes']) {
    assert.deepEqual(decidirDesvio(p), { tipo: 'computadora' }, p);
  }
});

test('/mako no se confunde con /m (pero tiene su versión móvil)', () => {
  assert.deepEqual(decidirDesvio('/mako'), { tipo: 'ir', destino: '/m/mako' });
});

test('el interruptor está PRENDIDO (Martín, 11/10 21:54: «a cualquiera que entre desde mobile»)', () => {
  assert.equal(MOVIL_ACTIVO, true);
});

test('el admin global SIN cliente SÍ se desvía, a SU negocio (Martín, 12/10: «me sale todo igual»)', () => {
  assert.equal(seDesvia({ activo: true, telefono: true }), true);
  assert.equal(seDesvia({ activo: true, telefono: false }), false);
  assert.equal(seDesvia({ activo: false, telefono: true }), false);
  // Sin pestaña, el destino lleva el workspace propio; con una, el router de app/_ui/Link ya la lleva.
  assert.equal(destinoMovil('/m/plan', null, 9), '/m/plan?ws=9');
  assert.equal(destinoMovil('/m/plan', 13, 9), '/m/plan');
  assert.equal(destinoMovil('/m/plan', null, null), '/m/plan');
  // El layout le pasa el workspace propio al desvío SÓLO al admin sin cliente.
  // (Texto literal, sin regex: son líneas de código con paréntesis y signos de pregunta.)
  const layout = leer('app/layout.tsx');
  assert.ok(layout.includes('wsPropioMovil = telefono && esAdmin && (await getWorkspaceActual()) == null ? await wsSuperAdmin() : null'), 'el layout no resuelve el workspace propio');
  assert.ok(layout.includes('<DesvioMovil telefono={telefono} wsPropio={wsPropioMovil} />'), 'el layout no se lo pasa al desvío');
  // El bucle se corta en la raíz: el guard de /m ya no lo manda a /inicio sino a su negocio.
  const guard = leer('lib/movil-guard.ts');
  assert.ok(guard.includes("if (ctx.ws == null && ctx.sesion.rol === 'admin') redirect(conWs(HOME_MOVIL, await wsSuperAdmin()));"), 'el guard no manda al admin sin cliente a su negocio');
  assert.ok(!guard.includes("redirect('/inicio')"), 'volvió el rebote a /inicio: con el desvío prendido, un bucle');
  // Y /inicio, en un teléfono, lo manda a /m (no a /customer-success, que el desvío taparía).
  assert.ok(leer('app/inicio/page.tsx').includes("if (ws == null) redirect(telefono ? '/m' : '/customer-success');"), '/inicio no reparte al teléfono');
});
