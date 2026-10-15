// =============================================================================
// editor-landing/exportar-html — lo COMÚN a las cuatro exportaciones + el .html autocontenido
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma». Gamma exporta desde
// Compartir → Exportar con un rango («Todas las diapositivas / diapositiva actual / Gama
// personalizada: p. ej. 1-5,8,11-15») a PDF, PowerPoint y PNG; acá se suma HTML porque una
// landing es una página web (decisión D7 de docs/diseno-editor-landing.md).
//
// Este módulo tiene dos mitades:
//   · PURA (la usan los tests y las otras tres exportaciones): el parser del rango, la
//     elección de las secciones, el nombre del archivo y el documento HTML completo que
//     arma el PDF (impreso desde un iframe) y el .html descargado.
//   · DOM (sólo se ejecuta en el navegador, al llamarla): bajar un archivo y preparar una
//     sección para fotografiarla o imprimirla (imágenes sin carga perezosa, iframes y
//     videos reemplazados por su marcador).
//
// Lo que se exporta sale SIEMPRE de `htmlDePagina`/`htmlDeTarjeta` (render.ts, la única
// fábrica de HTML público) con `modo: 'exportar'` y la hoja única CSS_CONTENIDO: lo que se
// exporta es lo que se edita y lo que se publica.
//
// Lo que NO hace, a propósito:
//   · No incrusta las imágenes en el .html: quedan con su URL del bucket público
//     (`landing-imagenes`), que no vence. Incrustarlas multiplicaría el archivo por diez.
//   · No lleva el Pixel ni el script del formulario de la página publicada: es una copia
//     ESTÁTICA. Un formulario de la copia no manda nada (un script mínimo frena el envío,
//     para que no termine en un GET con los datos en la URL).
//   · Las secciones ocultas no se exportan (Gamma tampoco las presenta ni las publica).
// =============================================================================

import { NODO, type JsonNodo, type Pagina } from './doc';
import { esPresentacion, relacionDe, type ConfigLanding, type FormatoDoc, type Proporcion } from './api-tipos';
import { htmlDePagina } from './render';
import { CSS_CONTENIDO } from './css';
import { colorDeRelleno, urlFuentes, type Tema } from './temas';

// ─────────────────────────────────────────────────────────────────────────────
// El rango (Gamma: «Todas las diapositivas» · «Diapositiva actual» · «Gama personalizada»)
// ─────────────────────────────────────────────────────────────────────────────

export type RangoExportar =
  | { tipo: 'todas' }
  | { tipo: 'actual'; tarjetaId: string | null }
  | { tipo: 'personalizado'; texto: string };

export type ResultadoRango = { ok: true; numeros: number[] } | { ok: false; error: string };

/**
 * «1-3,5» → [1, 2, 3, 5] sobre `total` secciones (numeradas desde 1, como la tira).
 * Acepta espacios, comas o punto y coma entre partes, el guion corto o el largo en un
 * intervalo, intervalos al revés («5-3» = 3, 4, 5) y repetidos (se cuentan una vez). Lo
 * que no entiende lo dice en vez de adivinar: un rango mal escrito que exporta OTRA cosa
 * se descubre después de abrir el archivo.
 */
export function parsearRango(texto: string, total: number): ResultadoRango {
  const t = (texto ?? '').trim();
  if (!t) return { ok: false, error: 'Rango vacío' };
  const vistos = new Set<number>();
  for (const parteCruda of t.split(/[,;]+/)) {
    const parte = parteCruda.trim();
    if (!parte) continue;
    const m = /^(\d{1,4})(?:\s*[-–—]\s*(\d{1,4}))?$/.exec(parte);
    if (!m) return { ok: false, error: 'Rango inválido' };
    let a = Number(m[1]);
    let b = m[2] !== undefined ? Number(m[2]) : a;
    if (a > b) [a, b] = [b, a];
    if (a < 1 || b > total) return { ok: false, error: 'Fuera de rango' };
    for (let n = a; n <= b; n++) vistos.add(n);
  }
  if (!vistos.size) return { ok: false, error: 'Rango vacío' };
  return { ok: true, numeros: [...vistos].sort((x, y) => x - y) };
}

export type SeccionElegida = { tarjeta: JsonNodo; numero: number };
export type ResultadoEleccion = { ok: true; elegidas: SeccionElegida[] } | { ok: false; error: string };

