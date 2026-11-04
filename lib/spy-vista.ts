// =============================================================================
// Lo que la pantalla de Competitor Spy calcula sobre lo leído: sin base y sin React
// =============================================================================
// Puro a propósito: lo que decide QUÉ estado se dibuja no puede vivir dentro de un componente que
// nadie puede probar. El caso caro es `estadoDeResultados`: la pantalla vieja afirmaba «no hay nada»
// mientras nadie había leído nada, y TikTok Creative Center, medido el 31/10, hace lo mismo durante
// un segundo antes de mostrar sus cuatro tarjetas. Cargando y vacío son dos estados, no uno.
//
// Las reglas de los números siguen siendo las de lib/spy-reglas.ts. Esto las usa; no las repite.

import {
  dibujarContador, diasCorriendo, metricasVencidas, type EtapaTendencia, type TipoPieza,
} from './spy-reglas';
import { esShort } from './spy-youtube';
import type { Competidor, LecturaCanalSpy, Pieza } from './spy';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** «12 oct». Con el año sólo si no es el de `ahora`: una pieza de 2024 no es «de este octubre». */
export function fechaCorta(iso: string, ahora: Date = new Date()): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const base = `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;
  return d.getUTCFullYear() === ahora.getUTCFullYear() ? base : `${base} ${d.getUTCFullYear()}`;
}

/** «hace 2 h». Dice cuándo se leyó, que es lo único que se sabe: no promete que se mire solo. */
export function haceCuanto(iso: string, ahora: Date = new Date()): string {
  const min = Math.floor((ahora.getTime() - Date.parse(iso)) / 60_000);
  if (!Number.isFinite(min) || min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Una pieza: cuánto lleva a la vista y cómo se dibujan sus números
// ─────────────────────────────────────────────────────────────────────────────

export type TiempoDePieza = {
  /** Sigue a la vista: el punto verde. */
  sigue: boolean;
  /** Días que declara la fuente. `null` = no los declara, y NO es «0» ni «es nueva». */
  dias: number | null;
  /** El texto de la línea: «12 sep → hoy» o, sin fecha declarada, «La vemos desde el 12 oct». */
  linea: string;
};

export function tiempoDePieza(
  p: Pick<Pieza, 'publicada_en' | 'visto_primera_vez' | 'dejo_de_verse_en'>,
  ahora: Date = new Date(),
): TiempoDePieza {
  // Hasta que terminó: un anuncio del 30/6 al 11/8 estuvo 42 días, no «los que pasaron hasta hoy».
  const dias = diasCorriendo(p.publicada_en, p.dejo_de_verse_en ? new Date(p.dejo_de_verse_en) : ahora);
  const sigue = !p.dejo_de_verse_en;
  if (dias == null) return { sigue, dias, linea: `La vemos desde el ${fechaCorta(p.visto_primera_vez, ahora)}` };
  const hasta = p.dejo_de_verse_en ? fechaCorta(p.dejo_de_verse_en, ahora) : 'hoy';
  return { sigue, dias, linea: `${fechaCorta(p.publicada_en as string, ahora)} → ${hasta}` };
}

/**
 * Un contador en la tarjeta. El `null` puede ser dos cosas y son dos textos: que el dueño lo oculta
 * («No lo publica») o que la poda de los 30 días lo tachó (`podarVencido`), y ahí decir «No lo
 * publica» sería afirmar algo de él que no sabemos.
 */
export function contadorDeTarjeta(v: number | null, metricasLeidasEn: string | null, ahora: Date = new Date()): string {
  if (v == null && metricasLeidasEn && metricasVencidas(metricasLeidasEn, ahora)) return 'Sin leer';
  return dibujarContador(v);
}

// ─────────────────────────────────────────────────────────────────────────────
// La banda «Lo que se ve de él»: qué publica, a dónde manda, con qué abre
// ─────────────────────────────────────────────────────────────────────────────

const ROTULO_TIPO: Record<TipoPieza, { uno: string; varios: string }> = {
  reel: { uno: 'Reel', varios: 'Reels' },
  publicacion: { uno: 'Publicación', varios: 'Publicaciones' },
  video: { uno: 'Video', varios: 'Videos' },
  anuncio: { uno: 'Anuncio', varios: 'Anuncios' },
  landing: { uno: 'Sitio', varios: 'Sitios' },
};

export const rotuloDeTipo = (t: TipoPieza): string => ROTULO_TIPO[t].uno;

/** La miniatura de una pieza, armada con su id. De YouTube es estable; la de Instagram vence (es del CDN de Meta) y no se guarda: null. */
/**
 * La imagen de una pieza.
 *
 * ⚠️ DOS ORÍGENES Y UN ORDEN, y el orden importa: la que GUARDÓ la fuente gana sobre la derivada.
 * Instagram entrega su miniatura y hay que usarla — acá sólo se sabía armar la de YouTube, así que
 * un reel se dibujaba sin imagen aunque Meta la hubiera dado, y la grilla quedaba en texto con
 * números. YouTube no guarda ninguna porque la suya se deriva del id: no ocupa columna y no vence.
 *
 * La de Instagram SÍ vence (CDN de Meta): se reescribe en cada lectura y `TarjetaPieza` esconde la
 * rota con su `onError`. Ver supabase/migrations/0360_spy_miniatura.sql.
 */
/**
 * ¿La URL del CDN ya venció? Las de Instagram y Facebook traen su vencimiento en `oe` (segundos, en hexadecimal). Vencida, el CDN
 * contesta 403: no se pide (ni al dibujar ni para guardarla), y la tarjeta sale con su texto. Sin `oe` no se sabe, y se intenta.
 */
export function urlVencida(url: string, ahora: number = Date.now()): boolean {
  try {
    const oe = new URL(url).searchParams.get('oe');
    if (!oe || !/^[0-9a-f]{6,10}$/i.test(oe)) return false;
    return parseInt(oe, 16) * 1000 <= ahora;
  } catch {
    return false;
  }
}

/**
 * La miniatura que se dibuja. ⚠️ Una del CDN ya vencida es null (4/11/2026, el Cerebro con Den Borg: el gráfico esperaba a cientos
 * de imágenes que iban a dar 403): la tarjeta entra con su texto sin pedir nada y sin hacer esperar a las demás.
 */
export const miniaturaDePieza = (p: { canal: string; ref: string; miniatura?: string | null }, ahora: number = Date.now()): string | null => (
  p.miniatura && p.miniatura.startsWith('https://') ? (urlVencida(p.miniatura, ahora) ? null : p.miniatura)
    : p.canal === 'youtube' ? `https://i.ytimg.com/vi/${encodeURIComponent(p.ref)}/mqdefault.jpg`
    : null
);

