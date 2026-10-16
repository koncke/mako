'use client';

// =============================================================================
// useFichaDelFunnel — la ficha del funnel del lead mientras se personaliza: guarda sola, con «Deshacer»
// =============================================================================
// Como el Dashboard: sin botón «Guardar». Cada cambio (un `CambioFicha`, lib/ficha/config.ts) se ve EN EL
// ACTO —se aplica acá con el mismo motor puro que usa el server (`aplicarCambio`)— y se manda en COLA, uno
// detrás del otro, a `cambiarFichaFunnelAction`, que lo aplica sobre lo de hoy con compare-and-set. Lo que
// devuelve el server es la verdad: si una respuesta llega cuando no queda nada en la cola, la ficha pasa a
// ser esa. Si algo falla, se relee la ficha del server (nunca se queda la pantalla diciendo algo que no se
// guardó) y se avisa.
//
// «Deshacer» vuelve al `antes` que devolvió cada cambio, en orden (`{ op: 'restaurar', ficha: antes }`).
// =============================================================================

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { aplicarCambio, fichaEfectiva, sanearCambio, type CambioFicha, type FichaEfectiva, type FichaGuardada } from '@/lib/ficha/config';
import type { FichaDelFunnel } from '@/lib/ficha/config-server';
import { cambiarFichaFunnelAction, leerFichaFunnelAction } from '../../ficha-actions';

/** Lo que cambia los AVISOS de «datos sin marcar»: después de guardarlo, la cabecera se recuenta. */
export const cambiaAvisos = (c: CambioFicha): boolean =>
  c.op === 'aviso' || c.op === 'avisos' || c.op === 'plantilla' || c.op === 'restaurar' || (c.op === 'volver' && !c.tab);

const TOPE_DESHACER = 30;

export function useFichaDelFunnel(base: FichaDelFunnel | null, o: { onGuardado: (c: CambioFicha) => void; onError: (msg: string) => void }) {
  // Lo de esta sesión gana sobre lo que trajo la ficha mientras sea el MISMO funnel: una relectura que
  // salió antes de guardar no puede pisar lo que ya se ve (y se guardó).
  const [local, setLocal] = useState<FichaDelFunnel | null>(null);
  const actual = local && base && local.funnel.id === base.funnel.id ? local : base;
  const actualRef = useRef(actual);
  useLayoutEffect(() => { actualRef.current = actual; });
  // La pila del deshacer va en un ref (y su largo en el estado, para el botón): sacar de la pila no puede
  // pasar adentro de un `setState`, que React puede correr dos veces.
  const pila = useRef<FichaGuardada[]>([]);
  const [largoPila, setLargoPila] = useState(0);
  const cola = useRef<Promise<void>>(Promise.resolve());
  const enCola = useRef(0);
  const [guardando, setGuardando] = useState(false);
  const cb = useRef(o);
  useLayoutEffect(() => { cb.current = o; });

  const poner = (f: FichaDelFunnel) => { actualRef.current = f; setLocal(f); };

  const cambiar = useCallback((raw: CambioFicha, como?: { deshacer?: boolean }): void => {
    const f = actualRef.current;
    if (!f) return;
    const c = sanearCambio(raw);
    if ('error' in c) { cb.current.onError(c.error); return; }
    const r = aplicarCambio(f.guardada, c, f.eleccion.id, f.respaldo);
    if (!r.ok) { cb.current.onError(r.error); return; }
    if (!r.cambio) return;
    const efectiva: FichaEfectiva = fichaEfectiva(f.eleccion.id, r.ficha, f.respaldo);
    poner({ ...f, guardada: r.ficha, efectiva });
    enCola.current++;
    setGuardando(true);
    const funnelId = f.funnel.id;
    cola.current = cola.current.then(async () => {
      try {
        const res = await cambiarFichaFunnelAction(funnelId, c);
        if (!res.ok) throw new Error(res.error);
        if (!como?.deshacer && res.cambio) {
          pila.current = [...pila.current.slice(-(TOPE_DESHACER - 1)), res.antes];
          setLargoPila(pila.current.length);
        }
        if (enCola.current === 1) poner(res.ficha);
        cb.current.onGuardado(c);
      } catch (e) {
        cb.current.onError(e instanceof Error && e.message ? e.message : 'No se pudo guardar');
        // La verdad es lo del server: se relee, así la pantalla no dice algo que no quedó guardado.
        const v = await leerFichaFunnelAction(funnelId).catch(() => null);
        if (v?.ok) poner(v.ficha);
      } finally {
        enCola.current--;
        if (enCola.current === 0) setGuardando(false);
      }
    });
  }, []);

  const deshacer = useCallback(() => {
    const antes = pila.current[pila.current.length - 1];
    if (!antes) return;
    pila.current = pila.current.slice(0, -1);
    setLargoPila(pila.current.length);
    cambiar({ op: 'restaurar', ficha: antes }, { deshacer: true });
  }, [cambiar]);

  return { ficha: actual, cambiar, deshacer, puedeDeshacer: largoPila > 0, guardando };
}
