// =============================================================================
// Toda ruta PÚBLICA que escribe tiene un tope de pedidos, o dice por qué no (17/10/2026)
// =============================================================================
// Al 15/10/2026, una de cada diez rutas de app/api tenía límite de pedidos, y de las que se
// atienden SIN sesión y escriben, casi ninguna (docs/relevo/ciberseguridad.md → punto 1). Lo caro
// no es «tirar el sitio»: un flood al opt-in le llena el CRM de basura a un cliente y le gasta IA.
//
// EL BARRIDO, en positivo: toda `app/api/**/route.ts` cuya ruta es pública (`esPublica`, la misma
// función que usa el proxy) y que exporta POST/PUT/PATCH/DELETE, o llama al limitador
// (lib/limite-publico.ts o lib/rate-limit.ts), o está en EXENTAS con su porqué. Una ruta pública
// nueva que escriba falla acá con su nombre.
//
// Probado rompiéndolo (17/10/2026), sobre los 2 de este archivo (base 2 / 0): sacando el
// `limitePorIp` del opt-in → 1 / 1 («app/api/track/optin/route.ts»); con `limitePorIp` que
// devuelve null siempre → 1 / 1 (el segundo).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { esPublica } from '../lib/rutas-publicas';

const leer = (f: string) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

/** Públicas que escriben SIN tope, cada una con su porqué. Por prefijo de archivo. */
const EXENTAS: Array<[string, string]> = [
  ['app/api/webhooks/', 'se autentican por FIRMA del proveedor (lo que no firma muere en un 401) y un 429 lo hace reintentar y deshabilitar la suscripción en silencio'],
  ['app/api/cron/', 'exigen el secreto del cron (checkCronAuth) antes de hacer nada'],
  ['app/api/promo-entrada/', 'no toca la base ni gasta nada: sólo firma una cookie para quien la pide, y mira el Origin'],
  ['app/api/email/unsubscribe/', 'el enlace firmado de un mail: darse de baja no puede fallar por un tope'],
  ['app/api/flow/puente/', 'la extensión del cliente, con su token de puente; sondea seguido a propósito'],
  ['app/api/montaje/worker/', 'el worker de montaje, con su secreto'],
  ['app/api/operaciones/cartero/', 'el cartero de operaciones, con su secreto'],
  ['app/api/auth/logout/', 'cerrar sesión: sólo borra cookies'],
  ['app/api/auth/callback/', 'la vuelta de Google: la autentica Google (state + código de un solo uso)'],
  ['app/api/auth/google/', 'arranca el login de Google: redirige, no escribe'],
  ['app/api/auth/dev-login/', 'sólo existe en desarrollo (cerrada en producción)'],
  ['app/api/auth/me/', 'lee la sesión propia'],
  ['app/api/agente/telemetria/', 'el hook del plugin reporta cada herramienta: con su token y su consentimiento; un tope perdería el registro'],
  ['app/api/agente/token/', 'acuñar el token exige SESIÓN de admin (no la atiende un anónimo)'],
  ['app/api/v1/', 'la API de MaKo tiene su propio límite por token (lib/api-mako/http.ts, x-ratelimit-*)'],
];

const LIMITA = /limitePorIp\(|limitePorClave\(|rateLimit\(|rateLimitEstado\(|:\s*rateLimit\b/;

test('cada ruta pública que escribe tiene tope de pedidos o una excusa escrita', () => {
  const rutas = execFileSync('git', ['ls-files', 'app/api'], { encoding: 'utf8' }).split('\n').filter((f) => f.endsWith('/route.ts'));
  const sinTope: string[] = [];
  let vistas = 0;
  for (const f of rutas) {
    const url = '/' + f.replace(/^app\//, '').replace(/\/route\.ts$/, '').replace(/\[[^\]]+\]/g, 'x');
    if (!esPublica(url)) continue;
    const src = leer(f);
    if (!/export (async )?function (POST|PUT|PATCH|DELETE)\b|export const (POST|PUT|PATCH|DELETE)\b/.test(src)) continue;
    vistas++;
    if (LIMITA.test(src)) continue;
    if (EXENTAS.some(([p]) => f.startsWith(p))) continue;
    sinTope.push(f);
  }
  assert.ok(vistas >= 20, `el barrido dejó de ver las rutas públicas (vio ${vistas})`);
  assert.deepEqual(sinTope, [], `rutas públicas que escriben sin tope de pedidos (lib/limite-publico.ts) ni excusa en EXENTAS:\n${sinTope.join('\n')}`);
});

test('el limitador corta de verdad y contesta 429 con Retry-After', async () => {
  const { limitePorIp } = await import('../lib/limite-publico');
  const req = new Request('https://x/api/y', { method: 'POST', headers: { 'x-forwarded-for': '203.0.113.7' } });
  const nombre = `prueba-${Date.now()}`;
  for (let i = 0; i < 3; i++) assert.equal(limitePorIp(req, nombre, 3, 60_000), null, `el pedido ${i + 1} entra`);
  const cuarto = limitePorIp(req, nombre, 3, 60_000);
  assert.ok(cuarto, 'el cuarto pedido tiene que frenarse');
  assert.equal(cuarto.status, 429);
  assert.equal(cuarto.headers.get('retry-after'), '60');
  // Otra IP no comparte el contador.
  const otra = new Request('https://x/api/y', { method: 'POST', headers: { 'x-forwarded-for': '203.0.113.8' } });
  assert.equal(limitePorIp(otra, nombre, 3, 60_000), null);
});
