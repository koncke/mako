// =============================================================================
// papelera-ficha — «Mandar a la papelera» desde una ficha, por la RUTA y no por una server action
// =============================================================================
// Lo usan las dos fichas (app/crm/[id]/LeadDetailBody.tsx y app/crm/LeadSheet.tsx). Por qué una ruta: la cabecera de
// app/api/crm/papelera/route.ts (las server actions de la ficha hacen fila y el borrado esperaba detrás, sin señal).
//
// La señal es de quien llama: el cartel queda ABIERTO y con su spinner (`loading` del Confirm) desde el primer toque hasta
// que la pantalla cambia. Cerrarlo antes de que termine era lo que hacía que pareciera que no reaccionaba.
// =============================================================================

/** Manda el lead a la papelera; tira con el motivo si no pudo. El `?ws=` de la pestaña lo pega `WsFetch`. */
export async function mandarAPapeleraDesdeFicha(id: number): Promise<void> {
  let r: Response;
  try {
    r = await fetch('/api/crm/papelera', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) });
  } catch {
    throw new Error('No hubo conexión. Reintenta.');
  }
  const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!r.ok || !j?.ok) throw new Error(j?.error || 'No se pudo mandar a la papelera. Reintenta.');
}
