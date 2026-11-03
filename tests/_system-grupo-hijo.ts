// =============================================================================
// Hijo de tests/banco-grupo.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// El system REAL del turno del grupo (`buildSystemPrompt` con `canal: 'grupo'`, lib/mako-context.ts) contra un PostgREST de
// mentira, con overrides guardados de la persona y del núcleo (como los que se editan en Configuraciones): ninguno puede sacar
// NUCLEO_GRUPO ni meter el «consultor» en el grupo. Y el de la app, para ver que sigue igual.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';

const pg = crearPostgrest({ tablas: ['workspaces', 'app_settings', 'credenciales', 'mako_knowledge', 'funnels', 'experimentos', 'objetivos'] });
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  return new Response(JSON.stringify({ error: { message: 'red de mentira' } }), { status: 500, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

const WS = 13;

async function main() {
  const { runWithWorkspace } = await import('../lib/workspace');
  const { buildSystemPrompt } = await import('../lib/mako-context');
  pg.db.workspaces.push({ id: 9, capa: 'superadmin', nombre: 'MaKo' }, { id: WS, capa: 'cliente', nombre: 'Código Inmobiliario' });
  const out: Record<string, string> = {};
  const correr = (o: Partial<Parameters<typeof buildSystemPrompt>[0]>) =>
    runWithWorkspace(WS, () => buildSystemPrompt({ chartKey: 'mako-doer', titulo: 'Hola MaKo', contexto: '', query: 'Tal cual como lo hace manychat', ...o }));
  out.grupo = await correr({ canal: 'grupo' });
  out.grupoLean = await correr({ canal: 'grupo', lean: true });
  out.app = await correr({});
  // Los overrides que se editan en Configuraciones: la persona y el núcleo.
  pg.db.app_settings.push(
    { workspace_id: WS, key: 'mako.prompts', value: JSON.stringify({ persona: { current: 'PERSONA GUARDADA: el consultor IA de Martín Koncke', versions: [] } }) },
    { workspace_id: WS, key: 'mako.prompt-overrides', value: JSON.stringify({ 'mako.nucleo': { current: 'NUCLEO GUARDADO: NUNCA termines con una pregunta', versions: [] } }) },
  );
  out.grupoConOverrides = await correr({ canal: 'grupo' });
  out.appConOverrides = await correr({});
  process.stdout.write(`@@SYSTEM@@${JSON.stringify(out)}\n`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@SYSTEM@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}\n`); process.exit(0); });
