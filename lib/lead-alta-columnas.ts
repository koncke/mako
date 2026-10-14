// =============================================================================
// lead-alta-columnas — las columnas del alta que pueden no existir todavía en la base
// =============================================================================
// Tanda B del CRM (14/10/2026, docs/diseno-ficha-bloques.md §5): el alta de un lead guarda dos datos
// nuevos que los bloques de la ficha necesitan y que hasta acá se perdían —la página donde dejó sus
// datos (`pagina_registro`) y cómo entró por Instagram o Messenger (`entrada_social`)— y los dos son
// columnas de una migración nueva.
//
// ⚠️ UN INSERT QUE NOMBRA UNA COLUMNA QUE NO EXISTE SE RECHAZA ENTERO (AGENTS.md). Y las dos altas que
// los escriben corren con clientes reales y sin nadie mirando: el opt-in de la landing caería a
// propuesta con el aviso «Necesito que lo mires» para CADA lead (todos traen la página), y el webhook de
// Zernio perdería el lead y su disparador (`crearLeadDe` se traga el error). Por eso, si la base dice
// que falta UNA DE ESTAS columnas, el alta se reintenta UNA vez sin ellas: el lead entra, sin esos dos
// datos, y queda el log. Cualquier otro error —otra columna, la red, un permiso— tira como siempre.
//
// Sin `server-only`, para que tenga test (tests/crm-entrada-social.test.ts).
// =============================================================================

/** Las columnas del alta que puede no tener una base sin la migración XXXX_lead_entrada. */
export const COLUMNAS_NUEVAS_DEL_ALTA = ['pagina_registro', 'entrada_social'] as const;

export type ErrorDeBase = { code?: string | null; message?: string | null } | null | undefined;

/**
 * ¿El error es «falta una de las columnas nuevas»? PostgREST contesta PGRST204 a un insert que nombra
 * una columna que no está («Could not find the 'x' column of 'leads' in the schema cache») y Postgres
 * 42703 («column "x" of relation "leads" does not exist»). Los dos NOMBRAN la columna, y se exige que
 * sea una de éstas: si falta otra, el reintento no la arregla y el error tiene que subir.
 */
export function faltaColumnaNuevaDelAlta(e: ErrorDeBase): boolean {
  if (!e) return false;
  const code = String(e.code ?? '');
  const msg = String(e.message ?? '');
  const deColumna = code === 'PGRST204' || code === '42703' || /could not find the '[^']+' column|column "?[\w.]+"? (of relation "?\w+"? )?does not exist/i.test(msg);
  return deColumna && COLUMNAS_NUEVAS_DEL_ALTA.some((c) => msg.includes(c));
}

/** La fila sin las columnas nuevas (para el reintento). No toca la original. */
export function sinColumnasNuevas<T extends Record<string, unknown>>(fila: T): T {
  const out: Record<string, unknown> = { ...fila };
  for (const c of COLUMNAS_NUEVAS_DEL_ALTA) delete out[c];
  return out as T;
}

/** ¿La fila nombra alguna? Sin ninguna, no hay nada que reintentar. */
export const traeColumnasNuevas = (fila: Record<string, unknown>): boolean => COLUMNAS_NUEVAS_DEL_ALTA.some((c) => c in fila);
