// =============================================================================
// editor-landing/exportar-pdf — «Exportar a PDF» de Gamma: una sección por hoja, con la impresora
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma». Decisión D7 de
// docs/diseno-editor-landing.md: el PDF sale de la vista de impresión del navegador
// (`window.print()`), no de una librería que dibuje PDF. Así sale con las fuentes, los
// degradados y el texto seleccionable de la página real, y sin sumar dependencias.
//
// Cómo: un iframe fuera de la pantalla con el documento de `documentoExportable` (la hoja
// única CSS_CONTENIDO trae su bloque `@media print`: cada sección `break-after: page`, los
// colores con `print-color-adjust: exact`, sin la barra ni el sello flotante), se espera a
// que carguen las fuentes y las imágenes, y se imprime ESE iframe. El nombre que propone el
// diálogo de «Guardar como PDF» es el <title> del documento: el título de la landing.
//
// Lo que no puede hacer, y por qué:
//   · Elegir «Guardar como PDF» por la persona: el destino lo elige el diálogo del navegador.
//   · Un iframe (video, agenda, HTML libre) no se imprime: sale su marcador.
//   · El tamaño de hoja lo decide la impresora elegida (la hoja trae sólo el margen de 10 mm).
// =============================================================================

import { documentoExportable, esperarRecursos, htmlParaExportar, prepararParaCaptura, type OpExportar } from './exportar-html';

/** Lo que espera a que el iframe cargue antes de darse por vencido. */
const TOPE_CARGA_MS = 20_000;
/** Si el navegador no avisa `afterprint` (algunos no lo hacen al cancelar), el iframe se saca igual. */
const TOPE_LIMPIEZA_MS = 120_000;

export async function exportarPdf(op: OpExportar): Promise<void> {
  op.onProgreso?.(0.1);
  const doc = documentoExportable({ titulo: op.titulo, html: htmlParaExportar(op), tema: op.tema, imprimir: true });

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.tabIndex = -1;
  iframe.title = 'Exportar a PDF';
  // Fuera de la pantalla y con tamaño de escritorio: con 0×0 la página se maqueta a 0 de
  // ancho antes de imprimir y `display:none` no imprime nada en Firefox.
  Object.assign(iframe.style, {
    position: 'fixed', left: '-12000px', top: '0', width: '1280px', height: '900px', border: '0', pointerEvents: 'none',
  } satisfies Partial<CSSStyleDeclaration>);

  const cargado = new Promise<void>((ok, mal) => {
    const t = window.setTimeout(() => mal(new Error('Tardó demasiado')), TOPE_CARGA_MS);
    iframe.addEventListener('load', () => { window.clearTimeout(t); ok(); }, { once: true });
  });
  iframe.srcdoc = doc;
  document.body.appendChild(iframe);

  let limpio = false;
  const limpiar = () => { if (limpio) return; limpio = true; iframe.remove(); };
  try {
    await cargado;
    const w = iframe.contentWindow;
    const d = iframe.contentDocument;
    if (!w || !d) throw new Error('No se pudo preparar la hoja');
    op.onProgreso?.(0.4);
    prepararParaCaptura(d.body);
    await esperarRecursos(d.body, d);
    op.onProgreso?.(0.9);
    w.addEventListener('afterprint', () => window.setTimeout(limpiar, 500), { once: true });
    window.setTimeout(limpiar, TOPE_LIMPIEZA_MS);
    w.focus();
    // En Chrome y Edge `print()` bloquea hasta que se cierra el diálogo; en Firefox vuelve
    // enseguida y el diálogo sigue abierto: por eso la limpieza cuelga de `afterprint`.
    w.print();
    op.onProgreso?.(1);
  } catch (e) {
    limpiar();
    throw e;
  }
}
