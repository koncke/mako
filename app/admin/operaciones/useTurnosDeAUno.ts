'use client';
// =============================================================================
// LOS TURNOS DE UN CHAT SALEN DE A UNO, CON SUS PUNTITOS, MIENTRAS SE LO MIRA (20/11/2026, la auditoría de los chats: admin-5)
// =============================================================================
// Un chat que escribe dos o más turnos entre dos sondeos (2,5 a 8 s) los mostraba juntos: `setTurnos` reemplaza la lista entera
// (useCentro.ts → pedirTurnos). Ahora pasan por la cola de salida compartida (app/_chat/useColaDeSalida.ts): de a uno, con los
// puntitos de `msEscribiendo`. Lo que ya estaba cuando el chat terminó de cargar (`listo`: llegaron sus turnos) es la HISTORIA y se
// dibuja de una vez; al abrir otro chat, lo suyo también. El porqué y lo puro: ./hilo-a-la-vista.ts.
// =============================================================================
import { useMemo, useRef } from 'react';
import type { LineaChat } from '@/lib/centro-chats';
import { useColaDeSalida } from '@/app/_chat/useColaDeSalida';
import { filasDeLaCola, lineasALaVista } from './hilo-a-la-vista';

const SIN_HISTORIAL = (): string[] => [];

/** `clave`: el chat abierto. `listo`: sus turnos ya llegaron (antes de eso no hay qué soltar). */
export function useTurnosDeAUno(clave: string, lineas: readonly LineaChat[], listo: boolean): { lineas: readonly LineaChat[]; escribiendo: boolean; empezoLaEspera: () => void } {
  const historia = useRef<{ clave: string; ids: ReadonlySet<string> } | null>(null);
  // La historia de ESTE chat: lo que había cuando terminó de cargar. Se toma una vez por chat abierto.
  if (listo && historia.current?.clave !== clave) historia.current = { clave, ids: new Set(filasDeLaCola(lineas).map((f) => f.id)) };
  const h = listo && historia.current?.clave === clave ? historia.current : null;
  const nuevas = useMemo(() => (h ? filasDeLaCola(lineas).filter((f) => !h.ids.has(f.id)) : []), [lineas, h]);
  const cola = useColaDeSalida(nuevas, { historial: SIN_HISTORIAL });
  const aLaVista = useMemo(() => (h ? lineasALaVista(lineas, h.ids, new Set(cola.visibles.map((f) => f.id))) : lineas), [lineas, h, cola.visibles]);
  return { lineas: aLaVista, escribiendo: cola.escribiendo, empezoLaEspera: cola.empezoLaEspera };
}
