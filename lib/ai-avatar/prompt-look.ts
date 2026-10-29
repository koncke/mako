// =============================================================================
// El prompt de un look: el preset + lo que la persona escribió en la barra
// =============================================================================
// La barra de Higgsfield («Describe the scene you imagine», 29/10/2026) deja escribir encima del preset: el preset pone
// la escena y lo escrito la ajusta («con una campera roja», «de noche»). Acá se arma el prompt que va a Flow.
//
// ⚠️ LO ESCRITO SE AGREGA AL FINAL, NUNCA REEMPLAZA. `promptFinal` (lib/flow-imagen.ts) devuelve el prompt VALIDADO de
//    un formato ENTERO cuando lo tiene ('selfie-movimiento': el auto), y deja afuera la escena: si lo escrito entrara
//    como escena, en «Charla en el auto» se perdería en silencio. Pegado al final, sobrevive en los dos caminos.
// ⚠️ Y NO ENTRA COMO `propio`: ése GANA SOBRE TODO y tira la identidad («mantén a la persona inalterada»), la luz y el
//    realismo. Un «con campera roja» generaría a otra persona.
//
// SIN `server-only`: es armado de texto y necesita test.

import { promptFinal } from '../flow-imagen';
import type { PlantillaAvatar } from './plantillas';

/** Hasta dónde se lee lo escrito: es un ajuste de la escena, no un guion. */
export const MAX_DETALLE = 300;

/** Lo escrito, limpio: sin saltos ni espacios de más, y cortado en `MAX_DETALLE`. */
export function limpiarDetalle(texto: unknown): string {
  return String(texto ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_DETALLE);
}

/** El prompt completo del look: el del preset (con la cara) y, al final, el ajuste de la persona. */
export function promptDelLook(plantilla: Pick<PlantillaAvatar, 'prompt' | 'puestaId'>, detalle?: string): string {
  const base = promptFinal(plantilla.prompt, { conCara: true, puestaId: plantilla.puestaId });
  const extra = limpiarDetalle(detalle);
  if (!extra) return base;
  return `${base}\n\nAJUSTES QUE PIDIÓ LA PERSONA (sin cambiar a la persona de la foto): ${extra}`;
}
