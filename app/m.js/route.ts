// =============================================================================
// GET /m.js?id=mko_… — el Pixel de MaKo, servido para la línea del cargador
// =============================================================================
// Decisión de Martín (09/10/2026): el Pixel se instala con UNA línea
// (`<script src="https://hola-mako.com/m.js?id=mko_…" defer></script>`) y esta ruta
// sirve el código ACTUAL para ese token — el mismo que se descarga como archivo en
// /integraciones. Así nadie pega 2.226 líneas, y una versión nueva llega sola en
// minutos (la caché es corta a propósito). El porqué completo, el nombre neutro de
// la ruta y la forma del token: lib/pixel-cargador.ts.
//
// La decisión de qué contestar vive en `responderCargador` (pura, con test). Acá
// sólo se enchufan las dos cosas que necesita:
//   · el token se resuelve con la lectura ESTRICTA del ruteo (`'landing'`): «no pude
//     leer» no es «no está» — con la tolerante, un pestañeo de la base contestaba 404
//     y el CDN lo guardaba (regla de AGENTS.md para todo lo que decide de quién es algo);
//   · el código es `pixelComoArchivo(landingSnippet(token))`, nunca una copia.
//
// ⚠️ PÚBLICA Y SIN COOKIE. El proxy ni la ve: su matcher (proxy.ts) excluye todo camino
// que termina en `.js`. Igual está en PUBLICOS (lib/rutas-publicas.ts) por si el matcher
// cambia, y como no es /api/, `esPublicaSoloLeer` la deja sólo en GET/HEAD/OPTIONS. Acá
// se exporta sólo GET: cualquier otro método lo contesta Next con 405.
// =============================================================================
import type { NextRequest } from 'next/server';
import { wsPorIdentificadorEstricto } from '@/lib/webhook-routing';
import { LANDING_SERVICIO, landingSnippet } from '@/lib/landing-token';
import { pixelComoArchivo } from '@/lib/pixel-archivo';
import { PARAM_CARGADOR, responderCargador } from '@/lib/pixel-cargador';
import { mensajeDeError } from '@/lib/calendly-error';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const r = await responderCargador(req.nextUrl.searchParams.get(PARAM_CARGADOR), {
    resolver: async (token) => {
      try {
        return await wsPorIdentificadorEstricto(LANDING_SERVICIO, token);
      } catch (err) {
        console.error(`[m.js] no pude leer de quién es el token (la base no contestó): ${mensajeDeError(err)}`);
        throw err;
      }
    },
    pixel: (token) => pixelComoArchivo(landingSnippet(token)),
  });
  return new Response(r.cuerpo, {
    status: r.status,
    headers: {
      ...r.headers,
      // Es JavaScript que corre en la página de un tercero: que el navegador no
      // adivine otro tipo.
      'X-Content-Type-Options': 'nosniff',
      // Se carga desde el dominio del cliente con <script src>. Con `crossorigin` en la
      // etiqueta (algunos editores lo agregan solos) hace falta CORS para que corra.
      'Access-Control-Allow-Origin': '*',
    },
  });
}
