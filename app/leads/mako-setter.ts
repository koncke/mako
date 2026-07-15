// =============================================================================
// mako-setter — MaKo como setter/closer: estrella + helpers de display
// =============================================================================
// MaKo NO es seleccionable a mano: se asigna solo al pasar a una nutrición
// automática (ver lib/crm-auto). Pero cuando YA es el setter, se muestra con su
// ESTRELLA dorada (no con iniciales). Este módulo da el avatar (data-URI SVG) y
// helpers para reconocerlo. Sin 'use client': solo strings/funciones puras.

export { MAKO_SETTER } from '@/lib/pipeline';
import { MAKO_SETTER } from '@/lib/pipeline';

/** ¿Este setter/closer es MaKo (la nutrición automática)? */
export const esMaKo = (v: string | null | undefined) => (v ?? '').trim() === MAKO_SETTER;

// Estrella de 4 puntas de MaKo (SPARK de MakoBrand) en dorado, sobre badge oscuro,
// como data-URI para usar de avatar en el Dropdown (<img src>) y en la ficha.
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#F6D365"/><stop offset="100%" stop-color="#EF9F27"/></linearGradient></defs><circle cx="12" cy="12" r="12" fill="#1C1912"/><g transform="translate(12 12) scale(0.6)"><path d="M0 -11 C1 -4 4 -1 11 0 C4 1 1 4 0 11 C-1 4 -4 1 -11 0 C-4 -1 -1 -4 0 -11 Z" fill="url(#g)"/><circle cx="8.5" cy="-8.5" r="1.6" fill="url(#g)"/></g></svg>`;
export const MAKO_STAR_URI = `data:image/svg+xml,${encodeURIComponent(SVG)}`;

/** Avatar para mostrar un setter/closer: la estrella si es MaKo, si no la foto. */
export const avatarDeSetter = (nombre: string | null | undefined, foto: string | null | undefined): string | null =>
  esMaKo(nombre) ? MAKO_STAR_URI : (foto ?? null);