export type FilaConteo = { rotulo: string; n: number; pct: number };

const pct = (n: number, total: number): number => (total ? Math.round((n / total) * 100) : 0);

/** Lo mismo que hace la dona de Foreplay, sin la dona: su lista de abajo ya lo dice todo. */
export function mezclaDeTipos(piezas: readonly Pick<Pieza, 'tipo'>[]): FilaConteo[] {
  const cuenta = new Map<TipoPieza, number>();
  for (const p of piezas) cuenta.set(p.tipo, (cuenta.get(p.tipo) ?? 0) + 1);
  return [...cuenta.entries()]
    .map(([tipo, n]) => ({ rotulo: n === 1 ? ROTULO_TIPO[tipo].uno : ROTULO_TIPO[tipo].varios, n, pct: pct(n, piezas.length) }))
    .sort((a, b) => b.n - a.n);
}

/** Las redes no son un destino: un link a su propio Instagram no dice a dónde manda a la gente. */
const NO_ES_DESTINO = /(^|\.)(instagram|facebook|fb|youtube|youtu|tiktok|twitter|x|threads|linkedin|whatsapp|wa)\.(com|me|be|net)$/i;

const hostLimpio = (url: string): string | null => {
  try { return new URL(url).hostname.replace(/^www\./i, '').toLowerCase(); } catch { return null; }
};

