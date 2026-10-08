'use server';

// =============================================================================
// Server actions de los ADJUNTOS de la descripción de una clase (/customer-success/curso)
// =============================================================================
// Subir una imagen o un archivo desde el editor rico, registrarlo, y pedir las URLs para verlo.
// Lo que se escribe y cómo se valida vive en lib/curso-adjuntos.ts; acá está la PUERTA. Diseño:
// docs/diseno-curso-skool.md, D4.
//
// ⚠️ CADA ACTION AUTORIZA SOLA: una server action es un POST que se puede invocar directo, sin
//    pasar por la página (Next 16, node_modules/next/dist/docs/01-app/02-guides/data-security.md).
//    Que el botón sólo se dibuje para un admin no protege nada.
//
// ⚠️ SUBIR Y REGISTRAR SON DE UN ADMIN, como editar la clase (`puedeEditar`): lo que se adjunta lo
//    ve cada alumno. VER es de quien ve la tab (`puedeVer`): el equipo revisa el curso.
//
// ⚠️ LA PUERTA ES LA MISMA QUE LA DE app/customer-success/curso/actions.ts, IMPORTADA de
//    ./puerta-curso.ts (08/10/2026). Hasta acá era una copia con un test que comparaba los cuerpos;
//    ahora no hay copia (tests/curso-adjuntos.test.ts fija que no vuelva).
//
// ⚠️ SÓLO SE EXPORTAN FUNCIONES ASYNC: en un archivo 'use server' un `export const` tipa, pasa el
//    typecheck y TIRA EL BUILD (AGENTS.md; guard en tests/campana-producto.test.ts).

import { getUsuarioActual } from '@/lib/auth';
import { puedeVer, puedeEditar, productoPropio } from './puerta-curso';
import { urlSubidaAdjunto, registrarAdjunto, urlAdjuntoEquipo, urlsAdjuntosEquipo } from '@/lib/curso-adjuntos';
import type { EntradaRegistroAdjunto } from '@/lib/curso-adjuntos-reglas';


const fallo = (e: unknown, def: string) => ({ ok: false as const, error: e instanceof Error && e.message ? e.message : def });

/** La URL firmada para que el navegador suba un adjunto directo al bucket (ver `urlSubidaAdjunto`). */
export async function urlSubidaAdjuntoAction(productoId: number, mime: string, bytes: number): Promise<
  { ok: true; path: string; signedUrl: string; apikey: string | null } | { ok: false; error: string }
> {
  try {
    const no = await puedeEditar();
    if (no) return { ok: false, error: no };
    const ajeno = await productoPropio(Number(productoId));
    if (ajeno) return { ok: false, error: ajeno };
    return await urlSubidaAdjunto(Number(productoId), String(mime ?? ''), Number(bytes));
  } catch (e) {
    return fallo(e, 'No pude preparar la subida.');
  }
}

/**
 * Registra un adjunto ya subido y devuelve su referencia (`mako-adjunto:<uuid>`), que es lo que el
 * editor mete en el HTML. El autor sale de la SESIÓN, nunca del pedido.
 */
export async function registrarAdjuntoAction(entrada: EntradaRegistroAdjunto): Promise<
  { ok: true; id: string; ref: string; nombre: string; mime: string } | { ok: false; error: string }
> {
  try {
    const no = await puedeEditar();
    if (no) return { ok: false, error: no };
    const ajeno = await productoPropio(Number(entrada?.productoId));
    if (ajeno) return { ok: false, error: ajeno };
    const u = await getUsuarioActual();
    return await registrarAdjunto(entrada, u?.email ?? null);
  } catch (e) {
    return fallo(e, 'No se pudo adjuntar.');
  }
}

/** Un link de vida corta para abrir UN adjunto (por su id, no por su ruta). Alcanza con ver la tab. */
export async function urlAdjuntoAction(id: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const no = await puedeVer();
    if (no) return { ok: false, error: no };
    return await urlAdjuntoEquipo(String(id ?? ''));
  } catch (e) {
    return fallo(e, 'No pude abrir el archivo.');
  }
}

/**
 * Las URLs de TODOS los adjuntos de una descripción, de una vez (`id → url`). Es lo que alimenta
 * el `urlDeAdjunto` del editor y de la vista previa.
 *
 * ⚠️ UNA ACTION PARA TODAS Y NO UNA POR IMAGEN: Next despacha las server actions DE A UNA (AGENTS.md,
 *    «los server actions se encolan»), así que diez imágenes serían diez viajes en fila.
 */
export async function urlsAdjuntosAction(ids: string[]): Promise<{ ok: true; urls: Record<string, string> } | { ok: false; error: string }> {
  try {
    const no = await puedeVer();
    if (no) return { ok: false, error: no };
    const lista = Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : [];
    return { ok: true, urls: await urlsAdjuntosEquipo(lista) };
  } catch (e) {
    return fallo(e, 'No pude abrir los archivos.');
  }
}
