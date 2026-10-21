// =============================================================================
// Hijo de tests/d6b-rutas.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre DE VERDAD rutas del Ops Center que la revisión del Cerebro (21/10/2026) encontró yendo a la Gemini gratis: el
// POST de «Buscar con MaKo» (app/api/second-brain/buscar) y el POST de El Archivero de su pantalla con una foto y con un
// texto (app/api/onboarding/archivero). lib/ai-cheap.ts lleva `server-only`: corre en un node aparte con
// `--conditions=react-server`, contra un PostgREST de mentira (tests/_postgrest-de-mentira.ts). Toda la red que no es la
// base se ANOTA por host y contesta 400 (un 400 no se reintenta: la corrida no espera los reintentos de un 5xx).
//
// La SESIÓN es de verdad: una cookie firmada con `crearToken` (lib/auth-session.ts) de la admin del negocio, que
// `next/headers` devuelve (lo único que se cambia en `Module._load`, además del mapa que se busca: `construirCerebro` lee
// 30 tablas). Las puertas de las rutas (`soloAdminDeTab`, `resolverWsAdmin`), el onboarding en curso, la IA, la decisión
// de D6b y el contexto son los reales. El workspace va con `runWithWorkspace`, como lo resuelve la cookie.
//
// El negocio (ws3) tiene una Gemini vieja del onboarding. Tres estados:
//   · sinSuIA  (el control): sin su PC ni su clave → la cascada sale a Gemini. Si no, la prueba no vería nada.
//   · conSuPc  : su PC conectada (su Claude, D6b) → ni un pedido a un proveedor gratis, y la pantalla dice lo cierto.
//   · enOnboarding: su PC y el onboarding en curso → el crédito de Claude de la plataforma SIGUE (api.anthropic.com):
//     El Archivero del onboarding no se rompe por correr adentro del contexto.
//
// ⚠️ Lo que se cambia en `Module._load` sólo pega en un import ESTÁTICO (`require` con el pedido crudo, '@/lib/…'). Un
// `await import()` lo resuelve tsx por su lado y se queda con el módulo real aunque el hook devuelva otro (medido el
// 21/10/2026 con `onboardingPendiente`: el hook corría y el stub no). Por eso el onboarding se prende con la sesión y
// el estado guardado, no cambiando la función.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
process.env.AUTH_SECRET = 'secreto-de-sesion-de-prueba-de-32-caracteres-o-mas';

const WS = 3;
const PLATAFORMA = 9;
const ONBOARDING_HECHO = { workspace_id: WS, key: 'onboarding.state', value: JSON.stringify({ status: 'done' }) };

