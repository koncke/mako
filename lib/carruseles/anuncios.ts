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
//   · lo dice Spy desde el 6/11/2026: el actor de Apify trae `displayFormat` (VIDEO, IMAGE, CAROUSEL…) y la extensión, el
//     `<video>` de la tarjeta; la pieza guarda su `medio` (lib/spy-todo-reglas.ts → `anuncioDeApify`; lib/spy-captura.ts);
//   · lo de antes no tiene `medio`: su miniatura, si sigue siendo la del CDN de Meta, lo delata (los cuadros de un video van en
//     `/t15.` y las imágenes de un anuncio en `/t39.`).
//
// ⚠️ Y PARA LO YA GUARDADO ESA PISTA NO EXISTE, medido el 6/11/2026 contra producción: de los 300 anuncios guardados, 297
// tienen la miniatura ya copiada a NUESTRO bucket (la del CDN vence), 2 quedaron en `/t39.` y 1 sin miniatura → la regla de
// `/t15.` acierta en 0. Ninguno trae otra señal (ni `analisis`, ni `duracion`, ni el tiempo del video en el texto) y la
// lectura cruda tampoco quedó (`spy_lecturas_canal` no guarda el canal «anuncios»). Así que de 300 no se sabe nada de 298,
// y lo honesto es decirlo: un «no sé» se MUESTRA (sin dato no es «video») pero se cuenta aparte (`anunciosSinSaber`) y hay
// filtro para dejarlo afuera. Qué lo destraba, sin gastar un centavo de Apify: otro recorrido de la Biblioteca de Anuncios
// con la extensión, que ahora sí guarda el medio. Ver docs/hallazgos-carruseles.md.
//
// Puro, con su test (tests/carruseles-anuncios.test.ts).
// =============================================================================

import type { Medio } from '../spy-medio';
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

/** Las carpetas del CDN de Meta que delatan qué es la miniatura: los cuadros de un video y las imágenes de un anuncio. */
const CARPETA_CDN = (carpeta: string) => new RegExp(`^https://[^/]*(?:fbcdn\\.net|facebook\\.com)/v/${carpeta}\\.`, 'i');
const CUADRO_DE_VIDEO = CARPETA_CDN('t15');
const IMAGEN_DE_ANUNCIO = CARPETA_CDN('t39');

/**
 * Qué es el anuncio, con lo que quedó guardado: su `medio` si la lectura lo supo, o la carpeta de su miniatura si todavía
 * apunta al CDN de Meta. **`null` = no se sabe**, y eso no es ni «video» ni «imagen»: es el estado real de casi todo lo
 * guardado antes del 6/11/2026 (ver la cabecera). Quien decide qué hacer con un `null` es el explorador, no esta función.
 */
export function medioGuardadoDeAnuncio(p: Pick<PiezaAnuncio, 'medio' | 'miniatura'>): Medio | null {
  if (p.medio === 'video' || p.medio === 'imagen' || p.medio === 'carrusel') return p.medio;
  const u = p.miniatura ?? '';
  if (CUADRO_DE_VIDEO.test(u)) return 'video';
  if (IMAGEN_DE_ANUNCIO.test(u)) return 'imagen';
  return null;
}

/**
 * ¿El anuncio es un video? `true` sólo con una señal (su `medio` o la carpeta `/t15.` del CDN). Sin señal, `false`: no se
 * esconde lo que no se sabe.
 */
export function esAnuncioEnVideo(p: Pick<PiezaAnuncio, 'medio' | 'miniatura'>): boolean {
  return medioGuardadoDeAnuncio(p) === 'video';
}

/**
 * De lo que se MUESTRA, cuántos anuncios no dicen si son video (su `medio` quedó en null). Es el número que el contador tiene
 * que decir para no mentir: «300 anuncios» cuando de 298 no se sabe nada no es un contador, es una afirmación inventada.
 */
export function anunciosSinSaber(cs: readonly Pick<Carrusel, 'clase' | 'medio'>[]): number {
  return cs.filter((c) => c.clase === 'anuncio' && c.medio == null).length;
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
 * El texto de un anuncio SIN las variables de un anuncio de catálogo de Meta (12/11/2026). La Biblioteca de Anuncios guarda la
 * plantilla, no lo que vio cada persona: dos anuncios de @sofiacontreras se mostraban con el título «{{product.name}}» y
 * «{{product.brand}}», y eso mismo iba como «pie» al prompt de la réplica. Una línea que era sólo variables se va entera.
 */
export function sinVariablesDeCatalogo(x: string | null | undefined): string | null {
  if (!x) return null;
  const limpio = x.split('\n').map((r) => r.replace(/\{\{\s*[\w.]+\s*\}\}/g, '').replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n');
  return limpio || null;
}

/**
 * Los anuncios de los competidores como tarjetas del explorador (clase «anuncio»). Sólo los de un competidor que el negocio
 * sigue y sólo los que NO se sabe que son video (ver arriba); uno sin miniatura se ve con su texto.
 *
 * ⚠️ El `medio` de la tarjeta es el que se sabe, `null` incluido. Antes iba `'imagen'` fijo, y ésa era la mentira del
 * contador: convertía «no sé» en «es imagen» para todas las piezas viejas.
 */
export function anunciosDe(piezas: readonly PiezaAnuncio[], competidores: readonly CompetidorParaCarrusel[], ahora = Date.now()): Carrusel[] {
  const porId = new Map(competidores.map((c) => [c.id, c]));
  const out: Carrusel[] = [];
  for (const p of piezas) {
    const c = porId.get(p.competidor_id);
    const medio = medioGuardadoDeAnuncio(p);
    if (!c || p.canal !== 'anuncios' || p.tipo !== 'anuncio' || medio === 'video') continue;
    const texto = [sinVariablesDeCatalogo(p.titulo), sinVariablesDeCatalogo(p.texto)].filter(Boolean).join('\n') || null;
    const formato = formatoDe(p.analisis?.formato) || tipoDeCarrusel({ texto });
    out.push({
      id: p.id,
      competidorId: c.id,
      origen: 'cuentas',
      creador: { nombre: c.nombre, usuario: c.instagram, foto: c.avatar ?? null },
      url: p.url,
      miniatura: p.miniatura,
      texto,
      gancho: sinVariablesDeCatalogo(p.analisis?.gancho) || sinVariablesDeCatalogo(p.titulo) || null,
      tipoGancho: p.analisis?.tipoGancho?.trim() || null,
      cierre: cierreDeTexto(texto),
      formato,
      medio,
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
