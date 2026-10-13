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

/**
 * La cara de marca, lista para meter en un prompt. `''` si no hay nada cargado.
 *
 * ⚠️ OJO CON EL NOMBRE, que ya costó caro. En este repo conviven DOS «personas»:
 *
 *   · `getActivePersona()` (lib/mako-prompts.ts) → la VOZ de MaKo. Ya iba en todos
 *     los prompts.
 *   · `getPersona()` (este módulo) → la CARA DE MARCA del cliente: sus fotos y la
 *     descripción física que MaKo redacta a partir de ellas.
 *
 * Como la primera estaba en el contexto, parecía que la persona ya estaba cubierta.
 * EL CASO (2026-08-24): un cliente probó el WhatsApp de MaKo con «tenés unas
 * imágenes cargadas de mí, decime cómo soy físicamente» y no obtuvo respuesta.
 * Tenía 5 fotos y 1.166 caracteres describiéndolo —ojos, cabello, complexión,
 * hasta una curita en el puente nasal— cargados en su propio onboarding.
 *
 * Y el hallazgo de fondo, más grande que WhatsApp: hasta este cambio `getPersona()`
 * tenía DOS consumidores, el grafo del cerebro y su propia ruta de onboarding.
 * **Ninguna IA la leía.** La tab dice «subí fotos de la persona que aparece en tus
 * creativos» y ningún generador de creativos la usaba: era un dato que se pedía,
 * se procesaba con IA, y moría en la base.
 */
