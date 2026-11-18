// =============================================================================
// Hijo de tests/agenda-destino-112.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// La operación que guarda DÓNDE agenda MaKo (`elegir_google_o_mako`, lib/api-mako/areas/calendario.run.ts), por las funciones REALES
// de la API (`ejecutarOperacion` para proponer y para `confirmar_accion`) sobre un PostgREST de mentira. Sin modelos y sin red: un
// negocio SIN Google conectado (no hay `google.calendar.refresh_token`), que es lo único que se puede probar sin hablar con Google.
// Escribe una línea `@@DESTINO@@<json>` por escena. Corre con `--conditions=react-server`.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

let n = 1200;
const pg = crearPostgrest({
  tablas: ['workspaces', 'app_settings', 'mako_acciones_pendientes', 'usuarios', 'anthropic_usage', 'errores_app', 'tickets', 'propuestas', 'workspace_miembros', 'push_suscripciones'],
  defaults: (t, f) => ({ id: ++n, ...(t === 'mako_acciones_pendientes' ? { created_at: new Date().toISOString(), estado: 'pendiente' } : {}), ...f }),
});
const red: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  red.push(u.host + u.pathname);
  return new Response(JSON.stringify({ error: 'red de mentira' }), { status: 500 });
}) as typeof fetch;

const WS = 13;
const JID = '120363000000000112@g.us';
const salida = (nombre: string, datos: unknown) => console.log(`@@DESTINO@@${JSON.stringify({ nombre, ...(datos as object) })}`);
const turno = (turnStart: number, mensajeUsuario: string) => ({
  ws: WS, canal: 'whatsapp', canalKey: JID, alcance: 'ejecutar', rol: 'admin', turnStart, mensajeUsuario, actor: 'Joan',
  enElGrupo: { quien: '5491100000112@s.whatsapp.net', aMaKo: true },
});

async function main() {
  pg.db.workspaces.push({ id: WS, nombre: 'Inmobiliaria de prueba', capa: 'completo', estado: 'activo' });
  const { ejecutarOperacion } = await import('../lib/api-mako/ejecutar');
  const { runWithWorkspace } = await import('../lib/workspace');
  const { KEY_DESTINO_AGENDA } = await import('../lib/agenda-destino');
  const correr = (id: string, input: Record<string, unknown>, ctx: Record<string, unknown>) => runWithWorkspace(WS, () => ejecutarOperacion(id, input, ctx as never, 'json'));
  const guardado = () => pg.db.app_settings.find((s) => s.workspace_id === WS && s.key === KEY_DESTINO_AGENDA)?.value ?? null;

  // 1. «google» con el negocio SIN su Google conectado: no se propone, y dice qué falta.
  const google = await correr('elegir_google_o_mako', { destino: 'google' }, turno(Date.now() - 60_000, 'cada vez que agende algo, en mi google calendar'));
  salida('sinGoogle', { google, pendientes: pg.db.mako_acciones_pendientes.length, guardado: guardado() });

  // 2. «mako»: se propone, y con el «sí» del turno siguiente queda guardado.
  const mako = await correr('elegir_google_o_mako', { destino: 'mako' }, turno(Date.now() - 60_000, 'de ahora en adelante agéndalo todo en el calendario de mako'));
  const antes = guardado();
  const si = await correr('confirmar_accion', {}, turno(Date.now() + 5_000, 'sí'));
  salida('mako', { mako, antes, si, guardado: guardado() });

  // 3. Un destino que no existe.
  salida('invalido', { r: await correr('elegir_google_o_mako', { destino: 'outlook' }, turno(Date.now(), 'en outlook')) });
  salida('red', { red: red.filter((h) => !h.startsWith('oauth2.googleapis.com')) });
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
