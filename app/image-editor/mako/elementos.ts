// =============================================================================
// Los elementos del editor (íconos, emoji y gráficos) por la API pública de Iconify
// =============================================================================
// Sin key y con CORS abierto (`Access-Control-Allow-Origin: *`, medido el 14/10 en `/search`, en
// `/<set>.json` y en `/<set>/<icono>.svg`). Sólo sets con licencia verde del relevamiento
// (docs/editor-imagen/relevamiento-contenido-licencias.md §2.2: MIT/ISC/Apache, sin crédito visible).
//
// Cómo se usa la API, y por qué así:
// · SIN búsqueda se muestran los «destacados» de `./elementos-lista.ts` (generado). El listado en vivo
//   (`/collection`) BANEA UNA HORA tras ~6 pedidos seguidos: 429 «error code: 1015», Retry-After 3595.
// · CON búsqueda: un `/search?limit=999` por consulta (cacheado) y la paginación se hace acá; el
//   parámetro `start` de la API contesta «Bad request».
// · La búsqueda de Iconify es SÓLO EN INGLÉS: «casa» da 0 resultados, sin error. Por eso la consulta
//   pasa por el diccionario de abajo («corazón» → heart) antes de salir.
// · Los SVG de una página salen en UN pedido por set (`/<set>.json?icons=a,b,c`) y se arman acá como
//   `data:` (no 36 pedidos `.svg` por página). Al insertarlo, el editor guarda el SVG DENTRO del diseño:
//   el diseño no depende de Iconify; una caída sólo afecta al panel.
// · Si Iconify no contesta (un 429 llega SIN CORS, y el `fetch` tira TypeError), se busca en los
//   destacados ya armados y se deja de preguntarle 20 s.

import type { EditorServices } from '../_doory/types/adapter';
import type { ElementItem, ElementKind, ElementPack, ElementQuery, ElementStyle, Page } from '../_doory/types/api';
import { DESTACADOS, MARCAS_FUERA } from './elementos-lista';

const API = 'https://api.iconify.design';
/** Color con el que entra un ícono de una tinta (en Canva entran en negro); después se recolorea. */
const TINTA = '#000000';
/** Lado mayor del SVG armado, en px: la miniatura del panel se ve nítida y el lienzo lo escala igual. */
const LADO = 96;
/** Tras un error de Iconify, cuánto tiempo no se le pregunta (se busca en los destacados ya armados). */
const PAUSA_MS = 20_000;

interface Pack {
  prefijo: string;
  nombre: string;
  kind: ElementKind;
  /** Una sola tinta (`currentColor`): entra en TINTA y se puede recolorear entero. */
  mono: boolean;
  /** Íconos del set (los de `/collections` del 14/10); se busca en todos. */
  total: number;
  license: string;
  license_url: string;
  autor: string;
  source_url: string;
}

const PACKS: readonly Pack[] = [
  { prefijo: 'fluent-emoji-flat', nombre: 'Emojis', kind: 'sticker', mono: false, total: 3145, license: 'MIT', license_url: 'https://github.com/microsoft/fluentui-emoji/blob/main/LICENSE', autor: 'Microsoft Corporation', source_url: 'https://github.com/microsoft/fluentui-emoji' },
  { prefijo: 'noto', nombre: 'Emojis Noto', kind: 'sticker', mono: false, total: 3729, license: 'Apache-2.0', license_url: 'https://github.com/googlefonts/noto-emoji/blob/main/svg/LICENSE', autor: 'Google Inc.', source_url: 'https://github.com/googlefonts/noto-emoji' },
  { prefijo: 'flat-color-icons', nombre: 'Íconos a color', kind: 'graphic', mono: false, total: 329 - MARCAS_FUERA.size, license: 'MIT', license_url: '', autor: 'Icons8', source_url: 'https://github.com/icons8/flat-color-icons' },
  { prefijo: 'lucide', nombre: 'Lucide', kind: 'icon', mono: true, total: 1890, license: 'ISC', license_url: 'https://github.com/lucide-icons/lucide/blob/main/LICENSE', autor: 'Lucide Contributors', source_url: 'https://github.com/lucide-icons/lucide' },
  { prefijo: 'tabler', nombre: 'Tabler', kind: 'icon', mono: true, total: 6238, license: 'MIT', license_url: 'https://github.com/tabler/tabler-icons/blob/master/LICENSE', autor: 'Paweł Kuna', source_url: 'https://github.com/tabler/tabler-icons' },
  { prefijo: 'ph', nombre: 'Phosphor', kind: 'icon', mono: true, total: 9072, license: 'MIT', license_url: 'https://github.com/phosphor-icons/core/blob/main/LICENSE', autor: 'Phosphor Icons', source_url: 'https://github.com/phosphor-icons/core' },
  { prefijo: 'material-symbols', nombre: 'Material Symbols', kind: 'icon', mono: true, total: 15728, license: 'Apache-2.0', license_url: 'https://github.com/google/material-design-icons/blob/master/LICENSE', autor: 'Google', source_url: 'https://github.com/google/material-design-icons' },
];
const PACK = new Map(PACKS.map((p) => [p.prefijo, p]));

