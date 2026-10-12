// =============================================================================
// /api/graficos/imagen — subir la imagen de un elemento del Dashboard (punto 18: «insertar imagen»)
// =============================================================================
// POST multipart con `file` → { ok: true, url } (la URL pública, https, que el elemento guarda en `url`).
//
// La puerta es LA MISMA que la de /api/graficos (y la de la página): admin del workspace y la tab en su
// capa. Sin eso, cualquiera con sesión subía archivos a un bucket público con la cuenta del cliente.
//
// ⚠️ UN ROUTE HANDLER MULTIPART Y NO UNA SERVER ACTION: una action topea el cuerpo en 1 MB (este proyecto
//    no define `serverActions.bodySizeLimit`), así que una foto de celular fallaría siempre (AGENTS.md,
//    «Tres topes del entorno que no dan error»).
// ⚠️ EL TOPE ES 4 MB Y NO LOS 6 DE /api/portadas: Vercel corta el cuerpo de una función en 4,5 MB
//    (documentado por Vercel; NO lo medí acá) y contesta un 413 con HTML, sin pasar por este código.
//    Un tope nuestro por encima del suyo no protege: promete. Con 4 MB más el sobre del multipart, el
//    que corta es este archivo, con un mensaje que se puede leer. El mismo número vive en
//    `MAX_IMAGEN` de app/dashboard/Elemento.tsx (la pantalla avisa ANTES de subir) y
//    tests/graficos-elementos.test.ts falla si los dos se separan: este archivo no puede importar de
//    un 'use client' (la frontera de AGENTS.md), así que el número se repite y el test los ata.
// ⚠️ EL BUCKET ES `portadas`, que ya existe y es PÚBLICO (lo usan las portadas del plan y de los
//    proyectos). Un `<img>` del Dashboard lo tiene que poder pintar cualquier navegador sin firma. La
//    carpeta es por WORKSPACE (`ws<N>/dashboard/…`), igual que las portadas: la imagen es del informe
//    del cliente, no de quien la subió. ⚠️ El reset del cliente de prueba (lib/reset-workspace.ts) no
//    barre `portadas` (su lista de buckets no lo nombra y además barre por `<N>/`, no por `ws<N>/`):
//    estas imágenes sobreviven a un reset, igual que las portadas. No es de esta ruta arreglarlo.

import { getSupabaseServer } from '@/lib/supabase';
import { getCapaActual, getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BUCKET = 'portadas';
const MAX = 4 * 1024 * 1024; // 4 MB — el mismo número que MAX_IMAGEN de app/dashboard/Elemento.tsx

// Sólo formatos raster INERTES. NUNCA image/svg+xml: un SVG es un documento activo (script, onload) y el
// bucket es público, así que sería servir JS de un tercero bajo nuestro dominio. Mismo criterio que
// /api/perfil/avatar y /api/portadas.
const EXT_DE: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
};

/**
 * El tipo REAL por magic bytes: `file.type` lo pone el navegador, así que no decide nada.
 * ⚠️ Es la TERCERA copia (las otras dos, en /api/perfil/avatar y /api/portadas): un `route.ts` no puede
 * exportar otra cosa que sus handlers, así que no se puede importar de ahí. Mudarla a un módulo de lib
 * (sin `server-only`, para que tenga test) es una tarea aparte: va en la cosecha de esta corrida, en
 * docs/hallazgos-graficos.md.
 */
function sniffImagen(buf: Buffer): keyof typeof EXT_DE | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'image/gif';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

const no = (status: number, error: string) => Response.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  try {
    const rol = await getRolWsEfectivo();
    if (rol == null) return no(401, 'no autenticado');
    if (rol !== 'admin') return no(403, 'Sólo el admin de la cuenta');
    if (!tabEnCapa('graphics', await getCapaActual())) return no(404, 'No existe');
    const ws = await getWorkspaceActual();
    if (ws == null) return no(401, 'no autenticado');

    // Antes de leer el cuerpo entero: un `content-length` que ya pasa el tope no se bufferea. El margen
    // es el sobre del multipart (los bordes y los encabezados de la parte), no un permiso para más.
    const largo = Number(req.headers.get('content-length') ?? 0);
    if (Number.isFinite(largo) && largo > MAX + 64 * 1024) return no(413, 'La imagen pasa de 4 MB');

    let form: FormData;
    try { form = await req.formData(); } catch { return no(400, 'No llegó ningún archivo'); }
    const file = form.get('file');
    if (!(file instanceof File)) return no(400, 'No llegó ningún archivo');
    if (file.size > MAX) return no(413, 'La imagen pasa de 4 MB');

    const buf = Buffer.from(await file.arrayBuffer());
    const tipo = sniffImagen(buf);
    if (!tipo) return no(400, 'Usa JPG, PNG, WEBP o GIF');

    const supabase = getSupabaseServer();
    // El bucket ya existe en producción; esto es la red para un entorno nuevo, igual que /api/portadas.
    try { await supabase.storage.createBucket(BUCKET, { public: true }); } catch { /* ya existe */ }

    const path = `ws${ws}/dashboard/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${EXT_DE[tipo]}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, buf, { contentType: tipo, upsert: false });
    if (error) return no(500, error.message);

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return Response.json({ ok: true, url: data.publicUrl });
  } catch (e) {
    return no(500, e instanceof Error ? e.message : String(e));
  }
}
