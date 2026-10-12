// =============================================================================
// GET /l/vista/<token> — el BORRADOR de una landing, por el link privado
// =============================================================================
// Es el «Compartir → vista previa» del editor (PedidoDocs `vistaPrevia`): quien tiene el
// link ve lo GUARDADO —no lo publicado— sin entrar a MaKo. El token es la credencial
// entera, viaja en el camino y sólo autoriza a LEER ese borrador; lo acuña y lo valida
// `leerVistaPrevia` (lib/editor-landing/publicar.ts), que lee con el cliente crudo.
//
// Mismo documento que la página publicada, en modo 'vista' (`responderPublico`,
// lib/editor-landing/pagina-publica.ts): `noindex`, `private, no-store`, y SIN el Pixel de
// MaKo ni el Píxel de Meta — un borrador abierto por el equipo no es una visita, y le
// ensuciaría al cliente la medición y el aprendizaje de sus anuncios.
//
// ⚠️ PÚBLICA Y SIN COOKIE (`/l` en PUBLICOS, sólo GET/HEAD/OPTIONS por el proxy).
// =============================================================================
import type { NextRequest } from 'next/server';
import { leerVistaPrevia } from '@/lib/editor-landing/publicar';
import { responderPublico } from '@/lib/editor-landing/pagina-publica';

export const dynamic = 'force-dynamic';

type Params = Promise<{ token: string }>;

export async function GET(req: NextRequest, ctx: { params: Params }) {
  const { token } = await ctx.params;
  return responderPublico(req, { tipo: 'vista', token }, { leer: () => leerVistaPrevia(token) });
}

export async function HEAD(req: NextRequest, ctx: { params: Params }) {
  return GET(req, ctx);
}