/** Lo que se ve sin buscar ni filtrar: emoji, gráficos a color e íconos, mezclados en ronda. */
const MEZCLA = ['fluent-emoji-flat', 'flat-color-icons', 'lucide', 'material-symbols'];

// -----------------------------------------------------------------------------
// Diccionario español → inglés (la búsqueda de Iconify es sólo en inglés)
// -----------------------------------------------------------------------------
// [español, inglés]. Al revés también sirve para nombrar en español lo que se inserta.
const DICCIONARIO: ReadonlyArray<readonly [string, string]> = [
  ['corazón', 'heart'], ['estrella', 'star'], ['casa', 'house'], ['hogar', 'home'], ['flecha', 'arrow'],
  ['círculo', 'circle'], ['cuadrado', 'square'], ['triángulo', 'triangle'], ['diamante', 'diamond'], ['rombo', 'diamond'],
  ['persona', 'person'], ['usuario', 'user'], ['gente', 'people'], ['grupo', 'group'], ['equipo', 'team'],
  ['hombre', 'man'], ['mujer', 'woman'], ['niño', 'child'], ['bebé', 'baby'], ['familia', 'family'],
  ['mano', 'hand'], ['manos', 'hands'], ['ojo', 'eye'], ['ojos', 'eyes'], ['cara', 'face'], ['sonrisa', 'smile'],
  ['feliz', 'happy'], ['triste', 'sad'], ['risa', 'laugh'], ['enojado', 'angry'], ['beso', 'kiss'], ['amor', 'love'],
  ['aplauso', 'clap'], ['aplausos', 'clapping'], ['pulgar', 'thumbs'], ['ola', 'wave'], ['saludo', 'wave'], ['corona', 'crown'],
  ['teléfono', 'phone'], ['celular', 'smartphone'], ['móvil', 'mobile'], ['llamada', 'call'], ['correo', 'mail'],
  ['email', 'email'], ['mensaje', 'message'], ['chat', 'chat'], ['burbuja', 'bubble'], ['comentario', 'comment'],
  ['calendario', 'calendar'], ['fecha', 'calendar'], ['reloj', 'clock'], ['hora', 'time'], ['tiempo', 'time'],
  ['alarma', 'alarm'], ['ubicación', 'location'], ['mapa', 'map'], ['pin', 'pin'], ['mundo', 'world'],
  ['planeta', 'planet'], ['tierra', 'earth'], ['globo', 'balloon'], ['globos', 'balloons'], ['buscar', 'search'], ['lupa', 'search'],
  ['configuración', 'settings'], ['ajustes', 'settings'], ['engranaje', 'gear'], ['campana', 'bell'],
  ['notificación', 'notification'], ['candado', 'lock'], ['llave', 'key'], ['seguridad', 'security'], ['escudo', 'shield'],
  ['cámara', 'camera'], ['foto', 'photo'], ['imagen', 'image'], ['video', 'video'], ['película', 'movie'],
  ['cine', 'cinema'], ['música', 'music'], ['nota', 'note'], ['auriculares', 'headphones'], ['micrófono', 'microphone'],
  ['altavoz', 'speaker'], ['parlante', 'speaker'], ['libro', 'book'], ['libros', 'books'], ['escuela', 'school'],
  ['educación', 'education'], ['graduación', 'graduation'], ['lápiz', 'pencil'], ['pincel', 'brush'],
  ['paleta', 'palette'], ['tijera', 'scissors'], ['tijeras', 'scissors'], ['clip', 'paperclip'], ['enlace', 'link'],
  ['compartir', 'share'], ['descargar', 'download'], ['subir', 'upload'], ['basura', 'trash'], ['papelera', 'trash'],
  ['editar', 'edit'], ['información', 'info'], ['ayuda', 'help'], ['pregunta', 'question'], ['alerta', 'alert'],
  ['advertencia', 'warning'], ['peligro', 'danger'], ['check', 'check'], ['tilde', 'check'], ['listo', 'check'],
  ['correcto', 'check'], ['cruz', 'cross'], ['cerrar', 'close'], ['más', 'plus'], ['menos', 'minus'],
  ['trabajo', 'work'], ['maletín', 'briefcase'], ['oficina', 'office'], ['negocio', 'business'], ['empresa', 'company'],
  ['edificio', 'building'], ['tienda', 'store'], ['negocios', 'business'], ['carrito', 'cart'], ['compra', 'shopping'],
  ['compras', 'shopping'], ['bolsa', 'bag'], ['regalo', 'gift'], ['etiqueta', 'tag'], ['oferta', 'sale'],
  ['descuento', 'discount'], ['porcentaje', 'percent'], ['precio', 'price'], ['dinero', 'money'], ['plata', 'money'],
  ['moneda', 'coin'], ['monedas', 'coins'], ['billete', 'banknote'], ['billetera', 'wallet'], ['tarjeta', 'card'],
  ['banco', 'bank'], ['dólar', 'dollar'], ['euro', 'euro'], ['gráfico', 'chart'], ['estadística', 'chart'],
  ['estadísticas', 'analytics'], ['crecimiento', 'growth'], ['tendencia', 'trending'], ['objetivo', 'target'],
  ['meta', 'target'], ['diana', 'bullseye'], ['cohete', 'rocket'], ['idea', 'idea'], ['bombilla', 'lightbulb'],
  ['foco', 'lightbulb'], ['trofeo', 'trophy'], ['medalla', 'medal'], ['premio', 'award'], ['ganador', 'winner'],
  ['bandera', 'flag'], ['fuego', 'fire'], ['llama', 'flame'], ['rayo', 'lightning'], ['energía', 'energy'],
  ['sol', 'sun'], ['luna', 'moon'], ['nube', 'cloud'], ['lluvia', 'rain'], ['nieve', 'snow'], ['copo', 'snowflake'],
  ['paraguas', 'umbrella'], ['arcoíris', 'rainbow'], ['hoja', 'leaf'], ['hojas', 'leaves'], ['flor', 'flower'],
  ['flores', 'flowers'], ['rosa', 'rose'], ['planta', 'plant'], ['árbol', 'tree'], ['bosque', 'forest'],
  ['montaña', 'mountain'], ['playa', 'beach'], ['mar', 'sea'], ['ola', 'wave'], ['agua', 'water'], ['gota', 'drop'],
  ['naturaleza', 'nature'], ['animal', 'animal'], ['gato', 'cat'], ['perro', 'dog'], ['pájaro', 'bird'],
  ['pez', 'fish'], ['mariposa', 'butterfly'], ['abeja', 'bee'], ['caballo', 'horse'], ['pata', 'paw'],
  ['comida', 'food'], ['café', 'coffee'], ['té', 'tea'], ['pizza', 'pizza'], ['hamburguesa', 'burger'],
  ['pastel', 'cake'], ['torta', 'cake'], ['fruta', 'fruit'], ['manzana', 'apple'], ['vino', 'wine'],
  ['cerveza', 'beer'], ['copa', 'glass'], ['fiesta', 'party'], ['celebración', 'celebration'], ['confeti', 'confetti'],
  ['cumpleaños', 'birthday'], ['navidad', 'christmas'], ['auto', 'car'], ['coche', 'car'],
  ['carro', 'car'], ['avión', 'airplane'], ['viaje', 'travel'], ['bicicleta', 'bicycle'], ['barco', 'ship'],
  ['tren', 'train'], ['camión', 'truck'], ['envío', 'shipping'], ['paquete', 'package'], ['caja', 'box'],
  ['computadora', 'computer'], ['ordenador', 'computer'], ['laptop', 'laptop'], ['pantalla', 'screen'],
  ['monitor', 'monitor'], ['impresora', 'printer'], ['wifi', 'wifi'], ['batería', 'battery'], ['código', 'code'],
  ['documento', 'document'], ['archivo', 'file'], ['carpeta', 'folder'], ['portapapeles', 'clipboard'],
  ['lista', 'list'], ['marcador', 'bookmark'], ['salud', 'health'], ['médico', 'medical'], ['hospital', 'hospital'],
  ['corazones', 'hearts'], ['estrellas', 'stars'], ['deporte', 'sport'], ['pelota', 'ball'], ['fútbol', 'soccer'],
  ['gimnasio', 'gym'], ['pesa', 'dumbbell'], ['juego', 'game'], ['ticket', 'ticket'], ['entrada', 'ticket'],
  ['megáfono', 'megaphone'], ['anuncio', 'megaphone'], ['noticia', 'news'], ['periódico', 'newspaper'],
  ['brillo', 'sparkle'], ['brillos', 'sparkles'], ['magia', 'magic'], ['varita', 'wand'], ['joya', 'gem'],
  ['anillo', 'ring'], ['ancla', 'anchor'], ['brújula', 'compass'], ['reloj de arena', 'hourglass'],
  ['infinito', 'infinity'], ['comillas', 'quote'], ['cita', 'quote'], ['derecha', 'right'], ['izquierda', 'left'],
  ['arriba', 'up'], ['abajo', 'down'], ['rojo', 'red'], ['azul', 'blue'], ['verde', 'green'], ['amarillo', 'yellow'],
  ['negro', 'black'], ['blanco', 'white'], ['naranja', 'orange'], ['violeta', 'purple'], ['morado', 'purple'],
  ['rosado', 'pink'], ['gris', 'gray'], ['marrón', 'brown'], ['grande', 'big'], ['pequeño', 'small'],
  ['chico', 'small'], ['nuevo', 'new'], ['caliente', 'hot'], ['frío', 'cold'], ['bandera de', 'flag'],
  ['argentina', 'argentina'], ['méxico', 'mexico'], ['españa', 'spain'], ['brasil', 'brazil'], ['chile', 'chile'],
  ['colombia', 'colombia'], ['perú', 'peru'], ['uruguay', 'uruguay'], ['estados unidos', 'united states'],
];

