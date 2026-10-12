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
//   · `seDesvia` sin mirar `adminSinCliente` (el bucle del admin sin cliente)       → 8 / 1
//   · el layout raíz sin pasarle `adminSinCliente` a `seDesvia`                     → 8 / 1
//   · /inicio repartiendo a los teléfonos ANTES de sacar al admin sin cliente       → 8 / 1
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decidirDesvio, seDesvia, MOVIL_ACTIVO } from '../lib/movil-desvio';

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

test('el admin global SIN cliente no se desvía: sería un bucle /customer-success → /m/cs → /inicio', () => {
  assert.equal(seDesvia({ activo: true, telefono: true, adminSinCliente: false }), true);
  assert.equal(seDesvia({ activo: true, telefono: true, adminSinCliente: true }), false);
  assert.equal(seDesvia({ activo: true, telefono: false, adminSinCliente: false }), false);
  assert.equal(seDesvia({ activo: false, telefono: true, adminSinCliente: false }), false);
  // El layout raíz se lo pasa, y /inicio saca al admin sin cliente ANTES de repartir teléfonos.
  assert.match(leer('app/layout.tsx'), /seDesvia\(\{[\s\S]*adminSinCliente:[^\n]*getWorkspaceActual\(\)/);
  const inicio = leer('app/inicio/page.tsx');
  const admin = inicio.indexOf("redirect('/customer-success')");
  const movil = inicio.indexOf('prefiereMovil()');
  assert.ok(admin > 0 && movil > admin, 'el admin sin cliente sale antes del reparto a /m');
});
