// =============================================================================
// editor-landing/exportar-pptx — «Exportar a PowerPoint» de Gamma: una diapositiva 16:9 por sección
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma». Decisión D7 de
// docs/diseno-editor-landing.md: `pptxgenjs` (ya instalado, 4.0.1), cargado con `import()` al
// exportar. Cada sección es UNA diapositiva con su texto editable (títulos, párrafos, viñetas,
// enlaces), la imagen de acento donde la pone el diseño, los colores y las fuentes del tema y
// las notas del orador.
//
// Está partido en dos a propósito:
//   · `modeloDiapositivas` (PURO, con test): JSON de las secciones + tema → qué va en cada
//     diapositiva y DÓNDE (en pulgadas, sobre 10 × 5,625). Todo lo que se puede decidir sin
//     PowerPoint se decide acá, donde un test lo puede mirar.
//   · `exportarPptx` (navegador): baja las imágenes, llama a pptxgenjs y descarga el archivo.
//
// Lo que NO se copia de Gamma, y por qué:
//   · Los diseños optimizados, las columnas y las tablas salen como texto con viñetas, no
//     como formas: rearmar 52 diseños en formas de PowerPoint es otra herramienta. Se
//     conserva el CONTENIDO completo y el orden.
//   · Los gráficos, formularios, videos e iframes no salen (sólo el título del gráfico).
//   · Un fondo degradado sale con su color promedio: pptxgenjs sólo pinta fondos lisos.
//   · El ajuste del texto lo estima `escalarTexto` (largo del texto contra el área): la
//     opción «encoger al desbordar» de PowerPoint recién se aplica cuando alguien edita.
// =============================================================================

import { DEGRADADOS, NODO, type JsonNodo, type JsonMarca } from './doc';
import { attrsTarjeta, hrefPermitido, srcImagen } from './especificacion';
import { varsDeFondoPropio, varsDeTema, type Tema } from './temas';
import { descargar, nombreArchivo, type SeccionElegida } from './exportar-html';

// ─────────────────────────────────────────────────────────────────────────────
// El modelo (puro)
// ─────────────────────────────────────────────────────────────────────────────

/** LAYOUT_16x9 de pptxgenjs, en pulgadas. */
export const ANCHO_DIAPO = 10;
export const ALTO_DIAPO = 5.625;

export type Caja = { x: number; y: number; w: number; h: number };

export type Trozo = {
  texto: string;
  negrita?: true;
  cursiva?: true;
  subrayado?: true;
  tachado?: true;
  /** Sólo http(s), mailto: y tel: (un `#t-…` o un `pagina:` no significan nada fuera del sitio). */
  enlace?: string;
  /** RRGGBB sin «#». */
  color?: string;
};

export type TipoParrafo = 'titulo' | 'encabezado' | 'subencabezado' | 'antetitulo' | 'parrafo' | 'vineta' | 'numerado' | 'cita';

export type ParrafoDiapo = {
  tipo: TipoParrafo;
  /** Sangría de la viñeta: 0 a 2. */
  nivel: number;
  trozos: Trozo[];
  /** Tamaño en puntos, ya ajustado al área (ver `escalarTexto`). */
  tam: number;
};

export type LugarImagen = 'arriba' | 'izquierda' | 'derecha' | 'fondo';

export type ImagenDiapo = {
  src: string;
  lugar: LugarImagen;
  ajuste: 'cubrir' | 'contener';
  focoX: number;
  focoY: number;
  caja: Caja;
};

export type Diapositiva = {
  numero: number;
  id: string;
  /** Color del fondo de la diapositiva (RRGGBB): el de la tarjeta, o el que eligió la sección. */
  fondo: string;
  colores: { texto: string; titulo: string; enlace: string };
  fuentes: { titulo: string; cuerpo: string };
  parrafos: ParrafoDiapo[];
  cajaTexto: Caja;
  alinear: 'top' | 'middle' | 'bottom';
  imagen: ImagenDiapo | null;
  /** La superposición sobre una imagen de fondo (Gamma: Atenuado · Claro · Esmerilado). */
  velo: { color: string; transparencia: number } | null;
  notas: string;
};