const esTarjeta = (n: JsonNodo | null | undefined): n is JsonNodo => !!n && typeof n === 'object' && n.type === NODO.tarjeta;
const oculta = (t: JsonNodo) => (t.attrs as { oculta?: unknown } | undefined)?.oculta === true;
const idDe = (t: JsonNodo) => {
  const id = (t.attrs as { id?: unknown } | undefined)?.id;
  return typeof id === 'string' ? id : '';
};

/**
 * Las secciones que salen, con su NÚMERO de la tira (el de todas las secciones de la
 * página, ocultas incluidas: así «1-3» quiere decir lo mismo que la tira muestra). Las
 * ocultas no salen nunca.
 */
export function elegirTarjetas(nodos: readonly JsonNodo[], rango: RangoExportar): ResultadoEleccion {
  const todas = nodos.filter(esTarjeta).map((tarjeta, i) => ({ tarjeta, numero: i + 1 }));
  if (!todas.length) return { ok: false, error: 'No hay secciones' };
  let elegidas: SeccionElegida[];
  if (rango.tipo === 'todas') elegidas = todas;
  else if (rango.tipo === 'actual') {
    const una = rango.tarjetaId ? todas.find((s) => idDe(s.tarjeta) === rango.tarjetaId) : undefined;
    if (!una) return { ok: false, error: 'Sin sección actual' };
    elegidas = [una];
  } else {
    const r = parsearRango(rango.texto, todas.length);
    if (!r.ok) return r;
    const pedidos = new Set(r.numeros);
    elegidas = todas.filter((s) => pedidos.has(s.numero));
  }
  const visibles = elegidas.filter((s) => !oculta(s.tarjeta));
  if (!visibles.length) return { ok: false, error: 'Solo hay secciones ocultas' };
  return { ok: true, elegidas: visibles };
}

// ─────────────────────────────────────────────────────────────────────────────
// El nombre del archivo: el título de la landing
// ─────────────────────────────────────────────────────────────────────────────

const RESERVADOS_WINDOWS = /^(con|prn|aux|nul|com\d|lpt\d)$/i;

/**
 * «Mi landing: oferta» + «pdf» → «Mi landing oferta.pdf». Saca lo que Windows, macOS o un
 * correo no aceptan en un nombre (las barras, los dos puntos, el asterisco, las comillas, los
 * caracteres de control), colapsa espacios y corta a 80. Los acentos se quedan: los tres
 * sistemas los aceptan y el título es de la persona.
 */
export function nombreArchivo(titulo: string, ext: string): string {
  const sinControl = Array.from(String(titulo ?? '')).filter((c) => { const n = c.charCodeAt(0); return n >= 32 && n !== 127; }).join('');
  let base = sinControl.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/g, '');
  base = base.slice(0, 80).trim().replace(/[. ]+$/g, '');
  if (!base) base = 'Landing';
  if (RESERVADOS_WINDOWS.test(base)) base = 'Landing ' + base;
  return base + '.' + ext.replace(/^\./, '');
}

/** La página con sólo las secciones elegidas, en su orden. */
export function paginaConTarjetas(pagina: Pagina, tarjetas: readonly JsonNodo[]): Pagina {
  return { ...pagina, doc: { type: 'doc', content: [...tarjetas] } };
}

// ─────────────────────────────────────────────────────────────────────────────
// El documento HTML completo (el .html descargado y la hoja que se imprime en PDF)
// ─────────────────────────────────────────────────────────────────────────────

function escaparHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Frena el envío de los formularios de la copia: no hay a dónde mandarlos. */
const SCRIPT_FORMULARIO_MUDO = "document.addEventListener('submit',function(e){e.preventDefault();},true);";

export type OpDocumento = {
  titulo: string;
  /** El HTML de `htmlDePagina` (la raíz .gm-doc con el tema inline). */
  html: string;
  tema: Tema;
  /** true = la hoja va a la impresora (PDF): fondo de la página en cada hoja y sin el sello flotante. */
  imprimir?: boolean;
  /**
   * El formato y la proporción del documento (`config.formato` y `config.proporcion`). Al imprimir una
   * PRESENTACIÓN, la hoja toma la forma de la diapositiva (`hojaDeImpresion`).
   */
  formato?: FormatoDoc;
  proporcion?: Proporcion;
};

