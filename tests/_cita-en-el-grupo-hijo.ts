// =============================================================================
// Hijo de tests/cita-y-busqueda-en-el-grupo.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// `textoPorIdDeWhatsApp` y el runner de `buscar_en_el_grupo` REALES contra un PostgREST de mentira con dos grupos y dos negocios: lo
// que se mira es que lo de otro grupo no existe. Necesita `--conditions=react-server` (esos módulos llevan `server-only`).
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

const pg = crearPostgrest({ tablas: ['mako_doer_conv', 'workspaces'] as const, defaults: (_t, f) => ({ ...f }) });
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  return new Response('{}', { status: 500 });
}) as typeof fetch;
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

const WS = 11;
const GRUPO = 'grupo-a@g.us';
const OTRO = 'grupo-b@g.us';

async function main() {
  const hace = (dias: number) => new Date(Date.now() - dias * 86_400_000).toISOString();
  pg.db.workspaces.push({ id: WS, nombre: 'Prueba', slug: 'p', estado: 'activo', capa: 'completo', created_at: hace(100) });
  pg.db.mako_doer_conv.push(
    { id: 1, workspace_id: WS, grupo_jid: GRUPO, role: 'user', content: 'El precio de la mentoría es 1500', wa_message_id: 'WA-VIEJO', created_at: hace(10) },
    { id: 2, workspace_id: WS, grupo_jid: GRUPO, role: 'user', content: 'Otra cosa sin nada que ver', wa_message_id: 'WA-OTRO', created_at: hace(9) },
    { id: 3, workspace_id: WS, grupo_jid: OTRO, role: 'user', content: 'Lo de otro grupo: el precio de la mentoría es 9', wa_message_id: 'WA-AJENO', created_at: hace(10) },
  );
  const { runWithWorkspace } = await import('../lib/workspace');
  const { textoPorIdDeWhatsApp } = await import('../lib/mako-doer-conv');
  const { runnerDe } = await import('../lib/api-mako/runners');
  const ctx = (canalKey: string, canal = 'whatsapp') => ({ ws: WS, canal, canalKey, alcance: 'ejecutar', rol: 'admin', turnStart: Date.now(), mensajeUsuario: 'x', actor: 't' });
  const r = runnerDe('buscar_en_el_grupo') as unknown as { leer: (i: Record<string, unknown>, c: unknown) => Promise<string | { content: string; isError?: boolean }> };
  const leer = async (i: Record<string, unknown>, c: unknown) => {
    const x = await runWithWorkspace(WS, () => r.leer(i, c));
    return typeof x === 'string' ? JSON.parse(x) : x;
  };
  const out: Record<string, unknown> = {};
  out.porId = await textoPorIdDeWhatsApp(WS, GRUPO, 'WA-VIEJO');
  out.porIdDeOtroGrupo = await textoPorIdDeWhatsApp(WS, GRUPO, 'WA-AJENO');
  out.encontro = await leer({ texto: 'precio mentoría' }, ctx(GRUPO));
  out.otroGrupo = await leer({ texto: 'nada que ver' }, ctx(OTRO));
  out.afuera = await leer({ texto: 'precio' }, ctx('app:1', 'app'));
  out.sinTexto = await leer({}, ctx(GRUPO));
  process.stdout.write(`@@JSON@@${JSON.stringify(out)}@@FIN@@`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