/** Tamaños de partida (pt), los de una presentación de Gamma exportada. */
export const TAM_BASE: Record<TipoParrafo, number> = {
  titulo: 40, encabezado: 30, subencabezado: 22, antetitulo: 12, parrafo: 16, vineta: 16, numerado: 16, cita: 18,
};
const TAM_POR_NIVEL: Record<number, number> = { 1: 32, 2: 28, 3: 22, 4: 18 };
const TAM_VARIANTE: Record<string, number> = { antetitulo: 12, grande: 20, pequeno: 13 };
const TAM_MINIMO = 9;

/** RRGGBB (sin «#», en mayúsculas) de un #rrggbb; `def` si no lo es. */
function hex6(v: unknown, def: string): string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim().slice(1).toUpperCase() : def;
}

/** El área de la imagen y la del texto para cada diseño de la sección. */
export function cajasDeDiseno(lugar: LugarImagen | null): { imagen: Caja | null; texto: Caja } {
  switch (lugar) {
    case 'arriba': return { imagen: { x: 0, y: 0, w: ANCHO_DIAPO, h: 2.1 }, texto: { x: 0.6, y: 2.3, w: 8.8, h: 3.0 } };
    case 'izquierda': return { imagen: { x: 0, y: 0, w: 3.75, h: ALTO_DIAPO }, texto: { x: 4.15, y: 0.45, w: 5.25, h: 4.725 } };
    case 'derecha': return { imagen: { x: 6.25, y: 0, w: 3.75, h: ALTO_DIAPO }, texto: { x: 0.6, y: 0.45, w: 5.25, h: 4.725 } };
    case 'fondo': return { imagen: { x: 0, y: 0, w: ANCHO_DIAPO, h: ALTO_DIAPO }, texto: { x: 0.8, y: 0.6, w: 8.4, h: 4.425 } };
    default: return { imagen: null, texto: { x: 0.6, y: 0.45, w: 8.8, h: 4.725 } };
  }
}

/** Las marcas de un texto que PowerPoint entiende. */
function trozoDe(texto: string, marcas: JsonMarca[] | undefined, acento: string): Trozo {
  const t: Trozo = { texto };
  for (const m of marcas ?? []) {
    if (m.type === 'bold') t.negrita = true;
    else if (m.type === 'italic') t.cursiva = true;
    else if (m.type === 'underline') t.subrayado = true;
    else if (m.type === 'strike') t.tachado = true;
    else if (m.type === 'link') {
      const h = hrefPermitido(m.attrs?.href);
      if (h && /^(https?:|mailto:|tel:)/i.test(h)) t.enlace = h;
    } else if (m.type === 'textStyle') {
      const c = m.attrs?.color;
      if (c === 'acento') t.color = acento;
      else {
        const h = hex6(c, '');
        if (h) t.color = h;
      }
    }
  }
  return t;
}

/** Los trozos de un bloque de texto (párrafo, título): los textos con sus marcas y los saltos. */
function trozosDe(n: JsonNodo, acento: string): Trozo[] {
  const out: Trozo[] = [];
  for (const c of n.content ?? []) {
    if (c.type === 'text' && typeof c.text === 'string' && c.text) out.push(trozoDe(c.text, c.marks, acento));
    else if (c.type === 'hardBreak') out.push({ texto: '\n' });
    else if (c.content?.length) out.push(...trozosDe(c, acento));
  }
  return out;
}

const textoPlano = (trozos: Trozo[]) => trozos.map((t) => t.texto).join('').trim();

type Recorrido = { out: ParrafoDiapo[]; acento: string; imagenes: string[] };

function agregar(r: Recorrido, tipo: TipoParrafo, trozos: Trozo[], nivel = 0, tam = TAM_BASE[tipo]) {
  if (!textoPlano(trozos)) return;
  r.out.push({ tipo, nivel: Math.max(0, Math.min(2, nivel)), trozos, tam });
}

function enNegrita(trozos: Trozo[]): Trozo[] {
  return trozos.map((t) => ({ ...t, negrita: true as const }));
}

/** Los bloques de una lista (viñetas o números), con sus sublistas un nivel más adentro. */
function recorrerLista(lista: JsonNodo, r: Recorrido, nivel: number, tipo: 'vineta' | 'numerado') {
  for (const item of lista.content ?? []) {
    let primero = true;
    for (const hijo of item.content ?? []) {
      if (hijo.type === 'bulletList' || hijo.type === 'taskList') recorrerLista(hijo, r, nivel + 1, 'vineta');
      else if (hijo.type === 'orderedList') recorrerLista(hijo, r, nivel + 1, 'numerado');
      else if (hijo.type === 'paragraph' || hijo.type === 'heading') {
        agregar(r, primero ? tipo : 'parrafo', trozosDe(hijo, r.acento), primero ? nivel : nivel + 1);
        primero = false;
      } else recorrer(hijo, r, nivel + 1);
    }
  }
}

