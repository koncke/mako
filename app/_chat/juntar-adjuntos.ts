// =============================================================================
// juntar-adjuntos — los adjuntos de la PANTALLA y los que lee la CAJA, en uno (27/10/2026, ticket #16 de Leila)
// =============================================================================
// Un archivo va a la pantalla si su `accept` lo toma (su motor lo ve: una foto o un PDF en el Second Brain); si no, a los que
// la caja lee al mandar (./adjuntos-que-se-leen.ts). Así toda caja toma todo lo que MaKo sabe leer.
// ⚠️ PURO y sin CSS: lo importa tests/chat-formatos.test.ts (en node un `.css` no carga) y CajaChat.tsx.
// =============================================================================

import type { AdjuntosDeCaja } from '@/app/admin/operaciones/AdjuntosCaja';
import { ACCEPT_CHAT, aceptaArchivo } from '@/lib/chat-formatos';
import { ACCEPT_ADJUNTOS_CENTRO } from '@/lib/operaciones-reglas';

/** Los dos `accept` en uno, sin repetir: lo que la caja lee primero y, al final, lo que sólo toma la pantalla. */
const unirAccept = (a: string, b: string): string =>
  [...new Set(`${a},${b}`.split(',').map((x) => x.trim()).filter(Boolean))].join(',');

export function juntarAdjuntos(propio: AdjuntosDeCaja | undefined, leidos: AdjuntosDeCaja | undefined): AdjuntosDeCaja | undefined {
  if (!leidos) return propio;
  if (!propio) return leidos;
  const acceptPropio = propio.accept ?? ACCEPT_ADJUNTOS_CENTRO;
  const tomaPropio = (f: File) => aceptaArchivo(acceptPropio, f);
  return {
    ...propio,
    items: [...propio.items, ...leidos.items],
    puede: propio.puede && leidos.puede,
    // Todo lo que MaKo lee, sin perder lo que la pantalla toma de más: el .zip de la carpeta de una landing en Offer
    // (tests/offer-hilo-unico.test.ts). Con `ACCEPT_CHAT` solo, el «+» del teléfono dejó de ofrecerlo.
    accept: unirAccept(ACCEPT_CHAT, acceptPropio),
    onSumar: (fs) => {
      const suyos = fs.filter(tomaPropio);
      const otros = fs.filter((f) => !tomaPropio(f));
      if (suyos.length) propio.onSumar(suyos);
      if (otros.length) leidos.onSumar(otros);
    },
    onQuitar: (id) => (propio.items.some((x) => x.id === id) ? propio.onQuitar(id) : leidos.onQuitar(id)),
  };
}

/** Lo que dice la caja quieta cuando se le suelta o se le pega algo (y el panel, mientras se arrastra). */
export const ESPERA_PARA_ADJUNTAR = 'Espera a que termine para adjuntar';

/**
 * La caja QUIETA (saliendo, apagada o bloqueada) no toca lo adjuntado (28/10/2026, la revisión de 0453923ab): ni se quita nada
 * ni entra lo soltado o pegado, y se sigue viendo. Con la nota del chat nuevo pasándose a texto, quitar una foto la dejaba salir
 * firmada igual (la pantalla ya la había tomado) y lo soltado quedaba para el chat siguiente.
 * Y NO SE TRAGA NADA CALLADA (la verificación de tren-t): dice que no toma (`puede: false`), así el panel no ofrece «Suelta
 * para adjuntar». POR QUÉ, según la caja (la verificación de 05d7c3187):
 *   · si la pantalla ya dice que no (`puede: false`: un ticket cerrado, un Runner viejo, «Ya juntaste el máximo»), gana su
 *     motivo y su aviso: la caja no lo pisa;
 *   · SALIENDO (`saliendo`: manda, lee o pasa una nota a texto), «Espera a que termine para adjuntar» (`espera`), y lo soltado
 *     avisa (`onEspera`): en segundos vuelve a tomar;
 *   · apagada o bloqueada (sin diseño, sin la app de escritorio), sin espera: nada va a terminar, y el panel dice lo de
 *     siempre («Este chat no recibe archivos»).
 */
export function adjuntosQuietos(a: AdjuntosDeCaja | undefined, c: {
  quieta: boolean; saliendo: boolean; onEspera?: () => void;
  /** La PANTALLA dice que no, por lo suyo. Sin esto, `!a.puede`. La caja lo pasa aparte: lo junto también dice que no mientras la
   *  caja LEE (`juntarAdjuntos`), y eso es salir, no un motivo de la pantalla (la verificación de d2f690673). */
  pantallaDiceQueNo?: boolean;
}): AdjuntosDeCaja | undefined {
  if (!c.quieta || !a) return a;
  const nada = { onSumar: () => {}, onQuitar: () => {} };
  if (c.pantallaDiceQueNo ?? !a.puede) return { ...a, ...nada };
  if (c.saliendo) return { ...a, ...nada, puede: false, espera: ESPERA_PARA_ADJUNTAR, onNoPuede: c.onEspera };
  return { ...a, ...nada, puede: false, onNoPuede: undefined };
}
