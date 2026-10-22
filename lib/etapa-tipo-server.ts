// =============================================================================
// etapa-tipo-server — cambiar el TIPO de una etapa (Etapa / Reunión / Nutrición) y guardarlo
// =============================================================================
// Era el cuerpo de la op `tipo` de `editarEtapaAction` (app/crm/actions.ts) y se mudó acá el 21/10/2026 para que lo
// use también la API de MaKo (`cambiar_tipo_etapa`, lib/api-mako/areas/crm.run.ts): Martín pidió «Tipo de etapa» en el
// «⋯» de cada columna, y toda acción nueva va al registro de la API. Dos copias de cómo se guarda un tipo serían dos
// reglas sobre qué banda le toca (lib/etapa-banda.ts → `cambiarTipo`) y qué transiciones se apagan.
//
// Quien llama ya pasó su puerta (la action exige admin; la API, `rolMinimo: 'admin'`) y limpia los cachés a su manera
// (`bust`/`revalidatePath` en la action, `invalidar` en la API).
// =============================================================================

import 'server-only';
import { getFunnelDe, getFunnelDefault, saveFunnelDe, saveFunnelDefault } from './funnels';
import { conTerminales } from './pipeline';
import { cambiarTipo } from './etapa-banda';
import { TIPOS_ETAPA, type TipoEtapa } from './etapa-reunion';

/**
 * Cambia el tipo de la etapa `key` del funnel `funnelId` (null = el del negocio) y lo guarda: el pipeline, las
 * transiciones apagadas (una nutrición de catálogo que sube apaga las suyas), los nombres y el orden de la banda.
 * `at`: dónde cae en su lista de destino (lo manda el arrastre del pop-up de etapas; sin él, lo más cerca).
 */
export async function cambiarTipoDeEtapa(funnelId: number | null, key: string, tipo: TipoEtapa, at?: number): Promise<{ ok: true } | { ok: false; error: string }> {
  // Un tipo que no existe no se guarda: la op la escribe quien quiera.
  if (!TIPOS_ETAPA.includes(tipo)) return { ok: false, error: 'Ese tipo de etapa no existe.' };
  const actual = funnelId != null ? await getFunnelDe(funnelId) : await getFunnelDefault();
  // ⚠️ Con la lectura en ERROR lo que se lee es el pipeline GENÉRICO, y guardarlo le pisa al cliente su funnel real.
  if (actual.origen === 'error') return { ok: false, error: 'No se pudo leer el funnel; no se guardó nada para no pisarlo. Vuelve a intentarlo.' };
  const ordenAhora = actual.stages.filter((x) => x.band === 'nutricion').map((x) => x.key);
  const r = cambiarTipo({ pipeline: actual.pipeline, suppressed: actual.suppressed, labels: actual.labels, ordenNutricion: ordenAhora }, key, tipo,
    typeof at === 'number' && Number.isFinite(at) ? at : undefined);
  if (!r.ok) return r;
  const conGanado = conTerminales(r.estado.pipeline);
  const extra = { labels: r.estado.labels, ordenNutricion: r.estado.ordenNutricion };
  if (funnelId != null) await saveFunnelDe(funnelId, conGanado, r.estado.suppressed, extra);
  else await saveFunnelDefault(conGanado, r.estado.suppressed, extra);
  return { ok: true };
}
