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
//
// ⚠️ EL AVISO DICE QUÉ ETAPA, QUÉ FUNNELS Y QUÉ HACER (12/11/2026, ticket #90). Decía «El CRON quedó en esa etapa de todos
//    tus funnels: revisa cuál» —sin decir cuál etapa ni cuáles funnels— y salía en rojo, con «Reportar a Soporte»: «Sellers»
//    (ws24) pegó «Un Lead Entró 2», su «lead» está en «Sellers» y en «Captaciones», y lo reportó como un error. No lo era:
//    sus funnels están bien y la automatización escucha en los dos. Ahora el aviso los nombra (`avisoDeCron`) y la pantalla
//    lo dibuja como aviso, no como error (`avisoNueva`, app/automations/SimuladorWhatsApp.tsx).
// PURO: lo usa lib/flujo-copia-negocio.ts (`crearDesdeCopia`) y lo prueba tests/copia-disparador.test.ts.
// =============================================================================

import { etapasDe, TRIGGER_ETAPA } from './nutricion-etapa';
import type { Disparador } from './disparadores';

export type EmbudoDeAca = { funnelId: number | null; nombre: string; etapas: ReadonlyArray<{ value: string; label?: string }> };

export type CronDeAca = { lista: Disparador[]; aviso: string };

/** «A», «A y B», «A, B y C», y con más de `max`, «A, B, C y 2 más». */
function enLista(xs: readonly string[], max = 3): string {
  if (xs.length <= 1) return xs[0] ?? '';
  if (xs.length > max) return `${xs.slice(0, max).join(', ')} y ${xs.length - max} más`;
  return `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`;
}

/** Cómo se llama la etapa en el kanban (la del primer embudo que la tiene con nombre), o su clave. */
function nombreEtapa(key: string, embudos: readonly EmbudoDeAca[]): string {
  for (const e of embudos) {
    const l = e.etapas.find((x) => x.value === key)?.label?.trim();
    if (l) return l;
  }
  return key;
}

/**
 * El aviso de lo que se puso: las etapas y los funnels por su nombre, y si quedó en varios, qué hacer. `enTodos`: las
 * etapas que quedaron en todos los funnels que las tienen (con esos funnels); `enUno`: las que quedaron en el único.
 */
export function avisoDeCron(p: { enTodos: ReadonlyArray<{ etapas: string[]; funnels: string[] }>; enUno: ReadonlyArray<{ etapas: string[]; funnel: string }> }): string {
  const comillas = (xs: readonly string[]) => xs.map((x) => `«${x}»`);
  const t = p.enTodos[0];
  if (t) {
    return `El CRON escucha ${enLista(comillas(t.etapas))} en tus ${t.funnels.length} funnels: ${enLista(comillas(t.funnels))}. `
      + 'Si es para uno solo, abre el CRON y elige la etapa de ese funnel.';
  }
  const u = p.enUno[0];
  return u ? `El CRON quedó en ${enLista(comillas(u.etapas))} de tu funnel «${u.funnel}».` : 'El CRON quedó en tu funnel.';
}

export function cronParaEsteNegocio(ds: readonly Disparador[], embudos: readonly EmbudoDeAca[]): CronDeAca | null {
  let cambio = false;
  const lista: Disparador[] = [];
  const enTodos: Array<{ etapas: string[]; funnels: string[] }> = [];
  const enUno: Array<{ etapas: string[]; funnel: string }> = [];
  for (const d of ds) {
    if (d.trigger_tipo !== TRIGGER_ETAPA) { lista.push(d); continue; }
    const keys = etapasDe({ etapa: d.etapa ?? null, etapas: d.etapas ?? null });
    if (!keys.length) return null;
    const conTodas = embudos.filter((e) => e.funnelId != null && keys.every((k) => e.etapas.some((x) => x.value === k)));
    if (d.funnel_id != null && conTodas.some((e) => e.funnelId === d.funnel_id)) { lista.push(d); continue; }
    if (!conTodas.length) return null;
    cambio = true;
    const etapas = keys.map((k) => nombreEtapa(k, conTodas));
    if (conTodas.length === 1) {
      lista.push({ ...d, funnel_id: conTodas[0].funnelId });
      enUno.push({ etapas, funnel: conTodas[0].nombre });
    } else {
      lista.push({ ...d, funnel_id: null });
      enTodos.push({ etapas, funnels: conTodas.map((e) => e.nombre) });
    }
  }
  if (!cambio) return null;
  return { lista, aviso: avisoDeCron({ enTodos, enUno }) };
}
