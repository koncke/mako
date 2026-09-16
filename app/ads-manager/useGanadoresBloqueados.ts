// =============================================================================
// useGanadoresBloqueados — qué ganadores NO se pueden reusar, preguntado UNA vez
// =============================================================================
// Lo usan los tres modales que ofrecen «★ Usar un ganador». Antes la consulta vivía
// escrita adentro de NuevaCampanaModal y los otros dos ofrecían como elegibles anuncios
// de otra página de Facebook, que Meta rechaza al publicar (1885499). Ver
// lib/ganadores-reuso.ts.
//
// null = todavía no contestó. Si la consulta falla, devuelve {}: no poder preguntar no
// apaga ganadores — si alguno no se puede, Meta lo dice al publicar y el mensaje lo
// explica (lib/meta-publicar-errores.ts).
// =============================================================================

import { useEffect, useState } from 'react';
import { bloqueadosDe, idsAConsultar, type Bloqueados } from '@/lib/ganadores-reuso';
import type { SenalRecon } from '@/lib/queries';

export function useGanadoresBloqueados(senales: SenalRecon[]): Bloqueados | null {
  const [bloqueados, setBloqueados] = useState<Bloqueados | null>(null);
  useEffect(() => {
    if (bloqueados !== null) return;
    const ids = idsAConsultar(senales);
    if (!ids.length) { setBloqueados({}); return; }
    fetch(`/api/ads-manager/targeting?kind=ganadores&ids=${encodeURIComponent(ids.join(','))}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setBloqueados(j.ok ? bloqueadosDe(j.ganadores) : {}))
      .catch(() => setBloqueados({}));
  }, [senales, bloqueados]);
  return bloqueados;
}