/**
 * La hoja de una presentación impresa, o null en una página web.
 *
 * Pendiente de la tanda 2 («el PDF de una presentación sale vertical»): la hoja única traía sólo el
 * margen (`@page { margin: 10mm; }`, css.ts) y el tamaño lo elegía la impresora, así que cada
 * diapositiva 16:9 salía arriba de una hoja A4 o Carta VERTICAL, con media hoja en blanco. Con `size`,
 * el diálogo de impresión propone la hoja de la diapositiva, horizontal:
 *   · 16:9 y «Fluido» (como el PPTX: exportar-pptx.ts, `tamanoDiapo`): 13,333 × 7,5 in, que son
 *     1280 × 720 px CSS, el mismo ancho que el iframe que imprime (exportar-pdf.ts);
 *   · 4:3: 10 × 7,5 in.
 * Sin margen: la diapositiva va a sangre, como la exporta Gamma. Va DESPUÉS de CSS_CONTENIDO porque en
 * `@page` gana la última regla y la de la hoja única trae los 10 mm de una página web.
 */
export function hojaDeImpresion(c: { formato?: unknown; proporcion?: unknown }): string | null {
  if (!esPresentacion(c)) return null;
  const r = relacionDe(c);
  const tam = r !== null && Math.abs(r - 4 / 3) < 0.01 ? '10in 7.5in' : '13.333in 7.5in';
  return '@media print{@page{size:' + tam + ';margin:0}}';
}

/**
 * El documento entero: head con el título, las fuentes de Google del tema y la hoja única
 * (CSS_CONTENIDO) adentro de un <style>; el body es el HTML de la página. Autocontenido salvo
 * las fuentes y las imágenes (que viven en URLs públicas que no vencen).
 */
export function documentoExportable(op: OpDocumento): string {
  const titulo = nombreArchivo(op.titulo, 'x').replace(/\.x$/, '');
  const fuentes = urlFuentes([op.tema]);
  const fondo = colorDeRelleno(op.tema.fondo);
  const base = [
    'html,body{margin:0;padding:0}',
    'body{min-height:100vh;background:' + fondo + ';-webkit-text-size-adjust:100%;text-size-adjust:100%}',
  ];
  if (op.imprimir) {
    base.push(
      '@media print{body{background:' + fondo + ';-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
      '.gm-doc .gm-fondo{min-height:0}.gm-doc .gm-pie{break-before:page}}',
    );
  }
  const diapositiva = op.imprimir ? hojaDeImpresion(op) : null;
  const hoja = (base.join('\n') + '\n' + CSS_CONTENIDO + (diapositiva ? '\n' + diapositiva : '')).replace(/<\/style/gi, '<\\/style');
  const head: string[] = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="generator" content="MaKo">',
    '<title>' + escaparHtml(titulo) + '</title>',
  ];
  if (fuentes) {
    head.push(
      '<link rel="preconnect" href="https://fonts.googleapis.com">',
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
      '<link rel="stylesheet" href="' + escaparHtml(fuentes) + '">',
    );
  }
  head.push('<style>' + hoja + '</style>');
  const cola = op.imprimir ? '' : '<script>' + SCRIPT_FORMULARIO_MUDO + '</script>';
  return ['<!doctype html>', '<html lang="es">', '<head>', ...head, '</head>', '<body>', op.html, cola, '</body>', '</html>'].join('\n');
}

/** Lo que reciben las cuatro exportaciones (lo arma DialogoExportar desde el contexto del editor). */
export type OpExportar = {
  titulo: string;
  pagina: Pagina;
  elegidas: readonly SeccionElegida[];
  config: ConfigLanding;
  tema: Tema;
  /** La dirección publicada de la página de inicio: resuelve los enlaces `pagina:<id>`. Sin publicar, quedan en «#». */
  urlBase?: string | null;
  /** Las páginas del sitio (id y ruta), para esa misma resolución. */
  paginas?: ReadonlyArray<Pick<Pagina, 'id' | 'ruta'>>;
  /** 0 a 1. */
  onProgreso?: (fraccion: number) => void;
};

