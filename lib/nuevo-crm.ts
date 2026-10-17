import 'server-only';

// =============================================================================
// nuevo-crm — el alta de «Nuevo CRM» con su TIPO, una sola para la pantalla y para MaKo
// =============================================================================
// El modal del CRM (app/crm/nuevo-crm-actions.ts) y la op `crear_crm` de la API de MaKo
// (lib/api-mako/areas/crm.run.ts) crean por acá: lo que se elige ya llega saneado por
// `siembraDeCrm` (lib/pipeline.ts) y esto lo escribe. Con dos caminos, un tipo nacería con unas
// etapas desde la pantalla y con otras desde WhatsApp.
//
// ⚠️ SIN SESIÓN NI ROL ADENTRO, a propósito: la API corre con el workspace del token y sin
// cookie. El corte lo pone cada puerta (`haySesion` + admin en la action, `rolMinimo: 'admin'`
// en la def).
// =============================================================================

import { crearProductoConFunnel } from './producto-con-funnel';
import type { SiembraCrm } from './pipeline';

export type CrmCreado = { productoId: number; ofertaId: number; funnelId: number };

/**
 * Crea el producto, su oferta y su embudo (`crearProductoConFunnel`, la cadena entera) con las
 * etapas, las nutriciones apagadas y la entrada del TIPO, en el MISMO insert del embudo.
 *
 * ⚠️ HASTA EL 17/10/2026 ERAN DOS ESCRITURAS: el embudo nacía con la plantilla de su CANAL y
 * después `saveFunnelDe` le pisaba las etapas del tipo. Si la segunda fallaba, el CRM quedaba
 * creado con otras etapas y sin entrada, y la pantalla sólo podía avisarlo (`etapasDelTipo:
 * false`). Un tipo trae sus nombres (DM funnel: «Lead entrante (comentó)») o directamente otras
 * etapas (dos reuniones sobre `llamadas`, LinkedIn con la conversación antes de la llamada), así
 * que ese CRM a medias no era el que se eligió. Ahora la fila nace entera o no nace.
 * Las apagadas las suma `crearFunnel` (`apagadasAlCrear`) sobre las etapas del TIPO: las ids de
 * `suppressed` salen de las claves del pipeline.
 */
export async function crearCrm(nombre: string, siembra: SiembraCrm): Promise<CrmCreado> {
  return crearProductoConFunnel(nombre, siembra.canal, {
    pipeline: siembra.pipeline,
    suppressed: siembra.suppressed,
    extra: { entradas: siembra.entradas },
  });
}
