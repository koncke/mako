// =============================================================================
// POST /api/chat-agent/secuencias/archivo — un archivo o una imagen → el texto para pedirle el flujo a MaKo
// =============================================================================
// El «+» de la caja «¿Qué vas a crear hoy?» del modal «Nueva automatización» (decimoquinta tanda, 12/10/2026, punto 7).
// Martín, textual: «en el botón de "+" en esa sección, no tiene sentido las opciones de lienzo en blanco y plantilla, si
// para eso ya tenemos eso abajo, ahí se debería poder cargar archivos o imagenes para que la IA lo interprete y cree
// flujo a raiz de eso». La persona sube un documento o una captura (el flujo de otra herramienta, un guion, un proceso
// escrito) y la caja recibe su TEXTO; al enviar, va al pedido de MaKo (`pedidoConArchivo`, app/automations/CrearConIA.tsx)
// y MaKo arma el flujo como con cualquier pedido escrito.
//
// Lo lee `archivoATexto` (lib/archivo-a-texto.ts), el lector de la casa (el mismo del importador del plan y de
// «Importar» del Landing Generator): una sola lista de formatos (lib/formatos-archivo.ts) y un solo camino por formato.
// Una IMAGEN (o un PDF escaneado) va por VISIÓN (`leerDocumentoIA`), que transcribe lo legible y describe lo que se ve;
// el gasto se anota a «Crear una automatización con IA» (`chatbot-crear-ia`).
//
// ⚠️ MULTIPART, NUNCA UNA SERVER ACTION: una server action topea el cuerpo en 1 MB en este proyecto (AGENTS.md, «Tres
// topes del entorno que no dan error»). Y el tope de acá va por DEBAJO del proxy (~18 MB).
//
// Sólo el ADMIN del negocio (como crear con MaKo, app/api/chat-agent/secuencias/ia/route.ts). No guarda nada.
//
//   multipart { file } → { ok: true, texto, nombre } | { ok: false, error }
// =============================================================================

import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { archivoATexto } from '@/lib/archivo-a-texto';

export const dynamic = 'force-dynamic';
// Una imagen o un PDF escaneado se leen con IA (visión): pueden tardar.
export const maxDuration = 120;

/** Tope de subida. Por debajo de los ~18 MB del proxy, que cortaría antes con un error ajeno. */
const TOPE_BYTES = 15 * 1024 * 1024;
/** Lo que vuelve a la caja. El pedido de MaKo se recorta después a su tope (`pedidoConArchivo`); esto es un techo. */
const TOPE_TEXTO = 20_000;

const falla = (status: number, error: string) => Response.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || rol !== 'admin') return falla(403, 'Solo el administrador del workspace puede crear automatizaciones.');
  if (!(req.headers.get('content-type') ?? '').includes('multipart/form-data')) return falla(400, 'Falta el archivo.');
  let file: File | null = null;
  try {
    const f = (await req.formData()).get('file');
    file = f instanceof File ? f : null;
  } catch {
    return falla(400, 'No se pudo leer el archivo.');
  }
  if (!file || !file.size) return falla(400, 'Falta el archivo.');
  if (file.size > TOPE_BYTES) return falla(413, 'El archivo pesa más de 15 MB.');
  try {
    const lectura = await archivoATexto(file, { feature: 'chatbot-crear-ia', motivo: `Automations: leer «${file.name}» para armar el flujo` });
    const texto = lectura.texto.replace(/\r\n?/g, '\n').trim();
    // El lector ya escribe por qué (formato, tamaño, sin texto): se le pasa tal cual.
    if (!texto) return falla(422, lectura.warning || 'No encontré texto en ese archivo.');
    return Response.json({ ok: true, texto: texto.slice(0, TOPE_TEXTO), nombre: file.name.slice(0, 160) });
  } catch (e) {
    console.error('[api:secuencias/archivo]', e instanceof Error ? e.message : e);
    return falla(500, 'No se pudo leer el archivo.');
  }
}
