// =============================================================================
// prueba-landing-server — enchufa la prueba A/B de una landing a la base (O18, L2; 18/11/2026)
// =============================================================================
// La decisión vive en ./prueba-landing-servir.ts (sin base, con test); acá sólo se le pasan las piezas reales: la prueba
// viva del lugar (`pruebaVivaDe`, que sin la migración «pruebas_ab» devuelve null), `servirRama` del store (escribe la
// asignación o devuelve el control) y el mismo saneo de la config con que se sirve A. Lo usan las rutas de una página
// publicada: app/l/[slug], app/l/[slug]/[ruta] y el dominio propio (app/api/landing-generator/dominio).
//
// ⚠️ Una lectura por pedido. El borde de Vercel guarda la página SIN prueba 30 s (CACHE_BORDE), así que sin prueba esta
// lectura corre en los MISS, no en cada visita (la crítica 27 pedía una marca en la fila: eso es una migración).
// =============================================================================

import 'server-only';
import { randomUUID } from 'node:crypto';
import { pruebaVivaDe, servirRama } from '../pruebas/store';
import { limpiarConfig } from './server';
import { servirPruebaDeLanding, type PruebaServida, type SitioServible } from './prueba-landing-servir';

export async function probarLanding(sitio: SitioServible, ruta: string, req: Request): Promise<PruebaServida | null> {
  return servirPruebaDeLanding(sitio, ruta, req, {
    pruebaViva: pruebaVivaDe,
    servirRama: (ws, p, unidad, o) => servirRama(ws, p, unidad, o),
    normalizarConfig: (c) => limpiarConfig(c, 'prueba A/B').config,
    nuevoVisitante: () => randomUUID(),
    avisar: (t) => console.warn(t),
  });
}
