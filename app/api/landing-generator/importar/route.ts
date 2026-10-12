// =============================================================================
// POST /api/landing-generator/importar — un archivo → el texto para el esquema
// =============================================================================
// «Importar» de la pantalla de crear (Gamma: «Importar archivo o URL»): la persona
// sube un documento (PDF, Word, PowerPoint, una planilla, una imagen, un audio…) y
// la pantalla recibe su TEXTO para mandarlo después a `esquema` en modo «Pegar
// texto», donde los `---` y el modo de texto (Generar · Condensar · Conservar)
// deciden qué se hace con él. La URL de una landing NO pasa por acá: va directo a
// `esquema` con `modo: 'importar'`.
//
// Lo lee `archivoATexto` (lib/archivo-a-texto.ts), el mismo lector del importador
// del plan: una sola lista de formatos (lib/formatos-archivo.ts) y un solo camino
// por formato.
//
// ⚠️ MULTIPART, NUNCA UNA SERVER ACTION: una server action topea el cuerpo en 1 MB
// en este proyecto (AGENTS.md, «Tres topes del entorno que no dan error»), o sea
// cualquier PDF de verdad. Y el tope de acá va por DEBAJO del proxy (~18 MB), que
// es la capa de abajo: un número nuestro por encima del suyo no protege, promete.
//
//   multipart { file } → { ok: true, texto, titulo } | { ok: false, error }
// =============================================================================

import { getCapaActual, getRolWsEfectivo } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { archivoATexto } from '@/lib/archivo-a-texto';

export const dynamic = 'force-dynamic';
// Un PDF escaneado o un audio se leen con IA (visión / transcripción): pueden tardar.
export const maxDuration = 300;

/** Tope de subida. Por debajo de los ~18 MB del proxy, que cortaría antes con un error ajeno. */
const TOPE_IMPORTAR_BYTES = 15 * 1024 * 1024;
/** Lo que la pantalla le puede mandar después a `esquema` (MAX_TEXTO_ENTRADA en ia-reglas.ts). */
const TOPE_TEXTO = 60_000;

const falla = (status: number, error: string) => Response.json({ ok: false, error }, { status });

/** El nombre del archivo sin la extensión, como título de partida. */
function tituloDe(nombre: string): string {
  return nombre.replace(/\.[a-z0-9]{1,6}$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
}

export async function POST(req: Request) {
  const rol = await getRolWsEfectivo();
  if (rol == null) return falla(401, 'no autenticado');
  if (rol !== 'admin') return falla(403, 'Sólo el admin de la cuenta');
  if (!tabEnCapa('landing-writer', await getCapaActual())) return falla(404, 'No existe');

  if (!(req.headers.get('content-type') ?? '').includes('multipart/form-data')) return falla(400, 'Falta el archivo.');
  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get('file');
    file = f instanceof File ? f : null;
  } catch {
    return falla(400, 'No se pudo leer el archivo.');
  }
  if (!file || !file.size) return falla(400, 'Falta el archivo.');
  if (file.size > TOPE_IMPORTAR_BYTES) return falla(413, 'El archivo pesa más de 15 MB.');

  try {
    const lectura = await archivoATexto(file);
    const texto = lectura.texto.replace(/\r\n?/g, '\n').trim();
    if (!texto) {
      // El lector ya escribe por qué (formato, tamaño, sin voz): se le pasa tal cual.
      return falla(422, lectura.warning || 'No encontré texto en ese archivo.');
    }
    const recortado = texto.length > TOPE_TEXTO;
    if (recortado) console.warn(`[landing-generator/importar] «${file.name}»: ${texto.length} caracteres, se mandan ${TOPE_TEXTO}`);
    return Response.json({ ok: true, texto: texto.slice(0, TOPE_TEXTO), titulo: tituloDe(file.name) });
  } catch (err) {
    console.error('[landing-generator/importar]', err instanceof Error ? err.message : err);
    return falla(500, 'No se pudo leer el archivo.');
  }
}
