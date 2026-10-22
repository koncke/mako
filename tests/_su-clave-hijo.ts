// =============================================================================
// Hijo de tests/su-clave.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// lib/anthropic.ts y lib/ai-cheap.ts llevan `server-only`: esto corre en un node aparte con `--conditions=react-server` y
// le contesta al test con un JSON. Corre las funciones REALES (la cascada de texto con la clave de Claude del negocio
// primero, la de herramientas con su OpenAI, «Probar mi clave» y lo que lee la tarjeta) contra un PostgREST de mentira
// (tests/_postgrest-de-mentira.ts). Anthropic contesta «sin crédito» y OpenAI un 401 que trae la clave ENMASCARADA, como
// los de verdad (medido el 22/10/2026). Lo que importa: que cada fallo deje su fila, con la marca y el motivo corto, y
// nunca el texto del proveedor; y que en el workspace de la PLATAFORMA no se anote nada (su clave es la de MaKo).
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;

let n = 0;
const pg = crearPostgrest({
  tablas: ['credenciales', 'workspaces', 'app_settings', 'anthropic_usage', 'ia_cuotas', 'ia_rebotes', 'ia_pc_dispositivos'],
  defaults: (tabla, f) => (tabla === 'anthropic_usage' ? { id: ++n, created_at: new Date(Date.now() + n).toISOString(), ...f } : f),
});
const red: string[] = [];
/** La base rechaza los inserts de `anthropic_usage` (un 500 de PostgREST). */
let insertFalla = false;
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test' && insertFalla && init.method === 'POST' && u.pathname.endsWith('/anthropic_usage')) {
    return new Response(JSON.stringify({ code: '57014', message: 'canceling statement due to statement timeout', details: null, hint: null }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
  if (u.host === 'supa.test') return pg.responder(u, init);
  red.push(`${u.host}${u.pathname}`);
  const r = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  if (u.host === 'api.anthropic.com' && u.pathname.endsWith('/count_tokens')) return r(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } });
  if (u.host === 'api.anthropic.com') return r(400, { type: 'error', error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.' } });
  if (u.host === 'api.openai.com') return r(401, { error: { message: 'Incorrect API key provided: sk-proj-**************gocio. You can find your API key at https://platform.openai.com/account/api-keys.', type: 'invalid_request_error', code: 'invalid_api_key' } });
  return r(500, { error: { message: 'red de mentira' } });
}) as typeof fetch;

const WS = 3;
const PLATAFORMA = 9;
const espera = () => new Promise((r) => setTimeout(r, 300));

async function main() {
  const { cifrarSecreto } = await import('../lib/credenciales');
  const { runWithWorkspace } = await import('../lib/workspace');
  const ai = await import('../lib/ai-cheap');
  const { estadoDeSusClaves, probarSuClave } = await import('../lib/su-clave');
  pg.db.workspaces.push({ id: PLATAFORMA, capa: 'superadmin', nombre: 'MaKo' }, { id: WS, capa: 'cliente', nombre: 'Prueba' });
  const poner = (ws: number, clave: string, valor: string) => pg.db.credenciales.push({ workspace_id: ws, clave, valor_enc: cifrarSecreto(valor, ws, clave), servicio: clave.split('_')[0].toLowerCase() });
  poner(PLATAFORMA, 'ANTHROPIC_API_KEY', `sk-ant-api03-plataforma-${'p'.repeat(40)}`);
  poner(PLATAFORMA, 'OPENAI_API_KEY', `sk-proj-plataforma-${'P'.repeat(40)}`);
  poner(WS, 'ANTHROPIC_API_KEY', `sk-ant-api03-negocio-${'n'.repeat(40)}`);
  poner(WS, 'OPENAI_API_KEY', `sk-proj-negocio-${'N'.repeat(40)}`);

  const out: Record<string, unknown> = {};
  // 1) Una función de texto: su Claude primero (sin crédito), después su OpenAI (clave inválida).
  const errores: string[] = [];
  out.texto = await runWithWorkspace(WS, () => ai.chatCheapCascade({ system: 's', user: 'hola', feature: 'landing-analyst', provs: ['openai'], erroresOut: errores }));
  await espera();
  out.filasTexto = pg.db.anthropic_usage.map((f) => ({ ws: f.workspace_id, provider: f.provider, model: f.model, motivo: f.motivo }));
  // 2) Lo que lee la tarjeta.
  out.estado = await estadoDeSusClaves(WS);
  // 3) El mismo fallo otra vez no llena la tabla (una fila por motivo cada 5 minutos).
  const antes = pg.db.anthropic_usage.length;
  await runWithWorkspace(WS, () => ai.chatCheapCascade({ system: 's', user: 'hola', feature: 'landing-analyst', provs: ['openai'] }));
  await espera();
  out.repetido = pg.db.anthropic_usage.length - antes;
  // 4) «Probar mi clave»: un pedido que no cobra, y si no anda, su fila.
  out.probarClaude = await probarSuClave(WS, 'anthropic');
  out.probarOpenAI = await probarSuClave(WS, 'openai');
  // 5) La plataforma: sus claves son las de MaKo, no se anota «su clave».
  const antesPlat = pg.db.anthropic_usage.length;
  await runWithWorkspace(PLATAFORMA, () => ai.chatCheapCascade({ system: 's', user: 'hola', feature: 'landing-analyst', provs: ['openai'] }));
  await espera();
  out.plataforma = pg.db.anthropic_usage.slice(antesPlat).filter((f) => String(f.model ?? '').startsWith('fallo:')).length;
  // 6) Una copia de la de la plataforma no se prueba: no es la suya.
  pg.db.credenciales = pg.db.credenciales.filter((f) => !(f.workspace_id === WS && f.clave === 'OPENAI_API_KEY'));
  poner(WS, 'OPENAI_API_KEY', `sk-proj-plataforma-${'P'.repeat(40)}`);
  const redAntes = red.length;
  out.probarCopia = await probarSuClave(WS, 'openai');
  out.redCopia = red.length - redAntes;
  // 7) La fila del fallo que la base RECHAZA no frena la siguiente (segunda revisión del lote 1): la marca de los 5 min se
  //    saca si la fila no quedó, y el próximo fallo la vuelve a escribir.
  const { anotarFalloDeSuClave } = await import('../lib/su-clave');
  const conDeTope = () => pg.db.anthropic_usage.filter((f) => f.workspace_id === WS && String(f.motivo ?? '').includes('tope por minuto')).length;
  insertFalla = true;
  await runWithWorkspace(WS, () => anotarFalloDeSuClave({ proveedor: 'openai', error: 'HTTP 429 Rate limit reached for requests', feature: 'landing-analyst', modelo: 'gpt-4o-mini' }));
  out.filasConLaBaseCaida = conDeTope();
  insertFalla = false;
  await runWithWorkspace(WS, () => anotarFalloDeSuClave({ proveedor: 'openai', error: 'HTTP 429 Rate limit reached for requests', feature: 'landing-analyst', modelo: 'gpt-4o-mini' }));
  out.filasDespues = conDeTope();
  out.todas = pg.db.anthropic_usage.map((f) => ({ ws: f.workspace_id, provider: f.provider, model: f.model, motivo: f.motivo, cost: f.cost_usd }));
  out.red = red;
  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@RESULTADO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}`); process.exit(0); });
