// =============================================================================
// Hijo de tests/push-apns.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// `enviarApns` REAL contra un servidor HTTP/2 local que contesta como Apple, y `enviarPushAUsuario` real sobre el PostgREST de mentira.
// Necesita `--conditions=react-server`.
// =============================================================================

import http2 from 'node:http2';
import { generateKeyPairSync } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const RAIZ = new URL('..', import.meta.url);
const imp = (p: string) => import(pathToFileURL(new URL(p, RAIZ).pathname.replace(/^\/([A-Za-z]:)/, '$1')).href);
type Fila = Record<string, unknown>;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const TOKEN = (c: string) => c.repeat(64);

async function main() {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const p8 = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const publica = publicKey.export({ type: 'spki', format: 'pem' }).toString();

  const recibidos: Array<{ path: string; cabeceras: Record<string, unknown>; cuerpo: string }> = [];
  const servidor = http2.createServer();
  servidor.on('stream', (s, h) => {
    let cuerpo = '';
    s.setEncoding('utf8');
    s.on('data', (d) => { cuerpo += d; });
    s.on('end', () => {
      recibidos.push({ path: String(h[':path']), cabeceras: { ...h }, cuerpo });
      const token = String(h[':path']).split('/').pop() ?? '';
      if (token.startsWith('dd')) { s.respond({ ':status': 410 }); s.end(JSON.stringify({ reason: 'Unregistered' })); return; }
      if (token.startsWith('ee')) { s.respond({ ':status': 403 }); s.end(JSON.stringify({ reason: 'InvalidProviderToken' })); return; }
      s.respond({ ':status': 200 });
      s.end();
    });
  });
  await new Promise<void>((r) => { servidor.listen(0, '127.0.0.1', () => r()); });
  const puerto = (servidor.address() as { port: number }).port;

  const { crearPostgrest } = await imp('tests/_postgrest-de-mentira.ts');
  const pg = crearPostgrest({ tablas: ['app_settings', 'workspaces', 'usuarios', 'credenciales', 'push_suscripciones'] });
  const db = pg.db as Record<string, Fila[]>;
  globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
    const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : (entrada as Request).url);
    if (u.host === 'supa.test') return pg.responder(u, init);
    return json(500, { error: `red de mentira: ${u.host}` });
  }) as typeof fetch;

  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
  process.env.SUPABASE_URL = 'http://supa.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
  process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-para-cifrar-las-credenciales-R';
  process.env.APP_BASE_URL = 'https://mako.test';
  process.env.AUTH_SECRET = 'secreto-de-firma-de-prueba';

  const { enviarApns, clavesApns } = await imp('lib/push-apns.ts');
  const { armarApns, clavesApnsDe, endpointDeApns } = await imp('lib/push-apns-reglas.ts');

  const c = clavesApnsDe({ keyId: 'ABC123DEFG', teamId: 'XYZ987WVUT', p8 });
  const envio = armarApns({ titulo: 'MaKo', cuerpo: 'Te pide confirmar', url: 'https://hola-mako.com/mako/pendientes', tag: 'mako-pendiente' }, { ttlSegundos: 7200, urgencia: 'high', ahoraMs: Date.UTC(2026, 10, 3) });
  const R: Record<string, unknown> = {};
  R.respuestas = await enviarApns([endpointDeApns(TOKEN('a')), endpointDeApns(TOKEN('d')), endpointDeApns(TOKEN('e'))], envio, c, `http://127.0.0.1:${puerto}`);
  R.recibidos = recibidos;
  R.publica = publica;

  // El camino entero, sin las claves de Apple: la fila de un iPhone sigue, y nunca le llega a web-push.
  const { VAPID } = { VAPID: 'WEB_PUSH_VAPID' };
  db.workspaces.push({ id: 9, nombre: 'MaKo', capa: 'superadmin', estado: 'activo' });
  db.usuarios.push({ id: 1, email: 'a@test.com', rol: 'admin', rol_ws: null, workspace_id: 9, estado: 'activo', perfil: {} });
  const { cifrarSecreto } = await imp('lib/credenciales.ts');
  const webpush = (await import('web-push')).default;
  const v = webpush.generateVAPIDKeys();
  db.credenciales.push({ workspace_id: 9, clave: VAPID, valor_enc: cifrarSecreto(JSON.stringify(v), 9, VAPID), servicio: 'web-push' });
  db.push_suscripciones.push({ id: 1, usuario_id: 1, endpoint: endpointDeApns(TOKEN('b')), p256dh: 'apns-sin-clave', auth: 'apns-sin-clave', fallos: 0 });
  R.clavesSinCargar = await clavesApns();
  const { enviarPushAUsuario } = await imp('lib/push.ts');
  R.sinClaves = await enviarPushAUsuario(1, 9, { tipo: 'prueba', titulo: 'Hola', cuerpo: 'Una prueba', urgencia: 'high', ttl: 120 });
  R.filaSinClaves = { ...db.push_suscripciones[0] };

  servidor.close();
  process.stdout.write(`@@RESULTADO@@${JSON.stringify(R)}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
