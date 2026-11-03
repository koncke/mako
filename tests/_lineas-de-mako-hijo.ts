// =============================================================================
// Hijo de tests/lineas-de-mako.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre REAL `vigilarLineasDeMako`, con su `enviarTexto`, su `elegirLinea`, sus settings y su mail, sobre un PostgREST de mentira y
// un Evolution en memoria. Las respuestas de Evolution tienen la forma medida el 03/11/2026 contra producción, incluido el
// `disconnectionObject` de la caída de ese día y el 404 de una instancia que no existe. Lo que mira es a dónde salió cada mensaje.
// Necesita `--conditions=react-server`.

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.SUPABASE_URL = 'http://supa.test';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-de-prueba';
process.env.SUPABASE_SERVICE_KEY = 'clave-de-prueba';
process.env.AUTH_SECRET = 'secreto-de-firma-de-prueba-suficientemente-largo';
process.env.EVOLUTION_BASE_URL = 'http://evo.test';
process.env.EVOLUTION_API_KEY = 'clave-evo';
process.env.RESEND_API_KEY = 're_de_prueba';
process.env.APP_BASE_URL = 'https://hola-mako.com';
process.env.CREDENCIALES_SECRET = 'secreto-de-cifrado-de-prueba-suficientemente-largo';

const PLATAFORMA = 9;
const P = 'mako_superadmin_muylqv8r';
const S = 'mako_ws9';
const NUM_P = '5491100002605';
const NUM_S = '5493764673479';

const pg = crearPostgrest({
  tablas: ['app_settings', 'workspaces', 'evolution_instancias', 'usuarios'],
  unicos: [{ tabla: 'app_settings', columnas: ['workspace_id', 'key'], donde: () => true, nombre: 'app_settings_uk' }],
});
const db = pg.db as Record<string, Array<Record<string, unknown>>>;
db.workspaces = [
  { id: 1, nombre: 'Un cliente', capa: 'completo', estado: 'activo' },
  { id: PLATAFORMA, nombre: 'Martin Koncke', capa: 'superadmin', estado: 'activo' },
];
db.evolution_instancias = [
  { id: 7, workspace_id: PLATAFORMA, instance_name: S, es_default: true, numero: NUM_S, estado: 'conectado', ultima_conexion_at: '2026-11-03T19:41:39.282Z' },
];
db.app_settings = [
  { workspace_id: 1, key: 'mako.voz.instancia', value: P },
  { workspace_id: 1, key: 'mako.canal.instancia', value: P },
];
db.usuarios = [];

type Linea = { connectionStatus: string; codigo: number | null; numero: string } | null;
const lineas: Record<string, Linea> = {
  [P]: { connectionStatus: 'close', codigo: 403, numero: NUM_P },
  [S]: { connectionStatus: 'open', codigo: null, numero: NUM_S },
};
let enviados: Array<{ linea: string; numero: string; texto: string }> = [];
let mails: Array<{ from: string; to: unknown; subject: string; text: string }> = [];
let conectadas: string[] = [];
let tocadas: string[] = [];

globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : (entrada as Request).url);
  const json = (status: number, b: unknown) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });
  if (u.host === 'supa.test') return pg.responder(u, init);
  if (u.host === 'api.resend.com') {
    mails.push(JSON.parse(String(init.body)));
    return json(200, { id: 'mail-1' });
  }
  if (u.host !== 'evo.test') throw new Error(`fetch sin mock: ${u.href}`);
  const instancia = decodeURIComponent(u.pathname.split('/').pop() ?? '');
  if (u.pathname === '/instance/fetchInstances') {
    const nombre = u.searchParams.get('instanceName') ?? '';
    if (nombre === 'mako_filtro_ignorado') return json(200, [{ name: P, connectionStatus: 'open', ownerJid: `${NUM_P}@s.whatsapp.net`, disconnectionReasonCode: null, disconnectionAt: null }]);
    const l = lineas[nombre];
    if (!l) return json(404, { status: 404, error: 'Not Found', response: { message: [`Instance "${nombre}" not found`] } });
    return json(200, [{
      name: nombre, connectionStatus: l.connectionStatus, ownerJid: `${l.numero}@s.whatsapp.net`,
      disconnectionReasonCode: l.codigo, disconnectionAt: l.codigo ? '2026-11-03T19:39:36.189Z' : null,
      disconnectionObject: l.codigo ? '{"error":{"data":{"reason":"403","location":"rva"},"output":{"statusCode":403}}}' : null,
    }]);
  }
  if (u.pathname.startsWith('/chat/fetchBusinessProfile/')) {
    const l = lineas[instancia];
    if (!l) return json(404, { status: 404, error: 'Not Found', response: { message: [`The "${instancia}" instance does not exist`] } });
    return l.connectionStatus === 'open' ? json(200, { isBusiness: false }) : json(500, { status: 500, error: 'Internal Server Error', response: { message: ['Error: Connection Closed'] } });
  }
  if (u.pathname.startsWith('/message/sendText/')) {
    const body = JSON.parse(String(init.body)) as { number: string; text: string };
    if (lineas[instancia]?.connectionStatus !== 'open') return json(500, { status: 500, error: 'Internal Server Error', response: { message: ['Error: Connection Closed'] } });
    enviados.push({ linea: instancia, numero: body.number, texto: body.text });
    return json(201, { key: { id: `m${enviados.length}`, remoteJid: `${body.number}@s.whatsapp.net` } });
  }
  if (u.pathname.startsWith('/instance/connect/')) { conectadas.push(instancia); return json(200, { instance: { state: 'connecting' } }); }
  tocadas.push(`${init.method ?? 'GET'} ${u.pathname}`);
  return json(200, {});
}) as typeof fetch;

async function main() {
  const { vigilarLineasDeMako } = await import('../lib/lineas-de-mako-vigilante');
  const { fotoDeLinea } = await import('../lib/evolution');
  const out: Record<string, unknown> = {};
  const vuelta = async () => {
    enviados = []; mails = []; conectadas = [];
    const r = await vigilarLineasDeMako();
    return { r, enviados, mails, conectadas };
  };

  out.fotoCaida = await fotoDeLinea(P);
  out.fotoNoExiste = await fotoDeLinea('mako_no_existe');
  out.fotoFiltroIgnorado = await fotoDeLinea('mako_filtro_ignorado');

  out.caida = await vuelta();
  out.repite = await vuelta();

  lineas[P] = { connectionStatus: 'open', codigo: 403, numero: NUM_P };
  out.volvio = await vuelta();

  lineas[S] = { connectionStatus: 'close', codigo: 401, numero: NUM_S };
  out.secundariaCaida = await vuelta();

  lineas[P] = { connectionStatus: 'close', codigo: 403, numero: NUM_P };
  out.lasDos = await vuelta();

  lineas[P] = { connectionStatus: 'open', codigo: 403, numero: NUM_P };
  lineas[S] = { connectionStatus: 'open', codigo: 401, numero: NUM_S };
  await vuelta();

  // Un corte que Evolution abandonó: se reabre, sin avisar todavía (la primera medición sólo fija el «desde»).
  lineas[S] = { connectionStatus: 'close', codigo: 428, numero: NUM_S };
  out.reabrir = await vuelta();

  // Se soltó la secundaria a propósito: la instancia ya no está en Evolution.
  lineas[S] = null;
  out.soltada = await vuelta();

  // La voz pasó a la línea de Martín (3/11, 17:16 ART), y esa línea cae.
  db.app_settings = db.app_settings.filter((f) => !String(f.key).startsWith('mako.linea.'));
  db.app_settings.find((f) => f.key === 'mako.voz.instancia')!.value = S;
  lineas[S] = { connectionStatus: 'close', codigo: 403, numero: NUM_S };
  out.vozEnNegocio = await vuelta();

  out.tocadas = tocadas;
  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
