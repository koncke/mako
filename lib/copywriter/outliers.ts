// =============================================================================
// copywriter/outliers — los outliers de copy: la portada del Copywriter (`/copywriter`), el contrato (PURO; 11/11/2026)
// =============================================================================
// Martín (11/11/2026): «me gustaría traer outliers. Tenemos la transcripción de un montón de cosas, tanto de anuncios como de
// carruseles, como de reels, y videos de YouTube… podríamos mantener templates con ciertas estructuras, pero también traer los
// outliers». Diseño: docs/diseno-copywriter.md, D18. El contrato es el de Video (lib/video-outliers.ts): FUENTES enchufables
// (./outliers-servidor.ts) que devuelven `OutlierCopy`, y `juntarOutliersCopy` los ordena para la portada.
//
// LO QUE TRAE CADA OUTLIER es su TEXTO: el guion si ya se transcribió (Spy, al abrir su detalle), si no el pie, la descripción
// de YouTube o el copy del anuncio. La tarjeta dice cuál es (`deDonde`): no hay transcripción masiva y no se promete (medido el
// 11/11/2026 en producción: 0 guiones en el ws 3, 11 en toda la base).
//
// LAS REGLAS DE LA PORTADA (las de Video, que la fuente no repite):
//   · «No pude leer» no es «no hay»: una fuente que falla vuelve `{ ok: false, motivo }` y la portada lo dice;
//   · el número es el de toda la app (lib/multiplo-rendimiento.ts), con su motivo cuando no hay; nunca uno propio;
//   · el dato de un tercero no se republica: la tarjeta lleva el link al original, y el texto se usa para que MaKo copie la
//     ESTRUCTURA, nunca las frases (`textoParaMaKo`).
//
// Puro (sin `server-only`): lo usan el lector, la pantalla, la API de MaKo y los tests.
// =============================================================================

import { multiplosDe, type Multiplo, type PiezaParaMultiplo } from '../multiplo-rendimiento';
import { conVariedad } from '../carruseles/variedad';
import type { Carrusel } from '../carruseles/explorar';
import type { TipoGuion } from './tipos';

export const FORMATOS_COPY = ['anuncio', 'reel', 'carrusel', 'youtube'] as const;
export type FormatoCopy = (typeof FORMATOS_COPY)[number];
export const esFormatoCopy = (v: unknown): v is FormatoCopy => (FORMATOS_COPY as readonly unknown[]).includes(v);

/** Cómo se nombra cada formato y en qué tipo de página se replica (lib/copywriter/tipos.ts). */
export const INFO_FORMATO: Readonly<Record<FormatoCopy, { label: string; plural: string; tipo: TipoGuion; red: string }>> = {
  anuncio: { label: 'Anuncio', plural: 'Anuncios', tipo: 'ad', red: 'la Biblioteca de Anuncios' },
  reel: { label: 'Reel', plural: 'Reels', tipo: 'reel', red: 'Instagram' },
  carrusel: { label: 'Carrusel', plural: 'Carruseles', tipo: 'post', red: 'Instagram' },
  youtube: { label: 'YouTube', plural: 'YouTube', tipo: 'youtube', red: 'YouTube' },
};

/** Lo que dice la tarjeta del formato: «Reel», «Carrusel · 7 láminas», «YouTube», «Anuncio». */
export function rotuloDeFormato(o: { formato: FormatoCopy; laminas?: number | null }): string {
  return o.formato === 'carrusel' && (o.laminas ?? 0) > 1 ? `Carrusel · ${o.laminas} láminas` : INFO_FORMATO[o.formato].label;
}

/** Los días al aire de un anuncio, como en Image. */
export const rotuloDiasAlAire = (d: number | null | undefined): string | null => (d == null ? null : d === 1 ? '1 día al aire' : `${d} días al aire`);

/** Qué texto trae: el guion transcripto, el pie de Instagram, la descripción de YouTube o el copy del anuncio. */
export type DeDondeTexto = 'guion' | 'pie' | 'descripcion' | 'copy';
export const ROTULO_TEXTO: Readonly<Record<DeDondeTexto, string>> = { guion: 'Su guion', pie: 'Su pie', descripcion: 'Su descripción', copy: 'Su copy' };

