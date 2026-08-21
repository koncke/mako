// =============================================================================
// envejecer — el tiempo mueve la prioridad, sin llamar a ningún modelo
// =============================================================================
// Las dos reglas las pidió el dueño textual: «30 días sin tocar baja, deadline a menos de
// 7 sube». Cuestan cero tokens: son dos restas.
//
// SIN `server-only`, como el resto de este directorio: lo corre el servidor al repartir y
// lo importa el test. Si cada lado tuviera su copia, el chip diría una cosa y el ranking
// otra.
//
// ── LO QUE LA MEDICIÓN CAMBIÓ DEL DISEÑO ────────────────────────────────────────────
//
// «Sin tocar» parecía trivial y no lo era. Medido sobre las 550 tareas abiertas del
// tablero real, con tres definiciones distintas:
//
//   · `actor === 'user'` (el dueño editó la tarjeta a mano) → **7 de 550**. El tablero lo
//     alimentan MaKo y las reuniones, no la edición manual: con esa señal el 99% queda
//     marcado como «nunca tocado» y la regla no discrimina nada, solo mide antigüedad.
//   · `updated_at` → **inservible**. No tiene trigger de base, lo escribe el código, y
//     tres de sus escritores son procesos (el Perro puntuando, MaKo ampliando desde una
//     reunión, y el borrado de un proyecto que reescribe `labels` de decenas de tareas).
//     Mide «último write de cualquiera», no «cuándo le importó a alguien».
//   · `Math.max` sobre TODO el historial —lo que hace hoy la card «Estancadas»— también:
//     una corrida del Perro deja la tarjeta como «tocada hoy» sin que nadie la haya mirado.
//
// La señal que SÍ discrimina es otra pregunta: **¿se volvió a hablar de esto?** Una tarea
// que MaKo amplió porque el dueño la mencionó de nuevo en una reunión está viva, aunque él
// no haya tocado un solo botón. Con esa definición el tablero se reparte de 0 a 39 días y
// 101 de 550 (18%) cruzan los 30 — un corte que separa de verdad.
//
// ⚠️ Y LA LISTA VA EN POSITIVO. «Todo menos lo del sistema» deja entrar como «toque»
// cualquier evento nuevo que alguien agregue después, sin que nada avise — que es la regla
// de los guards de AGENTS.md aplicada a una señal. Acá se enumera lo que SÍ cuenta.
// =============================================================================

import type { Hist } from './types';

export const DIA = 86400000;

/**
 * Lo que cuenta como «el dueño se ocupó de esto». Lista CERRADA.
 *
 * ⚠️ Son patrones sobre el TEXTO, que es frágil a propósito documentado: la forma correcta
 * sería una marca estructural en la entrada del historial, pero eso obliga a tocar los ~15
 * lugares que escriben historial. Mientras tanto vive acá, en un solo lugar y con test.
 * Si cambia el texto de un alta, el test es lo que avisa.
 */
const TOQUES: RegExp[] = [
  /^Creó la tarjeta/i,        // nació porque él lo dijo (reunión, WhatsApp, Claude Code)
  /le sumó contexto/i,        // MaKo la amplió: VOLVIÓ a hablar de esto
];

/** ¿Esta entrada del historial dice que el dueño se ocupó de la tarea? */
export const esToque = (h: Hist): boolean =>
  h.actor === 'user' || TOQUES.some((re) => re.test(h.text ?? ''));

/**
 * Días desde la última vez que pasó algo con esta tarea que saliera del dueño.
 *
 * ⚠️ Filtra los `ts` no finitos ANTES del `Math.max`. No es defensivo de más: había 418
 * entradas en producción con `ts` guardado como string ISO, y `Math.max` con un string
 * adentro da NaN — que en una comparación es siempre `false`, así que la regla se evaluaba
 * sobre 362 de 550 tareas sin decirlo. Ver `sanearHist` en types.ts.
 */
