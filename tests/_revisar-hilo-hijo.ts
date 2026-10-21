// =============================================================================
// Hijo de tests/chat-abrir.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Una propuesta que nace en un chat de la app (`proponerPantallaGenerica` con la clave de ESE chat) y se confirma o se
// descarta en /mako/revisar (`aplicarPropuestaGenerica` / `descartarPropuestaGenerica`, el camino REAL): ¿qué queda en el
// hilo? Contra un PostgREST de mentira (tests/_postgrest-de-mentira.ts), con dos negocios, en un node aparte con
// `--conditions=react-server` (esos módulos llevan `server-only`). Nada sale a la red: lo que no es la base se anota en
// `red` y tiene que dar vacío.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

const TABLAS = ['workspaces', 'leads', 'lead_audit', 'propuestas', 'chart_sessions', 'chart_chats', 'app_settings', 'usuarios'] as const;
const ahoraIso = () => new Date().toISOString();
let siguienteId = 700;
const pg = crearPostgrest({
  tablas: TABLAS,
  defaults: (tabla, f) => {
    if (tabla === 'chart_chats') return { id: siguienteId++, created_at: ahoraIso(), bloques: null, ...f };
    if (tabla === 'propuestas') return { id: `prop-${siguienteId++}`, estado: 'pendiente', resultado: null, created_at: ahoraIso(), updated_at: ahoraIso(), ...f };
    if (tabla === 'lead_audit') return { id: siguienteId++, created_at: ahoraIso(), ...f };
    return { ...f };
  },
});

const red: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  red.push(u.host + u.pathname);
  return new Response(JSON.stringify({ error: 'red de mentira' }), { status: 500 });
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

const WS = 3; // el de prueba (nunca el 1)
const OTRO = 9;

async function main() {
  const { proponerPantallaGenerica, aplicarPropuestaGenerica, descartarPropuestaGenerica } = await import('../lib/api-mako/acciones');
  const { porId } = await import('../lib/api-mako/registro');
  const db = pg.db;
  db.workspaces.push({ id: WS, nombre: 'Prueba', slug: 'prueba', estado: 'activo', capa: 'completo', created_at: ahoraIso() });
  db.workspaces.push({ id: OTRO, nombre: 'Otro', slug: 'otro', estado: 'activo', capa: 'completo', created_at: ahoraIso() });
  db.leads.push({ id: 101, workspace_id: WS, nombre: 'Ana', email: 'ana@viejo.com', telefono: '5491100000000', created_at: ahoraIso() });
  const sesion = (id: number, ws: number) => db.chart_sessions.push({ id, workspace_id: ws, chart_key: 'mako:prueba', titulo: 'Chat', contexto: null, pinned: false, archived: false, created_at: ahoraIso(), updated_at: ahoraIso() });
  sesion(77, WS);
  sesion(88, OTRO);

  const def = porId('editar_contacto_lead');
  if (!def || def.tipo !== 'accion') throw new Error('falta editar_contacto_lead');
  const ctxChat = (canalKey: string) => ({ ws: WS, canal: 'app' as const, canalKey, alcance: 'proponer' as const, rol: 'admin' as const, actor: 'Prueba' });
  const bandeja = { ws: WS, canal: 'app' as const, canalKey: 'app:bandeja', alcance: 'ejecutar' as const, rol: 'admin' as const, actor: 'Prueba', bandeja: true as const };

  // 1. Del chat 77 → se confirma en /mako/revisar.
  const a = await proponerPantallaGenerica(def, { leadId: 101, email: 'ana@nuevo.com' }, 'Corregir el email de Ana', ctxChat('app:77'));
  const confirmada = await aplicarPropuestaGenerica(a.propuesta.id, null, bandeja);
  // 2. Del chat 77 → se descarta.
  const b = await proponerPantallaGenerica(def, { leadId: 101, telefono: '5491122223333' }, 'Corregir el teléfono de Ana', ctxChat('app:77'));
  await descartarPropuestaGenerica(b.propuesta.id, bandeja);
  // 3. Con la clave de un chat de OTRO negocio: se confirma, y no se anota en ningún lado.
  const c = await proponerPantallaGenerica(def, { leadId: 101, email: 'ana@otra.com' }, 'Corregir el email de Ana otra vez', ctxChat('app:88'));
  const ajena = await aplicarPropuestaGenerica(c.propuesta.id, null, bandeja);

  process.stdout.write(JSON.stringify({
    confirmada, ajena,
    datosDeLaPropuesta: db.propuestas.find((p) => p.id === a.propuesta.id)?.datos ?? null,
    hilo: db.chart_chats.map((m) => ({ session_id: m.session_id, role: m.role, content: m.content })),
    red,
  }));
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
