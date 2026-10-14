// =============================================================================
// Lo que se le dice a la persona cuando exportar falla
// =============================================================================
// ⚠️ EXISTE PORQUE DEBAJO DE «No se pudo exportar» IBA EL `error.message` CRUDO DEL
// MOTOR, que viene en inglés y nombra piezas internas («OffscreenCanvas is not
// supported in this environment», «Compositor is not initialized», «Failed to get
// 2d context for texture …»). Eso no le dice a nadie qué hacer.
//
// El crudo NO se pierde: `exportar.ts` lo deja en la consola antes de llamar acá,
// que es el canal de diagnóstico de un editor que corre entero en el navegador.
// Acá sale la frase para la persona: qué pasó y qué puede probar.
//
// Las entradas son los mensajes que el motor tira HOY (grep de `throw new Error(` en
// `export/` y `services/renderer/`), más las familias que el navegador produce por
// su cuenta (memoria, códecs). Lo que no se reconoce cae a una frase genérica que
// igual dice qué probar — nunca al inglés.
//
// Sin dependencias: lo prueba `tests/video-editor-export-mensaje.test.ts`.

const CASOS: readonly [RegExp, string][] = [
  // El entorno no puede exportar video (Safari viejo, iframes sin permisos…).
  [/OffscreenCanvas is (not supported|required)/i, 'Este navegador no puede exportar video. Usa Chrome o Edge actualizados.'],
  // El WASM todavía no arrancó, o se descargó por falta de memoria.
  [/Compositor is not initialized/i, 'El motor de video no terminó de cargar. Recarga la página e intenta de nuevo.'],
  // Un canvas o contexto que no se pudo crear: casi siempre, memoria del navegador.
  [/Failed to (get|create) .*(context|canvas)/i, 'El navegador no pudo preparar el lienzo. Cierra otras pestañas pesadas e intenta de nuevo.'],
  [/Canvas 2D no disponible/i, 'El navegador no pudo preparar el lienzo. Cierra otras pestañas pesadas e intenta de nuevo.'],
  // Un efecto o pase propio que no compila en el GLSL real del navegador.
  [/\[pases-ce\]/, 'Un efecto no se pudo renderizar. Quítalo del clip e intenta de nuevo.'],
  // El audio no se pudo codificar.
  [/AAC vac[ií]o/i, 'No se pudo codificar el audio. Prueba exportar sin audio o con otro formato.'],
  // Lo que el navegador dice por su cuenta.
  [/quota|out of memory|allocation failed|memory/i, 'Se quedó sin memoria al exportar. Cierra otras pestañas o baja la resolución.'],
  [/not supported|unsupported|codec|encoder|EncodingError|NotSupportedError/i, 'Este navegador no soporta el formato elegido. Prueba MP4 (H.264).'],
  [/abort|cancel/i, 'La exportación se interrumpió. Vuelve a intentar.'],
];

export const MENSAJE_EXPORT_GENERICO = 'Algo falló al exportar. Vuelve a intentar; si se repite, prueba otro formato o una resolución más baja.';

/** La frase para la persona. El crudo va a la consola, no acá. */
export function mensajeDeExport(error: unknown): string {
  const crudo = error instanceof Error ? error.message : String(error ?? '');
  for (const [re, frase] of CASOS) if (re.test(crudo)) return frase;
  return MENSAJE_EXPORT_GENERICO;
}
