// =============================================================================
// editor-landing/ia-bloques — la GRAMÁTICA que escribe la IA ↔ las tarjetas
// =============================================================================
// Pedido de Martín (11/10/2026): «Quiero que implementes en la tab de "Landing
// Generator" un editor de landing tipo GAMMA. Replica por completo a Gamma, que se
// pueda hacer todo lo que ahí se hace.» Decisión D5 de docs/diseno-editor-landing.md.
//
// La IA NO escribe JSON de ProseMirror. Escribe bloques simples —{t:'h2', texto},
// {t:'optimizado', variante, items}…— con **negrita**, *cursiva* y [texto](url)
// adentro del texto, y este módulo los convierte a tarjetas del documento
// (`bloquesATarjeta`) y hace la vuelta para «Editar con IA» (`tarjetaABloques`).
// Por qué así y no pedirle el JSON del editor:
//   · el JSON de ProseMirror es verboso (marcas, attrs por nodo) y un modelo barato
//     lo rompe; la gramática es corta y la valida el CÓDIGO;
//   · toda lista cerrada (variantes, tonos, íconos, tipos de campo) se valida acá
//     contra doc.ts: lo inválido se cae CON MOTIVO en `op.descartes` (AGENTS.md:
//     «Lo que un saneador DESCARTA queda escrito, con motivo»), nunca en silencio;
//   · un DATO EXACTO no pasa por el modelo (AGENTS.md: «un dato exacto que pasa por
//     las manos de un LLM deja de ser exacto»): las URLs de imágenes, videos e
//     insertados que ya están en una tarjeta viajan como `ref` (r1, r2…) y vuelven
//     del ORIGINAL (`op.base`), y la URL de una foto nueva la pone el SERVER
//     (`recolectarBusquedas` → buscar en stock → `aplicarImagenes`), nunca la IA;
//   · lo que sale ya está en la forma CANÓNICA del saneo del server (los normalizadores
//     de especificacion.ts): sanear una tarjeta convertida no la cambia;
//   · un botón a «#formulario» o «#seccion-N» se resuelve a la tarjeta real cuando se
//     convierte la página entera (`bloquesATarjetas`); convertida SOLA, la sección
//     guarda un ancla pendiente que `resolverAnclas` arregla al juntar la página.
//
// Es PURO (sin server-only, sin React, sin DOM): lo importan el server (paquete E:
// lib/editor-landing/ia.ts), las plantillas y spec-a-doc (este paquete) y los tests.
//
// La FORMA de cada nodo (qué hay adentro de qué) es la del contrato de clases de
// D3 y la tabla de nodos del relevo de reuso de EditorRico:
//   tarjeta > bloques · optimizado > optimizadoItem > (heading nivel 3)? + párrafos
//   botones > boton > texto · recuadro > párrafos · desplegable > desplegableTitulo
//   (texto) + desplegableCuerpo > párrafos · columnas > columna > bloques
//   formulario, grafico, imagen, video, insertado, htmlLibre, espaciador: átomos
//   (todo en attrs) · etiqueta: una MARCA sobre el texto de un párrafo.
// =============================================================================

import {
  NODO, OPTIMIZADOS, VARIANTES_OPTIMIZADO, DISENOS_TARJETA, ANCHOS_TARJETA, ALINEACIONES_TARJETA,
  SUPERPOSICIONES, TONOS_RECUADRO, VARIANTES_BOTON, ALINEACIONES, TIPOS_GRAFICO, TIPOS_CAMPO,
  ALTOS_ESPACIADOR, DEGRADADOS, MIN_COLUMNAS, MAX_COLUMNAS, MIN_ITEMS_OPTIMIZADO, MAX_ITEMS_OPTIMIZADO,
  TOPES, ATTRS_TARJETA_DEFAULT, nuevoId, esHex, enLista, textoDe,
  type JsonNodo, type JsonMarca, type DisenoTarjeta, type AnchoTarjeta, type AlineacionTarjeta,
  type Superposicion, type TonoRecuadro, type VarianteBoton, type Alineacion, type VarianteOptimizado,
  type TipoGrafico, type TipoCampo, type AltoEspaciador, type Degradado, type CampoFormulario,
  type AttrsTarjeta,
} from './doc';
import { NOMBRES_ICONO } from './iconos';
// Las reglas de qué es un href o una imagen válidos, y la forma canónica de los atributos de
// cada nodo, viven en especificacion.ts (paquete A) y las usa también validar.ts: acá se
// importan, no se copian (AGENTS.md, «Una cosa, un lugar»).
import { hrefPermitido, srcImagen, NORMALIZAR_NODOS, NORMALIZAR_MARCAS, ETIQUETA_CAMPO } from './especificacion';
import { compactar } from './validar';

// ─────────────────────────────────────────────────────────────────────────────
// La gramática (tipos)
// ─────────────────────────────────────────────────────────────────────────────

export type TipoTextoIA = 'antetitulo' | 'titulo' | 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'p-grande' | 'p-pequeno';
/** Alineación de un texto (sin el campo = a la izquierda, el default de Gamma). */
export type AlineaTextoIA = 'centro' | 'derecha' | 'justificado';
const TEXT_ALIGN: Record<AlineaTextoIA, string> = { centro: 'center', derecha: 'right', justificado: 'justify' };
const ALINEA_DE: Record<string, AlineaTextoIA> = { center: 'centro', right: 'derecha', justify: 'justificado' };

export type ItemOptimizadoIA = {
  titulo: string;
  texto: string;
  /** Nombre de NOMBRES_ICONO (lib/editor-landing/iconos.ts). */
  icono?: string;
  /** La cifra de las variantes de estadísticas («97%», «[00]»). */
  valor?: string;
  /** Búsqueda de stock EN INGLÉS (galería, equipo, imágenes con texto). Nunca una URL. */
  imagen?: string;
  /** El recomendado de una grilla de precios. */
  destacado?: boolean;
  /** La pone el SERVER (aplicarImagenes): string = resuelta · null = se buscó y no hubo · ausente = hueco. */
  imagenSrc?: string | null;
  /** La imagen que ya tenía el ítem (Editar con IA): vuelve del original. */
  ref?: string;
};

export type BotonIA = { texto: string; destino: string; estilo?: VarianteBoton };
export type CampoIA = { tipo: TipoCampo; etiqueta: string; requerido?: boolean; opciones?: string[] };
export type SerieIA = { nombre: string; valores: number[] };

export type BloqueIA =
  | { t: TipoTextoIA; texto: string; alinea?: AlineaTextoIA }
  | { t: 'lista' | 'numerada' | 'tareas'; items: string[] }
  | { t: 'cita'; texto: string; autor?: string }
  | { t: 'recuadro'; tono: TonoRecuadro; texto: string }
  | { t: 'botones'; items: BotonIA[]; alinea?: Alineacion }
  | { t: 'optimizado'; variante: VarianteOptimizado; items: ItemOptimizadoIA[]; columnas?: number }
  | { t: 'columnas'; columnas: BloqueIA[][]; anchos?: number[] }
  | { t: 'tabla'; filas: string[][]; encabezado?: boolean }
  | { t: 'desplegables'; items: { titulo: string; texto: string }[] }
  | { t: 'separador' }
  | { t: 'espaciador'; alto?: AltoEspaciador }
  | { t: 'formulario'; campos: CampoIA[]; boton: string; exito: string; ref?: string }
  | { t: 'grafico'; tipo: TipoGrafico; titulo: string; categorias: string[]; series: SerieIA[]; prefijo?: string; sufijo?: string }
  | { t: 'imagen'; busqueda: string; alt: string; src?: string | null; ref?: string }
  | { t: 'etiqueta'; texto: string }
  /** Un elemento que ya existe y la gramática no expresa (video, insertado, HTML): vuelve del original. */
  | { t: 'conservar'; ref: string; que?: string };

/** Fondo de una sección: el del tema, el color de acento, un degradado de la lista o un #rrggbb. */
export type FondoIA = 'tema' | 'acento' | Degradado | `#${string}`;

export type TarjetaIA = {
  /** Sólo en «Editar con IA»: el id de la sección que se reemplaza. */
  id?: string;
  /** Imagen de acento: 'sin' · 'arriba' · 'izquierda' · 'derecha' · 'fondo'. */
  diseno?: DisenoTarjeta;
  /** Búsqueda de stock EN INGLÉS de 2 a 6 palabras, o ''. Nunca una URL: la resuelve el server. */
  imagen?: string;
  /** La pone el SERVER (aplicarImagenes): string = resuelta · null = se buscó y no hubo · ausente = hueco para elegir. */
  imagenSrc?: string | null;
  ancho?: AnchoTarjeta;
  fondo?: FondoIA;
  superposicion?: Superposicion;
  alineacion?: AlineacionTarjeta;
  /** Notas del orador (privadas). Las plantillas y specADoc las usan; la IA no las ve en la vuelta. */
  notas?: string;
  bloques: BloqueIA[];
};

