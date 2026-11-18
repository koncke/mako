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

import { iniciales } from '@/lib/unicode-seguro';

/** «10:42» en el reloj de quien mira. Vacío si el momento no es una fecha. */
export function horaCorta(momento: number | string | Date): string {
  const d = momento instanceof Date ? momento : new Date(momento);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
}

/**
 * Las iniciales de un avatar de /m: «Ana María Pérez» → «AP» (la primera y la última
 * palabra), «Sofía» → «SO», y sin nombre, la inicial del email. Nunca vacío: «·».
 * Sólo cuentan las LETRAS: «Dev (local)» daba «D(» en el avatar (medido el 12/10/2026 en la
 * verificación a 390 px); con esto da «DL», y «Juan (ventas)», «JV».
 *
 * ⚠️ NUNCA POR UNIDAD UTF-16 (18/11/2026, O14 de docs/pendientes-verificados-17-11.md). Hasta ese día tomaba
 * `partes[0][0]`, `slice(0, 2)` y la del email con `trim()[0]`: la primera UNIDAD, no la primera letra. Una letra
 * fuera del plano básico (la «𝐀» en negrita de un nombre de Instagram, U+1D400) es una LETRA (pasa el filtro de
 * arriba) y ocupa dos unidades, así que el avatar salía con media letra; un email que empieza con un emoji, igual.
 * El HTML del server lleva «�» y el navegador no: React tira la barra entera con #418 (la dibuja app/m/layout.tsx en
 * cada pantalla). Por eso la primera y la última palabra salen de `iniciales` (lib/unicode-seguro.ts, la pieza de toda
 * la app), y las dos de una sola palabra, de `Array.from`, que corta por punto de código.
 */
export function inicialesM(nombre: string | null | undefined, email?: string | null): string {
  const partes = (nombre ?? '').replace(/[^\p{L}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  const ini = partes.length > 1
    ? iniciales(`${partes[0]} ${partes[partes.length - 1]}`, 2, '')
    : Array.from(partes[0] ?? '').slice(0, 2).join('').toLocaleUpperCase('es');
  return ini || iniciales(email, 1, '') || '·';
}
