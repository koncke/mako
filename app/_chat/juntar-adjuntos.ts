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

export function juntarAdjuntos(propio: AdjuntosDeCaja | undefined, leidos: AdjuntosDeCaja | undefined): AdjuntosDeCaja | undefined {
  if (!leidos) return propio;
  if (!propio) return leidos;
  const tomaPropio = (f: File) => aceptaArchivo(propio.accept ?? ACCEPT_ADJUNTOS_CENTRO, f);
  return {
    ...propio,
    items: [...propio.items, ...leidos.items],
    puede: propio.puede && leidos.puede,
    accept: ACCEPT_CHAT,
    onSumar: (fs) => {
      const suyos = fs.filter(tomaPropio);
      const otros = fs.filter((f) => !tomaPropio(f));
      if (suyos.length) propio.onSumar(suyos);
      if (otros.length) leidos.onSumar(otros);
    },
    onQuitar: (id) => (propio.items.some((x) => x.id === id) ? propio.onQuitar(id) : leidos.onQuitar(id)),
  };
}
