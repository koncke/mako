// =============================================================================
// copia-disparador — el CRON de una automatización copiada, en el EMBUDO de este negocio (17/10/2026, tarjeta #882)
// =============================================================================
// Martín en la revisión del 16/10 (48:23): al pegar en otro negocio «saltó un error que dice: elige qué la dispara, su
// etapa no está en su negocio». Y la copia nacía con el disparador en MANUAL: la «Un Lead Entró 2» de Brigitte (ws15, #266)
// quedó así, prendida, sin escuchar nada (tarjeta #868, docs/hallazgos-chatbot.md).
//
// La etapa casi siempre SÍ está: lo que no está es el EMBUDO de origen (su id es del otro negocio). Por eso se busca la
// MISMA etapa (por su clave, «lead», «agenda»…) en los embudos de acá:
//   · en UNO solo → ése;
//   · en VARIOS → todos (`funnel_id: null`, la etapa en cualquiera de los embudos del negocio: así estaban las 62 filas de
//     antes del embudo por automatización), y se dice para que lo revise;
//   · en NINGUNO → no se adivina: queda «Elige qué la dispara», como hasta hoy.
// Sólo el CRON de etapa. Uno de etiqueta o de entrega apunta a un id que acá no existe, y eso no se reemplaza a ciegas.
// PURO: lo usa lib/flujo-copia-negocio.ts (`crearDesdeCopia`) y lo prueba tests/copia-disparador.test.ts.
// =============================================================================

import { etapasDe, TRIGGER_ETAPA } from './nutricion-etapa';
import type { Disparador } from './disparadores';

export type EmbudoDeAca = { funnelId: number | null; nombre: string; etapas: ReadonlyArray<{ value: string }> };

export type CronDeAca = { lista: Disparador[]; aviso: string };

export function cronParaEsteNegocio(ds: readonly Disparador[], embudos: readonly EmbudoDeAca[]): CronDeAca | null {
  let cambio = false;
  let varios = false;
  const lista: Disparador[] = [];
  for (const d of ds) {
    if (d.trigger_tipo !== TRIGGER_ETAPA) { lista.push(d); continue; }
    const keys = etapasDe({ etapa: d.etapa ?? null, etapas: d.etapas ?? null });
    if (!keys.length) return null;
    const conTodas = embudos.filter((e) => e.funnelId != null && keys.every((k) => e.etapas.some((x) => x.value === k)));
    if (d.funnel_id != null && conTodas.some((e) => e.funnelId === d.funnel_id)) { lista.push(d); continue; }
    if (!conTodas.length) return null;
    cambio = true;
    if (conTodas.length === 1) lista.push({ ...d, funnel_id: conTodas[0].funnelId });
    else { varios = true; lista.push({ ...d, funnel_id: null }); }
  }
  if (!cambio) return null;
  return { lista, aviso: varios ? 'El CRON quedó en esa etapa de todos tus funnels: revisa cuál.' : 'El CRON quedó en esa etapa de tu funnel.' };
}
