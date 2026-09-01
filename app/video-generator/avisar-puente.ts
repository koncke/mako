// =============================================================================
// «Hay trabajo»: despertar al puente en vez de esperar a que se despierte solo
// =============================================================================
// ── Qué problema cierra ────────────────────────────────────────────────────
// La extensión pregunta por trabajo con una alarma de Chrome cada 15 s (y en una
// extensión empaquetada, Chrome puede subir ese mínimo a 30). Todo lo que MaKo
// encola espera a esa alarma, así que apretar «Generar» costaba hasta medio
// minuto de loader sobre un trabajo que ya estaba encolado y listo para empezar.
//
// Medido en producción sobre 348 trabajos: la mediana esperaba 13,6 s en la cola
// antes de que alguien la tomara —la mitad de un latido, que es exactamente lo
// que predice esperar a una alarma— y las consultas de estado llegaban a un p90
// de 357 s. El dueño lo dijo así: «en Flow se genera rápido… es nuestro problema».
//
// ── Cómo viaja ─────────────────────────────────────────────────────────────
//   esta función ──evento del DOM──▶ extension/mako-puente.js (content script)
//                                      │  chrome.runtime.sendMessage
//                                      ▼
//                                    background.js → ciclo()
//
// Por el DOM y no por `externally_connectable`, igual que el emparejado y por la
// misma razón: ese mecanismo necesita el ID de la extensión, y el ID cambia al
// publicarse en la tienda.
//
// ── Por qué es seguro llamarla de más ──────────────────────────────────────
// No adelanta ninguna llamada a Google: lo único que hace `ciclo()` es lo que ya
// hacía cada 15 s —preguntarle a NUESTRO servidor si hay trabajo de este
// navegador—. El `cooldownMs` que separa cada llamada a Flow, que es la guarda
// real contra el bloqueo de la sesión, no se toca. Y hay dos frenos más: el
// `corriendo` del service worker, que ignora un aviso con un ciclo en curso, y
// un estrangulador de 1,5 s en el content script para la pantalla que encola
// siete tomas en el mismo tick.
//
// Si la extensión no está instalada no escucha nadie y el evento se pierde, que
// es el comportamiento correcto: esto ACELERA el camino, no es parte de él.

/** Le avisa al puente que hay algo encolado. No falla nunca. */
export function avisarPuente(): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('MAKO_PUENTE_HAY_TRABAJO'));
  } catch {
    // Un navegador que no puede despachar un evento igual tiene la alarma.
  }
}
