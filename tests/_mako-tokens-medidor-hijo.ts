// =============================================================================
// Hijo de tests/mako-tokens-medidor.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre las entradas REALES de la capa de IA (lib/ai-cheap.ts, lib/anthropic.ts) y observa dos cosas que no se pueden ver
// leyendo el código: **si la llamada llegó a salir a la red** y **qué le pidió al medidor de MaKo Tokens**.
//
// ⚠️ EL `rpc/mako_tokens_*` DE ACÁ ES UN OBSERVADOR, NO UNA SEGUNDA IMPLEMENTACIÓN. Decide con un `saldo` que el test
// pone a mano y anota cada pedido. La LÓGICA de la caja (que el cupo no se acumule, que no se cobre dos veces, que el
// saldo no quede negativo con dos gastos a la vez) se prueba contra un Postgres DE VERDAD en
// scripts/probar-0416-pglite.mjs: reimplementarla en JavaScript acá sería probar la copia, y la copia es justo lo que se
// separa del original sin que nadie avise.
//
// Los negocios:
//   · ws14: sólo Groq → NO es «su IA» (lib/ia-del-negocio.ts) → la paga MaKo → **descuenta MaKo Tokens**;
//   · ws3:  su OpenAI y su Gemini → es su IA → su clave paga → **no descuenta**;
//   · ws9:  la plataforma → lo interno de MaKo no se le cobra a nadie.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
for (const k of ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY']) delete process.env[k];

let n = 0;
const pg = crearPostgrest({
  tablas: ['credenciales', 'workspaces', 'app_settings', 'anthropic_usage', 'ia_cuotas', 'ia_rebotes', 'ia_pc_dispositivos', 'mako_tokens_saldo', 'mako_tokens_movimientos'],
  defaults: (_t, f) => ({ id: ++n, created_at: new Date().toISOString(), ...f }),
});

const PLATAFORMA = 9;

/** Lo que el test pone antes de cada caso. */
let saldo = 0;
/** Lo que el medidor pidió: un renglón por llamada a la caja. */
type Pedido = { fn: string; ws: number; cuesta?: number; feature?: string | null; dioOk?: boolean; deltaCupo?: number; deltaComprado?: number; motivo?: string };
let pedidos: Pedido[] = [];
/** A qué hosts salió. Vacío = la llamada no llegó a ningún proveedor. */
let red: string[] = [];

const json = (status: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });

globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') {
    const cuerpo = typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    if (u.pathname.endsWith('/rpc/mako_tokens_gastar')) {
      const cuesta = Number(cuerpo.p_cuesta ?? 0);
      const ok = cuesta <= 0 || saldo >= cuesta;
      if (ok) saldo -= Math.max(0, cuesta);
      pedidos.push({ fn: 'gastar', ws: Number(cuerpo.p_ws), cuesta, feature: (cuerpo.p_feature as string) ?? null, dioOk: ok });
      return json(200, [{ ok, saldo, comprado: 0, tomado_cupo: ok ? cuesta : 0, tomado_comprado: 0 }]);
    }
    if (u.pathname.endsWith('/rpc/mako_tokens_ajustar')) {
      const d = Number(cuerpo.p_delta_cupo ?? 0) + Number(cuerpo.p_delta_comprado ?? 0);
      saldo += d;
      pedidos.push({
        fn: 'ajustar', ws: Number(cuerpo.p_ws), deltaCupo: Number(cuerpo.p_delta_cupo ?? 0),
        deltaComprado: Number(cuerpo.p_delta_comprado ?? 0), motivo: String(cuerpo.p_motivo ?? ''), feature: (cuerpo.p_feature as string) ?? null,
      });
      return json(200, [{ saldo, comprado: 0, aplicado: d }]);
    }
    if (u.pathname.endsWith('/rpc/mako_tokens_acreditar_cupo')) {
      pedidos.push({ fn: 'acreditar', ws: Number(cuerpo.p_ws) });
      return json(200, [{ acreditado: 0, saldo, comprado: 0 }]);
    }
    return pg.responder(u, init);
  }
  red.push(u.host);
  return json(500, { error: { message: 'red de mentira' } });
}) as typeof fetch;

