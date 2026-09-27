// =============================================================================
// /api/portadas/foto — la miniatura del catálogo, servida por nosotros
// =============================================================================
// ⚠️ ESTA RUTA EXISTE PORQUE LA GRILLA NO CARGABA, Y ESO SE MIDIÓ, NO SE DEDUJO.
// El 27/09/2026, con la galería nueva abierta en Chrome: de las 24 miniaturas,
// **las 24 quedaban en blanco**. `complete: false`, `naturalWidth: 0`, y en la red
// el `302` de picsum SIN el `200` de fastly detrás — o sea, el navegador no seguía
// la redirección. Y se reproduce FUERA de la app: nueve `<img>` a
// `picsum.photos/id/N/400/140` en una página en blanco hacen que `setContent` ni
// siquiera termine de cargar.
//
// Lo que distingue el caso que anda del que no anda, que es lo único que explica
// algo (AGENTS.md → «allá funciona y acá no» es el método):
//
//   · UNA sola miniatura, en un contexto limpio        → ✔ carga
//   · la URL de `fastly.picsum.photos` ya resuelta      → ✔ carga
//   · cualquier otra que pase por `picsum.photos`       → ✖ cuelga (12 s, sin error)
//   · las MISMAS urls con `curl`, 12 en paralelo        → ✔ las 12 contestan 302
//
// O sea: **`picsum.photos` throttlea al NAVEGADOR y no al server.** El CDN de
// destino (`fastly.picsum.photos`) no throttlea nada, pero su URL va firmada con un
// `hmac` que sólo picsum puede calcular, así que no se puede armar de este lado.
//
// La cura es que el navegador no le hable nunca a picsum: le pide la imagen a
// nuestro propio origen, y el que sigue la redirección es el server, que puede.
//
// ⚠️ Y HAY UN SEGUNDO MOTIVO, QUE ES EL QUE HABRÍA QUE HABER VISTO PRIMERO: un
// `<img>` a un tercero se carga **con el referer de quien abre la pantalla**. Es
// exactamente lo que `ORIGENES_OK` (lib/portadas.ts) existe para impedir del lado
// del dato, y la grilla lo hacía 24 veces por apertura del selector. Proxear la
// arregla de las dos formas.

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * LOS TAMAÑOS QUE SE PUEDEN PEDIR, en positivo y enumerados.
 *
 * Sin esta lista, esto es un redimensionador de imágenes abierto: cualquiera con
 * sesión pide `10000x10000` y nos cobra el ancho de banda de un tercero. Son los
 * dos que el selector usa de verdad — la miniatura de la grilla y la banda.
 */
const TAMANOS = new Set(['400x140', '1600x420']);

export async function GET(req: NextRequest) {
  const sesion = await getUsuarioActual();
  if (!sesion) return new Response('no autenticado', { status: 401 });

  const q = new URL(req.url).searchParams;
  const id = q.get('id') ?? '';
  const w = q.get('w') ?? '400';
  const h = q.get('h') ?? '140';
  // El id viaja en el PATH de la URL de picsum: se valida o se puede escapar de él.
  if (!/^[0-9]{1,6}$/.test(id) || !TAMANOS.has(`${w}x${h}`)) {
    return new Response('pedido inválido', { status: 400 });
  }

  try {
    // `redirect: 'follow'` es el default y acá es LO QUE HACE LA RUTA: seguir el 302
    // que el navegador no puede seguir.
    const r = await fetch(`https://picsum.photos/id/${id}/${w}/${h}`, {
      signal: AbortSignal.timeout(12_000),
      // Sin cookies ni referer nuestro: es una imagen pública.
      headers: { accept: 'image/*' },
    });
    // ⚠️ `r.ok` Y NO SÓLO «no tiró». picsum tiene huecos en su espacio de ids: de 12
    // ids consecutivos medidos, uno contestó 404. Un 404 devuelto como imagen deja un
    // `<img>` roto que no dice por qué.
    if (!r.ok) return new Response('no está', { status: r.status === 404 ? 404 : 502 });
    const tipo = r.headers.get('content-type') ?? '';
    // Que el tercero diga «imagen». Si contesta un HTML de error, no se sirve como tal.
    if (!tipo.startsWith('image/')) return new Response('el catálogo no devolvió una imagen', { status: 502 });

    return new Response(r.body, {
      headers: {
        'content-type': tipo,
        // Una foto del catálogo con un id fijo no cambia nunca: se cachea fuerte, y
        // con eso la segunda persona que abre el selector no le pega a picsum.
        'cache-control': 'public, max-age=86400, stale-while-revalidate=604800, immutable',
        // No es HTML, pero es contenido de un tercero saliendo por nuestro dominio.
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (e) {
    const msg = e instanceof Error && e.name === 'TimeoutError' ? 'la foto tardó demasiado' : 'no pude traer la foto';
    return new Response(msg, { status: 504 });
  }
}
