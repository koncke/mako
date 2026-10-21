'use client';

// =============================================================================
// Las acciones del formulario del chat: las MISMAS de /mako/revisar/<id> (20/10/2026, pieza 1.10)
// =============================================================================
// Confirmar o descartar adentro del chat corre `confirmarAccionAction` y `descartarAccionAction`, las de la pantalla de
// revisión: validan de nuevo contra los `parametros`, miran que quien confirma sea el admin (`ctxDeBandeja`), vuelven a
// preparar contra la base y, al terminar, anotan el resultado en el hilo de donde salió (lib/chat-hilo-origen.ts).
// Viven acá, aparte de FormularioEnChat.tsx, para que la pieza se dibuje en un test.
//
// ⚠️ POR UNA RUTA (/api/mako/propuesta, 420 s) Y NO POR LA SERVER ACTION (revisión del 21/10/2026): la action toma el
//    techo de la PÁGINA donde está el chat (60 s en /crm), y un trabajo largo sigue en `after()` con ese mismo techo. La
//    plataforma lo cortaba a mitad: «En curso» para siempre y la propuesta trabada. Es la regla de
//    app/api/mako/chat/route.ts («CONFIRMAR VA POR ACÁ Y NO POR UNA SERVER ACTION»). El `?ws=` lo suma WsFetch.

import type { AccionesFormulario, ResultadoFormulario } from './FormularioEnChat';

/** Un poco más que el techo de la ruta (tests/mako-doer-plazo.test.ts). */
const TOPE_MS = 425_000;

async function pedir(cuerpo: Record<string, unknown>): Promise<ResultadoFormulario> {
  const res = await fetch('/api/mako/propuesta', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(TOPE_MS),
  });
  const j = await res.json().catch(() => null) as ResultadoFormulario | null;
  // Sin una respuesta que se entienda, el formulario dice que no se sabe (pudo haber corrido igual).
  if (!j || typeof j.ok !== 'boolean') throw new Error(`/api/mako/propuesta: ${res.status}`);
  return j;
}

export const ACCIONES_FORMULARIO: AccionesFormulario = {
  confirmar: (id, payload) => pedir({ accion: 'confirmar', id, payload }),
  descartar: (id) => pedir({ accion: 'descartar', id }),
};
