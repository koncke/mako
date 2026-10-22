// =============================================================================
// goteo — los WhatsApp de UNA automatización, de a uno y con tope (puro)
// =============================================================================
// La llamada con Mauricio del 22/10/2026 (01:51-02:16): «al pasar 50 leads a "Prospección activa", que no salgan
// juntos: envía uno, tal vez espera 4 minutos o 5, envía el otro». Configurable por automatización: minutos entre
// envíos y tope por día (los días de la semana son los de su horario propio, lib/config-automatizacion.ts).
//
// ⚠️ ES UN SUB-TOPE ADENTRO DEL DE LA LÍNEA, nunca uno más alto (decisión del Cerebro): el motor lo mira además del
// cupo del negocio (`sinLugar`, lib/nutricion.ts). Cuenta sólo los WhatsApp que SALIERON de esta automatización
// (`nutricion_envios` 'enviado', en 24 h móviles, como el tope de la línea).
//
// ⚠️ Y LO FRENADO SE CORRE A SU TURNO, no se deja vencido: el tick de cada minuto mira sólo lo que venció hace menos de
// `VENTANA_FRESCA_MIN` (lib/espera-duracion.ts). Si los 49 que esperan quedaran con la hora vieja, sólo los vería la
// corrida de cada HORA: el goteo de 5 minutos saldría de a uno por hora. Cada fila frenada pasa a su turno
// (`turnoDeGoteo`): el siguiente lugar libre más `minutos` por cada una que ya está delante en esta corrida.
// =============================================================================

export type Goteo = { minutos?: number; dia?: number };

/** Lo que salió de esta automatización por WhatsApp en las últimas 24 h. */
export type UsoGoteo = { enviados: number; ultimoMs: number | null; primeroMs: number | null };

export const SIN_USO: UsoGoteo = { enviados: 0, ultimoMs: null, primeroMs: null };

const DIA_MS = 86_400_000;

/**
 * ¿El goteo frena el próximo WhatsApp de esta automatización? Si frena, `desdeMs` es cuándo se libera el lugar: con el
 * tope del día cumplido, cuando sale de la ventana de 24 h el más viejo; si no, `minutos` después del último.
 */
export function frenoDeGoteo(g: Goteo | null | undefined, uso: UsoGoteo, ahoraMs: number): { frena: false } | { frena: true; desdeMs: number; motivo: 'dia' | 'minutos' } {
  if (!g) return { frena: false };
  if (g.dia != null && uso.enviados >= g.dia) {
    const desdeMs = uso.primeroMs != null ? uso.primeroMs + DIA_MS : ahoraMs + DIA_MS;
    return { frena: true, desdeMs: Math.max(desdeMs, ahoraMs), motivo: 'dia' };
  }
  if (g.minutos != null && uso.ultimoMs != null) {
    const desdeMs = uso.ultimoMs + g.minutos * 60_000;
    if (desdeMs > ahoraMs) return { frena: true, desdeMs, motivo: 'minutos' };
  }
  return { frena: false };
}

/** El turno de la fila frenada número `k` (0 = la primera) de una automatización en esta corrida. */
export function turnoDeGoteo(desdeMs: number, k: number, g: Goteo): number {
  return desdeMs + Math.max(0, k) * (g.minutos ?? 0) * 60_000;
}

/** Lo que salió (en esta corrida) se suma al uso: un envío más, y el último es ahora. */
export function conEnvio(uso: UsoGoteo, ahoraMs: number): UsoGoteo {
  return { enviados: uso.enviados + 1, ultimoMs: ahoraMs, primeroMs: uso.primeroMs ?? ahoraMs };
}

/** Cómo se dice el goteo (la pantalla y la API de MaKo). */
export function textoDeGoteo(g: Goteo | null | undefined): string {
  if (!g || (g.minutos == null && g.dia == null)) return 'sin goteo: sale todo lo que deje el tope de la línea';
  const partes = [g.minutos != null ? `uno cada ${g.minutos} min` : '', g.dia != null ? `hasta ${g.dia} por día` : ''].filter(Boolean);
  return `${partes.join(', ')}, dentro del tope de la línea`;
}
