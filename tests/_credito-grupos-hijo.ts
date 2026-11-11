// =============================================================================
// Hijo de tests/credito-grupos.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// El crédito de los planes 200 para TODOS los grupos de WhatsApp de MaKo (28/10/2026, Martín: «te pedí que habilites las API
// que tenemos disponibles con todas las cuentas de planes 200»). Corre lo REAL (las cuentas y su reparto, el interruptor, la
// puerta 2 y el chat con herramientas del doer) contra un PostgREST de mentira:
//   · ws9 (la plataforma): su ANTHROPIC_API_KEY y las claves del crédito de las cuentas 1 y 2 (como producción, medido hoy);
//   · ws10 (Leandro): una copia de la clave de Claude de la plataforma, que no es suya;
//   · ws13: su clave de Claude propia.
// Anthropic contesta 200 con la cuenta 2 y con la clave propia; con la cuenta 1, «credit balance is too low»; con otra, 401.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
for (const k of ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY', 'ANTHROPIC_CREDITO_CUENTA1', 'ANTHROPIC_CREDITO_CUENTA2', 'ANTHROPIC_CREDITO_CUENTA3', 'ANTHROPIC_CREDITO_CUENTA4', 'ANTHROPIC_CREDITO_CUENTA5', 'ANTHROPIC_CREDITO_CUENTA9']) delete process.env[k];

let n = 0;
const pg = crearPostgrest({
  tablas: ['credenciales', 'workspaces', 'app_settings', 'anthropic_usage', 'ia_cuotas', 'ia_rebotes', 'ia_pc_dispositivos'],
  defaults: (tabla, f) => (tabla === 'anthropic_usage' ? { id: ++n, created_at: new Date(Date.now() + n).toISOString(), ...f } : f),
});
const PLATAFORMA = 9;
const CLAUDE_MAKO = `sk-ant-api03-plataforma-${'p'.repeat(40)}`;
const CREDITO1 = `sk-ant-api03-credito-cuenta1-${'c'.repeat(40)}`;
const CREDITO2 = `sk-ant-api03-credito-cuenta2-${'d'.repeat(40)}`;
const CREDITO3 = `sk-ant-api03-credito-cuenta3-${'e'.repeat(40)}`;
const CREDITO4 = `sk-ant-api03-credito-cuenta4-${'f'.repeat(40)}`;
const CREDITO9 = `sk-ant-api03-credito-cuenta9-${'g'.repeat(40)}`;
const PROPIA = `sk-ant-api03-propia-del-ws13-${'m'.repeat(40)}`;

let anthropic: Array<{ clave: string; modelo: string }> = [];
/** Cada pedido a Anthropic, ¿llevó plazo? (11/11/2026: el bucle con herramientas no tenía). */
const conPlazo: boolean[] = [];
/** El system «herramienta-y-falla»: el primer pedido pide una herramienta, los siguientes contestan 429. */
let herramientaYFalla = 0;
let ajustesFallan = false;
/** La clave propia del ws13 contesta «credit balance is too low» (un negocio con SU Claude sin saldo). */
let propiaSinSaldo = false;
/** Cuántos de los próximos pedidos a Anthropic contestan 529 «overloaded» (un Anthropic saturado un segundo). */
let sobrecargados = 0;
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test' && ajustesFallan && u.pathname.endsWith('/app_settings') && (init.method ?? 'GET') === 'GET') {
    return new Response(JSON.stringify({ code: '57014', message: 'canceling statement due to statement timeout', details: null, hint: null }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
  if (u.host === 'supa.test') return pg.responder(u, init);
  const r = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  if (u.host === 'api.anthropic.com') {
    const clave = new Headers(init.headers).get('x-api-key') ?? '';
    let modelo = '';
    let system = '';
    try { const b = JSON.parse(String(init.body ?? '{}')); modelo = String(b.model ?? ''); system = String(b.system ?? ''); } catch { /* sin cuerpo */ }
    anthropic.push({ clave: clave.slice(0, 29), modelo });
    conPlazo.push(!!init.signal);
    if (system === 'herramienta-y-falla') {
      if (++herramientaYFalla === 1) return r(200, { id: 'msg_h', type: 'message', role: 'assistant', model: modelo, stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'tu_1', name: 'contar_leads', input: {} }], usage: { input_tokens: 500, output_tokens: 20 } });
      return r(429, { type: 'error', error: { type: 'rate_limit_error', message: 'Number of request tokens has exceeded your per-minute rate limit' } });
    }
    if (sobrecargados > 0) { sobrecargados--; return r(529, { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }); }
    if (clave === CREDITO1 || (propiaSinSaldo && clave === PROPIA)) return r(400, { type: 'error', error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.' } });
    if (clave !== CREDITO2 && clave !== PROPIA) return r(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } });
    return r(200, { id: 'msg_1', type: 'message', role: 'assistant', model: modelo, stop_reason: 'end_turn', content: [{ type: 'text', text: 'hola desde Claude' }], usage: { input_tokens: 1000, output_tokens: 200 } });
  }
  return r(500, { error: { message: 'red de mentira' } });
}) as typeof fetch;