/** Un nodo del cuerpo de la sección → párrafos de la diapositiva. Lo que no es texto no sale. */
function recorrer(n: JsonNodo, r: Recorrido, nivel = 0): void {
  const a = (n.attrs ?? {}) as Record<string, unknown>;
  switch (n.type) {
    case 'heading': {
      const nivelTitulo = typeof a.level === 'number' ? a.level : 2;
      if (a.variante === 'titulo') agregar(r, 'titulo', trozosDe(n, r.acento), nivel);
      else agregar(r, nivelTitulo <= 2 ? 'encabezado' : 'subencabezado', trozosDe(n, r.acento), nivel, TAM_POR_NIVEL[nivelTitulo] ?? 22);
      return;
    }
    case 'paragraph': {
      const v = typeof a.variante === 'string' ? a.variante : '';
      agregar(r, v === 'antetitulo' ? 'antetitulo' : 'parrafo', trozosDe(n, r.acento), nivel, TAM_VARIANTE[v] ?? TAM_BASE.parrafo);
      return;
    }
    case 'bulletList':
    case 'taskList':
      recorrerLista(n, r, nivel, 'vineta');
      return;
    case 'orderedList':
      recorrerLista(n, r, nivel, 'numerado');
      return;
    case 'blockquote':
      for (const c of n.content ?? []) agregar(r, 'cita', trozosDe(c, r.acento).map((t) => ({ ...t, cursiva: true as const })), nivel);
      return;
    case NODO.optimizadoItem: {
      // Cada ítem de un diseño optimizado es una viñeta: su primer bloque en negrita (con el
      // valor de una estadística adelante) y el resto como texto debajo.
      const valor = typeof a.valor === 'string' ? a.valor.trim() : '';
      let primero = true;
      for (const c of n.content ?? []) {
        if (primero && (c.type === 'heading' || c.type === 'paragraph')) {
          const trozos = enNegrita(trozosDe(c, r.acento));
          agregar(r, 'vineta', valor ? [{ texto: valor + ' — ', negrita: true }, ...trozos] : trozos, nivel);
          primero = false;
        } else recorrer(c, r, nivel + 1);
      }
      if (primero && valor) agregar(r, 'vineta', [{ texto: valor, negrita: true }], nivel);
      return;
    }
    case NODO.boton: {
      const h = hrefPermitido(a.href);
      const enlace = h && /^(https?:|mailto:|tel:)/i.test(h) ? h : undefined;
      agregar(r, 'parrafo', trozosDe(n, r.acento).map((t) => ({ ...t, negrita: true as const, ...(enlace ? { enlace } : {}) })), nivel);
      return;
    }
    case NODO.desplegableTitulo:
      agregar(r, 'parrafo', enNegrita(trozosDe(n, r.acento)), nivel);
      return;
    case 'table':
      for (const fila of n.content ?? []) {
        const celdas = (fila.content ?? []).map((c) => textoPlano(trozosDe({ type: 'x', content: c.content }, r.acento)));
        const encabezado = (fila.content ?? []).some((c) => c.type === 'tableHeader');
        const linea: Trozo[] = [{ texto: celdas.filter(Boolean).join(' · ') }];
        agregar(r, 'parrafo', encabezado ? enNegrita(linea) : linea, nivel);
      }
      return;
    case NODO.grafico:
      if (typeof a.titulo === 'string' && a.titulo.trim()) agregar(r, 'parrafo', [{ texto: a.titulo.trim(), negrita: true }], nivel);
      return;
    case NODO.imagen: {
      const src = srcImagen(a.src);
      if (src) r.imagenes.push(src);
      return;
    }
    case 'horizontalRule':
    case NODO.espaciador:
    case NODO.video:
    case NODO.insertado:
    case NODO.htmlLibre:
    case NODO.formulario:
      return;
    default:
      // columnas, columna, optimizado, botones, recuadro, desplegable, desplegableCuerpo…:
      // su contenido, en orden.
      for (const c of n.content ?? []) recorrer(c, r, nivel);
  }
}

