// =============================================================================
// El aviso AL SETTER de un lead — las reglas PURAS (14/11/2026)
// =============================================================================
// La llamada de Martín con Julio (13/11, min 01:27): el hand-off «te avisa al celular o la app del setter y por WhatsApp».
// No era cierto: el aviso de una automatización le llegaba a todo el grupo del negocio o a nadie, nunca a la persona que
// sigue a ESE lead. `lead.setter` es un nombre suelto (lo escribe la ficha o `asignar_closer_setter`), así que acá se
// resuelve a UNA persona del negocio, sin adivinar: el mismo nombre (sin tildes, mayúsculas ni espacios de más), de ese
// negocio, sin suspender. Con dos que se llaman igual, nadie: avisarle a la persona equivocada es peor que no avisar.
// Lo manda lib/aviso-al-setter.ts.
// =============================================================================

import { MAKO_SETTER } from './pipeline';

export type PersonaDelNegocio = { id: number; nombre: string | null; estado?: string | null; rol?: string | null; perfil?: { telefono?: unknown } | null };

/** Un nombre para comparar: sin tildes, en minúsculas, con un espacio entre palabras. */
export function nombreComparable(s: string | null | undefined): string {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * La persona del negocio que es el setter de este lead, o null. `personas` son las filas de `usuarios` del negocio.
 * Sin setter, con MaKo de setter, sin nadie con ese nombre o con dos: null.
 */
export function setterDelNegocio(setter: string | null | undefined, personas: readonly PersonaDelNegocio[]): PersonaDelNegocio | null {
  const buscado = nombreComparable(setter);
  if (!buscado || buscado === nombreComparable(MAKO_SETTER)) return null;
  const iguales = personas.filter((p) => p.estado !== 'suspendido' && nombreComparable(p.nombre) === buscado);
  return iguales.length === 1 ? iguales[0] : null;
}

/** El chat de WhatsApp de su teléfono personal (el de su perfil), o null. */
export function jidDelTelefono(telefono: unknown): string | null {
  const d = typeof telefono === 'string' ? telefono.replace(/\D/g, '') : '';
  return d.length >= 8 && d.length <= 15 ? `${d}@s.whatsapp.net` : null;
}

/** El título del push: el lead, para que se lea en la pantalla bloqueada. */
export const tituloParaElSetter = (lead: string): string => `${lead}: te toca a ti`;

/** El WhatsApp: el lead, lo que pasó y el link a su ficha. */
export function whatsappParaElSetter(lead: string, que: string, link: string): string {
  const cuerpo = que.trim().replace(/\n{3,}/g, '\n\n');
  return `🔔 *${lead}* te necesita.\n\n${cuerpo}\n\nSu ficha: ${link}\n\n— MaKo`;
}
