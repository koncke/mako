// =============================================================================
// Formatos de /m que dependen de QUIÉN MIRA (lógica pura, sin 'use client')
// =============================================================================
// Vive aparte del contexto (que es 'use client') para que un módulo del server
// pueda importarlo sin traerse una referencia de cliente: tests/frontera-use-
// client.test.ts frena exactamente eso.
//
// ⚠️ Aun así, la hora se formatea en el NAVEGADOR: el server no sabe la zona de
// quien mira, y formatear en el render da un texto distinto en cada lado (error
// de hidratación). HoraM la escribe después de montar.
// =============================================================================

/** «10:42» en el reloj de quien mira. Vacío si el momento no es una fecha. */
export function horaCorta(momento: number | string | Date): string {
  const d = momento instanceof Date ? momento : new Date(momento);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
}

/**
 * Las iniciales de un avatar de /m: «Ana María Pérez» → «AP» (la primera y la última
 * palabra), «Sofía» → «SO», y sin nombre, la inicial del email. Nunca vacío: «·».
 */
export function inicialesM(nombre: string | null | undefined, email?: string | null): string {
  const partes = (nombre ?? '').trim().split(/\s+/).filter(Boolean);
  const ini = partes.length > 1 ? partes[0][0] + partes[partes.length - 1][0] : partes[0]?.slice(0, 2) ?? '';
  return (ini || (email ?? '').trim()[0] || '·').toUpperCase();
}