/** Líneas que ocupa un párrafo en un ancho dado (estimación por largo: ~0,52 em por carácter). */
function lineasDe(p: ParrafoDiapo, anchoIn: number, tam: number): number {
  const sangria = p.tipo === 'vineta' || p.tipo === 'numerado' ? 0.35 + p.nivel * 0.3 : p.nivel * 0.3;
  const porLinea = Math.max(8, Math.floor(((anchoIn - sangria) * 72) / (tam * 0.52)));
  return textoPlano(p.trozos).split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / porLinea)), 0);
}

/** Alto (pulgadas) del texto con un factor de escala. */
function altoDe(parrafos: ParrafoDiapo[], anchoIn: number, factor: number): number {
  return parrafos.reduce((h, p) => {
    const tam = Math.max(TAM_MINIMO, p.tam * factor);
    return h + (lineasDe(p, anchoIn, tam) * tam * 1.2 + tam * 0.45) / 72;
  }, 0);
}

/**
 * El factor (0,5 a 1) que hace entrar el texto en la caja. PowerPoint no encoge el texto al
 * abrir el archivo (sólo cuando alguien lo edita), así que el ajuste se estima acá.
 */
export function escalarTexto(parrafos: ParrafoDiapo[], caja: Caja): number {
  let factor = 1;
  while (factor > 0.5 && altoDe(parrafos, caja.w, factor) > caja.h) factor = Math.round((factor - 0.05) * 100) / 100;
  return Math.max(0.5, factor);
}

const ALINEAR: Record<string, Diapositiva['alinear']> = { arriba: 'top', centro: 'middle', abajo: 'bottom' };

/** Una sección → su diapositiva. */
export function modeloDiapositiva(elegida: SeccionElegida, tema: Tema): Diapositiva {
  const a = attrsTarjeta(elegida.tarjeta.attrs);
  const v = varsDeTema(tema);
  const acento = hex6(tema.colores.acento, '2C88F7');

  // Colores: los del tema, o los de la sección si pidió un fondo propio (con la tinta
  // recalculada por temas.ts para que se lea sobre ESE color, igual que en la página).
  let fondo = hex6(v['--gm-tarjeta-color'], 'FFFFFF');
  let texto = hex6(v['--gm-texto'], '161616');
  let titulo = hex6(v['--gm-titulo'], texto);
  let enlace = hex6(v['--gm-enlace'], acento);
  if (a.fondo === 'acento') {
    fondo = acento;
    texto = titulo = enlace = hex6(v['--gm-acento-contraste'], 'FFFFFF');
  } else {
    const relleno = a.fondo === 'color' ? a.fondoColor : a.fondo === 'degradado' && a.fondoDegradado ? DEGRADADOS[a.fondoDegradado] : null;
    if (relleno) {
      const vf = varsDeFondoPropio(tema, relleno);
      fondo = hex6(vf['--gm-tarjeta-color'], fondo);
      texto = hex6(vf['--gm-texto'], texto);
      titulo = hex6(vf['--gm-titulo'], titulo);
      enlace = hex6(vf['--gm-enlace'], enlace);
    }
  }

  const r: Recorrido = { out: [], acento, imagenes: [] };
  for (const c of elegida.tarjeta.content ?? []) recorrer(c, r);

  // La imagen: la de acento según el diseño; si la sección no tiene, la primera imagen del
  // cuerpo va a la derecha, entera (sin recortar).
  let lugar: LugarImagen | null = null;
  let src: string | null = null;
  let ajuste: ImagenDiapo['ajuste'] = a.imagenAjuste;
  if (a.diseno !== 'sin' && a.imagenSrc) { lugar = a.diseno; src = a.imagenSrc; }
  else if (r.imagenes.length) { lugar = 'derecha'; src = r.imagenes[0]; ajuste = 'contener'; }
  const cajas = cajasDeDiseno(lugar);
  const imagen: ImagenDiapo | null = lugar && src && cajas.imagen
    ? { src, lugar, ajuste, focoX: a.imagenFocoX, focoY: a.imagenFocoY, caja: cajas.imagen }
    : null;

  // La superposición sobre una imagen de fondo cambia la tinta, como en la hoja (css.ts §3).
  let velo: Diapositiva['velo'] = null;
  if (imagen?.lugar === 'fondo') {
    if (a.superposicion === 'oscura') { velo = { color: '000000', transparencia: 45 }; texto = 'F5F5F5'; titulo = enlace = 'FFFFFF'; }
    else if (a.superposicion === 'clara') { velo = { color: 'FFFFFF', transparencia: 36 }; texto = '161616'; titulo = enlace = '0D0D0D'; }
    else if (a.superposicion === 'esmerilada') velo = { color: fondo, transparencia: 40 };
  }

  const factor = escalarTexto(r.out, cajas.texto);
  const parrafos = r.out.map((p) => ({ ...p, tam: Math.max(TAM_MINIMO, Math.round(p.tam * factor * 2) / 2) }));

  return {
    numero: elegida.numero,
    id: a.id,
    fondo,
    colores: { texto, titulo, enlace },
    fuentes: { titulo: tema.fuentes.titulo.familia, cuerpo: tema.fuentes.cuerpo.familia },
    parrafos,
    cajaTexto: cajas.texto,
    alinear: ALINEAR[a.alineacion] ?? 'middle',
    imagen,
    velo,
    notas: a.notas,
  };
}

