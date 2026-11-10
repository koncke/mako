'use client';

// =============================================================================
// VelocidadVivo — la hoja «Velocidad de llamada» con su diseño (./HojaVelocidad.tsx, la copia de Tend) y los datos de VERDAD
// =============================================================================
// HojaVelocidad sólo dibuja (la usa también la miniatura de «Nueva hoja», con datos de ejemplo). Aquí se arma lo vivo con los datos
// de los componentes de la hoja (`datos`, los que la página ya leyó). lib/velocidad-diseno.ts arma lo que dibuja cada tarjeta, con
// test. Lo carga DisenoVivo con next/dynamic; `onCambio` es su `refrescar` (después de grabar una llamada, la hoja vuelve a leer).
// La hora de ahora (la raya roja de «Llamadas de hoy») va en la zona de las horas de las llamadas (`horaTj`, lib/graficos-lectura.ts),
// y se calcula después de montar: en el server no hay «ahora» que coincida con el del navegador.
// =============================================================================

import { useMemo } from 'react';
import type { Grafico, Hoja } from '@/lib/graficos-catalogo';
import { vistaVelocidad, type DatosPieza } from '@/lib/velocidad-diseno';
import { TZ_TIJUANA } from '@/lib/date-utils';
import { useAhora } from '@/app/general/bloques/comun';
import { HojaVelocidad } from './HojaVelocidad';

/** Quién mira: el saludo, su nombre y el negocio (lo arma la página, como el de Comercial). */
export type ExtrasVelocidad = { quien: { saludo: string; nombre: string; negocio?: string } | null };

/** La hora de un instante como número (9:30 → 9.5), en la zona de las horas de las llamadas. */
export function horaDecimal(iso: string): number | null {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: TZ_TIJUANA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms));
  const h = Number(p.find((x) => x.type === 'hour')?.value), m = Number(p.find((x) => x.type === 'minute')?.value);
  return Number.isFinite(h) && Number.isFinite(m) ? (h % 24) + m / 60 : null;
}

export default function VelocidadVivo({ hoja, hoy, datos, extras, periodo, onFila, onCambio, compartido }: {
  hoja: Hoja; hoy: string; datos: Record<string, DatosPieza>; extras: ExtrasVelocidad | null; periodo: string;
  onGrilla?: () => void; onFila?: (g: Grafico, clave: string) => void; onCambio?: () => void; compartido?: boolean;
}) {
  const vista = useMemo(() => vistaVelocidad(hoja, datos, periodo), [hoja, datos, periodo]);
  const ahoraIso = useAhora();
  const quien = extras?.quien ?? null;
  const saludo = quien?.nombre ? `${quien.saludo}, ${quien.nombre}` : hoja.nombre;
  return (
    <HojaVelocidad hoja={hoja} vista={vista} saludo={saludo} negocio={quien?.negocio?.trim() || null} hoy={hoy} periodo={periodo}
      ahora={ahoraIso ? horaDecimal(ahoraIso) : null} onFila={onFila} onCambio={onCambio} compartido={compartido} />
  );
}
