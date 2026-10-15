'use client';

// =============================================================================
// Los tamaños del Inicio: con qué se crea un diseño
// =============================================================================
// 'use client': importa del motor (_doory/), y eso sólo lo hace un cliente del editor
// (tests/image-editor-integracion.test.ts, contrato 4).
// UNA lista para el Inicio y para «Redimensionar»: los tamaños salen de
// SIZE_PRESETS (_doory/editor/engine/presets.ts), que es la lista de Redimensionar
// (_doory/editor/dialogs/resizeSizes.ts, con sus nombres en strings.ts →
// `dialog.resizeSizes`). Un tamaño nuevo se agrega allá y aparece en los dos lados.
//
// Los de FOTO (grupo `photo` de esa lista) son el acceso «Foto» de Canva; su
// «Collage de fotos» mide 25 × 20 cm.
//
// Los tipos son los círculos de color del Inicio de Canva (relevamiento-canva-armazon.md
// §1.2, colores medidos en sus imágenes es-CO) y las categorías del diálogo
// «Crear un diseño». El «Video» de Canva no es un tamaño: lleva al Video Editor.
//
// «Tamaño personalizado» de Canva: unidades px, in, mm, cm y lados de 40 a 8000 px
// (Centro de Ayuda, design-from-scratch). Doory guarda todo en px a 96 ppp y sólo
// conoce px/mm/in: un diseño hecho en cm se guarda con la unidad mm.

import { Globe, Heart, ImageIcon, Presentation, Printer, type LucideIcon } from 'lucide-react';
import { SIZE_PRESETS, type SizePreset } from '../_doory/editor/engine/presets';
import { pxToUnit, unitToPx } from '../_doory/editor/engine/units';
import type { DocUnit } from '../_doory/types/document';

export type Tipo = 'presentacion' | 'social' | 'foto' | 'impresion' | 'web';

export interface Tamano {
  /** El id del preset de Doory (va al `meta.presetId` del documento). */
  id: string;
  nombre: string;
  /** En px a 96 ppp, como los guarda Doory. */
  ancho: number;
  alto: number;
  tipo: Tipo;
}

export interface TipoDiseno {
  id: Tipo;
  /** El rótulo debajo del círculo del Inicio. */
  circulo: string;
  /** El rótulo en la lista del diálogo «Crear un diseño». */
  categoria: string;
  /** Canva: el color del círculo, medido. */
  color: string;
  Icono: LucideIcon;
}

/** En el orden de la fila de accesos de Canva (Presentación, Redes sociales, Foto… Impresión, Sitio web). */
export const TIPOS: readonly TipoDiseno[] = [
  { id: 'presentacion', circulo: 'Presentación', categoria: 'Presentaciones', color: '#FF6105', Icono: Presentation },
  { id: 'social', circulo: 'Redes sociales', categoria: 'Redes sociales', color: '#FF3B4B', Icono: Heart },
  { id: 'foto', circulo: 'Foto', categoria: 'Fotos', color: '#FF339C', Icono: ImageIcon },
  { id: 'impresion', circulo: 'Impresión', categoria: 'Impresión', color: '#992BFF', Icono: Printer },
  { id: 'web', circulo: 'Sitio web', categoria: 'Web', color: '#4A53FA', Icono: Globe },
];

export const TIPO = Object.fromEntries(TIPOS.map((t) => [t.id, t])) as Record<Tipo, TipoDiseno>;

/** Canva: el acceso «Video» (lleva al Video Editor) y el gris de «Elegir el tamaño». */
export const COLOR_VIDEO = '#E950F7';
export const COLOR_ELEGIR = '#F2F3F5';

/** La miniatura de YouTube (grupo `video` de Doory) vive con las redes, como en Canva. */
const DE_GRUPO: Record<SizePreset['group'], Tipo> = {
  social: 'social',
  video: 'social',
  presentation: 'presentacion',
  photo: 'foto',
  print: 'impresion',
  web: 'web',
};

export const TAMANOS: readonly Tamano[] = SIZE_PRESETS.map((p) => ({ id: p.id, nombre: p.label, ancho: p.width, alto: p.height, tipo: DE_GRUPO[p.group] }));

export const tamanosDe = (tipo: Tipo): Tamano[] => TAMANOS.filter((t) => t.tipo === tipo);

/** El tamaño con esas medidas (para decir de qué tipo es un diseño reciente), o undefined. */
export function tamanoPorMedidas(ancho: number, alto: number): Tamano | undefined {
  return TAMANOS.find((t) => t.ancho === ancho && t.alto === alto);
}

