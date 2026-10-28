// =============================================================================
// contacto-compartido-reglas — qué le dice el código al modelo de un contacto compartido (27/10/2026, P6). Puro.
// =============================================================================
// Lo usan lib/contacto-compartido.ts y tests/contacto-compartido.test.ts.

export type LeadDelTelefono = { id: number; nombre: string | null };

/**
 * Por cada contacto, lo que hay en el CRM con ese teléfono: el lead (o los leads) que ya existen, que nada tiene ese número, o
 * que no se pudo leer (y entonces no se afirma nada). Con un lead que ya existe, NO se propone uno nuevo.
 */
export function bloqueDelContacto(filas: ReadonlyArray<{ contacto: { nombre: string; telefono?: string | null }; leads: LeadDelTelefono[] | null }>): string {
  if (!filas.length) return '';
  const lineas = filas.map(({ contacto, leads }) => {
    const quien = `«${contacto.nombre}»${contacto.telefono ? ` (${contacto.telefono})` : ''}`;
    if (!contacto.telefono) return `- ${quien}: sin teléfono; búscalo por el nombre antes de proponer uno nuevo.`;
    if (leads == null) return `- ${quien}: no pude buscarlo en el CRM; búscalo con buscar_leads antes de proponer uno nuevo.`;
    if (!leads.length) return `- ${quien}: no hay ningún lead con ese teléfono (lo busqué por el número normalizado). Puedes proponerlo como lead nuevo.`;
    return `- ${quien}: YA ES ${leads.length > 1 ? 'uno de estos leads' : 'un lead'}: ${leads.map((l) => `#${l.id} ${l.nombre ?? 'sin nombre'}`).join(', ')}. NO propongas uno nuevo: trabaja con ése.`;
  });
  return ['EL CONTACTO QUE COMPARTIERON, BUSCADO POR SU TELÉFONO EN EL CRM:', ...lineas].join('\n');
}
