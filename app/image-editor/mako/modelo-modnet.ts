// =============================================================================
// El modelo de «Quitar fondo» y la marca de la foto a recortar (12/11/2026), sin dependencias: lo usa ./quitar-fondo.ts y lo prueba
// tests/image-quitar-fondo.test.ts. Por qué MODNet desde Hugging Face, fijado a un commit: ./quitar-fondo.ts.
// =============================================================================

/** El commit del repo `Xenova/modnet` (huggingface.co/api/models/Xenova/modnet → `sha`, 12/11/2026). */
export const COMMIT_MODNET = 'fa2fa546052fba4c08921230a26cc69a333fca12';

/**
 * El modelo, como lo pide el motor (../_doory/editor/engine/bgRemoval/model.ts → `ModelDescriptor`). Tamaño y sha256: el `lfs` de
 * huggingface.co/api/models/Xenova/modnet/tree/<commit>/onnx; lado, media y desvío: su preprocessor_config.json; los nombres de
 * entrada y salida, su README (`model({ input: pixel_values })` → `{ output }`).
 *
 * ⚠️ EL GRANDE (fp32, 25,9 MB), no el cuantizado (6,6 MB, sha256 92e49898…). Se probó primero el cuantizado, como pidió el Cerebro,
 * en producción y con las mismas cuentas del motor (12/11/2026, docs/pruebas/image-12-11/33-modnet-cuantizado-vs-grande.jpg): con
 * Dan Martell (de frente, buena luz) los dos recortan bien, pelo incluido; con la foto de Martín (de noche, de cuerpo entero, chico en
 * el cuadro) el cuantizado le come brazos, piernas y la mitad del cuerpo, y el grande lo recorta entero. Se baja una vez y queda
 * guardado (./_doory/editor/engine/bgRemoval/modelStore.ts).
 */
export const MODNET = {
  id: 'modnet-fp32',
  name: 'MODNet (Xenova/modnet)',
  url: `https://huggingface.co/Xenova/modnet/resolve/${COMMIT_MODNET}/onnx/model.onnx`,
  bytes: 25_888_640,
  sha256: '07c308cf0fc7e6e8b2065a12ed7fc07e1de8febb7dc7839d7b7f15dd66584df9',
  input: { name: 'input', size: 512, mean: [0.5, 0.5, 0.5], std: [0.5, 0.5, 0.5], rescale: '255' },
  output: 'output',
} as const;

/** El nombre con que la réplica marca la foto a recortar al abrir (lib/carruseles/replica.ts → `FOTO_A_RECORTAR`, el mismo). */
export const FOTO_A_RECORTAR = 'Foto: la tuya · quitar el fondo';
/** El nombre que queda después, con o sin el recorte: una sola vez por foto. */
export const FOTO_RECORTADA = 'Foto: la tuya';

type Capa = { id: string; type?: string; name?: string };

export type Rect = { x: number; y: number; ancho: number; alto: number };

/**
 * El ENCUADRE de la persona ya sin fondo, para un cuadro de `cuadro.ancho × cuadro.alto` (12/11/2026). El editor, al reemplazar la
 * foto, la centra cubriendo el cuadro (`coverFrame`): con la foto entera, la persona sin fondo quedaba chica en el medio (Martín, de
 * cuerpo entero, en una foto de 1080 × 1440). Se recorta desde la cabeza: el ancho de la persona con un poco de aire, el alto que
 * pide el cuadro, empezando un poco arriba de su cabeza. Puro: `persona` es la caja de lo que no es transparente.
 */
export function encuadreDeLaPersona(persona: Rect, imagen: { ancho: number; alto: number }, cuadro: { ancho: number; alto: number }): Rect {
  const proporcion = cuadro.ancho / cuadro.alto;
  const aireArriba = Math.round(persona.alto * 0.06);
  let ancho = Math.min(imagen.ancho, Math.round(persona.ancho * 1.15));
  let alto = Math.round(ancho / proporcion);
  // Una persona chica y ancha (brazos abiertos) en un cuadro alto: manda el alto disponible, no el ancho.
  const altoDisponible = imagen.alto - Math.max(0, persona.y - aireArriba);
  if (alto > altoDisponible) { alto = altoDisponible; ancho = Math.min(imagen.ancho, Math.round(alto * proporcion)); }
  const cx = persona.x + persona.ancho / 2;
  const x = Math.round(Math.min(imagen.ancho - ancho, Math.max(0, cx - ancho / 2)));
  const y = Math.round(Math.min(imagen.alto - alto, Math.max(0, persona.y - aireArriba)));
  return { x, y, ancho, alto };
}

/** Las fotos marcadas para recortar, con su página. */
export function fotosARecortar(doc: { pages: ReadonlyArray<{ id: string; objects: ReadonlyArray<Capa> }> }): Array<{ pagina: string; id: string }> {
  return doc.pages.flatMap((p) => p.objects.filter((o) => o.type === 'image' && o.name === FOTO_A_RECORTAR).map((o) => ({ pagina: p.id, id: o.id })));
}
