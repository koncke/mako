// =============================================================================
// apaisar — girar el teléfono para mirar el grafo (17/10/2026)
// =============================================================================
// Martín, desde su Android: «tal vez en mobile que se vea volteada la pantalla por default». El grafo es ancho (la nube y
// una barra lateral al costado), y en vertical un teléfono sólo da 360 px de ancho.
//
// QUÉ ANDA EN CHROME DE ANDROID: `screen.orientation.lock('landscape')` SÓLO funciona en pantalla completa (si no, rechaza
// con SecurityError), y la pantalla completa pide un TOQUE de la persona (una activación de usuario). Por eso esto se llama
// desde un botón, nunca al montar. Y pisa el bloqueo de rotación automática del sistema: un teléfono con la rotación
// apagada también gira, porque una app que pide una orientación explícita manda sobre el ajuste de la persona.
//
// QUÉ NO ANDA: iOS (Safari no tiene `orientation.lock` y en iPhone `requestFullscreen` no existe para un <div>). Ahí no
// se gira nada y la barra lateral queda como hoja desde abajo (el layout vertical del grafo): no se dibuja el lienzo
// rotado con CSS, porque el paneo y el pellizco del lienzo calculan con los ejes de la pantalla (Grafo.tsx → `escala`).
//
// ⚠️ Es una lista de «lo que se intentó», no un permiso: cualquiera de los dos pasos puede fallar sin ruido (el usuario
//    rechazó la pantalla completa, el navegador no gira). El resultado dice qué pasó para que quien llama decida si
//    sigue ofreciendo el botón.
// =============================================================================

export type Resultado = 'apaisada' | 'completa' | 'nada';

type OrientacionLike = { lock?: (o: 'landscape') => Promise<void>; unlock?: () => void };
type PantallaLike = { orientation?: OrientacionLike };
type DocumentoLike = { fullscreenElement: Element | null };
type ElementoLike = { requestFullscreen?: (o?: { navigationUI?: 'hide' | 'show' | 'auto' }) => Promise<void> };

/** Pantalla completa + horizontal. Se llama desde un toque. `apaisada` = girado; `completa` = sólo pantalla completa
 *  (el navegador no deja girar); `nada` = ni una ni otra. */
export async function apaisar(
  el: ElementoLike,
  doc: DocumentoLike = document,
  pantalla: PantallaLike = screen as unknown as PantallaLike,
): Promise<Resultado> {
  let completa = !!doc.fullscreenElement;
  if (!completa && el.requestFullscreen) {
    try { await el.requestFullscreen({ navigationUI: 'hide' }); completa = true; } catch { /* no dejó: se intenta girar igual */ }
  }
  const o = pantalla.orientation;
  if (!o?.lock) return completa ? 'completa' : 'nada';
  try {
    await o.lock('landscape');
    return 'apaisada';
  } catch {
    return completa ? 'completa' : 'nada';
  }
}

/** Devuelve la rotación al sistema. Siempre seguro: sin soporte, o sin nada bloqueado, no hace nada. */
export function soltarApaisado(pantalla: PantallaLike = screen as unknown as PantallaLike): void {
  try { pantalla.orientation?.unlock?.(); } catch { /* nada que soltar */ }
}
