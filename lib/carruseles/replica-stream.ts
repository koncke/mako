// =============================================================================
// carruseles/replica-stream — el NDJSON de «Editar» un ejemplo, de punta a punta, y que nunca termine sin decir por qué (18/11/2026)
// =============================================================================
// El pendiente F14 (docs/pendientes-verificados-17-11.md): app/api/image-editor/carruseles/replicar/route.ts tiene
// `maxDuration = 300`, y una corrida medida con la IA real llegó a 276,9 s porque `gemini-flash-latest` se cuelga y se come su
// plazo entero de 120 s por llamada (el plazo de la cascada es POR LLAMADA, no por pedido: docs/hallazgos-ia.md). Si el pedido
// pasaba los 300 s, Vercel cortaba la función, el stream terminaba SIN el evento `fin`, y la pantalla
// (app/image-editor/carruseles/EditarCarrusel.tsx) hacía `if (done) break;` y se quedaba en «Escribo tu versión…» para siempre,
// sin ningún aviso. Dos mitades, las dos acá para que se prueben juntas (tests/carruseles-replica-stream.test.ts):
//
//   1. EL SERVIDOR (`streamDeReplica`): corre la réplica y, si no terminó a `plazoMs` (la ruta lo pone ~15 s antes de su
//      `maxDuration`), manda él mismo el `fin` con la causa, nombrando la FASE en que estaba (`errorPorPlazo`), y cierra. El
//      trabajo de atrás no se aborta (la cascada no tiene una señal por pedido): si termina después y guarda el diseño, queda en
//      «tus diseños», y el texto lo dice.
//   2. LA PANTALLA (`leerStreamDeReplica`): lee hasta el final (también la última línea sin `\n`) y devuelve si llegó el `fin`.
//      Sin él —la función murió igual: memoria, un corte de red que cierra limpio— la pantalla dice `errorSinFin` en vez de
//      quedarse esperando.
//
// Los textos dicen QUÉ pasó y QUÉ hacer (AGENTS.md, «Un mensaje de error dice DE QUIÉN fue y QUÉ HACER»). La fase sale del último
// evento que de verdad se mandó, no de una suposición: si el corte fue mientras escribía, se dice «escribiendo»; si no, no.
//
// Puro (sin `server-only` ni DOM): lo importan la ruta, la pantalla y el test.
// =============================================================================

import { lineaDeEvento, eventosDe, type EventoReplica } from './replica';

/** Las fases que se ven en la pantalla mientras se arma (la de `fin` no cuenta: si llegó, no hay nada que explicar). */
export type FaseDeReplica = 'leer' | 'escribir' | 'armar';

/** La fase en curso según un evento (una `lamina` es «armar»). */
export function faseDeEvento(e: EventoReplica): FaseDeReplica | null {
  if (e.fase === 'leer') return 'leer';
  if (e.fase === 'escribir') return 'escribir';
  if (e.fase === 'lamina') return 'armar';
  return null;
}

const TAIL = 'Si se armó, está en tus diseños; si no, vuelve a intentar.';

/**
 * El `fin` que manda la ruta cuando se le acaba el tiempo: qué estaba haciendo y qué hacer. `negocio` es el del cliente que se
 * mira si quien pide está INSPECCIONANDO (como `avisoSinIA`): la IA que tardó es la de ese negocio, no la de quien mira.
 */
export function errorPorPlazo(fase: FaseDeReplica | null, minutos: number, negocio: string | null = null): string {
  const ajeno = negocio?.trim() || null;
  const ia = ajeno ? `La IA de ${ajeno}` : 'Tu IA';
  const tiempo = `${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`;
  if (fase === 'escribir') return `${ia} tardó más de ${tiempo} en escribir la versión y se cortó: es la demora del proveedor, no de la configuración. ${TAIL}`;
  if (fase === 'armar') return `Se cortó a los ${tiempo}, mientras se armaba el diseño. ${TAIL}`;
  return `Se cortó a los ${tiempo}, mientras se leía el ejemplo. ${TAIL}`;
}

/** Lo que dice la pantalla si el stream terminó sin `fin` (la función murió antes de poder avisar). */
export function errorSinFin(fase: FaseDeReplica | null): string {
  const donde = fase === 'escribir' ? ', mientras se escribía la versión' : fase === 'armar' ? ', mientras se armaba el diseño' : '';
  return `Se cortó antes de terminar${donde}. ${TAIL}`;
}

