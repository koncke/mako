// Un teléfono no ve el escritorio (lib/movil-desvio.ts).
// Verificado rompiéndolo (11/10/2026), de a una: sin el chequeo de esRutaMovil → 1 fallo
// («/m no se tapa»); sacando '/onboarding' de SE_ABREN_IGUAL → 1 fallo; devolviendo 'computadora'
// en vez de 'ir' cuando hay equivalente → 2 fallos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decidirDesvio } from '../lib/movil-desvio';

test('/m y la landing pública no se tapan', () => {
  for (const p of ['/m', '/m/hoy', '/m/crm/12', '/', '/vsl', '/login', '/privacidad']) {
    assert.deepEqual(decidirDesvio(p), { tipo: 'nada' }, p);
  }
});

test('el wizard del onboarding se abre igual: /m/configurar manda ahí', () => {
  assert.deepEqual(decidirDesvio('/onboarding'), { tipo: 'nada' });
});

test('lo que tiene versión móvil va a /m', () => {
  assert.deepEqual(decidirDesvio('/general'), { tipo: 'ir', destino: '/m/hoy' });
  assert.deepEqual(decidirDesvio('/crm/412/resumen'), { tipo: 'ir', destino: '/m/crm/412' });
  assert.deepEqual(decidirDesvio('/mako/pendientes'), { tipo: 'ir', destino: '/m/inbox' });
  assert.deepEqual(decidirDesvio('/configuraciones', '?tab=notif'), { tipo: 'ir', destino: '/m/cuenta' });
});

test('lo que no va al teléfono dice que se usa en la computadora', () => {
  for (const p of ['/ads-manager', '/dashboard', '/automations', '/whatsapp', '/customer-success', '/configuraciones']) {
    assert.deepEqual(decidirDesvio(p), { tipo: 'computadora' }, p);
  }
});

test('/m.js (el Pixel) y /mako no se confunden con /m', () => {
  assert.equal(decidirDesvio('/mako').tipo, 'ir');
  assert.equal(decidirDesvio('/marketing').tipo, 'computadora');
});
