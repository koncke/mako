// =============================================================================
// ai-step-migrar — LO QUE CONTESTA un flujo con AI Step, para comparar antes y después (puro, con test)
// =============================================================================
// Nació en la décima tanda como el PLAN de partir cada AI Step guardado en una tarjeta por caso (`planDeFila`, lo
// corría scripts/ai-step-v2.mts). La UNDÉCIMA TANDA lo dio vuelta —UN AI Step por objetivo (`juntarPasosIA`,
// lib/flujo-grafo.ts)— y lo que sólo servía para partir se borró: el script quedó neutralizado y lo guardado lo
// junta `juntarPasosIA` al abrir y al guardar (sólo #198 y #213 del ws1 tienen AI Step, y los reescribe el script de
// flujos de la ola 4: docs/diseno-undecima-tanda.md §3 y §10).
//
// Queda la COMPROBACIÓN, que vale para cualquier cambio de forma de un AI Step: `loQueContesta` dice lo que ven el
// clasificador y el redactor (`escenariosDeRespuesta`: nombre, cuándo, guía, «sale sola», objetivo, ejemplos, audio
// y «hasta», en el mismo orden) y lo que hace «Otra cosa», por medio. Dos flujos que contestan igual dan el MISMO
// texto. La usan los tests de la undécima (juntar #213 no cambia lo que contesta) y la puede usar el script de la ola 4.
// =============================================================================

import { type PasoGrafo, idDe, escenariosDeRespuesta, expandirPasoIA, nodoPorId, raizRespuesta, claseDe, MEDIOS_AI_STEP } from './flujo-grafo';

/** JSON con las claves ordenadas: dos nodos iguales dan el mismo texto aunque las claves vengan en otro orden. */
export function estable(v: unknown): string {
  return JSON.stringify(v, (_k, x: unknown) => (x && typeof x === 'object' && !Array.isArray(x)
    ? Object.fromEntries(Object.keys(x as object).sort().map((k) => [k, (x as Record<string, unknown>)[k]]))
    : x));
}

/**
 * Lo que el clasificador y el redactor ven de una automatización, por medio: lo que un cambio de FORMA no puede
 * cambiar. ⚠️ TODO lo que `bloqueEscenario` le pasa al redactor (objetivo, ejemplos, audio, «hasta»), no sólo lo del
 * clasificador: sin el objetivo acá, un objetivo nuevo cambiaba la respuesta y la comparación daba verde.
 */
export function loQueContesta(pasos: readonly PasoGrafo[]): string {
  return estable(MEDIOS_AI_STEP.map((medio) => {
    const exp = expandirPasoIA(pasos, { medio });
    const casos = escenariosDeRespuesta(exp).map((e) => ({
      titulo: e.titulo, cuando: e.cuando, guia: e.comoResponder, sola: e.contestaSolo === true,
      objetivo: e.objetivo ?? null, ejemplos: e.ejemplos ?? null, audio: e.audio ?? null, hasta: e.hasta ?? null,
    }));
    const r = nodoPorId(exp, raizRespuesta(exp));
    return { medio, casos, otra: queHace(exp, r?.si_no ?? null) };
  }));
}

/** Lo que hace «Otra cosa»: el aviso (su mensaje), la respuesta de MaKo (su guía y si sale sola) o nada. */
function queHace(pasos: readonly PasoGrafo[], id: string | null): unknown {
  const n = nodoPorId(pasos, id);
  if (!n) return null;
  if (claseDe(n) === 'accion') return { aviso: (n.accion as { params?: { mensaje?: unknown } } | undefined)?.params?.mensaje ?? null };
  if (n.tipo === 'ia') return { contesta: n.cuerpo ?? '', sola: n.revisar === false, luego: queHace(pasos, n.siguiente ?? null) };
  return { otro: idDe(n, 0) };
}
