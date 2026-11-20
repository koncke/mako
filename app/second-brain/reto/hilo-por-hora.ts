// =============================================================================
// UN SOLO HILO, POR HORA (auditoría de chats del 20/11, reto-2): el chat del reto, puro (con test)
// =============================================================================
// La charla de la caja se dibujaba DEBAJO de todo el reto: un día nuevo aparecía arriba de esa charla y sus puntitos quedaban abajo.
// Ahora cada pieza del reto lleva su hora (cuándo se abrió el día, cuándo terminó) y cada tramo de la charla va antes de la primera
// pieza más nueva que él. Un mensaje sin hora (el que sale ahora) va al final; una tarjeta o una pantalla de la charla, con el mensaje
// que la trajo. Lo usa app/second-brain/reto/ChatDelReto.tsx; lo prueba tests/reto-verificacion-tarde.test.ts.
// =============================================================================
import type { ItemHilo } from '@/app/m/mako/chat-ui';

/** La hora de cada mensaje de la charla (ms). Sin hora: Infinity (sale ahora: al final). Lo que no es un mensaje, la del anterior. */
export function horasDeLaCharla(items: readonly ItemHilo[]): number[] {
  let antes = Infinity;
  return items.map((x) => {
    if (x.k !== 'msg') return antes;
    const t = x.at ? Date.parse(x.at) : NaN;
    antes = Number.isFinite(t) ? t : Infinity;
    return antes;
  });
}

export type Tramo = { tramo: ItemHilo[]; desde: number };

/** Las piezas (por hora, estable) y la charla, en un solo hilo: cada tramo de la charla antes de la primera pieza más nueva. */
export function intercalar<P extends { t: number }>(piezas: readonly P[], items: readonly ItemHilo[]): Array<{ pieza: P } | Tramo> {
  const ts = horasDeLaCharla(items);
  const orden = [...piezas].sort((a, b) => a.t - b.t);
  const out: Array<{ pieza: P } | Tramo> = [];
  let i = 0;
  for (const p of orden) {
    const desde = i;
    while (i < items.length && ts[i] < p.t) i++;
    if (i > desde) out.push({ tramo: items.slice(desde, i), desde });
    out.push({ pieza: p });
  }
  if (i < items.length) out.push({ tramo: items.slice(i), desde: i });
  return out;
}
