'use client';

// =============================================================================
// Lo que MaKo terminó en otra tab, en la estrella (22/10/2026)
// =============================================================================
// Martín: «Se debe ejecutar en segundo plano», y si se va a otra tab, que le avise cuando MaKo termine. El Cerebro: «la estrella
// con su globito alcanza». El turno del chat de Automations sigue aunque la persona se vaya; si termina sin que nadie lo mire,
// queda en lib/mako-trabajos.ts (del chat Automations) y sale un evento de `window`. La estrella lo suma a su globito y, abierta,
// lo dice arriba del hilo con su link. Al volver a esa automatización, Automations lo marca visto (`marcarTrabajoVisto`).
// ⚠️ EL LINK ES EL DE LA CASA (`@/app/_ui/Link`): pone el `?ws=` y navega SIN recargar. La lista vive en la pestaña; un <a> a
//    mano recargaba la página y la borraba antes de que Automations la marcara vista.
// =============================================================================

import { useEffect, useState } from 'react';
import Link from '@/app/_ui/Link';
import { EVENTO_TRABAJO_MAKO, trabajosSinVer, type TrabajoTerminado } from '@/lib/mako-trabajos';

/** Lo que MaKo terminó sin que nadie lo mirara: la lista entera, al montar y cada vez que cambia. */
export function useTrabajosSinVer(): readonly TrabajoTerminado[] {
  const [trabajos, setTrabajos] = useState<readonly TrabajoTerminado[]>([]);
  useEffect(() => {
    setTrabajos(trabajosSinVer());
    const oir = (e: Event) => setTrabajos((e as CustomEvent<readonly TrabajoTerminado[]>).detail ?? trabajosSinVer());
    window.addEventListener(EVENTO_TRABAJO_MAKO, oir);
    return () => window.removeEventListener(EVENTO_TRABAJO_MAKO, oir);
  }, []);
  return trabajos;
}

/** «MaKo terminó en Automations › Sprint · apertura»; si terminó con un error, se dice. */
export const textoDelTrabajo = (t: Pick<TrabajoTerminado, 'ok' | 'tab' | 'titulo'>): string =>
  `${t.ok ? 'MaKo terminó' : 'MaKo no pudo terminar'} en ${t.tab} › ${t.titulo}`;

/** Arriba del hilo de la estrella, el más nuevo primero: cada uno lleva adonde se ve. */
export function TrabajosTerminados({ trabajos }: { trabajos: readonly TrabajoTerminado[] }) {
  if (!trabajos.length) return null;
  return (
    <ul className="ch-trabajos" aria-label="Lo que MaKo terminó">
      {[...trabajos].reverse().map((t) => (
        <li key={t.href}>
          <Link href={t.href} className="ch-trabajos__link" data-ok={t.ok ? undefined : 'no'} title={t.texto}>{textoDelTrabajo(t)}</Link>
        </li>
      ))}
    </ul>
  );
}