/** Minúsculas y sin tildes («Corazón» = «corazon»). */
const plano = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

const ES_EN = new Map<string, string>();
const EN_ES = new Map<string, string>();
for (const [es, en] of DICCIONARIO) {
  if (!ES_EN.has(plano(es))) ES_EN.set(plano(es), en);
  if (!en.includes(' ') && !EN_ES.has(en)) EN_ES.set(en, es);
}

const VACIAS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'con', 'un', 'una']);

/** La consulta en inglés: primero las frases («reloj de arena»), después palabra por palabra (con plurales). */
export function traducirConsulta(consulta: string): string {
  const palabras = plano(consulta).split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < palabras.length; i++) {
    let frase: string | undefined;
    for (let largo = 3; largo >= 2 && !frase; largo--) {
      if (i + largo > palabras.length) continue;
      frase = ES_EN.get(palabras.slice(i, i + largo).join(' '));
      if (frase) i += largo - 1;
    }
    if (frase) {
      out.push(frase);
      continue;
    }
    const w = palabras[i];
    if (VACIAS.has(w)) continue;
    out.push(ES_EN.get(w) ?? ES_EN.get(w.replace(/es$/, '')) ?? ES_EN.get(w.replace(/s$/, '')) ?? w);
  }
  return out.join(' ');
}

