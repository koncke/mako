// =============================================================================
// optin-aviso — los DATOS del aviso «Alguien dejó sus datos en tu landing» (puro, con test)
// =============================================================================
// «Nada por detrás», lote 3 (docs/inventario-nada-por-detras.md, 17/10/2026): `lead-de-landing` lo armaba la ruta del
// formulario (app/api/track/optin) con su texto en el código, en dos versiones: el lead que entró solo al CRM y el que
// quedó a REVISAR porque se parece a uno que ya está. Ahora es el evento de la plataforma `lead_de_landing` con el texto
// literal en su fila de SuperAdmin; si queda a revisar lo pregunta una CONDITION (`optin_revisar`).
//
// Todo viaja como datos del evento, también lo de la persona: en el caso a revisar todavía NO hay lead (es una propuesta),
// así que no se puede leer de su ficha. ⚠️ Un dato opcional FALTA, no viene vacío: uno que falta se lleva su renglón.

import type { Coincidencia } from './leads-duplicados';

/** Lo que pregunta la CONDITION: si el lead quedó a revisar (se parece a uno que ya está) o entró solo. */
export const OPTIN_REVISAR = ['sí', 'no'] as const;

export type DatosOptin = {
  optin_quien: string; optin_revisar: (typeof OPTIN_REVISAR)[number]; optin_link: string;
  optin_telefono?: string; optin_email?: string; optin_respuestas?: string; optin_campana?: string; optin_funnels?: string;
  optin_ya_tienes?: string; optin_coincide?: string;
};

const texto = (s: string | null | undefined): string | null => (typeof s === 'string' && s.trim() ? s.trim() : null);

/**
 * LA PERSONA QUE DEJÓ SUS DATOS: quién es (su nombre, o su email o su teléfono si no lo dio), su contacto, lo que completó
 * del formulario (una lista, cada respuesta en su renglón), la campaña de la que vino, en cuántos funnels entró (sólo si son
 * dos o más) y el link: la ficha si entró sola, la pantalla de revisión si quedó a revisar. Con `duplicados`, a quién se
 * parece («Ana Ruiz», y cuántos más) y por qué («teléfono (+52…)»).
 */
export function datosOptin(p: {
  nombre: string | null; telefono: string | null; email: string | null;
  respuestas: ReadonlyArray<readonly [string, string]>; campana: string | null; funnels: number; link: string;
  revisar: boolean; duplicados?: readonly Coincidencia[] | null;
}): DatosOptin {
  const quien = texto(p.nombre) ?? texto(p.email) ?? texto(p.telefono) ?? 'Alguien';
  const dup = p.revisar ? p.duplicados?.[0] ?? null : null;
  const otros = p.revisar ? Math.max(0, (p.duplicados?.length ?? 0) - 1) : 0;
  const nombreDup = dup ? texto(dup.lead.nombre) : null;
  return {
    optin_quien: quien,
    optin_revisar: p.revisar ? 'sí' : 'no',
    ...(texto(p.telefono) ? { optin_telefono: texto(p.telefono)! } : {}),
    ...(texto(p.email) ? { optin_email: texto(p.email)! } : {}),
    ...(p.respuestas.length ? { optin_respuestas: p.respuestas.map(([k, v]) => `\n• ${k}: ${v}`).join('') } : {}),
    ...(texto(p.campana) ? { optin_campana: texto(p.campana)! } : {}),
    ...(p.funnels > 1 ? { optin_funnels: `${p.funnels} funnels` } : {}),
    ...(dup ? {
      optin_ya_tienes: `${nombreDup ? `«${nombreDup}»` : 'un contacto sin nombre'}${otros ? ` (y ${otros} más)` : ''}`,
      optin_coincide: dup.texto.replace(/^mismo /, ''),
    } : {}),
    optin_link: p.link,
  };
}
