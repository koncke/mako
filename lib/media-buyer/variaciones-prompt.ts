// =============================================================================
// Media Buyer — el pedido de VARIACIONES a la IA del negocio, y cómo se lee lo que vuelve (PURO)
// =============================================================================
// «Lo que gana alimenta lo que se escribe» (memoria ads-analyst-vs-ads-writer): las variaciones salen del anuncio que
// MÁS resultados del CRM trajo, con sus textos y, si es un video, con lo que se dice en él. El modelo escribe en la
// voz del NEGOCIO, en español neutro: la voz rioplatense de MaKo nunca va en el texto de un anuncio (AGENTS.md, «La
// voz de MaKo es rioplatense, y el texto DEL CLIENTE no»). La segunda capa es medir la salida: una variación con
// marcas de voseo se descarta (`marcasDeVoseo`, lib/puestas-data.ts).
//
// Sin `server-only`: lo prueban los tests.
// =============================================================================

import { marcasDeVoseo } from '@/lib/puestas-data';
import type { Variacion } from './tipos';

export const CUANTAS_VARIACIONES = 4;
const MAX_TEXTO = 1500;
const MAX_TITULO = 120;
const MAX_GANCHO = 200;

export type BaseVariaciones = {
  tipo: 'texto' | 'hook';
  textoPrincipal: string | null;
  titulo: string | null;
  /** Lo que se dice en el video (ad_transcripts), si es un video. */
  transcripcion: string | null;
  /** Los números del ganador, para que el modelo sepa POR QUÉ es el que se copia. */
  porQueGana: string;
  perfilNegocio: string;
};

export function promptVariaciones(b: BaseVariaciones): { system: string; user: string } {
  const system = [
    'Eres el redactor de anuncios de Meta de un negocio. Escribes VARIACIONES de su anuncio ganador para probar contra él.',
    'Reglas:',
    '- Español neutro profesional, con «tú». NUNCA voseo ni modismos rioplatenses.',
    // Martín a Julio (13/11, min 00:51:25): las variaciones del ganador van «con el mismo copy, ángulo, dolor y avatar». Antes pedía
    // un ÁNGULO distinto por variación: lo contrario (docs/relevo/llamada-julio-13-11.md, «Meta Ads», punto 3).
    '- Conserva el ÁNGULO, el DOLOR, el AVATAR (a quién le habla), la oferta y la promesa del original: son los que ganaron.',
    '- Lo que cambia es sólo el GANCHO y la forma: otra primera frase, otro orden, otro largo, otro formato de la misma idea.',
    '- Cada variación prueba un gancho distinto para el MISMO mensaje; si cambias el dolor o a quién le habla, ya no es una variación del ganador.',
    '- No inventes datos, precios, testimonios ni cifras que no estén en el original o en el perfil del negocio.',
    '- Cumple las políticas de Meta: sin atributos personales («¿Estás endeudado?»), sin promesas de resultados garantizados.',
    b.tipo === 'hook'
      ? '- Es un VIDEO: el «gancho» es la primera frase que se dice en los primeros 3 segundos. El texto principal arranca con ese gancho escrito.'
      : '- El «gancho» es la primera línea del texto principal: la que se ve antes del «Ver más».',
    `Devuelves SOLO un JSON: {"variaciones":[{"gancho":"…","textoPrincipal":"…","titulo":"…"}]} con exactamente ${CUANTAS_VARIACIONES} elementos.`,
    `Límites: gancho hasta ${MAX_GANCHO} caracteres, título hasta 40, texto principal hasta ${MAX_TEXTO}.`,
  ].join('\n');
  const user = [
    `Por qué es el ganador: ${b.porQueGana}`,
    b.textoPrincipal ? `Texto principal del ganador:\n${b.textoPrincipal}` : 'El ganador no tiene texto principal legible.',
    b.titulo ? `Título del ganador: ${b.titulo}` : '',
    b.transcripcion ? `Lo que se dice en el video del ganador:\n${b.transcripcion.slice(0, 4000)}` : '',
    b.perfilNegocio ? `Perfil del negocio:\n${b.perfilNegocio.slice(0, 3000)}` : '',
  ].filter(Boolean).join('\n\n');
  return { system, user };
}

/**
 * Lee la respuesta del modelo. Se queda con las variaciones que tienen texto, recorta a los límites, saca las
 * repetidas (entre sí y con el original) y las que traen voseo. Devuelve [] si no hay ninguna usable.
 */
export function parsearVariaciones(crudo: string, original: { textoPrincipal: string | null }, idBase: string): Variacion[] {
  let j: unknown = null;
  const limpio = crudo.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { j = JSON.parse(limpio); } catch {
    const m = limpio.match(/\{[\s\S]*\}/);
    if (m) { try { j = JSON.parse(m[0]); } catch { j = null; } }
  }
  const lista = (j as { variaciones?: unknown })?.variaciones;
  if (!Array.isArray(lista)) return [];
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const vistos = new Set<string>(original.textoPrincipal ? [norm(original.textoPrincipal)] : []);
  const out: Variacion[] = [];
  for (const x of lista) {
    const o = (x ?? {}) as Record<string, unknown>;
    const texto = typeof o.textoPrincipal === 'string' ? o.textoPrincipal.trim().slice(0, MAX_TEXTO) : '';
    if (texto.length < 20) continue;
    const gancho = typeof o.gancho === 'string' ? o.gancho.trim().slice(0, MAX_GANCHO) : '';
    const titulo = typeof o.titulo === 'string' ? o.titulo.trim().slice(0, MAX_TITULO) : '';
    if (marcasDeVoseo(`${gancho}\n${texto}\n${titulo}`).length) continue;
    const k = norm(texto);
    if (vistos.has(k)) continue;
    vistos.add(k);
    out.push({ id: `${idBase}-${out.length + 1}`, textoPrincipal: texto, ...(titulo ? { titulo } : {}), ...(gancho ? { gancho } : {}), elegida: true });
    if (out.length >= CUANTAS_VARIACIONES) break;
  }
  return out;
}