/**
 * El nombre que se ve (y el de la capa): en español si es UNA palabra del diccionario («heart» → «Corazón»);
 * si no, el de Iconify legible. Traducir palabra por palabra da «Rojo corazón»: peor que dejarlo.
 */
function nombreVisible(nombre: string): string {
  const texto = EN_ES.get(nombre) ?? nombre.split('-').join(' ');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// -----------------------------------------------------------------------------
// Variantes y estilos de cada set
// -----------------------------------------------------------------------------

/** Tonos de piel (el mismo emoji seis veces). */
const PIEL = /-(dark|light|medium|medium-dark|medium-light)(-skin-tone)?$/;

/** Variantes que no se muestran: Phosphor trae 6 grosores y Material Symbols 6 cortes del mismo ícono. */
function descartar(prefijo: string, nombre: string): boolean {
  if (prefijo === 'ph') return /-(thin|light|bold)$/.test(nombre);
  if (prefijo === 'material-symbols') return /-(sharp|rounded|outline-sharp|outline-rounded)$/.test(nombre);
  if (prefijo === 'fluent-emoji-flat' || prefijo === 'noto') return PIEL.test(nombre);
  if (prefijo === 'flat-color-icons') return MARCAS_FUERA.has(nombre);
  return false;
}

function estilo(prefijo: string, nombre: string): ElementStyle {
  if (!PACK.get(prefijo)?.mono) return 'colour';
  if (prefijo === 'ph') return nombre.endsWith('-fill') ? 'filled' : nombre.endsWith('-duotone') ? 'duotone' : 'outline';
  if (prefijo === 'tabler') return nombre.endsWith('-filled') ? 'filled' : 'outline';
  if (prefijo === 'material-symbols') return nombre.endsWith('-outline') ? 'outline' : 'filled';
  return 'outline';
}

function partir(id: string): [string, string] {
  const i = id.indexOf(':');
  return [id.slice(0, i), id.slice(i + 1)];
}

function sirve(id: string): boolean {
  const [p, n] = partir(id);
  return PACK.has(p) && !descartar(p, n);
}

// -----------------------------------------------------------------------------
// Los SVG: un pedido por set y por página, armados acá
// -----------------------------------------------------------------------------

interface IconoIconify {
  body: string;
  width?: number;
  height?: number;
  left?: number;
  top?: number;
  rotate?: number;
  hFlip?: boolean;
  vFlip?: boolean;
}
interface AliasIconify extends Partial<IconoIconify> {
  parent: string;
}
interface SetIconify {
  prefix: string;
  icons?: Record<string, IconoIconify>;
  aliases?: Record<string, AliasIconify>;
  width?: number;
  height?: number;
  left?: number;
  top?: number;
}

interface SvgArmado {
  url: string;
  ancho: number;
  alto: number;
  colores: string[];
}

/** `prefijo:nombre` → el SVG armado (`null`: Iconify no lo tiene). */
const svgs = new Map<string, SvgArmado | null>();

function armar(set: SetIconify, prefijo: string, nombre: string, mono: boolean): SvgArmado | null {
  const alias = set.aliases?.[nombre];
  const base = set.icons?.[nombre] ?? (alias ? set.icons?.[alias.parent] : undefined);
  if (!base) return null;
  const w = alias?.width ?? base.width ?? set.width ?? 16;
  const h = alias?.height ?? base.height ?? set.height ?? 16;
  const k = LADO / Math.max(w, h, 1);
  const ancho = Math.round(w * k);
  const alto = Math.round(h * k);
  const girado = Boolean(base.rotate || base.hFlip || base.vFlip || alias?.rotate || alias?.hFlip || alias?.vFlip);
  if (girado) {
    // Giros y espejados: que los arme la API (son pocos y el `.svg` también trae CORS).
    const color = mono ? `&color=${encodeURIComponent(TINTA)}` : '';
    return { url: `${API}/${prefijo}/${nombre}.svg?height=${LADO}${color}`, ancho, alto, colores: mono ? [TINTA] : [] };
  }
  const left = alias?.left ?? base.left ?? set.left ?? 0;
  const top = alias?.top ?? base.top ?? set.top ?? 0;
  const cuerpo = mono ? base.body.replace(/currentColor/g, TINTA) : base.body;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="${left} ${top} ${w} ${h}">${cuerpo}</svg>`;
  const colores = mono ? [TINTA] : [...new Set((cuerpo.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi) ?? []).map((c) => c.toLowerCase()))].slice(0, 12);
  return { url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`, ancho, alto, colores };
}

