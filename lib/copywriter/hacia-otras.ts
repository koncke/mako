// =============================================================================
// copywriter/hacia-otras — lo que un guion le pasa a otra función de MaKo (PURO; 13/11/2026)
// =============================================================================
// Después de replicar, «Hacerlo con tu avatar IA» (AI Avatar: lo que se DICE) y «Hacerlo carrusel» (Image: las LÁMINAS). Pedido de
// Martín en la llamada con Leila: es enlazar, no rehacer; quien prefiere grabarse se queda con el guion.
// =============================================================================

import { NODOS, esEtiqueta, textoDeNodo } from './doc';
import type { JsonNodo } from './tipos';

const plano = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
/** Las secciones que no se dicen (el pie, los hashtags, el asunto de un correo). */
const NO_SE_DICEN = new Set(['CAPTION', 'PIE', 'DESCRIPCION', 'HASHTAGS', 'ASUNTO', 'NOTAS', 'NOTAS DE PRODUCCION']);
/** Una columna de lo que se dice («Locución», «Dice», «Frase hablada», «Voz»). */
const COLUMNA_DICHA = /locuci|^dice|se dice|habla|^voz|guion hablado/i;
/** Una columna de lo que va escrito en la lámina («Texto en la imagen», «Texto en pantalla»). */
const COLUMNA_LAMINA = /texto en (la )?(imagen|pantalla|lamina|lámina)|lo que dice la l/i;
/** Un renglón que no se dice: lo que se ve, la cámara, el texto en pantalla. */
const NO_SE_DICE = /^(visual|c[aá]mara|se ve|plano|b-?roll|m[uú]sica|nota|t[ií]tulo en pantalla|texto en pantalla|texto en la imagen)\s*:/i;
/** El rótulo de lo que sí se dice («Frase hablada: …», «Dice: …»): queda lo de después. */
const ROTULO_DICHO = /^(frase hablada|dice|locuci[oó]n|voz en off|voz)\s*:\s*/i;
const sinComillas = (t: string) => t.trim().replace(/^[«"“]+|[»"”]+$/g, '').trim();

function filasDeTabla(t: JsonNodo): string[][] {
  return (t.content ?? []).filter((f) => f.type === NODOS.fila).map((f) => (f.content ?? []).map((c) => textoDeNodo(c).replace(/\s+/g, ' ').trim()));
}

/** Los bloques de primer nivel con su sección (sin los títulos). */
function bloquesConSeccion(doc: JsonNodo): { seccion: string | null; b: JsonNodo }[] {
  const out: { seccion: string | null; b: JsonNodo }[] = [];
  let seccion: string | null = null;
  for (const b of doc.content ?? []) {
    if (b.type === NODOS.titulo) { if (esEtiqueta(b.attrs?.seccion)) seccion = String(b.attrs?.seccion); continue; }
    out.push({ seccion, b });
  }
  return out;
}

/**
 * Lo que se DICE en el guion, para el avatar: de una tabla, la columna de la locución; de un texto, los renglones sin lo que se ve
 * ni el texto en pantalla, y sin el destacado de arriba, el pie ni los hashtags.
 */
export function dichoDelGuion(doc: JsonNodo): string {
  const partes: string[] = [];
  for (const { seccion, b } of bloquesConSeccion(doc)) {
    if (seccion && NO_SE_DICEN.has(plano(seccion))) continue;
    if (b.type === NODOS.destacado || b.type === NODOS.separador) continue;
    if (b.type === NODOS.tabla) {
      const [cab, ...filas] = filasDeTabla(b);
      const i = (cab ?? []).findIndex((c) => COLUMNA_DICHA.test(c));
      if (i >= 0) for (const f of filas) { const t = sinComillas(f[i] ?? ''); if (t) partes.push(t); }
      continue;
    }
    for (const linea of textoDeNodo(b).split('\n')) {
      const l = linea.trim();
      if (!l || NO_SE_DICE.test(l)) continue;
      const t = sinComillas(l.replace(ROTULO_DICHO, ''));
      if (t) partes.push(t);
    }
  }
  return partes.join('\n').slice(0, 4_000);
}

export type LaminaDeGuion = { titulo: string; cuerpo: string };

/** Un texto en una lámina: la primera oración arriba (hasta 90 letras) y el resto abajo (hasta 220). */
function enLamina(texto: string): LaminaDeGuion {
  const t = sinComillas(texto.replace(/\s+/g, ' '));
  const corte = t.search(/[.!?…](\s|$)/);
  const primera = corte >= 0 && corte < 120 ? t.slice(0, corte + 1) : t.slice(0, 90);
  return { titulo: primera.trim().slice(0, 90), cuerpo: t.slice(primera.length).trim().slice(0, 220) };
}

/**
 * Las láminas del guion, para un carrusel (entre 2 y 10): la réplica de un carrusel trae su tabla lámina por lámina («Texto en la
 * imagen»); cualquier otro guion va una lámina por sección, con su primera oración como título. Sin el pie ni los hashtags.
 */
export function laminasDelGuion(doc: JsonNodo): LaminaDeGuion[] {
  for (const b of doc.content ?? []) {
    if (b.type !== NODOS.tabla) continue;
    const [cab, ...filas] = filasDeTabla(b);
    const i = (cab ?? []).findIndex((c) => COLUMNA_LAMINA.test(c));
    if (i < 0 || filas.length < 2) continue;
    const laminas = filas.map((f) => enLamina(f[i] ?? '')).filter((l) => l.titulo);
    if (laminas.length >= 2) return laminas.slice(0, 10);
  }
  const porSeccion = new Map<string, string[]>();
  for (const { seccion, b } of bloquesConSeccion(doc)) {
    if (!seccion || NO_SE_DICEN.has(plano(seccion)) || b.type === NODOS.destacado || b.type === NODOS.separador) continue;
    const texto = b.type === NODOS.tabla ? '' : textoDeNodo(b).split('\n').filter((l) => !NO_SE_DICE.test(l.trim())).map((l) => l.replace(ROTULO_DICHO, '')).join(' ');
    if (!texto.trim()) continue;
    porSeccion.set(seccion, [...(porSeccion.get(seccion) ?? []), texto]);
  }
  const laminas: LaminaDeGuion[] = [...porSeccion.values()].map((ts) => enLamina(ts.join(' '))).filter((l) => l.titulo);
  return laminas.slice(0, 10);
}
