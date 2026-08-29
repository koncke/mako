// =============================================================================
// GET /api/admin/graph — sirve el grafo de código (graphify) al panel de admin
// =============================================================================
// Se sirve como PÁGINA (se abre en pestaña nueva, no en iframe: la CSP global
// frame-ancestors 'none' bloquea el embedding, y a pantalla completa se ve mejor).
// Fuentes, en orden:
//   1) graphify-out/graph.html — grafo FRESCO local (gitignored; solo en dev).
//   2) ./graph.html — SNAPSHOT committeado junto a esta ruta (viaja al deploy;
//      incluido en el bundle serverless vía import.meta.url). Refrescarlo:
//      `graphify update . && graphify cluster-only . --no-label`, copiar
//      graphify-out/graph.html acá y commitear.
// Gateado a super-admin (getSesionAdmin).
// =============================================================================

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getSesionAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const NOT_FOUND = `<!doctype html><html><head><meta charset="utf-8"><meta name="color-scheme" content="light dark"></head>
<body style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;margin:0;padding:44px;color:#5B6472;background:#F4F6F9">
  <h2 style="color:#12151B;margin:0 0 10px;font-weight:600">Grafo no disponible</h2>
  <p style="max-width:62ch;line-height:1.6">No se encontró el grafo. Regenéralo con graphify y actualiza el snapshot:</p>
  <pre style="background:#fff;border:1px solid #EAECF1;border-radius:10px;padding:14px 16px;font-size:13px;overflow:auto">graphify update .
graphify cluster-only . --no-label
copy graphify-out\\graph.html app\\api\\admin\\graph\\graph.html</pre>
</body></html>`;

function loadGraphHtml(): string | null {
  // 1) Grafo fresco local (dev) — no existe en el deploy (gitignored).
  try { return readFileSync(join(process.cwd(), 'graphify-out', 'graph.html'), 'utf8'); } catch { /* sin grafo local */ }
  // 2) Snapshot committeado (viaja al deploy).
  try { return readFileSync(new URL('./graph.html', import.meta.url), 'utf8'); } catch { /* sin snapshot */ }
  return null;
}

export async function GET() {
  const sesion = await getSesionAdmin();
  if (!sesion) return new Response('No autorizado', { status: 403 });

  const html = loadGraphHtml();
  return new Response(html ?? NOT_FOUND, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