async function main() {
  const { cifrarSecreto } = await import('../lib/credenciales');
  const { runWithWorkspace } = await import('../lib/workspace');
  const ai = await import('../lib/ai-cheap');
  const { chatClaude } = await import('../lib/anthropic');
  const { olvidarD6b } = await import('../lib/solo-su-ia');
  const { olvidarCupos } = await import('../lib/mako-tokens-medidor');
  const { mtReservaDeFeature } = await import('../lib/mako-tokens-costos');

  pg.db.workspaces.push(
    { id: PLATAFORMA, capa: 'superadmin', nombre: 'MaKo' },
    // ⚠️ `capa: 'agencia'` = MaKo Pro (US$97), que es el que trae `CUPO_MENSUAL.growth`. Con `capa: 'cliente'`,
    // `cupoDeCapa` devuelve null y el negocio no recibe cupo: el test no vería nada de lo que quiere ver.
    { id: 3, capa: 'agencia', nombre: 'ws3' },
    { id: 14, capa: 'agencia', nombre: 'ws14' },
  );
  const poner = (ws: number, clave: string) => pg.db.credenciales.push({ workspace_id: ws, clave, valor_enc: cifrarSecreto(`${ws}-${clave}-${'k'.repeat(40)}`, ws, clave), servicio: clave.split('_')[0].toLowerCase() });
  poner(3, 'OPENAI_API_KEY'); poner(3, 'GEMINI_API_KEY');   // su IA → su clave paga → no descuenta
  // ⚠️ EL ws14 NO TIENE NINGUNA CLAVE, y es a propósito: ése es el negocio que MaKo Tokens existe para atender. Dos
  // escenarios que NO sirven y que costaron un rojo cada uno:
  //   · con una clave de Claude, OpenAI o Gemini pasa a ser «su IA» (`CLAVES_SU_IA`) y queda exento: el test no vería nada;
  //   · con una clave de GROQ no es «su IA», pero Groq **no contesta texto** (`PROVS_SOLO_AUDIO`, IA16: «Groq sólo para
  //     las notas de voz»), así que la cascada de texto se queda sin candidatos y la llamada no sale a ningún proveedor —
  //     que es justo lo que el test afirma cuando NO hay saldo. El verde y el rojo se confundían.
  // Sin claves, lo que paga es la RED DE LA PLATAFORMA (`redDePlataforma`), que es el caso en que la IA la paga MaKo.
  poner(PLATAFORMA, 'GEMINI_API_KEY'); poner(PLATAFORMA, 'GROQ_API_KEY');

  const out: Record<string, unknown> = {};

  /** Corre una cosa con un saldo dado y devuelve qué pasó: si salió a la red, qué le pidió a la caja, y si tiró. */
  const correr = async (ws: number, conSaldo: number, f: () => Promise<unknown>) => {
    olvidarD6b(); olvidarCupos();
    saldo = conSaldo;
    pedidos = []; red = [];
    let tiro: string | null = null;
    await runWithWorkspace(ws, async () => {
      try { await f(); } catch (e) { tiro = e instanceof Error ? `${e.name}: ${e.message.slice(0, 120)}` : String(e); }
    });
    return { red: [...new Set(red)], pedidos: [...pedidos], saldoFinal: saldo, ...(tiro ? { tiro } : {}) };
  };

  // `redDePlataforma: true` = «cuando las keys del negocio ya fallaron, reintentá con las de MaKo» (lib/ai-cheap.ts). Es
  // el camino en que la IA la paga MaKo, o sea el único donde MaKo Tokens tiene algo que descontar.
  const texto = (feature: string) => () => ai.chatCheapCascade({ system: 's', user: 'x', feature, redDePlataforma: true });
  const claude = (feature: string) => () => chatClaude('s', [{ role: 'user', content: 'x' }], { feature });
  const audio = (feature: string) => () => ai.transcribirAudio(Buffer.from('audio').toString('base64'), 'audio/webm', { feature } as never);

  // Lo que cuesta cada feature, para que el test pueda afirmar sin cablear números.
  out.reservas = {
    closing: mtReservaDeFeature('closing'),
    experimentos: mtReservaDeFeature('experimentos'),
    guardian: mtReservaDeFeature('mako-guardian'),
    sinMapear: mtReservaDeFeature('una-feature-que-no-existe-todavia'),
    spy: mtReservaDeFeature('spy'),
    notaDeVoz: mtReservaDeFeature('stt-nota-voz'),
  };

  // ── 1. LA PROPIEDAD: sin saldo, la llamada NO SALE ───────────────────────
  out.sinSaldo = await correr(14, 0, texto('closing'));
  out.sinSaldoClaude = await correr(14, 0, claude('closing'));
  out.sinSaldoAudio = await correr(14, 0, audio('stt-nota-voz'));
  // Una feature que la tabla no mapea TAMBIÉN cobra: lo que no cobra no se mide.
  out.sinSaldoSinMapear = await correr(14, 0, texto('una-feature-que-no-existe-todavia'));
  // Con casi lo justo, tampoco: pide 8 y tiene 3.
  out.saldoInsuficiente = await correr(14, 3, texto('closing'));

  // ── 2. Con saldo: sale a la red, se reserva y se liquida ─────────────────
  out.conSaldo = await correr(14, 50_000, texto('closing'));
  out.conSaldoCaro = await correr(14, 50_000, texto('experimentos'));

  // ── 3. Con SU IA conectada no descuenta nada (la opción que Martín dejó abierta) ──
  out.conSuIA = await correr(3, 0, texto('closing'));
  // ── 4. La plataforma tampoco ─────────────────────────────────────────────
  out.plataforma = await correr(PLATAFORMA, 0, texto('closing'));

  // ── 5. Lo AUTOMÁTICO se saltea en silencio, no le grita a nadie ──────────
  out.automaticaSinSaldo = await correr(14, 0, texto('plan-fathom'));
  out.disparadaSinSaldo = await correr(14, 0, texto('spy'));

  // ── 6. Lo que cuesta 0 corre sin saldo (hoy rutea a un free tier) ────────
  out.gratisSinSaldo = await correr(14, 0, texto('mako-guardian'));

  // ── 7. UNA reserva por operación, aunque ADENTRO se llame a otra función pública de la capa de IA ──
  // `chatClaude` cae a `chatCheapCascade` cuando su catálogo lo manda (lib/anthropic.ts): son DOS funciones públicas, las
  // dos con el enganche del medidor. Tiene que haber UNA reserva, no dos. Es la prueba de que las llamadas de adentro se
  // suman a la cuenta de afuera y no abren la suya.
  out.anidada = await correr(14, 50_000, claude('closing'));

  // ── 7b. EL REGALO DEL ONBOARDING no se cobra dos veces ───────────────────
  // ⚠️ Un negocio que todavía no paga un plan no tiene cupo, y MaKo igual le paga tres cosas de su primer ingreso (el
  // crédito de Claude: `CREDITO_HABILITADO_PARA`). Sin esta excepción, el alta de cada cliente nuevo se rompía con un
  // «te quedaste sin MaKo Tokens» antes de haber usado nada. El ws20 no tiene capa que venda cupo.
  pg.db.workspaces.push({ id: 20, capa: 'cliente', nombre: 'ws20 recién registrado' });
  out.onboardingSinCupo = await correr(20, 0, texto('El Archivero'));
  out.onboardingOtraFeature = await correr(20, 0, texto('closing'));
  // Y el que YA paga un plan sí paga esas tres: la excepción se cierra sola (el ws14 tiene capa `agencia`).
  out.archiveroConPlan = await correr(14, 50_000, texto('El Archivero'));

  // ── 8. SIN WORKSPACE no se cuelga ────────────────────────────────────────
  // ⚠️ EL BUG QUE ESTE REPO YA PAGÓ UNA VEZ, y volvió el 15/11/2026: el enganche es una RE-ENTRADA (la función se llama a
  // sí misma), así que si el medidor devuelve `fn()` sin abrir su AsyncLocalStorage, la re-entrada vuelve a ver «no hay
  // medidor» y se llama para siempre. Pasó igual con la puerta de D6b (revisión de IA6, 22/10/2026) y se ve como un test
  // que NO TERMINA: 240 s de timeout y ni un error. Con tope, para que el rojo diga qué pasó.
  const conTope = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<'colgado'>((r) => setTimeout(() => r('colgado'), ms))]);
  const sinWs: Record<string, unknown> = {};
  for (const [nombre, f] of [
    ['texto', texto('closing')],
    ['claude', claude('closing')],
    ['audio', audio('stt-nota-voz')],
  ] as const) {
    olvidarD6b(); olvidarCupos();
    saldo = 0; pedidos = []; red = [];
    sinWs[nombre] = await conTope(
      runWithWorkspace(null, async () => { try { await f(); } catch { /* que tire está bien; colgarse no */ } return 'volvió'; }),
      20_000,
    );
  }
  out.sinWorkspace = sinWs;

  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@RESULTADO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}`); process.exit(0); });