/** Hasta cuándo no se le pregunta a Iconify (tras un error). */
let pausaHasta = 0;

async function pedir(url: string): Promise<unknown> {
  if (Date.now() < pausaHasta) throw new Error('Iconify en pausa');
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Iconify contestó ${r.status}`);
    return await r.json();
  } catch (e) {
    pausaHasta = Date.now() + PAUSA_MS;
    throw e;
  }
}

async function traerSvgs(ids: readonly string[]): Promise<void> {
  const porSet = new Map<string, string[]>();
  for (const id of ids) {
    if (svgs.has(id)) continue;
    const [p, n] = partir(id);
    porSet.set(p, [...(porSet.get(p) ?? []), n]);
  }
  await Promise.all(
    [...porSet].map(async ([prefijo, nombres]) => {
      const mono = PACK.get(prefijo)?.mono ?? false;
      // De a 60: la URL no pasa de ~1.500 caracteres.
      for (let i = 0; i < nombres.length; i += 60) {
        const tanda = nombres.slice(i, i + 60);
        const set = (await pedir(`${API}/${prefijo}.json?icons=${tanda.map(encodeURIComponent).join(',')}`)) as SetIconify;
        for (const n of tanda) svgs.set(`${prefijo}:${n}`, armar(set, prefijo, n, mono));
      }
    }),
  );
}

// -----------------------------------------------------------------------------
// Buscar y listar
// -----------------------------------------------------------------------------

const busquedas = new Map<string, Promise<string[]>>();

function buscarEnIconify(consulta: string, prefijos: readonly string[]): Promise<string[]> {
  const clave = `${consulta}|${prefijos.join(',')}`;
  const hecha = busquedas.get(clave);
  if (hecha) return hecha;
  const p = pedir(`${API}/search?query=${encodeURIComponent(consulta)}&prefixes=${prefijos.join(',')}&limit=999`).then((j) => ((j as { icons?: string[] }).icons ?? []).filter(sirve));
  busquedas.set(clave, p);
  p.catch(() => busquedas.delete(clave));
  return p;
}

/** Sin Iconify: busca las palabras en los nombres de los destacados. */
function buscarLocal(consulta: string, prefijos: readonly string[]): string[] {
  const palabras = consulta.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (const p of prefijos) for (const n of DESTACADOS[p] ?? []) if (palabras.every((w) => n.includes(w))) out.push(`${p}:${n}`);
  return out;
}

async function buscar(consulta: string, prefijos: readonly string[]): Promise<string[]> {
  const enIngles = traducirConsulta(consulta);
  try {
    const ids = await buscarEnIconify(enIngles, prefijos);
    // «sale» no está en el diccionario y sale igual; si la traducción no encontró nada, se prueba lo escrito.
    if (ids.length === 0 && enIngles !== plano(consulta)) return await buscarEnIconify(plano(consulta), prefijos);
    return ids;
  } catch (e) {
    const locales = buscarLocal(enIngles, prefijos);
    if (locales.length > 0) return locales;
    throw e;
  }
}

/**
 * Varias listas intercaladas de a una (variedad desde el primer renglón). El mismo nombre en dos sets del
 * mismo tipo (el «red-heart» de Fluent y el de Noto) sale una sola vez: lado a lado parecía un error.
 * El otro sigue a mano filtrando por su set.
 */
function enRonda(colas: readonly (readonly string[])[]): string[] {
  const out: string[] = [];
  const vistos = new Set<string>();
  for (let i = 0; colas.some((c) => i < c.length); i++) {
    for (const c of colas) {
      if (i >= c.length) continue;
      const [p, n] = partir(c[i]);
      const clave = `${PACK.get(p)?.kind}:${n}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      out.push(c[i]);
    }
  }
  return out;
}

