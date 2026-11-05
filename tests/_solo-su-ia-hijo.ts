// =============================================================================
// Hijo de tests/solo-su-ia.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// lib/ai-cheap.ts lleva `server-only`: este archivo corre en un node aparte con `--conditions=react-server` y le contesta
// al test con un JSON. Corre las entradas REALES de la cascada barata —texto, herramientas, documentos, visión, audio, y
// las preguntas de «¿hay IA?»— contra un PostgREST de mentira (tests/_postgrest-de-mentira.ts) donde el negocio (ws3)
// tiene cargadas sus keys de Gemini, Groq, OpenRouter, Mistral, Cerebras y OpenAI, y la plataforma (ws9) las suyas.
// Todo lo que sale a la red y no es la base se ANOTA por host y contesta 500.
//
// Dos corridas de lo mismo: fuera de `conSoloSuIA` (el control: tiene que salir a Gemini y a Groq, si no la prueba no ve
// nada) y adentro (D6b: sólo su IA —su Gemini y su OpenAI, IA16—, ni un pedido a Groq, Mistral, OpenRouter o Cerebras, ni
// una lectura de sus keys en la base).
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';

const pg = crearPostgrest({ tablas: ['credenciales', 'workspaces', 'app_settings', 'anthropic_usage', 'ia_cuotas', 'ia_rebotes', 'ia_pc_dispositivos'] });
let red: string[] = [];
let lecturasDeKeys: string[] = [];
/** Una tabla cuya lectura falla (un 500 de la base): «no pude leer» no es «no hay». */
let tablaQueFalla: string | null = null;
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') {
    if (tablaQueFalla && u.pathname.endsWith(`/${tablaQueFalla}`)) {
      return new Response(JSON.stringify({ code: '57014', message: 'canceling statement due to statement timeout', details: null, hint: null }), { status: 500, headers: { 'content-type': 'application/json' } });
    }
    if (u.pathname.endsWith('/credenciales')) lecturasDeKeys.push(`${u.searchParams.get('workspace_id') ?? ''} ${u.searchParams.get('clave') ?? ''}`);
    return pg.responder(u, init);
  }
  red.push(u.host);
  return new Response(JSON.stringify({ error: { message: 'red de mentira' } }), { status: 500, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

const WS = 3;
const PLATAFORMA = 9;
const KEYS = ['GEMINI_API_KEY', 'GROQ_API_KEY', 'OPENROUTER_API_KEY', 'MISTRAL_API_KEY', 'CEREBRAS_API_KEY', 'OPENAI_API_KEY'];

async function main() {
  const { cifrarSecreto } = await import('../lib/credenciales');
  const { runWithWorkspace } = await import('../lib/workspace');
  const { conSoloSuIA } = await import('../lib/solo-su-ia');
  const ai = await import('../lib/ai-cheap');
  pg.db.workspaces.push({ id: PLATAFORMA, capa: 'superadmin', nombre: 'MaKo' }, { id: WS, capa: 'cliente', nombre: 'Prueba' });
  for (const [ws, prefijo] of [[WS, 'negocio'], [PLATAFORMA, 'plataforma']] as const) {
    for (const k of KEYS) pg.db.credenciales.push({ workspace_id: ws, clave: k, valor_enc: cifrarSecreto(`${prefijo}-${k}-${'x'.repeat(30)}`, ws, k), servicio: k.split('_')[0].toLowerCase() });
  }
  const png = 'data:image/png;base64,iVBORw0KGgo=';
  const tool = [{ name: 'contar_leads', description: 'Cuenta', input_schema: { type: 'object', properties: {} } }];
  const entradas: Record<string, () => Promise<unknown>> = {
    chatCheap: () => ai.chatCheap({ system: 's', user: 'Juan Pérez quiere otra landing', feature: 'El Archivero' }),
    chatCheapCascade: () => ai.chatCheapCascade({ system: 's', user: 'lista de 40 leads', feature: 'El Archivero', redDePlataforma: true }),
    chatCheapCascadeGratis: () => ai.chatCheapCascade({ system: 's', user: 'x', provs: ['gemini', 'groq', 'mistral', 'openrouter'], redDePlataforma: true }),
    // Image «sin Gemini» (5/11/2026, `deSuIA` en lib/model-catalogo.ts): la cascada con la marca, y el chat de Image ENTERO
    // (chatClaude con su feature: el catálogo pone la marca, no quien llama).
    chatCheapCascadeSinGemini: () => ai.chatCheapCascade({ system: 's', user: 'x', provs: ['gemini', 'openai'], sinGemini: true }),
    chatClaudeImagen: async () => (await import('../lib/anthropic')).chatClaude('s', [{ role: 'user', content: 'cambia el título' }], { feature: 'image-editor-ia', maxTokens: 50 }),
    chatCheapTools: () => ai.chatCheapTools('s', [{ role: 'user', content: 'hola' }], tool as never, async () => 'ok', { provider: 'gemini' }),
    chatCheapToolsCascade: () => ai.chatCheapToolsCascade('s', [{ role: 'user', content: 'hola' }], tool as never, async () => 'ok', { provs: [...ai.CASCADA_TOOLS] }),
    leerDocumentoIA: () => ai.leerDocumentoIA({ dataUrl: png, isPdf: false, nombreArchivo: 'captura.png', prompt: 'qué dice', redDePlataforma: true }),
    transcribirAudio: () => ai.transcribirAudio(Buffer.from('audio').toString('base64'), 'audio/webm', { motivo: 'nota de voz' }),
    provsDe: () => Promise.all(['gemini', 'groq', 'mistral', 'openrouter', 'cerebras'].map((p) => ai.provsDe(p as never))),
    provsGratisDePlataforma: () => ai.provsGratisDePlataforma(),
    cheapDisponible: () => ai.cheapDisponible(),
    sttDisponible: () => ai.sttDisponible(),
    docsIADisponible: () => ai.docsIADisponible(),
  };
  const correr = async (soloSuya: boolean) => {
    const out: Record<string, { red: string[]; keys: string[]; valor?: unknown }> = {};
    for (const [nombre, f] of Object.entries(entradas)) {
      red = [];
      lecturasDeKeys = [];
      let valor: unknown;
      await runWithWorkspace(WS, () => conSoloSuIA(soloSuya, async () => { try { valor = await f(); } catch { valor = 'tiró'; } }));
      out[nombre] = { red: [...new Set(red)], keys: [...new Set(lecturasDeKeys)], ...(nombre === 'provsDe' || nombre === 'provsGratisDePlataforma' ? { valor: (valor as unknown[] | undefined)?.flat?.().length ?? valor } : {}) };
    }
    return out;
  };
  const control = await correr(false);
  const conSuIA = await correr(true);

  // ── La decisión, por NEGOCIO y fallando cerrada (lib/ia-del-negocio.ts) ──────────────────────────────────────────
  const { negocioConSuIA } = await import('../lib/ia-del-negocio');
  const credsDe = (ws: number) => pg.db.credenciales.filter((f) => f.workspace_id === ws);
  const dejar = (ws: number, claves: string[]) => {
    pg.db.credenciales = pg.db.credenciales.filter((f) => f.workspace_id !== ws || claves.includes(String(f.clave)));
  };
  const negocio: Record<string, unknown> = {};
  // IA16 (22/10/2026): su Gemini ES su IA. Lo que no es su IA: sólo Groq (escucha, no contesta).
  dejar(WS, ['GROQ_API_KEY']);
  negocio.soloGroq = await negocioConSuIA(WS);
  // Una PC PENDIENTE (emparejada, sin el «sí» o sin su primer latido con sesión) no cuenta (mig 0322, segunda revisión).
  pg.db.ia_pc_dispositivos.push({ id: 1, workspace_id: WS, persona: 'admin@negocio.com', revocado_at: null, confirmado_at: null, activa_at: null });
  negocio.conPcPendiente = await negocioConSuIA(WS);
  pg.db.ia_pc_dispositivos[0].confirmado_at = new Date().toISOString();
  negocio.conPcSinLatido = await negocioConSuIA(WS);
  // La PC ACTIVA de OTRA persona del negocio (la admin): el turno del closer también es «con su IA».
  pg.db.ia_pc_dispositivos[0].activa_at = new Date().toISOString();
  negocio.conPcDeOtra = await negocioConSuIA(WS);
  pg.db.ia_pc_dispositivos[0].revocado_at = new Date().toISOString();
  negocio.pcDesconectada = await negocioConSuIA(WS);
  // Su Gemini (de AI Studio) cuenta; una COPIA de la de la plataforma, no.
  pg.db.credenciales.push({ workspace_id: WS, clave: 'GEMINI_API_KEY', valor_enc: cifrarSecreto(`negocio-gemini-propia-${'g'.repeat(30)}`, WS, 'GEMINI_API_KEY'), servicio: 'gemini' });
  negocio.conSuGemini = await negocioConSuIA(WS);
  dejar(WS, ['GROQ_API_KEY']);
  pg.db.credenciales.push({ workspace_id: WS, clave: 'GEMINI_API_KEY', valor_enc: cifrarSecreto(`plataforma-GEMINI_API_KEY-${'x'.repeat(30)}`, WS, 'GEMINI_API_KEY'), servicio: 'gemini' });
  negocio.conCopiaDeGemini = await negocioConSuIA(WS);
  dejar(WS, ['GROQ_API_KEY']);
  pg.db.credenciales.push(...credsDe(PLATAFORMA).filter((f) => f.clave === 'OPENAI_API_KEY').map((f) => ({ ...f, workspace_id: WS, valor_enc: cifrarSecreto(`negocio-openai-${'y'.repeat(30)}`, WS, 'OPENAI_API_KEY') })));
  negocio.conSuOpenAI = await negocioConSuIA(WS);
  dejar(WS, ['GEMINI_API_KEY']);
  pg.db.credenciales.push({ workspace_id: WS, clave: 'ANTHROPIC_API_KEY', valor_enc: cifrarSecreto(`sk-ant-negocio-${'z'.repeat(30)}`, WS, 'ANTHROPIC_API_KEY'), servicio: 'anthropic' });
  negocio.conSuClaude = await negocioConSuIA(WS);
  dejar(WS, ['GEMINI_API_KEY']);
  tablaQueFalla = 'ia_pc_dispositivos';
  negocio.fallaLaPc = await negocioConSuIA(WS);
  tablaQueFalla = 'credenciales';
  negocio.fallanLasClaves = await negocioConSuIA(WS);
  tablaQueFalla = null;
  // La plataforma misma: sus claves no son «su IA» de un cliente (lo interno sigue como estaba).
  negocio.plataforma = await negocioConSuIA(PLATAFORMA);
  process.stdout.write(`@@RESULTADO@@${JSON.stringify({ control, conSuIA, negocio })}`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@RESULTADO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}`); process.exit(0); });