const pg = crearPostgrest({ tablas: ['credenciales', 'workspaces', 'app_settings', 'anthropic_usage', 'ia_cuotas', 'ia_rebotes', 'ia_pc_dispositivos'] });
let red: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  red.push(u.host);
  return new Response(JSON.stringify({ error: { message: 'red de mentira' } }), { status: 400, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

/** El mapa que se busca: chico, con un dato de verdad (sin él la búsqueda no llega a la IA). */
const CEREBRO = {
  nodos: [
    { id: 'raiz', area: 'negocio', etiqueta: 'Tu negocio' },
    { id: 'dato:precio', area: 'oferta', etiqueta: 'Precio', detalle: 'US$ 500 el programa', datos: [{ k: 'precio', v: '500' }] },
  ],
};
/** La cookie de sesión de la admin del negocio (se firma en `main`, con AUTH_SECRET). */
let cookieSesion = '';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Modulo = require('node:module') as { _load: (pedido: string, padre: unknown, esMain: boolean) => unknown };
const cargarOriginal = Modulo._load;
Modulo._load = function (this: unknown, pedido: string, padre: unknown, esMain: boolean) {
  // El navegador: la cookie de la sesión (lib/auth.ts la lee con `cookies()`).
  if (pedido === 'next/headers') {
    return {
      cookies: async () => ({ get: (n: string) => (n === 'mako_session' ? { name: n, value: cookieSesion } : undefined), getAll: () => [] }),
      headers: async () => new Headers({ host: 'app.test' }),
    };
  }
  if (pedido === '@/lib/cerebro-grafo') return { construirCerebro: async () => CEREBRO };
  return cargarOriginal.call(this, pedido, padre, esMain);
};

type Corrida = { red: string[]; status: number; cuerpo: Record<string, unknown> };

async function main() {
  const { cifrarSecreto } = await import('../lib/credenciales');
  const { crearToken } = await import('../lib/auth-session');
  const { runWithWorkspace } = await import('../lib/workspace');
  const buscar = await import('../app/api/second-brain/buscar/route');
  const archivero = await import('../app/api/onboarding/archivero/route');
  cookieSesion = crearToken({ sub: 'password', email: 'admin@negocio.com', rol: 'usuario', rolWs: 'admin', ws: WS } as never) ?? '';
  if (!cookieSesion) throw new Error('no pude firmar la sesión de prueba');
  pg.db.workspaces.push({ id: PLATAFORMA, capa: 'superadmin', nombre: 'MaKo' }, { id: WS, capa: 'cliente', nombre: 'Prueba' });
  // El onboarding del negocio, terminado: el crédito de Claude de la plataforma no corre (lib/veto-claude.ts).
  pg.db.app_settings.push({ ...ONBOARDING_HECHO });
  // La Gemini vieja del negocio, y la red de la plataforma (ws9): lo que D6b no tiene que tocar.
  pg.db.credenciales.push({ workspace_id: WS, clave: 'GEMINI_API_KEY', valor_enc: cifrarSecreto(`negocio-gemini-${'x'.repeat(30)}`, WS, 'GEMINI_API_KEY'), servicio: 'gemini' });
  for (const k of ['GEMINI_API_KEY', 'GROQ_API_KEY']) {
    pg.db.credenciales.push({ workspace_id: PLATAFORMA, clave: k, valor_enc: cifrarSecreto(`plataforma-${k}-${'y'.repeat(30)}`, PLATAFORMA, k), servicio: k.split('_')[0].toLowerCase() });
  }

  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const casos: Record<string, () => Promise<Response>> = {
    buscar: () => buscar.POST(new Request('http://app.test/api/second-brain/buscar', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ q: 'cuánto cobro' }),
    }) as never),
    archiveroFoto: () => {
      const fd = new FormData();
      fd.append('file', new File([png], 'pizarron.png', { type: 'image/png' }));
      return archivero.POST(new Request('http://app.test/api/onboarding/archivero', { method: 'POST', body: fd }) as never);
    },
    archiveroTexto: () => {
      const fd = new FormData();
      fd.append('file', new File(['Vendemos un programa de inglés para adultos a US$ 500, con clases en vivo y garantía de 30 días.'], 'oferta.txt', { type: 'text/plain' }));
      return archivero.POST(new Request('http://app.test/api/onboarding/archivero', { method: 'POST', body: fd }) as never);
    },
  };
  const correr = async (nombres: string[]) => {
    const out: Record<string, Corrida> = {};
    for (const nombre of nombres) {
      red = [];
      let status = 0;
      let cuerpo: Record<string, unknown> = {};
      try {
        // El workspace de la cookie: en la ruta de verdad lo resuelve `getWorkspaceActual` desde la sesión.
        const r = await runWithWorkspace(WS, () => casos[nombre]());
        status = r.status;
        cuerpo = await r.json().catch(() => ({}));
      } catch (e) { cuerpo = { tiro: e instanceof Error ? e.stack : String(e) }; }
      out[nombre] = { red: [...new Set(red)], status, cuerpo };
    }
    return out;
  };
  const todos = Object.keys(casos);

  // ── El control: sin su IA (una Gemini vieja no es «su IA») ──────────────────────────────────────────────────────
  const sinSuIA = await correr(todos);

  // ── Con su PC conectada: su Claude (D6b) ─────────────────────────────────────────────────────────────────────────
  const ahora = new Date().toISOString();
  pg.db.ia_pc_dispositivos.push({ id: 1, workspace_id: WS, persona: 'admin@negocio.com', revocado_at: null, confirmado_at: ahora, activa_at: ahora, creado_at: ahora });
  const conSuPc = await correr(todos);

  // ── Con su PC y el onboarding en curso: el crédito de Claude de la plataforma sigue (lib/veto-claude.ts) ──────────
  pg.db.app_settings = pg.db.app_settings.filter((f) => f.key !== ONBOARDING_HECHO.key);
  process.env.ANTHROPIC_CREDITO_CUENTA1 = `sk-ant-credito-${'z'.repeat(30)}`;
  const enOnboardingConSuPc = await correr(['archiveroTexto']);

  // ── Y el texto que arma un área (lib/ai-cheap.ts, `errorDeCascada`) adentro y afuera del contexto ─────────────────
  const { conSoloSuIA } = await import('../lib/solo-su-ia');
  const ai = await import('../lib/ai-cheap');
  const errorAdentro = await runWithWorkspace(WS, () => conSoloSuIA(true, () => ai.errorDeCascada([], 'armar los productos')));
  const errorAdentroConSuyo = await runWithWorkspace(WS, () => conSoloSuIA(true, () => ai.errorDeCascada(['openai/OPENAI_API_KEY: HTTP 500 boom'], 'armar los productos')));

  process.stdout.write(`@@RESULTADO@@${JSON.stringify({ sinSuIA, conSuPc, enOnboardingConSuPc, errorAdentro, errorAdentroConSuyo })}`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@RESULTADO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}`); process.exit(0); });
