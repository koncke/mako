// =============================================================================
// Un guion de Copywriting que viaja a otra función de MaKo (AI Avatar): «Hacerlo con tu avatar IA» (13/11/2026)
// =============================================================================
// Martín, en la llamada con Leila: después de replicar un guion, un botón lo lleva a la función que lo convierte (enlazar, no
// hacer algo aparte). El guion no va en la URL (un texto largo, con datos del negocio: AGENTS.md); va a `sessionStorage`, con el
// NEGOCIO en la clave (el super admin abre varios negocios en pestañas). Lo LEE el proyecto que lo usa y lo SUELTA cuando ya
// se usó (así cambiar de avatar antes de animarlo no lo pierde).
// Sin 'use client' y sin React: todo acceso va con try/catch (una ventana privada puede no tener almacenamiento).
// =============================================================================

export type DestinoGuion = 'avatar';

const clave = (destino: DestinoGuion, ws: number | null) => `mako:guion-para:${destino}:${ws ?? 'sin'}`;
/** Lo que entra en el guion de un video de avatar (un minuto y medio dicho, con margen). */
export const TOPE_GUION_PASADO = 4_000;

export function pasarGuion(destino: DestinoGuion, ws: number | null, texto: string): boolean {
  const t = texto.trim().slice(0, TOPE_GUION_PASADO);
  if (!t) return false;
  try { window.sessionStorage.setItem(clave(destino, ws), t); return true; } catch { return false; }
}

export function verGuionPasado(destino: DestinoGuion, ws: number | null): string | null {
  try {
    const v = window.sessionStorage.getItem(clave(destino, ws));
    return v && v.trim() ? v : null;
  } catch {
    return null;
  }
}

export function soltarGuionPasado(destino: DestinoGuion, ws: number | null): void {
  try { window.sessionStorage.removeItem(clave(destino, ws)); } catch { /* sin almacenamiento: no había nada */ }
}
