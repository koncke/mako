// =============================================================================
// Hijo de tests/zernio-uso.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// El conteo de mensajes de Zernio del ciclo (29/10/2026): lib/zernio-uso.ts REAL (`server-only`, en un node aparte con
// `--conditions=react-server`), sobre el PostgREST de mentira y la API de Zernio de mentira (sólo `GET /v1/billing`), en el ws 3
// y el ws 1. Imprime lo que contestó y lo que se le pidió a Zernio.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

const WS = 3;
const pg = crearPostgrest({ tablas: ['credenciales', 'app_settings', 'workspaces', 'nutricion_envios', 'ig_mensajes'] });
const db = pg.db;
const red: string[] = [];
const pedidos: string[] = [];
/** Lo que contesta GET /v1/billing: un cuerpo (200) o un status de error. */
let billing: { status: number; body: unknown } = { status: 200, body: null };
/** Las lecturas de esta tabla contestan 500 (la base caída a medias). */
let tablaCaida: string | null = null;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  const metodo = (init.method ?? 'GET').toUpperCase();
  if (u.host === 'supa.test') {
    if (tablaCaida && u.pathname.endsWith(`/${tablaCaida}`)) return json(500, { code: 'XX000', message: 'la base no contestó' });
    return pg.responder(u, init);
  }
  if (u.host === 'zernio.com') {
    const ruta = u.pathname.replace(/^\/api\/v1/, '');
    pedidos.push(`${metodo} ${ruta}${u.search}`);
    if (ruta === '/billing') return json(billing.status, billing.status === 200 ? billing.body : { error: 'Internal error' });
    return json(404, { error: `sin mock: ${ruta}` });
  }
  red.push(`${metodo} ${u.host}${u.pathname}`);
  return json(500, { error: 'red de mentira' });
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-para-cifrar-las-credenciales';
process.env.ZERNIO_API_KEY = 'sk_zernio_de_la_plataforma';

/** El ciclo como lo manda Zernio (medido con el ws10: `+00:00`, del día del alta al 1.º). */
const BILLING = { billingSystem: 'metronome', period: { start: '2026-10-12T03:00:00+00:00', end: '2026-11-01T00:00:00+00:00', anchorDay: 12 } };
const EN_EL_CICLO = '2026-10-20T15:00:00.000Z';
const ANTES = '2026-10-11T23:00:00.000Z';
const DESPUES = '2026-11-01T00:00:00.000Z';

async function main() {
  const { cifrar } = await import('../lib/cripto-credenciales');
  const { usoZernioDelCiclo } = await import('../lib/zernio-uso');

  let nId = 0;
  const envio = (ws: number, canal: string, estado: string, created_at: string) =>
    db.nutricion_envios.push({ id: ++nId, workspace_id: ws, lead_id: 1, canal, estado, created_at });
  const mensaje = (ws: number, direccion: string, estado: string, created_at: string) =>
    db.ig_mensajes.push({ id: ++nId, workspace_id: ws, conversacion_id: 1, direccion, estado, created_at });
  const reset = () => {
    pg.vaciar();
    pedidos.length = 0; red.length = 0; tablaCaida = null;
    billing = { status: 200, body: BILLING };
    db.workspaces.push({ id: WS, nombre: 'Prueba', capa: 'cliente' }, { id: 1, nombre: 'Mauricio', capa: 'cliente' }, { id: 9, nombre: 'MaKo', capa: 'superadmin' });
    db.credenciales.push({ workspace_id: WS, clave: 'ZERNIO_API_KEY', valor_enc: cifrar('sk_zernio_prueba', WS, 'ZERNIO_API_KEY'), servicio: 'zernio' });
  };
  const correr = (ws = WS) => usoZernioDelCiclo(ws).catch((e) => ({ tira: e instanceof Error ? e.message : String(e) }));
  const out: Record<string, unknown> = {};

  // (a) Lo que cuenta: el motor (canal instagram o messenger, 'enviado') y Chats (saliente 'enviado'), DENTRO del ciclo y del negocio.
  //     Lo que no: un fallo, una acción, WhatsApp, lo entrante, un saliente con error, lo de antes o después del ciclo, otro negocio.
  reset();
  envio(WS, 'instagram', 'enviado', EN_EL_CICLO);
  envio(WS, 'instagram', 'enviado', '2026-10-12T03:00:00.000Z');
  envio(WS, 'messenger', 'enviado', EN_EL_CICLO);
  envio(WS, 'instagram', 'fallo', EN_EL_CICLO);
  envio(WS, 'instagram', 'accion', EN_EL_CICLO);
  envio(WS, 'whatsapp', 'enviado', EN_EL_CICLO);
  envio(WS, 'instagram', 'enviado', ANTES);
  envio(WS, 'instagram', 'enviado', DESPUES);
  envio(13, 'instagram', 'enviado', EN_EL_CICLO);
  mensaje(WS, 'saliente', 'enviado', EN_EL_CICLO);
  mensaje(WS, 'saliente', 'enviado', '2026-10-31T23:59:59.000Z');
  mensaje(WS, 'entrante', 'recibido', EN_EL_CICLO);
  mensaje(WS, 'saliente', 'error', EN_EL_CICLO);
  mensaje(WS, 'saliente', 'enviado', ANTES);
  mensaje(13, 'saliente', 'enviado', EN_EL_CICLO);
  out.a = { r: await correr(), pedidos: [...pedidos] };

  // (b) Sin Zernio: null (no se avisa), y a Zernio no se le pide nada.
  reset();
  db.credenciales.length = 0;
  out.b = { r: await correr(), pedidos: [...pedidos] };

  // (c) El ciclo no se pudo leer (500), o vino sin el período, o al revés: null. Nunca un mes inventado.
  reset();
  billing = { status: 500, body: null };
  const c500 = await correr();
  billing = { status: 200, body: { billingSystem: 'stripe', period: { anchorDay: 12 } } };
  const sinPeriodo = await correr();
  billing = { status: 200, body: { period: { start: '2026-11-01T00:00:00Z', end: '2026-10-12T03:00:00Z' } } };
  const alReves = await correr();
  out.c = { c500, sinPeriodo, alReves };

  // (d) La base no contestó (una de las dos tablas): null, nunca un conteo a medias ni 0.
  reset();
  envio(WS, 'instagram', 'enviado', EN_EL_CICLO);
  tablaCaida = 'ig_mensajes';
  const sinChats = await correr();
  tablaCaida = 'nutricion_envios';
  out.d = { sinChats, sinMotor: await correr() };

  // (e) El ws1 habla con la clave de la cuenta de MaKo (`byok` false): `deLaCasa`.
  reset();
  db.credenciales.push({ workspace_id: 1, clave: 'ZERNIO_API_KEY', valor_enc: cifrar('sk_zernio_de_la_plataforma', 1, 'ZERNIO_API_KEY'), servicio: 'zernio' });
  out.e = { ws1: await correr(1), ws3: await correr(WS) };

  out.red = [...red];
  process.stdout.write(`\n@@RESULTADO@@${JSON.stringify(out)}`, () => process.exit(0));
}

void main().catch((e) => { process.stdout.write(`\n@@RESULTADO@@${JSON.stringify({ tiro: e instanceof Error ? e.stack : String(e) })}`, () => process.exit(0)); });

export {};