export type OpConversion = {
  /** Donde se anota lo que se cayó o se corrigió, con su motivo (el server lo loguea). */
  descartes?: string[];
  /** La tarjeta ORIGINAL (Editar con IA): da el id, la imagen, las notas, el bloqueo y los `ref`. */
  base?: JsonNodo | null;
  /** Id de la tarjeta con el formulario de la página: resuelve los botones a '#formulario'. */
  formularioId?: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Cuándo conviene cada diseño optimizado (lo lee la IA en GRAMATICA_IA y sirve a
// «Probar nuevo diseño»). Uno por variante de doc.ts: el test lo exige.
// ─────────────────────────────────────────────────────────────────────────────

export const CUANDO_OPTIMIZADO: Record<VarianteOptimizado, string> = {
  'vinetas-grandes': 'beneficios o ideas cortas, 3 a 6',
  'vinetas-pequenas': 'muchos puntos breves (6 a 12)',
  'vinetas-iconos': 'beneficios con un ícono cada uno',
  'vinetas-flechas': 'pasos o razones que empujan a la acción',
  'vinetas-numeradas': 'razones o pasos que se cuentan',
  'cajas-solidas': 'ideas de igual peso, cada una en su caja; planes de precio',
  'cajas-delineadas': 'lo mismo, más liviano',
  'cajas-iconos': 'servicios o características con ícono arriba',
  'cajas-numeros': 'pasos numerados en cajas',
  'cajas-linea-lateral': 'puntos con una línea de acento al costado',
  'cajas-alternadas': 'contenido largo que alterna de lado',
  'cajas-unidas': 'partes de un mismo todo',
  'linea-superior': 'columnas de texto con una línea arriba',
  'linea-lateral': 'puntos con una línea al costado',
  'linea-divisoria': 'puntos separados por líneas',
  'tiempo-horizontal': 'hitos en orden, 3 a 5',
  'tiempo-vertical': 'hitos en orden, muchos o con texto largo',
  'tiempo-dos-lados': 'historia con hitos a ambos lados',
  'tiempo-minimalista': 'fechas y hitos breves',
  'flechas-horizontales': 'una cosa lleva a la otra',
  'flechas-verticales': 'cadena de causa y efecto',
  'chevrones': 'fases de un proceso corto',
  'etapas-horizontales': 'cómo funciona en 3 o 4 pasos',
  'etapas-verticales': 'cómo funciona con más pasos o más texto',
  'etapas-iconos': 'proceso con un ícono por paso',
  'escalera': 'progreso o niveles que suben',
  'piramide': 'niveles de base amplia a cima',
  'piramide-escalonada': 'niveles con texto al costado',
  'embudo': 'de muchos a pocos',
  'embudo-minimalista': 'embudo con poco texto',
  'ciclo': 'algo que se repite',
  'radial': 'un centro con partes alrededor',
  'circulos-concentricos': 'capas de lo general a lo particular',
  'numeros-grandes': 'cifras reales con su etiqueta (valor + título)',
  'estadisticas-circulares': 'porcentajes reales',
  'estadisticas-barras': 'porcentajes reales comparados',
  'metrica-destacada': 'una sola cifra protagonista',
  'estrellas': 'calificaciones reales',
  'lado-a-lado': 'comparar dos opciones o antes y después',
  'versus': 'nosotros contra la alternativa',
  'pros-contras': 'ventajas y desventajas',
  'galeria': 'varias fotos juntas',
  'imagenes-texto': 'una foto por idea, con su texto',
  'imagenes-circulares': 'fotos redondas con texto',
  'logos': 'marcas que confían (sólo si te las dieron)',
  'equipo': 'personas con nombre y rol',
  'nombre-rol': 'personas sin foto',
  'iconos-texto': 'beneficios o características con ícono',
  'iconos-izquierda': 'puntos con el ícono a la izquierda',
  'iconos-grandes': 'pocas ideas con ícono protagonista',
  'citas': 'testimonios sin foto (sólo reales o con marcadores)',
  'citas-caras': 'testimonios con foto (sólo reales o con marcadores)',
};

/** Variantes que muestran una IMAGEN por ítem (la búsqueda del ítem cuenta sólo en éstas). */
export const VARIANTES_CON_IMAGEN: ReadonlySet<VarianteOptimizado> = new Set<VarianteOptimizado>([
  'galeria', 'imagenes-texto', 'imagenes-circulares', 'logos', 'equipo', 'citas-caras',
]);

/** Variantes donde el ícono es parte del diseño (se prende `mostrarIconos` aunque falte uno). */
const VARIANTES_CON_ICONO: ReadonlySet<VarianteOptimizado> = new Set<VarianteOptimizado>([
  'vinetas-iconos', 'cajas-iconos', 'etapas-iconos', 'iconos-texto', 'iconos-izquierda', 'iconos-grandes',
]);

// El set de íconos lo escribe el paquete B. `new Set(...)` acepta un array o un Set
// (los dos son iterables), así este módulo no depende de cuál de las dos formas eligió.
const ICONOS_VALIDOS: ReadonlySet<string> = new Set<string>(NOMBRES_ICONO as Iterable<string>);

/**
 * Los íconos que la gramática le OFRECE a la IA para el contenido (beneficios, etapas,
 * servicios). El set de iconos.ts trae también los del chrome del editor («deshacer»,
 * «chevron-abajo», «zoom-mas»): ofrecérselos al modelo gasta tokens e invita a usarlos donde
 * no van. La lista es en POSITIVO; la validación sigue aceptando cualquier nombre del set, y el
 * test exige que cada uno de éstos exista (si B renombra uno, falla en vez de achicarse solo).
 */
export const ICONOS_CONTENIDO: readonly string[] = [
  'check', 'exito', 'estrella', 'rayo', 'fuego', 'destellos', 'brillo', 'objetivo', 'cohete', 'trofeo', 'medalla',
  'corona', 'diamante', 'regalo', 'escudo', 'candado', 'llave', 'sello', 'certificado', 'reloj', 'cronometro',
  'reloj-arena', 'alarma', 'calendario', 'calendario-check', 'dinero', 'monedas', 'dolar', 'billetera',
  'tarjeta-credito', 'alcancia', 'recibo', 'calculadora', 'porcentaje', 'etiqueta-precio', 'grafico', 'reporte',
  'velocimetro', 'usuario', 'usuarios', 'comunidad', 'usuario-check', 'apreton', 'mano-corazon', 'aplauso',
  'pulgar-arriba', 'corazon', 'sonrisa', 'chat', 'chat-texto', 'comentarios', 'telefono', 'llamada', 'mail',
  'megafono', 'campana', 'videollamada', 'video', 'camara', 'microfono', 'auriculares', 'musica', 'ubicacion',
  'mapa', 'mundo', 'brujula', 'bandera', 'ruta', 'montana', 'edificio', 'negocio', 'tienda', 'carrito', 'bolsa',
  'paquete', 'camion', 'avion', 'hogar', 'bombilla', 'cerebro', 'libro', 'graduacion', 'pizarra', 'salvavidas',
  'pantalla', 'laptop', 'celular', 'base-datos', 'wifi', 'rompecabezas', 'conexiones', 'flujo', 'jerarquia',
  'herramienta', 'engranaje', 'planta', 'hoja', 'sol', 'cafe', 'salud', 'pesa', 'infinito', 'firma',
  'portapapeles', 'archivo', 'ticket', 'pregunta', 'info', 'advertencia', 'whatsapp', 'instagram', 'facebook',
  'youtube', 'linkedin', 'tiktok',
];

/** El primer nombre que exista en el set de íconos. Las plantillas y specADoc proponen varios
 *  (sinónimos) y se quedan con el que haya: un ícono inventado se caería al validar. */
export function primerIcono(...candidatos: string[]): string | undefined {
  return candidatos.find((c) => ICONOS_VALIDOS.has(c));
}

// ─────────────────────────────────────────────────────────────────────────────
// Texto en línea: **negrita**, *cursiva*, [texto](url) ↔ nodos de texto con marcas
// ─────────────────────────────────────────────────────────────────────────────
// El parser es por INTERRUPTORES: `**` prende o apaga la negrita, `*` la cursiva. Así
// `***` (cerrar las dos) no es ambiguo: el orden de dos interruptores no importa.
// Un asterisco que el modelo escribió como texto («5 * 3», «Precio*») no abre nada:
//   · rodeado de espacios es literal;
//   · si su tipo queda impar, el último sin pareja es literal.
// El serializador escribe lo inverso: abre y cierra sólo donde cambia una marca, saca
// los espacios de las puntas afuera de los interruptores (si no, «x ** y **» queda
// rodeado de espacios y se lee literal) y escapa el `*` y la `\` del texto.

/** ¿Se acepta como destino de un enlace o un botón? Es `hrefPermitido` de especificacion.ts
 *  (http(s), mailto:, tel:, '#t-<id>', '#', 'pagina:<id>' y un dominio suelto). */
export function hrefValido(h: string): boolean {
  return hrefPermitido(h) !== null;
}

/** La marca de enlace en su forma canónica (NORMALIZAR_MARCAS.link, sin los null como guarda
 *  validar.ts): lo externo abre en otra pestaña. */
const marcaEnlace = (href: string): JsonMarca => ({ type: 'link', attrs: /^https?:/i.test(href) ? { href, target: '_blank' } : { href } });

type Tok =
  | { k: 'txt'; v: string }
  | { k: 'b'; lit: string; libre: boolean }
  | { k: 'i'; lit: string; libre: boolean }
  | { k: 'br' }
  | { k: 'link'; label: string; href: string };

const ESCAPABLES = '\\*[]()_~`';
const esEspacio = (c: string | undefined) => c === undefined || c === ' ' || c === '\n' || c === '\t';

function tokenizar(s: string): Tok[] {
  const out: Tok[] = [];
  let buf = '';
  const vaciar = () => { if (buf) { out.push({ k: 'txt', v: buf }); buf = ''; } };
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '\\' && i + 1 < s.length && ESCAPABLES.includes(s[i + 1])) { buf += s[i + 1]; i += 2; continue; }
    if (c === '\n') { vaciar(); out.push({ k: 'br' }); i++; continue; }
    if (c === '*') {
      let n = 0;
      while (s[i + n] === '*') n++;
      // Rodeado de espacios (o de los bordes) no es marca: es un asterisco escrito.
      const libre = esEspacio(s[i - 1]) && esEspacio(s[i + n]);
      vaciar();
      for (let k = 0; k < Math.floor(n / 2); k++) out.push({ k: 'b', lit: '**', libre });
      if (n % 2) out.push({ k: 'i', lit: '*', libre });
      i += n;
      continue;
    }
    if (c === '[') {
      const m = leerEnlace(s, i);
      if (m) { vaciar(); out.push({ k: 'link', label: m.label, href: m.href }); i = m.fin; continue; }
    }
    buf += c;
    i++;
  }
  vaciar();
  return out;
}

/** `[label](url)` desde la posición `i` (que es un `[`), con `\]` escapado adentro. */
function leerEnlace(s: string, i: number): { label: string; href: string; fin: number } | null {
  let j = i + 1;
  let label = '';
  while (j < s.length && s[j] !== ']') {
    if (s[j] === '\n') return null;
    if (s[j] === '\\' && j + 1 < s.length) { label += s[j] + s[j + 1]; j += 2; continue; }
    label += s[j];
    j++;
  }
  if (s[j] !== ']' || s[j + 1] !== '(') return null;
  let k = j + 2;
  let href = '';
  while (k < s.length && s[k] !== ')') {
    if (s[k] === ' ' || s[k] === '\n') return null;
    // Un `)` adentro de la URL viaja escapado (`\)`): así la vuelta devuelve la URL exacta.
    if (s[k] === '\\' && k + 1 < s.length) { href += s[k + 1]; k += 2; continue; }
    href += s[k];
    k++;
  }
  if (s[k] !== ')' || !href) return null;
  return { label, href, fin: k + 1 };
}

const ORDEN_MARCAS = ['bold', 'italic', 'link'];
const ordenarMarcas = (ms: JsonMarca[]) => [...ms].sort((a, b) => ORDEN_MARCAS.indexOf(a.type) - ORDEN_MARCAS.indexOf(b.type));

function textoNodo(text: string, marcas: JsonMarca[]): JsonNodo {
  return marcas.length ? { type: 'text', text, marks: ordenarMarcas(marcas) } : { type: 'text', text };
}

