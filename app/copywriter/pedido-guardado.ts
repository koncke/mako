// =============================================================================
// El primer pedido de un guion recién creado: viaja de la caja del inicio al chat de MaKo del guion nuevo
// =============================================================================
// La caja grande del inicio (./Inicio.tsx) crea el guion y NAVEGA a él: lo escrito tiene que llegar al chat del otro lado
// sin pasar por la URL (un pedido largo, con datos del negocio, no va en una query: AGENTS.md). Va a `sessionStorage`
// con el NEGOCIO en la clave (AGENTS.md, «Lo que se guarda en el NAVEGADOR lleva el workspace en la clave»: el super
// admin abre varios negocios en pestañas) y se TOMA una sola vez: leerlo lo borra.
// Sin 'use client': no usa React. Todo acceso va con try/catch (una ventana privada puede no tener almacenamiento).
// =============================================================================

const clave = (ws: number | null, id: string) => `copywriter:pedido:${ws ?? 'sin'}:${id}`;

export function guardarPedido(ws: number | null, id: string, texto: string): boolean {
  if (!texto.trim()) return false;
  try { window.sessionStorage.setItem(clave(ws, id), texto.slice(0, 2_000)); return true; } catch { return false; }
}

/**
 * Las páginas recién creadas EN ESTA PESTAÑA (13/11/2026, medido en producción: elegir una plantilla tardaba 2 s hasta la pregunta
 * de MaKo, y 0,4 de eso era leer un chat que todavía no existe). En memoria y no en el navegador: recargar la página la lee como
 * siempre. Se toma una vez.
 */
const RECIEN_CREADAS = new Set<string>();
export function marcarRecienCreada(id: string): void { RECIEN_CREADAS.add(id); }
export function esRecienCreada(id: string): boolean { return RECIEN_CREADAS.delete(id); }

export function tomarPedido(ws: number | null, id: string): string | null {
  try {
    const k = clave(ws, id);
    const v = window.sessionStorage.getItem(k);
    if (v != null) window.sessionStorage.removeItem(k);
    return v && v.trim() ? v : null;
  } catch {
    return null;
  }
}
