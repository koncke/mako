// =============================================================================
// buscar-leads — DÓNDE busca la barra del CRM (F150, 18/11/2026)
// =============================================================================
// La búsqueda avanzada del Plan, en el CRM: copiada de lib/buscar-tareas.ts y de app/plan/board/BuscadorTareas.tsx (los
// campos que se eligen con la flechita, los dos atajos y el chip que dice dónde se busca). La regla de buscar —sin
// acentos, por palabras, y el `#número` siempre— sigue siendo UNA: `coincideBusqueda` (lib/buscar-texto.ts). Lo que
// cambia acá es QUÉ campos entran.
//
// Diferencia con el Plan, a propósito: en el Plan buscar en todo era el problema («me salen muchas tareas porque está
// leyendo el detalle»), así que su default es el título. En el CRM, buscar en el nombre, la empresa, el email, el teléfono
// y el Instagram es lo que la barra hizo siempre, y se queda como default: la flechita sirve para ACHICAR (buscar «ana»
// sólo en el nombre, no en «mariana@…»). Sin la búsqueda con MaKo del Plan: ésa necesita su propio prompt y le mandaría
// los leads a una IA.
//
// Sin `server-only` ni 'use client': lo ejecuta el test (tests/crm-buscar-campos.test.ts).
// =============================================================================

import { arrobaInstagram } from './campo-inline';

export type CampoLead = 'nombre' | 'empresa' | 'email' | 'telefono' | 'instagram';

/** Lo mínimo de un lead para buscarlo: el `CrmLead` del tablero lo cumple. */
export type LeadBuscable = {
  id: number;
  name?: string | null;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  instagram?: string | null;
};

/** Los campos, con su rótulo y de dónde sale el texto. Es la lista que dibuja la flechita. */
export const CAMPOS_LEAD: Array<{ id: CampoLead; label: string; ayuda: string; texto: (l: LeadBuscable) => string | null | undefined }> = [
  { id: 'nombre', label: 'Nombre', ayuda: 'cómo se llama el lead', texto: (l) => l.name },
  { id: 'empresa', label: 'Empresa', ayuda: 'su negocio o empresa', texto: (l) => l.company },
  { id: 'email', label: 'Email', ayuda: 'su correo, también por el dominio', texto: (l) => l.email },
  { id: 'telefono', label: 'Teléfono', ayuda: 'con o sin el código del país', texto: (l) => l.phone },
  { id: 'instagram', label: 'Instagram', ayuda: 'su usuario, con o sin @, o el link del perfil', texto: (l) => arrobaInstagram(l.instagram) },
];

/** Todos: lo que la barra buscó siempre, y lo que busca sin tocar nada. */
export const CAMPOS_LEAD_TODOS: CampoLead[] = CAMPOS_LEAD.map((c) => c.id);
export const CAMPOS_LEAD_POR_DEFECTO: CampoLead[] = CAMPOS_LEAD_TODOS;

/** Lo que entra a `coincideBusqueda`: el id SIEMPRE (el `#número` no es un campo, es pedir un lead) y los campos elegidos. */
export function camposDelLead(l: LeadBuscable, campos: ReadonlyArray<CampoLead>): Array<string | number | null | undefined> {
  return [l.id, ...CAMPOS_LEAD.filter((c) => campos.includes(c.id)).map((c) => c.texto(l))];
}

/** ¿Se busca en menos de lo de siempre? Entonces la barra lo dice con el chip. */
export const camposAchicados = (campos: ReadonlyArray<CampoLead>): boolean => CAMPOS_LEAD_POR_DEFECTO.some((c) => !campos.includes(c));

/** El chip: «Nombre» · «Nombre y 2 más» · «Todos los campos» · «Ningún campo». */
export function resumenCamposLead(campos: ReadonlyArray<CampoLead>): string {
  const nombres = CAMPOS_LEAD.filter((c) => campos.includes(c.id)).map((c) => c.label);
  if (nombres.length >= CAMPOS_LEAD.length) return 'Todos los campos';
  if (!nombres.length) return 'Ningún campo';
  if (nombres.length === 1) return nombres[0];
  return `${nombres[0]} y ${nombres.length - 1} más`;
}
