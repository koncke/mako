// =============================================================================
// Hijo de tests/transcribe-anuncio.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// IA7 (22/10/2026): corre `transcribeAd` de verdad (Meta, la bajada del video y la IA son de mentira) en dos negocios:
//   · ws3, con su OpenAI: el anuncio se escucha y se estructura con SU clave;
//   · ws13, sin ninguna IA: la fila dice POR QUÉ, y no sale a ningún lado.
// La plataforma tiene en el ENTORNO una OpenAI y una Groq (las de antes): ningún pedido puede llevarlas.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
process.env.META_API_VERSION = 'v21.0';
process.env.META_ACCESS_TOKEN = 'meta-del-entorno';
process.env.OPENAI_API_KEY = 'sk-proj-DE-LA-PLATAFORMA-en-el-entorno-xxxxxxxxxxxxxxxx';
process.env.GROQ_API_KEY = 'gsk-DE-LA-PLATAFORMA-en-el-entorno';

let n = 0;
const pg = crearPostgrest({
  tablas: ['credenciales', 'workspaces', 'app_settings', 'anthropic_usage', 'ia_cuotas', 'ia_rebotes', 'ia_pc_dispositivos'],
  defaults: (_t, f) => ({ id: ++n, created_at: new Date().toISOString(), ...f }),
});
let red: Array<{ host: string; camino: string; auth: string }> = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  const h = new Headers(init.headers);
  red.push({ host: u.host, camino: u.pathname, auth: h.get('authorization') ?? h.get('x-api-key') ?? h.get('x-goog-api-key') ?? u.searchParams.get('access_token') ?? '' });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
  if (u.host === 'graph.facebook.com' && u.pathname.endsWith('/ad1')) return json({ creative: { video_id: 'v1' } });
  if (u.host === 'graph.facebook.com' && u.pathname.endsWith('/v1')) return json({ source: 'https://video.test/ad.mp4' });
  if (u.host === 'video.test') return new Response(new Uint8Array(2048), { status: 200, headers: { 'content-length': '2048', 'content-type': 'video/mp4' } });
  if (u.host === 'api.openai.com' && u.pathname.endsWith('/audio/transcriptions')) return json({ text: 'Hola, soy Juan. Si tu negocio no vende, mira esto: te muestro cómo duplicar tus ventas. Escríbeme hoy.' });
  if (u.host === 'api.openai.com' && u.pathname.endsWith('/chat/completions')) return json({ choices: [{ message: { content: JSON.stringify({ secciones: [{ titulo: 'Hook', texto: 'Hola, soy Juan.' }, { titulo: 'CTA', texto: 'Escríbeme hoy.' }] }) } }], usage: { prompt_tokens: 10, completion_tokens: 10 } });
  return json({ error: { message: 'red de mentira' } }, 500);
}) as typeof fetch;

async function main() {
  const { cifrarSecreto } = await import('../lib/credenciales');
  const { runWithWorkspace } = await import('../lib/workspace');
  const { transcribeAd } = await import('../lib/transcribe');
  pg.db.workspaces.push({ id: 9, capa: 'superadmin', nombre: 'MaKo' }, { id: 3, capa: 'cliente', nombre: 'Prueba' }, { id: 13, capa: 'cliente', nombre: 'Sin IA' });
  // La red gratis de la plataforma (su Groq en la fila del ws9): un anuncio no va ahí mientras Martín no decida.
  pg.db.credenciales.push({ workspace_id: 9, clave: 'GROQ_API_KEY', valor_enc: cifrarSecreto(`gsk-red-de-la-plataforma-${'p'.repeat(30)}`, 9, 'GROQ_API_KEY'), servicio: 'groq' });
  pg.db.credenciales.push({ workspace_id: 3, clave: 'OPENAI_API_KEY', valor_enc: cifrarSecreto(`sk-proj-DEL-NEGOCIO-${'n'.repeat(40)}`, 3, 'OPENAI_API_KEY'), servicio: 'openai' });
  const out: Record<string, unknown> = {};
  for (const ws of [3, 13]) {
    red = [];
    const r = await runWithWorkspace(ws, () => transcribeAd('ad1', { metaToken: 'meta-del-negocio' }));
    out[`ws${ws}`] = { r, red };
  }
  out.usoWs3 = pg.db.anthropic_usage.filter((f) => f.workspace_id === 3).map((f) => ({ provider: f.provider, feature: f.feature }));
  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@RESULTADO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}`); process.exit(0); });
