// =============================================================================
// crm-curso-al-ganar-reglas — cuándo MaKo invita SOLO al curso (puro)
// =============================================================================
// Pedido de Martín (07/10/2026, por la sesión de Customer Success): «poder automatizar la
// invitación al curso cuando un lead cae a Ganado, así no se tiene que estar invitando
// manualmente... Pero que sea opcional, activar esa automatización».
//
// Acá están las reglas, sin base, para que un test las EJECUTE
// (tests/crm-curso-al-ganar.test.ts). El envío vive en lib/crm-curso-al-ganar.ts.
//
// Sin 'use client' ni 'server-only': lo leen el server y el tablero.
// =============================================================================

/**
 * El setting (por workspace) con los EMBUDOS que invitan solos al ganar. Ausente = ninguno.
 *
 * ⚠️ ES UNA LISTA DE PRENDIDOS, NO DE APAGADOS: lo que no está, no invita. Un mail al cliente
 * que sale solo es exactamente lo que no puede nacer prendido —cada movimiento a Ganado de cada
 * cliente sería un mail—, así que el default tiene que ser «no» sin que nadie lo escriba.
 *
 * ⚠️ Y CUELGA DEL EMBUDO (el «producto» del CRM), con su id REAL: el del negocio también va con
 * su id, aunque en `leads.funnel_id` se escriba NULL (lib/lead-funnel-reglas.ts). Una lista con
 * `null` adentro no se podría leer con la misma regla que las demás.
 */
export const CURSO_AL_GANAR_KEY = 'crm.curso_al_ganar';

/** Tope contra un setting corrompido; muy por encima de cualquier catálogo real (el que más tiene, tres). */
const MAX = 50;

const idFila = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

/** Los embudos prendidos. Ilegible = ninguno: ante la duda, no se le escribe a nadie. */
export function parsearCursoAlGanar(crudo: string | null | undefined): number[] {
  if (!crudo?.trim()) return [];
  let lista: unknown;
  try { lista = JSON.parse(crudo); } catch { return []; }
  const out: number[] = [];
  for (const x of Array.isArray(lista) ? lista : []) {
    const n = idFila(x);
    if (n != null && !out.includes(n)) out.push(n);
  }
  return out.slice(0, MAX);
}

/** Prende o apaga UN embudo sin tocar los otros. */
export function conCursoAlGanar(actuales: readonly number[], funnelId: number, prendido: boolean): number[] {
  const sin = actuales.filter((x) => x !== funnelId);
  return (prendido ? [...sin, funnelId] : sin).slice(0, MAX);
}

/**
 * ¿Este guardado lo hizo GANAR? Sólo la TRANSICIÓN: un lead que ya era ganado y se vuelve a
 * guardar (una cuota, una nota, el deshacer de otro campo) no es una venta nueva, y tratarlo
 * como tal le mandaría el mail en cada edición de su ficha.
 */
export const pasaAGanado = (antes: string | null | undefined, despues: string | null | undefined): boolean =>
  antes !== 'ganado' && despues === 'ganado';

/**
 * Lo que contesta la invitación sin sesión de Customer Success (`invitarAlCursoSinSesion`,
 * lib/curso-invitar.ts). Se repite la FORMA y no se importa el tipo: este módulo es puro y lo
 * importan el tablero y los tests, y aquél es `server-only`.
 */
export type ResultadoInvitacionCurso =
  | { ok: true; enviado: boolean; motivo?: string }
  | { ok: false; error: string };

/** Cómo dice cada motivo de Customer Success la ficha del lead. Corto: es una línea del historial. */
const POR_QUE_NO: Record<string, string> = {
  'ya-invitado': 'ya estaba invitado',
  // Customer Success lo suma (08/10): entró con un link copiado a mano, así que tiene acceso y lo usa.
  'ya-entro': 'ya entró al curso',
  'sin-email': 'no tiene email',
  'sin-clases': 'sus productos no tienen clases',
  cortado: 'su acceso está cortado',
  'no-ganado': 'no está ganado en su producto principal',
};

/**
 * La línea del historial de la ficha (actor MaKo) para lo que pasó con la invitación automática.
 *
 * ⚠️ SIEMPRE HAY LÍNEA. Con el interruptor prendido, «no la mandó porque ya estaba invitado» y
 * «no corrió» se verían iguales en la ficha, y la pregunta de Customer Success es justo ésa.
 * ⚠️ Y UN MOTIVO NUEVO NO SE CALLA: si Customer Success agrega uno, sale con su clave hasta que
 * se le escriba la frase.
 */
export function lineaDelCurso(r: ResultadoInvitacionCurso): string {
  if (!r.ok) return `No lo invité al curso: ${r.error}`.slice(0, 200);
  if (r.enviado) return 'Lo invité al curso por email';
  return `No lo invité al curso: ${POR_QUE_NO[r.motivo ?? ''] ?? r.motivo ?? 'sin motivo'}`;
}
