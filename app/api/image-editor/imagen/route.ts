// =============================================================================
// POST /api/image-editor/imagen — crear o editar una imagen con la IA DEL NEGOCIO (el chat «MaKo IA»)
// =============================================================================
// POST json {prompt, ancho, alto, referencia?} → { ok, url, ancho, alto, proveedor, modelo, subidoId } | { ok:false, error, link? }
//
// El chat (app/image-editor/mako/chat/acciones.ts) la llama cuando la propuesta de la IA trae `crear_imagen` o
// `editar_imagen`, ANTES de mostrarla (así «Original | Modificado» enseña la imagen de verdad). `referencia` es la data URL
// de la imagen a editar, que arma el navegador desde el diseño. La imagen la paga el negocio con SU clave
// (lib/image-editor/imagen-ia.ts) y queda en «Subidos» (`guardarImagenGenerada`): el diseño la nombra por esa URL estable.
// Esta ruta no toca el diseño: lo cambia el editor cuando la persona acepta.
//
// La puerta es la del editor (`puerta`: sesión, admin con la tab en su capa y un workspace), y la imagen se pide ADENTRO
// de `runWithWorkspace`: sin workspace no hay a quién cobrarle. Va detrás de la sesión (NO está en lib/rutas-publicas.ts)
// y el proxy le exige Origin propio al POST.
//
// ⚠️ NO SE REINTENTA, y el pedido al proveedor NO se corta si la persona cierra la pestaña: lo que viajó se cobra igual,
// así que la imagen se termina y se guarda en «Subidos» (ahí la encuentra).

import type { NextRequest } from 'next/server';
import { runWithWorkspace } from '@/lib/workspace';
import { guardarImagenGenerada, puerta } from '@/lib/image-editor/server';
import { rateLimit } from '@/lib/rate-limit';
import { generarImagen } from '@/lib/image-editor/imagen-ia';
import { NOMBRE_PROVEEDOR } from '@/lib/image-editor/imagen-ia-reglas';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// El proveedor tiene 150 s (TOPES_IMAGEN_IA.plazoMs) y subir la imagen, unos segundos.
export const maxDuration = 180;

const fallo = (error: string, status: number, extra: Record<string, unknown> = {}) =>
  Response.json({ ok: false, error, ...extra }, { status, headers: { 'cache-control': 'no-store' } });

export async function POST(req: NextRequest) {
  const p = await puerta();
  if (p instanceof Response) return p;
  // Cada imagen se cobra en la cuenta del negocio: el tope es bajo a propósito.
  if (!rateLimit(`image-editor:imagen:${p.ws}`, 10, 60_000)) return fallo('Demasiadas imágenes seguidas. Espera un minuto.', 429);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return fallo('Pedido inválido.', 400); }
  if (!body || typeof body !== 'object') return fallo('Pedido inválido.', 400);

  return runWithWorkspace(p.ws, async () => {
    const r = await generarImagen({ prompt: body.prompt, ancho: body.ancho, alto: body.alto, referencia: body.referencia });
    if (!r.ok) return fallo(r.error, r.status, { ...(r.link ? { link: r.link } : {}), deQuien: r.deQuien });
    const nombre = `IA: ${String(body.prompt).replace(/\s+/g, ' ').trim().slice(0, 80)}`;
    const s = await guardarImagenGenerada(p.ws, r.imagen, nombre);
    if (!s.ok) {
      console.error(`[image-editor:imagen] ws=${p.ws}: la imagen se creó y no se pudo guardar: ${s.error}`);
      return fallo(`La imagen se creó con tu ${NOMBRE_PROVEEDOR[r.proveedor]} (y se cobró en tu cuenta), pero MaKo no la pudo guardar. Es un problema de MaKo: repórtalo a Soporte.`, 500, { deQuien: 'mako' });
    }
    return Response.json(
      { ok: true, url: s.subido.url, ancho: r.imagen.ancho, alto: r.imagen.alto, proveedor: r.proveedor, modelo: r.modelo, subidoId: s.subido.id, nombre: s.subido.nombre },
      { headers: { 'cache-control': 'no-store' } },
    );
  });
}
