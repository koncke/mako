// =============================================================================
// GET /api/admin/graph — sirve el grafo de código (graphify) al panel de admin
// =============================================================================
// El grafo (graphify-out/graph.html) es un artefacto de DEV generado por
// graphify: NO se commitea (rutas absolutas + peso), así que existe en local
// pero no en el deploy. Acá lo servimos gateado a super-admin; si no está,
// devolvemos una página que explica cómo generarlo. Lo consume la tab "Grafo"
// de AdminView vía iframe.
// =============================================================================

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getSesionAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const NOT_FOUND = `<!doctype html><html><head><meta charset="utf-8"><meta name="color-scheme" content="light dark"></head>
<body style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;margin:0;padding:44px;color:#5B6472;background:#F4F6F9">
  <h2 style="color:#12151B;margin:0 0 10px;font-weight:600">Grafo no generado en este entorno</h2>
  <p style="max-width:60ch;line-height:1.6">El grafo del código es un artefacto de desarrollo (no se versiona). Se ve corriendo la app en local, después de generarlo con graphify:</p>
  <pre style="background:#fff;border:1px solid #EAECF1;border-radius:10px;padding:14px 16px;font-size:13px;overflow:auto">graphify update .
graphify cluster-only . --no-label</pre>
  <p style="max-width:60ch;line-height:1.6">Eso deja <code style="background:#EAECF1;border-radius:5px;padding:1px 6px">graphify-out/graph.html</code>, que esta pestaña sirve.
  Instalar graphify una vez: <code style="background:#EAECF1;border-radius:5px;padding:1px 6px">uv tool install graphifyy</code>.</p>
</body></html>`;

export async function GET() {
  const sesion = await getSesionAdmin();
  if (!sesion) return new Response('No autorizado', { status: 403 });

  try {
    const html = readFileSync(join(process.cwd(), 'graphify-out', 'graph.html'), 'utf8');
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  } catch {
    return new Response(NOT_FOUND, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  }
}
