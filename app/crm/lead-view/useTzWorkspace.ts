'use client';

// =============================================================================
// useTzWorkspace — la zona del workspace dentro de las cards de la ficha
// =============================================================================
// Las fechas de la ficha estaban clavadas a 'America/Tijuana': un cliente en
// otro huso leía las horas del DUEÑO, no las suyas ("nada owner-only"). La zona
// real vive en un setting del workspace y solo se resuelve en el server, así que
// se pide una vez y se comparte.
//
// PRIMER RENDER = TZ_TIJUANA, a propósito. Estas cards se renderizan también en
// el SSR de /crm/[id] (GeneratedInsightCard y TrackingTimelineCard reciben datos
// por props y pintan timestamps ya en el primer paint). Si el valor inicial
// fuera la zona del navegador, el server —que no la conoce— pintaría otra hora y
// React reventaría la hidratación. El fallback tiene que ser el MISMO de los dos
// lados; recién después del efecto entra la zona verdadera.

import { useEffect, useState } from 'react';
import { TZ_TIJUANA } from '@/lib/date-utils';
import { tzWorkspaceAction } from './tz-workspace';

// Memo a nivel de módulo: la ficha monta hasta cinco cards que necesitan la
// zona, y sin esto serían cinco POST de server action por apertura. Vive lo que
// vive la pestaña: cambiar de workspace (PanelAgencia) hace `location.href`, o
// sea recarga entera, así que el valor no puede quedar viejo.
//
// OJO: solo se escribe desde el efecto, que nunca corre en el server. Si se
// llenara durante el SSR, el módulo es compartido entre requests y la zona de un
// inquilino le llegaría al siguiente.
let cache: string | null = null;
let enVuelo: Promise<string> | null = null;

function pedirTz(): Promise<string> {
  if (!enVuelo) {
    enVuelo = tzWorkspaceAction()
      .then((tz) => { cache = tz; return tz; })
      .catch(() => { enVuelo = null; return TZ_TIJUANA; }); // que falle una vez no congela el fallback
  }
  return enVuelo;
}

/** Zona IANA del workspace. Devuelve TZ_TIJUANA hasta que el server contesta. */
export function useTzWorkspace(): string {
  const [tz, setTz] = useState<string>(() => cache ?? TZ_TIJUANA);
  useEffect(() => {
    let vivo = true;
    void pedirTz().then((r) => { if (vivo) setTz((prev) => (prev === r ? prev : r)); });
    return () => { vivo = false; };
  }, []);
  return tz;
}
