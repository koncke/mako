// =============================================================================
// Hijo de tests/ia-pc-binarios.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre el instalador REAL (GET /api/ia-pc/instalar) con un código vivo, contra un PostgREST de mentira y un Storage que
// contesta «Object not found» al firmar, como el de producción el 22/10 con la 0.3.2. Lo que importa: que conteste el
// aviso con 200 (para que `irm` lo muestre) Y que deje la fila en errores_app; antes sólo contestaba.
// =============================================================================

import { createHash } from 'node:crypto';
import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

let n = 0;
const pg = crearPostgrest({
  tablas: ['ia_pc_codigos', 'errores_app', 'tickets', 'workspaces', 'app_settings', 'usuarios'],
  defaults: (_t, f) => ({ id: ++n, created_at: new Date().toISOString(), ...f }),
});
const firmas: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test' && u.pathname.startsWith('/storage/v1/object/sign/')) {
    firmas.push(u.pathname);
    return new Response(JSON.stringify({ statusCode: '404', error: 'not_found', message: 'Object not found' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  if (u.host === 'supa.test') return pg.responder(u, init);
  return new Response('{}', { status: 500 });
}) as typeof fetch;

const CODIGO = 'ABCD2345';

async function main() {
  pg.db.workspaces.push({ id: 9, capa: 'superadmin', nombre: 'MaKo' });
  pg.db.ia_pc_codigos.push({ codigo_hash: createHash('sha256').update(CODIGO).digest('hex'), usado_at: null, vence_at: new Date(Date.now() + 600_000).toISOString(), workspace_id: 3 });
  const { NextRequest } = await import('next/server');
  const { GET } = await import('../app/api/ia-pc/instalar/route');
  const res = await GET(new NextRequest(`http://localhost/api/ia-pc/instalar?os=windows&codigo=${CODIGO}`, { headers: { 'x-forwarded-for': '203.0.113.7' } }));
  const out = {
    status: res.status, cuerpo: await res.text(), firmas,
    errores: pg.db.errores_app.map((f) => ({ titulo: f.titulo, origen: f.origen, mensaje: (f.ejemplo as { mensaje?: string } | undefined)?.mensaje, veces: f.veces ?? 1 })),
  };
  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@RESULTADO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}`); process.exit(0); });
