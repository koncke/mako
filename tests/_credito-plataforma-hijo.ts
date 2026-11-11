// =============================================================================
// Hijo de tests/credito-plataforma-frontera.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// El crédito de Claude para todo lo del espacio de MaKo (11/11/2026), corrido de VERDAD contra un PostgREST de mentira y con las
// claves del crédito CARGADAS (entorno y fila de la plataforma): la cascada de texto, la de herramientas, la lectura de imágenes y
// la puerta 2 forzada con una cuenta. Desde un negocio (ws13), desde el ws1 (Mauricio, OWNER_WS: es donde cae un cron sin cookie,
// con su crédito asignado APAGADO para que no se mezcle) y sin ningún workspace, ninguna llamada al crédito ni fila con su marca.
// El ws9 (la plataforma) es el control: ahí sí, para que el «cero» de los otros no sea un cero que no mide nada.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
for (const k of ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY', 'ANTHROPIC_CREDITO_CUENTA1', 'ANTHROPIC_CREDITO_CUENTA2', 'ANTHROPIC_CREDITO_CUENTA3', 'ANTHROPIC_CREDITO_CUENTA4', 'ANTHROPIC_CREDITO_CUENTA5']) delete process.env[k];

let n = 0;
const pg = crearPostgrest({
  tablas: ['credenciales', 'workspaces', 'app_settings', 'anthropic_usage', 'ia_cuotas', 'ia_rebotes', 'ia_pc_dispositivos'],
  defaults: (tabla, f) => (tabla === 'anthropic_usage' ? { id: ++n, created_at: new Date(Date.now() + n).toISOString(), ...f } : f),
});
const PLATAFORMA = 9;
const CREDITO1 = `sk-ant-api03-credito-cuenta1-${'c'.repeat(40)}`;
const CREDITO2 = `sk-ant-api03-credito-cuenta2-${'d'.repeat(40)}`;
process.env.ANTHROPIC_CREDITO_CUENTA1 = CREDITO1;

/** Cada pedido que llegó a Anthropic con una clave del crédito. */
let alCredito = 0;
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  const r = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  if (u.host === 'api.anthropic.com') {
    const clave = new Headers(init.headers).get('x-api-key') ?? '';
    if (clave === CREDITO1 || clave === CREDITO2) {
      alCredito++;
      return r(200, { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-haiku-4-5', stop_reason: 'end_turn', content: [{ type: 'text', text: 'respuesta del crédito' }], usage: { input_tokens: 100, output_tokens: 20 } });
    }
    return r(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } });
  }
  return r(500, { error: { message: 'red de mentira' } });
}) as typeof fetch;

const conMarca = () => pg.db.anthropic_usage.filter((f) => String(f.motivo ?? '').startsWith('⚠ crédito de Claude de la plataforma')).length;

async function main() {
  const { cifrarSecreto } = await import('../lib/credenciales');
  const { runWithWorkspace } = await import('../lib/workspace');
  const { setSetting } = await import('../lib/settings');
  const { chatCheapCascade, leerDocumentoIA } = await import('../lib/ai-cheap');
  const { chatClaudeTools, permisoDeLaClaveDelNegocio } = await import('../lib/anthropic');
  pg.db.workspaces.push({ id: PLATAFORMA, capa: 'superadmin', nombre: 'MaKo' }, { id: 1, capa: 'completo', nombre: 'Mauricio' }, { id: 13, capa: 'cliente', nombre: 'ws13' });
  pg.db.credenciales.push({ workspace_id: PLATAFORMA, clave: 'ANTHROPIC_CREDITO_CUENTA2', valor_enc: cifrarSecreto(CREDITO2, PLATAFORMA, 'ANTHROPIC_CREDITO_CUENTA2'), servicio: 'anthropic' });
  // El crédito ASIGNADO al ws1 (la cuenta 1, 22/10/2026) es otra excepción, con su interruptor: apagado acá, para medir sólo la nueva.
  await runWithWorkspace(PLATAFORMA, () => setSetting('ia.credito_negocio.1', 'apagado'));

  const tool = [{ name: 'contar_leads', description: 'Cuenta', input_schema: { type: 'object', properties: {} } }];
  const llamadas = {
    texto: () => chatCheapCascade({ system: 's', user: 'espiar a la competencia', feature: 'spy', provs: ['gemini'], timeoutMs: 5_000 }),
    herramientas: () => chatClaudeTools('s', [{ role: 'user', content: '¿cuántos leads?' }], tool, async () => 'ok', { feature: 'mako-doer', maxSteps: 2 }).then((x) => x.text),
    imagen: () => leerDocumentoIA({ dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', isPdf: false, nombreArchivo: 'a.png', prompt: '¿qué ves?', feature: 'mako-chat', timeoutMs: 5_000 }).then((x) => x.text),
    puertaForzada: () => permisoDeLaClaveDelNegocio('spy', { cuentaDeLosGrupos: 'ANTHROPIC_CREDITO_CUENTA2' }).then((x) => (x && 'permiso' in x ? `PERMISO ${x.permiso.cuentaDelCredito ?? ''}` : 'sin permiso')),
  } as const;
  const medir = async (correr: (fn: () => Promise<string>) => Promise<string>) => {
    const out: Record<string, { credito: number; filas: number; r: string }> = {};
    for (const [nombre, fn] of Object.entries(llamadas)) {
      const antes = { credito: alCredito, filas: conMarca() };
      const r = await correr(fn).catch((e) => `tiró: ${e instanceof Error ? e.message : String(e)}`);
      await new Promise((ok) => setTimeout(ok, 100));
      out[nombre] = { credito: alCredito - antes.credito, filas: conMarca() - antes.filas, r: String(r).slice(0, 80) };
    }
    return out;
  };
  const res: Record<string, unknown> = {};
  res.ws13 = await medir((fn) => runWithWorkspace(13, fn));
  res.ws1 = await medir((fn) => runWithWorkspace(1, fn));
  res.sinWorkspace = await medir((fn) => fn());
  res.ws9 = await medir((fn) => runWithWorkspace(PLATAFORMA, fn));
  process.stdout.write(`@@FRONTERA@@${JSON.stringify(res)}\n`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@FRONTERA@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}\n`); process.exit(0); });
