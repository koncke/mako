// =============================================================================
// borradores-descartar — el ÚNICO camino para descartar borradores de una automatización
// =============================================================================
// Lo usan archivar (`archivarSecuencias`, lib/secuencias-huecos.ts) y el aviso al activar (`descartarBorradoresViejos`, lib/nutricion.ts).
// Sólo los pendientes, nunca se borran, y cada lead lo tiene en su historial: `wa_borradores` no tiene dónde guardar el motivo, y quien
// lea esa tabla sola no sabe por qué hay un descartado.
//
// ⚠️ LO YA DESCARTADO SE ANOTA AUNQUE FALLE UNA TANDA: el descarte va de a 200 (una lista larga no entra en la URL). Si la tercera falla, las dos
// primeras ya no salen, y sin el renglón quien mire ese lead no sabe por qué su borrador se fue. Primero se anota, después se tira.
// Si se descartó y no se pudo anotar, queda en el log: el mensaje ya no sale, que es lo que importa.
// =============================================================================

export type BorradorDescartado = { lead_id: number | null; secuencia_id: number | null };

type Respuesta<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;
/** Lo que usa de la base (quien llama lo castea, como `DbBorrador` en lib/secuencia-borrador.ts). */
export type DbDescarte = {
  from(tabla: string): {
    update(v: { estado: string }): { in(campo: string, valores: readonly number[]): { eq(campo: string, valor: string): { select(c: string): Respuesta<BorradorDescartado[]> } } };
    insert(filas: unknown[]): Respuesta<unknown>;
  };
};

export async function descartarBorradoresAnotando(
  db: DbDescarte,
  filtro: { secuencias: readonly number[] } | { ids: readonly number[] },
  renglon: (b: BorradorDescartado) => string,
  autor = 'MaKo',
): Promise<BorradorDescartado[]> {
  const campo = 'ids' in filtro ? 'id' : 'secuencia_id';
  const valores = 'ids' in filtro ? filtro.ids : filtro.secuencias;
  const descartados: BorradorDescartado[] = [];
  let fallo: string | null = null;
  for (let i = 0; i < valores.length && !fallo; i += 200) {
    const { data, error } = await db.from('wa_borradores').update({ estado: 'descartado' })
      .in(campo, valores.slice(i, i + 200)).eq('estado', 'pendiente').select('lead_id, secuencia_id');
    if (error) fallo = error.message;
    else descartados.push(...(data ?? []));
  }
  const historial = descartados.filter((b) => b.lead_id != null).map((b) => ({
    lead_id: b.lead_id, campo: 'Automatización', valor_anterior: null, autor, valor_nuevo: renglon(b),
  }));
  if (historial.length) {
    const { error } = await db.from('lead_audit').insert(historial);
    if (error) console.error(`[borradores] no pude anotar los borradores descartados: ${error.message}`);
  }
  if (fallo) throw new Error(fallo);
  return descartados;
}
