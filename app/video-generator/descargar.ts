// =============================================================================
// Bajar un video con el nombre que le corresponde
// =============================================================================
// ── Por qué existe este módulo y no un `<a download>` ──────────────────────
// `download` sólo manda si el archivo es del MISMO origen. Los clips viven en
// Supabase Storage —otro origen— y ahí el atributo NO da error: simplemente se
// ignora, y el archivo se guarda con el nombre feo del path (`toma-1-<uuid>.mp4`),
// que es justo lo que esto viene a evitar.
//
// La salida es traerlo con `fetch` y convertirlo en un blob: un blob es del
// propio origen, y ahí el nombre sí manda. Comprobado antes de escribirlo: el
// bucket contesta `access-control-allow-origin: *`.
//
// ── Por qué es un módulo y no una función suelta ───────────────────────────
// Vivía dentro de `WizardAnuncio.tsx`, sin exportar. Resultado: la pantalla de
// anuncios TERMINADOS —el único lugar donde uno vuelve a buscar lo de días
// anteriores— no tenía ningún botón para descargar, porque el que sabía hacerlo
// estaba encerrado en otro archivo. Mirar y no poder llevárselo es la mitad del
// trabajo.

/** Trae el video y lo guarda con `nombre`. Lanza si no se pudo. */
export async function descargarComo(url: string, nombre: string): Promise<void> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`no se pudo descargar (${r.status})`);
  const blob = await r.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // ⚠️ Se revoca TARDE, no en la línea siguiente: revocar el blob antes de que el
  // navegador termine de escribirlo cancela la descarga, y el síntoma es un
  // archivo de 0 bytes o directamente ninguno.
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}