/** Los destacados de varios sets, en ronda. */
function destacados(prefijos: readonly string[]): string[] {
  return enRonda(prefijos.map((p) => (DESTACADOS[p] ?? []).map((n) => `${p}:${n}`)));
}

/**
 * Iconify ordena por relevancia y los sets de una tinta tapan a los emoji («corazón»: 12 íconos de línea
 * antes del primer emoji). Como Canva mezcla, se reparten en ronda por set (en el orden de PACKS) y cada
 * set conserva su orden de relevancia.
 */
function mezclarPorSet(ids: readonly string[]): string[] {
  const porSet = new Map<string, string[]>(PACKS.map((p) => [p.prefijo, []]));
  for (const id of ids) porSet.get(partir(id)[0])?.push(id);
  return enRonda([...porSet.values()]);
}

function prefijosPara(q: ElementQuery): string[] {
  if (q.pack) return PACK.has(q.pack) ? [q.pack] : [];
  if (q.kind) return PACKS.filter((p) => p.kind === q.kind).map((p) => p.prefijo);
  return PACKS.map((p) => p.prefijo);
}

function item(id: string): ElementItem | null {
  const [p, n] = partir(id);
  const pack = PACK.get(p);
  const svg = svgs.get(id);
  if (!pack || !svg) return null;
  return {
    id,
    name: nombreVisible(n),
    kind: pack.kind,
    style: estilo(p, n),
    pack: { id: `pack-${p}`, slug: p, name: pack.nombre },
    tags: n.split('-'),
    svg_url: svg.url,
    width: svg.ancho,
    height: svg.alto,
    colors: svg.colores,
    is_recolorable: pack.mono,
  };
}

