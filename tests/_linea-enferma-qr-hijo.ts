// =============================================================================
// Hijo de tests/linea-enferma-qr.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// «Conectar por QR» REAL —`conectarCanalMaKo` (la voz, lib/mako-canal.ts) y `conectar` (la línea de un negocio, lib/evolution.ts)—
// sobre una línea `open` que contesta la sonda, como la voz sorda del 11/11/2026 y la de Sergio Arriata (ws20, ~26 h de atraso). Lo
// que cambia entre escenas es la MARCA del vigilante (lib/lineas-enfermas.ts) y la vinculación que devuelve Evolution. Evolution y la
// base son de mentira; lo que sale a Evolution se ANOTA.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
process.env.EVOLUTION_BASE_URL = 'http://evolution.test';
process.env.EVOLUTION_API_KEY = 'evo-de-prueba';
process.env.NEXT_PUBLIC_APP_URL = 'https://hola-mako.com';
process.env.EVOLUTION_WEBHOOK_SECRET = 'secreto-del-webhook-de-prueba';

const VOZ = 'mako_superadmin_muylqv8r';
const WS20 = 'mako_ws20';
let n = 0;
const pg = crearPostgrest({
  tablas: ['app_settings', 'workspaces', 'credenciales', 'evolution_instancias', 'notificaciones', 'errores_app'],
  defaults: (_t, f) => ({ id: ++n, created_at: new Date().toISOString(), ...f }),
});
// La vinculación de cada línea, como la da `fetchInstances` (11/11: la voz se rehízo con el QR de las 02:51:07).
const vinculo: Record<string, { createdAt: string; disconnectionAt: string | null }> = {
  [VOZ]: { createdAt: '2026-11-11T02:51:07.000Z', disconnectionAt: '2026-11-11T02:40:30.000Z' },
  [WS20]: { createdAt: '2026-10-19T11:57:08.000Z', disconnectionAt: null },
};
const soltada = new Set<string>();
const red: Array<{ metodo: string; camino: string }> = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  const metodo = (init.method ?? 'GET').toUpperCase();
  red.push({ metodo, camino: u.pathname });
  const r = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const inst = decodeURIComponent(u.pathname.split('/').pop() ?? '');
  if (u.pathname.includes('/instance/fetchInstances')) {
    const nombre = u.searchParams.get('instanceName') ?? '';
    return r(200, [{ name: nombre, connectionStatus: soltada.has(nombre) ? 'close' : 'open', ownerJid: '5491125052605@s.whatsapp.net', ...vinculo[nombre] }]);
  }
  if (u.pathname.startsWith('/instance/logout/')) { soltada.add(inst); return r(200, { status: 'SUCCESS' }); }
  if (u.pathname.startsWith('/instance/connect/')) return soltada.has(inst) ? r(200, { base64: 'data:image/png;base64,QR', code: '2@qr-nuevo', pairingCode: null }) : r(200, { instance: { instanceName: inst, state: 'open' } });
  return r(200, {}); // la sonda (fetchBusinessProfile) contesta: «viva», como la línea sorda
}) as typeof fetch;

async function main() {
  pg.db.workspaces.push({ id: 9, capa: 'superadmin', nombre: 'MaKo' }, { id: 1, capa: 'cliente', nombre: 'Dueño' }, { id: 20, capa: 'cliente', nombre: 'Sergio Arriata' });
  pg.db.app_settings.push({ workspace_id: 1, key: 'mako.canal.instancia', value: VOZ }, { workspace_id: 1, key: 'mako.voz.instancia', value: VOZ });
  pg.db.evolution_instancias.push({ id: ++n, workspace_id: 20, instance_name: WS20, es_default: true, estado: 'conectado' });
  const { conectarCanalMaKo } = await import('../lib/mako-canal');
  const { conectar } = await import('../lib/evolution');
  const { runWithWorkspace } = await import('../lib/workspace');
  const marcar = (key: string, value: string) => {
    pg.db.app_settings = pg.db.app_settings.filter((s) => !(s.workspace_id === 9 && s.key === key));
    if (value) pg.db.app_settings.push({ workspace_id: 9, key, value });
  };
  const sorda = (vinculadaDesde: number) => JSON.stringify({ desde: '2026-11-11T15:10:00.000Z', avisadaAt: '2026-11-11T15:10:00.000Z', linea: VOZ, vinculadaDesde, motivo: 'mandó 2 mensajes a grupos en 30 min y no entró ninguno' });
  const atrasada = (vinculadaDesde: number) => JSON.stringify({ [WS20]: { instancia: WS20, ws: 20, negocio: 'Sergio Arriata', tipicoMin: 1602, mensajes: 6, desde: '2026-11-07T10:54:00.000Z', avisadaAt: '2026-11-11T22:30:00.000Z', vinculadaDesde } });
  const out: Record<string, unknown> = {};
  const escena = async (k: string, f: () => Promise<unknown>) => {
    red.splice(0); soltada.clear();
    let r: unknown;
    try { r = await f(); } catch (e) { r = { tiro: e instanceof Error ? e.message : String(e) }; }
    out[k] = {
      r,
      logout: red.filter((x) => x.camino.startsWith('/instance/logout/')).map((x) => x.camino),
      borrar: red.filter((x) => x.camino.startsWith('/instance/delete/')).length,
      reinicio: red.filter((x) => x.camino.startsWith('/instance/restart/')).length,
      crear: red.filter((x) => x.camino.startsWith('/instance/create')).length,
    };
  };
  const V_VOZ = Date.parse(vinculo[VOZ].createdAt);
  const V_WS20 = Date.parse(vinculo[WS20].createdAt);

  // La voz.
  marcar('mako.voz.sorda', sorda(V_VOZ));
  await escena('vozMarcada', () => conectarCanalMaKo());
  marcar('mako.voz.sorda', '');
  await escena('vozSinMarca', () => conectarCanalMaKo());
  // Martín ya la re-vinculó (21:50:20) y la marca es de antes: es otro dispositivo, no se toca.
  marcar('mako.voz.sorda', sorda(V_VOZ));
  vinculo[VOZ] = { ...vinculo[VOZ], disconnectionAt: '2026-11-11T21:50:20.000Z' };
  await escena('vozYaReVinculada', () => conectarCanalMaKo());
  marcar('mako.voz.sorda', '');

  // La línea de un negocio.
  marcar('mako.lineas.atrasadas', atrasada(V_WS20));
  await escena('negocioMarcado', () => runWithWorkspace(20, () => conectar({ linea: WS20 })));
  marcar('mako.lineas.atrasadas', '');
  await escena('negocioSinMarca', () => runWithWorkspace(20, () => conectar({ linea: WS20 })));
  // Una marca ilegible no inventa una línea enferma.
  marcar('mako.lineas.atrasadas', '{roto');
  await escena('marcaRota', () => runWithWorkspace(20, () => conectar({ linea: WS20 })));
  process.stdout.write(`@@QR@@${JSON.stringify(out)}\n`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@QR@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}\n`); process.exit(0); });
