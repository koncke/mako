'use server';

// =============================================================================
// /video-generator — conectar el navegador y probar que el circuito existe
// =============================================================================
// La prueba más chica que recorre TODO el camino: MaKo encola un `creditos`, la
// extensión lo toma, le pega a Google con la sesión del cliente y devuelve. Si
// eso vuelve con un número, el puente entero funciona.
//
// Se eligió `creditos` y no una generación a propósito: no gasta nada, es
// instantáneo, y contesta de paso la única pregunta que decide la economía del
// pipeline —cuántos créditos hay y en qué tier está la cuenta—, que hasta ahora
// solo se podía leer mirando la pantalla de Flow.

import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { crearTokenPuente, encolar, estadoPuente, type Puente } from '@/lib/flow-cola';
import { ENDPOINTS } from '@/lib/flow-protocolo';
import { getTenantDb } from '@/lib/workspace';

async function ctxAdmin(): Promise<{ ok: true; ws: number } | { ok: false; error: string }> {
  if ((await getRolWsEfectivo()) !== 'admin') {
    return { ok: false, error: 'Solo el administrador del workspace puede conectar el navegador.' };
  }
  const ws = await getWorkspaceActual();
  if (ws == null) return { ok: false, error: 'Sin workspace activo.' };
  return { ok: true, ws };
}

export type ConectarOut =
  | { ok: true; token: string }
  | { ok: false; error: string };

/**
 * Crea el código de conexión y lo devuelve EN CLARO una sola vez.
 *
 * Se guarda hasheado, así que no hay forma de volver a leerlo: si el cliente lo
 * pierde, se genera otro. Llamar a esto de nuevo ROTA el código y desconecta al
 * navegador anterior — que es lo correcto si se sospecha que se filtró.
 */
export async function conectarPuenteAction(etiqueta: string): Promise<ConectarOut> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;
  try {
    const { token } = await crearTokenPuente(etiqueta);
    return { ok: true, token };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export type PruebaOut =
  | { ok: true; trabajoId: number }
  | { ok: false; error: string };

/** Encola la prueba. No espera: el navegador la toma cuando pollea. */
export async function probarPuenteAction(): Promise<PruebaOut> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;
  try {
    const id = await encolar('creditos', { path: ENDPOINTS.creditos, body: {} });
    if (id == null) return { ok: false, error: 'No se pudo encolar la prueba.' };
    return { ok: true, trabajoId: id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export type EstadoPruebaOut = {
  puente: Puente;
  /** null = todavía nadie la tomó. */
  prueba: { estado: string; resultado: unknown; error: string; motivo: string } | null;
};

/**
 * Lo que la pantalla pregunta mientras espera.
 *
 * Devuelve el estado del puente Y el de la última prueba: sin los dos juntos, un
 * «no pasa nada» no distingue «el navegador no está conectado» de «está pero la
 * llamada falló», que son dos arreglos distintos.
 */
export async function estadoPruebaAction(trabajoId: number | null): Promise<EstadoPruebaOut> {
  const puente = await estadoPuente();
  if (trabajoId == null) return { puente, prueba: null };

  const db = await getTenantDb();
  const { data } = await db
    .from('flow_trabajos')
    .select('estado, resultado, error, motivo')
    .eq('id', trabajoId)
    .maybeSingle();

  return {
    puente,
    prueba: data
      ? {
        estado: String(data.estado ?? ''),
        resultado: data.resultado ?? null,
        error: String(data.error ?? ''),
        motivo: String(data.motivo ?? ''),
      }
      : null,
  };
}

/**
 * La segunda prueba: generar una IMAGEN de verdad.
 *
 * `creditos` prueba que el puente puede LEER. Esto prueba que puede ESCRIBIR, que
 * es lo que el producto necesita — y un circuito que solo lee no demuestra nada
 * sobre el que genera.
 *
 * Se eligió una imagen y no un clip porque en Flow las imágenes no consumen
 * créditos de video: la prueba de escritura sale gratis.
 *
 * ⚠️ El `body` va VACÍO a propósito. El cuerpo real lo arma la extensión copiando
 * el último `batchGenerateImages` que hizo la propia app de Flow y reemplazándole
 * el prompt. Armarlo acá sería volver a inventar un contrato de terceros, que es
 * lo que costó el 26/08 entero.
 */
export async function probarImagenAction(
  prompt: string,
): Promise<{ ok: true; trabajoId: number } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;

  const texto = prompt.trim();
  if (texto.length < 3) return { ok: false, error: 'Escribe qué imagen quieres generar.' };

  try {
    const id = await encolar('generar_imagen', { body: { prompt: texto.slice(0, 500) } });
    if (id == null) return { ok: false, error: 'No se pudo encolar la prueba.' };
    return { ok: true, trabajoId: id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'falló al encolar' };
  }
}