function parsearSegmento(s: string, base: JsonMarca[], ini: { b: boolean; i: boolean }, out: JsonNodo[], descartes?: string[]): void {
  const toks = tokenizar(s);
  // Los interruptores «libres» (rodeados de espacios) son texto; después, la paridad.
  for (const kind of ['b', 'i'] as const) {
    const vivos = toks.filter((t): t is Extract<Tok, { k: 'b' | 'i' }> => t.k === kind && !t.libre);
    if (vivos.length % 2) vivos[vivos.length - 1].libre = true;
  }
  let b = ini.b;
  let it = ini.i;
  const marcas = (): JsonMarca[] => [...(b ? [{ type: 'bold' }] : []), ...(it ? [{ type: 'italic' }] : []), ...base];
  for (const t of toks) {
    if (t.k === 'txt') out.push(textoNodo(t.v, marcas()));
    else if (t.k === 'br') out.push({ type: 'hardBreak' });
    else if (t.k === 'b' || t.k === 'i') {
      if (t.libre) out.push(textoNodo(t.lit, marcas()));
      else if (t.k === 'b') b = !b;
      else it = !it;
    } else {
      const href = hrefPermitido(t.href);
      if (href) {
        parsearSegmento(t.label, [...base.filter((m) => m.type !== 'link'), marcaEnlace(href)], { b, i: it }, out, descartes);
      } else {
        descartes?.push(`enlace no válido «${t.href.slice(0, 80)}»: queda como texto`);
        parsearSegmento(t.label, base, { b, i: it }, out, descartes);
      }
    }
  }
}

const mismasMarcas = (a: JsonNodo, b: JsonNodo) => JSON.stringify(a.marks ?? []) === JSON.stringify(b.marks ?? []);

function fusionar(nodos: JsonNodo[]): JsonNodo[] {
  const out: JsonNodo[] = [];
  for (const n of nodos) {
    if (n.type === 'text' && !n.text) continue;
    const prev = out[out.length - 1];
    if (prev && prev.type === 'text' && n.type === 'text' && mismasMarcas(prev, n)) prev.text = (prev.text ?? '') + (n.text ?? '');
    else out.push({ ...n, ...(n.marks ? { marks: n.marks.map((m) => ({ ...m })) } : {}) });
  }
  return out;
}

/** Markdown en línea de la IA → nodos de texto con marcas (bold, italic, link) y saltos (hardBreak). */
export function parsearInline(texto: string, op?: { descartes?: string[] }): JsonNodo[] {
  const out: JsonNodo[] = [];
  parsearSegmento(String(texto ?? ''), [], { b: false, i: false }, out, op?.descartes);
  return fusionar(out);
}

const escaparTexto = (t: string) => {
  let r = '';
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === '\\' || c === '*') r += '\\' + c;
    else if (c === '[' && leerEnlace(t, i)) r += '\\[';
    else r += c;
  }
  return r;
};
const escaparEtiqueta = (t: string) => escaparTexto(t).replace(/\]/g, '\\]');
const escaparUrl = (u: string) => u.replace(/[\\)]/g, (c) => `\\${c}`);

const interruptores = (de: { b: boolean; i: boolean }, a: { b: boolean; i: boolean }) => (de.b !== a.b ? '**' : '') + (de.i !== a.i ? '*' : '');

/** La inversa de `parsearInline`: nodos en línea → markdown. Las marcas que la gramática no tiene se pierden (con nota). */
export function inlineAMarkdown(nodos: JsonNodo[] | undefined, op?: { descartes?: string[] }): string {
  // 1) Normalizar: espacios de las puntas afuera de la negrita/cursiva, marcas ajenas fuera.
  const piezas: { text: string; b: boolean; i: boolean; href: string | null; br?: boolean }[] = [];
  const ajenas = new Set<string>();
  for (const n of nodos ?? []) {
    if (n.type === 'hardBreak') { piezas.push({ text: '\n', b: false, i: false, href: null, br: true }); continue; }
    if (n.type !== 'text') { const t = textoDe(n, ' '); if (t) piezas.push({ text: t, b: false, i: false, href: null }); continue; }
    const ms = n.marks ?? [];
    for (const m of ms) if (!ORDEN_MARCAS.includes(m.type)) ajenas.add(m.type);
    const b = ms.some((m) => m.type === 'bold');
    const it = ms.some((m) => m.type === 'italic');
    const l = ms.find((m) => m.type === 'link');
    const href = l && typeof l.attrs?.href === 'string' ? l.attrs.href : null;
    const text = n.text ?? '';
    if (!(b || it)) { piezas.push({ text, b, i: it, href }); continue; }
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
    const [, izq, nucleo, der] = m ?? ['', '', text, ''];
    if (izq) piezas.push({ text: izq, b: false, i: false, href });
    if (nucleo) piezas.push({ text: nucleo, b, i: it, href });
    if (der) piezas.push({ text: der, b: false, i: false, href });
  }
  if (ajenas.size) op?.descartes?.push(`formato sin equivalente en la gramática (${[...ajenas].join(', ')}): queda el texto`);

  // 2) Escribir: los saltos heredan el estado (no abren ni cierran nada).
  let out = '';
  let cur = { b: false, i: false };
  let k = 0;
  while (k < piezas.length) {
    const href = piezas[k].href;
    if (href) {
      const S = cur;
      let etiqueta = '';
      let est = S;
      while (k < piezas.length && piezas[k].href === href) {
        const p = piezas[k];
        if (p.br) { etiqueta += '\n'; k++; continue; }
        const nuevo = { b: p.b, i: p.i };
        etiqueta += interruptores(est, nuevo) + escaparEtiqueta(p.text);
        est = nuevo;
        k++;
      }
      etiqueta += interruptores(est, S);
      out += `[${etiqueta}](${escaparUrl(href)})`;
      continue;
    }
    const p = piezas[k];
    if (p.br) { out += '\n'; k++; continue; }
    const nuevo = { b: p.b, i: p.i };
    out += interruptores(cur, nuevo) + escaparTexto(p.text);
    cur = nuevo;
    k++;
  }
  out += interruptores(cur, { b: false, i: false });
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lectura defensiva: la IA manda JSON que nadie tipó
// ─────────────────────────────────────────────────────────────────────────────

const esObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strCrudo = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');

function texto(v: unknown, d: string[] | undefined, donde: string, max: number = TOPES.caracteresTexto): string {
  const s = strCrudo(v).replace(/\r\n?/g, '\n');
  if (s.length > max) { d?.push(`${donde}: texto recortado a ${max} caracteres`); return s.slice(0, max); }
  return s;
}

/** Párrafo con markdown en línea (sin contenido si el texto viene vacío). */
function parrafoMd(t: string, variante: string | null, d?: string[], textAlign: string | null = null): JsonNodo {
  const content = parsearInline(t, { descartes: d });
  return { type: 'paragraph', attrs: { variante, textAlign }, ...(content.length ? { content } : {}) };
}

/** Varios párrafos: el texto se parte en líneas en blanco. */
function parrafosMd(t: string, variante: string | null, d?: string[], textAlign: string | null = null): JsonNodo[] {
  return t.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean).map((x) => parrafoMd(x, variante, d, textAlign));
}

function encabezadoMd(t: string, nivel: 1 | 2 | 3 | 4, variante: 'titulo' | null, d?: string[], textAlign: string | null = null): JsonNodo {
  const content = parsearInline(t.trim(), { descartes: d });
  return { type: 'heading', attrs: { level: nivel, variante, textAlign }, ...(content.length ? { content } : {}) };
}

/** El `alinea` de un bloque de texto → el `textAlign` del nodo (o null = izquierda). */
function textAlignDe(v: unknown, d?: string[]): string | null {
  if (v === undefined || v === null || v === '' || v === 'izquierda') return null;
  const s = strCrudo(v);
  if (Object.prototype.hasOwnProperty.call(TEXT_ALIGN, s)) return TEXT_ALIGN[s as AlineaTextoIA];
  d?.push(`texto: la alineación «${s}» no existe, queda a la izquierda`);
  return null;
}

