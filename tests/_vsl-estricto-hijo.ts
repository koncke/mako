// =============================================================================
// Hijo de tests/vsl-estricto.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// lib/leads.ts lleva `server-only`: corre en un node aparte con `--conditions=react-server`, con la base de mentira
// CAÍDA para `vsl_events` (un 500), y le contesta al test con un JSON: qué hace `getVslEngagementMap` tolerante y estricto.
// =============================================================================

export {};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

globalThis.fetch = (async (entrada: RequestInfo | URL) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host !== 'supa.test') throw new Error(`fetch sin mock: ${u.href}`);
  const tabla = u.pathname.replace('/rest/v1/', '');
  if (tabla === 'vsl_events') return json(500, { message: 'la base no contesta (simulado)', code: '57014' });
  // Lo demás (duraciones del VSL, settings) vacío: no es lo que se prueba.
  return json(200, []);
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

async function main() {
  const { runWithWorkspace } = await import('../lib/workspace');
  const { getVslEngagementMap } = await import('../lib/leads');
  const out: Record<string, unknown> = {};
  await runWithWorkspace(3, async () => {
    const tolerante = await getVslEngagementMap(['v1', 'v2']);
    out.tolerante = { tamano: tolerante.size };
    try {
      await getVslEngagementMap(['v1', 'v2'], { estricto: true });
      out.estricto = { tiro: false };
    } catch (e) {
      out.estricto = { tiro: true, mensaje: e instanceof Error ? e.message : String(e) };
    }
  });
  process.stdout.write(JSON.stringify(out));
}

main().catch((e) => { process.stdout.write(JSON.stringify({ fallo: e instanceof Error ? e.message : String(e) })); });