/** El resultado de correr la réplica, lo que la ruta necesita de él (la forma de `ResultadoReplica`, lib/carruseles/replica-servidor.ts). */
type Resultado =
  | { ok: true; id: string; titulo: string; sinIA?: boolean; aviso?: string | null; conectar?: string | null }
  | { ok: false; error: string; conectar?: string | null };

/**
 * El stream NDJSON de la ruta. `correr` recibe el `alEvento` y corre la réplica; si no terminó a `plazoMs`, se manda el `fin` con
 * la causa y se cierra. Nunca manda dos `fin`, y nada se escribe después de cerrar.
 */
export function streamDeReplica(
  correr: (alEvento: (e: EventoReplica) => void) => Promise<Resultado>,
  o: { plazoMs: number; minutos: number; negocioAjeno?: string | null; alFallar?: (e: unknown) => void },
): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let fase: FaseDeReplica | null = null;
  let cerrado = false;
  let conFin = false;
  return new ReadableStream<Uint8Array>({
    async start(ctrl) {
      const mandar = (e: EventoReplica) => {
        if (cerrado || conFin) return;
        if (e.fase === 'fin') conFin = true;
        else fase = faseDeEvento(e) ?? fase;
        try { ctrl.enqueue(enc.encode(lineaDeEvento(e))); } catch { /* se cerró */ }
      };
      const cerrar = () => {
        if (cerrado) return;
        cerrado = true;
        try { ctrl.close(); } catch { /* ya cerrado */ }
      };
      let reloj: ReturnType<typeof setTimeout> | null = null;
      const plazo = new Promise<'plazo'>((res) => { reloj = setTimeout(() => res('plazo'), o.plazoMs); });
      try {
        const r = await Promise.race([correr(mandar), plazo]);
        if (r === 'plazo') mandar({ fase: 'fin', ok: false, error: errorPorPlazo(fase, o.minutos, o.negocioAjeno ?? null) });
        else if (!r.ok) mandar({ fase: 'fin', ok: false, error: r.error, conectar: r.conectar ?? null });
        // Terminó bien y no avisó (hoy todos los caminos de `replicarEjemplo` mandan su `fin`; esto es la red por si uno nuevo
        // se olvida): el `fin` sale del resultado, que es la verdad. Nunca «se cortó» sobre un diseño que sí se guardó.
        else if (!conFin) mandar({ fase: 'fin', ok: true, id: r.id, titulo: r.titulo, sinIA: r.sinIA, aviso: r.aviso ?? null, conectar: r.conectar ?? null });
      } catch (e) {
        o.alFallar?.(e);
        mandar({ fase: 'fin', ok: false, error: 'No pude armar el diseño. Vuelve a intentar.' });
      } finally {
        if (reloj) clearTimeout(reloj);
        cerrar();
      }
    },
  });
}

/**
 * Lee el NDJSON de la ruta hasta el final y le pasa cada evento a `alEvento`. Devuelve si llegó el `fin` y la última fase vista:
 * sin `fin`, la pantalla dice `errorSinFin(ultima)` en vez de quedarse esperando. La última línea se lee aunque no traiga `\n`.
 */
export async function leerStreamDeReplica(
  body: ReadableStream<Uint8Array>,
  alEvento: (e: EventoReplica) => void,
): Promise<{ conFin: boolean; ultima: FaseDeReplica | null }> {
  const lector = body.getReader();
  const dec = new TextDecoder();
  let resto = '';
  let conFin = false;
  let ultima: FaseDeReplica | null = null;
  const pasar = (texto: string) => {
    for (const e of eventosDe(texto)) {
      if (e.fase === 'fin') conFin = true;
      else ultima = faseDeEvento(e) ?? ultima;
      alEvento(e);
    }
  };
  for (;;) {
    const { value, done } = await lector.read();
    if (done) break;
    resto += dec.decode(value, { stream: true });
    const corte = resto.lastIndexOf('\n');
    if (corte < 0) continue;
    pasar(resto.slice(0, corte));
    resto = resto.slice(corte + 1);
  }
  resto += dec.decode();
  if (resto.trim()) pasar(resto);
  return { conFin, ultima };
}
