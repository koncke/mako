'use client';

// =============================================================================
// useFichaDelFunnel — la ficha del funnel del lead mientras se personaliza: guarda sola, con «Deshacer»
// =============================================================================
// Como el Dashboard: sin botón «Guardar». Cada cambio (un `CambioFicha`, lib/ficha/config.ts) se ve EN EL
// ACTO y se manda en COLA a `cambiarFichaFunnelAction`, que lo aplica sobre lo de hoy con compare-and-set.
// La cola, la pila del deshacer y lo que se ve cuando algo falla viven en ./guardado-ficha.ts, que es puro y
// se prueba ejecutándolo (tests/ficha-guardado.test.ts); acá sólo se enchufa a React y a las server actions.
// =============================================================================

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { CambioFicha } from '@/lib/ficha/config';
import type { FichaDelFunnel } from '@/lib/ficha/config-server';
import { cambiarFichaFunnelAction, leerFichaFunnelAction } from '../../ficha-actions';
import { crearGuardado, type EstadoGuardado, type Guardado } from './guardado-ficha';

/** Lo que cambia los AVISOS de «datos sin marcar»: después de guardarlo, la cabecera se recuenta. */
export const cambiaAvisos = (c: CambioFicha): boolean =>
  c.op === 'aviso' || c.op === 'avisos' || c.op === 'plantilla' || c.op === 'restaurar' || (c.op === 'volver' && !c.tab);

export function useFichaDelFunnel(base: FichaDelFunnel | null, o: { onGuardado: (c: CambioFicha) => void; onError: (msg: string) => void }) {
  // Lo de esta sesión gana sobre lo que trajo la ficha mientras sea el MISMO funnel: una relectura que
  // salió antes de guardar no puede pisar lo que ya se ve (y se guardó).
  const [local, setLocal] = useState<FichaDelFunnel | null>(null);
  const actual = local && base && local.funnel.id === base.funnel.id ? local : base;
  const actualRef = useRef(actual);
  useLayoutEffect(() => { actualRef.current = actual; });
  const cb = useRef(o);
  useLayoutEffect(() => { cb.current = o; });
  const [estado, setEstado] = useState<EstadoGuardado>({ guardando: false, pasos: {} });
  // UN motor por ficha montada: la cola y la pila viven lo que vive la pantalla. Se crea al primer uso, adentro
  // de un evento (las refs no se leen durante el render).
  const g = useRef<Guardado | null>(null);
  const motor = useCallback((): Guardado => {
    g.current ??= crearGuardado({
      verActual: () => actualRef.current,
      poner: (f) => { actualRef.current = f; setLocal(f); },
      guardar: async (funnelId, c) => await cambiarFichaFunnelAction(funnelId, c),
      leer: (funnelId) => leerFichaFunnelAction(funnelId),
      onGuardado: (c) => cb.current.onGuardado(c),
      onError: (m) => cb.current.onError(m),
      onEstado: setEstado,
    });
    return g.current;
  }, []);
  const cambiar = useCallback((c: CambioFicha) => motor().cambiar(c), [motor]);
  const deshacer = useCallback(() => motor().deshacer(), [motor]);

  // Deshacer es de la ficha que se ve: si la casa del lead cambió, la de su funnel nuevo (./guardado-ficha.ts).
  const puedeDeshacer = !!actual && (estado.pasos[actual.funnel.id] ?? 0) > 0;
  return { ficha: actual, cambiar, deshacer, puedeDeshacer, guardando: estado.guardando };
}
