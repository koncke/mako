// =============================================================================
// El Pixel de MaKo como ARCHIVO .js, para quien no lo puede pegar.
//
// Lo que se copia en /integraciones es un `<script>…</script>` de ~2.200 líneas
// pensado para pegar antes del </body>. Hay dos casos donde eso no sirve, y los
// dos son de los clientes de Código Inmobiliario (ws13, ws15, ws17):
//
//   1. El código vive en un archivo propio (`public/mako-tracking.js`, cargado
//      con un <script src>). Pegar las etiquetas adentro de un .js lo rompe.
//   2. Su editor con IA TAPA partes de lo que se le pega. Medido el 08/10/2026
//      con la captura de un cliente: la herramienta contestó que el código le
//      llegó con `********` en varias secciones y lo rechazó por JavaScript
//      inválido. Los asteriscos NO salen de MaKo —el botón copia el snippet
//      crudo y el emitido no tiene ni uno—: los pone la herramienta, que trata
//      como secreto algo que no lo es (el token del Pixel es público, va en el
//      HTML de cada página). Cuál es la herramienta y qué detector usa NO se
//      pudo medir.
//
// La salida para los dos es la misma, y es la que la propia herramienta pidió:
// el archivo, que se pone en la carpeta del proyecto sin pasar por el chat.
//
// SIN `server-only`: lo usa el botón de /integraciones y lo prueba
// tests/pixel-archivo.test.ts contra el snippet emitido de verdad.
// =============================================================================

/** El nombre con el que se descarga: el mismo que ya usa el cliente del ws13,
 *  así reemplazarlo es pisar un archivo y no cambiar ningún <script src>. */
export const ARCHIVO_PIXEL = 'mako-tracking.js';

/**
 * El snippet sin sus etiquetas `<script>`, listo para guardar como .js. `null` si
 * no tiene la forma esperada (UNA etiqueta que abre al principio y UNA que cierra
 * al final): mejor no ofrecer el archivo que ofrecer uno que no carga.
 */
export function pixelComoArchivo(snippet: string): string | null {
  const m = /^\s*<script>\r?\n([\s\S]*?)\r?\n<\/script>\s*$/.exec(snippet);
  // Un `</script` adentro es que había DOS scripts: en uno inline no puede estar,
  // porque el navegador lo cerraría ahí. Con eso el archivo saldría roto.
  if (!m || /<\/script/i.test(m[1])) return null;
  return `${m[1]}\n`;
}
