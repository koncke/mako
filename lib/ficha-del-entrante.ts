// =============================================================================
// ficha-del-entrante — A QUÉ FICHA SE PEGA UN WHATSAPP QUE ENTRA, cuando hay dos con ese teléfono (24/10/2026)
// =============================================================================
// El caso: German, en Leila, tiene DOS fichas (#1776 de agosto, con el número sin país; #1797, con 52 + 10 dígitos) y la
// automatización «Recordatorio clase reactivación» corre en la #1797. WhatsApp le escribe al 521 + 10 dígitos: ninguna
// ficha coincide exacto, el sufijo de 10 dígitos encuentra las dos, y hasta hoy ganaba la de id MÁS BAJO. Su respuesta
// cortaba a la #1776, que no tiene ninguna automatización, y para la #1797 seguía «No contestó»: le íbamos a seguir
// escribiendo a alguien que ya había contestado. Lo mismo el lead de prueba de Martín (#3099, que contestaba en el #249).
//
// LA REGLA: la respuesta va a la ficha a la que LE ESCRIBIMOS ÚLTIMO. La prueba de «le escribimos» es lo más nuevo entre
// sus WhatsApp salientes EN ESE CHAT (`wa_mensajes`) y los WhatsApp que le salieron por una automatización
// (`nutricion_envios`): la fila del espejo puede quedar con la ficha del eco del webhook, que la elige por teléfono, y el
// envío del motor no (lo escribe quien mandó). Sin ninguna prueba, lo de siempre: la que coincide EXACTO, y entre ellas o
// sin ninguna, la de id más bajo.
//
// ⚠️ POR QUÉ NO SE PAUSA A LAS DOS FICHAS: `pausarPorRespuesta` no sólo marca 'respondio', también contesta (el AI Step,
// el modo asistido, la charla). Correrlo en cada ficha gemela le podía mandar DOS respuestas a la misma persona. Se elige
// UNA ficha y todo sigue por ella, como siempre.
// Con UNA sola ficha candidata no cambia nada (ni se consulta nada más): eso es casi todo el tráfico.
// =============================================================================

export type CandidataDelEntrante = {
  id: number;
  /** Su `telefono_normalizado` es igual al número del chat (no sólo los 10 últimos dígitos). */
  exacta: boolean;
  /** Lo más nuevo que le escribimos: su último saliente en este chat o su último WhatsApp de una automatización (ms). */
  ultimoEscritoMs: number | null;
};

/** La ficha a la que se pega el entrante (null sin candidatas). */
export function fichaDelEntrante(candidatas: readonly CandidataDelEntrante[]): number | null {
  if (!candidatas.length) return null;
  if (candidatas.length === 1) return candidatas[0].id;
  const porId = [...candidatas].sort((a, b) => a.id - b.id);
  const escritas = porId.filter((c) => c.ultimoEscritoMs != null && Number.isFinite(c.ultimoEscritoMs));
  if (escritas.length) {
    // La más nueva; en un empate, la de id más bajo (orden estable: `porId`).
    return escritas.reduce((m, c) => ((c.ultimoEscritoMs as number) > (m.ultimoEscritoMs as number) ? c : m)).id;
  }
  return (porId.find((c) => c.exacta) ?? porId[0]).id;
}

/** El último instante de cada ficha entre filas `{ lead_id, at }` (las que no traen hora válida no cuentan). */
export function ultimoPorFicha(filas: ReadonlyArray<{ lead_id: number | null; at: string | null }>): Map<number, number> {
  const m = new Map<number, number>();
  for (const f of filas) {
    if (f.lead_id == null || !f.at) continue;
    const t = Date.parse(f.at);
    if (!Number.isFinite(t)) continue;
    if (t > (m.get(f.lead_id) ?? -Infinity)) m.set(f.lead_id, t);
  }
  return m;
}
