// =============================================================================
// Hijo de tests/chat-trabajos.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Un trabajo largo del chat, por el camino REAL: confirmar `replicar_landing` en su tarjeta (`confirmarDesdeTarjeta`) y
// una propuesta lenta de pantalla (`enSegundoPlano` + `aplicarPropuestaGenerica`, lo que hace /mako/revisar). Contra un
// PostgREST de mentira, en un node aparte con `--conditions=react-server`. `after()` (next/server) GUARDA la función en vez
// de correrla: así se mira qué ve la pantalla ANTES de que termine, y después. Los runners lentos se reemplazan por uno
// que no sale a la red (lo que se prueba es el mecanismo, no replicar ni generar). Nada sale a la red.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Modulo = require('node:module') as { _load: (pedido: string, padre: unknown, esMain: boolean) => unknown };
const cargarOriginal = Modulo._load;
const despues: Array<() => unknown> = [];
Modulo._load = function (this: unknown, pedido: string, padre: unknown, esMain: boolean) {
  if (pedido === 'next/server') {
    const real = cargarOriginal.call(this, pedido, padre, esMain) as Record<string, unknown>;
    return { ...real, after: (fn: () => unknown) => { despues.push(fn); } };
  }
  return cargarOriginal.call(this, pedido, padre, esMain);
};

const TABLAS = ['workspaces', 'chart_sessions', 'chart_chats', 'mako_acciones_pendientes', 'propuestas', 'app_settings', 'usuarios'] as const;
const ahoraIso = () => new Date().toISOString();
let siguienteId = 1200;
const pg = crearPostgrest({
  tablas: TABLAS,
  defaults: (tabla, f) => {
    if (tabla === 'chart_chats') return { id: siguienteId++, created_at: ahoraIso(), bloques: null, ...f };
    if (tabla === 'propuestas') return { id: `prop-${siguienteId++}`, estado: 'pendiente', resultado: null, created_at: ahoraIso(), updated_at: ahoraIso(), ...f };
    return { ...f };
  },
});
const red: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  red.push(u.host + u.pathname);
  return new Response(JSON.stringify({ error: 'red de mentira' }), { status: 500 });
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

const WS = 3; // el de prueba (nunca el 1)
const CHART_KEY = 'mako:persona-de-prueba';

