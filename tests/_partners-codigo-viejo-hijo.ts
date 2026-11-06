// =============================================================================
// Hijo de tests/partners-referidos.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// lib/partners-programa.ts lleva `server-only`: corre en un node aparte con `--conditions=react-server`, con una base de mentira
// donde el código NO es actual y la tabla de los códigos anteriores contesta según el caso (`CASO`). Le contesta al test con un JSON.
// =============================================================================

export {};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const CASO = process.env.CASO;

globalThis.fetch = (async (entrada: RequestInfo | URL) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host !== 'supa.test') throw new Error(`fetch sin mock: ${u.href}`);
  const tabla = u.pathname.replace('/rest/v1/', '');
  if (tabla === 'partner_codigos') return json(200, []);
  if (tabla === 'partner_codigos_anteriores') {
    if (CASO === 'caida') return json(500, { code: '57014', message: 'la base no contesta (simulado)' });
    if (CASO === 'sin-tabla') return json(404, { code: 'PGRST205', message: 'Could not find the table' });
    return json(200, [{ workspace_id: 42 }]);
  }
  if (tabla === 'workspaces') return json(200, [{ id: 9, capa: 'superadmin' }]);
  return json(200, []);
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

async function main() {
  const { esCodigoDePartner } = await import('../lib/partners-programa');
  try {
    process.stdout.write(JSON.stringify({ es: await esCodigoDePartner('ana-vieja') }));
  } catch (e) {
    process.stdout.write(JSON.stringify({ tiro: true, mensaje: e instanceof Error ? e.message : String(e) }));
  }
}

main().catch((e) => { process.stdout.write(JSON.stringify({ fallo: e instanceof Error ? e.message : String(e) })); });