export function modeloDiapositivas(elegidas: readonly SeccionElegida[], tema: Tema): Diapositiva[] {
  return elegidas.map((e) => modeloDiapositiva(e, tema));
}

/**
 * Dónde y de qué tamaño va una imagen de `nat` píxeles en `caja`:
 *   · «cubrir» llena la caja y recorta lo que sobra alrededor del punto de enfoque (para
 *     pptxgenjs, `sizing: crop` sobre la imagen escalada; w/h son el tamaño escalado);
 *   · «contener» entra entera, centrada.
 */
export function colocarImagen(nat: { w: number; h: number }, caja: Caja, ajuste: ImagenDiapo['ajuste'], focoX = 50, focoY = 50):
  { x: number; y: number; w: number; h: number; sizing?: { type: 'crop'; x: number; y: number; w: number; h: number } } {
  if (!(nat.w > 0) || !(nat.h > 0)) return { ...caja };
  const r = (n: number) => Math.round(n * 1000) / 1000;
  if (ajuste === 'contener') {
    const s = Math.min(caja.w / nat.w, caja.h / nat.h);
    const w = nat.w * s;
    const h = nat.h * s;
    return { x: r(caja.x + (caja.w - w) / 2), y: r(caja.y + (caja.h - h) / 2), w: r(w), h: r(h) };
  }
  const s = Math.max(caja.w / nat.w, caja.h / nat.h);
  const w = nat.w * s;
  const h = nat.h * s;
  const fx = Math.max(0, Math.min(100, focoX)) / 100;
  const fy = Math.max(0, Math.min(100, focoY)) / 100;
  return { x: caja.x, y: caja.y, w: r(w), h: r(h), sizing: { type: 'crop', x: r((w - caja.w) * fx), y: r((h - caja.h) * fy), w: caja.w, h: caja.h } };
}

// ─────────────────────────────────────────────────────────────────────────────
// El archivo (navegador)
// ─────────────────────────────────────────────────────────────────────────────

/** Una imagen del bucket como data URL que PowerPoint entiende (PNG o JPEG) y su tamaño. null si no baja. */
async function cargarImagen(src: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch(src, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    const blob = await res.blob();
    const bmp = await createImageBitmap(blob);
    const w = bmp.width;
    const h = bmp.height;
    let data: string;
    if (blob.type === 'image/png' || blob.type === 'image/jpeg') {
      data = await new Promise<string>((ok, mal) => {
        const fr = new FileReader();
        fr.onload = () => ok(String(fr.result));
        fr.onerror = () => mal(fr.error);
        fr.readAsDataURL(blob);
      });
    } else {
      // WebP y GIF: PowerPoint no los abre en todas sus versiones; se pasan a PNG.
      const lienzo = document.createElement('canvas');
      lienzo.width = w;
      lienzo.height = h;
      lienzo.getContext('2d')?.drawImage(bmp, 0, 0);
      data = lienzo.toDataURL('image/png');
    }
    bmp.close();
    return { data, w, h };
  } catch {
    return null;
  }
}

type OpcionesTexto = Record<string, unknown>;