export function diasQuieta(historial: Hist[], creadaEn: string | number | undefined, ahora: number): number {
  const ts = (historial ?? []).filter(esToque).map((h) => h.ts).filter((n) => Number.isFinite(n));
  const nacida = typeof creadaEn === 'number' ? creadaEn : Date.parse(String(creadaEn ?? ''));
  const base = ts.length ? Math.max(...ts) : (Number.isFinite(nacida) ? nacida : ahora);
  return Math.floor((ahora - base) / DIA);
}

/**
 * Días que faltan para el deadline. Negativo = vencida. `null` = no tiene fecha.
 *
 * El mediodía UTC es a propósito: comparar la fecha `YYYY-MM-DD` contra `Date.now()` a la
 * medianoche hace que «faltan 7 días» dé distinto según la zona horaria del que mira, y
 * este tablero se reparte desde un cron que corre a las 13-14 UTC. Con el mediodía, las
 * ±3 horas de Montevideo no cambian de día nunca.
 */
export function diasAlDeadline(deadline: string | undefined, ahora: number): number | null {
  if (!deadline) return null;                                  // ⚠️ es `text not null default ''`, NUNCA null
  const t = Date.parse(`${deadline}T12:00:00Z`);
  return Number.isFinite(t) ? Math.ceil((t - ahora) / DIA) : null;
}

// ── Los dos ajustes ──────────────────────────────────────────────────────────────────
//
// Son puntos de RANKING, no de score: el número final lo reparte `curveTaskScores` sobre
// el orden. Un «+20» no se guarda en ningún lado; lo que se guarda es la posición que
// produjo.
//
// Los cortes salieron de contar contra los datos reales (scripts/medir-envejecimiento.mts):
//   · 125 de 550 tareas tienen fecha. 25 están VENCIDAS —la más vieja hace 13 días— y 7 de
//     ellas ni siquiera están en Alta. Una vencida pesa MÁS que una que vence mañana:
//     ya falló, y el tablero no lo decía en ningún lado.
//   · 57 vencen dentro de la semana; 34 de ellas no están en Alta hoy.
//   · Del otro lado, 101 llevan 30+ días sin que nadie las mencione, 16 en Alta.

/** Cuánto empuja para arriba la cercanía del deadline. */
export function empujeDeadline(dias: number | null): number {
  if (dias == null) return 0;
  if (dias < 0) return 25;      // vencida: ya falló, es lo más fuerte que puede pasar
  if (dias <= 3) return 20;
  if (dias <= 7) return 12;
  if (dias <= 14) return 6;
  return 0;
}

/**
 * Cuánto baja algo de lo que nadie volvió a hablar.
 *
 * Arranca en el día 30 y crece de a uno, con tope 20 — o sea que a los 50 días toca fondo
 * y no sigue hundiéndose. El tope existe para que la regla no pueda enterrar sola algo
 * importante: si a los 50 días sigue arriba, es que vale, y el que tiene que decidir es el
 * dueño. Nada de esto es irreversible: se debate la prioridad y el Perro la vuelve a subir.
 */
export function castigoQuietud(dias: number): number {
  return dias < 30 ? 0 : Math.min(20, dias - 29);
}

export type Ajuste = { delta: number; razon: string };

/**
 * El ajuste temporal completo de una tarea, con la frase que lo explica.
 *
 * La razón NO es decoración: un score que se movió solo y no dice por qué es exactamente
 * el problema que el dueño reportó del tablero entero. Va al `score_razon`, que es lo que
 * se lee en la tarjeta.
 */
export function ajusteTemporal(dias: { quieta: number; alDeadline: number | null }): Ajuste {
  const emp = empujeDeadline(dias.alDeadline);
  const cas = castigoQuietud(dias.quieta);
  const partes: string[] = [];
  if (emp > 0) {
    partes.push(dias.alDeadline! < 0
      ? `venció hace ${-dias.alDeadline!} ${-dias.alDeadline! === 1 ? 'día' : 'días'}`
      : `vence en ${dias.alDeadline} ${dias.alDeadline === 1 ? 'día' : 'días'}`);
  }
  if (cas > 0) partes.push(`${dias.quieta} días sin que nadie la mencione`);
  return { delta: emp - cas, razon: partes.join(' · ') };
}
