// =============================================================================
// Hijo de tests/perfil-lectura-caida.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// lib/perfil.ts lleva `server-only`: este archivo corre en un node aparte con
// `--conditions=react-server` y le contesta al test con un JSON (molde:
// tests/_plan-repriorizar-hijo.ts). Corre las RUTAS REALES de /perfil/notificaciones contra un
// PostgREST de mentira (tests/_postgrest-de-mentira.ts). Lo único de mentira son la sesión
// (`@/lib/auth`) y la base.
//
// Lo que se persigue: `filaPropia` (lib/perfil.ts) fundía «esta persona NO TIENE fila» con «no
// pude LEER su fila» en un mismo `null`, y río arriba las dos salían como `guardado: false`, que
// la pantalla dibuja como «Esta sesión no tiene cuenta propia». Son tres estados y la pantalla
// tiene que poder decir tres cosas.
//
// ⚠️ LA LECTURA SE CAE CON `faltan`, que contesta el error de PostgREST de una tabla que no está.
// No es que a `usuarios` le pueda faltar la migración: es la forma más barata de que la lectura
// conteste un `error` de verdad, que es lo que acá se mide. Qué error sea da igual — lo que se
// fija es que un `error` NO se confunda con «no hay fila».
//
// ⚠️ Y NO SE PRUEBA «DOS FILAS CON EL MISMO EMAIL»: no existe ese estado. `usuarios.email` es
// `unique` desde la mig 0053 y ninguna migración lo saca (medido contra producción el 6/11/2026:
// `usuarios_email_key` = `UNIQUE (email)`). Sembrar dos filas acá probaría algo que la base no
// permite, y dejaría escrita como cubierta una hipótesis falsa. Ver docs/hallazgos-ajustes.md.
// =============================================================================

import { crearPostgrest, type Fila } from './_postgrest-de-mentira';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Modulo = require('node:module') as { _load: (pedido: string, padre: unknown, esMain: boolean) => unknown };
const cargarOriginal = Modulo._load;

type SesionDeMentira = { sub: string; email: string; nombre: string; rol: string; exp: number; ws: number | null; rolWs: string | null; legacy?: boolean };

/**
 * La sesión de quien está frente al teclado.
 *
 * El email va en MAYÚSCULAS y con un espacio al final A PROPÓSITO: `filaPropia` compara con
 * `.trim().toLowerCase()`, y la fila sembrada está en minúsculas. Si eso se rompiera, el caso 1
 * dejaría de encontrar la fila y daría «sin fila» — o sea el mismo síntoma por otra causa.
 */
let sesion: SesionDeMentira | null = {
  sub: '7', email: 'Martin@MaKo.test ', nombre: 'Martín', rol: 'usuario', exp: 0, ws: 9, rolWs: 'admin',
};

Modulo._load = function (this: unknown, pedido: string, padre: unknown, esMain: boolean) {
  // lib/perfil.ts pide './auth'; las rutas y el resto, '@/lib/auth'.
  if (pedido === './auth' || pedido === '@/lib/auth') {
    return { getUsuarioActual: async () => sesion, getSesionAdmin: async () => (sesion?.rol === 'admin' ? sesion : null) };
  }
  return cargarOriginal.call(this, pedido, padre, esMain);
};

const pg = crearPostgrest({
  tablas: ['usuarios'] as const,
  defaults: (_tabla, f: Fila) => ({ id: 7, perfil: {}, rol: 'usuario', rol_ws: null, workspace_id: 9, estado: 'activo', ...f }),
});

/** Lo que salió a la red y no fue a la base: tiene que ser nada. */
const afuera: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  afuera.push(u.host + u.pathname);
  return new Response(JSON.stringify({ error: 'red de mentira' }), { status: 500 });
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

const EMAIL = 'martin@mako.test';

type Respuesta = { status: number; j: Record<string, unknown> };

