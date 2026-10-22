// =============================================================================
// Hijo de tests/ia8-sacados.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// IA8 (22/10/2026): Cerebras, Mistral y OpenRouter se sacaron. Corre la capa de IA REAL (lib/ai-cheap.ts) y el orden de
// la cuota (lib/ia-cuotas.ts) contra un PostgREST de mentira donde esas cuentas SIGUEN guardadas —filas viejas en
// `credenciales` y claves en el entorno—, y anota a qué hosts sale cada llamada. Ninguna puede salir a esos tres:
//   · ws13: sólo Gemini y las tres viejas (no tiene su IA: va por la red de siempre);
//   · ws9: la plataforma, con las tres en el entorno y en su fila.
// Todo lo que no es la base contesta un error, así la cascada recorre todo lo que tiene permitido.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
for (const k of ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY']) delete process.env[k];
process.env.CEREBRAS_API_KEY = `csk-${'c'.repeat(40)}`;
process.env.MISTRAL_API_KEY = 'm'.repeat(32);
process.env.OPENROUTER_API_KEY = `sk-or-v1-${'o'.repeat(64)}`;

let n = 0;
const pg = crearPostgrest({
  tablas: ['credenciales', 'workspaces', 'app_settings', 'anthropic_usage', 'ia_cuotas', 'ia_rebotes', 'ia_pc_dispositivos', 'ia_saldos'],
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
  const { ordenarPorCuota } = await import('../lib/ia-cuotas');
  pg.db.workspaces.push({ id: PLATAFORMA, capa: 'superadmin', nombre: 'MaKo' }, { id: 13, capa: 'cliente', nombre: 'ws13' });
  const poner = (ws: number, clave: string, valor = `${ws}-${clave}-${'k'.repeat(40)}`) =>
    pg.db.credenciales.push({ workspace_id: ws, clave, valor_enc: cifrarSecreto(valor, ws, clave), servicio: clave.split('_')[0].toLowerCase() });
  for (const ws of [13, PLATAFORMA]) {
    poner(ws, 'GEMINI_API_KEY');
    poner(ws, 'CEREBRAS_API_KEY', `csk-${'c'.repeat(40)}`);
    poner(ws, 'MISTRAL_API_KEY');
    poner(ws, 'OPENROUTER_API_KEY', `sk-or-v1-${'o'.repeat(64)}`);
  }
  poner(PLATAFORMA, 'GROQ_API_KEY');
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const tool = [{ name: 'contar_leads', description: 'Cuenta', input_schema: { type: 'object', properties: {} } }];
  const SACADOS = ['cerebras', 'mistral', 'openrouter'] as const;
  const entradas: Record<string, () => Promise<unknown>> = {
    texto: () => ai.chatCheapCascade({ system: 's', user: 'x', feature: 'landing-analyst' }),
    // Las listas que todavía los nombran (las del lienzo, lib/flujo-ia.ts, se van con AU3): pedidos a mano, igual no salen.
    textoPedidoALosTres: () => ai.chatCheapCascade({ system: 's', user: 'x', feature: 'chatbot-paso-ia', provs: [...SACADOS] }),
    herramientasPedidasALosTres: () => ai.chatCheapToolsCascade('s', [{ role: 'user', content: 'hola' }], tool as never, async () => 'ok', { provs: [...SACADOS, 'gemini'], feature: 'chatbot-paso-ia' }),
    foto: () => ai.leerDocumentoIA({ dataUrl: png, isPdf: false, nombreArchivo: 'captura.png', prompt: 'qué dice', feature: 'El Archivero', redDePlataforma: true }),
    unoPorUno: async () => { for (const p of SACADOS) await ai.chatCheap({ system: 's', user: 'x', feature: 'landing-analyst', provider: p } as never).catch(() => null); },
    cuentasDeLosTres: async () => (await Promise.all(SACADOS.map((p) => ai.provsDe(p)))).flat().length,
    redDeLaPlataforma: async () => (await ai.provsGratisDePlataforma()).filter((p) => (SACADOS as readonly string[]).includes(p.provider)).length,
    // El orden de la cuota pedía el saldo de OpenRouter en CADA llamada: ya no sale a openrouter.ai.
    ordenDeLaCuota: () => ordenarPorCuota(['gemini', 'groq', 'openai']),
  };
  const out: Record<string, Record<string, { red: string[]; valor?: unknown }>> = {};
  for (const ws of [13, PLATAFORMA]) {
    out[`ws${ws}`] = {};
    for (const [nombre, f] of Object.entries(entradas)) {
      red = [];
      let valor: unknown;
      await runWithWorkspace(ws, async () => { try { valor = await f(); } catch (e) { valor = `tiró: ${e instanceof Error ? e.message.slice(0, 120) : String(e)}`; } });
      out[`ws${ws}`][nombre] = { red: [...new Set(red)], ...(typeof valor === 'number' ? { valor } : {}) };
    }
  }
  // Lo que se ofrece y las listas: los módulos son del servidor, así que se leen acá y no en el test.
  const { DEFS } = await import('../lib/integraciones-catalogo');
  const { SERVICIOS_METODO } = await import('../lib/metodo-catalogo');
  const { IA_PARA_CONECTAR } = await import('../lib/mako-turno-app-reglas');
  const { PROVS_MULTIKEY } = await import('../lib/ia-keys');
  const { PROVS_CREAR_IA, PROVS_GRATIS_PIN } = await import('../lib/flujo-ia');
  const listas = {
    cascadas: { CASCADA_DOCS: ai.CASCADA_DOCS, CASCADA_GRATIS: ai.CASCADA_GRATIS, VISION_CASCADE: ai.VISION_CASCADE, CASCADA_TOOLS: ai.CASCADA_TOOLS },
    // Las del lienzo de Automations (crear un flujo con IA y el pin de /modelos-ia).
    lienzo: { PROVS_CREAR_IA: [...PROVS_CREAR_IA], PROVS_GRATIS_PIN: [...PROVS_GRATIS_PIN] },
    integraciones: DEFS.map((d) => d.key), metodo: SERVICIOS_METODO.map((s) => s.key),
    paraConectar: [...IA_PARA_CONECTAR], multikey: [...PROVS_MULTIKEY],
  };
  process.stdout.write(`@@IA8@@${JSON.stringify({ ...out, listas })}\n`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
