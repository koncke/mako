// =============================================================================
// chat-discutir — lo que contesta un chat de editor en «Discutir»: TEXTO, nunca operaciones
// =============================================================================
// «Discutir | Editar» (app/_chat/SelectorIntencion.tsx) en los chats que editan lo abierto: con «Discutir» el modelo
// contesta y sugiere sobre lo abierto, y el código descarta cualquier operación que mande (el modo no cambia nada). Lo
// usan el chat del Image Editor (lib/image-editor/chat/catalogo.ts → salidaDeDiscutir) y el del Video Editor
// (lib/editor-video/chat-catalogo.ts → salidaDeDiscutir), con su propio tipo de operación.
//
// Puro y sin `server-only`: lo leen las rutas de la IA y los tests.
// =============================================================================

/** Lo más largo que se muestra de una respuesta de «Discutir». */
export const TOPE_DISCUTIR = 1_500;

/**
 * Lo que contestó el modelo, como texto plano y corto. Si igual armó un JSON (con operaciones o sin ellas), se usa sólo
 * su texto (`respuesta`, `resumen` o `texto`); las operaciones no salen de acá.
 */
export function textoDeDiscutir(salida: unknown, tope: number = TOPE_DISCUTIR): string {
  let t = typeof salida === 'string' ? salida.trim() : '';
  t = t.replace(/^```(?:json|text)?\s*/i, '').replace(/\s*```$/, '').trim();
  if (t.startsWith('{')) {
    try {
      const o = JSON.parse(t) as Record<string, unknown>;
      const texto = [o.respuesta, o.resumen, o.texto].find((x) => typeof x === 'string' && x.trim());
      t = typeof texto === 'string' ? texto.trim() : '';
    } catch { /* no era JSON: va como texto */ }
  }
  return t.slice(0, tope);
}
