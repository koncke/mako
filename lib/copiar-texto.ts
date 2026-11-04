// =============================================================================
// copiar-texto — copiar al portapapeles, un solo camino (ticket #36, 3/11/2026)
// =============================================================================
// «No pude copiar» en el Ops Center, desde la app de Claude: `navigator.clipboard` existe y aun así rechaza la promesa (permisos, la
// pestaña sin foco). `copiar` (app/admin/operaciones/mandar.ts) terminaba ahí y `copiarTexto` (app/m/copywriting/api.ts) tenía el
// camino viejo: dos copias de lo mismo, y sólo una copiaba. Sólo del navegador: lo importan los hooks y las pantallas.
// =============================================================================

/**
 * Copiar al portapapeles. Devuelve si copió DE VERDAD (escritorio lo aprendió: sin clipboard el catch se tragaba el error y el botón
 * decía «Copiado» igual). Sin la API, o si la rechaza, el camino de siempre: un textarea seleccionado y `execCommand('copy')`.
 */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(texto); return true; }
  } catch { /* cae al camino viejo */ }
  try {
    const t = document.createElement('textarea');
    t.value = texto;
    t.setAttribute('readonly', '');
    t.style.position = 'fixed'; t.style.opacity = '0'; t.style.top = '0'; t.style.left = '0';
    document.body.appendChild(t);
    t.select();
    t.setSelectionRange(0, texto.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(t);
    return ok;
  } catch {
    return false;
  }
}

/** El aviso cuando no se pudo por ninguno de los dos caminos: dice qué hacer. */
export const NO_PUDE_COPIAR = 'No pude copiar: cópialo a mano';
