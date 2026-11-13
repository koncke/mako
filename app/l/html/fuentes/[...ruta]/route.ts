// =============================================================================
// GET /l/html/fuentes/<familia>/<versión>/<archivo>.woff2 — la fuente de una landing, desde SU dominio (13/11/2026)
// =============================================================================
// La publicada lleva sus `@font-face` en línea apuntando acá (lib/editor-landing/fuentes-propias.ts): el archivo
// viaja por la conexión que la página ya tiene abierta, en vez de abrir dos nuevas a Google antes de pintar.
// Esta ruta lo trae de fonts.gstatic.com y el borde lo guarda un año (la URL de Google está versionada).
// Pasa por el proxy en hola-mako.site y en el dominio de un cliente porque vive bajo /l/html (`PREFIJO_PASA`,
// `decidirLandings`); el segmento fijo `fuentes` le gana a `[docId]`. Pública y sin base: no lee nada de nadie.
// =============================================================================
import { responderFuente } from '@/lib/editor-landing/fuentes-propias';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ ruta: string[] }> }): Promise<Response> {
  const { ruta } = await params;
  return responderFuente(ruta ?? []);
}
