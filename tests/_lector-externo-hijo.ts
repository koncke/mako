// =============================================================================
// Hijo de tests/offer-lector-credenciales.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre el lector de afuera REAL (lib/offer-lector-externo.ts, `server-only`) en un node aparte con
// `--conditions=react-server`, con un fetch de mentira que anota cada pedido y contesta como r.jina.ai. Imprime, en una
// línea JSON, a qué URLs se llamó y qué devolvió el lector con cada link.
// =============================================================================

export {};

const pedidos: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL) => {
  pedidos.push(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  const cuerpo = `Title: Sprint 3 días\nURL Source: https://sprint.mauriciobustos.com/\n\nMarkdown Content:\n${'Un taller en vivo de 3 días para diseñar tu sistema de ejecución. '.repeat(8)}`;
  return new Response(cuerpo, { status: 200, headers: { 'content-type': 'text/plain' } });
}) as typeof fetch;
console.warn = () => {};

async function main() {
  const { leerConLectorExterno } = await import('../lib/offer-lector-externo');
  const links = JSON.parse(process.argv[2] ?? '[]') as string[];
  const leidos: Record<string, boolean> = {};
  for (const l of links) leidos[l] = (await leerConLectorExterno(l)) != null;
  process.stdout.write(`${JSON.stringify({ pedidos, leidos })}\n`);
}
main().catch((e) => { console.error(e); process.exit(1); });
