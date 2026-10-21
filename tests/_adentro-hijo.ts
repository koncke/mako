// =============================================================================
// Hijo de tests/chat-adentro.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Las propuestas de pantalla pendientes de un chat vuelven al abrirlo, con el formulario para confirmarlas adentro
// (`abrirSesion`, lib/mako-turno-app.ts, el camino REAL), contra un PostgREST de mentira, en un node aparte con
// `--conditions=react-server`. Nada sale a la red: lo que no es la base se anota en `red` y tiene que dar vacío.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

const TABLAS = ['workspaces', 'leads', 'propuestas', 'chart_sessions', 'chart_chats', 'mako_acciones_pendientes', 'app_settings', 'usuarios'] as const;
const ahoraIso = () => new Date().toISOString();
let siguienteId = 900;
let reloj = Date.parse('2026-10-20T20:00:00Z');
const pg = crearPostgrest({
  tablas: TABLAS,
  defaults: (tabla, f) => {
    if (tabla === 'chart_chats') return { id: siguienteId++, created_at: ahoraIso(), bloques: null, ...f };
    // Cada propuesta un segundo después de la anterior: el orden es el de creación.
    if (tabla === 'propuestas') return { id: `prop-${siguienteId++}`, estado: 'pendiente', resultado: null, created_at: new Date(reloj += 1000).toISOString(), updated_at: ahoraIso(), ...f };
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
const CHART_KEY = 'mako:persona-de-prueba';

async function main() {
  const { proponerPantallaGenerica } = await import('../lib/api-mako/acciones');
  const { abrirSesion } = await import('../lib/mako-turno-app');
  const { porId } = await import('../lib/api-mako/registro');
  const db = pg.db;
  db.workspaces.push({ id: WS, nombre: 'Prueba', slug: 'prueba', estado: 'activo', capa: 'completo', created_at: ahoraIso() });
  db.leads.push({ id: 101, workspace_id: WS, nombre: 'Ana', email: 'ana@viejo.com', telefono: '5491100000000', created_at: ahoraIso() });
  for (const id of [77, 78]) db.chart_sessions.push({ id, workspace_id: WS, chart_key: CHART_KEY, titulo: 'Chat', contexto: null, pinned: false, archived: false, created_at: ahoraIso(), updated_at: ahoraIso() });

  const def = porId('editar_contacto_lead');
  if (!def || def.tipo !== 'accion') throw new Error('falta editar_contacto_lead');
  const ctx = (canalKey: string) => ({ ws: WS, canal: 'app' as const, canalKey, alcance: 'proponer' as const, rol: 'admin' as const, actor: 'Prueba' });
  const a = await proponerPantallaGenerica(def, { leadId: 101, email: 'ana@nuevo.com' }, 'Corregir el email de Ana', ctx('app:77'));
  await proponerPantallaGenerica(def, { leadId: 101, email: 'ana@otro.com' }, 'De otro chat', ctx('app:78'));
  // Una que mueve plata, del mismo chat: vuelve, pero SIN formulario (espera a la D2).
  db.propuestas.push({ id: 'prop-plata', workspace_id: WS, tipo: 'accion', estado: 'pendiente', resumen: 'Reembolsar el cobro', origen: 'app', ref: null,
    datos: { operacion: 'reembolsar_cobro', payload: { cobroId: 5 }, resumen: 'Reembolsar el cobro', canal: 'app', canalKey: 'app:77' },
    resultado: null, created_at: new Date(reloj += 1000).toISOString(), updated_at: ahoraIso() });
  // Una que ya se confirmó: no vuelve.
  const c = await proponerPantallaGenerica(def, { leadId: 101, telefono: '5491122223333' }, 'Ya hecha', ctx('app:77'));
  const fila = db.propuestas.find((p) => p.id === c.propuesta.id);
  if (fila) fila.estado = 'aplicada';

  const admin = { ws: WS, rol: 'admin' as const, actor: 'Prueba', chartKey: CHART_KEY };
  const comoAdmin = await abrirSesion(admin, 77);
  const comoMiembro = await abrirSesion({ ...admin, rol: 'miembro' }, 77);
  process.stdout.write(JSON.stringify({ propuestaId: a.propuesta.id, comoAdmin: comoAdmin?.pantallas ?? null, comoMiembro: comoMiembro?.pantallas ?? null, red }));
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
