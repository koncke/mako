// =============================================================================
// Desarmar un carrusel o una imagen de anuncio de la competencia (ticket 97, «otros formatos»; PURO; 14/11/2026)
// =============================================================================
// Martín (ticket 97): «para análisis de la competencia y para otros formatos». Lo mismo que el video (./video-desarmar.ts) para
// lo que es imagen: la IA del negocio CON VISIÓN mira las láminas y saca la estructura, los textos EXACTOS (con su rol, su
// tamaño y su letra), la tipografía y la paleta. Eso se muestra en la caja de Spy y se lo pasa a la réplica de Image
// (`pedidoDeDesarmeImagen` → el `pedido` de /api/image-editor/carruseles/replicar) o a Copywriting («Hacer uno así»).
//
// ⚠️ REGLA YA DECIDIDA (memoria «carruseles: la IA replica, full editable SÓLO el texto»): el texto queda editable y la imagen se
// REGENERA con IA; nunca se entrega por partes ni recortada. Por eso acá no se separan capas ni se recorta nada: se DESCRIBE la
// imagen de cada lámina (`imagen`) para regenerarla.
//
// Puro: lo usan la ruta, la caja de Spy y los tests.
// =============================================================================

import type { Letra, Posicion, TamanoTexto } from './video-desarmar';

export const VERSION_DESARME_IMAGEN = 1;

export type RolTexto = 'titulo' | 'subtitulo' | 'cuerpo' | 'dato' | 'cta' | 'etiqueta' | 'marca';
export type TextoDeLamina = { texto: string; rol: RolTexto; posicion: Posicion; tamano: TamanoTexto; letra: Letra; gruesa: boolean; color: string | null };
export type LaminaDesarme = { n: number; rol: string; composicion: string; imagen: string; textos: TextoDeLamina[] };
export type DesarmeImagen = {
  version: typeof VERSION_DESARME_IMAGEN;
  clase: 'carrusel' | 'imagen' | 'anuncio';
  /** Lista, paso a paso, antes y después, historia, comparación, cita… */
  tipo: string;
  resumen: string;
  gancho: string;
  porQueFunciona: string;
  laminas: LaminaDesarme[];
  tipografia: { titulos: string; cuerpo: string; descripcion: string };
  /** Los colores que mandan, en hex, del que más pesa al que menos. */
  paleta: string[];
  paraReplicar: string[];
  dudas: string[];
};
export type DesarmeImagenGuardado = { version: typeof VERSION_DESARME_IMAGEN; piezaId: number; cuenta: string | null; cuando: string; modelo: string; desarme: DesarmeImagen };

/** La fila de `app_settings` del negocio. */
export const settingDeDesarmeImagen = (piezaId: number): string => `imagen.desarme.${piezaId}`;
/** Las láminas que se miran como mucho (un carrusel de Instagram trae hasta 20). */
export const LAMINAS_A_MIRAR = 10;

const ROLES: readonly RolTexto[] = ['titulo', 'subtitulo', 'cuerpo', 'dato', 'cta', 'etiqueta', 'marca'];
const POSICIONES: readonly Posicion[] = ['arriba', 'centro', 'abajo'];
const TAMANOS: readonly TamanoTexto[] = ['chico', 'mediano', 'grande', 'gigante'];
const LETRAS: readonly Letra[] = ['sin-serifa', 'con-serifa', 'condensada', 'manuscrita'];

/** Lo que se le pide a la IA con visión. Con el JSON entero en el pedido: `leerDocumentoIA` pide JSON pero no un esquema. */
export function instruccionDesarmeImagen(o: { laminas: number; clase: DesarmeImagen['clase']; cuenta: string | null }): string {
  const que = o.clase === 'carrusel' ? `un carrusel de ${o.laminas} láminas (te paso ${o.laminas} imágenes, en orden)` : o.clase === 'anuncio' ? 'un anuncio de imagen' : 'una publicación de una imagen';
  return [
    `Eres diseñador y desarmas piezas que funcionan para que otro negocio las replique. Esto es ${que}${o.cuenta ? ` de ${o.cuenta}` : ''}.`,
    'Devuelve SOLO un JSON con esta forma exacta:',
    '{"tipo": "lista | paso a paso | antes y después | historia | comparación | cita | dato | oferta | otro", "resumen": "", "gancho": "el texto de la portada que frena el scroll", "porQueFunciona": "",',
    ' "laminas": [{"rol": "portada | desarrollo | prueba | cierre | llamado", "composicion": "cómo está armada (dónde va el texto, la foto, el fondo)", "imagen": "lo que se ve, para regenerarla con IA (sin el texto)",',
    '   "textos": [{"texto": "EXACTO", "rol": "titulo | subtitulo | cuerpo | dato | cta | etiqueta | marca", "posicion": "arriba | centro | abajo", "tamano": "chico | mediano | grande | gigante", "letra": "sin-serifa | con-serifa | condensada | manuscrita", "gruesa": true, "color": "#rrggbb"}]}],',
    ' "tipografia": {"titulos": "la letra de los títulos (nombre si la reconoces, o cómo es)", "cuerpo": "", "descripcion": ""}, "paleta": ["#rrggbb", "..."],',
    ' "paraReplicar": ["pasos concretos para hacer uno igual con la oferta de otro negocio"], "dudas": ["lo que no se ve bien"]}',
    'Reglas: los textos se copian EXACTOS, con sus mayúsculas, emojis e idioma, uno por cada bloque de texto de la lámina. La paleta: de 3 a 6 colores, en hex. Español neutro, con «tú». Lo que no se ve, vacío o en "dudas": NUNCA lo inventes.',
  ].join('\n');
}

