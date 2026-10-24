// =============================================================================
// goteo — los WhatsApp de UNA automatización, de a uno y con tope (puro)
// =============================================================================
// La llamada con Mauricio del 22/10/2026 (01:51-02:16): «al pasar 50 leads a "Prospección activa", que no salgan
// juntos: envía uno, tal vez espera 4 minutos o 5, envía el otro». Configurable por automatización: minutos entre
// envíos y tope por día (los días de la semana son los de su horario propio, lib/config-automatizacion.ts).
//
// ⚠️ ES UN SUB-TOPE ADENTRO DEL DE LA LÍNEA, nunca uno más alto (decisión del Cerebro): el motor lo mira además del
// cupo del negocio (`sinLugar`, lib/nutricion.ts). Cuenta los WhatsApp de esta automatización en 24 h móviles, como el
// tope de la línea: los que SALIERON y los que quedaron PARA APROBAR (`cuentaParaElGoteo`).
//
// ⚠️ CON APROBACIÓN TAMBIÉN (22/10/2026, AU1 del plan del Cerebro: #289 nace para aprobar). Contando sólo 'enviado', el motor
// dejaba los 50 borradores de una (un borrador no gasta el cupo de la línea), y al aprobarlos salían en el acto, de a
// varios. Ahora el borrador cuenta para el goteo (nacen de a uno cada N minutos) y APROBAR también lo respeta
// (`frenoAlAprobar`, en la única puerta de envío de un borrador: lib/borrador-camino.ts).
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

/**
 * ¿ESTE NODO GASTA UN TURNO DE WHATSAPP? (24/10/2026, medido en la primera hora de la campaña de Mauricio, la #289): con
 * goteo de 11 min salían cada 22. El freno de la línea y del goteo se miraba sobre CUALQUIER nodo leído, y sólo pasaban
 * las acciones y los emails: la condición «Contestó» que sigue a cada M1 (y una espera, un «Ir a») quedaba frenada y tomaba
 * su turno de 11 min sin mandar nada, así que el mensaje siguiente salía en el turno de después. Lo que no es un MENSAJE no
 * manda nada: corre en el acto, y el mensaje al que lleva pasa por el freno ahí (la segunda mirada de `procesarEnvios`,
 * sobre el destino). Un email, mientras quede su tope.
 */
export function noGastaTurnoDeWhatsapp(clase: string, canal: string | null | undefined, emailLleno: boolean): boolean {
  return clase !== 'mensaje' || (canal === 'email' && !emailLleno);
}

/** Los estados de `nutricion_envios` que cuentan para el goteo: lo que salió y lo que quedó para aprobar. */
export const ESTADOS_DEL_GOTEO = ['enviado', 'borrador'] as const;
export function cuentaParaElGoteo(estado: string): boolean {
  return (ESTADOS_DEL_GOTEO as readonly string[]).includes(estado);
}

/**
 * EL FRENO AL APROBAR un borrador de una automatización con goteo: null = sale; si no, por qué no y cuándo sí. `uso` es lo
 * APROBADO de esa automatización en 24 h (`wa_borradores` enviados, por su `enviado_at`): lo que cuenta es cuándo salió.
 */
export function frenoAlAprobar(g: Goteo | null | undefined, uso: UsoGoteo, ahoraMs: number, nombre: string): string | null {
  const f = frenoDeGoteo(g, uso, ahoraMs);
  if (!f.frena) return null;
  const donde = 'su goteo, en Configuraciones';
  if (f.motivo === 'dia') {
    const horas = Math.max(1, Math.ceil((f.desdeMs - ahoraMs) / 3_600_000));
    return `«${nombre}» ya mandó ${g?.dia} en 24 horas (${donde}). El próximo sale en ${horas === 1 ? '1 hora' : `${horas} horas`}.`;
  }
  const min = Math.max(1, Math.ceil((f.desdeMs - ahoraMs) / 60_000));
  return `Todavía no: «${nombre}» manda uno cada ${g?.minutos} minutos (${donde}). Apruébalo en ${min === 1 ? '1 minuto' : `${min} minutos`}.`;
}

/** Cómo se dice el goteo (la pantalla y la API de MaKo). */
export function textoDeGoteo(g: Goteo | null | undefined): string {
  if (!g || (g.minutos == null && g.dia == null)) return 'sin goteo: sale todo lo que deje el tope de la línea';
  const partes = [g.minutos != null ? `uno cada ${g.minutos} min` : '', g.dia != null ? `hasta ${g.dia} por día` : ''].filter(Boolean);
  return `${partes.join(', ')}, dentro del tope de la línea`;
}
