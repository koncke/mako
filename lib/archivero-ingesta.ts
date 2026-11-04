// =============================================================================
// archivero-ingesta — leer un documento y sumarlo a El Archivero (3/11/2026, ticket #44)
// =============================================================================
// Vivía INLINE en app/api/onboarding/archivero/route.ts y por eso ningún chat podía sumar un documento: el área `negocio`
// de la API lo anotó el 16/09/2026 («primero hay que extraerla a lib/») y un cliente lo pidió el 2/11 (#44: pegó su
// documento maestro en el chat del Second Brain y MaKo contestó «no tengo una herramienta que escriba ahí»).
//
// Dos usos, la MISMA ingesta:
//   · la pantalla del Archivero (la ruta): `leerArchivo` + `extraerParaArchivero` + `sumarAlPanorama`, sin cambiar lo que
//     hacía (la ruta sigue armando sus respuestas y su binario);
//   · la API (`sumar_documento_second_brain`, lib/api-mako/areas/negocio.*): `sumarTextoAlArchivero`, un TEXTO que ya
//     viene leído (pegado o adjuntado en un chat).
//
// ⛔ D6b: quien extrae con IA corre adentro de `conSuIADelNegocio` (lo hace quien llama). Un negocio que sólo tiene SU
// Claude en la computadora no tiene con qué extraer en el servidor (`conQueSeExtrae` → 'modelo'): ahí lo extrae el modelo
// del turno, que ES su IA, y la persona lo ve antes de que se guarde.
// =============================================================================

import 'server-only';
import { extraerDeArchivo, generarPanorama } from './onboarding';
import { leerDocumentoIA, docsIADisponible } from './ai-cheap';
import { flatFields, insertFile, subirBinario, borrarBinario, listFiles, buildEstado, getPanorama, setPanorama } from './archivero';
import { idDeContenido, documentoYaArchivado, camposDelModelo } from './archivero-registro';
import { permisoDeLaClaveDelNegocio } from './anthropic';
import { PROVS_SU_IA } from './solo-su-ia';
import { conSuIADelNegocio } from './ia-del-negocio';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
export const MAX_ARCHIVO_BYTES = 25 * 1024 * 1024;

// ⚠️ ACÁ HABÍA TRES CORTES `if (!(await docsIADisponible()))` que devolvían «Carga tu API key de
// Gemini» ANTES de llamar a la IA, y con eso la red de la plataforma de este archivo no corría nunca
// para un cliente sin keys. Desde el 15/10/2026 un cliente nuevo no trae una API (el paso de la IA
// del wizard es opcional) y El Archivero es bloqueante: con los cortes puestos, se quedaba trabado
// acá. Se sacaron el 16/10/2026; lo fija tests/onboarding-sin-api.test.ts.
//
// Así que "sinIA" ya no significa «había key y falló»: puede ser la red de la plataforma, sin keys
// propias. El mensaje lo distingue, y a quien no tiene IA propia le dice cómo dejar de depender de la
// red (sin acusarlo: no hizo nada mal). Si extraerDeArchivo pudo interpretar por qué (cuota, key
// vencida, timeout), eso va primero.
export const mensajeSinIA = async (nombre: string, motivo?: string): Promise<string> => {
  if (motivo) return `No pude analizar "${nombre}": ${motivo}`;
  if (await docsIADisponible().catch(() => false)) return `Tu IA está conectada pero no pudo analizar "${nombre}" ahora mismo. Prueba de nuevo en un momento.`;
  return `No pude analizar "${nombre}" ahora mismo. Prueba de nuevo en un momento.`;
};
const LEER_DOC = 'Transcribe TODO el texto legible de este documento, tal cual, sin resumir ni omitir nada. Si es una imagen o captura, describe también lo que se ve. Devuelve solo el texto.';

