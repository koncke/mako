// =============================================================================
// leads-bajas-reglas — cómo se cuenta lo que se borró (puro; lo fija tests/crm-leads-bajas.test.ts)
// =============================================================================
// La tabla y el trigger, en supabase/migrations/0356_leads_bajas.sql. La lectura, en lib/leads-bajas.ts.

export type CaminoDeBaja = 'papelera' | 'unificar' | 'zernio_duplicado' | 'sin_camino';

export type FilaBaja = { at: string; cuantos: number; lead_ids: number[]; camino: string; por: string | null; rol: string | null; app: string | null };

export type RenglonBaja = { desde: string; hasta: string; camino: string; que: string; por: string | null; cuantos: number; leadIds: number[] };

/** Lo que dice cada camino, para quien pregunta. Un camino que no se conoce se dice tal cual: no se esconde. */
export function queFueLaBaja(f: Pick<FilaBaja, 'camino' | 'rol' | 'app'>): string {
  if (f.camino === 'papelera') return 'Se eliminó: fue a la papelera (se puede recuperar durante 30 días)';
  if (f.camino === 'unificar') return 'Se unificó con otra ficha: lo que tenía pasó a la que quedó';
  if (f.camino === 'zernio_duplicado') return 'Duplicado automático: llegaron dos eventos de la misma persona a la vez y quedó uno';
  if (f.camino === 'sin_camino') {
    // `service_role` + `postgrest` es la app sin decir por dónde; cualquier otra cosa, un script o SQL a mano.
    return f.rol === 'service_role' ? 'Se borró desde la app, por un camino que no dice cuál' : `Se borró por fuera de la app (${f.rol ?? 'sin rol'}${f.app ? `, ${f.app}` : ''})`;
  }
  return `Se borró por «${f.camino}»`;
}

/** Hasta esto entre un renglón y el siguiente es el mismo borrado: la papelera anota uno por lead, y un lote son cientos. */
export const MISMO_BORRADO_MS = 10 * 60 * 1000;

/**
 * Junta en UN renglón lo que fue un solo borrado (mismo camino y misma persona, sin pausas de más de 10 minutos). Sin esto, los
 * 394 de un lote se leen como 394 respuestas. Sale de lo más nuevo a lo más viejo, sea cual sea el orden de entrada.
 */
export function agruparBajas(filas: readonly FilaBaja[]): RenglonBaja[] {
  const orden = [...filas].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const out: RenglonBaja[] = [];
  for (const f of orden) {
    const ult = out[out.length - 1];
    const que = queFueLaBaja(f);
    if (ult && ult.camino === f.camino && ult.por === f.por && ult.que === que && Date.parse(ult.desde) - Date.parse(f.at) <= MISMO_BORRADO_MS) {
      ult.desde = f.at;
      ult.cuantos += f.cuantos;
      ult.leadIds.push(...f.lead_ids);
      continue;
    }
    out.push({ desde: f.at, hasta: f.at, camino: f.camino, que, por: f.por, cuantos: f.cuantos, leadIds: [...f.lead_ids] });
  }
  return out;
}

/** Se dice siempre: lo que se borró antes no está, y un «no hay nada» no puede leerse como «no se borró nada». */
export const AVISO_DESDE_CUANDO = 'Se registra desde el 30/10/2026: lo que se borró antes no está acá.';
