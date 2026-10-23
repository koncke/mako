// =============================================================================
// Hijo de tests/ia-pc-cuentas-dispositivos.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// La ubicación de cada computadora (23/10/2026), con lib/ia-pc.ts REAL contra un PostgREST de mentira: el latido la guarda (sólo
// el texto), la lista la devuelve, y SIN la mig 0327 (la base contesta «column … ubicacion does not exist») el latido igual se
// anota y la lista sale con null. Escribe el resultado como JSON.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

let ids = 0;
const pg = crearPostgrest({
  tablas: ['workspaces', 'ia_pc_codigos', 'ia_pc_dispositivos', 'ia_pc_turnos', 'ia_pc_llamadas'],
  defaults: (tabla, f) => tabla === 'ia_pc_dispositivos'
    ? { id: ++ids, creado_at: new Date(Date.now() + ids * 1000).toISOString(), revocado_at: null, ultimo_latido: null, cuentas: [], confirmado_at: null, activa_at: null, claude_falta: false, version: null, ...f }
    : tabla === 'ia_pc_codigos' ? { usado_at: null, dispositivo_id: null, ...f } : f,
});
let sinLaColumna = false;
const pedidos: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host !== 'supa.test') return new Response('{}', { status: 500 });
  const cuerpo = typeof init.body === 'string' ? init.body : '';
  pedidos.push(`${init.method ?? 'GET'} ${u.pathname}${u.search} ${cuerpo}`);
  // Sin la mig 0327: la columna no existe.
  if (sinLaColumna && u.pathname.endsWith('/ia_pc_dispositivos') && (u.search.includes('ubicacion') || cuerpo.includes('"ubicacion"'))) {
    return new Response(JSON.stringify({ code: '42703', message: 'column ia_pc_dispositivos.ubicacion does not exist', details: null, hint: null }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  return pg.responder(u, init);
}) as typeof fetch;

async function main() {
  const pc = await import('../lib/ia-pc');
  const { VERSION_CONSENTIMIENTO } = await import('../lib/ia-pc-reglas');
  pg.db.workspaces.push({ id: 3, nombre: 'Cliente de Prueba' });
  const c = await pc.crearCodigo(3, 'ana@prueba.com', VERSION_CONSENTIMIENTO);
  const e = await pc.emparejar(c.codigo, 'PC de Ana');
  await pc.confirmar((await pc.dispositivoDelToken(e!.token, { pendientesTambien: true }))!);
  const d = (await pc.dispositivoDelToken(e!.token))!;
  const out: Record<string, unknown> = {};
  // Con la columna: se guarda el texto, y sólo el texto.
  await pc.latir(d, { version: '0.4.0+windows', cuentas: [{ proveedor: 'claude', email: 'ana@gmail.com' }] }, { ubicacion: 'Grandbourg, Buenos Aires, Argentina' });
  out.fila = (({ ubicacion, ...resto }) => ({ ubicacion, columnas: Object.keys(resto).sort() }))(pg.db.ia_pc_dispositivos.find((f) => f.id === d.id) as Record<string, unknown>);
  out.lista = (await pc.listarDispositivos(3, 'ana@prueba.com', false)).map((x) => x.ubicacion);
  out.todas = (await pc.listarTodasLasPc()).map((x) => ({ ubicacion: x.ubicacion, cuentas: x.cuentas.map((y) => y.email) }));
  // Sin ubicación en un latido (sin los headers): queda la última.
  await pc.latir(d, { version: '0.4.0+windows', cuentas: [{ proveedor: 'claude', email: 'ana@gmail.com' }] }, { ubicacion: null });
  out.queda = pg.db.ia_pc_dispositivos.find((f) => f.id === d.id)?.ubicacion;
  // Sin la mig 0327: el latido igual se anota, y la lista sale (sin la ubicación).
  sinLaColumna = true;
  // Una base sin la columna no la tiene en ninguna fila (el PostgREST de mentira devuelve la fila entera).
  for (const f of pg.db.ia_pc_dispositivos) delete f.ubicacion;
  const antes = pg.db.ia_pc_dispositivos.find((f) => f.id === d.id)?.ultimo_latido;
  await new Promise((r) => setTimeout(r, 5));
  let latioSinColumna: string | true = true;
  try { await pc.latir(d, { version: '0.4.0+windows', cuentas: [] }, { ubicacion: 'Córdoba, Argentina' }); } catch (x) { latioSinColumna = x instanceof Error ? x.message : String(x); }
  out.latioSinColumna = latioSinColumna;
  out.latidoNuevo = pg.db.ia_pc_dispositivos.find((f) => f.id === d.id)?.ultimo_latido !== antes;
  let listaSinColumna: unknown;
  try { listaSinColumna = (await pc.listarDispositivos(3, 'ana@prueba.com', false)).map((x) => [x.nombre, x.ubicacion]); } catch (x) { listaSinColumna = x instanceof Error ? x.message : String(x); }
  out.listaSinColumna = listaSinColumna;
  let todasSinColumna: unknown;
  try { todasSinColumna = (await pc.listarTodasLasPc()).map((x) => [x.nombre, x.ubicacion]); } catch (x) { todasSinColumna = x instanceof Error ? x.message : String(x); }
  out.todasSinColumna = todasSinColumna;
  // Nada de la IP ni de coordenadas viajó a la base.
  out.ipOCoordenadas = pedidos.filter((p) => /x-forwarded-for|\bip\b|lat|lon/i.test(p.replace(/latido|ultimo_latido/g, ''))).length;
  process.stdout.write(`@@UBICACION@@${JSON.stringify(out)}\n`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@UBICACION@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}\n`); process.exit(0); });
