// =============================================================================
// plantillas-sugeridas-server — de dónde salen las señales para sugerir plantillas (la mitad que lee la base)
// =============================================================================
// La regla vive en lib/plantillas-sugeridas.ts (`senalesDe`, pura y con test); acá sólo se lee lo guardado, cada cosa
// por su lector de siempre y en paralelo: los funnels (`canalesYEntradasDeFunnels`, lib/funnels.ts), el diagnóstico de
// fase (lib/fase-store.ts), las ofertas (lib/ofertas.ts) y los productos (lib/productos.ts). Sin IA.
//
// ⚠️ CADA FUENTE DEGRADA SOLA, y está bien que así sea: lo peor que pasa sin una es la galería en el orden de siempre.
//    Lo que no se pierde es el log: cada lector escribe el suyo.
// =============================================================================

import 'server-only';
import { canalesYEntradasDeFunnels } from './funnels';
import { getDiagnosticoFase } from './fase-store';
import { listarOfertas } from './ofertas';
import { listProductos } from './productos';
import { senalesDe, type SenalesNegocio } from './plantillas-sugeridas';

const avisar = (fuente: string) => (e: unknown) => {
  console.warn(`[plantillas-sugeridas] ${fuente}: ${e instanceof Error ? e.message : String(e)}`);
  return null;
};

/** Las señales del negocio ACTUAL para ordenar una galería. `null` = no declaró nada (o no se pudo leer nada). */
export async function senalesDelNegocio(): Promise<SenalesNegocio | null> {
  const [funnels, fase, ofertas, productos] = await Promise.all([
    canalesYEntradasDeFunnels().catch(avisar('funnels')),
    getDiagnosticoFase().catch(avisar('diagnóstico de fase')),
    listarOfertas(true).catch(avisar('ofertas')),
    listProductos(true).catch(avisar('productos')),
  ]);
  return senalesDe({ funnels: funnels ?? [], fase, ofertas: ofertas ?? [], productos: productos ?? [] });
}
