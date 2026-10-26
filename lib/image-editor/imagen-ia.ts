// =============================================================================
// image-editor/imagen-ia — crear o editar una imagen con la IA DEL NEGOCIO (server: sus claves y su gasto)
// =============================================================================
// Lo llaman la ruta del editor (/api/image-editor/imagen) y la API de MaKo (área `imagen`), siempre ADENTRO de
// `runWithWorkspace` del negocio. Las reglas (qué proveedor, medidas, leer la respuesta, los fallos en palabras) son de
// ./imagen-ia-reglas.ts, puro y con test; acá sólo lo que toca la base:
//   · LAS CLAVES SON LAS DEL NEGOCIO: `susClaves` (lib/ia-del-negocio.ts) dice cuáles son PROPIAS (una copia de la de la
//     plataforma no cuenta) y el valor sale de `credDelClienteEstricta`, que nunca cae al entorno de la plataforma y TIRA
//     si no pudo leer. Sin poder leer, no se llama (no se sabe si la clave es suya).
//   · EL GASTO SE ANOTA en el negocio que la pidió (`recordUsage`, como toda llamada de IA), y el fallo de SU clave en
//     «Tus cuentas de IA» (`anotarFalloDeSuClave`).
//   · NADA SE REINTENTA, ni acá ni en quien llama (ver la cabecera de las reglas).
// =============================================================================

import 'server-only';
import { recordUsage } from '../anthropic-usage';
import { credDelClienteEstricta } from '../credenciales';
import { susClaves } from '../ia-del-negocio';
import { anotarFalloDeSuClave } from '../su-clave';
import { getWorkspaceActual } from '../workspace';
import { generarConClaves, leerReferencia, type FalloImagen, type Imagen, type ProveedorImagen } from './imagen-ia-reglas';

/** La feature con que se anota el gasto (el panel de gasto de cada negocio la muestra con su motivo). */
export const FEATURE_IMAGEN_IA = 'image-editor-imagen';

export type ResultadoImagenIA =
  | { ok: true; imagen: Imagen; proveedor: ProveedorImagen; modelo: string }
  | { ok: false; error: string; link?: { texto: string; href: string }; deQuien: FalloImagen['deQuien'] | 'pedido'; status: number };

const STATUS: Record<FalloImagen['deQuien'], number> = { cuenta: 402, proveedor: 502, contenido: 422, mako: 502 };

/**
 * La imagen que pidió la persona (`referencia`: la data URL de la imagen a editar). Para el negocio de ESTE request; sin
 * workspace no hay a quién cobrarle, y no se llama.
 */
export async function generarImagen(p: { prompt: unknown; ancho: unknown; alto: unknown; referencia?: unknown; motivo?: string }): Promise<ResultadoImagenIA> {
  const prompt = typeof p.prompt === 'string' ? p.prompt.trim() : '';
  if (!prompt) return { ok: false, error: 'Falta describir la imagen.', deQuien: 'pedido', status: 400 };
  const medida = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 1 && x <= 20_000 ? x : null);
  const ancho = medida(p.ancho);
  const alto = medida(p.alto);
  if (!ancho || !alto) return { ok: false, error: 'Faltan las medidas de la imagen.', deQuien: 'pedido', status: 400 };
  let referencia: { mime: string; bytes: Uint8Array } | null = null;
  if (p.referencia !== undefined && p.referencia !== null) {
    const r = leerReferencia(p.referencia);
    if (!r.ok) return { ok: false, error: r.error, deQuien: 'pedido', status: 400 };
    referencia = r;
  }
  const ws = await getWorkspaceActual();
  if (ws == null) return { ok: false, error: 'Abre el editor desde un negocio.', deQuien: 'pedido', status: 409 };

  let g: Awaited<ReturnType<typeof generarConClaves>>;
  try {
    g = await generarConClaves({ prompt, ancho, alto, referencia }, {
      claves: () => susClaves(ws),
      valorDe: (clave) => credDelClienteEstricta(clave, ws, { ilegibleTira: true }),
      fetch: (...a) => fetch(...a),
    });
  } catch (e) {
    console.error(`[image-editor:imagen] ws=${ws}: no pude leer las claves del negocio: ${e instanceof Error ? e.message : String(e)}`);
    return { ok: false, error: 'No pude leer tus claves de IA en este momento (no es tu clave). Prueba de nuevo en un rato; si se repite, repórtalo a Soporte.', deQuien: 'mako', status: 503 };
  }
  const motivo = (p.motivo ?? (referencia ? 'Editar una imagen (Image Editor)' : 'Crear una imagen (Image Editor)')).slice(0, 200);
  if (!g.ok) {
    console.warn(`[image-editor:imagen] ws=${ws} ${g.proveedor ?? '-'} ${g.modelo ?? ''}: ${g.fallo.texto}`);
    if (g.fallo.deQuien === 'cuenta' && g.proveedor && g.fallo.salio) {
      await anotarFalloDeSuClave({ proveedor: g.proveedor, error: g.fallo.texto, feature: FEATURE_IMAGEN_IA, modelo: g.modelo ?? null });
    }
    return { ok: false, error: g.fallo.texto, ...(g.fallo.link ? { link: g.fallo.link } : {}), deQuien: g.fallo.deQuien, status: STATUS[g.fallo.deQuien] };
  }
  // Best-effort, como todo `recordUsage`: si la fila no queda, la imagen igual es de la persona.
  await recordUsage(FEATURE_IMAGEN_IA, g.modelo, g.uso, motivo, g.proveedor, undefined, ws).catch(() => undefined);
  return { ok: true, imagen: g.imagen, proveedor: g.proveedor, modelo: g.modelo };
}
