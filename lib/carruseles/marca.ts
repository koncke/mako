// =============================================================================
// carruseles/marca — con qué nombre firma el negocio sus carruseles (la cabecera de cada lámina)
// =============================================================================
// El nombre del negocio (su workspace) y sus iniciales. El @ de Instagram del negocio NO se guarda en ningún lado de MaKo, pero
// la cuenta que conectó por Zernio SÍ lo trae (19/11/2026, `usuarioDeInstagram`): sin ella va null, la cabecera lleva el nombre
// y la persona le suma su @ en el editor. Nunca se inventa. Sin nombre (no se pudo leer), «Tu negocio»: es la guía de dónde va.
// =============================================================================

import 'server-only';
import { getWorkspace } from '../workspace';
import type { Marca } from './documento';
import { logoDeKit, usuarioDeLasCuentas } from './marca-kit';
import type { KitMarca } from '../marca/kits';

/** El nombre del negocio `ws`, o null si no se pudo leer (la pantalla lo pasa a las miniaturas: ../../app/image-editor). */
export async function nombreDelNegocio(ws: number | null): Promise<string | null> {
  if (ws == null) return null;
  const w = await getWorkspace(ws).catch(() => null);
  return typeof w?.nombre === 'string' && w.nombre.trim() ? w.nombre.trim() : null;
}

/**
 * Cuánto se espera a Zernio por el @. ⚠️ Con 3 s se cortaba (19/11/2026: la primera lista de cuentas del ws 9 tardó 3,7 s y el @
 * no llegó); la réplica lo pide AL ARRANCAR (`usuarioDeInstagram` en ./replica-servidor.ts), en paralelo con las láminas, así que
 * esperar más no la demora.
 */
const ESPERA_ZERNIO_MS = 8_000;
const DURA_EL_ARROBA_MS = 10 * 60_000;
/** La consulta EN CURSO se guarda (no sólo la respuesta): pedirlo al arrancar y otra vez al armar la marca es UNA consulta. */
const arrobas = new Map<number, { usuario: Promise<string | null>; hasta: number }>();

async function consultarArroba(ws: number): Promise<string | null> {
  try {
    const { conexionesViaZernio } = await import('../zernio-conectar');
    let reloj: ReturnType<typeof setTimeout> | undefined;
    const tarde = new Promise<null>((ok) => { reloj = setTimeout(() => ok(null), ESPERA_ZERNIO_MS); });
    const cuentas = await Promise.race([conexionesViaZernio(ws, 'instagram'), tarde]).finally(() => clearTimeout(reloj));
    // Tardó: no se recuerda el «no», la próxima vuelve a preguntar.
    if (cuentas === null) { arrobas.delete(ws); return null; }
    return usuarioDeLasCuentas(cuentas);
  } catch {
    // Sin clave de Zernio (la mayoría) o sin red: sin @, como siempre.
    return null;
  }
}

/** El @ de la cuenta de Instagram que el negocio conectó por Zernio, o null (no conectó, no se pudo leer o tardó). Nunca tira. */
export function usuarioDeInstagram(ws: number): Promise<string | null> {
  const ya = arrobas.get(ws);
  if (ya && ya.hasta > Date.now()) return ya.usuario;
  const usuario = consultarArroba(ws);
  arrobas.set(ws, { usuario, hasta: Date.now() + DURA_EL_ARROBA_MS });
  return usuario;
}

/** Con el logo del kit de marca, si lo tiene (`kit`: el que se va a usar; lib/marca/kits.ts), y su @ de Instagram si lo conectó. */
export async function marcaDelNegocio(ws: number, kit: KitMarca | null = null): Promise<Marca> {
  const [nombre, usuario] = await Promise.all([nombreDelNegocio(ws), usuarioDeInstagram(ws)]);
  return { nombre: nombre ?? 'Tu negocio', usuario, logo: logoDeKit(kit) };
}
