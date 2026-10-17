// =============================================================================
// La construcción de MaKo, leída del registro de /admin/dev, para el grafo del super admin (17/10/2026)
// =============================================================================
// Junta cada área con bitácora (app/admin/dev/registros.ts) con su ficha (app/admin/dev/areas.ts) y se la pasa al
// armado puro (lib/cerebro-construccion.ts). Todo viaja en el build: no hay lectura de base.
// ⚠️ SÓLO PARA QUIEN OPERA: lo llama `mapaDelSecondBrain` (app/second-brain/pagina.tsx) adentro de `puedeOperar`. A un
//    cliente no se le arma ni se le manda.
// =============================================================================

import 'server-only';
import { AREAS } from '@/app/admin/dev/areas';
import { REGISTROS_SLUGS, registroDe } from '@/app/admin/dev/registros';
import { armarConstruccion, type AreaDeObra } from './cerebro-construccion';
import type { Cerebro } from './cerebro-modelo';

/** El grafo armado, por 10 minutos: las bitácoras viajan en el build (no cambian entre deploys) y el layout de ~180
 *  nodos cuesta segundos. La ventana de los chats jefe (14 días) no se mueve en 10 minutos. */
const VIGENCIA_MS = 10 * 60_000;
let guardado: { t: number; cerebro: Cerebro<string> } | null = null;

export function construccionDeMako(ahora = Date.now()): Cerebro<string> {
  if (guardado && ahora - guardado.t < VIGENCIA_MS) return guardado.cerebro;
  const cerebro = armarDeLasBitacoras(ahora);
  guardado = { t: ahora, cerebro };
  return cerebro;
}

function armarDeLasBitacoras(ahora: number): Cerebro<string> {
  const areas: AreaDeObra[] = REGISTROS_SLUGS.map((slug) => {
    const a = AREAS.find((x) => x.slug === slug);
    const r = registroDe(slug);
    return {
      slug, titulo: a?.titulo ?? slug, familia: a?.familia ?? 'Platform', estado: a?.estado ?? 'parcial',
      alcance: a?.alcance ?? '', nota: a?.nota, vive: a?.vive ?? [], partes: r.partes, bitacora: r.bitacora,
    };
  });
  return armarConstruccion(areas, ahora);
}
