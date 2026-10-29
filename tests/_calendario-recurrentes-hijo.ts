// =============================================================================
// Hijo de tests/calendario-recurrentes.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Las Publicaciones que se repiten (29/10/2026): `generarRecurrentes`, `seriesParaDibujar` y `guardarRepeticion` REALES (`server-only`,
// `--conditions=react-server`) sobre el PostgREST de mentira (con el índice único de la mig 0349). La copia del archivo y «Programar»
// se inyectan: acá importa QUÉ nace, con qué archivo y qué se manda a programar.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

const pg = crearPostgrest({
  tablas: ['workspaces', 'app_settings', 'calendario_eventos'],
  unicos: [{
    tabla: 'calendario_eventos', columnas: ['workspace_id', 'serie_de', 'inicio'], nombre: 'calendario_eventos_serie_vez_uidx',
    donde: (f) => f.serie_de != null,
  }],
});
const db = pg.db;
const red: string[] = [];
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  red.push(`${u.host}${u.pathname}`);
  return json(500, { error: 'red de mentira' });
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

const WS = 3;
// Jueves 29/10/2026, 12:00 en Buenos Aires (15:00 UTC).
const AHORA = new Date('2026-10-29T15:00:00Z');

async function main() {
  const { runWithWorkspace } = await import('../lib/workspace');
  const C = await import('../lib/calendario-recurrentes');

  const copias: Array<[string, string]> = [];
  const borradas: string[] = [];
  const programadas: string[][] = [];
  const deps = {
    copiar: async (de: string, a: string) => { copias.push([de, a]); return { error: null }; },
    borrar: async (ruta: string) => { borradas.push(ruta); },
    programar: async (ids: readonly string[]) => { programadas.push([...ids]); return { programadas: [...ids], fallidas: [] }; },
  };
  const molde = (o: Record<string, unknown> = {}) => ({
    id: 'evmolde1', workspace_id: WS, tipo: 'publicacion', formato: 'reel', titulo: 'Reel del jueves', notas: '', fin: null, estado: 'planeado',
    // El molde: jueves 22/10 a las 10:00 de Buenos Aires (13:00 UTC), todos los días.
    inicio: '2026-10-22T13:00:00.000Z', dia_completo: false, repetir: 'FREQ=DAILY',
    red: 'instagram', cuenta_red: 'acc_ig', archivo: `${WS}/calendario/evmolde1/abcdef1234567890.mp4`, archivo_tipo: 'video', texto: 'El pie',
    ...o,
  });
  const reset = () => {
    pg.vaciar();
    copias.length = 0; borradas.length = 0; programadas.length = 0;
    db.workspaces.push({ id: WS, nombre: 'Prueba', capa: 'cliente', timezone: 'America/Argentina/Buenos_Aires' });
  };
  const generar = () => runWithWorkspace(WS, () => C.generarRecurrentes(AHORA, deps));
  const out: Record<string, unknown> = {};

  // (a) Todos los días, desde el 22: hoy 29 a las 10:00 ya pasó → nada hacia atrás; nacen el 30 y el 31 (dos días adelante).
  reset();
  db.calendario_eventos.push(molde());
  const rA = await generar();
  const hijas = (db.calendario_eventos as Array<Record<string, unknown>>).filter((f) => f.serie_de === 'evmolde1');
  out.a = {
    r: rA,
    hijas: hijas.map((h) => ({
      inicio: h.inicio, titulo: h.titulo, formato: h.formato, red: h.red, cuenta_red: h.cuenta_red, texto: h.texto, archivo_tipo: h.archivo_tipo,
      archivoPropio: typeof h.archivo === 'string' && (h.archivo as string).startsWith(`${WS}/calendario/${h.id as string}/`), repetir: h.repetir ?? null,
    })),
    copias: copias.map(([de]) => de), programadas: programadas.map((x) => x.length),
  };

  // (b) Otra pasada: no nace nada de nuevo (ya nacieron).
  const rB = await generar();
  out.b = { r: rB, total: (db.calendario_eventos as unknown[]).length };

  // (c) Incompleto (sin cuenta): no nace nada, y se cuenta.
  reset();
  db.calendario_eventos.push(molde({ cuenta_red: null }));
  out.c = await generar();

  // (d) Las próximas que se DIBUJAN en la semana del 26/10 al 2/11 (sin crear filas): las que no nacieron, en la capa «Se repite».
  reset();
  db.calendario_eventos.push(molde(), { ...molde({ id: 'evhija30', repetir: null, serie_de: 'evmolde1', inicio: '2026-10-30T13:00:00.000Z' }) });
  const dib = await runWithWorkspace(WS, () => C.seriesParaDibujar('2026-10-26', '2026-11-02', '2026-10-26T03:00:00.000Z', 'America/Argentina/Buenos_Aires', AHORA));
  out.d = dib.map((i) => ({ id: i.id, fuente: i.fuente, capa: i.capa, inicio: i.inicio, href: i.href, detalle: i.detalle }));

  // (e) La regla: sólo en una Publicación, válida, y se puede sacar.
  reset();
  db.calendario_eventos.push(molde({ repetir: null }), { ...molde({ id: 'evbloque', tipo: 'bloque', repetir: null }) });
  out.e = {
    pone: await runWithWorkspace(WS, () => C.guardarRepeticion('evmolde1', 'FREQ=WEEKLY;BYDAY=MO')),
    guardada: (db.calendario_eventos as Array<Record<string, unknown>>).find((f) => f.id === 'evmolde1')?.repetir,
    mala: await runWithWorkspace(WS, () => C.guardarRepeticion('evmolde1', 'cualquier cosa')),
    bloque: await runWithWorkspace(WS, () => C.guardarRepeticion('evbloque', 'FREQ=DAILY')),
    saca: await runWithWorkspace(WS, () => C.guardarRepeticion('evmolde1', null)),
    sacada: (db.calendario_eventos as Array<Record<string, unknown>>).find((f) => f.id === 'evmolde1')?.repetir ?? null,
  };

  // (f) Otra pasada la creó a la vez: justo después de leer, otra escribe la del 30 (se simula en la copia del archivo). El índice
  // único choca, la copia se borra y esa vez no se programa dos veces.
  reset();
  db.calendario_eventos.push(molde());
  let unaVez = true;
  const rF = await runWithWorkspace(WS, () => C.generarRecurrentes(AHORA, {
    ...deps,
    copiar: async (de: string, a: string) => {
      if (unaVez) { unaVez = false; db.calendario_eventos.push({ ...molde({ id: 'evotra', repetir: null, serie_de: 'evmolde1', inicio: '2026-10-30T13:00:00.000Z' }) }); }
      return deps.copiar(de, a);
    },
  }));
  out.f = { r: rF, programadas: programadas.map((x) => x.length), borradas: borradas.length };

  out.red = [...red];
  process.stdout.write(`\n@@RESULTADO@@${JSON.stringify(out)}`, () => process.exit(0));
}

void main().catch((e) => { process.stdout.write(`\n@@RESULTADO@@${JSON.stringify({ tiro: e instanceof Error ? e.stack : String(e) })}`, () => process.exit(0)); });

export {};
