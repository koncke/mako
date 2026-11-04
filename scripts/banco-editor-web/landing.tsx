// El banco de la landing de venta: app/vsl/Landing.tsx REAL con un documento de un .json de esta carpeta, sin base y sin
// medir (el Pixel sólo mide en los dominios de producción: `debeMedir`). Sirve para mirar una landing sin sumarle una visita.
// `/landing?doc=<archivo sin .json>` · `&promo=<ms>`: con el cartel del 50% y ese tiempo.
import { createRoot } from 'react-dom/client';
import Landing, { type DisenoLanding } from '@/app/vsl/Landing';
import { PLANES_MAKO_DEFAULT } from '@/lib/planes-mako';

const q = new URLSearchParams(location.search);
const real = window.fetch.bind(window);
window.fetch = (async (u: RequestInfo | URL, i?: RequestInit) => {
  const ruta = String(u);
  if (ruta.includes('/api/promo-entrada')) {
    const ms = q.get('promo');
    return new Response(JSON.stringify(ms ? { hay: true, restanteMs: Number(ms) } : { hay: false }), { headers: { 'content-type': 'application/json' } });
  }
  if (ruta.startsWith('/api/')) return new Response('{}', { headers: { 'content-type': 'application/json' } });
  return real(u, i);
}) as typeof fetch;

const PLANES = PLANES_MAKO_DEFAULT.filter((p) => p.activo).map((p) => ({ ...p, cobrable: true }));

const crudo = await fetch(`/${q.get('doc') ?? 'doc-actual'}.json`).then((r) => r.json() as Promise<DisenoLanding>);
// El reproductor no se carga: mirar el diseño no puede sumarle una reproducción al video de venta.
const diseno = { ...crudo, html: crudo.html.replace(/<iframe\b([^>]*?)\ssrc="[^"]*"/g, '<iframe$1 src="about:blank"') };
createRoot(document.getElementById('app')!).render(<Landing diseno={diseno} planes={PLANES as never} landing={null} />);
