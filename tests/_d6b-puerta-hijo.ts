// =============================================================================
// Hijo de tests/d6b-puerta.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// IA6 (22/10/2026): «con su IA conectada, TODO el negocio usa la suya». Corre las entradas REALES de la capa de IA
// (lib/ai-cheap.ts y lib/anthropic.ts) A PELO —sin que ninguna ruta ni turno decida D6b, como un cron, un webhook o una tab—
// contra un PostgREST de mentira, y anota a qué hosts sale cada una. Los negocios:
//   · ws3: su OpenAI y una Gemini vieja del onboarding (tiene su IA);
//   · ws11: su clave de Claude sola (tiene su IA; las fotos van a su Claude);
//   · ws13: sólo Gemini (no tiene su IA: sigue como siempre);
//   · ws9: la plataforma (lo interno sigue como estaba).
// Todo lo que no es la base contesta un error, así la cascada recorre todo lo que tiene permitido.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
for (const k of ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY']) delete process.env[k];

let n = 0;
const pg = crearPostgrest({
  tablas: ['credenciales', 'workspaces', 'app_settings', 'anthropic_usage', 'ia_cuotas', 'ia_rebotes', 'ia_pc_dispositivos'],
  defaults: (_t, f) => ({ id: ++n, created_at: new Date().toISOString(), ...f }),
});
let red: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  red.push(u.host);
  return new Response(JSON.stringify({ error: { message: 'red de mentira' } }), { status: 500, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

const PLATAFORMA = 9;

async function main() {
  const { cifrarSecreto } = await import('../lib/credenciales');
  const { runWithWorkspace } = await import('../lib/workspace');
  const ai = await import('../lib/ai-cheap');
  const { chatClaude } = await import('../lib/anthropic');
  pg.db.workspaces.push({ id: PLATAFORMA, capa: 'superadmin', nombre: 'MaKo' }, ...[3, 11, 13].map((id) => ({ id, capa: 'cliente', nombre: `ws${id}` })));
  const poner = (ws: number, clave: string) => pg.db.credenciales.push({ workspace_id: ws, clave, valor_enc: cifrarSecreto(`${ws}-${clave}-${'k'.repeat(40)}`, ws, clave), servicio: clave.split('_')[0].toLowerCase() });
  poner(3, 'OPENAI_API_KEY'); poner(3, 'GEMINI_API_KEY');
  poner(11, 'ANTHROPIC_API_KEY');
  poner(13, 'GEMINI_API_KEY');
  poner(PLATAFORMA, 'GEMINI_API_KEY'); poner(PLATAFORMA, 'GROQ_API_KEY');
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const tool = [{ name: 'contar_leads', description: 'Cuenta', input_schema: { type: 'object', properties: {} } }];
  const entradas: Record<string, (ws: number) => Promise<unknown>> = {
    texto: () => ai.chatCheapCascade({ system: 's', user: 'Juan Pérez quiere otra landing', feature: 'landing-analyst' }),
    textoAtadoAGemini: () => ai.chatCheapCascade({ system: 's', user: 'x', feature: 'landing-analyst', provs: ['gemini'] }),
    // El Plan queda afuera (regla de Martín): pedido a Gemini, a Gemini va aunque el negocio tenga su IA.
    plan: () => ai.chatCheapCascade({ system: 's', user: 'la reunión con Juan', feature: 'plan-fathom', provs: ['gemini'] }),
    herramientas: () => ai.chatCheapToolsCascade('s', [{ role: 'user', content: 'hola' }], tool as never, async () => 'ok', { provs: ['gemini', 'groq'], feature: 'chatbot-paso-ia' }),
    foto: () => ai.leerDocumentoIA({ dataUrl: png, isPdf: false, nombreArchivo: 'captura.png', prompt: 'qué dice', feature: 'El Archivero', redDePlataforma: true }),
    audio: () => ai.transcribirAudio(Buffer.from('audio').toString('base64'), 'audio/webm', { feature: 'nota de voz', pii: true } as never),
    keysDeGemini: () => ai.provsDe('gemini'),
    redDeLaPlataforma: () => ai.provsGratisDePlataforma(),
    chatClaude: () => chatClaude('s', [{ role: 'user', content: 'hola' }], { feature: 'landing-analyst' }),
  };
  const out: Record<string, Record<string, { red: string[]; valor?: unknown }>> = {};
  for (const ws of [3, 11, 13, PLATAFORMA]) {
    out[`ws${ws}`] = {};
    for (const [nombre, f] of Object.entries(entradas)) {
      red = [];
      let valor: unknown;
      await runWithWorkspace(ws, async () => { try { valor = await f(ws); } catch (e) { valor = `tiró: ${e instanceof Error ? e.message.slice(0, 120) : String(e)}`; } });
      out[`ws${ws}`][nombre] = { red: [...new Set(red)], ...(Array.isArray(valor) ? { valor: valor.length } : typeof valor === 'string' ? { valor: valor.slice(0, 160) } : {}) };
    }
  }
  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@RESULTADO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}`); process.exit(0); });