export type OutlierCopy = {
  /** `<fuente>:<id de la fuente>`: único entre fuentes y estable (la página replicada lo guarda en `props.outlier`). */
  id: string;
  fuente: 'spy' | 'biblioteca';
  formato: FormatoCopy;
  /** `competidorId`: su ficha en Competitors Spy (null = no es de Spy). */
  creador: { nombre: string; usuario: string | null; foto: string | null; competidorId: number | null };
  /** El link al original: siempre (una tarjeta sin él no se puede verificar). */
  url: string;
  /** Una imagen que guardamos NOSOTROS (Spy o la biblioteca, en nuestro bucket). null = no hay. */
  miniatura: string | null;
  /** Con qué abre: el gancho que leyó Spy, el título (YouTube, anuncio) o la primera línea del texto. */
  gancho: string;
  texto: string;
  deDonde: DeDondeTexto;
  /** El número de toda la app, o su motivo. null = la fuente no lo midió. */
  multiplo: Multiplo | null;
  /** Un anuncio: cuántos días lleva (o llevó) al aire. */
  diasAlAire?: number | null;
  vistas: number | null;
  megusta: number | null;
  comentarios: number | null;
  publicada: string | null;
  /** Un carrusel: cuántas láminas tiene (null = no se sabe). */
  laminas?: number | null;
};

export type LecturaFuenteCopy = { ok: true; outliers: readonly OutlierCopy[] } | { ok: false; motivo: string };
export type FuenteOutliersCopy = { id: string; nombre: string; leer: () => Promise<LecturaFuenteCopy> };
export type PortadaCopy = { outliers: OutlierCopy[]; caidas: { fuente: string; nombre: string; motivo: string }[] };

/** Cuánto texto viaja a la pantalla por tarjeta (el entero se lee al abrir y al replicar). */
export const TEXTO_EN_TARJETA = 600;
/** Cuánto del original le llega a MaKo: un guion de YouTube entero no entra en un pedido. */
export const TEXTO_PARA_MAKO = 6000;

const ID_OUTLIER = /^(spy|biblioteca):-?\d{1,12}$/;
/** ¿Es un id de outlier de copy? (la página replicada lo guarda; la API y la pantalla lo mandan). */
export const esIdOutlierCopy = (v: unknown): v is string => typeof v === 'string' && ID_OUTLIER.test(v);

/** La primera línea con texto, sin cortar una palabra al medio. */
export function primeraLinea(texto: string | null | undefined, tope = 140): string {
  const l = (texto ?? '').split('\n').map((x) => x.trim()).find(Boolean) ?? '';
  return l.length > tope ? `${l.slice(0, tope - 1).trimEnd()}…` : l;
}

// ── Competitors Spy: reels, publicaciones, YouTube y anuncios de las cuentas que sigue el negocio ──────────────────────

/** Lo que se lee de `spy_piezas` (la forma de la tabla). */
export type PiezaSpyCopy = PiezaParaMultiplo & {
  url: string | null;
  miniatura: string | null;
  laminas?: number | null;
  analisis?: { gancho?: string | null } | null;
  primera_vez_visto?: string | null;
};
export type CuentaSpyCopy = { id: number; nombre: string; instagram: string | null; avatar?: string | null };

/** El formato de copy de una pieza de Spy (null = no es copy: una landing, una web). */
export function formatoDePiezaSpy(p: Pick<PiezaSpyCopy, 'canal' | 'tipo' | 'medio'>): FormatoCopy | null {
  if (p.canal === 'anuncios') return 'anuncio';
  if (p.canal === 'youtube') return 'youtube';
  if (p.canal !== 'instagram') return null;
  if (p.tipo === 'reel' || p.medio === 'video') return 'reel';
  return p.tipo === 'publicacion' ? 'carrusel' : null;
}

const dias = (desde: string | null | undefined, hasta: number): number | null => {
  const t = Date.parse(desde ?? '');
  return Number.isFinite(t) ? Math.max(0, Math.floor((hasta - t) / 86_400_000)) : null;
};

/**
 * Las piezas de Spy con texto, como outliers de copy. El múltiplo de cada una sale de TODAS las piezas de su cuenta (el mismo
 * número que dice Spy). `guiones`: los ya transcriptos (`spy.transcripcion.*`), por id de pieza: mandan sobre el pie.
 * Lo orgánico que ya no se ve no entra; un anuncio que terminó sí (lo que duró al aire es justo su mérito).
 */