export async function leerArchivo(file: File): Promise<{ texto: string; warning?: string }> {
  const name = file.name.toLowerCase();
  if (file.size > MAX_ARCHIVO_BYTES) return { texto: '', warning: `"${file.name}" es muy grande (más de 25 MB), lo salté.` };
  const buf = Buffer.from(await file.arrayBuffer());
  if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.markdown') || (file.type || '').startsWith('text/')) {
    return { texto: buf.toString('utf8') };
  }
  if (name.endsWith('.docx')) {
    try { const mammoth = (await import('mammoth')).default; return { texto: (await mammoth.extractRawText({ buffer: buf })).value }; }
    catch (e) { return { texto: '', warning: `No pude leer "${file.name}" (.docx): ${msg(e)}` }; }
  }
  const esPdf = name.endsWith('.pdf') || (file.type || '') === 'application/pdf';
  const esImg = /\.(png|jpe?g|webp|gif)$/.test(name) || (file.type || '').startsWith('image/');
  if (esPdf) {
    // 1) Capa de texto (la mayoría de los PDFs la tienen): rápida, confiable y sin
    //    gastar visión. Antes TODO PDF iba por visión y un PDF de texto volvía vacío.
    try {
      // pdfjs (dentro de unpdf) usa Math.sumPrecise, que no existe en Node <22.
      const M = Math as unknown as { sumPrecise?: (a: number[]) => number };
      if (typeof M.sumPrecise !== 'function') M.sumPrecise = (a) => a.reduce((x, y) => x + y, 0);
      const { extractText, getDocumentProxy } = await import('unpdf');
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const { text } = await extractText(pdf, { mergePages: true });
      if (text && text.trim().length > 80) return { texto: text };
    } catch { /* sin capa de texto → probamos visión (PDF escaneado) */ }
    // 2) PDF escaneado (imágenes) → visión.
    try {
      const dataUrl = `data:application/pdf;base64,${buf.toString('base64')}`;
      const { text } = await leerDocumentoIA({ dataUrl, isPdf: true, nombreArchivo: file.name, prompt: LEER_DOC, feature: 'El Archivero', motivo: `Leer "${file.name}"`, redDePlataforma: true });
      return { texto: text };
    } catch (e) { return { texto: '', warning: `No pude leer "${file.name}": ${msg(e)}` }; }
  }
  if (esImg) {
    try {
      const dataUrl = `data:${file.type || 'image/jpeg'};base64,${buf.toString('base64')}`;
      const { text } = await leerDocumentoIA({ dataUrl, isPdf: false, nombreArchivo: file.name, prompt: LEER_DOC, feature: 'El Archivero', motivo: `Leer "${file.name}"`, redDePlataforma: true });
      return { texto: text };
    } catch (e) { return { texto: '', warning: `No pude leer "${file.name}": ${msg(e)}` }; }
  }
  return { texto: '', warning: `"${file.name}": formato no soportado (sube .txt, .md, .docx, .pdf o una imagen).` };
}

/** Los campos del perfil como los pide la extracción («Grupo — Rótulo»). */
export async function camposDeExtraccion(): Promise<Array<{ key: string; label: string }>> {
  return (await flatFields()).map((f) => ({ key: f.key, label: `${f.grupo} — ${f.label}` }));
}

/** La extracción de El Archivero sobre un texto ya leído: los campos del perfil y el razonamiento, o el aviso de por qué no. */
export async function extraerParaArchivero(
  texto: string, nombre: string, fields?: Array<{ key: string; label: string }>,
): Promise<{ ok: true; campos: Record<string, string>; razonamiento: string } | { ok: false; warning: string }> {
  const { campos, razonamiento, sinIA, motivoSinIA } = await extraerDeArchivo(texto, fields ?? await camposDeExtraccion(), 24000);
  if (sinIA) return { ok: false, warning: await mensajeSinIA(nombre, motivoSinIA) };
  return { ok: true, campos, razonamiento };
}

/** Panorama libre: lo que la IA entendió de TODO, con los textos nuevos + el panorama previo. Best-effort, no bloquea. */
export async function sumarAlPanorama(textos: string[]): Promise<void> {
  try {
    const pano = await generarPanorama(textos, await getPanorama());
    if (pano) await setPanorama(pano);
  } catch (e) { console.error('[archivero] panorama (no fatal):', msg(e)); }
}

/**
 * ¿Hay con qué pasar un archivo a El Archivero sin la cascada barata? Su clave de Claude (la puerta 2 del veto), su OpenAI
 * o su Gemini (`PROVS_SU_IA`, IA16). Sólo se pregunta con «sólo su IA» (D6b): ahí, sin ninguna, El Archivero no corre y se
 * dice.
 * `pausa`: tiene su clave de Claude pero la plataforma la pausó y no hay OpenAI: se dice eso, no que falta la clave.
 * (Vivía en lib/mako-turno-app.ts; se mudó acá el 3/11/2026 para que la API pregunte lo mismo.)
 */
