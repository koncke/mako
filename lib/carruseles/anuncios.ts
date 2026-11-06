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
// SÓLO IMÁGENES (6/11/2026; Martín: «en anuncios trajiste un montón de videos, cuando estamos viendo solo imágenes»). El explorador
// es de Image: un anuncio en video no se puede «Editar» como un diseño, así que no se muestra ni se cuenta. Cómo se sabe:
//   · lo dice Spy desde el 6/11/2026: el actor de Apify trae `displayFormat` (VIDEO, IMAGE, CAROUSEL…) y la pieza guarda su
//     `medio` (lib/spy-todo-reglas.ts → `anuncioDeApify`, `medioDeAnuncio`);
//   · lo de antes no tiene `medio`: su miniatura, si sigue siendo la del CDN de Meta, lo delata (los cuadros de un video van en
//     `/t15.` y las imágenes de un anuncio en `/t39.`). Sin ninguna de las dos señales, se muestra: sin dato no es «video». La
//     lectura de cada cuenta que Spy repite cada semana le pone el `medio` a todos.
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
  /** carrusel · imagen · video (mig 0391; en los anuncios, desde el 6/11/2026). Ausente o null: no se sabe. */
  medio?: string | null;
};

/**
 * ¿El anuncio es un video? `true` sólo con una señal: su `medio`, o la miniatura del CDN de Meta en la carpeta de los cuadros de
 * video (`/t15.`). Sin señal, `false`: no se esconde lo que no se sabe.
 */
export function esAnuncioEnVideo(p: Pick<PiezaAnuncio, 'medio' | 'miniatura'>): boolean {
  if (p.medio === 'video') return true;
  if (p.medio === 'imagen' || p.medio === 'carrusel') return false;
  const u = p.miniatura ?? '';
  return /^https:\/\/[^/]*(?:fbcdn\.net|facebook\.com)\/v\/t15\./i.test(u);
}

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
 * sigue y sólo los de IMAGEN (un video no entra: ver arriba); uno sin miniatura se ve con su texto.
 */
export function anunciosDe(piezas: readonly PiezaAnuncio[], competidores: readonly CompetidorParaCarrusel[], ahora = Date.now()): Carrusel[] {
  const porId = new Map(competidores.map((c) => [c.id, c]));
  const out: Carrusel[] = [];
  for (const p of piezas) {
    const c = porId.get(p.competidor_id);
    if (!c || p.canal !== 'anuncios' || p.tipo !== 'anuncio' || esAnuncioEnVideo(p)) continue;
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