/**
 * A dónde manda cada pieza. `dominio_destino` sólo se llena al pegar un anuncio, así que para
 * Instagram y YouTube sale de la primera URL de su texto.
 *
 * ⚠️ SE DERIVA AL DIBUJAR Y NO SE GUARDA: el texto vive 30 días (los Developer Policies de YouTube),
 * y un dominio sacado de ahí y escrito en una columna sobreviviría a la fuente de la que salió.
 */
export function destinoDePieza(p: Pick<Pieza, 'dominio_destino' | 'texto'>): string | null {
  if (p.dominio_destino) return p.dominio_destino.replace(/^www\./i, '').toLowerCase();
  for (const m of (p.texto ?? '').matchAll(/https?:\/\/[^\s)\]}>"']+/gi)) {
    const host = hostLimpio(m[0]);
    if (host && !NO_ES_DESTINO.test(host)) return host;
  }
  return null;
}

export function destinosDe(piezas: readonly Pick<Pieza, 'dominio_destino' | 'texto'>[]): FilaConteo[] {
  const cuenta = new Map<string, number>();
  for (const p of piezas) {
    const d = destinoDePieza(p);
    if (d) cuenta.set(d, (cuenta.get(d) ?? 0) + 1);
  }
  return [...cuenta.entries()]
    .map(([rotulo, n]) => ({ rotulo, n, pct: pct(n, piezas.length) }))
    .sort((a, b) => b.n - a.n || a.rotulo.localeCompare(b.rotulo));
}

/** Las primeras frases, la que más lleva a la vista primero. */
export function ganchosDe(
  piezas: readonly Pick<Pieza, 'analisis' | 'publicada_en' | 'dejo_de_verse_en'>[],
  ahora: Date = new Date(),
): Array<{ gancho: string; dias: number | null; sigue: boolean }> {
  return piezas
    .filter((p) => !!p.analisis?.gancho)
    .map((p) => ({ gancho: p.analisis?.gancho as string, dias: diasCorriendo(p.publicada_en, ahora), sigue: !p.dejo_de_verse_en }))
    .sort((a, b) => (b.dias ?? -1) - (a.dias ?? -1))
    .slice(0, 6);
}

/**
 * La frase de arriba de la banda. Forma medida en Semrush y Ahrefs: sujeto + período + número + base
 * de comparación. Se escribe con código y no con IA: son datos contados, y una frase que sale sola
 * no le cobra a nadie.
 */
