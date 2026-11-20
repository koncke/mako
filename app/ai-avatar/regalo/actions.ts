'use server';

// =============================================================================
// El clip de 10 s que el reto regala el día 6: las dos llamadas de la tarjeta (20/11/2026)
// =============================================================================
// La tarjeta del día 6 (el chat del reto) llama:
//   · `clipDeRegaloAction()` al abrirse y cada ~10 s mientras diga «generando»: cómo va, y si terminó, lo termina (lo baja,
//     lo deja en el historial de videos y anota lo que costó). Una vuelta por llamada.
//   · `pedirClipDeRegaloAction({ frase })` con el botón: la frase es lo que dice su personaje (el gancho de su guion, hasta
//     25 palabras). Una vez por prueba; si el generador falló o no tenía saldo, la tarjeta puede volver a pedirlo.
// Las dos contestan `{ ok: true, clip }` (el estado para dibujar, lib/reto/clip-regalo-reglas.ts `ClipRegalo`) o
// `{ ok: false, error }` (una frase para la persona). El camino entero está en ./clip.ts.
// =============================================================================

import { avanzarClipRegalo, pedirClipRegalo, type SalidaClip } from './clip';

/** Cómo va el clip de regalo del reto (y lo termina si ya salió). */
export async function clipDeRegaloAction(): Promise<SalidaClip> {
  return avanzarClipRegalo();
}

/** Pide el clip de regalo del reto: 10 s de su personaje (o su foto) diciendo `frase`. */
export async function pedirClipDeRegaloAction(input: { frase: string }): Promise<SalidaClip> {
  return pedirClipRegalo({ frase: input?.frase });
}
