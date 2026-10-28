// =============================================================================
// iconos-de-botones — el ícono DE VERDAD de lo que MaKo nombra entre «» (ticket 874749710-12 de Leandro, 27/10/2026)
// =============================================================================
// Leandro: «Maco debería poder enviar íconos»: le decía «tocá Configuraciones» y no se sabía cuál. Automations ya dibujaba la
// tuerca en su globo (8ed7f23aa, `TuercaEnElGlobo`); los demás chats, nada. Acá: el nombre visible de cada tab de la barra
// (app/_components/nav.ts, su `icon`) y los botones que no son una tab, con el ícono que dibuja su pantalla. El texto de MaKo
// lo usa por `Markdown` con `iconos` (app/_components/Markdown.tsx): «Settings» sale con la tuerca, «CRM» con su ícono.
// Sólo entre «»: así MaKo NOMBRA el botón; una palabra suelta («el plan de la semana») no es un botón.
//
// Neutro (sin 'use client'): lo importa Markdown, que también es neutro (tests/frontera-use-client.test.ts).
// =============================================================================

import { ADMIN_NAV, ARRIBA, FAMILIAS, MAKO_NAV, USER_NAV, itemsDe, type NavItem } from '@/app/_components/nav';

/** Botones que NO son una tab, con el ícono que dibuja su pantalla. */
const BOTONES: Readonly<Record<string, string>> = {
  // La tuerca del título de una automatización (app/automations/SecuenciaPerfil.tsx, `BotonTuerca`).
  Configuraciones: 'config',
};

const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

/** Nombre visible → ícono. La primera tab con ese nombre gana (las repetidas usan el mismo). */
const ICONOS: ReadonlyMap<string, { nombre: string; icono: string }> = (() => {
  const m = new Map<string, { nombre: string; icono: string }>();
  // Primero lo que ve el NEGOCIO (su «Ops Center» es el cerebro; el del super admin, otro): MaKo le habla a él.
  const todas: NavItem[] = [...MAKO_NAV, ...USER_NAV, ...FAMILIAS.flatMap(itemsDe), ...ARRIBA, ...ADMIN_NAV];
  for (const it of todas) if (it.label && it.icon && !m.has(norm(it.label))) m.set(norm(it.label), { nombre: it.label, icono: it.icon });
  for (const [nombre, icono] of Object.entries(BOTONES)) m.set(norm(nombre), { nombre, icono });
  return m;
})();

/** El ícono de un botón o una tab por su nombre visible, o null. */
export const iconoDe = (nombre: string): string | null => ICONOS.get(norm(nombre))?.icono ?? null;

/** El texto en trozos: lo de siempre, y cada «Nombre» de un botón o tab conocido con su ícono. Puro (test). */
export function trozosConIconos(texto: string): Array<{ t: 'texto'; s: string } | { t: 'boton'; nombre: string; icono: string }> {
  const out: Array<{ t: 'texto'; s: string } | { t: 'boton'; nombre: string; icono: string }> = [];
  let desde = 0;
  for (const m of texto.matchAll(/«([^«»\n]{1,40})»/g)) {
    const icono = iconoDe(m[1]);
    if (!icono) continue;
    const i = m.index ?? 0;
    if (i > desde) out.push({ t: 'texto', s: texto.slice(desde, i) });
    out.push({ t: 'boton', nombre: m[1].trim(), icono });
    desde = i + m[0].length;
  }
  if (desde < texto.length) out.push({ t: 'texto', s: texto.slice(desde) });
  return out;
}
