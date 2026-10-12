// =============================================================================
// editor-landing/exportar-png — «Exportar como PNG» de Gamma: una imagen por sección, en un .zip
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma». Decisión D7 de
// docs/diseno-editor-landing.md: cada sección se fotografía con `html-to-image` (ya instalado,
// 1.11.13) a 2x y, si son varias, van juntas en un .zip (`jszip`, ya instalado). Las dos se
// cargan con `import()` al exportar: no entran al bundle del editor.
//
// Cómo: cada sección se dibuja con `htmlDeTarjeta` (render.ts, `modo: 'exportar'`) en un
// contenedor FUERA de la pantalla de 1280 px de ancho y con el tamaño base de Gamma en
// escritorio (`--gm-base: 18px`), así la foto no depende del ancho de la ventana del editor.
// La hoja única y las fuentes del tema se montan una vez para toda la tanda y se sacan al final.
//
// Tres cosas que no se ven y deciden cómo está escrito:
//   · Las fuentes se incrustan UNA vez (`getFontEmbedCSS` sobre la primera sección) y se
//     reusan: sin eso, html-to-image vuelve a bajar y a codificar las de Google en cada foto.
//   · Las imágenes del bucket público se bajan con CORS (Supabase Storage contesta
//     `Access-Control-Allow-Origin: *`): si una falla, la foto sale sin ella y no se corta la tanda.
//   · `backdrop-filter` (la tarjeta «esmerilada») no se dibuja adentro de la foto: html-to-image
//     pinta por SVG y ese filtro no existe ahí. Sale la tarjeta translúcida sin el desenfoque.
// =============================================================================

import { slugDe, tituloDeTarjeta } from './doc';
import { htmlDeTarjeta } from './render';
import { CSS_CONTENIDO } from './css';
import { colorDeRelleno, urlFuentes, type Tema } from './temas';
import { descargar, esperarRecursos, nombreArchivo, prepararParaCaptura, type OpExportar } from './exportar-html';

/** Ancho del lienzo de la foto (px): el de una pantalla de escritorio, donde la sección mide 64.5em × 18px. */
const ANCHO_FOTO = 1280;

type Montaje = { contenedor: HTMLDivElement; quitar: () => void };

/** El contenedor fuera de la pantalla, con la hoja y las fuentes del tema (si no estaban ya). */
function montar(tema: Tema): Montaje {
  const caja = document.createElement('div');
  caja.setAttribute('aria-hidden', 'true');
  Object.assign(caja.style, { position: 'fixed', left: '-20000px', top: '0', width: ANCHO_FOTO + 'px', pointerEvents: 'none' } satisfies Partial<CSSStyleDeclaration>);
  caja.style.setProperty('--gm-base', '18px');
  const hoja = document.createElement('style');
  hoja.setAttribute('data-gm-exportar', '');
  hoja.textContent = CSS_CONTENIDO;
  const contenedor = document.createElement('div');
  caja.append(hoja, contenedor);
  document.body.appendChild(caja);

  const url = urlFuentes([tema]);
  let link: HTMLLinkElement | null = null;
  if (url && !Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).some((l) => l.href === url)) {
    link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  }
  return { contenedor, quitar: () => { caja.remove(); link?.remove(); } };
}

/** «data:image/png;base64,AAAA» → Blob. */
function blobDeDataUrl(dataUrl: string): Blob {
  const coma = dataUrl.indexOf(',');
  const bin = atob(dataUrl.slice(coma + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: 'image/png' });
}

/** «07-nuestros-planes.png»: el número de la tira (con cero adelante para que ordene) y el título. */
export function nombreDeFoto(numero: number, titulo: string, total: number): string {
  const ancho = String(Math.max(total, numero)).length;
  return String(numero).padStart(Math.max(2, ancho), '0') + '-' + slugDe(titulo || 'seccion') + '.png';
}

export async function exportarPng(op: OpExportar): Promise<void> {
  const [{ toPng, getFontEmbedCSS }, { default: JSZip }] = await Promise.all([import('html-to-image'), import('jszip')]);
  const montaje = montar(op.tema);
  const fondo = colorDeRelleno(op.tema.fondo);
  const fotos: { nombre: string; dataUrl: string }[] = [];
  try {
    let fuentesCss: string | null = null;
    const n = op.elegidas.length;
    for (let i = 0; i < n; i++) {
      const { tarjeta, numero } = op.elegidas[i];
      montaje.contenedor.innerHTML = htmlDeTarjeta(tarjeta, op.tema, { modo: 'exportar', urlBase: op.urlBase ?? undefined, paginas: op.paginas });
      const raiz = montaje.contenedor.querySelector<HTMLElement>('.gm-doc');
      if (!raiz) continue;
      prepararParaCaptura(raiz);
      await esperarRecursos(raiz, document);
      if (fuentesCss === null) fuentesCss = await getFontEmbedCSS(raiz).catch(() => '');
      const dataUrl = await toPng(raiz, {
        pixelRatio: 2,
        cacheBust: false,
        backgroundColor: fondo,
        ...(fuentesCss ? { fontEmbedCSS: fuentesCss } : { skipFonts: true }),
      });
      fotos.push({ nombre: nombreDeFoto(numero, tituloDeTarjeta(tarjeta), n), dataUrl });
      op.onProgreso?.((i + 1) / (n + 1));
    }
  } finally {
    montaje.quitar();
  }
  if (!fotos.length) throw new Error('No hay secciones para exportar');
  if (fotos.length === 1) {
    descargar(blobDeDataUrl(fotos[0].dataUrl), nombreArchivo(op.titulo, 'png'));
  } else {
    const zip = new JSZip();
    for (const f of fotos) zip.file(f.nombre, f.dataUrl.slice(f.dataUrl.indexOf(',') + 1), { base64: true });
    const blob = await zip.generateAsync({ type: 'blob' });
    descargar(blob, nombreArchivo(op.titulo, 'zip'));
  }
  op.onProgreso?.(1);
}