async function main() {
  const inapp = await import('../app/api/perfil/notif-inapp/route');
  const push = await import('../app/api/perfil/notif-push/route');

  const post = async (ruta: { POST: (r: never) => Promise<Response> }, url: string, body: unknown): Promise<Respuesta> => {
    const res = await ruta.POST(new Request(url, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }) as never);
    return { status: res.status, j: (await res.json()) as Record<string, unknown> };
  };
  /**
   * ⚠️ ATAJA EL `throw`, a propósito. Las dos rutas de lectura NO tienen try/catch (su
   * `getNotif*` ya se traga lo suyo), así que si alguien le saca ese catch, un GET explota y se
   * lleva al hijo entero — y el test padre reporta «el archivo falló», sin decir qué. Con esto,
   * la rotura cae en el assert que la nombra (medido rompiéndolo: 1 fallo con nombre, y 0 pases
   * con el archivo muerto cuando esto no estaba).
   */
  const get = async (ruta: { GET: () => Promise<Response> }): Promise<Respuesta> => {
    try {
      const res = await ruta.GET();
      return { status: res.status, j: (await res.json()) as Record<string, unknown> };
    } catch (e) {
      return { status: 0, j: { ok: false, error: `tiró: ${(e as Error)?.message ?? String(e)}` } };
    }
  };

  /** La fila de la persona, sembrada. Sin ella, la sesión no tiene cuenta propia. */
  const sembrar = () => { pg.db.usuarios.push({ id: 7, email: EMAIL, perfil: {}, rol: 'usuario', rol_ws: null, workspace_id: 9, estado: 'activo' }); };
  const reset = () => { pg.vaciar(); afuera.length = 0; };

  const out: Record<string, unknown> = {};
  const unApp = { popup: false, sonido: false, items: {} };
  const unPush = { activo: false, items: { 'lead-nuevo': false } };

  // ── 1) CON FILA: se guarda de verdad, y queda escrito en el jsonb ────────────────────────────
  {
    reset(); sembrar();
    const r = await post(inapp, 'http://app.test/api/perfil/notif-inapp', { inApp: unApp });
    const g = await get(inapp);
    out.conFila = {
      status: r.status, ok: r.j.ok, guardado: r.j.guardado,
      // Lo que quedó en la base, no lo que contestó la ruta: un `guardado:true` sobre nada es el bug de al lado.
      enLaBase: (pg.db.usuarios[0]?.perfil as Record<string, unknown> | undefined)?.notifInApp ?? null,
      releido: g.j.inApp,
    };
  }

  // ── 2) SIN FILA: `guardado:false`, que es lo que ese valor significa de verdad ───────────────
  {
    reset(); // nadie con ese email
    const r = await post(inapp, 'http://app.test/api/perfil/notif-inapp', { inApp: unApp });
    const rp = await post(push, 'http://app.test/api/perfil/notif-push', { push: unPush });
    const g = await get(inapp);
    out.sinFila = {
      status: r.status, ok: r.j.ok, guardado: r.j.guardado,
      statusPush: rp.status, okPush: rp.j.ok, guardadoPush: rp.j.guardado,
      // Y la lectura sigue contestando los defaults: no hay nada que leer y no es un error.
      leeStatus: g.status, leeOk: g.j.ok, leePopup: (g.j.inApp as Record<string, unknown> | undefined)?.popup ?? null,
    };
  }

  // ── 3) NO PUDE LEER: NO es `guardado:false`. Corta, con un motivo que la pantalla puede decir ─
  {
    reset(); sembrar();
    pg.faltan.add('usuarios');
    const r = await post(inapp, 'http://app.test/api/perfil/notif-inapp', { inApp: unApp });
    const rp = await post(push, 'http://app.test/api/perfil/notif-push', { push: unPush });
    // Y los que LEEN siguen cayendo al default: el fail-open a propósito (un error nuestro leyendo
    // una preferencia no puede dejar la pantalla sin pantalla). Si esto se volviera 500, se rompe
    // el NotificationsProvider, que está montado en TODAS las pantallas.
    const g = await get(inapp);
    const gp = await get(push);
    pg.faltan.delete('usuarios');
    out.sinLeer = {
      status: r.status, ok: r.j.ok, guardado: r.j.guardado, error: r.j.error,
      statusPush: rp.status, okPush: rp.j.ok, guardadoPush: rp.j.guardado, errorPush: rp.j.error,
      leeStatus: g.status, leeOk: g.j.ok, leePopup: (g.j.inApp as Record<string, unknown> | undefined)?.popup ?? null,
      leeStatusPush: gp.status, leeOkPush: gp.j.ok,
      // Nada se escribió: la fila sigue con su jsonb vacío.
      enLaBase: (pg.db.usuarios[0]?.perfil as Record<string, unknown> | undefined)?.notifInApp ?? null,
    };
  }

  // ── 4) SESIÓN SIN EMAIL (dev-login, contraseña maestra): sigue siendo `guardado:false` ───────
  {
    reset(); sembrar();
    const previa = sesion;
    sesion = { sub: 'dev', email: '', nombre: 'Dev', rol: 'admin', exp: 0, legacy: true, ws: 9, rolWs: 'admin' };
    const r = await post(inapp, 'http://app.test/api/perfil/notif-inapp', { inApp: unApp });
    sesion = previa;
    out.sinEmail = { status: r.status, ok: r.j.ok, guardado: r.j.guardado };
  }

  out.afuera = afuera;
  out.sinMock = [...pg.sinMock];
  process.stdout.write('@@RESULTADO@@' + JSON.stringify(out));
}

main().then(() => process.exit(0), (e) => { process.stderr.write(String((e as Error)?.stack ?? e)); process.exit(1); });