/** Los párrafos del modelo → el arreglo de textos de pptxgenjs (un `breakLine` cierra cada párrafo). */
export function textosPptx(d: Diapositiva): { text: string; options: OpcionesTexto }[] {
  const out: { text: string; options: OpcionesTexto }[] = [];
  d.parrafos.forEach((p, ip) => {
    const esTitulo = p.tipo === 'titulo' || p.tipo === 'encabezado' || p.tipo === 'subencabezado';
    const deParrafo: OpcionesTexto = {
      fontSize: p.tam,
      fontFace: esTitulo ? d.fuentes.titulo : d.fuentes.cuerpo,
      color: esTitulo ? d.colores.titulo : d.colores.texto,
      paraSpaceAfter: Math.round(p.tam * 0.45),
      ...(esTitulo ? { bold: true } : {}),
      ...(p.tipo === 'antetitulo' ? { charSpacing: 1, bold: true } : {}),
      ...(p.tipo === 'vineta' ? { bullet: { indent: 18 }, indentLevel: p.nivel } : {}),
      ...(p.tipo === 'numerado' ? { bullet: { type: 'number', indent: 18 }, indentLevel: p.nivel } : {}),
      ...(p.tipo !== 'vineta' && p.tipo !== 'numerado' && p.nivel ? { indentLevel: p.nivel } : {}),
    };
    // Un salto de línea adentro del párrafo parte el trozo: cada pedazo es un texto propio.
    const piezas: Trozo[] = [];
    for (const t of p.trozos) {
      const partes = t.texto.split('\n');
      partes.forEach((parte, i) => {
        if (i > 0) piezas.push({ texto: '\n' });
        if (parte) piezas.push({ ...t, texto: parte });
      });
    }
    const ultimoParrafo = ip === d.parrafos.length - 1;
    piezas.forEach((t, it) => {
      const ultimo = it === piezas.length - 1;
      if (t.texto === '\n') { out.push({ text: '', options: { ...deParrafo, breakLine: true } }); return; }
      out.push({
        text: t.texto,
        options: {
          ...deParrafo,
          ...(t.negrita ? { bold: true } : {}),
          ...(t.cursiva ? { italic: true } : {}),
          ...(t.subrayado ? { underline: { style: 'sng' } } : {}),
          ...(t.tachado ? { strike: 'sngStrike' } : {}),
          ...(t.color ? { color: t.color } : {}),
          ...(t.enlace ? { hyperlink: { url: t.enlace }, color: d.colores.enlace, underline: { style: 'sng' } } : {}),
          ...(ultimo && !ultimoParrafo ? { breakLine: true } : {}),
        },
      });
    });
  });
  return out;
}

export async function exportarPptx(op: { titulo: string; elegidas: readonly SeccionElegida[]; tema: Tema; onProgreso?: (f: number) => void }): Promise<void> {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.title = op.titulo;
  const diapos = modeloDiapositivas(op.elegidas, op.tema);
  for (let i = 0; i < diapos.length; i++) {
    const d = diapos[i];
    const s = pptx.addSlide();
    s.background = { color: d.fondo };
    if (d.imagen) {
      const img = await cargarImagen(d.imagen.src);
      if (img) s.addImage({ data: img.data, ...colocarImagen(img, d.imagen.caja, d.imagen.ajuste, d.imagen.focoX, d.imagen.focoY) });
    }
    if (d.velo) {
      s.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: ANCHO_DIAPO, h: ALTO_DIAPO,
        fill: { color: d.velo.color, transparency: d.velo.transparencia },
        line: { color: d.velo.color, transparency: 100 },
      });
    }
    if (d.parrafos.length) {
      s.addText(textosPptx(d) as Parameters<typeof s.addText>[0], {
        ...d.cajaTexto, valign: d.alinear, margin: 0, fontFace: d.fuentes.cuerpo, color: d.colores.texto, fit: 'none',
      });
    }
    if (d.notas.trim()) s.addNotes(d.notas);
    op.onProgreso?.((i + 1) / (diapos.length + 1));
  }
  const blob = (await pptx.write({ outputType: 'blob' })) as Blob;
  descargar(blob, nombreArchivo(op.titulo, 'pptx'));
  op.onProgreso?.(1);
}

/** Las familias que conviene instalar para que el .pptx se vea con las fuentes del tema («Instalar fuentes» de Gamma). */
export function fuentesDelTema(tema: Tema): string[] {
  return [...new Set([tema.fuentes.titulo.familia, tema.fuentes.cuerpo.familia])];
}
