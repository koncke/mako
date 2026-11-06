// =============================================================================
// carruseles/anuncios — los anuncios de la competencia en el explorador de carruseles (6/11/2026)
// =============================================================================
// Martín, 6/11/2026: «Investigá apps y fuentes reales para ver anuncios de la competencia o los que mejor funcionan, sobre
// todo de imagen, para poder copiarlos… y sumalo a esta misma tab con filtros si lo podés hacer con lo que MaKo ya tiene».
//
// LO QUE MaKo YA TIENE: Competitors Spy trae los anuncios de la Biblioteca de Anuncios de Meta de cada competidor que el negocio
// sigue, con la clave de Apify DEL NEGOCIO (lib/spy-todo.ts, el actor `apify~facebook-ads-scraper`), y los guarda en
// `spy_piezas` (canal «anuncios»). Acá se muestran ESOS, del negocio que los trajo, nunca de otro: los términos de Meta no
// dejan pasarle a un tercero lo que se recolecta (docs/hallazgos-competitors-spy.md, «Los anuncios no se copian»). Por eso
// la biblioteca de ejemplos de la plataforma NO tiene anuncios. La comparación con otras fuentes (Foreplay, Atria…), en
// docs/hallazgos-carruseles.md.
//
// QUÉ DICE QUE UN ANUNCIO FUNCIONA: cuántos días lleva al aire (un anunciante no paga semanas por un anuncio que no vende).
// La Biblioteca no da gasto ni resultados fuera de la UE, así que no hay outlier: el orden «Mayor outlier» es, para ellos,
// «Más días al aire» (./explorar.ts). Sin la fecha de inicio, null: no se afirma un cero.
//
// Puro, con su test (tests/carruseles-anuncios.test.ts).
// =============================================================================

import { formatoDe } from '../spy-detalle';
import { tipoDeCarrusel } from './clasificar';
import { ctaDeTexto } from './cta';
import { cierreDeTexto } from './texto';
import type { Carrusel, CompetidorParaCarrusel } from './explorar';

/** Un anuncio como lo guarda Spy (`spy_piezas`, canal «anuncios»): las columnas que se leen. */
export type PiezaAnuncio = {
  id: number; competidor_id: number; canal: string; tipo: string; url: string | null; texto: string | null; titulo?: string | null;
  analisis?: { gancho?: string; tipoGancho?: string; formato?: string } | null;
  publicada_en: string | null; dejo_de_verse_en: string | null; visto_primera_vez: string; miniatura: string | null;
};

const DIA = 86_400_000;

/** Días al aire: del día que empezó al que terminó (o a hoy si sigue). null sin fecha de inicio, o con fechas al revés. */
export function diasAlAire(desde: string | null, hasta: string | null, ahora = Date.now()): number | null {
  const d = Date.parse(desde ?? '');
  if (!Number.isFinite(d)) return null;
  const h = hasta ? Date.parse(hasta) : ahora;
  if (!Number.isFinite(h) || h < d) return null;
  return Math.max(1, Math.round((h - d) / DIA) + 1);
}

/** «Al aire hace 45 días» / «Estuvo 12 días»: lo que dice la tarjeta. */
export function rotuloAire(c: Pick<Carrusel, 'diasAlAire' | 'activo'>): string | null {
  if (c.diasAlAire == null) return null;
  const n = c.diasAlAire;
  const dias = `${n} ${n === 1 ? 'día' : 'días'}`;
  return c.activo === false ? `Estuvo ${dias}` : `${dias} al aire`;
}

/**
 * Los anuncios de los competidores como tarjetas del explorador (clase «anuncio»). Sólo los de un competidor que el negocio
 * sigue; con o sin imagen (un anuncio sin miniatura se ve con su texto). Los que siguen al aire van antes, en el orden.
 */
export function anunciosDe(piezas: readonly PiezaAnuncio[], competidores: readonly CompetidorParaCarrusel[], ahora = Date.now()): Carrusel[] {
  const porId = new Map(competidores.map((c) => [c.id, c]));
  const out: Carrusel[] = [];
  for (const p of piezas) {
    const c = porId.get(p.competidor_id);
    if (!c || p.canal !== 'anuncios' || p.tipo !== 'anuncio') continue;
    const texto = [p.titulo, p.texto].map((x) => x?.trim()).filter(Boolean).join('\n') || null;
    const formato = formatoDe(p.analisis?.formato) || tipoDeCarrusel({ texto });
    out.push({
      id: p.id,
      competidorId: c.id,
      origen: 'cuentas',
      creador: { nombre: c.nombre, usuario: c.instagram, foto: c.avatar ?? null },
      url: p.url,
      miniatura: p.miniatura,
      texto,
      gancho: p.analisis?.gancho?.trim() || p.titulo?.trim() || null,
      tipoGancho: p.analisis?.tipoGancho?.trim() || null,
      cierre: cierreDeTexto(texto),
      formato,
      medio: 'imagen',
      laminas: null,
      megusta: null,
      comentarios: null,
      publicada: p.publicada_en,
      traida: p.visto_primera_vez,
      outlier: null,
      clase: 'anuncio',
      laminasImagenes: [],
      cta: ctaDeTexto(texto),
      diasAlAire: diasAlAire(p.publicada_en, p.dejo_de_verse_en, ahora),
      activo: !p.dejo_de_verse_en,
      pareceContenido: null,
    });
  }
  return out;
}