const espera = () => new Promise((ok) => setTimeout(ok, 300));

async function main() {
  const { cifrarSecreto } = await import('../lib/credenciales');
  const { runWithWorkspace } = await import('../lib/workspace');
  const { setSetting } = await import('../lib/settings');
  const { permisoDeLaClaveDelNegocio, chatClaudeTools } = await import('../lib/anthropic');
  const { claveDeLaCuentaDeLosGrupos, cuentasDelCreditoDeLosGrupos, marcarCuentaDeLosGruposSinCredito } = await import('../lib/credito-negocio');
  const { creditoQuePago } = await import('../lib/credito-api');
  pg.db.workspaces.push({ id: PLATAFORMA, capa: 'superadmin', nombre: 'MaKo' }, { id: 1, capa: 'completo', nombre: 'Mauricio' }, { id: 10, capa: 'cliente', nombre: 'Leandro' }, { id: 13, capa: 'cliente', nombre: 'ws13' });
  const poner = (ws: number, clave: string, valor: string) => pg.db.credenciales.push({ workspace_id: ws, clave, valor_enc: cifrarSecreto(valor, ws, clave), servicio: clave.split('_')[0].toLowerCase() });
  poner(PLATAFORMA, 'ANTHROPIC_API_KEY', CLAUDE_MAKO);
  poner(PLATAFORMA, 'ANTHROPIC_CREDITO_CUENTA1', CREDITO1);
  poner(PLATAFORMA, 'ANTHROPIC_CREDITO_CUENTA2', CREDITO2);
  poner(10, 'ANTHROPIC_API_KEY', CLAUDE_MAKO);
  poner(13, 'ANTHROPIC_API_KEY', PROPIA);
  // Leandro eligió Sonnet para SU Claude: con el crédito de Martín va Haiku igual.
  pg.db.app_settings.push({ workspace_id: 10, key: 'ia.su_claude.modelo', value: 'sonnet' });
  const permiso = async (ws: number, feature: string, cuentaDeLosGrupos?: string) => {
    const r = await runWithWorkspace(ws, () => permisoDeLaClaveDelNegocio(feature, { cuentaDeLosGrupos })).catch((e) => ({ tiro: String(e) }));
    if (r && 'permiso' in r) return { clave: r.permiso.clave.slice(0, 29), modelo: r.permiso.model, esCredito: !!r.permiso.esCredito, cuenta: r.permiso.cuentaDelCredito ?? null };
    return r ? Object.keys(r)[0] : null;
  };
  const chat = (ws: number, cuentaDeLosGrupos?: string) => runWithWorkspace(ws, () => chatClaudeTools('s', [{ role: 'user', content: 'Tal cual como lo hace manychat' }], [], async () => 'ok', {
    feature: 'mako-doer-in', soloSuClaude: true, cuentaDeLosGrupos, motivo: `Claude del grupo${cuentaDeLosGrupos ? ` (${cuentaDeLosGrupos})` : ''}`,
  })).then((r) => r.text, (e) => `tiró: ${e instanceof Error ? e.message : String(e)}`);
  const out: Record<string, unknown> = {};

  // ── Las cuentas, con su reparto: una distinta primero en cada turno ─────────────────────────────────────────────────
  out.reparto = [await cuentasDelCreditoDeLosGrupos(), await cuentasDelCreditoDeLosGrupos(), await cuentasDelCreditoDeLosGrupos()];

  // ── La puerta 2 ─────────────────────────────────────────────────────────────────────────────────────────────────────
  out.ws10SinCuenta = await permiso(10, 'mako-doer-in');
  out.ws10Cuenta2 = await permiso(10, 'mako-doer-in', 'ANTHROPIC_CREDITO_CUENTA2');
  out.ws10OpsCenter = await permiso(10, 'mako-doer', 'ANTHROPIC_CREDITO_CUENTA2');
  out.ws10Plan = await permiso(10, 'plan-fathom', 'ANTHROPIC_CREDITO_CUENTA2');
  out.ws10OtraClave = await permiso(10, 'mako-doer-in', 'ANTHROPIC_API_KEY');
  out.ws13ConLaSuya = await permiso(13, 'mako-doer-in', 'ANTHROPIC_CREDITO_CUENTA2');

  // ── El chat del grupo con la cuenta 2: contesta, con Haiku, y el gasto va a la cuenta 2 ──────────────────────────────
  anthropic = [];
  out.chatCuenta2 = await chat(10, 'ANTHROPIC_CREDITO_CUENTA2');
  out.chatCuenta2Anthropic = [...anthropic];
  await espera();
  const filas = pg.db.anthropic_usage.filter((f) => f.workspace_id === 10);
  out.gasto = filas.map((f) => String(f.motivo ?? '').slice(0, 75));
  out.pago = filas.map((f) => creditoQuePago({ workspace_id: Number(f.workspace_id), motivo: String(f.motivo ?? ''), cuenta: Number(f.cuenta ?? 1), provider: String(f.provider ?? 'anthropic') }, new Map()));

  // ── La cuenta 1 sin crédito: tira, y su fallo NO va a la tarjeta del negocio ──────────────────────────────────────────
  const antes = pg.db.anthropic_usage.length;
  out.chatCuenta1 = await chat(10, 'ANTHROPIC_CREDITO_CUENTA1');
  await espera();
  out.filasDelFallo = pg.db.anthropic_usage.slice(antes).map((f) => `${f.workspace_id}:${String(f.motivo ?? '').slice(0, 100)}`);
  // La fila «sin crédito» que deja la puerta (11/11/2026) la ve el Uso de SuperAdmin.
  const { resumenCredito } = await import('../lib/credito-api');
  out.sinCreditoAt = resumenCredito({
    vinculadas: { claude1: true, claude2: true }, wsConClave: new Map(), ahora: Date.now() + 1_000,
    gastos: pg.db.anthropic_usage.map((f) => ({ workspace_id: Number(f.workspace_id), created_at: String(f.created_at), motivo: String(f.motivo ?? ''), cuenta: Number(f.cuenta ?? 1), cost_usd: Number(f.cost_usd ?? 0), provider: String(f.provider ?? 'anthropic'), model: String(f.model ?? '') })),
  }).find((c) => c.cuenta === 'claude1')?.sinCreditoAt ?? null;
  marcarCuentaDeLosGruposSinCredito('ANTHROPIC_CREDITO_CUENTA1');
  out.sinLaAgotada = await cuentasDelCreditoDeLosGrupos();

  // ── 11/11/2026: el espacio de MaKo (ws9) usa una cuenta para todo menos el Plan; un negocio, sólo en WhatsApp ────────────
  out.ws9OpsCenter = await permiso(PLATAFORMA, 'mako-doer', 'ANTHROPIC_CREDITO_CUENTA2');
  out.ws9Plan = await permiso(PLATAFORMA, 'plan-fathom', 'ANTHROPIC_CREDITO_CUENTA2');
  out.ws10Adjunto = await permiso(10, 'MaKo en WhatsApp · adjunto', 'ANTHROPIC_CREDITO_CUENTA2');
  // El texto con una cuenta del crédito (`conClaveDelNegocio`) en un negocio SIN su Claude (ws14): la fila con la cuenta y en
  // SU ws (antes caía al ws9); sin saldo, la fila «sin crédito» y nada en la tarjeta del negocio.
  pg.db.workspaces.push({ id: 14, capa: 'cliente', nombre: 'ws14' });
  const { conClaveDelNegocio } = await import('../lib/anthropic');
  const texto = (cuenta: string) => runWithWorkspace(14, () => conClaveDelNegocio({ system: 's', user: 'la foto del grupo', feature: 'MaKo en WhatsApp · adjunto', motivo: 'Leer el adjunto', timeoutMs: 5_000, cuentaDeLosGrupos: cuenta }));
  const antes14 = pg.db.anthropic_usage.length;
  out.textoWs14 = await texto('ANTHROPIC_CREDITO_CUENTA2');
  out.textoWs14SinSaldo = await texto('ANTHROPIC_CREDITO_CUENTA1');
  await espera();
  out.filasWs14 = pg.db.anthropic_usage.slice(antes14).map((f) => `${f.workspace_id}:${f.cuenta}:${String(f.motivo ?? '').slice(0, 100)}`);
  // La FOTO de un grupo (`leerDocumentoIA`, `MaKo en WhatsApp · adjunto`; revisión del 11/11/2026): sin su Claude (ws14), la lee
  // el crédito; con SU Claude sin saldo (ws13), UN pedido a su clave y ninguno al crédito (la puerta 2 le daría la suya otra vez
  // en cada cuenta: su clave gana).
  const { leerDocumentoIA } = await import('../lib/ai-cheap');
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const foto = (ws: number) => runWithWorkspace(ws, () => leerDocumentoIA({ dataUrl: png, isPdf: false, nombreArchivo: 'foto.png', prompt: '¿qué ves?', feature: 'MaKo en WhatsApp · adjunto', motivo: 'Leer el adjunto', timeoutMs: 5_000 }))
    .then((x) => x.text, (e) => `tiró: ${e instanceof Error ? e.message : String(e)}`);
  anthropic = [];
  out.fotoWs14 = { texto: await foto(14), pedidos: anthropic.map((a) => a.clave) };
  propiaSinSaldo = true;
  anthropic = [];
  out.fotoWs13 = { texto: await foto(13), pedidos: anthropic.map((a) => a.clave) };
  propiaSinSaldo = false;
  // Un 529 de la primera cuenta, sin nada que mire después (el ws14 no tiene su IA): prueba la cuenta siguiente (la 3, con el
  // mismo valor que la 2 para que conteste) en vez de dejar la foto sin leer.
  process.env.ANTHROPIC_CREDITO_CUENTA3 = CREDITO2;
  sobrecargados = 1;
  anthropic = [];
  out.fotoWs14Con529 = { texto: await foto(14), pedidos: anthropic.length };
  sobrecargados = 0;
  delete process.env.ANTHROPIC_CREDITO_CUENTA3;

  // ── 11/11/2026: el chat con herramientas del Ops Center del ws9 (`mako-doer`, sin `soloSuClaude`) va PRIMERO con el crédito;
  //    el de un negocio, nunca; cada pedido lleva plazo; y si una herramienta ya corrió, el fallo se re-lanza (sin otra cuenta) ──
  const tool = [{ name: 'contar_leads', description: 'Cuenta', input_schema: { type: 'object', properties: {} } }];
  const opsCenter = (ws: number, system = 's') => runWithWorkspace(ws, () => chatClaudeTools(system, [{ role: 'user', content: '¿cuántos leads?' }], tool, async () => { corridas++; return 'ok'; }, { feature: 'mako-doer', maxSteps: 4, motivo: 'Ops Center' }))
    .then((r) => r.text, (e) => `tiró: ${e instanceof Error ? e.message : String(e)}`);
  let corridas = 0;
  anthropic = [];
  conPlazo.length = 0;
  out.opsCenterWs9 = await opsCenter(PLATAFORMA);
  out.opsCenterWs9Anthropic = [...anthropic];
  out.opsCenterConPlazo = conPlazo.every(Boolean) && conPlazo.length > 0;
  anthropic = [];
  out.opsCenterWs10 = await opsCenter(10);
  out.opsCenterWs10Credito = anthropic.filter((a) => /credito/.test(a.clave)).length;
  process.env.ANTHROPIC_CREDITO_CUENTA3 = CREDITO3;
  anthropic = [];
  corridas = 0;
  out.herramientaYFalla = { r: await opsCenter(PLATAFORMA, 'herramienta-y-falla'), pedidos: anthropic.length, corridas };
  delete process.env.ANTHROPIC_CREDITO_CUENTA3;

  // ── Una cuenta por el entorno también cuenta ───────────────────────────────────────────────────────────────────────
  process.env.ANTHROPIC_CREDITO_CUENTA3 = CREDITO3;
  out.conLaDelEntorno = (await cuentasDelCreditoDeLosGrupos()).sort();
  // La cuenta 3 no está en el crédito de la plataforma (`CLAVES_CREDITO_PLATAFORMA`): igual es de Martín, y va con Haiku.
  out.ws10Cuenta3 = await permiso(10, 'mako-doer-in', 'ANTHROPIC_CREDITO_CUENTA3');
  delete process.env.ANTHROPIC_CREDITO_CUENTA3;

  // ── El interruptor: apagado, ninguna; sin poder leerlo, ninguna ───────────────────────────────────────────────────────
  ajustesFallan = true;
  out.sinLeer = await cuentasDelCreditoDeLosGrupos();
  ajustesFallan = false;
  await runWithWorkspace(PLATAFORMA, () => setSetting('ia.credito_grupos', 'apagado'));
  out.apagado = await cuentasDelCreditoDeLosGrupos();
  out.apagadoPermisoSigue = await permiso(10, 'mako-doer-in', 'ANTHROPIC_CREDITO_CUENTA2');
  await runWithWorkspace(PLATAFORMA, () => setSetting('ia.credito_grupos', 'prendido'));
  out.prendido = await cuentasDelCreditoDeLosGrupos();

  // ── N cuentas: con las cuatro del Uso cargadas (la 1 sigue agotada), el reparto recorre las TRES que quedan; una clave con el
  //    mismo prefijo que el Uso no conoce (la 9) no paga nada ─────────────────────────────────────────────────────────────
  process.env.ANTHROPIC_CREDITO_CUENTA3 = CREDITO3;
  process.env.ANTHROPIC_CREDITO_CUENTA9 = CREDITO9;
  poner(PLATAFORMA, 'ANTHROPIC_CREDITO_CUENTA4', CREDITO4);
  out.nCuentas = [await cuentasDelCreditoDeLosGrupos(), await cuentasDelCreditoDeLosGrupos(), await cuentasDelCreditoDeLosGrupos()];
  out.laNueve = await claveDeLaCuentaDeLosGrupos('ANTHROPIC_CREDITO_CUENTA9');
  out.ws10Cuenta4 = await permiso(10, 'mako-doer-in', 'ANTHROPIC_CREDITO_CUENTA4');

  // ── El % del vigía (11/11/2026): primero la que menos gastó; la PLATAFORMA saltea la del 90% o más, los grupos no; y cada uso
  //    con su interruptor ──────────────────────────────────────────────────────────────────────────────────────────────
  const { cuentasDelCredito } = await import('../lib/credito-negocio');
  const uso = (cuentas: Record<string, number>, at = new Date().toISOString()) =>
    runWithWorkspace(PLATAFORMA, () => setSetting('ia.credito.uso', JSON.stringify({ at, cuentas })));
  await uso({ ANTHROPIC_CREDITO_CUENTA2: 95, ANTHROPIC_CREDITO_CUENTA3: 10, ANTHROPIC_CREDITO_CUENTA4: 50 });
  out.usoGrupos = await cuentasDelCredito('grupos');
  out.usoPlataforma = await cuentasDelCredito('plataforma');
  await uso({ ANTHROPIC_CREDITO_CUENTA2: 95, ANTHROPIC_CREDITO_CUENTA3: 10, ANTHROPIC_CREDITO_CUENTA4: 50 }, new Date(Date.now() - 3 * 3_600_000).toISOString());
  out.usoViejo = (await cuentasDelCredito('plataforma')).length;
  await uso({});
  await runWithWorkspace(PLATAFORMA, () => setSetting('ia.credito_plataforma', 'apagado'));
  out.plataformaApagada = { plataforma: await cuentasDelCredito('plataforma'), grupos: (await cuentasDelCredito('grupos')).length,
    clave: await claveDeLaCuentaDeLosGrupos('ANTHROPIC_CREDITO_CUENTA2', 'plataforma'), claveGrupos: !!(await claveDeLaCuentaDeLosGrupos('ANTHROPIC_CREDITO_CUENTA2', 'grupos')) };
  await runWithWorkspace(PLATAFORMA, () => setSetting('ia.credito_plataforma', 'prendido'));
  delete process.env.ANTHROPIC_CREDITO_CUENTA3;
  delete process.env.ANTHROPIC_CREDITO_CUENTA9;

  // ── Sin ninguna clave cargada: ninguna ─────────────────────────────────────────────────────────────────────────────
  pg.db.credenciales = pg.db.credenciales.filter((f) => !String(f.clave).startsWith('ANTHROPIC_CREDITO_'));
  out.sinClaves = await cuentasDelCreditoDeLosGrupos();
  process.stdout.write(`@@GRUPOS@@${JSON.stringify(out)}\n`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@GRUPOS@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}\n`); process.exit(0); });