/** El HTML de la página con las secciones elegidas, como lo dibuja la exportación. */
export function htmlParaExportar(op: Pick<OpExportar, 'pagina' | 'elegidas' | 'config' | 'tema' | 'urlBase' | 'paginas'>): string {
  return htmlDePagina(paginaConTarjetas(op.pagina, op.elegidas.map((e) => e.tarjeta)), op.config, op.tema, {
    modo: 'exportar',
    urlBase: op.urlBase ?? undefined,
    paginas: op.paginas,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DOM: bajar el archivo y preparar lo que se fotografía o se imprime
// ─────────────────────────────────────────────────────────────────────────────

/** Baja un Blob con su nombre (un <a download> efímero). */
export function descargar(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // El navegador necesita la URL viva hasta que arranca la descarga.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Deja una sección lista para fotografiarse o imprimirse:
 *   · las imágenes cargan YA (`loading="lazy"` en un contenedor fuera de la pantalla o en un
 *     iframe sin tamaño no carga nunca, y la foto sale con el hueco);
 *   · los iframes (videos de YouTube, agendas, HTML libre) y los <video> se reemplazan por el
 *     marcador de la hoja (`.gm-marcador`): una foto no puede capturar un iframe y una hoja
 *     impresa tampoco lo reproduce.
 */
export function prepararParaCaptura(raiz: ParentNode): void {
  const doc = (raiz as Node).ownerDocument ?? document;
  raiz.querySelectorAll('img').forEach((img) => {
    img.loading = 'eager';
    img.decoding = 'sync';
  });
  raiz.querySelectorAll('iframe, video').forEach((el) => {
    const marcador = doc.createElement('div');
    marcador.className = 'gm-marcador';
    const contenedor = el.closest('.gm-insertado, .gm-html, figure.gm-video');
    if (contenedor) contenedor.setAttribute('data-marcador', 'si');
    const poster = el instanceof HTMLVideoElement ? el.getAttribute('poster') : null;
    if (poster) {
      const img = doc.createElement('img');
      img.src = poster;
      img.alt = '';
      el.replaceWith(img);
    } else el.replaceWith(marcador);
  });
}

/** Las URLs de los `background-image` que la hoja pinta (imagen de acento y fondo de la página). */
function urlsDeFondos(raiz: ParentNode): string[] {
  const out: string[] = [];
  raiz.querySelectorAll<HTMLElement>('.gm-acento, .gm-fondo[data-imagen]').forEach((el) => {
    const m = /url\("?([^")]+)"?\)/.exec(el.style.backgroundImage || el.getAttribute('style') || '');
    if (m) out.push(m[1]);
  });
  return out;
}

/**
 * Espera a que estén las fuentes, las imágenes y los fondos (o a que pase `topeMs`): una
 * foto tomada antes sale con la tipografía de respaldo y los huecos de las imágenes. Una
 * imagen que falla no frena la exportación: sale sin ella.
 */
export async function esperarRecursos(raiz: ParentNode, doc: Document, topeMs = 15_000): Promise<void> {
  const imgs = Array.from(raiz.querySelectorAll('img'));
  const promesas: Promise<unknown>[] = imgs.map((img) => (img.complete ? Promise.resolve() : new Promise((ok) => {
    img.addEventListener('load', ok, { once: true });
    img.addEventListener('error', ok, { once: true });
  })));
  for (const url of urlsDeFondos(raiz)) {
    promesas.push(new Promise((ok) => {
      const i = new Image();
      i.crossOrigin = 'anonymous';
      i.onload = ok;
      i.onerror = ok;
      i.src = url;
    }));
  }
  const fuentes = (doc as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
  if (fuentes) promesas.push(fuentes.ready.catch(() => undefined));
  await Promise.race([Promise.all(promesas), new Promise((ok) => setTimeout(ok, topeMs))]);
}

/** Baja la página (con las secciones elegidas) como un .html autocontenido. */
export async function exportarHtml(op: OpExportar): Promise<void> {
  op.onProgreso?.(0.2);
  const doc = documentoExportable({ titulo: op.titulo, html: htmlParaExportar(op), tema: op.tema });
  op.onProgreso?.(0.9);
  descargar(new Blob([doc], { type: 'text/html;charset=utf-8' }), nombreArchivo(op.titulo, 'html'));
  op.onProgreso?.(1);
}