/** Lo impreso se crea y se lee en mm (como en Canva); lo demás, en px. */
export const unidadDe = (t: Tamano): DocUnit => (t.tipo === 'impresion' ? 'mm' : 'px');

/** Lo que hace falta para crear un diseño en blanco (createBlankDocument). */
export interface NuevoDiseno {
  ancho: number;
  alto: number;
  unidad: DocUnit;
  presetId?: string;
}

export const nuevoDe = (t: Tamano): NuevoDiseno => ({ ancho: t.ancho, alto: t.alto, unidad: unidadDe(t), presetId: t.id });

/** Con coma decimal y sin separador de miles («2116,7»): lo mismo se lee y se vuelve a escribir. */
const num = (n: number, decimales: number) => n.toLocaleString('es', { maximumFractionDigits: decimales, useGrouping: false });

/** «1080 × 1080 px» o, en lo impreso, «210 × 297 mm». */
export function medidasDe(t: Pick<Tamano, 'ancho' | 'alto'> & { tipo?: Tipo }): string {
  if (t.tipo === 'impresion') return `${num(pxToUnit(t.ancho, 'mm'), 1)} × ${num(pxToUnit(t.alto, 'mm'), 1)} mm`;
  return `${t.ancho} × ${t.alto} px`;
}

// ── Búsqueda ─────────────────────────────────────────────────────────────────

/** Sin tildes ni mayúsculas: «impresion» encuentra «Impresión». */
export const normalizar = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Cada palabra de la búsqueda tiene que estar en el texto (en cualquier orden). */
export function coincide(texto: string, busqueda: string): boolean {
  const pajar = normalizar(texto);
  return normalizar(busqueda).split(/\s+/).filter(Boolean).every((p) => pajar.includes(p));
}

export function buscarTamanos(busqueda: string): Tamano[] {
  if (!busqueda.trim()) return [...TAMANOS];
  return TAMANOS.filter((t) => {
    const tipo = TIPO[t.tipo];
    return coincide(`${t.nombre} ${tipo.circulo} ${tipo.categoria} ${medidasDe(t)} ${t.ancho}x${t.alto}`, busqueda);
  });
}

// ── Tamaño personalizado ─────────────────────────────────────────────────────

export type Unidad = 'px' | 'in' | 'mm' | 'cm';
export const UNIDADES: readonly Unidad[] = ['px', 'in', 'mm', 'cm'];

/** Canva: de 40 a 8000 px por lado. */
export const LADO_MIN_PX = 40;
export const LADO_MAX_PX = 8000;

export const decimalesDe = (u: Unidad): number => (u === 'px' ? 0 : u === 'mm' ? 1 : 2);
export const aPx = (valor: number, u: Unidad): number => (u === 'cm' ? unitToPx(valor * 10, 'mm') : unitToPx(valor, u));
export const dePx = (px: number, u: Unidad): number => (u === 'cm' ? pxToUnit(px, 'mm') / 10 : pxToUnit(px, u));
/** Doory no conoce los cm: un diseño en cm se guarda en mm. */
export const unidadDoc = (u: Unidad): DocUnit => (u === 'cm' ? 'mm' : u);

/** El rango de un lado en esa unidad, redondeado hacia adentro (los dos extremos se pueden escribir). */
export function rangoEn(u: Unidad): { min: number; max: number } {
  const escala = 10 ** decimalesDe(u);
  return {
    min: Math.ceil(dePx(LADO_MIN_PX, u) * escala) / escala,
    max: Math.floor(dePx(LADO_MAX_PX, u) * escala) / escala,
  };
}

/** Un número escrito con coma o con punto; null si no es un número. */
export function leerNumero(texto: string): number | null {
  const n = Number.parseFloat(texto.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export const escribirNumero = (n: number, u: Unidad): string => num(n, decimalesDe(u));

/** «1200x628», «1200 × 628 px»: lo que alguien escribe en el buscador para pedir un tamaño. */
export function medidaEscrita(busqueda: string): { ancho: number; alto: number } | null {
  const m = /^\s*(\d{2,4})\s*[x×*]\s*(\d{2,4})\s*(?:px)?\s*$/i.exec(busqueda);
  if (!m) return null;
  const ancho = Number(m[1]);
  const alto = Number(m[2]);
  const ok = (n: number) => n >= LADO_MIN_PX && n <= LADO_MAX_PX;
  return ok(ancho) && ok(alto) ? { ancho, alto } : null;
}
