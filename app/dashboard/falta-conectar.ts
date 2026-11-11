// =============================================================================
// falta-conectar — lo que una hoja con diseño no puede leer porque FALTA CONECTAR algo (11/11/2026)
// =============================================================================
// Martín, 11/11, sobre la prueba del día anterior: «Una hoja vacía o con "Sin datos" en producción también es una falla».
// En el ws 3 (sin grabador ni Meta), Closing, Anuncio ganador o Hooks eran una pared de tarjetas que decían «Todavía no hay
// datos en este período» o «—». La causa real no aparecía en ningún lado: el lector SÍ la sabe («Conecta tu grabador de
// reuniones (Fathom, tl;dv, Fireflies, Zoom…) en Integraciones», `SinConexionError`, lib/graficos-agregar.ts) y la grilla
// de antes la ponía en cada tarjeta, pero una hoja con diseño dibuja su propio vacío y se la tragaba.
//
// La hoja dice ESE mismo texto una vez, arriba, en la franja de avisos (la de «Conecta tu Claude» de Closing). No es un
// texto nuevo: es el del lector, deduplicado. El teléfono hace lo mismo con `faltaConectar` (app/m/dashboard/modelo.ts).
//
// Puro: lo usa app/dashboard/EditorInforme.tsx y lo fija tests/dashboard-falta-conectar.test.ts.

/** Lo que el editor guarda de cada gráfico: el error y si es «falta conectar». */
export type EstadoConConexion = { error?: string; sinConexion?: true } | undefined;

/**
 * Los textos de «falta conectar» de los gráficos `ids`, sin repetir y en el orden en que aparecen. Vacío si ninguno falta.
 * Tope de dos: más avisos en la franja ya no se leen.
 */
export function faltaConectarDeHoja(ids: readonly string[], datos: Readonly<Record<string, EstadoConConexion>>): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const d = datos[id];
    if (d?.sinConexion && d.error && !out.includes(d.error)) out.push(d.error);
    if (out.length === 2) break;
  }
  return out;
}