async function main() {
  const { confirmarDesdeTarjeta } = await import('../lib/mako-turno-app');
  const { canalKeyDeSesion } = await import('../lib/mako-turno-app-reglas');
  const { enSegundoPlano, estadoDeTrabajo } = await import('../lib/chat-trabajos');
  const { proponerPantallaGenerica, aplicarPropuestaGenerica } = await import('../lib/api-mako/acciones');
  const { runnerDe } = await import('../lib/api-mako/runners');
  const { porId } = await import('../lib/api-mako/registro');
  const { linkApp } = await import('../lib/app-url');
  const { runWithWorkspace } = await import('../lib/workspace');
  type R = { preparar?: unknown; ejecutar?: unknown; faltaParaConfirmar?: unknown };
  const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
  // Los runners lentos, sin red: devuelven lo que devolverían, después de un rato.
  Object.assign(runnerDe('replicar_landing') as R, {
    faltaParaConfirmar: undefined,
    // Más que el «menos de 5 s» de la 1.11: si corriera adentro de la confirmación, la respuesta tardaría esto.
    ejecutar: async () => { await espera(5_500); return { ok: true, resumen: 'Replicada la página.', datos: { link: linkApp('/web-generator/l-9', WS) } }; },
  });
  Object.assign(runnerDe('generar_landing_con_ia') as R, {
    faltaParaConfirmar: undefined,
    preparar: async (input: Record<string, unknown>) => ({ payload: input, resumen: 'Crear la landing del webinar' }),
    ejecutar: async () => {
      await espera(30);
      return { ok: true, resumen: 'Creada la landing del webinar.', datos: { bloque: { t: 'creado', titulo: 'Webinar', estado: 'Nueva', miniatura: '/cv/landing.webp', abrir: { titulo: 'Abrir en Web Generator', href: '/web-generator/l-10' } } } };
    },
  });

  const db = pg.db;
  db.workspaces.push({ id: WS, nombre: 'Prueba', slug: 'prueba', estado: 'activo', capa: 'completo', created_at: ahoraIso() });
  db.chart_sessions.push({ id: 77, workspace_id: WS, chart_key: CHART_KEY, titulo: 'Chat', contexto: null, pinned: false, archived: false, created_at: ahoraIso(), updated_at: ahoraIso() });
  db.mako_acciones_pendientes.push({
    id: 21, workspace_id: WS, grupo_jid: canalKeyDeSesion(77), tipo: 'replicar_landing', payload: { url: 'https://ejemplo.com', formato: 'landing' },
    resumen: 'Replicar ejemplo.com', estado: 'pendiente', vence_at: new Date(Date.now() + 3_600_000).toISOString(), created_at: new Date(Date.now() - 60_000).toISOString(), origen: null,
  });
  const persona = { ws: WS, rol: 'admin' as const, actor: 'Prueba', chartKey: CHART_KEY };
  const enWs = <T,>(fn: () => Promise<T>) => runWithWorkspace(WS, fn);

  // 1. La tarjeta de un trabajo largo: la respuesta vuelve antes de que el trabajo corra.
  const t0 = Date.now();
  const tarjeta = await confirmarDesdeTarjeta(persona, 77, 21);
  const ms = Date.now() - t0;
  const g6 = tarjeta.ok ? tarjeta.bloques?.[0] : undefined;
  const consulta = g6 && g6.t === 'trabajo' ? g6.consulta ?? '' : '';
  const antes = await enWs(() => estadoDeTrabajo(consulta));
  const conOtraLlave = await enWs(() => estadoDeTrabajo(`${consulta.split('.')[0]}.llaveequivocada1`));
  const enOtroNegocio = await runWithWorkspace(9, () => estadoDeTrabajo(consulta));
  const pendienteAntes = db.mako_acciones_pendientes.find((p) => p.id === 21)?.estado;
  for (const f of despues.splice(0)) await f();
  const despuesDeCorrer = await enWs(() => estadoDeTrabajo(consulta));
  const pendienteDespues = db.mako_acciones_pendientes.find((p) => p.id === 21)?.estado;

  // 2. Una propuesta lenta de pantalla, confirmada adentro del chat (lo que hace /mako/revisar con un trabajo largo).
  const def = porId('generar_landing_con_ia');
  if (!def || def.tipo !== 'accion') throw new Error('falta generar_landing_con_ia');
  const p = await proponerPantallaGenerica(def, { titulo: 'Webinar' }, 'Crear la landing del webinar', { ws: WS, canal: 'app', canalKey: 'app:77', alcance: 'proponer', rol: 'admin', actor: 'Prueba' });
  const bandeja = { ws: WS, canal: 'app' as const, canalKey: 'bandeja', alcance: 'ejecutar' as const, rol: 'admin' as const, actor: 'Prueba', bandeja: true as const };
  const g6b = await enWs(() => enSegundoPlano(WS, 77, def.titulo, () => aplicarPropuestaGenerica(p.propuesta.id, null, bandeja, { sinAnotar: true })));
  for (const f of despues.splice(0)) await f();
  const consultaB = g6b && g6b.t === 'trabajo' ? g6b.consulta ?? '' : '';
  const pantalla = await enWs(() => estadoDeTrabajo(consultaB));

  const hilo = db.chart_chats.map((m) => ({ id: m.id, session_id: m.session_id, content: m.content }));

  // La tarjeta lenta de OTRO chat (los ids son correlativos): no se anota nada en éste.
  db.mako_acciones_pendientes.push({
    id: 22, workspace_id: WS, grupo_jid: canalKeyDeSesion(78), tipo: 'replicar_landing', payload: { url: 'https://otro.com', formato: 'landing' },
    resumen: 'Replicar otro.com', estado: 'pendiente', vence_at: new Date(Date.now() + 3_600_000).toISOString(), created_at: ahoraIso(), origen: null,
  });
  const mensajesAntes = db.chart_chats.length;
  const ajena = { r: await confirmarDesdeTarjeta(persona, 77, 22), mensajesAntes, mensajesDespues: db.chart_chats.length, despues: despues.length };

  // 3. Uno que MUERE: la plataforma corta la invocación y nadie reescribe el «En curso» (lo de `after()` no corre nunca).
  const creado = Date.now();
  const g6c = await enWs(() => enSegundoPlano(WS, 77, 'Replicar otra página', async () => ({ ok: true, resumen: 'nunca llega' })));
  despues.splice(0);
  const consultaC = g6c && g6c.t === 'trabajo' ? g6c.consulta ?? '' : '';
  const hasta = g6c && g6c.t === 'trabajo' ? g6c.hasta ?? 0 : 0;
  const murio = {
    creado, hasta,
    antesDelPlazo: await enWs(() => estadoDeTrabajo(consultaC, hasta - 1)),
    pasado: await enWs(() => estadoDeTrabajo(consultaC, hasta + 1)),
    // Con la hora de verdad (antes del plazo): lo cortado quedó ESCRITO, también para quien vuelve y para el modelo.
    alVolver: await enWs(() => estadoDeTrabajo(consultaC)),
  };

  process.stdout.write(JSON.stringify({
    tarjeta, ms, antes, conOtraLlave, enOtroNegocio, pendienteAntes, despuesDeCorrer, pendienteDespues, pantalla, murio, ajena,
    hilo, red,
  }));
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
