// =============================================================================
// Hijo de tests/meta-anuncio-reintento.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre lo REAL de F117 (lib/meta-anuncio.ts y `alNacerLeadDeMeta`) contra el PostgREST de mentira: la marca en
// `lead_audit`, el «desde cuándo» en `app_settings`, y dos puertas reclamando a la vez. Lo inmediato (el aviso, los flujos
// y las automatizaciones) va mockeado: acá se cuenta cuántas veces sale, no qué dice.
// =============================================================================

import { mock } from 'node:test';
import { crearPostgrest } from './_postgrest-de-mentira';

let proximo = 1;
const pg = crearPostgrest({
  tablas: ['lead_audit', 'app_settings'],
  defaults: (t, f) => (t === 'lead_audit'
    ? { ...f, id: f.id ?? proximo++, created_at: f.created_at ?? new Date().toISOString() }
    : { ...f }),
});
const db = pg.db;
const red: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  red.push(`${u.host}${u.pathname}`);
  return new Response(JSON.stringify({ error: 'red de mentira' }), { status: 500 });
}) as typeof fetch;
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

const sale: string[] = [];
const real = (m: Record<string, unknown>) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'default' && k !== 'module.exports'));
const url = (rel: string) => new URL(rel, import.meta.url).href;

async function main() {
  mock.module(url('../lib/avisos.ts'), { namedExports: { ...real(await import('../lib/avisos')), emitirDelCatalogo: async (_id: string, o: { lead: { id: number } }) => { sale.push(`aviso:${o.lead.id}`); return { ok: true }; } } });
  mock.module(url('../lib/flujos.ts'), { namedExports: { ...real(await import('../lib/flujos')), dispararEvento: async (_e: string, c: { leadId: number; dedupKey?: string }) => { sale.push(`flujos:${c.leadId}:${c.dedupKey ?? '-'}`); } } });
  mock.module(url('../lib/nutricion.ts'), { namedExports: { ...real(await import('../lib/nutricion')), enrolarPorEvento: async (id: number) => { sale.push(`automatizaciones:${id}`); return 0; } } });
  const { reclamarAnuncio, sinAnunciarDe } = await import('../lib/meta-anuncio');
  const { alNacerLeadDeMeta } = await import('../lib/meta-lead-nuevo');
  const { CLAVE_MARCA_DESDE, LINEA_LEAD_ANUNCIADO } = await import('../lib/meta-anuncio-reglas');
  const WS = 15;
  const marcasDe = (lead: number) => db.lead_audit.filter((f) => f.lead_id === lead && f.valor_nuevo === LINEA_LEAD_ANUNCIADO).length;
  const form = { fieldData: null, campana: null };
  const out: Record<string, unknown> = {};

  // 1. Dos puertas reclaman el MISMO lead a la vez: una gana, y queda UNA marca.
  const [a, b] = await Promise.all([reclamarAnuncio(WS, 500), reclamarAnuncio(WS, 500)]);
  out.carrera = { a, b, marcas: marcasDe(500) };
  // Y la tercera, después, pierde.
  out.tarde = await reclamarAnuncio(WS, 500);
  out.desde = (db.app_settings.find((f) => f.key === CLAVE_MARCA_DESDE && f.workspace_id === WS)?.value as string | undefined) ?? null;

  // 2. El lead NUEVO (la puerta que lo crea): sale una vez, con la dedupKey de los flujos, y queda marcado.
  sale.length = 0;
  await alNacerLeadDeMeta(WS, { id: 600, nombre: 'Silvana' }, form);
  out.nuevo = { sale: [...sale], marcas: marcasDe(600) };
  // Una reentrega de ese mismo lead, como reintento: ya está marcado, no sale nada.
  sale.length = 0;
  await alNacerLeadDeMeta(WS, { id: 600, nombre: 'Silvana' }, form, { esReintento: true });
  out.reentrega = [...sale];

  // 3. Qué reintentos se anuncian. «Desde» es la primera marca del negocio; los leads, un rato después.
  const desdeMs = Date.parse(String(out.desde));
  const ahora = desdeMs + 3 * 3600_000;
  const iso = (ms: number) => new Date(ms).toISOString();
  const caido = { id: 700, creadoAt: iso(desdeMs + 60 * 60_000), formCreadoEn: iso(desdeMs + 59 * 60_000) };
  const marcado = { id: 600, creadoAt: iso(desdeMs + 60 * 60_000), formCreadoEn: iso(desdeMs + 59 * 60_000) };
  const antesDeMarcar = { id: 701, creadoAt: iso(desdeMs - 60 * 60_000), formCreadoEn: iso(desdeMs - 61 * 60_000) };
  const yaEstaba = { id: 702, creadoAt: iso(desdeMs + 30 * 60_000), formCreadoEn: iso(desdeMs + 90 * 60_000) };
  const sinForm = { id: 703, creadoAt: iso(desdeMs + 60 * 60_000), formCreadoEn: null };
  out.reintentos = [...(await sinAnunciarDe(WS, [caido, marcado, antesDeMarcar, yaEstaba, sinForm], ahora))].sort();
  // Otro negocio, sin ninguna marca todavía: no sabe desde cuándo marca, así que ninguno.
  out.otroNegocio = [...(await sinAnunciarDe(16, [caido], ahora))];

  // 4. El reintento del caído sale una vez; uno segundo, ya no.
  sale.length = 0;
  await alNacerLeadDeMeta(WS, { id: 700, nombre: 'Rosana' }, form, { esReintento: true });
  await alNacerLeadDeMeta(WS, { id: 700, nombre: 'Rosana' }, form, { esReintento: true });
  out.caido = { sale: [...sale], marcas: marcasDe(700) };

  // 5. Sin poder marcar (la tabla no contesta): el reintento NO anuncia; la puerta que lo crea, sí.
  pg.faltan.add('lead_audit');
  sale.length = 0;
  await alNacerLeadDeMeta(WS, { id: 800, nombre: 'Omar' }, form, { esReintento: true });
  out.sinMarcaReintento = [...sale];
  await alNacerLeadDeMeta(WS, { id: 801, nombre: 'Miguel' }, form);
  out.sinMarcaNuevo = [...sale];
  pg.faltan.delete('lead_audit');

  out.red = red;
  process.stdout.write(`\n@@RESULTADO@@${JSON.stringify(out)}`, () => process.exit(0));
}

void main().catch((e) => { process.stdout.write(`\n@@RESULTADO@@${JSON.stringify({ tiro: e instanceof Error ? e.stack : String(e) })}`, () => process.exit(0)); });

export {};