export function fraseDeLectura(
  piezas: readonly Pick<Pieza, 'tipo' | 'dominio_destino' | 'texto'>[],
  miradoEn: string | null,
  ahora: Date = new Date(),
): string | null {
  if (!piezas.length) return null;
  const cuando = miradoEn ? `el ${fechaCorta(miradoEn, ahora)}` : 'hasta hoy';
  const [primera] = mezclaDeTipos(piezas);
  const destino = destinosDe(piezas)[0];
  const base = primera.n === piezas.length
    ? `De lo que leímos ${cuando}, sus ${piezas.length} piezas son ${primera.rotulo.toLowerCase()}`
    : `De lo que leímos ${cuando}, ${primera.n} de sus ${piezas.length} piezas son ${primera.rotulo.toLowerCase()}`;
  return destino ? `${base}, y manda sobre todo a ${destino.rotulo}.` : `${base}.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// La rejilla: orden y filtros
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dos órdenes, con los nombres que se entienden (Martín, 4/11/2026: «"Más tiempo a la vista" o "Más nuevo" supongo que es
 * un ordenamiento de "Views o fecha de publicación" pero le pusiste nombres que no se entienden»).
 *
 * ⚠️ «MÁS VISTAS» ORDENA POR VISTAS, Y UNA PIEZA SIN EL DATO VA AL FINAL, no como si tuviera cero: el dueño puede ocultar
 * el contador (lib/instagram-perfil.ts) y «no lo publica» no es «nadie lo vio». Entre dos sin vistas desempatan los «me
 * gusta» y después la fecha.
 */
export type OrdenSpy = 'mas-vistas' | 'mas-reciente';
export const ORDENES: ReadonlyArray<{ value: OrdenSpy; label: string }> = [
  { value: 'mas-vistas', label: 'Más vistas' },
  { value: 'mas-reciente', label: 'Más reciente' },
];

export function ordenarPiezas<T extends Pick<Pieza, 'publicada_en' | 'visto_primera_vez' | 'vistas' | 'megusta'>>(
  piezas: readonly T[],
  orden: OrdenSpy,
): T[] {
  const fecha = (p: T) => Date.parse(p.publicada_en ?? p.visto_primera_vez) || 0;
  if (orden === 'mas-reciente') return [...piezas].sort((a, b) => fecha(b) - fecha(a));
  const desc = (x: number | null, y: number | null) => (x != null && y != null ? y - x : x != null ? -1 : y != null ? 1 : 0);
  return [...piezas].sort((a, b) => desc(a.vistas, b.vistas) || desc(a.megusta, b.megusta) || fecha(b) - fecha(a));
}

/**
 * QUÉ SE VE: un tipo de contenido por vez (Martín, 4/11: «uno para contenido corto, otro para contenido largo, de sus
 * carruseles o imágenes»). Reemplaza a los chips de canal y a «Sigue a la vista» y «Probado», que «no se entiende qué
 * hacen». Un Short de YouTube es contenido corto como un reel, pero va aparte: se publica y se mide distinto.
 */
/** `anuncios` no está en `TIPOS_CONTENIDO` (los gráficos lo agrupan aparte, `grupoDe`): en la grilla es un formato más (4/11/2026). */
export type TipoContenido = 'todo' | 'reels' | 'carruseles' | 'largos' | 'shorts' | 'anuncios';
export const TIPOS_CONTENIDO: ReadonlyArray<{ value: TipoContenido; label: string; canal: 'instagram' | 'youtube' | null }> = [
  { value: 'todo', label: 'Todo lo que publica', canal: null },
  { value: 'reels', label: 'Reels', canal: 'instagram' },
  { value: 'carruseles', label: 'Carruseles e imágenes', canal: 'instagram' },
  { value: 'largos', label: 'Videos de YouTube', canal: 'youtube' },
  { value: 'shorts', label: 'Shorts', canal: 'youtube' },
];

/** De qué tipo es una pieza. Un video de YouTube sin duración legible cuenta como largo (`esShort`). */
export function tipoDeContenido(p: Pick<Pieza, 'canal' | 'tipo' | 'duracion'>): Exclude<TipoContenido, 'todo'> | null {
  if (p.canal === 'instagram') return p.tipo === 'reel' ? 'reels' : 'carruseles';
  if (p.canal === 'youtube') return esShort({ duracion: p.duracion ?? null }) ? 'shorts' : 'largos';
  return null;
}

/**
 * El tipo de una pieza EN LA GRILLA: sus anuncios entran como un formato más (Martín, 4/11/2026: «los anuncios deberían estar en
 * "Contenido", igual que el resto»). `tipoDeContenido` no los nombra a propósito: lo usan los gráficos, que los agrupan aparte.
 */
export function tipoEnLaGrilla(p: Pick<Pieza, 'canal' | 'tipo' | 'duracion'>): Exclude<TipoContenido, 'todo'> | null {
  return p.canal === 'anuncios' ? 'anuncios' : tipoDeContenido(p);
}

/** Lo que se elige en el desplegable de tipos: un tipo de contenido, o sumarle la red que le falta. */
export type ValorDeContenido = TipoContenido | 'agregar-instagram' | 'agregar-youtube';

/**
 * Las opciones del desplegable de tipos. Martín, 4/11: «"Agregar Instagram" o la red que falte, ahora se hará en el
 * desplegable para cambiar de gráficos de YT a Reels, Imágenes... si es que no lo trajo aún». Sólo los tipos que tiene
 * (con cuántas), y al final la red que le falta. «Todo» va siempre primero.
 */
export function opcionesDeContenido(
  piezas: readonly Pick<Pieza, 'canal' | 'tipo' | 'duracion'>[],
  c: { instagram: string | null; youtube_id: string | null },
): Array<{ value: ValorDeContenido; label: string }> {
  const n = new Map<TipoContenido, number>();
  for (const p of piezas) {
    const t = tipoEnLaGrilla(p);
    if (t) n.set(t, (n.get(t) ?? 0) + 1);
  }
  const conCuenta = (label: string, k: number) => `${label} · ${k}`;
  return [
    { value: 'todo', label: conCuenta('Todo lo que publica', piezas.filter((p) => tipoEnLaGrilla(p)).length) },
    ...TIPOS_CONTENIDO.filter((t) => t.value !== 'todo' && (n.get(t.value) ?? 0) > 0).map((t) => ({ value: t.value as ValorDeContenido, label: conCuenta(t.label, n.get(t.value) ?? 0) })),
    ...((n.get('anuncios') ?? 0) > 0 ? [{ value: 'anuncios' as const, label: conCuenta('Anuncios', n.get('anuncios') ?? 0) }] : []),
    ...(!c.instagram ? [{ value: 'agregar-instagram' as const, label: 'Agregar su Instagram' }] : []),
    ...(!c.youtube_id ? [{ value: 'agregar-youtube' as const, label: 'Agregar su YouTube' }] : []),
  ];
}

type PiezaFiltrable = Pick<Pieza, 'canal' | 'tipo' | 'duracion' | 'titulo' | 'texto'>;

export function filtrarPiezas<T extends PiezaFiltrable>(piezas: readonly T[], texto: string, tipo: TipoContenido): T[] {
  const q = texto.trim().toLowerCase();
  return piezas.filter((p) =>
    (tipo === 'todo' || tipoEnLaGrilla(p) === tipo)
    && (!q || `${p.titulo ?? ''} ${p.texto ?? ''}`.toLowerCase().includes(q)));
}

// ─────────────────────────────────────────────────────────────────────────────
// Los estados de la zona de resultados
// ─────────────────────────────────────────────────────────────────────────────

export type EstadoResultados =
  /** Hay tarjetas para dibujar. */
  | 'hay'
  /** Se está leyendo o trayendo, y todavía no hay nada que dibujar. JAMÁS muestra un vacío. */
  | 'cargando'
  /** Hay piezas, pero la búsqueda o los filtros las sacaron a todas. */
  | 'sin-coincidencias'
  /** Se cargó sin ningún canal: un nombre pelado no tiene nada que leer. */
  | 'sin-canales'
  /** Leímos y no hay: un cero contado. */
  | 'leido-sin-nada'
  /** No se pudo leer: es «no sé», nunca «no tiene». */
  | 'no-pudo';

export function estadoDeResultados(a: {
  leyendo: boolean;
  trayendo: boolean;
  visibles: number;
  total: number;
  hayCanales: boolean;
  lecturas: readonly LecturaCanalSpy[] | null;
}): EstadoResultados {
  if (a.visibles > 0) return 'hay';
  if (a.total > 0) return a.trayendo ? 'cargando' : 'sin-coincidencias';
  if (a.leyendo || a.trayendo) return 'cargando';
  if (!a.hayCanales) return 'sin-canales';
  // Sin la lectura en la mano no se puede afirmar nada: `debeLeerAlAbrir` ya la pidió, y el motivo
  // de una lectura vieja no se guarda en ningún lado. Decir «no hay» acá sería inventarlo.
  if (!a.lecturas) return 'cargando';
  // Una lista vacía es que la acción falló antes de leer: no se contó nada, así que no es un cero.
  if (!a.lecturas.length) return 'no-pudo';
  return a.lecturas.every((l) => l.ok && !esLecturaRecortada(l)) ? 'leido-sin-nada' : 'no-pudo';
}

/**
 * Instagram puede contestar `ok` con cero piezas porque la conexión de Meta no entrega los números
 * (`mirarCompetidor`). Eso NO es «leímos y no hay»: leímos el perfil y no nos dieron lo demás.
 */
const esLecturaRecortada = (l: LecturaCanalSpy): boolean => l.piezas === 0 && /no entrega/i.test(l.detalle);

/** ¿El motivo es la conexión de Meta? Entonces la salida es conectarla, ahí mismo. */
export const pideConectarMeta = (lecturas: readonly LecturaCanalSpy[] | null): boolean =>
  !!lecturas?.some((l) => l.canal === 'instagram' && (!l.ok || esLecturaRecortada(l)));

export const canalesDe = (c: Pick<Competidor, 'instagram' | 'youtube_id' | 'landing_url'>): boolean =>
  !!(c.instagram || c.youtube_id || c.landing_url);

/** Una ficha más vieja que esto se vuelve a leer al abrirla, sin que nadie apriete nada. */
export const HORAS_FRESCA = 24;

/**
 * ¿Hay que leer a este competidor al abrir su ficha? Es lo que hace que «Sin revisar» deje de ser un
 * estado alcanzable: leer es parte de mirar, no un botón que hay que encontrar.
 *
 * ⚠️ UNA VEZ POR SESIÓN Y POR COMPETIDOR (`yaSeLeyo`): con un perfil que no se puede leer, volver a
 * pedirlo en cada efecto gastaría cuota de YouTube y de Meta en un bucle mudo.
 */
export function debeLeerAlAbrir(
  c: Pick<Competidor, 'instagram' | 'youtube_id' | 'landing_url' | 'mirado_en'>,
  cuantasPiezas: number,
  yaSeLeyo: boolean,
  ahora: Date = new Date(),
): boolean {
  if (yaSeLeyo || !canalesDe(c)) return false;
  if (!c.mirado_en || cuantasPiezas === 0) return true;
  return ahora.getTime() - Date.parse(c.mirado_en) > HORAS_FRESCA * 3_600_000;
}

// ─────────────────────────────────────────────────────────────────────────────
// La grilla de sus piezas, por páginas (4/11/2026)
// ─────────────────────────────────────────────────────────────────────────────
// Martín: «rediseña mejor la parte donde se ve todos sus reels, YT, etc... No me gusta para nada esa parte con scroll infinito, y
// sin ocupar todo el ancho». La grilla va a todo el ancho, de a páginas de filas enteras (las columnas que entran × FILAS_POR_PAGINA).

/** Cuántas filas tiene una página de la grilla. */
export const FILAS_POR_PAGINA = 3;

/** Cuántas columnas entran: el mismo cálculo que `repeat(auto-fill, minmax(min, 1fr))`. Nunca menos de 1. */
export function columnasQueEntran(ancho: number, minimo: number, hueco: number): number {
  return Math.max(1, Math.floor((ancho + hueco) / (minimo + hueco)));
}

/** La página que se pide, encajada en las que hay (con 0 piezas, la 1). */
export function paginaEnRango(pagina: number, total: number, porPagina: number): number {
  const paginas = Math.max(1, Math.ceil(total / Math.max(1, porPagina)));
  return Math.min(Math.max(1, Math.floor(pagina) || 1), paginas);
}

/**
 * Los botones del paginador: siempre la primera y la última, la actual con sus dos vecinas, y «…» donde se saltea. Con 7 o menos,
 * todas. `null` es un «…».
 */
export function botonesDePaginas(actual: number, paginas: number): Array<number | null> {
  if (paginas <= 7) return Array.from({ length: paginas }, (_, i) => i + 1);
  const desde = Math.max(2, Math.min(actual - 1, paginas - 4));
  const hasta = Math.min(paginas - 1, Math.max(actual + 1, 5));
  // Un «…» que tapa UNA sola página es peor que la página: se muestra el número.
  const out: Array<number | null> = [1];
  if (desde === 3) out.push(2);
  else if (desde > 3) out.push(null);
  for (let i = desde; i <= hasta; i += 1) out.push(i);
  if (hasta === paginas - 2) out.push(paginas - 1);
  else if (hasta < paginas - 2) out.push(null);
  out.push(paginas);
  return out;
}
