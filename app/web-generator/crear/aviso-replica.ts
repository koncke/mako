// =============================================================================
// crear/aviso-replica — la línea del resultado de Replicar, en el editor de la copia que se abre (tanda 8)
// =============================================================================
// Decidido el 15/10/2026 (`landing-replicar-scroll`): al replicar una web con efectos atados al scroll que la copia
// no trae, UNA línea corta donde la persona lee el resultado. Replicar no tiene pantalla de resultado: si sale bien,
// abre el editor de la copia (navegación DURA, `irDuro`). Así que la línea viaja al editor por sessionStorage y el
// editor la muestra UNA vez al abrir esa copia (EditorLanding.tsx, su aviso).
//   · Nunca en la URL: un F5 o un link copiado la volverían a mostrar (la regla de lo que se usa una vez).
//   · Atada al id de la copia: abrir otra landing no la consume.
//   · Se consume en un efecto con un ref, nunca en el inicializador de useState/useRef (el modo estricto corre dos
//     veces y la segunda lo encuentra vacío: docs/hallazgos-editor-landing.md, «La pantalla y el Diagnóstico»).
// Sin sessionStorage (modo privado estricto), no se ve: la copia igual quedó creada.
// =============================================================================

const CLAVE = 'mk-aviso-replica';
/** Lo que se acepta de vuelta (la línea es corta; más es otra cosa). */
const MAX_TEXTO = 200;

/** Deja la línea para el editor de la copia `id`, que se abre a continuación. */
export function dejarAvisoDeReplica(id: number, texto: string): void {
  try { window.sessionStorage.setItem(CLAVE, JSON.stringify({ id, texto: String(texto).slice(0, MAX_TEXTO) })); } catch { /* sin sessionStorage: no se ve */ }
}

/** La línea que dejó Replicar para ESTA copia (y se borra), o null. */
export function tomarAvisoDeReplica(id: number): string | null {
  try {
    const crudo = window.sessionStorage.getItem(CLAVE);
    if (!crudo) return null;
    const v = JSON.parse(crudo) as { id?: unknown; texto?: unknown } | null;
    if (!v || v.id !== id) return null;
    window.sessionStorage.removeItem(CLAVE);
    return typeof v.texto === 'string' && v.texto.trim() ? v.texto.slice(0, MAX_TEXTO) : null;
  } catch {
    return null;
  }
}
