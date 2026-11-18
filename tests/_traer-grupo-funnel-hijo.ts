// =============================================================================
// Hijo de tests/traer-grupo-funnel.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre el preparar() REAL de `traer_contactos_de_grupo` (área crm, O45) contra un PostgREST de mentira y un Evolution de
// mentira (los participantes del grupo), en un node aparte con `--conditions=react-server` (el runner trae `server-only`). El caso:
// por el chat de MaKo, sin `embudoId`, los contactos caían en «Prospección» o en el principal y la tarjeta no decía a qué funnel.
// Imprime un JSON con lo que devolvió cada preparar. Nada más sale a la red. Datos inventados.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

const TABLAS = ['workspaces', 'funnels', 'app_settings', 'evolution_instancias', 'leads', 'etiquetas', 'nutricion_secuencias'] as const;
const pg = crearPostgrest({ tablas: TABLAS });

const LINEA = 'mako_ws3_prueba';
const JID = '120363000000000077@g.us';
let funnelsCaidos = false;
const red: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') {
    if (funnelsCaidos && u.pathname.endsWith('/funnels')) return new Response(JSON.stringify({ message: 'upstream caído' }), { status: 503, headers: { 'content-type': 'application/json' } });
    return pg.responder(u, init);
  }
  if (u.host === 'evolution.test') {
    // Los participantes del grupo (dos, con su número); la agenda de la línea, vacía.
    if (u.pathname.startsWith('/group/participants/')) {
      return new Response(JSON.stringify({ participants: [{ id: '5215511110001@s.whatsapp.net' }, { id: '5215511110002@s.whatsapp.net' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (u.pathname.startsWith('/chat/findContacts/')) return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
  }
  red.push(u.host + u.pathname);
  return new Response(JSON.stringify({ error: 'red de mentira' }), { status: 500 });
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.EVOLUTION_BASE_URL = 'http://evolution.test';
process.env.EVOLUTION_API_KEY = 'evo-de-prueba';

const WS = 3;

async function main() {
  const { runWithWorkspace } = await import('../lib/workspace');
  const crm = (await import('../lib/api-mako/areas/crm.run')).RUNNERS;
  const db = pg.db;
  const out: Record<string, unknown> = {};

  const reset = (funnels: Array<{ id: number; nombre: string; es_default: boolean }>) => {
    pg.vaciar(); red.length = 0; funnelsCaidos = false;
    db.workspaces.push({ id: WS, nombre: 'Negocio de prueba', estado: 'activo', capa: 'completo' });
    db.evolution_instancias.push({ id: 1, workspace_id: WS, instance_name: LINEA, estado: 'conectado', numero: '5215500000009', es_default: true, etiqueta: 'Línea de prueba' });
    db.app_settings.push({ workspace_id: WS, key: `grupos_wa.lista.${LINEA}`, value: JSON.stringify({ at: Date.now(), grupos: [{ jid: JID, nombre: 'Formación de prueba', tamano: 3 }] }) });
    funnels.forEach((f, i) => db.funnels.push({ ...f, workspace_id: WS, activo: true, orden: i, declarado: true, canal: null, pipeline: null }));
  };
  const ctx = { ws: WS, canal: 'app' as const, canalKey: 'app:prueba', alcance: 'proponer' as const, rol: 'admin' as const, actor: 'Ana' };
  const preparar = (crm.traer_contactos_de_grupo as unknown as { preparar: (i: Record<string, unknown>, c: typeof ctx) => Promise<Record<string, unknown>> }).preparar;
  const correr = (input: Record<string, unknown>) => runWithWorkspace(WS, () => preparar({ grupo: 'Formación de prueba', ...input }, ctx));

  // 1) Un solo funnel: sin `embudoId`, ése, y la tarjeta lo nombra.
  reset([{ id: 41, nombre: 'Ventas', es_default: true }]);
  out.uno = await correr({});
  // 2) Dos funnels sin `embudoId`: no se elige ninguno (ni «Prospección», que antes ganaba): se pregunta, con los dos.
  reset([{ id: 41, nombre: 'Ventas', es_default: true }, { id: 42, nombre: 'Prospección', es_default: false }]);
  out.dosSinElegir = await correr({});
  // 3) Dos funnels con `embudoId`: ése, nombrado en la tarjeta.
  reset([{ id: 41, nombre: 'Ventas', es_default: true }, { id: 42, nombre: 'Prospección', es_default: false }]);
  out.dosElegido = await correr({ embudoId: 41 });
  // 4) Un funnel que no es de este negocio.
  reset([{ id: 41, nombre: 'Ventas', es_default: true }, { id: 42, nombre: 'Prospección', es_default: false }]);
  out.ajeno = await correr({ embudoId: 99 });
  // 5) La base no contesta los funnels: «no pude leer» no es «hay uno».
  reset([{ id: 41, nombre: 'Ventas', es_default: true }, { id: 42, nombre: 'Prospección', es_default: false }]);
  funnelsCaidos = true;
  out.caidos = await correr({});
  funnelsCaidos = false;
  out.red = red;
  process.stdout.write(`\n@@TRAER@@${JSON.stringify(out)}\n`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
