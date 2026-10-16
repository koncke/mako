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
import { saveFunnelDe } from './funnels';
import { apagadasAlCrear, type SiembraCrm } from './pipeline';

export type CrmCreado = {
  productoId: number;
  ofertaId: number;
  funnelId: number;
  /** false = el CRM quedó creado con las etapas de su canal, sin las del tipo ni la entrada. */
  etapasDelTipo: boolean;
  /** Si `etapasDelTipo` es false, por qué (para decirlo, no para tirarlo). */
  motivo?: string;
};

/**
 * Crea el producto, su oferta y su embudo (`crearProductoConFunnel`, la cadena entera) y le
 * escribe las etapas y la entrada del tipo.
 *
 * ⚠️ SON DOS ESCRITURAS, y la segunda puede fallar con el CRM ya creado. `crearProductoConFunnel`
 * sólo sabe sembrar la plantilla del CANAL (`templateDeCanal`), y un tipo trae sus nombres (DM
 * funnel: «Lead entrante (comentó)») o directamente otras etapas (dos reuniones sobre `llamadas`,
 * LinkedIn con la conversación antes de la llamada). Si la segunda falla NO se tira: el CRM
 * existe y se ve en el desplegable, así que tirar haría que la persona lo vuelva a crear y quede
 * duplicado. Vuelve `etapasDelTipo: false` con el motivo, y las etapas se ajustan en su lápiz.
 * Lo que lo deja en UNA sola escritura es que `crearProductoConFunnel` reciba las etapas.
 */
export async function crearCrm(nombre: string, siembra: SiembraCrm): Promise<CrmCreado> {
  const creado = await crearProductoConFunnel(nombre, siembra.canal);
  try {
    // Las apagadas se vuelven a calcular sobre las etapas del TIPO: las ids de `suppressed` salen
    // de las claves del pipeline, y las que calculó el alta eran las de la plantilla del canal.
    await saveFunnelDe(creado.funnelId, siembra.pipeline, apagadasAlCrear(siembra.pipeline, siembra.suppressed), { entradas: siembra.entradas });
    return { ...creado, etapasDelTipo: true };
  } catch (e) {
    console.error(`[nuevo-crm] el funnel #${creado.funnelId} quedó con las etapas de su canal: ${e instanceof Error ? e.message : String(e)}`);
    return { ...creado, etapasDelTipo: false, motivo: e instanceof Error ? e.message : String(e) };
  }
}
