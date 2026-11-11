// =============================================================================
// linea-demora — WhatsApp entrega TARDE: el mensaje viejo no lo contesta MaKo sola, y la demora avisa por mail (10/11/2026)
// =============================================================================
// Martín, 10/11 a la noche: «No funciona MaKo en WhatsApp… no está funcionando para nada bien». Medido (sólo lectura, 11/11 01:00
// UTC): la línea de la voz (`mako_superadmin_muylqv8r`, …2605) dice `open`, pero WhatsApp le entrega los mensajes de los grupos en
// TANDAS: lo escrito entre las 22:49 y las 23:35 UTC entró todo junto a las 23:47:55 y a las 00:37:55, con 30 a 78 minutos de atraso.
// La línea de Martín (`mako_ws9`, …3479), que también está en grupos, entregó mensajes de un día antes (1.373 a 1.416 minutos).
// Lo que eso rompió:
//   · un comprobante de Código Inmobiliario del 9/11, ya resuelto a mano, volvió a entrar el 10/11 por `mako_ws9`: MaKo le dijo a
//     Joan «Recibí tu comprobante» y le mandó a Martín la revisión por segunda vez (ticket #80);
//   · Patricia (ws 22) y Giselle (ws 17) pidieron notas y la respuesta les llegó una hora después (ticket #79).
// La causa (WhatsApp dejando de entregarle a la sesión) no se arregla desde el código: lo que sí, dos cosas.
//   1. UN MENSAJE QUE LLEGA CON HORAS DE ATRASO NO LO ATIENDE MaKo SOLA (`llegoTarde`): el contexto cambió (el equipo ya lo resolvió,
//      la reunión ya pasó). Va a SuperAdmin, que lo contesta si hace falta. El atraso es la hora de WhatsApp (`messageTimestamp`,
//      cuando se MANDÓ) contra ahora.
//   2. LA DEMORA AVISA (`demoraDeEntrega`): el vigilante del canal (lib/canal-vigilante.ts) miraba si el socket contesta, y una
//      línea sorda o atrasada contesta. Ahora mide lo que llega: el atraso de lo que entró a la cola en las últimas horas.
//
// SIN `server-only`: puro, con test (tests/linea-demora.test.ts).
// =============================================================================

/** Desde cuántas horas de atraso un mensaje ya no lo atiende MaKo sola. Medido el 10/11: los de un día antes rompieron; los de 1 h, no. */
export const TARDE_MS = 6 * 3_600_000;

/** La hora de WhatsApp de un mensaje de Evolution (`messageTimestamp`, en segundos; a veces texto o `{ low }`), en ms. */
export function horaDeWhatsApp(ts: unknown): number | null {
  const crudo = typeof ts === 'object' && ts !== null && 'low' in ts ? (ts as { low: unknown }).low : ts;
  const s = Number(crudo);
  if (!Number.isFinite(s) || s <= 0) return null;
  return s < 1e12 ? s * 1000 : s;
}

/** ¿Llegó con tantas horas de atraso que MaKo no lo atiende sola? null = a tiempo, o sin hora (nunca se frena por no saber). */
export function llegoTarde(ts: unknown, ahora: number, tope = TARDE_MS): { horas: number } | null {
  const h = horaDeWhatsApp(ts);
  if (h == null || ahora - h <= tope) return null;
  return { horas: Math.round((ahora - h) / 3_600_000) };
}

/** Lo que mira la alarma: cada mensaje que entró a la cola, cuándo entró y su hora de WhatsApp. */
export type FilaDeEntrega = { created_at: string; ts: unknown; instancia: string | null };

/** Desde cuántos minutos de atraso una entrega cuenta como DEMORA (el 10/11: 30 a 78 min, y un día). */
export const DEMORA_MS = 20 * 60_000;
/** Cuánto hacia atrás se mira. */
export const VENTANA_DEMORA_MS = 3 * 3_600_000;

export type Demora = { instancia: string; atrasadas: number; deTotal: number; maxMin: number };

/**
 * Las líneas que entregaron TARDE en la ventana: por instancia, cuántos mensajes llegaron con más de `DEMORA_MS` de atraso, de
 * cuántos, y el peor. Vacío = todo a tiempo (o no entró nada: el silencio solo no es demora, lo midió el 10/11 el ticket #79).
 */
export function demoraDeEntrega(filas: readonly FilaDeEntrega[], ahora: number, o: { ventanaMs?: number; demoraMs?: number } = {}): Demora[] {
  const desde = ahora - (o.ventanaMs ?? VENTANA_DEMORA_MS);
  const umbral = o.demoraMs ?? DEMORA_MS;
  const por = new Map<string, Demora>();
  for (const f of filas) {
    const llego = Date.parse(f.created_at);
    const h = horaDeWhatsApp(f.ts);
    if (!Number.isFinite(llego) || llego < desde || llego > ahora || h == null) continue;
    const inst = f.instancia || '(sin línea)';
    const d = por.get(inst) ?? { instancia: inst, atrasadas: 0, deTotal: 0, maxMin: 0 };
    d.deTotal++;
    const atraso = llego - h;
    if (atraso > umbral) { d.atrasadas++; d.maxMin = Math.max(d.maxMin, Math.round(atraso / 60_000)); }
    por.set(inst, d);
  }
  return [...por.values()].filter((d) => d.atrasadas > 0).sort((a, b) => b.maxMin - a.maxMin);
}

/** El mail de la demora, armado por el código. */
export function textoDeLaDemora(demoras: readonly Demora[]): { asunto: string; cuerpo: string } {
  const peor = demoras[0];
  return {
    asunto: `⚠️ WhatsApp le entrega TARDE a MaKo (hasta ${peor ? Math.round(peor.maxMin) : 0} min)`,
    cuerpo: [
      'WhatsApp está entregando con atraso los mensajes de los grupos: los clientes escriben y MaKo los recibe tarde.',
      '',
      ...demoras.map((d) => `· ${d.instancia}: ${d.atrasadas} de ${d.deTotal} mensajes con más de ${Math.round(DEMORA_MS / 60_000)} min de atraso (el peor, ${d.maxMin} min).`),
      '',
      `Lo que llega con más de ${Math.round(TARDE_MS / 3_600_000)} h de atraso no lo contesta MaKo sola: va al grupo de SuperAdmin.`,
      'Si dura horas, o la línea deja de recibir del todo, la salida medida el 9/11 es volver a escanear su QR en /agencia.',
    ].join('\n'),
  };
}