export async function resumenCaraDeMarca(): Promise<string> {
  const p = await getPersona().catch(() => null);
  const desc = str(p?.descripcion);
  if (!desc && !p?.fotos.length) return '';
  const fotos = p?.fotos.length ?? 0;
  // Se dice de QUIÉN es esta descripción sin afirmar de más: es la cara de los
  // creativos del negocio, que MUY seguido es el dueño pero no necesariamente.
  // Afirmar «así es quien te habla» sería inventar un dato que nadie cargó.
  return [
    'LA CARA DE MARCA DEL NEGOCIO (la persona que aparece en sus creativos; casi',
    'siempre es el dueño, pero eso no está confirmado en ningún lado — no lo afirmes).',
    fotos ? `Tiene ${fotos} foto${fotos === 1 ? '' : 's'} cargadas en su onboarding.` : '',
    desc ? `\n${desc}` : '',
  ].filter(Boolean).join('\n');
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
/**
 * ⚠️ SEIS HORAS, NO CINCO MINUTOS.
 *
 * Una URL firmada que se pinta DENTRO de una página tiene la vida de esa página,
 * no la del request que la generó. Con 300 s, el modal «¿Con cuál de tus fotos?»
 * mostraba la primera foto y el resto rotas — y el síntoma miente sobre la causa:
 * parece que faltan las fotos, cuando lo que falta es la firma.
 *
 * Por qué la PRIMERA sí cargaba, que es lo que delata el caso: es la que ya se
 * había pedido en la caja grande de «Tu foto», así que estaba en el caché del
 * navegador. Las otras siete se piden recién al abrir el modal, minutos después.
 *
 * El plazo no es una laxitud: el link es de un solo objeto y no se puede adivinar,
 * y seis horas es menos que una sesión de trabajo. Lo que no puede pasar es que
 * venza mientras la pantalla que lo muestra sigue abierta.
 */
async function urlFoto(path: string): Promise<string | null> {
  const { data } = await getSupabaseServer().storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 6);
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
//
// Formato SECCIONADO (un encabezado en MAYÚSCULA por línea + una frase corta debajo),
// NO un párrafo largo: (1) pedido de Martín — que se lea rápido y gráfico, no un texto
// enorme; (2) el mismo criterio que ya usa el panorama del Archivero (ResumenView), así
// que reusamos el MISMO patrón de parseo simple en vez de json:true — que ya demostró
// ser más frágil entre proveedores (bug de las preguntas de Entregable/Avatares).
export const PERSONA_DESC_SECCIONES = ['IDENTIDAD', 'ROSTRO', 'OJOS', 'CABELLO', 'COMPLEXIÓN', 'MARCAS DISTINTIVAS', 'VESTIMENTA', 'ACTITUD'] as const;

const PERSONA_DESC_PROMPT = `Eres un director de arte creando la FICHA de una persona para que una IA generativa de imágenes la recree IDÉNTICA en cada anuncio. Te paso VARIAS fotos de la MISMA persona — míralas TODAS juntas y describe lo que ves, sección por sección. NO inventes nombre ni ningún dato que no se vea. Español neutro, de "tú".

CÓMO USAR VARIAS FOTOS (esto es lo más importante):
- Los rasgos FÍSICOS (rostro, ojos, cabello, complexión, marcas) no cambian entre fotos de la misma persona: cruza todas las fotos para describirlos con MÁS certeza y detalle, no menos.
- Lo que SÍ puede variar entre fotos es la ropa y el entorno. Si ves la MISMA persona con distinta vestimenta en distintas fotos, DILO así ("en unas fotos viste...; en otras...") en vez de presentar solo una como si fuera la única. Si el estilo se repite (mismos colores, mismo tipo de prendas), describe ESE patrón general.
- Si alguna foto es de mala calidad o no aporta (borrosa, muy lejos, tapada), ignórala para esa sección puntual y básate en las que sí sirven — no la menciones, solo no la uses.

LARGO: nada de secciones todas del mismo tamaño por relleno. Una sección con mucho que describir (ej. el rostro) puede ser 2-3 frases; una simple (ej. marcas distintivas, si no hay ninguna) puede ser una sola línea corta tipo "Ninguna visible". Sé denso y específico, no genérico — cada frase tiene que aportar un dato visual concreto, no una descripción de manual.

Devuelve EXACTAMENTE este formato — un encabezado en MAYÚSCULA por línea y debajo su texto, sin viñetas ni markdown:

IDENTIDAD
Género aparente, rango de edad y complexión general.

ROSTRO
Forma de cara, pómulos, mentón, nariz, boca y cejas; vello facial si tiene.

OJOS
Color, forma y tamaño; algo distintivo si lo hay.

CABELLO
Color exacto (incluye canas o mechones si se ven), largo, textura y peinado; entradas o calvicie si aplica.

COMPLEXIÓN
Altura aproximada, contextura física y postura.

MARCAS DISTINTIVAS
Lunares, cicatrices, arrugas de expresión, lentes o tatuajes visibles — "Ninguna visible" si no hay.

VESTIMENTA
El estilo/paleta que se repite entre fotos, o las variaciones si las hay (no presentes una sola prenda como si fuera la única).

ACTITUD
Qué transmite (cercano, serio, enérgico…) y por qué se percibe así, viendo el conjunto de fotos.

Los rasgos FÍSICOS son FIJOS: la IA que genere las imágenes de los anuncios los tiene que reproducir IDÉNTICOS cada vez — sé específico y visual, nunca genérico.`;

// Tope de fotos que mandamos JUNTAS en la misma llamada de visión: MIN_FOTOS pide 5,
// esto deja margen sin dejar crecer el payload/latencia sin límite.
const MAX_FOTOS_ANALISIS = 8;

/** Analiza TODAS las fotos JUNTAS (una sola llamada de visión) y genera una
 *  descripción física detallada de la persona, sintetizando entre todas — antes
 *  solo se miraba UNA foto (la primera que funcionaba), así que una sección como
 *  "vestimenta" quedaba resuelta con lo que se veía en esa única foto. */
export async function generarDescripcionPersona(): Promise<{ ok: true; descripcion: string } | { ok: false; error: string }> {
  try {
    const p = await getPersona();
    if (p.fotos.length === 0) return { ok: false, error: 'Sube al menos una foto primero.' };
    const fotos = p.fotos.slice(0, MAX_FOTOS_ANALISIS);
    const dataUrls: string[] = [];
    for (const f of fotos) {
      try {
        const { data } = await getSupabaseServer().storage.from(BUCKET).download(f.path);
        if (!data) continue;
        const buf = Buffer.from(await data.arrayBuffer());
        dataUrls.push(`data:${f.mime || 'image/jpeg'};base64,${buf.toString('base64')}`);
      } catch { /* esa foto no bajó, seguimos con las demás */ }
    }
    if (!dataUrls.length) return { ok: false, error: 'No pude descargar las fotos. Reintenta.' };
    // Timeout generoso por proveedor: varias imágenes juntas tardan más que una sola.
    // Cascada de visión son 2 (gemini→openai): 60s × 2 = 120s tope, bajo el maxDuration=180.
    const { text } = await leerDocumentoIA({
      dataUrl: dataUrls[0], dataUrls, isPdf: false, nombreArchivo: 'fotos-persona',
      prompt: PERSONA_DESC_PROMPT, feature: 'persona', motivo: 'Describir la cara de marca (todas las fotos)', timeoutMs: 60000, redDePlataforma: true,
    });
    if (text.trim().length > 60) {
      const descripcion = text.trim();
      await setPersona({ ...(await getPersona()), descripcion });
      return { ok: true, descripcion };
    }
    return { ok: false, error: 'No pude analizar las fotos. Reintenta, o conecta tu API key de Gemini (gratis) para el análisis con IA.' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
