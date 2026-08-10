// =============================================================================
// onboarding-orden — no se puede saltear un paso
// =============================================================================
// SIN 'server-only', a propósito: es la condición que impide cerrar un
// onboarding sin haberlo hecho, y una condición que ningún test puede importar
// termina siendo la única sin red. Mismo criterio que `exigirClienteDePrueba`
// (lib/auth-session.ts) y `lib/model-catalogo.ts`.
//
// El caso que la trajo, en vivo y con una clienta delante: el onboarding del
// Chatbot quedó `done` marcando `ensayo` y `aprobar` con diez segundos de
// diferencia, sin un solo audio grabado. `marcarPasoTab` aceptaba cualquier
// clave del def, así que marcar el último paso cerraba el recorrido entero — y
// con la tab en `done`, la pantalla muestra el dashboard vacío en vez del
// onboarding. La UI ya deshabilitaba «Siguiente» y aun así se llegó: esconder el
// botón no protege nada, el que decide es el server.

export type PasoOrden = { key: string; opcional?: boolean };

/**
 * El primer paso NO OPCIONAL que falta antes de `paso`, o `null` si se puede
 * marcar.
 *
 * Devuelve el PRIMERO que falta y no el más cercano: es lo que hace que el
 * mensaje mande al usuario al lugar donde tiene que ir. Los pasos `opcional` no
 * bloquean —para eso existe «Omitir por ahora»— y un paso que no está en la
 * lista no bloquea nada: eso lo rechaza el caller, que sí conoce el def.
 */
export function pasoBloqueadoPor(
  pasos: ReadonlyArray<PasoOrden>,
  steps: Record<string, { done?: boolean } | undefined>,
  paso: string,
): string | null {
  const i = pasos.findIndex((p) => p.key === paso);
  if (i <= 0) return null;
  return pasos.slice(0, i).find((p) => !p.opcional && !steps[p.key]?.done)?.key ?? null;
}
