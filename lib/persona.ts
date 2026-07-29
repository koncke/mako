// =============================================================================
// persona — la CARA de marca: fotos + descripción para generar imágenes con IA
// =============================================================================
// Como lo tiene la competencia (Claudio): una persona/vocero con VARIAS fotos y una
// DESCRIPCIÓN (apariencia, estilo, tono). No es solo la foto: la descripción es lo que
// después le sirve a la IA para generar las imágenes de los creativos con esa persona.
//
// Las fotos van al bucket privado 'archivero' bajo el prefijo `${ws}/persona/` (reusa
// la infra existente; el scoping es por path + runWithWorkspace). La metadata + la
// descripción viven en app_settings (mako.persona). Pocas fotos → sin tabla.
// =============================================================================

import 'server-only';
import { randomUUID } from 'node:crypto';
import { getSupabaseServer } from './supabase';
import { getWorkspaceActual, OWNER_WS } from './workspace';
import { getSetting, setSetting } from './settings';
import { leerDocumentoIA } from './ai-cheap';

const BUCKET = 'archivero';
const KEY = 'mako.persona';

export type PersonaFoto = { id: string; nombre: string; mime: string; path: string };
export type PersonaData = { descripcion: string; fotos: PersonaFoto[] };
export type PersonaFotoPub = { id: string; nombre: string; mime: string; url: string | null };

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

async function wsActual(): Promise<number> {
  return (await getWorkspaceActual()) ?? OWNER_WS;
}

export async function getPersona(): Promise<PersonaData> {
  const raw = await getSetting(KEY);
  if (!raw) return { descripcion: '', fotos: [] };
  try {
    const p = JSON.parse(raw) as PersonaData;
    return { descripcion: str(p.descripcion), fotos: Array.isArray(p.fotos) ? p.fotos.filter((f) => f && f.path) : [] };
  } catch { return { descripcion: '', fotos: [] }; }
}
async function setPersona(p: PersonaData): Promise<void> {
  await setSetting(KEY, JSON.stringify(p));
}

export async function setPersonaDescripcion(texto: string): Promise<void> {
  const p = await getPersona();
  await setPersona({ ...p, descripcion: str(texto) });
}

/** Sube una foto, la registra y devuelve la metadata. */
export async function addPersonaFoto(buf: Buffer, nombre: string, mime: string): Promise<PersonaFoto> {
  const ws = await wsActual();
  const id = randomUUID();
  const path = `${ws}/persona/${id}`;
  const { error } = await getSupabaseServer().storage.from(BUCKET).upload(path, buf, { contentType: mime || 'image/jpeg', upsert: true });
  if (error) throw new Error(error.message);
  const foto: PersonaFoto = { id, nombre: str(nombre) || 'foto', mime: mime || 'image/jpeg', path };
  const p = await getPersona();
  await setPersona({ ...p, fotos: [...p.fotos, foto] });
  return foto;
}

export async function deletePersonaFoto(id: string): Promise<void> {
  const p = await getPersona();
  const foto = p.fotos.find((f) => f.id === id);
  if (foto) await getSupabaseServer().storage.from(BUCKET).remove([foto.path]).catch(() => {});
  await setPersona({ ...p, fotos: p.fotos.filter((f) => f.id !== id) });
}

/** URL firmada INLINE para ver una foto (300s). */
async function urlFoto(path: string): Promise<string | null> {
  const { data } = await getSupabaseServer().storage.from(BUCKET).createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

/** Estado público: descripción + fotos con su URL firmada. */
export async function personaEstado(): Promise<{ descripcion: string; fotos: PersonaFotoPub[] }> {
  const p = await getPersona();
  const fotos = await Promise.all(p.fotos.map(async (f) => ({ id: f.id, nombre: f.nombre, mime: f.mime, url: await urlFoto(f.path) })));
  return { descripcion: p.descripcion, fotos };
}

// ── MaKo describe a la persona a partir de sus fotos (para la IA generativa) ──
// La competencia (100ads) guarda una descripción física MUY detallada de la cara de
// marca: eso es lo que la IA de imágenes necesita para recrearla fiel en cada creativo.
const PERSONA_DESC_PROMPT = `Sos un director de arte creando la FICHA de una persona para que una IA generativa de imágenes la recree con fidelidad en anuncios. Mirá la foto y describí a la persona de forma DETALLADA y objetiva, como una descripción de personaje para prompt de imagen:
- Género aparente y rango de edad.
- Rostro: forma, tono de piel, ojos (color/forma), cejas, nariz, boca, pómulos, mentón; vello facial (barba/bigote, largo) y lentes si tiene.
- Pelo: color, largo, textura, peinado, línea de nacimiento/entradas o calvicie si aplica.
- Complexión y contextura física.
- Vestimenta y estilo que se ve en la foto (prendas, colores, accesorios).
- Actitud / vibra que transmite (cercano, serio, enérgico…).
Sé concreto y visual, como para un prompt. NO inventes nombre ni datos que no se vean. Español neutro, de "tú". Devolvé SOLO el texto de la descripción (4-7 frases densas, sin encabezados ni viñetas).`;

/** Analiza las fotos con visión y genera una descripción física detallada de la persona. */
export async function generarDescripcionPersona(): Promise<{ ok: true; descripcion: string } | { ok: false; error: string }> {
  try {
    const p = await getPersona();
    if (p.fotos.length === 0) return { ok: false, error: 'Subí al menos una foto primero.' };
    // Probamos hasta 4 fotos hasta que una dé una descripción usable (la mejor toma).
    for (const f of p.fotos.slice(0, 4)) {
      try {
        const { data } = await getSupabaseServer().storage.from(BUCKET).download(f.path);
        if (!data) continue;
        const buf = Buffer.from(await data.arrayBuffer());
        const dataUrl = `data:${f.mime || 'image/jpeg'};base64,${buf.toString('base64')}`;
        const { text } = await leerDocumentoIA({ dataUrl, isPdf: false, nombreArchivo: f.nombre, prompt: PERSONA_DESC_PROMPT, feature: 'persona', motivo: 'Describir la cara de marca' });
        if (text.trim().length > 60) {
          const descripcion = text.trim();
          await setPersona({ ...(await getPersona()), descripcion });
          return { ok: true, descripcion };
        }
      } catch { /* probamos la siguiente foto */ }
    }
    return { ok: false, error: 'No pude analizar las fotos. Reintentá, o conectá tu API key de Gemini (gratis) para el análisis con IA.' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
