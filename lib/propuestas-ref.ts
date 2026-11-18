// =============================================================================
// La llave de idempotencia de una propuesta (`propuestas.ref`): cuándo una ya guardada le gana a una nueva. PURO.
// =============================================================================
// Lo usa `crearPropuesta` (lib/propuestas.ts, que es server-only y no se puede testear) y lo prueba
// tests/api-mako-nucleo-1811.test.ts.
//
// ⚠️ LA REGLA DEPENDE DEL TIPO (F114, 18/11/2026; docs/hallazgos-api-mako.md → «Lo que quedó sin hacer en el núcleo»: «la ref por
//    contenido bloquea repetir una acción ya aplicada»).
//    · Un LEAD aplicado ya está en el CRM: re-proponerlo lo duplicaría. Bloquea.
//    · Una ACCIÓN aplicada ya se hizo, y pedirla otra vez (pausar de nuevo una campaña que alguien prendió, mandar otra vez
//      un recordatorio) es un pedido NUEVO: con la misma llave, MaKo devolvía la propuesta vieja, ya aplicada, y la persona
//      veía «ya está aplicada» sobre algo que quería hacer hoy. Sólo bloquea mientras está PENDIENTE (el doble envío).
//    · Una descartada nunca bloquea (es intención nueva: el comentario de crearPropuesta).
// =============================================================================

export type TipoConRef = 'lead' | 'accion';

/** ¿La propuesta que ya tiene esta `ref` (en `estado`) es LA propuesta, en vez de crear otra? */
export function refYaTomada(tipo: TipoConRef, estado: string | null | undefined): boolean {
  if (estado === 'pendiente') return true;
  if (estado === 'aplicada') return tipo === 'lead';
  return false;
}
