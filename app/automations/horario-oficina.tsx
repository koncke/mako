'use client';
// =============================================================================
// horario-oficina — el horario de oficina del negocio, para la tarjeta «MaKo en WhatsApp» del lienzo (15/10/2026)
// =============================================================================
// La tarjeta ofrece «Fuera del horario: Espera a que abra / Lo manda igual» SÓLO si el negocio tiene horario, y su chip
// dice cuándo saldría («Espera a que abra (mañana 9:00)», `chipDeEspera`). Lo lee el SERVER una vez
// (app/automations/page.tsx: lo mismo que Configuraciones › Horario, con la zona del negocio) y lo reparte este contexto:
// el lienzo tiene muchas tarjetas y cada una no puede pedirlo. Guardado desde el botón «Configuraciones» de Automations,
// el contexto toma lo guardado (`useFijarHorarioOficina`). Sin proveedor, o sin poder leerlo, null: no se ofrece lo que
// no se sabe.
import { createContext, useContext, useState, type ReactNode } from 'react';
import type { HorarioEnvio } from '@/lib/horario-envio';

export type HorarioOficina = { horario: HorarioEnvio | null; zona: string };

const CtxOficina = createContext<{ valor: HorarioOficina | null; fijar: (h: HorarioEnvio) => void }>({ valor: null, fijar: () => {} });

export function HorarioOficinaProvider({ valor, children }: { valor: HorarioOficina | null; children: ReactNode }) {
  const [actual, setActual] = useState(valor);
  const fijar = (h: HorarioEnvio) => setActual((v) => (v ? { ...v, horario: h.activo ? h : null } : v));
  return <CtxOficina.Provider value={{ valor: actual, fijar }}>{children}</CtxOficina.Provider>;
}

/** El horario PRENDIDO del negocio (null si no tiene) y su zona; null si no se pudo leer. */
export const useHorarioOficina = (): HorarioOficina | null => useContext(CtxOficina).valor;

/** Para quien GUARDA el horario dentro de Automations: el lienzo se pone al día sin recargar. */
export const useFijarHorarioOficina = (): ((h: HorarioEnvio) => void) => useContext(CtxOficina).fijar;