export function outliersCopyDeSpy(
  piezas: readonly PiezaSpyCopy[], cuentas: readonly CuentaSpyCopy[], guiones: ReadonlyMap<number, string> = new Map(), ahora: number = Date.now(),
): OutlierCopy[] {
  const porId = new Map(cuentas.map((c) => [c.id, c]));
  const porCuenta = new Map<number, PiezaSpyCopy[]>();
  for (const p of piezas) {
    if (!porId.has(p.competidor_id)) continue;
    const xs = porCuenta.get(p.competidor_id);
    if (xs) xs.push(p); else porCuenta.set(p.competidor_id, [p]);
  }
  const out: OutlierCopy[] = [];
  for (const [cid, suyas] of porCuenta) {
    const c = porId.get(cid)!;
    const multiplos = multiplosDe(suyas, ahora);
    for (const p of suyas) {
      const formato = formatoDePiezaSpy(p);
      if (!formato || !p.url || !/^https:\/\//.test(p.url)) continue;
      if (formato !== 'anuncio' && p.dejo_de_verse_en) continue;
      const guion = guiones.get(p.id)?.trim() || '';
      const texto = guion || (p.texto ?? '').trim();
      const titulo = (p.titulo ?? '').trim();
      if (!texto && !titulo) continue;
      const deDonde: DeDondeTexto = guion ? 'guion' : formato === 'anuncio' ? 'copy' : formato === 'youtube' ? 'descripcion' : 'pie';
      out.push({
        id: `spy:${p.id}`,
        fuente: 'spy',
        formato,
        creador: { nombre: c.nombre, usuario: c.instagram, foto: c.avatar ?? null, competidorId: cid },
        url: p.url,
        miniatura: p.miniatura && /^(https:\/\/|\/)/.test(p.miniatura) ? p.miniatura : null,
        gancho: p.analisis?.gancho?.trim() || titulo || primeraLinea(texto),
        texto: texto || titulo,
        deDonde,
        multiplo: formato === 'anuncio' ? null : multiplos.get(p.id) ?? null,
        ...(formato === 'anuncio' ? { diasAlAire: dias(p.publicada_en ?? p.primera_vez_visto, Date.parse(p.dejo_de_verse_en ?? '') || ahora) } : {}),
        vistas: p.vistas, megusta: p.megusta, comentarios: p.comentarios,
        publicada: p.publicada_en,
        ...(formato === 'carrusel' ? { laminas: p.laminas ?? null } : {}),
      });
    }
  }
  return out;
}

// ── La biblioteca de carruseles de la plataforma (la de Image, para todos los negocios) ──────────────────────────────

/** Un carrusel de la biblioteca (lib/carruseles/biblioteca-servidor.ts, `carruselesDeLaBiblioteca`) como outlier de copy. */
export function outliersCopyDeBiblioteca(carruseles: readonly Carrusel[]): OutlierCopy[] {
  const out: OutlierCopy[] = [];
  for (const c of carruseles) {
    const texto = (c.texto ?? '').trim();
    if (!texto || !c.url || !/^https:\/\//.test(c.url) || c.id >= 0) continue;
    out.push({
      id: `biblioteca:${c.id}`,
      fuente: 'biblioteca',
      formato: 'carrusel',
      creador: { nombre: c.creador.nombre, usuario: c.creador.usuario, foto: c.creador.foto, competidorId: null },
      url: c.url,
      miniatura: c.miniatura,
      gancho: (c.gancho ?? '').trim() || primeraLinea(texto),
      texto,
      deDonde: 'pie',
      multiplo: c.multiplo ?? null,
      vistas: null, megusta: c.megusta, comentarios: c.comentarios,
      publicada: c.publicada,
      laminas: c.laminas,
    });
  }
  return out;
}

// ── La portada ──────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * El link sin lo que no lo distingue (para no repetir): sin `#…` ni parámetros de seguimiento, pero CON los que SON el contenido
 * (`v` de YouTube, `id` de la Biblioteca de Anuncios). ⚠️ El de Video (lib/video-outliers.ts) corta todo el `?…`: con sus reels de
 * Instagram da igual, pero acá dejaba UN solo video de YouTube de 369 (todos son `youtube.com/watch?v=…`; medido en el ws 3).
 */
export function claveDeLink(url: string): string {
  try {
    const u = new URL(url);
    const propios = ['v', 'id'].filter((k) => u.searchParams.has(k)).map((k) => `${k}=${u.searchParams.get(k)}`);
    return `${u.host.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '')}${propios.length ? `?${propios.join('&')}` : ''}`.toLowerCase();
  } catch {
    return url.replace(/#.*$/, '').replace(/\/$/, '');
  }
}

/** Cuántas palabras tiene que tener un pie para ser copy: «🤣🤣🤣» o «We have fun» son de una cuenta personal, no un copy. */
export const PALABRAS_MINIMAS_PIE = 15;
// Una variable de plantilla («{{product.name}}» de un anuncio de catálogo) no es una palabra: 11/11/2026, simulado con los datos
// del ws 9, esos anuncios quedaban entre los diez primeros de la portada con «{{product.name}}» de gancho.
const palabras = (s: string) => (s.replace(/\{\{[^{}]*\}\}/g, ' ').match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;

/**
 * ¿Su texto es copy? El guion, sí; el título de un video de YouTube o de un anuncio, también (es su gancho). El pie de Instagram o
 * la descripción, sólo con `PALABRAS_MINIMAS_PIE` palabras: medido en el ws 3, la mitad de los pies eran un emoji o una frase suelta.
 */
export function esCopy(o: Pick<OutlierCopy, 'formato' | 'deDonde' | 'texto' | 'gancho'>): boolean {
  if (o.deDonde === 'guion') return true;
  if (o.formato === 'youtube' || o.formato === 'anuncio') return palabras(`${o.gancho} ${o.texto}`) >= 3;
  return palabras(o.texto) >= PALABRAS_MINIMAS_PIE;
}

/** Una fila que no cumple el contrato no se dibuja (una fuente nueva puede traer basura). */
export function outlierCopyValido(o: OutlierCopy): boolean {
  if (!o || !esIdOutlierCopy(o.id) || !o.id.startsWith(`${o.fuente}:`) || !esFormatoCopy(o.formato)) return false;
  if (typeof o.url !== 'string' || !/^https:\/\//.test(o.url)) return false;
  return typeof o.gancho === 'string' && o.gancho.trim().length > 0 && typeof o.texto === 'string' && o.texto.trim().length > 0;
}

/** El número para ordenar: el «×»; un anuncio, sus días al aire divididos por 30 (un mes al aire pesa como un 1×). */
const pesoDe = (o: OutlierCopy): number => (o.multiplo && o.multiplo.veces != null ? o.multiplo.veces : o.diasAlAire != null ? o.diasAlAire / 30 : -1);

/** Como mucho 2 del mismo creador cada 12 tarjetas (`conVariedad`, la de los carruseles y Video). */
const variedad = (xs: readonly OutlierCopy[]) => conVariedad(xs, (o) => o.creador.usuario ?? o.creador.nombre);

/**
 * Los formatos INTERCALADOS: en cada vuelta entra el mejor que queda de cada formato, del más fuerte al más débil. Dentro de un
 * formato el orden no cambia (filtrar por uno da lo mismo que antes).
 * ⚠️ 11/11/2026, en producción en el ws 3: las 24 primeras tarjetas de «Todos» eran carruseles en inglés de la biblioteca (de
 * 1.219× a 29×); los reels y los videos del nicho del negocio quedaban cientos de tarjetas más abajo. La portada de copy es de
 * TODOS los formatos: se tienen que ver desde la primera fila.
 */
export function intercalarFormatos(xs: readonly OutlierCopy[]): OutlierCopy[] {
  const filas = new Map<FormatoCopy, OutlierCopy[]>();
  for (const o of xs) { const f = filas.get(o.formato); if (f) f.push(o); else filas.set(o.formato, [o]); }
  const out: OutlierCopy[] = [];
  for (let i = 0; out.length < xs.length; i++) {
    const vuelta = [...filas.values()].map((f) => f[i]).filter((o): o is OutlierCopy => !!o);
    out.push(...vuelta.sort((a, b) => pesoDe(b) - pesoDe(a)));
  }
  return out;
}

/**
 * Junta lo leído de cada fuente: lo inválido afuera, sin repetidos (por id y por link), del que más superó a su cuenta al que
 * menos (sin número al final, por sus vistas), con variedad de creadores. Una fuente caída no tira las demás.
 */
export function juntarOutliersCopy(lecturas: readonly { fuente: FuenteOutliersCopy; lectura: LecturaFuenteCopy }[]): PortadaCopy {
  const vistos = new Set<string>();
  const outliers: OutlierCopy[] = [];
  const caidas: PortadaCopy['caidas'] = [];
  for (const { fuente, lectura } of lecturas) {
    if (!lectura.ok) { caidas.push({ fuente: fuente.id, nombre: fuente.nombre, motivo: lectura.motivo }); continue; }
    for (const o of lectura.outliers) {
      if (!outlierCopyValido(o) || !esCopy(o)) continue;
      const k = claveDeLink(o.url);
      if (vistos.has(o.id) || vistos.has(k)) continue;
      vistos.add(o.id); vistos.add(k);
      outliers.push({ ...o, texto: o.texto.length > TEXTO_EN_TARJETA ? `${o.texto.slice(0, TEXTO_EN_TARJETA - 1).trimEnd()}…` : o.texto });
    }
  }
  outliers.sort((a, b) => pesoDe(b) - pesoDe(a) || (b.vistas ?? -1) - (a.vistas ?? -1));
  // El MISMO copy del mismo creador es uno solo (queda el más fuerte, que va primero): 11/11/2026, simulado con los datos del ws 9,
  // «Learn How to Scale Your Business» salía dos veces seguidas porque el mismo texto corre en varios anuncios.
  const textos = new Set<string>();
  const unicos = outliers.filter((o) => {
    const k = `${o.creador.competidorId ?? o.creador.usuario ?? o.creador.nombre}|${plano(`${o.gancho} ${o.texto}`).replace(/\s+/g, ' ').trim()}`;
    if (textos.has(k)) return false;
    textos.add(k);
    return true;
  });
  return { outliers: variedad(intercalarFormatos(unicos)), caidas };
}

/** Los filtros de la portada: el segmento (todos o un formato) y lo que se busca (en el gancho, el texto y el @). */
export type FiltrosCopy = { formato: FormatoCopy | null; q: string };
export type OrdenCopy = 'outlier' | 'recientes';

const plano = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function filtrarOutliersCopy(xs: readonly OutlierCopy[], f: FiltrosCopy, orden: OrdenCopy = 'outlier'): OutlierCopy[] {
  const q = plano(f.q.trim());
  const filtrados = xs.filter((o) => (!f.formato || o.formato === f.formato)
    && (!q || plano(`${o.gancho}\n${o.texto}\n${o.creador.usuario ?? ''}\n${o.creador.nombre}`).includes(q.replace(/^@/, ''))));
  if (orden === 'recientes') return [...filtrados].sort((a, b) => (Date.parse(b.publicada ?? '') || 0) - (Date.parse(a.publicada ?? '') || 0));
  return filtrados;
}

// ── Lo que le llega a MaKo al replicar ───────────────────────────────────────────────────────────────────────────

/** El tipo de página en que se replica un outlier. */
export const tipoDeOutlier = (o: Pick<OutlierCopy, 'formato'>): TipoGuion => INFO_FORMATO[o.formato].tipo;

/** El título de la página replicada: de quién y con qué abre. */
export function tituloDeReplica(o: Pick<OutlierCopy, 'gancho' | 'creador'>): string {
  const quien = o.creador.usuario ? `@${o.creador.usuario}` : o.creador.nombre;
  return `Como ${quien}: ${primeraLinea(o.gancho, 70)}`.slice(0, 200);
}

/**
 * El original, como lo lee MaKo (una referencia del server en cada pedido de la página replicada: lib/copywriter/referencias.ts).
 * Dice qué es, cuánto funcionó y el texto, y la regla: copiar la estructura, el tipo de gancho y el ritmo, nunca las frases.
 */
export function textoParaMaKo(o: OutlierCopy, rotuloMultiplo: string | null): string {
  const quien = o.creador.usuario ? `@${o.creador.usuario}` : o.creador.nombre;
  const cuanto = rotuloMultiplo ? `; le fue ${rotuloMultiplo} lo que suele rendir su cuenta`
    : o.diasAlAire != null ? `; lleva ${o.diasAlAire} días al aire` : '';
  const texto = o.texto.length > TEXTO_PARA_MAKO ? `${o.texto.slice(0, TEXTO_PARA_MAKO)}…` : o.texto;
  return [
    `EL ORIGINAL QUE REPLICAS: ${INFO_FORMATO[o.formato].label.toLowerCase()} de ${quien} en ${INFO_FORMATO[o.formato].red}${cuanto}.`,
    `CON QUÉ ABRE: ${o.gancho}`,
    `${ROTULO_TEXTO[o.deDonde].toUpperCase()}:`,
    texto,
    'CÓMO SE REPLICA: copia su estructura (las partes y su orden), su tipo de gancho y su ritmo, con el negocio y la oferta de EL NEGOCIO. Nunca copies sus frases, sus datos, sus nombres ni sus resultados: son de otro.',
  ].join('\n');
}
