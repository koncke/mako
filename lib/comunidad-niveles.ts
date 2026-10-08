// =============================================================================
// comunidad-niveles — los 9 niveles de la comunidad (puntos → nivel), como Skool
// =============================================================================
// Pedido de Martín (07/10/2026, item 10 del curso tipo Skool): «una nueva tab dentro del desplegable
// de la sidebar de Customer Success, que sea Comunidad, replica lo que tiene skool tal cual». El
// diseño y sus contratos están en docs/diseno-curso-skool.md (D8); el relevo de Skool que lo sostiene
// dice: 1 like recibido = 1 punto, 9 niveles, y estos umbrales EXACTOS (help.skool.com, artículo 31).
//
// Sin 'use client' ni 'server-only' a propósito: lo usan la comunidad del equipo, la del alumno, el
// bloqueo por nivel del curso (lib/curso-bloqueo.ts, otra pista) y un test que lo EJECUTA
// (tests/comunidad-niveles.test.ts). Acá no se lee ni se escribe nada.
//
// ⚠️ LOS UMBRALES SON LOS DE SKOOL, NO UNA ESCALA NUESTRA. Son raros a propósito (2.015, 8.015,
//    33.015): la curva es lo que hace que el nivel 2 llegue rápido y el 9 sea casi imposible. Un
//    «redondeo» a 2.000 cambia el nivel de quien está justo en el borde, y el nivel abre clases del
//    curso — o sea que un número prolijo le cerraría a alguien una clase que ya tenía.

/** Cuántos puntos hacen falta para LLEGAR a cada nivel. El índice 0 es el nivel 1. */
export const UMBRALES_NIVEL: readonly number[] = Object.freeze([0, 5, 20, 65, 155, 515, 2015, 8015, 33015]);

/** El nivel más alto. Oficialmente 9 (el «nivel 10» de los foros no tiene respaldo). */
export const NIVEL_MAX = UMBRALES_NIVEL.length;

/** Un conteo de puntos que llega de afuera: entero, no negativo. Lo raro cuenta como cero. */
function puntosLimpios(p: unknown): number {
  const n = typeof p === 'number' ? p : Number(p);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** El nivel (1-9) que corresponde a estos puntos. El umbral es INCLUSIVO: 5 puntos ya es nivel 2. */
export function nivelDe(puntos: unknown): number {
  const p = puntosLimpios(puntos);
  let nivel = 1;
  for (let i = 0; i < UMBRALES_NIVEL.length; i++) if (p >= UMBRALES_NIVEL[i]) nivel = i + 1;
  return nivel;
}

/**
 * Cuántos puntos le faltan para subir al nivel siguiente. `null` en el nivel 9: ahí no hay
 * «X puntos para subir», y un 0 se leería como «ya subís».
 */
export function puntosParaSubir(puntos: unknown): number | null {
  const p = puntosLimpios(puntos);
  const n = nivelDe(p);
  if (n >= NIVEL_MAX) return null;
  return UMBRALES_NIVEL[n] - p;
}

// ── Los nombres de los niveles (los edita el equipo) ─────────────────────────────

/** Tope del nombre de un nivel. El de Skool no está documentado; 30 es el de las categorías. */
export const TOPE_NOMBRE_NIVEL = 30;

/** El nombre que tiene un nivel cuando nadie lo cambió. */
export const nombreNivelDefault = (nivel: number): string => `Nivel ${nivel}`;

/**
 * Los 9 nombres como se GUARDAN: un string por nivel, `''` = el de siempre. Lo que llega del
 * navegador se recorta, se le sacan los saltos de línea y se topea; lo que sobra (más de 9) se tira.
 *
 * ⚠️ VACÍO NO ES «Nivel N» ESCRITO. Se guarda `''` para que el default siga siendo el default: si se
 *    guardara el texto, el día que el default cambie (otro idioma, otra palabra) quedarían viejos.
 */
export function sanearNombresNivel(raw: unknown): string[] {
  const lista = Array.isArray(raw) ? raw : [];
  const out: string[] = [];
  for (let i = 0; i < NIVEL_MAX; i++) {
    const v = lista[i];
    const s = typeof v === 'string' ? v.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim() : '';
    out.push(s.slice(0, TOPE_NOMBRE_NIVEL));
  }
  return out;
}

/** El nombre que se DIBUJA para un nivel: el que eligió el equipo, o «Nivel N». */
export function nombreDeNivel(nombres: readonly string[] | null | undefined, nivel: number): string {
  const n = Math.min(NIVEL_MAX, Math.max(1, Math.floor(nivel) || 1));
  const elegido = (nombres?.[n - 1] ?? '').trim();
  return elegido || nombreNivelDefault(n);
}

/**
 * El rótulo de un nivel en pantalla: «Nivel 3» si nadie le puso nombre, «Nivel 3 · Sargento» si sí.
 * Sin esto, un nivel sin nombre se dibujaba «Nivel 3 · Nivel 3».
 */
export function rotuloNivel(nivel: number, nombres: readonly string[] | null | undefined): string {
  const n = Math.min(NIVEL_MAX, Math.max(1, Math.floor(nivel) || 1));
  const elegido = (nombres?.[n - 1] ?? '').trim();
  return elegido ? `${nombreNivelDefault(n)} · ${elegido}` : nombreNivelDefault(n);
}

// ── Cuántos miembros hay en cada nivel ───────────────────────────────────────────

export type NivelDistribucion = { nivel: number; cantidad: number; pct: number };

/**
 * El «% de miembros en cada nivel» de la pantalla de Leaderboards. Recibe los puntos TOTALES de cada
 * miembro (un miembro sin likes trae 0 y cuenta en el nivel 1: es un miembro, no un hueco).
 *
 * El % se redondea por nivel, así que la suma puede dar 99 o 101: se muestra el de cada nivel, no
 * un total. Sin miembros, todos dicen 0 % (no `NaN`).
 */
export function distribucionDeNiveles(puntosDeCadaMiembro: readonly number[]): NivelDistribucion[] {
  const cuenta = new Array(NIVEL_MAX).fill(0) as number[];
  for (const p of puntosDeCadaMiembro) cuenta[nivelDe(p) - 1]++;
  const total = puntosDeCadaMiembro.length;
  return cuenta.map((cantidad, i) => ({
    nivel: i + 1,
    cantidad,
    pct: total ? Math.round((cantidad / total) * 100) : 0,
  }));
}