export async function puedeArchivarConSuIA(): Promise<'si' | 'no' | 'pausa'> {
  try {
    const claude = await permisoDeLaClaveDelNegocio('El Archivero');
    if (claude && 'permiso' in claude) return 'si';
    const { provsDe } = await import('./ai-cheap');
    for (const p of PROVS_SU_IA) if ((await provsDe(p as never)).length > 0) return 'si';
    return claude && 'pausa' in claude ? 'pausa' : 'no';
  } catch {
    return 'no';
  }
}

/**
 * Quién saca los campos de un documento de ESTE negocio: el servidor (la red de la plataforma, o su clave) o el MODELO del
 * turno (un negocio que sólo tiene su Claude en la computadora: el servidor no tiene con qué, y mandarlo a la red gratis es
 * lo que D6b prohíbe). Corre adentro de runWithWorkspace(ws).
 */
export async function conQueSeExtrae(ws: number): Promise<'servidor' | 'modelo'> {
  return conSuIADelNegocio(ws, async (negocio) => (!negocio.suIA || (await puedeArchivarConSuIA()) === 'si' ? 'servidor' : 'modelo'));
}

export type SumaDeTexto =
  | { ok: true; id: string; nombre: string; aportadas: number; yaEstaba?: true }
  | { ok: false; motivo: string; falla?: true };

/**
 * Suma a El Archivero un documento que ya viene como TEXTO (pegado o adjuntado en un chat), con la MISMA ingesta que su
 * pantalla: la fila con sus campos, el binario (el texto, para descargarlo), el panorama y el perfil recalculado (lo
 * editado a mano gana, como siempre). El id sale del CONTENIDO: el mismo texto dos veces —o el que el chat ya archivó
 * solo al pegarlo (#884)— no se duplica.
 *
 * `extraido`: los campos que sacó el modelo del turno cuando el servidor no tiene con qué (`conQueSeExtrae`); se filtran
 * contra el esquema del perfil. Sin `extraido`, extrae el servidor, y quien llama lo corre adentro de `conSuIADelNegocio`.
 * NUNCA TIRA: todo fallo vuelve como `{ ok: false, motivo }`. Corre adentro de runWithWorkspace(ws).
 */
export async function sumarTextoAlArchivero(ws: number, d: {
  nombre: string; texto: string;
  extraido?: { campos: Record<string, string>; razonamiento: string };
}): Promise<SumaDeTexto> {
  const texto = d.texto.trim();
  const nombre = d.nombre.trim().slice(0, 200) || 'documento';
  if (!texto) return { ok: false, motivo: 'el documento llegó vacío' };
  const contenido = new TextEncoder().encode(texto);
  const id = idDeContenido(ws, contenido);
  try {
    const ya = documentoYaArchivado(await listFiles(), { id, nombre, tamano: contenido.byteLength });
    if (ya) return { ok: true, id: ya, nombre, aportadas: 0, yaEstaba: true };

    let campos: Record<string, string>;
    let razonamiento: string;
    if (d.extraido) {
      campos = camposDelModelo(d.extraido.campos, new Set((await flatFields()).map((f) => f.key)));
      razonamiento = d.extraido.razonamiento.trim().slice(0, 2000);
    } else {
      const ex = await extraerParaArchivero(texto, nombre);
      if (!ex.ok) return { ok: false, motivo: ex.warning };
      ({ campos, razonamiento } = ex);
    }

    const path = await subirBinario(ws, id, Buffer.from(contenido), 'text/plain; charset=utf-8');
    try {
      await insertFile(ws, { id, nombre, mime: 'text/plain', tamano: contenido.byteLength, storage_path: path, razonamiento, campos, origen: 'archivero' });
    } catch (e) {
      await borrarBinario(path);
      throw e;
    }
    // El panorama es una segunda llamada a la IA: sólo cuando extrae el servidor (el modelo ya dejó su razonamiento).
    if (!d.extraido) await sumarAlPanorama([texto]);
    await buildEstado(true);
    return { ok: true, id, nombre, aportadas: Object.keys(campos).length };
  } catch (e) {
    console.error(`[archivero:texto] «${nombre}»:`, msg(e));
    return { ok: false, motivo: 'algo falló de nuestro lado al guardarlo', falla: true };
  }
}
