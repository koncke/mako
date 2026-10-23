// =============================================================================
// Hijo de tests/cuentas-agenda.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Varias cuentas de Calendly y Cal.com en UN negocio (fase B, 23/10/2026). lib/cuentas-agenda-server.ts y
// lib/calendly-cancelar.ts llevan `server-only`: corren en un node aparte con `--conditions=react-server`. Sin red ni base:
// `fetch` contesta la API de Calendly y el PostgREST de Supabase (tests/_postgrest-de-mentira.ts).

import { crearPostgrest } from './_postgrest-de-mentira';

const pg = crearPostgrest({ tablas: ['credenciales', 'webhook_routing', 'credenciales_auditoria'] });
const db = pg.db;
/** Una lectura de `credenciales` por ESTA clave contesta 500: la base que no contesta. */
let fallarClave: string | null = null;
/** Con qué token se pidió cada cancelación. */
let cancelaciones: string[] = [];

/** Los tipos de evento de cada cuenta (por token), y con qué token se pidió cada escritura. */
const TIPOS: Record<string, Array<{ uri: string; name: string; duration: number; active: boolean; scheduling_url?: string }>> = {
  tok_principal: [{ uri: 'https://api.calendly.com/event_types/ETA-0001', name: 'R1 Ventas', duration: 30, active: true, scheduling_url: 'https://calendly.com/a/r1' }],
  tok_c2: [{ uri: 'https://api.calendly.com/event_types/ETB-0002', name: 'Demo del equipo', duration: 45, active: true }],
};
let escrituras: string[] = [];

const json = (status: number, body: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const ORGS: Record<string, string> = { tok_principal: 'org_A', tok_c2: 'org_B' };
const EN = (dias: number) => new Date(Date.now() + dias * 86_400_000).toISOString();
/** La reunión de la cuenta B es la más próxima (mañana); la de A, en tres días. */
const EVENTOS: Record<string, unknown[]> = {
  org_A: [{ uri: 'https://api.calendly.com/scheduled_events/EV_A', name: 'R1 de A', start_time: EN(3), status: 'active' }],
  org_B: [{ uri: 'https://api.calendly.com/scheduled_events/EV_B', name: 'R1 de B', start_time: EN(1), status: 'active' }],
};

globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') {
    if (fallarClave && u.pathname.endsWith('/credenciales') && u.searchParams.get('clave') === `eq.${fallarClave}`) {
      return json(500, { code: 'XX000', message: 'la base no contesta' });
    }
    return pg.responder(u, init);
  }
  if (u.host === 'api.calendly.com') {
    const token = (new Headers(init.headers).get('Authorization') ?? '').replace(/^Bearer /, '');
    const org = ORGS[token];
    if (!org) return json(401, { message: 'token inválido' });
    if (u.pathname === '/users/me') return json(200, { resource: { uri: `https://api.calendly.com/users/${token}`, current_organization: org } });
    if (u.pathname === '/event_types' && (init.method ?? 'GET') === 'GET') {
      return json(200, { collection: u.searchParams.get('user') === `https://api.calendly.com/users/${token}` ? TIPOS[token] ?? [] : [] });
    }
    if (u.pathname === '/event_types' && init.method === 'POST') {
      const b = JSON.parse(String(init.body ?? '{}')) as { name?: string; duration?: number };
      escrituras.push(`${token}:crear`);
      return json(201, { resource: { uri: `https://api.calendly.com/event_types/NUEVO_${token}`, name: b.name, duration: b.duration, active: true } });
    }
    if (u.pathname.startsWith('/event_types/') && init.method === 'PATCH') {
      const uuid = u.pathname.split('/')[2];
      const suyo = (TIPOS[token] ?? []).find((e) => e.uri.endsWith(uuid));
      escrituras.push(`${token}:editar:${uuid}:${suyo ? 'ok' : '404'}`);
      return suyo ? json(200, { resource: { ...suyo, name: 'Cambiado' } }) : json(404, { message: 'Resource Not Found' });
    }
    if (u.pathname === '/scheduled_events') return json(200, { collection: u.searchParams.get('organization') === org ? EVENTOS[org] : [] });
    if (u.pathname.endsWith('/cancellation')) {
      // Calendly sólo deja cancelar con el token de la cuenta que TIENE la reunión.
      const uuid = u.pathname.split('/')[2];
      const suya = (EVENTOS[org] as Array<{ uri: string }>).some((e) => e.uri.endsWith(uuid));
      cancelaciones.push(`${token}:${uuid}:${suya ? 'ok' : '404'}`);
      return suya ? json(201, {}) : json(404, { message: 'Resource Not Found' });
    }
  }
  throw new Error(`fetch sin mock: ${u.href}`);
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-para-cifrar-las-credenciales';

