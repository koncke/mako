// =============================================================================
// Hijo de tests/grupo-ve-el-grupo.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// `enviarAlGrupoMaKo` REAL (lib/mako-grupo.ts) contra un PostgREST y un Evolution de mentira: dónde queda lo que se manda al
// grupo según su `memoria` (28/10/2026, el diagnóstico del Cerebro, F2a). 'mako' en la conversación como MaKo; 'equipo' en el
// anillo del equipo y NUNCA como turno de MaKo; null en ningún lado (quien llama lo guarda).
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
process.env.EVOLUTION_BASE_URL = 'http://evo.test';
process.env.EVOLUTION_API_KEY = 'clave-evo';

let n = 0;
const pg = crearPostgrest({
  tablas: ['workspaces', 'app_settings', 'mako_doer_conv'],
  defaults: (tabla, f) => (tabla === 'mako_doer_conv' ? { id: ++n, created_at: new Date().toISOString(), ...f } : f),
});
let enviados = 0;
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  if (u.host === 'evo.test') return new Response(JSON.stringify({ key: { id: `EV-${++enviados}` } }), { status: 201, headers: { 'content-type': 'application/json' } });
  return new Response('{}', { status: 500 });
}) as typeof fetch;

const WS = 10;
const JID = '120363000000000010@g.us';

async function main() {
  const { enviarAlGrupoMaKo } = await import('../lib/mako-grupo');
  pg.db.workspaces.push({ id: 1, capa: 'completo', nombre: 'Mauricio' }, { id: 9, capa: 'superadmin', nombre: 'MaKo' }, { id: WS, capa: 'cliente', nombre: 'Leandro' });
  pg.db.app_settings.push({ workspace_id: WS, key: 'mako.grupo_jid', value: JID }, { workspace_id: 1, key: 'mako.voz.instancia', value: 'mako_superadmin_x' });
  const conv = () => pg.db.mako_doer_conv.filter((f) => f.workspace_id === WS || f.grupo_jid === JID).map((f) => `${f.role}:${f.content}`);
  const anillo = () => {
    const f = pg.db.app_settings.find((x) => x.workspace_id === WS && x.key === 'mako.equipo.grupo');
    return f ? (JSON.parse(String(f.value)) as Array<{ texto: string }>).map((x) => x.texto) : [];
  };
  const out: Record<string, unknown> = {};
  out.mako = await enviarAlGrupoMaKo(WS, '🔔 Entró Elida: ¿la contactaron?', 'mako');
  out.convTrasMako = conv();
  out.anilloTrasMako = anillo();
  out.equipo = await enviarAlGrupoMaKo(WS, 'Ya quedó listo: en Automations ya puedes sumar botones a los DM de Instagram.', 'equipo');
  out.convTrasEquipo = conv();
  out.anilloTrasEquipo = anillo();
  out.nulo = await enviarAlGrupoMaKo(WS, 'un aviso que guarda quien lo manda', null);
  out.convTrasNulo = conv();
  out.anilloTrasNulo = anillo();
  process.stdout.write(`@@MEMORIA@@${JSON.stringify(out)}\n`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@MEMORIA@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}\n`); process.exit(0); });
