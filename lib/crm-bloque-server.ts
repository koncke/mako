import 'server-only';

// =============================================================================
// crm-bloque-server — las acciones EN BLOQUE del CRM para la API de MaKo (28/10/2026, tickets #21 y #22 de Leila)
// =============================================================================
// La barra del tablero (app/crm/AccionesLoteLeads.tsx) manda de a tandas desde el navegador; MaKo no tiene navegador: con
// UN «sí» tiene que pasar los 394 de una columna. Esto es el mismo trabajo, con las MISMAS piezas, para quien corre sin
// sesión y en una sola invocación (la de WhatsApp, la del chat y la bandeja tienen 420 s; `hasta` lo pone quien llama):
//   · pasar a otra columna: a un AGREGADO, en su fila (`moverEtapaEnProducto`); al de la casa, `setPipelineStage`, como el
//     cambio de etapa de MaKo de a uno (lib/mako-doer-acciones.ts), con lo que falta DICHO en el historial (`omitir`);
//   · pasar a otro funnel: `pasarLoteAOtroFunnel` (lib/lead-funnel.ts), el de la barra;
//   · la papelera: lib/leads-papelera.ts, la de la barra.
// Lo que no llega en el plazo vuelve en `pendientes`, y MaKo lo dice: nunca un corte callado.

import { setPipelineStage } from './leads';
import { agregadosDelCrm, moverEtapaEnProducto } from './lead-funnel';
import { conLoteDeEtiquetas } from './etiquetas';

/** Por qué un movimiento en bloque de MaKo no se frena por lo que la etapa pide: va al historial de cada uno. */
const OMITIR = 'Movido en bloque por MaKo con UNA confirmación: lo que la etapa pida y falte queda pendiente en la ficha.';

/** Pasa `ids` a la etapa `key` del CRM `funnelId` (null = el del negocio). `motivo`: el de descalificar o perder. */
export async function pasarEnBloqueAColumna(ids: readonly number[], funnelId: number | null, key: string, o: { motivo?: string | null; autor: string; hasta: number }): Promise<{
  movidos: number; fallaron: number; motivos: string[]; pendientes: number[];
}> {
  const todos = [...new Set(ids)].filter((n) => Number.isInteger(n) && n > 0);
  const agregados = await agregadosDelCrm(todos, funnelId);
  const pendientes: number[] = [];
  const motivos = new Set<string>();
  let movidos = 0, fallaron = 0;
  // Las etiquetas espejadas de la etapa se sincronizan al final, no lead por lead (ver `moverLeadsDeEtapaAction`).
  await conLoteDeEtiquetas(async () => {
    for (const id of todos) {
      if (Date.now() > o.hasta) { pendientes.push(id); continue; }
      try {
        const real = agregados.get(id);
        if (real != null) await moverEtapaEnProducto(id, real, key, { autor: o.autor, enLote: true });
        else await setPipelineStage(id, key, { motivo: o.motivo?.trim() || null, autor: o.autor, requisitos: { omitir: OMITIR } });
        movidos += 1;
      } catch (e) {
        fallaron += 1;
        motivos.add(e instanceof Error ? e.message : 'no se pudo');
      }
    }
  });
  return { movidos, fallaron, motivos: [...motivos], pendientes };
}