async function main() {
  const { guardarCredencial } = await import('../lib/credenciales');
  const { cuentasDeAgenda, tokensDeAgenda, firmasDeAgenda, guardarAliasAgenda, proximaCuentaDeAgenda } = await import('../lib/cuentas-agenda-server');
  const { proximaReunionCalendly, cancelarReunionCalendly } = await import('../lib/calendly-cancelar');
  const { runWithWorkspace } = await import('../lib/workspace');
  const WS = 13;
  const out: Record<string, unknown> = {};

  function reset() { pg.vaciar(); fallarClave = null; cancelaciones = []; }
  async function dosCuentas() {
    await guardarCredencial(WS, 'CALENDLY_API_TOKEN', 'tok_principal', 'calendly', 'test');
    await guardarCredencial(WS, 'CALENDLY_WEBHOOK_SIGNING_KEY', 'firma_A', 'calendly', 'test');
    await guardarCredencial(WS, 'CALENDLY_API_TOKEN__C2', 'tok_c2', 'calendly', 'test');
    await guardarAliasAgenda(WS, 'calendly', 'c2', 'Agenda del equipo', 'test');
  }

  // 1. Las cuentas, con su nombre y lo que les falta; los tokens de todas; la que sigue.
  reset();
  await dosCuentas();
  out.cuentas = (await cuentasDeAgenda(WS, 'calendly')).map((c) => `${c.cuenta}|${c.nombre}|${c.conToken ? 'token' : '-'}|${c.conFirma ? 'firma' : '-'}`);
  out.tokens = (await tokensDeAgenda('calendly', WS)).map((t) => `${t.cuenta}:${t.token}`);
  out.proxima = await proximaCuentaDeAgenda(WS, 'calendly');

  // 2. Los secretos de los avisos: los de cada cuenta, y ESTRICTOS (la base caída tira, no «no hay»).
  await guardarCredencial(WS, 'CALENDLY_WEBHOOK_SIGNING_KEY__C2', 'firma_B', 'calendly', 'test');
  out.firmas = (await firmasDeAgenda(WS, 'calendly')).map((f) => `${f.cuenta}:${f.firma}`);
  fallarClave = 'CALENDLY_WEBHOOK_SIGNING_KEY__C2';
  try { out.firmasCaida = `devolvió ${(await firmasDeAgenda(WS, 'calendly')).length}`; } catch (e) { out.firmasCaida = `tira: ${e instanceof Error ? e.message : String(e)}`; }
  fallarClave = null;

  // 3. La próxima reunión se busca en LAS DOS cuentas, y se cancela con el token de la que la tiene.
  const prox = await runWithWorkspace(WS, () => proximaReunionCalendly('lead@x.test'));
  out.proximaReunion = prox ? `${prox.cuenta}:${prox.nombre}` : null;
  // Una cancelación rechazada no corta el hijo: queda anotada (con su 404) y el test la compara.
  if (prox) await runWithWorkspace(WS, () => cancelarReunionCalendly(prox.uri, 'prueba', prox.cuenta)).catch(() => undefined);
  out.cancelaciones = [...cancelaciones];

  // 4. Una cuenta con el token roto: la búsqueda TIRA con su nombre (no se toma como «no tiene reunión»).
  reset();
  await dosCuentas();
  await guardarCredencial(WS, 'CALENDLY_API_TOKEN__C2', 'tok_roto', 'calendly', 'test');
  try {
    const r = await runWithWorkspace(WS, () => proximaReunionCalendly('lead@x.test'));
    out.rota = `devolvió ${r ? r.cuenta : 'null'}`;
  } catch (e) {
    out.rota = `tira: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 5. Sin ninguna cuenta: no hay a quién preguntar, y se dice.
  reset();
  try { await runWithWorkspace(WS, () => proximaReunionCalendly('lead@x.test')); out.sinCuentas = 'no tiró'; } catch (e) { out.sinCuentas = `tira: ${e instanceof Error ? e.message : String(e)}`; }

  // 6. «Asignar evento» con dos cuentas: los tipos de evento de LAS DOS, cada uno con su cuenta y su nombre, una fila
  //    por cuenta; crear en la que se elige y editar con la que lo tiene (sin pedirla, la busca).
  {
    const { listarEventosDeAgenda, crearEventoDeAgenda, editarEventoDeAgenda } = await import('../lib/agenda-evento-etapa-server');
    reset();
    escrituras = [];
    await dosCuentas();
    const a = await runWithWorkspace(WS, () => listarEventosDeAgenda({ fresco: true }));
    out.asignar = {
      eventos: a.eventos.filter((e) => e.proveedor === 'calendly').map((e) => `${e.nombre}|${e.cuenta}|${e.cuentaNombre}`),
      filas: a.proveedores.filter((p) => p.proveedor === 'calendly').map((p) => `${p.cuenta}|${p.cuentaNombre}|${p.conectado ? 'conectada' : '-'}`),
    };
    const creado = await runWithWorkspace(WS, () => crearEventoDeAgenda({ proveedor: 'calendly', cuenta: 'c2', nombre: 'Demo nueva', duracionMin: 30 }));
    const editado = await runWithWorkspace(WS, () => editarEventoDeAgenda({ proveedor: 'calendly', identificador: 'https://api.calendly.com/event_types/ETB-0002', nombre: 'Cambiado' }));
    const cuentaMala = await runWithWorkspace(WS, () => crearEventoDeAgenda({ proveedor: 'calendly', cuenta: 'c9', nombre: 'X', duracionMin: 30 }));
    const invalida = await runWithWorkspace(WS, () => crearEventoDeAgenda({ proveedor: 'calendly', cuenta: '../x', nombre: 'X', duracionMin: 30 }));
    out.escribir = {
      creado: creado.ok ? `ok:${creado.evento.cuenta}` : `no:${creado.error}`,
      editado: editado.ok ? `ok:${editado.evento.cuenta}` : `no:${editado.error}`,
      cuentaMala: cuentaMala.ok ? 'ok' : cuentaMala.error,
      invalida: invalida.ok ? 'ok' : invalida.error,
      escrituras: [...escrituras],
    };
  }

  process.stdout.write(`\n@@RESULTADO@@${JSON.stringify(out)}`);
}

void main();

// Módulo, no script: sin esto tsc los junta en un solo ámbito global con los otros hijos y choca cada `db`/`json`.
export {};
