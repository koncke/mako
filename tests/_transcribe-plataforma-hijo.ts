// =============================================================================
// Hijo de tests/transcribe-plataforma-uso.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// F85 (18/11/2026): corre `transcribeMediaBuffer` de verdad (los proveedores y la base son de mentira) en cuatro escenarios,
// adentro del workspace de la plataforma (9), y devuelve qué quedó escrito en `anthropic_usage`:
//   · groq      → Groq escucha a la primera;
//   · openai    → Groq rebota y escucha el whisper-1 pago;
//   · gemini    → los dos Whisper rebotan y escucha Gemini;
//   · ninguno   → los tres rebotan.
// El padre lo corre dos veces: con `--conditions=react-server` (la ruta del servidor) y sin (un script de línea de comandos,
// donde lib/anthropic-usage es `server-only` y tira al importarse).
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.OPENAI_API_KEY = 'sk-proj-DE-LA-PLATAFORMA-en-el-entorno';
process.env.GROQ_API_KEY = 'gsk-DE-LA-PLATAFORMA-en-el-entorno';
process.env.GEMINI_API_KEY = 'AIza-DE-LA-PLATAFORMA-en-el-entorno';

let n = 0;
const pg = crearPostgrest({
  tablas: ['workspaces', 'app_settings', 'anthropic_usage'],
  defaults: (_t, f) => ({ id: ++n, created_at: new Date().toISOString(), ...f }),
});

type Escenario = 'groq' | 'openai' | 'gemini' | 'ninguno';
let escenario: Escenario = 'groq';
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  const texto = 'En esta clase vemos cómo armar una oferta que se venda sola, paso a paso, con ejemplos de verdad.';
  if (u.host === 'api.groq.com') return escenario === 'groq' ? json({ text: texto, language: 'spanish', duration: 120 }) : json({ error: { message: 'rate limit de mentira' } }, 429);
  if (u.host === 'api.openai.com') return escenario === 'openai' ? json({ text: texto, language: 'spanish', duration: 60 }) : json({ error: { message: 'You have no credits remaining' } }, 429);
  if (u.host === 'generativelanguage.googleapis.com') {
    return escenario === 'gemini'
      ? json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: texto }] } }] })
      : json({ error: { message: 'gemini de mentira caído' } }, 503);
  }
  return json({ error: { message: 'red de mentira' } }, 500);
}) as typeof fetch;

async function main() {
  // En el script no hay workspace que fijar: lib/workspace es `server-only`, como en scripts/curso-transcribir.ts.
  const enWs = await import('../lib/workspace').then((m) => m.runWithWorkspace, () => null);
  const conWs = <T>(fn: () => Promise<T>) => (enWs ? enWs(9, fn) : fn());
  const { transcribeMediaBuffer } = await import('../lib/transcribe-plataforma');
  pg.db.workspaces.push({ id: 9, capa: 'superadmin', nombre: 'MaKo' });
  const out: Record<string, unknown> = {};
  for (const e of ['groq', 'openai', 'gemini', 'ninguno'] as Escenario[]) {
    escenario = e;
    const antes = pg.db.anthropic_usage.length;
    const r = await conWs(() => transcribeMediaBuffer(new Uint8Array(4096).buffer, 'audio/mp4', 'clase-03.m4a'));
    const filas = pg.db.anthropic_usage.slice(antes).map((f) => ({
      workspace_id: f.workspace_id, feature: f.feature, provider: f.provider, model: f.model, cost_usd: f.cost_usd, motivo: f.motivo,
    }));
    out[e] = { status: r.status, model: r.model ?? null, duracion_s: r.duracion_s, filas };
  }
  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@RESULTADO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}`); process.exit(0); });