function pagina<T>(todo: T[], q: { page?: number; page_size?: number }): Page<T> {
  const tam = q.page_size ?? 36;
  const desde = ((q.page ?? 1) - 1) * tam;
  return { count: todo.length, next: desde + tam < todo.length ? 'next' : null, previous: null, results: todo.slice(desde, desde + tam) };
}

/** El servicio `elements` del adaptador de MaKo. */
export function servicioElementos(): EditorServices['elements'] {
  return {
    async packs(): Promise<ElementPack[]> {
      return PACKS.map((p) => ({
        id: `pack-${p.prefijo}`,
        slug: p.prefijo,
        name: p.nombre,
        kind: p.kind,
        thumbnail_url: null,
        element_count: p.total,
        license: p.license,
        license_url: p.license_url,
        attribution: `${p.autor} · ${p.license}`,
        source_url: p.source_url,
      }));
    },
    async list(q) {
      const prefijos = prefijosPara(q);
      if (prefijos.length === 0) return pagina<ElementItem>([], q);
      const consulta = q.q?.trim();
      let ids = consulta ? mezclarPorSet(await buscar(consulta, prefijos)) : destacados(q.pack || q.kind ? prefijos : MEZCLA);
      if (q.style) ids = ids.filter((id) => estilo(...partir(id)) === q.style);
      if (q.ordering === 'name' || q.ordering === '-name') {
        ids = [...ids].sort((a, b) => partir(a)[1].localeCompare(partir(b)[1]));
        if (q.ordering === '-name') ids.reverse();
      }
      const pag = pagina(ids, q);
      try {
        await traerSvgs(pag.results);
      } catch (e) {
        // Sin Iconify se muestra lo que ya está armado; si no hay nada, que el panel ofrezca reintentar.
        if (!pag.results.some((id) => svgs.get(id))) throw e;
      }
      return { ...pag, results: pag.results.map(item).filter((x): x is ElementItem => x !== null) };
    },
  };
}
