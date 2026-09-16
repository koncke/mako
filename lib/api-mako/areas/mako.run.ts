// =============================================================================
// api-mako/areas/mako.run — los cuerpos del área `mako`
// =============================================================================
// Las tres de pendientes delegan en lib/api-mako/acciones.ts, que es donde vive el
// ciclo (reclamar → ejecutar → resolver). Nada de lógica acá.
// =============================================================================

import 'server-only';
import type { Runners } from '../tipos';
import { listarPendientes, confirmarPendiente, cancelarPendiente } from '../acciones';

const num = (input: Record<string, unknown>, k: string): number | null => {
  const v = input[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};

export const RUNNERS: Runners = {
  listar_pendientes: {
    leer: async (_input, ctx) => {
      const vig = await listarPendientes(ctx);
      if (!vig.length) return 'No hay acciones pendientes de confirmar.';
      return JSON.stringify(vig.map((p) => ({ id: p.id, resumen: p.resumen, origen: p.origen, vence: p.vence })));
    },
  },
  confirmar_accion: {
    correr: async (input, ctx) => {
      const r = await confirmarPendiente(ctx, num(input, 'id'));
      if ('error' in r) return JSON.stringify({ ok: false, error: r.error, ...(r.vigentes ? { vigentes: r.vigentes } : {}) });
      return r.ok ? `✅ Hecho: ${r.resumen}` : `❌ No se pudo: ${r.resumen}`;
    },
  },
  cancelar_accion: {
    correr: async (input, ctx) => {
      const r = await cancelarPendiente(ctx, num(input, 'id'));
      if ('error' in r) return JSON.stringify({ ok: false, error: r.error, ...(r.vigentes ? { vigentes: r.vigentes } : {}) });
      return r.resumen;
    },
  },
};
