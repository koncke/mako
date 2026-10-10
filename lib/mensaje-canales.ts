// =============================================================================
// mensaje-canales — de dónde sale «por dónde llega» CADA mensaje
// =============================================================================
// Hay dos tiendas y no es un descuido: son dos cosas con dueños distintos.
//
//   · Los tres REPORTES tienen su canal en `notification_prefs` (`CanalPrefs.wa`
//     y `.email`), que es lo que leen sus crons desde antes de que existiera el
//     store de plantillas.
//   · Los AVISOS lo tienen en su propia entrada del store (`canales`), que es lo
//     que lee el choke point de `lib/avisos.ts` al despachar.
//
// Moverlos a una sola tienda sería el cambio correcto y no es éste: los crons de
// reporte no iteran inquilinos, así que migrarlos es tocar un camino que hoy sólo
// corre para el dueño. Lo que NO se puede es que cada pantalla decida por su
// cuenta de dónde leer — ahí es donde nacen los dos interruptores que dicen cosas
// distintas sobre el mismo mensaje, que esta tab ya pagó una vez.
//
// Sin `server-only`: lo importan la bandeja de email y el detalle de un mensaje,
// que son componentes del navegador, y también puede leerlo el server.

/** Los mensajes cuyo canal vive en `notification_prefs`, y bajo qué clave. */
export const REPORTES_CON_PREFS: Record<string, 'horario' | 'diario' | 'semanal'> = {
  'reporte-horario': 'horario',
  'reporte-diario': 'diario',
  'reporte-semanal': 'semanal',
};

/**
 * ⛔ UN REPORTE NO SALE POR WHATSAPP. Decisión de Martín (10/10/2026), al preguntarle qué hacer con el
 * reporte semanal, que no tenía por dónde salir desde que se borró el WhatsApp oficial: «Apagar WhatsApp en los
 * reportes» (y no mandarlo al grupo de MaKo). Quedan por email y en el feed. Lo leen el lienzo y el
 * interruptor de un reporte (`canalesDeMensaje`, `guardarCanalDeMensaje`) y el cron (`decidirReporte`,
 * lib/reporte-destino.ts): si algún día vuelve, se cambia ACÁ y los tres lo siguen.
 */
export const REPORTE_POR_WHATSAPP = false;

export function claveDeReporte(id: string): 'horario' | 'diario' | 'semanal' | null {
  return REPORTES_CON_PREFS[id] ?? null;
}

/** Forma mínima de lo que cada tienda devuelve, para no importar los tipos del server. */
type CanalesLeidos = { wa: boolean; email: boolean };
type PrefsLeidas = { horario?: CanalesLeidos; diario?: CanalesLeidos; semanal?: CanalesLeidos };

/**
 * Por dónde sale este mensaje, mire quien mire.
 *
 * `prefs` puede llegar en null (todavía cargando, o la lectura falló): en ese caso
 * un reporte contesta lo que dice su plantilla, que para un reporte es el default
 * —y no se inventa un «sí» sobre un canal que no se pudo leer.
 */
export function canalesDeMensaje(
  id: string,
  plantilla: { canales?: CanalesLeidos } | null | undefined,
  prefs: PrefsLeidas | null | undefined,
): CanalesLeidos {
  const k = claveDeReporte(id);
  // Un reporte: el email de sus prefs (o el de su plantilla, si no se pudieron leer), y WhatsApp sólo si
  // `REPORTE_POR_WHATSAPP` lo permite (hoy no).
  if (k) {
    const p = prefs?.[k];
    return { wa: REPORTE_POR_WHATSAPP && (p ? p.wa : plantilla?.canales?.wa ?? true), email: p ? p.email : plantilla?.canales?.email ?? false };
  }
  return { wa: plantilla?.canales?.wa ?? true, email: plantilla?.canales?.email ?? false };
}

/**
 * Prende o apaga un CANAL de un mensaje, en la tienda que le corresponda.
 *
 * Vive acá y no en la pantalla por lo mismo que `canalesDeMensaje`: son dos tiendas
 * —los reportes en `notification_prefs`, los avisos en su plantilla— y la que decide
 * cuál es tiene que ser UNA. Con la decisión repartida en dos pantallas, la segunda
 * escribe en la tienda equivocada y el interruptor queda contestando otra cosa.
 *
 * ⚠️ Para un REPORTE se relee antes de escribir: `/api/perfil` guarda el objeto de
 * preferencias ENTERO, así que mandar el que uno tenía en memoria pisa lo que el panel
 * de al lado haya cambiado mientras tanto.
 *
 * ⚠️ Y `activo` se DERIVA, nunca se fuerza: un reporte está activo si sale por algún
 * lado. Forzarlo a `true` para que el interruptor «funcione» reenciende un reporte que
 * el dueño había apagado — el segundo interruptor de siempre, escribiendo a escondidas.
 */
export async function guardarCanalDeMensaje(
  id: string,
  canal: 'wa' | 'email',
  on: boolean,
  endpoint: string,
): Promise<{ ok: boolean; error?: string }> {
  const k = claveDeReporte(id);
  try {
    if (k) {
      // Un reporte no sale por WhatsApp (`REPORTE_POR_WHATSAPP`): prenderlo no se ofrece y, si llega, se dice.
      if (canal === 'wa' && !REPORTE_POR_WHATSAPP) return on ? { ok: false, error: 'Los reportes salen por email.' } : { ok: true };
      const fresco = await (await fetch('/api/perfil')).json();
      if (!fresco?.ok) return { ok: false, error: fresco?.error || 'No se pudieron leer tus preferencias' };
      const prefs = fresco.prefs as Record<string, unknown>;
      const prev = (prefs[k] ?? {}) as { wa?: boolean; email?: boolean };
      const sig = { ...prev, [canal]: on };
      const next = { ...prefs, [k]: { ...sig, activo: (REPORTE_POR_WHATSAPP && Boolean(sig.wa)) || Boolean(sig.email) } };
      const j = await (await fetch('/api/perfil', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'prefs', prefs: next }),
      })).json();
      return j?.ok ? { ok: true } : { ok: false, error: j?.error || 'No se pudo guardar' };
    }
    const j = await (await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'canales', id, canales: { [canal]: on } }),
    })).json();
    return j?.ok ? { ok: true } : { ok: false, error: j?.error || 'No se pudo guardar' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo guardar' };
  }
}