type Crudo = Record<string, unknown>;
const esObj = (x: unknown): x is Crudo => !!x && typeof x === 'object' && !Array.isArray(x);
const lista = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const txt = (x: unknown, max = 600): string => (typeof x === 'string' ? x.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const uno = <T extends string>(x: unknown, validos: readonly T[], porDefecto: T): T => (validos.includes(x as T) ? (x as T) : porDefecto);
const color = (x: unknown): string | null => {
  const s = txt(x, 20).toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  if (/^#[0-9a-f]{3}$/.test(s)) return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  return null;
};

/** La respuesta de la IA, leída como dato de un tercero. `laminas`: cuántas se le mostraron (no se aceptan más). */
export function leerDesarmeImagen(crudo: unknown, o: { laminas: number; clase: DesarmeImagen['clase'] }): { ok: true; desarme: DesarmeImagen } | { ok: false; error: string } {
  if (!esObj(crudo)) return { ok: false, error: 'La respuesta no es un desarme.' };
  const laminas: LaminaDesarme[] = lista(crudo.laminas).filter(esObj).slice(0, Math.max(1, o.laminas)).map((l, i) => ({
    n: i + 1,
    rol: txt(l.rol, 40) || (i === 0 ? 'portada' : 'desarrollo'),
    composicion: txt(l.composicion),
    imagen: txt(l.imagen),
    textos: lista(l.textos).filter(esObj).map((t) => ({
      // El texto, EXACTO: sólo se recorta lo de los bordes (sus saltos de renglón cuentan).
      texto: typeof t.texto === 'string' ? t.texto.trim().slice(0, 600) : '',
      rol: uno(t.rol, ROLES, 'cuerpo'),
      posicion: uno(t.posicion, POSICIONES, 'centro'),
      tamano: uno(t.tamano, TAMANOS, 'mediano'),
      letra: uno(t.letra, LETRAS, 'sin-serifa'),
      gruesa: t.gruesa === true,
      color: color(t.color),
    })).filter((t) => t.texto).slice(0, 20),
  }));
  if (!laminas.length) return { ok: false, error: 'La respuesta no trae ninguna lámina.' };
  const tipo = esObj(crudo.tipografia) ? crudo.tipografia : {};
  const paleta = [...new Set(lista(crudo.paleta).map(color).filter((c): c is string => !!c))].slice(0, 8);
  return {
    ok: true,
    desarme: {
      version: VERSION_DESARME_IMAGEN,
      clase: o.clase,
      tipo: txt(crudo.tipo, 60) || 'otro',
      resumen: txt(crudo.resumen, 1000),
      gancho: txt(crudo.gancho, 400),
      porQueFunciona: txt(crudo.porQueFunciona, 800),
      laminas,
      tipografia: { titulos: txt(tipo.titulos, 240), cuerpo: txt(tipo.cuerpo, 240), descripcion: txt(tipo.descripcion, 400) },
      paleta,
      paraReplicar: lista(crudo.paraReplicar).map((x) => txt(x, 400)).filter(Boolean).slice(0, 12),
      dudas: lista(crudo.dudas).map((x) => txt(x, 300)).filter(Boolean).slice(0, 12),
    },
  };
}

/** El texto de una respuesta como JSON (con o sin cerco de ```json). null si no es JSON. */
export function jsonDeTexto(texto: string): unknown {
  const limpio = texto.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(limpio); } catch { /* sigue */ }
  const a = limpio.indexOf('{');
  const b = limpio.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(limpio.slice(a, b + 1)); } catch { /* no es JSON */ } }
  return null;
}

/**
 * Lo que va en el `pedido` de la réplica de Image (hasta 400 caracteres, app/api/image-editor/carruseles/replicar): la estructura
 * que se mantiene, la tipografía y la paleta. La réplica ya mira las láminas con su propia visión; esto le dice qué NO cambiar.
 */
export function pedidoDeDesarmeImagen(d: DesarmeImagen): string {
  const partes = [
    `Mantén la estructura «${d.tipo}» de ${d.laminas.length} ${d.laminas.length === 1 ? 'lámina' : 'láminas'} (${d.laminas.map((l) => l.rol).join(', ')})`,
    // La primera frase de la tipografía, corta: el pedido entero tiene 400 caracteres.
    d.tipografia.titulos ? `títulos en ${d.tipografia.titulos.split(/[.;]/)[0].slice(0, 70).trim()}` : '',
    d.paleta.length ? `paleta ${d.paleta.slice(0, 5).join(' ')}` : '',
  ].filter(Boolean);
  const t = `${partes.join('; ')}. El texto, con mi oferta; las imágenes, regeneradas.`;
  return t.length > 400 ? `${t.slice(0, 399)}…` : t;
}