/** Búsqueda de stock normalizada: la misma clave la usan recolectar y aplicar. '' si no sirve. */
export function normalizarBusqueda(v: unknown): string {
  const s = strCrudo(v).trim().replace(/\s+/g, ' ').toLowerCase();
  if (!s || /^(https?:|www\.|data:)/i.test(s) || /[<>"]/.test(s)) return '';
  return s.split(' ').slice(0, 6).join(' ').slice(0, 80);
}

// ─────────────────────────────────────────────────────────────────────────────
// `ref`: los datos exactos de una tarjeta que no viajan por el modelo
// ─────────────────────────────────────────────────────────────────────────────
// Se numeran en orden de documento (r1, r2…) los nodos con una URL o un dato exacto:
// imagen, video, insertado, htmlLibre, formulario y los ítems con imagen. La ida
// (`tarjetaABloques`) y la vuelta (`bloquesATarjeta` con `base`) recorren el MISMO
// original con la MISMA función, así el número siempre apunta al mismo nodo.

const CON_REF = new Set<string>([NODO.imagen, NODO.video, NODO.insertado, NODO.htmlLibre, NODO.formulario]);

export function refsDe(base: JsonNodo | null | undefined): Map<string, JsonNodo> {
  const m = new Map<string, JsonNodo>();
  let n = 0;
  const visitar = (x: JsonNodo) => {
    const conImagen = x.type === NODO.optimizadoItem && typeof x.attrs?.imagenSrc === 'string' && !!x.attrs.imagenSrc;
    if (CON_REF.has(x.type) || conImagen) { n++; m.set(`r${n}`, x); }
    for (const c of x.content ?? []) visitar(c);
  };
  if (base) visitar(base);
  return m;
}

function refDeNodo(base: JsonNodo, nodo: JsonNodo): string | undefined {
  for (const [k, v] of refsDe(base)) if (v === nodo) return k;
  return undefined;
}

const clonar = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/**
 * La forma CANÓNICA de los atributos y las marcas: la que devuelven los normalizadores de
 * especificacion.ts, los mismos que usa el saneo del server (validar.ts). Así lo que sale de
 * acá ya es lo que el server guardaría: sanear una tarjeta convertida no la cambia, y una URL
 * que no sea del bucket propio (o un href no permitido) no llega ni a la vista previa.
 */
// `compactar` (los nodos PROPIOS llevan todos sus atributos; los de TipTap, sólo los que no son
// null) es el de validar.ts: una sola copia (antes vivía repetida acá).

function canonizar(n: JsonNodo): JsonNodo {
  const out: JsonNodo = { type: n.type };
  const norm = NORMALIZAR_NODOS[n.type];
  const a = norm ? compactar(n.type, norm(n.attrs ?? {})) : n.attrs && Object.keys(n.attrs).length ? n.attrs : undefined;
  if (a) out.attrs = a;
  if (n.type === 'text') {
    out.text = n.text ?? '';
    const marks = (n.marks ?? []).flatMap((m): JsonMarca[] => {
      const nm = NORMALIZAR_MARCAS[m.type];
      if (!nm) return [m];
      const am = nm(m.attrs ?? {});
      if (am === null) return [];
      const c = compactar(m.type, am);
      return [c ? { type: m.type, attrs: c } : { type: m.type }];
    });
    if (marks.length) out.marks = marks;
  }
  if (n.content) out.content = n.content.map(canonizar);
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// IDA: TarjetaIA → tarjeta del documento
// ─────────────────────────────────────────────────────────────────────────────

type Ctx = {
  d?: string[];
  refs: Map<string, JsonNodo>;
  formularioId: string | null;
  /** ids de las secciones de la página en orden (sólo la conversión de varias): resuelve '#seccion-N'. */
  ids: string[] | null;
};

/**
 * Anclas PENDIENTES. Una sección convertida sola (las tandas de 3 de «generar», «Editar con IA»
 * sobre una sección) no sabe dónde va a quedar el formulario ni qué id tiene la sección N: el
 * botón guarda un ancla que `hrefPermitido` acepta y que `resolverAnclas` cambia por la real
 * cuando la página está completa. Sin resolver, apunta a un id que no existe: no lleva a
 * ningún lado, pero no rompe nada ni se guarda un destino inventado.
 */
export const ANCLA_FORMULARIO = '#t-formulario';
const ANCLA_SECCION = (n: number | string) => `#t-seccion-${n}`;
const RE_ANCLA_SECCION = /^#t-seccion-(\d{1,2})$/;

function destinoBoton(v: unknown, ctx: Ctx, donde: string): string {
  const s = strCrudo(v).trim();
  if (/^#?(t-)?formulario$/i.test(s)) {
    if (ctx.formularioId) return `#t-${ctx.formularioId}`;
    if (!ctx.ids) return ANCLA_FORMULARIO;
    ctx.d?.push(`${donde}: no hay formulario en la página; el botón queda sin destino`);
    return '#';
  }
  const sec = /^#?(?:t-)?secci[oó]n-(\d{1,2})$/i.exec(s);
  if (sec) {
    if (!ctx.ids) return ANCLA_SECCION(Number(sec[1]));
    const id = ctx.ids[Number(sec[1]) - 1];
    if (id) return `#t-${id}`;
    ctx.d?.push(`${donde}: la sección ${sec[1]} no existe; el botón queda sin destino`);
    return '#';
  }
  const h = s ? hrefPermitido(s) : null;
  if (h) return h;
  if (s) ctx.d?.push(`${donde}: destino no válido «${s.slice(0, 80)}»`);
  // Sin destino válido, al formulario (lo normal en una landing), o pendiente si no se sabe dónde está.
  return ctx.formularioId ? `#t-${ctx.formularioId}` : ctx.ids ? '#' : ANCLA_FORMULARIO;
}

function nodoBotones(b: Record<string, unknown>, ctx: Ctx): JsonNodo | null {
  const botones: JsonNodo[] = [];
  for (const [i, x] of arr(b.items).entries()) {
    if (!esObj(x)) continue;
    const t = texto(x.texto, ctx.d, 'botón', 80).trim();
    if (!t) { ctx.d?.push(`botón ${i + 1}: sin texto, se cae`); continue; }
    const href = destinoBoton(x.destino, ctx, `botón «${t}»`);
    const estilo = strCrudo(x.estilo);
    if (estilo && !(VARIANTES_BOTON as readonly string[]).includes(estilo)) ctx.d?.push(`botón «${t}»: estilo «${estilo}» no existe, queda «primario»`);
    const variante = enLista<VarianteBoton>(VARIANTES_BOTON, estilo, i === 0 ? 'primario' : 'secundario');
    botones.push({ type: NODO.boton, attrs: { href, variante, nuevaPestana: /^https?:/i.test(href) }, content: [{ type: 'text', text: t }] });
  }
  if (!botones.length) { ctx.d?.push('botones: ninguno con texto, el bloque se cae'); return null; }
  if (botones.length > 3) { ctx.d?.push(`botones: ${botones.length} es demasiado, quedan 3`); botones.length = 3; }
  return { type: NODO.botones, attrs: { alinea: enLista<Alineacion>(ALINEACIONES, b.alinea, 'izquierda') }, content: botones };
}

function nodoOptimizado(b: Record<string, unknown>, ctx: Ctx): JsonNodo | null {
  const pedida = strCrudo(b.variante);
  // La misma variante por default que el normalizador (attrsOptimizado de especificacion.ts).
  let variante: VarianteOptimizado = 'vinetas-grandes';
  if ((VARIANTES_OPTIMIZADO as readonly string[]).includes(pedida)) variante = pedida as VarianteOptimizado;
  else ctx.d?.push(`optimizado: la variante «${pedida || '(vacía)'}» no existe; queda «Viñetas grandes»`);

  const conImagen = VARIANTES_CON_IMAGEN.has(variante);
  const items: JsonNodo[] = [];
  let algunIcono = false;
  for (const [i, raw] of arr(b.items).entries()) {
    const x: Record<string, unknown> = esObj(raw) ? raw : { titulo: strCrudo(raw), texto: '' };
    const tit = texto(x.titulo, ctx.d, 'ítem', 400).trim();
    const txt = texto(x.texto, ctx.d, 'ítem').trim();
    const valor = texto(x.valor, ctx.d, 'ítem', 40).trim();
    if (!tit && !txt && !valor) { ctx.d?.push(`optimizado ítem ${i + 1}: vacío, se cae`); continue; }
    let icono: string | null = null;
    const ic = strCrudo(x.icono).trim();
    if (ic) {
      if (ICONOS_VALIDOS.has(ic)) { icono = ic; algunIcono = true; }
      else ctx.d?.push(`optimizado ítem ${i + 1}: el ícono «${ic}» no existe, se cae`);
    }
    let imagenSrc: string | null = null;
    const ref = strCrudo(x.ref);
    if (ref) {
      const orig = ctx.refs.get(ref);
      if (orig?.type === NODO.optimizadoItem && typeof orig.attrs?.imagenSrc === 'string') imagenSrc = orig.attrs.imagenSrc;
      else ctx.d?.push(`optimizado ítem ${i + 1}: la referencia «${ref}» no existe`);
    }
    // Sólo una imagen del bucket propio (la pone el server); una URL que escribió el modelo no se lee.
    const resuelta = srcImagen(x.imagenSrc);
    if (resuelta) imagenSrc = resuelta;
    if (imagenSrc && !conImagen) imagenSrc = null;
    const content: JsonNodo[] = [];
    if (tit) content.push(encabezadoMd(tit, 3, null, ctx.d));
    content.push(...parrafosMd(txt, null, ctx.d));
    if (!content.length) content.push({ type: 'paragraph' });
    items.push({ type: NODO.optimizadoItem, attrs: { icono, imagenSrc, valor, destacado: x.destacado === true }, content });
  }
  if (items.length < MIN_ITEMS_OPTIMIZADO) { ctx.d?.push('optimizado: sin ítems, el bloque se cae'); return null; }
  if (items.length > MAX_ITEMS_OPTIMIZADO) { ctx.d?.push(`optimizado: ${items.length} ítems, quedan ${MAX_ITEMS_OPTIMIZADO}`); items.length = MAX_ITEMS_OPTIMIZADO; }
  const n = Number(b.columnas);
  const columnas = Number.isInteger(n) && n >= 1 && n <= 6 ? String(n) : 'auto';
  return {
    type: NODO.optimizado,
    attrs: { variante, columnas, mostrarIconos: VARIANTES_CON_ICONO.has(variante) || algunIcono },
    content: items,
  };
}

function anchosColumnas(v: unknown, n: number): number[] {
  const a = arr(v).map(Number);
  if (a.length === n && a.every((x) => Number.isInteger(x) && x >= 1 && x <= 12)) return a;
  if (12 % n === 0) return Array.from({ length: n }, () => 12 / n);
  return Array.from({ length: n }, () => 1);
}

function nodoTabla(b: Record<string, unknown>, ctx: Ctx): JsonNodo | null {
  const filas = arr(b.filas).map((f) => arr(f).map((c) => texto(c, ctx.d, 'tabla', 2000))).filter((f) => f.length);
  if (!filas.length) { ctx.d?.push('tabla: sin filas, se cae'); return null; }
  const cols = Math.min(8, Math.max(...filas.map((f) => f.length)));
  if (filas.length > 30) { ctx.d?.push(`tabla: ${filas.length} filas, quedan 30`); filas.length = 30; }
  const encabezado = b.encabezado !== false;
  const celda = (t: string, tipo: string): JsonNodo => ({ type: tipo, content: [parrafoMd(t, null, ctx.d)] });
  return {
    type: 'table',
    content: filas.map((f, i) => ({
      type: 'tableRow',
      content: Array.from({ length: cols }, (_, j) => celda(f[j] ?? '', encabezado && i === 0 ? 'tableHeader' : 'tableCell')),
    })),
  };
}

function nodosDesplegables(b: Record<string, unknown>, ctx: Ctx): JsonNodo[] {
  const out: JsonNodo[] = [];
  for (const [i, x] of arr(b.items).entries()) {
    if (!esObj(x)) continue;
    const tit = texto(x.titulo, ctx.d, 'desplegable', 400).trim();
    const txt = texto(x.texto, ctx.d, 'desplegable').trim();
    if (!tit) { ctx.d?.push(`desplegable ${i + 1}: sin título, se cae`); continue; }
    const tc = parsearInline(tit, { descartes: ctx.d });
    const cuerpo = parrafosMd(txt, null, ctx.d);
    out.push({
      type: NODO.desplegable,
      content: [
        { type: NODO.desplegableTitulo, ...(tc.length ? { content: tc } : {}) },
        { type: NODO.desplegableCuerpo, content: cuerpo.length ? cuerpo : [{ type: 'paragraph' }] },
      ],
    });
  }
  if (!out.length) ctx.d?.push('desplegables: ninguno con título, el bloque se cae');
  return out;
}

function nodoFormulario(b: Record<string, unknown>, ctx: Ctx): JsonNodo {
  const orig = strCrudo(b.ref) ? ctx.refs.get(strCrudo(b.ref)) : undefined;
  const camposOrig: CampoFormulario[] = orig?.type === NODO.formulario ? (arr(orig.attrs?.campos) as CampoFormulario[]) : [];
  const campos: CampoFormulario[] = [];
  const unicos = new Set<TipoCampo>();
  for (const [i, x] of arr(b.campos).entries()) {
    if (!esObj(x)) continue;
    const tipo = strCrudo(x.tipo);
    if (!(TIPOS_CAMPO as readonly string[]).includes(tipo)) { ctx.d?.push(`formulario campo ${i + 1}: el tipo «${tipo}» no existe, se cae`); continue; }
    let t = tipo as TipoCampo;
    if ((t === 'nombre' || t === 'email' || t === 'telefono') && unicos.has(t)) { ctx.d?.push(`formulario: «${t}» repetido, queda el primero`); continue; }
    unicos.add(t);
    let opciones = arr(x.opciones).map((o) => texto(o, ctx.d, 'opción', 120).trim()).filter(Boolean).slice(0, 12);
    if (t === 'opciones' && opciones.length < 2) { ctx.d?.push(`formulario campo ${i + 1}: «opciones» con menos de 2, queda como texto`); t = 'texto'; }
    if (t !== 'opciones') opciones = [];
    const previo = camposOrig[campos.length];
    const id = previo && previo.tipo === t && typeof previo.id === 'string' ? previo.id : nuevoId('c');
    campos.push({ id, tipo: t, etiqueta: texto(x.etiqueta, ctx.d, 'campo', 120).trim() || ETIQUETA_CAMPO[t], requerido: x.requerido !== false && (t === 'nombre' || t === 'email' || t === 'telefono' || x.requerido === true), opciones });
  }
  // Sin email ni teléfono el formulario no crea un lead: el Pixel captura el opt-in por esos
  // dos campos (D4). Una regla en un prompt no es una regla: acá se completa en código.
  if (!campos.some((c) => c.tipo === 'email' || c.tipo === 'telefono')) {
    ctx.d?.push('formulario: sin email ni teléfono no entra al CRM; se agrega el email');
    const pos = campos.findIndex((c) => c.tipo === 'nombre') + 1;
    campos.splice(pos, 0, { id: nuevoId('c'), tipo: 'email', etiqueta: ETIQUETA_CAMPO.email, requerido: true, opciones: [] });
  }
  if (campos.length > TOPES.camposFormulario) { ctx.d?.push(`formulario: ${campos.length} campos, quedan ${TOPES.camposFormulario}`); campos.length = TOPES.camposFormulario; }
  const redirigir = orig?.type === NODO.formulario && typeof orig.attrs?.redirigir === 'string' ? orig.attrs.redirigir : null;
  return {
    type: NODO.formulario,
    attrs: {
      campos,
      boton: texto(b.boton, ctx.d, 'formulario', 60).trim() || 'Enviar',
      exito: texto(b.exito, ctx.d, 'formulario', 200).trim() || '¡Gracias! Ya recibimos tus datos.',
      redirigir,
    },
  };
}

function nodoGrafico(b: Record<string, unknown>, ctx: Ctx): JsonNodo | null {
  const tipoPedido = strCrudo(b.tipo);
  const tipo = enLista<TipoGrafico>(TIPOS_GRAFICO, tipoPedido, 'columnas');
  if (tipoPedido !== tipo) ctx.d?.push(`gráfico: el tipo «${tipoPedido}» no existe, queda «columnas»`);
  let categorias = arr(b.categorias).map((c) => texto(c, ctx.d, 'gráfico', 60).trim()).filter(Boolean);
  if (categorias.length > TOPES.categoriasGrafico) { ctx.d?.push(`gráfico: quedan ${TOPES.categoriasGrafico} categorías`); categorias = categorias.slice(0, TOPES.categoriasGrafico); }
  const series = arr(b.series).filter(esObj).slice(0, TOPES.seriesGrafico).map((s, i) => {
    const valores = arr(s.valores).map((v) => (typeof v === 'number' ? v : Number(strCrudo(v).replace(',', '.'))));
    const limpios = categorias.map((_, j) => (Number.isFinite(valores[j]) ? valores[j] : 0));
    if (valores.length !== categorias.length || valores.some((v) => !Number.isFinite(v))) ctx.d?.push(`gráfico serie ${i + 1}: los valores no calzan con las categorías; se completan con 0`);
    return { nombre: texto(s.nombre, ctx.d, 'gráfico', 60).trim() || `Serie ${i + 1}`, valores: limpios };
  });
  if (!categorias.length || !series.length) { ctx.d?.push('gráfico: sin categorías o sin series, se cae'); return null; }
  return {
    type: NODO.grafico,
    attrs: {
      tipo, titulo: texto(b.titulo, ctx.d, 'gráfico', 120).trim(), categorias, series,
      mostrarValores: true, leyenda: series.length > 1,
      sufijo: texto(b.sufijo, ctx.d, 'gráfico', 8).trim(), prefijo: texto(b.prefijo, ctx.d, 'gráfico', 8).trim(),
    },
  };
}

function nodoImagen(b: Record<string, unknown>, ctx: Ctx): JsonNodo | null {
  const alt = texto(b.alt, ctx.d, 'imagen', 200).trim();
  const ref = strCrudo(b.ref);
  if (ref) {
    const orig = ctx.refs.get(ref);
    if (orig?.type === NODO.imagen) {
      const n = clonar(orig);
      if (alt) n.attrs = { ...n.attrs, alt };
      return n;
    }
    ctx.d?.push(`imagen: la referencia «${ref}» no existe`);
  }
  // Sólo una imagen del bucket propio: la resolvió el server. Un nodo imagen sin src no existe.
  const src = srcImagen(b.src);
  if (!src) {
    if (normalizarBusqueda(b.busqueda) || b.src) ctx.d?.push(`imagen «${normalizarBusqueda(b.busqueda) || 'sin búsqueda'}»: sin resolver, se cae`);
    return null;
  }
  return { type: NODO.imagen, attrs: { src, alt, ancho: 100, alinea: 'centro', href: null, forma: 'redondeada' } };
}

/** Convierte UN bloque. Devuelve 0, 1 o varios nodos (los desplegables son uno por pregunta). */
function convertirBloque(raw: unknown, ctx: Ctx, enColumna: boolean): JsonNodo[] {
  if (!esObj(raw)) { ctx.d?.push('bloque que no es un objeto, se cae'); return []; }
  const b = raw;
  const t = strCrudo(b.t);
  const txt = (max?: number) => texto(b.texto ?? b.text, ctx.d, t || 'bloque', max);
  const al = () => textAlignDe(b.alinea, ctx.d);
  switch (t) {
    case 'antetitulo': return [parrafoMd(txt(200).trim(), 'antetitulo', ctx.d, al())];
    case 'titulo': return [encabezadoMd(txt(400), 1, 'titulo', ctx.d, al())];
    case 'h1': return [encabezadoMd(txt(400), 1, null, ctx.d, al())];
    case 'h2': return [encabezadoMd(txt(400), 2, null, ctx.d, al())];
    case 'h3': return [encabezadoMd(txt(400), 3, null, ctx.d, al())];
    case 'h4': return [encabezadoMd(txt(400), 4, null, ctx.d, al())];
    case 'p': return parrafosMd(txt(), null, ctx.d, al());
    case 'p-grande': return parrafosMd(txt(), 'grande', ctx.d, al());
    case 'p-pequeno': return parrafosMd(txt(), 'pequeno', ctx.d, al());
    case 'etiqueta': {
      const e = txt(60).trim();
      return e ? [{ type: 'paragraph', content: [{ type: 'text', text: e, marks: [{ type: 'etiqueta' }] }] }] : [];
    }
    case 'lista': case 'numerada': case 'tareas': {
      const items = arr(b.items).map((x) => texto(x, ctx.d, t, 2000).trim()).filter(Boolean);
      if (!items.length) { ctx.d?.push(`${t}: sin ítems, se cae`); return []; }
      const lista = t === 'lista' ? 'bulletList' : t === 'numerada' ? 'orderedList' : 'taskList';
      const item = t === 'tareas' ? 'taskItem' : 'listItem';
      return [{
        type: lista,
        ...(t === 'numerada' ? { attrs: { start: 1 } } : {}),
        content: items.map((x) => ({ type: item, ...(t === 'tareas' ? { attrs: { checked: false } } : {}), content: [parrafoMd(x, null, ctx.d)] })),
      }];
    }
    case 'cita': {
      const cuerpo = parrafosMd(txt(), null, ctx.d);
      if (!cuerpo.length) { ctx.d?.push('cita: vacía, se cae'); return []; }
      const autor = texto(b.autor, ctx.d, 'cita', 200).trim();
      if (autor) cuerpo.push(parrafoMd(`— ${autor}`, 'pequeno', ctx.d));
      return [{ type: 'blockquote', content: cuerpo }];
    }
    case 'recuadro': {
      const tonoPedido = strCrudo(b.tono);
      const tono = enLista<TonoRecuadro>(TONOS_RECUADRO, tonoPedido, 'info');
      if (tonoPedido !== tono) ctx.d?.push(`recuadro: el tono «${tonoPedido}» no existe, queda «info»`);
      const cuerpo = parrafosMd(txt(), null, ctx.d);
      if (!cuerpo.length) { ctx.d?.push('recuadro: vacío, se cae'); return []; }
      return [{ type: NODO.recuadro, attrs: { tono }, content: cuerpo }];
    }
    case 'botones': { const n = nodoBotones(b, ctx); return n ? [n] : []; }
    case 'optimizado': {
      if (enColumna) { ctx.d?.push('optimizado adentro de una columna: no se puede, se cae'); return []; }
      const n = nodoOptimizado(b, ctx);
      return n ? [n] : [];
    }
    case 'columnas': {
      if (enColumna) { ctx.d?.push('columnas adentro de una columna: no se puede, se cae'); return []; }
      let cols = arr(b.columnas).map((c) => arr(c).flatMap((x) => convertirBloque(x, ctx, true)));
      cols = cols.filter((c) => c.length);
      if (cols.length > MAX_COLUMNAS) { ctx.d?.push(`columnas: ${cols.length}, quedan ${MAX_COLUMNAS}`); cols = cols.slice(0, MAX_COLUMNAS); }
      if (cols.length < MIN_COLUMNAS) {
        ctx.d?.push('columnas: menos de 2 con contenido, quedan los bloques sueltos');
        return cols.flat();
      }
      return [{
        type: NODO.columnas,
        attrs: { anchos: anchosColumnas(b.anchos, cols.length), divisores: false },
        content: cols.map((c) => ({ type: NODO.columna, content: c })),
      }];
    }
    case 'tabla': { const n = nodoTabla(b, ctx); return n ? [n] : []; }
    case 'desplegables': return nodosDesplegables(b, ctx);
    case 'separador': return [{ type: 'horizontalRule' }];
    case 'espaciador': return [{ type: NODO.espaciador, attrs: { alto: enLista<AltoEspaciador>(ALTOS_ESPACIADOR, b.alto, 'm') } }];
    case 'formulario': return [nodoFormulario(b, ctx)];
    case 'grafico': { const n = nodoGrafico(b, ctx); return n ? [n] : []; }
    case 'imagen': { const n = nodoImagen(b, ctx); return n ? [n] : []; }
    case 'conservar': {
      const ref = strCrudo(b.ref);
      const orig = ctx.refs.get(ref);
      if (!orig || orig.type === NODO.optimizadoItem) { ctx.d?.push(`conservar: la referencia «${ref}» no existe, se cae`); return []; }
      return [clonar(orig)];
    }
    default:
      ctx.d?.push(`bloque «${t || '(sin t)'}» no existe en la gramática, se cae`);
      return [];
  }
}

/** Atributos de la tarjeta: lo que la IA dijo gana; lo que no dijo queda como en el original (o el default). */
function attrsTarjeta(t: Record<string, unknown>, base: JsonNodo | null | undefined, id: string, d?: string[]): AttrsTarjeta {
  const previo = { ...ATTRS_TARJETA_DEFAULT, ...(base?.type === NODO.tarjeta ? (base.attrs as Partial<AttrsTarjeta>) : {}) } as Omit<AttrsTarjeta, 'id'>;
  const a: AttrsTarjeta = { ...previo, id };

  const busqueda = normalizarBusqueda(t.imagen);
  if (t.diseno !== undefined) {
    const v = strCrudo(t.diseno);
    if ((DISENOS_TARJETA as readonly string[]).includes(v)) a.diseno = v as DisenoTarjeta;
    else d?.push(`sección: el diseño «${v}» no existe, queda «${a.diseno}»`);
  } else if (!base && busqueda) a.diseno = 'derecha';

  const resuelta = srcImagen(t.imagenSrc);
  if (resuelta) a.imagenSrc = resuelta;
  else if (t.imagenSrc !== undefined && busqueda) {
    // Se buscó y no hubo: sin imagen, salvo que el original ya tuviera una (D5: no un placeholder que mienta).
    if (!a.imagenSrc) a.diseno = 'sin';
  }
  if (a.diseno === 'sin') a.imagenSrc = null;

  const lista = <T extends string>(campo: string, l: readonly T[], actual: T): T => {
    if (t[campo] === undefined) return actual;
    const v = strCrudo(t[campo]);
    if ((l as readonly string[]).includes(v)) return v as T;
    d?.push(`sección: «${campo}» = «${v}» no existe, queda «${actual}»`);
    return actual;
  };
  a.ancho = lista<AnchoTarjeta>('ancho', ANCHOS_TARJETA, a.ancho);
  a.alineacion = lista<AlineacionTarjeta>('alineacion', ALINEACIONES_TARJETA, a.alineacion);
  a.superposicion = lista<Superposicion>('superposicion', SUPERPOSICIONES, a.superposicion);

  if (t.fondo !== undefined) {
    const f = strCrudo(t.fondo);
    if (f === 'tema' || f === 'acento') { a.fondo = f; a.fondoColor = null; a.fondoDegradado = null; }
    else if (Object.prototype.hasOwnProperty.call(DEGRADADOS, f)) { a.fondo = 'degradado'; a.fondoDegradado = f as Degradado; a.fondoColor = null; }
    else if (esHex(f)) { a.fondo = 'color'; a.fondoColor = f; a.fondoDegradado = null; }
    else d?.push(`sección: el fondo «${f}» no existe, queda «${a.fondo}»`);
  }
  if (typeof t.notas === 'string') a.notas = t.notas.slice(0, TOPES.notas);
  return a;
}

const ID_RE = /^[A-Za-z0-9_-]{2,40}$/;

function convertirTarjeta(raw: unknown, ctx: Ctx, base: JsonNodo | null | undefined, id: string): JsonNodo {
  const t: Record<string, unknown> = esObj(raw) ? raw : {};
  const attrs = attrsTarjeta(t, base, id, ctx.d);
  const content = arr(t.bloques).flatMap((b) => convertirBloque(b, ctx, false));
  if (!content.length) ctx.d?.push('sección sin bloques válidos: queda vacía');
  return canonizar({ type: NODO.tarjeta, attrs, content: content.length ? content : [{ type: 'paragraph' }] });
}

function tieneFormulario(t: unknown): boolean {
  if (!esObj(t)) return false;
  const enBloques = (bs: unknown[]): boolean => bs.some((b) => esObj(b) && (b.t === 'formulario' || (b.t === 'columnas' && arr(b.columnas).some((c) => enBloques(arr(c))))));
  return enBloques(arr(t.bloques));
}

/** La id de la tarjeta que tiene el formulario de una página (para los botones a '#formulario'). */
export function idTarjetaConFormulario(tarjetas: JsonNodo[]): string | null {
  const tiene = (n: JsonNodo): boolean => n.type === NODO.formulario || (n.content ?? []).some(tiene);
  const t = tarjetas.find((x) => x.type === NODO.tarjeta && tiene(x));
  return t && typeof t.attrs?.id === 'string' ? t.attrs.id : null;
}

/**
 * Cambia las anclas PENDIENTES ('#t-formulario', '#t-seccion-N') por las reales, mirando la
 * página COMPLETA (las tarjetas en su orden). La llama quien junta las secciones que se
 * convirtieron de a una: después de la última tanda de «generar» o al aceptar «Editar con IA».
 * Lo que no se puede resolver queda en '#' con su motivo. No muta la entrada. Al aceptar una
 * edición sólo vuelven las secciones que cambiaron: `op.ids` (lo que se le mandó a la IA) y
 * `op.formularioId` (el de la página entera) dicen contra qué se resuelve.
 */
export function resolverAnclas(
  tarjetas: JsonNodo[],
  op: {
    descartes?: string[];
    /** A qué id apunta «la sección N» (la lista que VIO la IA). Sin esto, las mismas `tarjetas`. */
    ids?: readonly string[];
    /** La sección con el formulario en la página que va a quedar. Sin esto, la de `tarjetas`. */
    formularioId?: string | null;
  } = {},
): JsonNodo[] {
  const ids = op.ids ?? tarjetas.map((t) => (typeof t.attrs?.id === 'string' ? t.attrs.id : ''));
  const form = op.formularioId !== undefined ? op.formularioId : idTarjetaConFormulario(tarjetas);
  const resolver = (h: string): string => {
    if (h === ANCLA_FORMULARIO) {
      if (form) return `#t-${form}`;
      op.descartes?.push('un botón iba al formulario y la página no tiene: queda sin destino');
      return '#';
    }
    const m = RE_ANCLA_SECCION.exec(h);
    if (m) {
      const id = ids[Number(m[1]) - 1];
      if (id) return `#t-${id}`;
      op.descartes?.push(`un botón iba a la sección ${m[1]} y no existe: queda sin destino`);
      return '#';
    }
    return h;
  };
  const visitar = (n: JsonNodo): JsonNodo => {
    const out: JsonNodo = { ...n };
    if (n.type === NODO.boton && typeof n.attrs?.href === 'string') out.attrs = { ...n.attrs, href: resolver(n.attrs.href) };
    if (n.marks) out.marks = n.marks.map((mk) => (mk.type === 'link' && typeof mk.attrs?.href === 'string' ? { ...mk, attrs: { ...mk.attrs, href: resolver(mk.attrs.href) } } : mk));
    if (n.content) out.content = n.content.map(visitar);
    return out;
  };
  return tarjetas.map(visitar);
}

/**
 * UNA sección de la IA → una tarjeta del documento. Valida todo contra las listas cerradas
 * de doc.ts; lo inválido se cae con motivo en `op.descartes`. Con `op.base` (Editar con IA)
 * conserva el id, la imagen de acento, las notas, el bloqueo y resuelve los `ref`.
 */
export function bloquesATarjeta(t: TarjetaIA, op: OpConversion = {}): JsonNodo {
  const base = op.base ?? null;
  const pedida = esObj(t) ? strCrudo((t as Record<string, unknown>).id) : '';
  const id = (base && typeof base.attrs?.id === 'string' && base.attrs.id) || (ID_RE.test(pedida) ? pedida : nuevoId('t'));
  const formularioId = op.formularioId ?? (tieneFormulario(t) ? id : null);
  return convertirTarjeta(t, { d: op.descartes, refs: refsDe(base), formularioId, ids: null }, base, id);
}

/**
 * VARIAS secciones (una página entera, o las de «Editar con IA» sobre la landing): además de
 * convertir cada una, resuelve '#formulario' y '#seccion-N' entre ellas, deja UN solo «Título»
 * por página y respeta el tope de secciones. `op.bases` son las tarjetas originales: se
 * emparejan por id.
 */
export function bloquesATarjetas(tarjetas: TarjetaIA[], op: Omit<OpConversion, 'base'> & { bases?: JsonNodo[] } = {}): JsonNodo[] {
  const d = op.descartes;
  let lista = arr(tarjetas);
  if (lista.length > TOPES.tarjetasPorPagina) { d?.push(`página: ${lista.length} secciones, quedan ${TOPES.tarjetasPorPagina}`); lista = lista.slice(0, TOPES.tarjetasPorPagina); }
  const bases = new Map<string, JsonNodo>();
  for (const b of op.bases ?? []) if (typeof b.attrs?.id === 'string') bases.set(b.attrs.id, b);

  const usados = new Set<string>();
  const ids = lista.map((t) => {
    const p = esObj(t) ? strCrudo(t.id) : '';
    const id = ID_RE.test(p) && !usados.has(p) ? p : nuevoId('t');
    usados.add(id);
    return id;
  });
  const iForm = lista.findIndex(tieneFormulario);
  const formularioId = iForm >= 0 ? ids[iForm] : (op.formularioId ?? null);

  let hayTitulo = false;
  return lista.map((t, i) => {
    const local: string[] = [];
    const n = convertirTarjeta(t, { d: local, refs: refsDe(bases.get(ids[i])), formularioId, ids }, bases.get(ids[i]), ids[i]);
    // Un solo «Título» por página (regla de la gramática, chequeada en código).
    const bajar = (x: JsonNodo) => {
      if (x.type === 'heading' && x.attrs?.variante === 'titulo') {
        if (hayTitulo) { x.attrs = { ...x.attrs, variante: null }; local.push('un segundo «Título» en la página: queda como Encabezado 1'); }
        hayTitulo = true;
      }
      for (const c of x.content ?? []) bajar(c);
    };
    bajar(n);
    for (const m of local) d?.push(`sección ${i + 1}: ${m}`);
    return n;
  });
}

/** La forma mínima de lo que devuelve el modelo: `[…]`, `{tarjetas: […]}` o `{secciones: […]}`. */
export function comoTarjetasIA(x: unknown): TarjetaIA[] {
  const lista = Array.isArray(x) ? x : esObj(x) ? arr(x.tarjetas ?? x.secciones) : [];
  return lista.filter((t): t is TarjetaIA => esObj(t) && Array.isArray(t.bloques));
}

// ─────────────────────────────────────────────────────────────────────────────
// Imágenes: la IA propone búsquedas, el SERVER las resuelve (paquete E, D6)
// ─────────────────────────────────────────────────────────────────────────────

function* busquedasDe(t: TarjetaIA): Generator<string> {
  const s = normalizarBusqueda(t.imagen);
  if (s && t.imagenSrc === undefined && t.diseno !== 'sin') yield s;
  const enBloques = function* (bs: unknown[]): Generator<string> {
    for (const b of bs) {
      if (!esObj(b)) continue;
      if (b.t === 'imagen' && !b.ref && !b.src) { const q = normalizarBusqueda(b.busqueda); if (q) yield q; }
      if (b.t === 'optimizado' && VARIANTES_CON_IMAGEN.has(b.variante as VarianteOptimizado)) {
        for (const it of arr(b.items)) if (esObj(it) && !it.ref && it.imagenSrc === undefined) { const q = normalizarBusqueda(it.imagen); if (q) yield q; }
      }
      if (b.t === 'columnas') for (const c of arr(b.columnas)) yield* enBloques(arr(c));
    }
  };
  yield* enBloques(arr(t.bloques));
}

/** Las búsquedas de stock que hay que resolver, sin repetir (ya normalizadas: son la clave del mapa). */
export function recolectarBusquedas(tarjetas: TarjetaIA[]): string[] {
  const set = new Set<string>();
  for (const t of arr(tarjetas)) if (esObj(t)) for (const q of busquedasDe(t as TarjetaIA)) set.add(q);
  return [...set];
}

/**
 * Pone las URLs que resolvió el server. `siFalta`:
 *   · 'quitar' (default): lo que no se encontró queda SIN imagen (imagenSrc: null) — D5;
 *   · 'hueco': queda el hueco para que la persona elija (fuente de imágenes «marcadores»).
 * No muta la entrada.
 */
export function aplicarImagenes(tarjetas: TarjetaIA[], mapa: Map<string, string> | Record<string, string>, op: { siFalta?: 'quitar' | 'hueco' } = {}): TarjetaIA[] {
  const leer = (q: string): string | undefined => (mapa instanceof Map ? mapa.get(q) : Object.prototype.hasOwnProperty.call(mapa, q) ? mapa[q] : undefined);
  const quitar = (op.siFalta ?? 'quitar') === 'quitar';
  const resolver = (q: string): string | null | undefined => {
    const url = q ? leer(q) : undefined;
    if (url) return url;
    return quitar ? null : undefined;
  };
  const enBloques = (bs: BloqueIA[]): BloqueIA[] => bs.map((b) => {
    if (!esObj(b)) return b;
    if (b.t === 'imagen' && !b.ref && !b.src) {
      const q = normalizarBusqueda(b.busqueda);
      const r = q ? resolver(q) : undefined;
      return r === undefined ? b : { ...b, src: r };
    }
    if (b.t === 'optimizado' && VARIANTES_CON_IMAGEN.has(b.variante)) {
      return { ...b, items: arr(b.items).map((it) => {
        if (!esObj(it) || it.ref || it.imagenSrc !== undefined) return it;
        const q = normalizarBusqueda((it as ItemOptimizadoIA).imagen);
        const r = q ? resolver(q) : undefined;
        return r === undefined ? it : { ...it, imagenSrc: r };
      }) as ItemOptimizadoIA[] };
    }
    if (b.t === 'columnas') return { ...b, columnas: arr(b.columnas).map((c) => enBloques(arr(c) as BloqueIA[])) };
    return b;
  });
  return arr(tarjetas).map((raw) => {
    if (!esObj(raw)) return raw as TarjetaIA;
    const t = raw as TarjetaIA;
    const out: TarjetaIA = { ...t, bloques: enBloques(arr(t.bloques) as BloqueIA[]) };
    const q = normalizarBusqueda(t.imagen);
    if (q && t.imagenSrc === undefined && t.diseno !== 'sin') {
      const r = resolver(q);
      if (r !== undefined) out.imagenSrc = r;
    }
    return out;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// VUELTA: tarjeta del documento → TarjetaIA («Editar con IA»)
// ─────────────────────────────────────────────────────────────────────────────

/** Texto de un bloque de párrafos como markdown, separados por línea en blanco. */
function parrafosAMd(ns: JsonNodo[] | undefined, d?: string[]): string {
  return (ns ?? []).map((p) => (p.type === 'paragraph' || p.type === 'heading' ? inlineAMarkdown(p.content, { descartes: d }) : textoDe(p))).filter((x) => x.trim()).join('\n\n');
}

function itemsDeLista(n: JsonNodo, d?: string[]): string[] {
  const out: string[] = [];
  for (const li of n.content ?? []) {
    const parrafos = (li.content ?? []).filter((c) => c.type === 'paragraph');
    if ((li.content ?? []).some((c) => c.type !== 'paragraph')) d?.push('una lista anidada se aplana');
    const t = parrafos.map((p) => inlineAMarkdown(p.content, { descartes: d })).join(' ').trim();
    if (t) out.push(t);
    for (const sub of (li.content ?? []).filter((c) => c.type !== 'paragraph')) out.push(...itemsDeLista(sub, d));
  }
  return out;
}

/** El destino de un botón como lo lee la IA: el formulario de la página y las anclas pendientes, por su nombre. */
function hrefIA(h: unknown, formularioId: string | null | undefined): string {
  const s = strCrudo(h);
  if ((formularioId && s === `#t-${formularioId}`) || s === ANCLA_FORMULARIO) return '#formulario';
  const m = RE_ANCLA_SECCION.exec(s);
  return m ? `#seccion-${m[1]}` : s;
}

function bloqueDeNodo(n: JsonNodo, base: JsonNodo, d: string[] | undefined, formularioId: string | null | undefined, enColumna: boolean): BloqueIA[] {
  const a = n.attrs ?? {};
  switch (n.type) {
    case 'heading': {
      const t = inlineAMarkdown(n.content, { descartes: d });
      if (!t.trim()) return [];
      const nivel = Number(a.level) || 2;
      const alinea = ALINEA_DE[strCrudo(a.textAlign)];
      const tipo: TipoTextoIA = nivel === 1 && a.variante === 'titulo' ? 'titulo' : (['h1', 'h2', 'h3', 'h4'] as const)[Math.min(4, Math.max(1, nivel)) - 1];
      return [{ t: tipo, texto: t, ...(alinea ? { alinea } : {}) }];
    }
    case 'paragraph': {
      const cont = n.content ?? [];
      if (!cont.length || !textoDe(n).trim()) return [];
      if (cont.every((c) => c.type === 'text' && (c.marks ?? []).some((m) => m.type === 'etiqueta'))) return [{ t: 'etiqueta', texto: textoDe(n).trim() }];
      const t = inlineAMarkdown(cont, { descartes: d });
      const v = a.variante;
      const alinea = ALINEA_DE[strCrudo(a.textAlign)];
      const tipo: TipoTextoIA = v === 'antetitulo' ? 'antetitulo' : v === 'grande' ? 'p-grande' : v === 'pequeno' ? 'p-pequeno' : 'p';
      return [{ t: tipo, texto: t, ...(alinea ? { alinea } : {}) }];
    }
    case 'bulletList': return [{ t: 'lista', items: itemsDeLista(n, d) }];
    case 'orderedList': return [{ t: 'numerada', items: itemsDeLista(n, d) }];
    case 'taskList': return [{ t: 'tareas', items: itemsDeLista(n, d) }];
    case 'blockquote': {
      const ps = [...(n.content ?? [])];
      let autor: string | undefined;
      const ult = ps[ps.length - 1];
      if (ps.length > 1 && ult?.type === 'paragraph' && ult.attrs?.variante === 'pequeno' && /^\s*—\s*/.test(textoDe(ult))) {
        autor = inlineAMarkdown(ult.content, { descartes: d }).replace(/^\s*—\s*/, '');
        ps.pop();
      }
      return [{ t: 'cita', texto: parrafosAMd(ps, d), ...(autor ? { autor } : {}) }];
    }
    case NODO.recuadro: return [{ t: 'recuadro', tono: enLista<TonoRecuadro>(TONOS_RECUADRO, a.tono, 'info'), texto: parrafosAMd(n.content, d) }];
    case NODO.botones: {
      const items: BotonIA[] = (n.content ?? []).filter((b) => b.type === NODO.boton).map((b) => ({
        texto: textoDe(b),
        destino: hrefIA(b.attrs?.href, formularioId),
        estilo: enLista<VarianteBoton>(VARIANTES_BOTON, b.attrs?.variante, 'primario'),
      }));
      const alinea = enLista<Alineacion>(ALINEACIONES, a.alinea, 'izquierda');
      return [{ t: 'botones', items, ...(alinea !== 'izquierda' ? { alinea } : {}) }];
    }
    case NODO.optimizado: {
      const items: ItemOptimizadoIA[] = (n.content ?? []).filter((x) => x.type === NODO.optimizadoItem).map((it) => {
        const cont = it.content ?? [];
        const h = cont[0]?.type === 'heading' ? cont[0] : null;
        const resto = h ? cont.slice(1) : cont;
        const ia = it.attrs ?? {};
        const out: ItemOptimizadoIA = { titulo: h ? inlineAMarkdown(h.content, { descartes: d }) : '', texto: parrafosAMd(resto, d) };
        if (typeof ia.icono === 'string' && ia.icono) out.icono = ia.icono;
        if (typeof ia.valor === 'string' && ia.valor) out.valor = ia.valor;
        if (ia.destacado === true) out.destacado = true;
        if (typeof ia.imagenSrc === 'string' && ia.imagenSrc) { const r = refDeNodo(base, it); if (r) out.ref = r; }
        return out;
      });
      const col = strCrudo(a.columnas);
      const variante = enLista<VarianteOptimizado>(VARIANTES_OPTIMIZADO, a.variante, 'vinetas-grandes');
      return [{ t: 'optimizado', variante, items, ...(col && col !== 'auto' ? { columnas: Number(col) } : {}) }];
    }
    case NODO.columnas: {
      if (enColumna) { d?.push('columnas anidadas: se aplanan'); }
      const columnas = (n.content ?? []).map((c) => (c.content ?? []).flatMap((x) => bloqueDeNodo(x, base, d, formularioId, true)));
      const anchos = arr(a.anchos).map(Number);
      const iguales = anchos.every((x) => x === anchos[0]);
      return [{ t: 'columnas', columnas, ...(anchos.length === columnas.length && !iguales ? { anchos } : {}) }];
    }
    case 'table': {
      const filas = (n.content ?? []).map((f) => (f.content ?? []).map((c) => parrafosAMd(c.content, d).replace(/\n{2,}/g, ' ')));
      const encabezado = (n.content?.[0]?.content ?? []).some((c) => c.type === 'tableHeader');
      return [{ t: 'tabla', filas, ...(encabezado ? {} : { encabezado: false }) }];
    }
    case NODO.desplegable: {
      const tit = (n.content ?? []).find((c) => c.type === NODO.desplegableTitulo);
      const cue = (n.content ?? []).find((c) => c.type === NODO.desplegableCuerpo);
      return [{ t: 'desplegables', items: [{ titulo: inlineAMarkdown(tit?.content, { descartes: d }), texto: parrafosAMd(cue?.content, d) }] }];
    }
    case 'horizontalRule': return [{ t: 'separador' }];
    case NODO.espaciador: {
      const alto = enLista<AltoEspaciador>(ALTOS_ESPACIADOR, a.alto, 'm');
      return [{ t: 'espaciador', ...(alto !== 'm' ? { alto } : {}) }];
    }
    case NODO.formulario: {
      const campos: CampoIA[] = arr(a.campos).filter(esObj).map((c) => {
        const tipo = enLista<TipoCampo>(TIPOS_CAMPO, c.tipo, 'texto');
        const out: CampoIA = { tipo, etiqueta: strCrudo(c.etiqueta), requerido: c.requerido === true };
        if (tipo === 'opciones') out.opciones = arr(c.opciones).map(strCrudo);
        return out;
      });
      const r = refDeNodo(base, n);
      return [{ t: 'formulario', campos, boton: strCrudo(a.boton), exito: strCrudo(a.exito), ...(r ? { ref: r } : {}) }];
    }
    case NODO.grafico: {
      const out: BloqueIA = {
        t: 'grafico', tipo: enLista<TipoGrafico>(TIPOS_GRAFICO, a.tipo, 'columnas'), titulo: strCrudo(a.titulo),
        categorias: arr(a.categorias).map(strCrudo),
        series: arr(a.series).filter(esObj).map((s) => ({ nombre: strCrudo(s.nombre), valores: arr(s.valores).map(Number) })),
      };
      if (strCrudo(a.prefijo)) out.prefijo = strCrudo(a.prefijo);
      if (strCrudo(a.sufijo)) out.sufijo = strCrudo(a.sufijo);
      return [out];
    }
    case NODO.imagen: {
      const r = refDeNodo(base, n);
      return r ? [{ t: 'imagen', busqueda: '', alt: strCrudo(a.alt), ref: r }] : [];
    }
    case NODO.video: case NODO.insertado: case NODO.htmlLibre: {
      const r = refDeNodo(base, n);
      const que = n.type === NODO.video ? 'video' : n.type === NODO.insertado ? 'insertado' : 'html';
      return r ? [{ t: 'conservar', ref: r, que }] : [];
    }
    default: {
      const t = textoDe(n).trim();
      if (t) { d?.push(`«${n.type}» no tiene forma en la gramática: va como párrafo`); return [{ t: 'p', texto: escaparTexto(t) }]; }
      d?.push(`«${n.type}» no tiene forma en la gramática: se omite`);
      return [];
    }
  }
}

/**
 * La vuelta, para «Editar con IA»: una tarjeta del documento → la gramática. Conserva las
 * marcas como markdown en línea, las variantes, los íconos y el id; lo que tiene una URL o
 * un dato exacto viaja como `ref` (vuelve del original con `bloquesATarjeta(…, {base})`);
 * lo que no tiene forma va como párrafo con su texto o se omite, con nota en `op.descartes`.
 */
export function tarjetaABloques(n: JsonNodo, op: { descartes?: string[]; formularioId?: string | null } = {}): TarjetaIA {
  const d = op.descartes;
  const a = (n.attrs ?? {}) as Partial<AttrsTarjeta>;
  const out: TarjetaIA = { bloques: [] };
  if (typeof a.id === 'string' && a.id) out.id = a.id;
  if (a.diseno && a.diseno !== 'sin') out.diseno = a.diseno;
  if (a.ancho && a.ancho !== 'normal') out.ancho = a.ancho;
  if (a.alineacion && a.alineacion !== 'centro') out.alineacion = a.alineacion;
  if (a.superposicion && a.superposicion !== 'ninguna') out.superposicion = a.superposicion;
  if (a.fondo === 'acento') out.fondo = 'acento';
  else if (a.fondo === 'degradado' && a.fondoDegradado) out.fondo = a.fondoDegradado;
  else if (a.fondo === 'color' && esHex(a.fondoColor)) out.fondo = a.fondoColor as `#${string}`;

  const bloques: BloqueIA[] = [];
  for (const c of n.content ?? []) {
    for (const b of bloqueDeNodo(c, n, d, op.formularioId, false)) {
      // Desplegables seguidos = UN bloque de preguntas (la ida los vuelve a partir).
      const prev = bloques[bloques.length - 1];
      if (b.t === 'desplegables' && prev?.t === 'desplegables') prev.items.push(...b.items);
      else bloques.push(b);
    }
  }
  out.bloques = bloques;
  return out;
}

/** La vuelta de varias tarjetas (una página): resuelve el formulario de la página para los botones. */
export function tarjetasABloques(nodos: JsonNodo[], op: { descartes?: string[] } = {}): TarjetaIA[] {
  const formularioId = idTarjetaConFormulario(nodos);
  return nodos.filter((n) => n.type === NODO.tarjeta).map((n) => tarjetaABloques(n, { descartes: op.descartes, formularioId }));
}

// ─────────────────────────────────────────────────────────────────────────────
// GRAMATICA_IA — el texto que se pega en el prompt (paquete E lo inserta en su
// plantilla editable). Español NEUTRO: el guard de voseo barre lib/.
// ─────────────────────────────────────────────────────────────────────────────

function armarGramatica(): string {
  const variantes = OPTIMIZADOS.map((o) => `${o.id} (${CUANDO_OPTIMIZADO[o.id]})`).join('; ');
  const iconos = ICONOS_CONTENIDO.filter((i) => ICONOS_VALIDOS.has(i)).join(', ');
  const degradados = Object.keys(DEGRADADOS).join(', ');
  return [
    'FORMATO: devuelve SOLO JSON {"tarjetas":[...]}. Cada tarjeta es una sección de la página:',
    '{"diseno":"sin|arriba|izquierda|derecha|fondo","imagen":"búsqueda en inglés","ancho":"angosto|normal|amplio|completo","fondo":"tema|acento|' + degradados.replace(/, /g, '|') + '","superposicion":"oscura|clara|esmerilada","bloques":[...]}',
    '- diseno es la imagen de acento (por defecto "sin"). "fondo" pone la foto detrás del texto: úsalo con superposicion "oscura".',
    '- imagen: búsqueda de foto de stock EN INGLÉS de 2 a 6 palabras ("team meeting bright office"). Nunca una URL. "" si la sección no lleva foto.',
    '- Si te pasan una tarjeta con "id", devuélvela con el MISMO id.',
    'BLOQUES (campo "t"):',
    '- {"t":"antetitulo","texto"} texto chico sobre el título.',
    '- {"t":"titulo","texto"} el título grande. UNO SOLO por página, en la primera sección.',
    '- {"t":"h1"|"h2"|"h3"|"h4","texto"} encabezados. Cada sección después de la primera abre con un h2.',
    '- {"t":"p"|"p-grande"|"p-pequeno","texto"} párrafos (una línea en blanco separa párrafos).',
    '- Todo bloque de texto acepta "alinea":"centro"|"derecha" (sin el campo va a la izquierda).',
    '- {"t":"lista"|"numerada"|"tareas","items":["..."]}',
    '- {"t":"cita","texto","autor"}',
    '- {"t":"recuadro","tono":"info|nota|advertencia|precaucion|exito|pregunta","texto"} la garantía va en tono "exito".',
    '- {"t":"botones","items":[{"texto","destino","estilo":"primario|secundario|contorno"}]} de 1 a 3. destino: "#formulario" (el formulario de la página), "#seccion-N" (la sección N, contando desde 1) o una URL https que te hayan dado.',
    '- {"t":"optimizado","variante","items":[{"titulo","texto","icono","valor","imagen","destacado"}],"columnas"} de 1 a 12 ítems. "valor" es la cifra en las variantes de estadísticas; "imagen" (búsqueda en inglés) sólo en galeria, imagenes-texto, imagenes-circulares, logos, equipo y citas-caras; "destacado": true marca el recomendado.',
    '- {"t":"columnas","columnas":[[bloques],[bloques]]} de 2 a 6 columnas. Adentro no van columnas ni optimizados.',
    '- {"t":"tabla","filas":[["..."]],"encabezado":true}',
    '- {"t":"desplegables","items":[{"titulo","texto"}]} preguntas frecuentes: el título es la pregunta.',
    '- {"t":"separador"} · {"t":"espaciador"}',
    '- {"t":"formulario","campos":[{"tipo":"nombre|email|telefono|empresa|texto|textoLargo|opciones","etiqueta","requerido","opciones":[...]}],"boton","exito"} siempre con email o teléfono; los datos entran al CRM.',
    '- {"t":"grafico","tipo":"' + TIPOS_GRAFICO.join('|') + '","titulo","categorias":[...],"series":[{"nombre","valores":[números]}]} sólo con datos que te dieron.',
    '- {"t":"imagen","busqueda","alt"} una foto suelta (búsqueda en inglés).',
    '- {"t":"etiqueta","texto"} una píldora corta: «Más vendido», «Nuevo».',
    '- {"t":"conservar","ref"} un elemento que ya existe (video, imagen, insertado): déjalo donde va, sin tocar el ref. Lo mismo con el "ref" de un ítem o de un formulario.',
    'TEXTO: **negrita**, *cursiva* y [texto](url). Nada de HTML ni de otro markdown (sin #, sin >, sin tablas en texto).',
    'VARIANTES de optimizado (cuándo usar cada una): ' + variantes + '.',
    'ÍCONOS válidos (campo "icono"; si ninguno calza, no pongas ícono): ' + iconos + '.',
    'REGLAS:',
    '1. Un solo "titulo" por página.',
    '2. NO inventes testimonios, nombres de clientes, cifras de resultados, cantidad de clientes, logos, premios ni garantías. Si falta la prueba, usa marcadores entre corchetes: "[Nombre del cliente]", "[00]%", "[Logo del cliente]".',
    '3. La imagen siempre es una búsqueda en inglés de 2 a 6 palabras, nunca una URL. No inventes URLs de botones ni de enlaces.',
    '4. Una idea por sección. Varía los diseños: no repitas la misma variante en dos secciones seguidas.',
    '5. Botones de 2 a 4 palabras, en primera persona del visitante ("Quiero mi lugar").',
  ].join('\n');
}

/** El texto que el paquete E le pega al prompt describiendo los bloques (generado de las listas de doc.ts). */
export const GRAMATICA_IA: string = armarGramatica();
