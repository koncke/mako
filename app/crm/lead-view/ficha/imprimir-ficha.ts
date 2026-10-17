// =============================================================================
// imprimir-ficha — «Exportar (PDF)» del «⋯» de la ficha: la ficha COMO SE VE, en el diálogo de imprimir del navegador
// =============================================================================
// Martín, 16/10/2026 (punto 10): el «⋯» como el del Dashboard, con «exportar la hoja del lead». El PDF del Dashboard es
// la impresión del navegador (app/dashboard/EditorInforme.tsx); acá igual, con una diferencia: la ficha vive adentro de
// un pop-up con alto fijo y un cuerpo que scrollea, encima del tablero. Imprimir la ventana daría el tablero con un
// recorte de la ficha. Por eso se imprime una COPIA de la ficha (la cabecera y la hoja abierta) en un iframe invisible,
// con las MISMAS hojas de estilo de la página, y ahí todo se despliega: sin alto fijo, sin scroll, sin lo pegado.
//
// ⚠️ LA COPIA ES DEL DOM, no un render aparte: lo que se ve es lo que sale (las hojas que no están abiertas van con
//    `display: none` y no salen; los botones de editar y el «⋯» se esconden en la impresión).
// ⚠️ SE ESPERA A QUE CARGUEN LAS HOJAS DE ESTILO DEL IFRAME (con tope): imprimir antes sale sin estilos.
// =============================================================================

/** Lo que se esconde en el papel: lo que se toca y no se lee. */
const CSS_PAPEL = `
@page { margin: 12mm; }
html, body { background: #fff !important; }
body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
* { overflow: visible !important; max-height: none !important; }
[role="dialog"], [data-ficha-ruta] { height: auto !important; width: auto !important; box-shadow: none !important; border: none !important; }
[style*="sticky"] { position: static !important; }
.fb-personalizar, .lt-hojas, [aria-label="Más opciones de la ficha"], [aria-label="Cerrar"], .cd-cerrar, .fb-barra, .fb-galeria, .fb-gal-barra { display: none !important; }
`;

/** Cuánto se espera a las hojas de estilo antes de imprimir igual. */
const TOPE_ESTILOS_MS = 4000;

/**
 * Imprime una copia de `raiz` (el pop-up o la página de la ficha). `titulo` es el nombre del archivo que propone el
 * navegador al «Guardar como PDF».
 */
export async function imprimirFicha(raiz: HTMLElement, titulo: string): Promise<void> {
  const marco = document.createElement('iframe');
  marco.setAttribute('aria-hidden', 'true');
  marco.style.cssText = 'position:fixed;right:0;bottom:0;width:1100px;height:10px;opacity:0;pointer-events:none;border:0;';
  document.body.appendChild(marco);
  const doc = marco.contentDocument;
  const win = marco.contentWindow;
  if (!doc || !win) { marco.remove(); return; }
  doc.open();
  doc.write('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
  doc.close();
  doc.title = titulo;
  // Las mismas hojas de la página: las enlazadas y las de los componentes (`<style>` en el head y adentro de la ficha).
  const cargas: Promise<void>[] = [];
  for (const n of Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))) {
    const copia = doc.importNode(n, true) as HTMLElement;
    if (copia instanceof HTMLLinkElement) cargas.push(new Promise((r) => { copia.onload = () => r(); copia.onerror = () => r(); }));
    doc.head.appendChild(copia);
  }
  const papel = doc.createElement('style');
  papel.textContent = CSS_PAPEL;
  doc.head.appendChild(papel);
  // El tema (claro u oscuro) y las variables de la raíz viajan en los atributos de <html>.
  for (const a of Array.from(document.documentElement.attributes)) doc.documentElement.setAttribute(a.name, a.value);
  doc.body.appendChild(doc.importNode(raiz, true));
  await Promise.race([Promise.all(cargas), new Promise((r) => setTimeout(r, TOPE_ESTILOS_MS))]);
  await new Promise((r) => setTimeout(r, 150));
  const fin = () => setTimeout(() => marco.remove(), 500);
  win.addEventListener('afterprint', fin, { once: true });
  win.focus();
  win.print();
  // Algunos navegadores no avisan `afterprint` de un iframe: igual se limpia.
  setTimeout(() => { if (marco.isConnected) marco.remove(); }, 60_000);
}
