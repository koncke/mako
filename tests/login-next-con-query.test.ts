// =============================================================================
// Una pestaña SIN sesión que entra a una página protegida vuelve, después del login, a la dirección ENTERA (25/10/2026)
// =============================================================================
// Lo vio Martín conectando la cuenta de MaKo por Zernio: Facebook lo devolvió a
// `/integraciones?abrir=meta&connected=metaads&accountId=…` en una pestaña sin sesión, el proxy lo mandó a
// `/login?abrir=meta&connected=…&next=%2Fintegraciones` y después del login terminó en /integraciones SIN el modal y sin la
// conexión. `next` llevaba sólo el pathname; la query quedaba colgada en /login (y un `error=` de Zernio se leía como error
// del login). Lo mismo le pasaba a la vuelta «de página entera» de `<ConectarViaZernio>` (teléfono, navegador de Instagram).
//
// Lo que se EJECUTA: el proxy de verdad (`proxy(new NextRequest(...))`), con el gate activo.
// PROBADO ROMPIÉNDOLO: con `next` = pathname (lo de antes) falla el primero; sin `url.search = ''`, el segundo.
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { proxy } from '../proxy';

// Con el secreto el gate está ACTIVO, como en producción (sin él, en local el proxy deja pasar todo).
process.env.AUTH_SECRET = 'secreto-de-prueba-del-login-0123456789abcdef';

const ir = (ruta: string) => {
  const r = proxy(new NextRequest(`https://hola-mako.com${ruta}`, { headers: { accept: 'text/html' } }));
  const loc = r.headers.get('location');
  assert.ok(loc, `sin redirect para ${ruta} (status ${r.status})`);
  return new URL(loc);
};

test('sin sesión, el login vuelve a la dirección ENTERA: la vuelta de Zernio conserva el modal y la conexión', () => {
  const u = ir('/integraciones?abrir=meta&connected=metaads&profileId=6ac3f7ec&accountId=6ade2518&request_id=b916&stage=callback');
  assert.equal(u.pathname, '/login');
  assert.equal(u.searchParams.get('next'), '/integraciones?abrir=meta&connected=metaads&profileId=6ac3f7ec&accountId=6ade2518&request_id=b916&stage=callback');
  // El negocio de la pestaña también viaja (lo lee `?ws=`).
  assert.equal(ir('/integraciones?ws=13&abrir=meta').searchParams.get('next'), '/integraciones?ws=13&abrir=meta');
  // Sin query, como siempre.
  assert.equal(ir('/integraciones').searchParams.get('next'), '/integraciones');
});

test('la query de la página no queda colgada en /login (un `error=` de Zernio no es un error del login)', () => {
  const u = ir('/integraciones?abrir=meta&error=reconnect_required&stage=callback');
  assert.deepEqual([...u.searchParams.keys()], ['next']);
});
