// =============================================================================
// razones — las MOTIVACIONES de compra de cada avatar (+ el copy/guion por celda)
// =============================================================================
// Una RAZÓN NO es un hook ni una categoría fija (dolor/deseo/explicación): es una
// MOTIVACIÓN CONCRETA por la que ESE avatar compra. El ejemplo de Jan (curso de
// inglés): un avatar lo compra por un MEJOR SALARIO, otro por un VIAJE, otro por un
// ASCENSO. Un mismo avatar tiene varias. MaKo encuentra 3 motivaciones por avatar,
// a fondo. Esas 3×3 = 9 son la MATRIZ: cada celda (avatar × razón) se vuelve un
// anuncio (copy + guion + imagen). El copy sale junto con la razón; el guion, a pedido.
//
// Una RazonCelda es a la vez la fila de la tab "Razones" (motivación a fondo) y una
// celda de la tab "Matriz" (con su copy/guion/imagen). Corre con la IA gratis (Gemini).
// =============================================================================

import 'server-only';
import { randomUUID } from 'node:crypto';
import { renderPrompt } from './prompt-render';
import { parseJsonObject } from './campaign-structurer';
import { perfilNegocioTexto } from './onboarding';
import { faseNegocioTexto } from './fase-store';
import { getSetting, setSetting } from './settings';
import { getAvatares, avataresTexto, type Avatar } from './avatares';
import { getEntregables, entregablesTexto } from './entregable';
import { chatCheapCascade, CASCADA_DOCS, MODELO_DOCS } from './ai-cheap';

// Una celda: una motivación de compra de un avatar + su material de anuncio.
//  · nombre      = la motivación en pocas palabras ("Un mejor salario").
//  · descripcion = la motivación A FONDO (el deseo detrás + la situación concreta).
//  · copy        = el hook/copy del anuncio para esa motivación.
//  · guion       = el guion de video (a pedido; '' hasta generarlo).
//  · imagenUrl   = placeholder de la imagen generada (vacío hasta que existan).
//  · anguloImagen/anguloVideo = el FORMATO elegido (id de la biblioteca de ángulos)
//    para la imagen y el video de este anuncio ('' hasta que la IA lo elija).
export type RazonCelda = { id: string; avatarId: string; nombre: string; descripcion: string; copy: string; guion: string; imagenUrl: string; anguloImagen: string; anguloVideo: string };
export type Uso = { tokens: number; costUsd: number } | null;

const SETTING_KEY = 'mako.razones';
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

function normalizarRazon(v: unknown): RazonCelda {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return {
    id: str(o.id) || randomUUID(),
    avatarId: str(o.avatarId),
    nombre: str(o.nombre),
    descripcion: str(o.descripcion),
    copy: str(o.copy),
    guion: str(o.guion),
    imagenUrl: str(o.imagenUrl),
    anguloImagen: str(o.anguloImagen),
    anguloVideo: str(o.anguloVideo),
  };
}

// ── Persistencia ─────────────────────────────────────────────────────────────
export async function getRazones(): Promise<RazonCelda[]> {
  const raw = await getSetting(SETTING_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(normalizarRazon).filter((r) => r.nombre) : [];
  } catch { return []; }
}
export async function setRazones(list: RazonCelda[]): Promise<void> {
  await setSetting(SETTING_KEY, JSON.stringify(list));
}

// ── Prompt: generar las 3 motivaciones por avatar (+ copy) ───────────────────
export const RAZONES_SYSTEM_TEMPLATE = `Sos MaKo, encontrando las RAZONES/MOTIVACIONES de compra de un negocio para sus anuncios de Meta (metodología de Jan, "Anuncio Ganador"). Una RAZÓN no es un hook ni una categoría abstracta: es una MOTIVACIÓN concreta por la que ese avatar compra. Ejemplo de Jan (curso de inglés): un avatar lo compra por un MEJOR SALARIO, otro porque SE VA DE VIAJE, otro por un ASCENSO. Un mismo avatar tiene varias motivaciones distintas.

Te paso los AVATARES ya definidos. Para CADA avatar, encontrá 3 MOTIVACIONES de compra DISTINTAS y CONCRETAS (no 3 formas de decir lo mismo). Cada una:
- "nombre": la motivación en 2-5 palabras, concreta ("Un mejor salario", "Escalar sin perder el control", "Dejar de ser el cuello de botella").
- "descripcion": la motivación A FONDO — el deseo real detrás + la situación concreta de ESE avatar que la dispara (2-3 frases). Acá es donde profundizás.
- "copy": UNA línea de anuncio (hook) que le habla a ESA motivación de ESE avatar; frena el scroll, del deseo/dolor real. Usá el ENTREGABLE tangible si viene en el contexto.

REGLAS:
- Las 3 motivaciones de un avatar tienen que ser genuinamente distintas entre sí.
- NO inventes cifras ni garantías que no estén en el contexto.
- IDIOMA: español NEUTRO/MEXICANO, de "tú", SIN voseo ni modismos argentinos.

Devolvé EXCLUSIVAMENTE un objeto JSON válido (sin markdown, sin texto afuera). "avatar" es el NÚMERO del avatar (1, 2, 3) tal como te lo paso:
{"matriz":[{"avatar":1,"razones":[{"nombre":"","descripcion":"","copy":""}]}]}`;

export const RAZONES_USER_TEMPLATE = `AVATARES (usá EXACTAMENTE estos, referencialos por su número):
{{avatares}}

NEGOCIO:
{{brief}}
{{entregable}}{{fase}}
Para cada avatar, encontrá 3 motivaciones de compra (con su copy). Devolvé solo el JSON.`;

// ── Parseo de la matriz → celdas con avatarId ────────────────────────────────
export function parseRazones(text: string, avatares: Avatar[]): RazonCelda[] {
  const raw = parseJsonObject(text);
  const filas = Array.isArray(raw.matriz) ? raw.matriz : [];
  const out: RazonCelda[] = [];
  for (const fila of filas) {
    const f = (fila && typeof fila === 'object' ? fila : {}) as Record<string, unknown>;
    const num = typeof f.avatar === 'number' ? f.avatar : parseInt(str(f.avatar), 10);
    let av: Avatar | undefined = Number.isFinite(num) ? avatares[num - 1] : undefined;
    if (!av) av = avatares.find((a) => a.nombre.toLowerCase() === str(f.avatar).toLowerCase());
    if (!av) continue;
    const rs = Array.isArray(f.razones) ? f.razones : [];
    for (const r of rs.slice(0, 3)) {
      const o = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
      const nombre = str(o.nombre);
      if (!nombre) continue;
      out.push({ id: randomUUID(), avatarId: av.id, nombre, descripcion: str(o.descripcion), copy: str(o.copy), guion: '', imagenUrl: '', anguloImagen: '', anguloVideo: '' });
    }
  }
  return out;
}

// ── Generación de la matriz de razones (envelope {ok}; nunca lanza) ──────────
export type GenResult = { ok: true; razones: RazonCelda[]; uso: Uso } | { ok: false; error: string };

export async function generarRazones(): Promise<GenResult> {
  try {
    const avatares = await getAvatares();
    if (avatares.length < 1) return { ok: false, error: 'Primero define tus avatares: son las filas de la matriz.' };
    const [brief, fase, entregables] = await Promise.all([perfilNegocioTexto(), faseNegocioTexto(), getEntregables()]);
    if (!brief.trim() || brief.replace(/[—\-·\s]/g, '').length < 20) {
      return { ok: false, error: 'Primero carga tu negocio en El Archivero: de ahí salen las razones.' };
    }
    const sys = await renderPrompt('razones.system', RAZONES_SYSTEM_TEMPLATE, {});
    const user = await renderPrompt('razones.user', RAZONES_USER_TEMPLATE, {
      avatares: avataresTexto(avatares),
      brief,
      entregable: entregables.length ? `\nENTREGABLE TANGIBLE (úsalo en el copy si aplica):\n${entregablesTexto(entregables)}\n` : '',
      fase: fase ? `\nFASE DEL NEGOCIO:\n${fase}\n` : '',
    });
    const text = await chatCheapCascade({
      system: sys, user, json: true, maxTokens: 4000,
      feature: 'razones', motivo: 'Matriz de motivaciones de compra por avatar',
      provs: CASCADA_DOCS, modelos: MODELO_DOCS, validar: (t) => parseRazones(t, avatares).length > 0,
    });
    if (!text) return { ok: false, error: 'No hay IA para generar las razones. Conecta tu API key de Gemini (gratis) en Integraciones.' };
    const razones = parseRazones(text, avatares);
    if (!razones.length) return { ok: false, error: 'MaKo no devolvió razones. Reintenta en un momento.' };
    return { ok: true, razones, uso: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Guion de una celda (a pedido) ────────────────────────────────────────────
// Guion de anuncio TOFU (tráfico frío) para Meta, con la metodología de guiones de
// Mauricio: estructura GANCHO → cuerpo → CTA. El GANCHO cumple 3 trabajos (llama la
// atención con un dolor/deseo, CUALIFICA para quién es, y genera confianza/curiosidad);
// el cuerpo educa o cuenta una historia según el formato; el CTA rebate objeciones y
// manda a un webinar/taller gratuito y a agendar. Si viene un FORMATO de video elegido,
// el guion lo sigue (hook-problema, testimonio, mini-vsl, etc.).
export const GUION_SYSTEM_TEMPLATE = `Sos MaKo, escribiendo el GUION de un anuncio de VIDEO para Meta de TRÁFICO FRÍO (TOFU, gente que no te conoce). Te paso el avatar, su motivación de compra, el copy/hook, el entregable tangible del negocio y (si está) el FORMATO de video elegido. Escribí un guion listo para grabar de 30 a 90 segundos.

ESTRUCTURA (adaptala al formato si te lo doy):
1) GANCHO (primeros 3-5s) — tiene que hacer 3 cosas a la vez: (a) LLAMAR LA ATENCIÓN mostrando un dolor o un deseo real del avatar; (b) CUALIFICAR: dejar claro para QUIÉN es el anuncio (nombra al avatar/su situación) para filtrar y atraer solo al cliente potencial; (c) generar confianza/curiosidad (una promesa concreta de lo que van a ver).
2) CUERPO — desarrollá según el formato:
   · Historia: contá un antes/después creíble (el problema por el que pasa el avatar → el descubrimiento/mecanismo que lo resolvió) para que se identifique y le dé curiosidad.
   · Valor/educación: 2-3 pasos o ideas accionables (mini-tutorial) que muestren el mecanismo.
   · Propuesta directa: presentá la oferta/mecanismo de forma clara y "sexy", sin vueltas.
   Usá el ENTREGABLE tangible como prueba de que el mecanismo existe y funciona.
3) CTA — antes del cierre, REBATÍ 1-2 objeciones o creencias limitantes ("no es porque X ni Y, es porque…"); después, una llamada a la acción clara: registrarse a un taller/webinar gratuito (y luego agendar una asesoría). Nada de "estrategia mágica": invitá a ver el paso a paso.

REGLAS:
- Concreto, del dolor/deseo REAL del avatar. Sin relleno ni promesas vacías. NO inventes cifras ni garantías que no estén en el contexto.
- Marcá las partes con etiquetas (GANCHO / CUERPO / CTA). Podés incluir indicaciones cortas de acción entre paréntesis si suman.
- IDIOMA: español NEUTRO/MEXICANO, de "tú", sin voseo argentino.
Devolvé SOLO el texto del guion (sin JSON).`;

export async function generarGuion(celdaId: string, formatoVideoTexto?: string): Promise<{ ok: true; guion: string } | { ok: false; error: string }> {
  try {
    const razones = await getRazones();
    const celda = razones.find((r) => r.id === celdaId);
    if (!celda) return { ok: false, error: 'Celda no encontrada.' };
    const [avatares, entregables] = await Promise.all([getAvatares(), getEntregables()]);
    const av = avatares.find((a) => a.id === celda.avatarId);
    const sys = await renderPrompt('razones.guion', GUION_SYSTEM_TEMPLATE, {});
    const user = `AVATAR: ${av ? `${av.nombre} — ${av.segmento}. Situación: ${av.situacion}. Dolor: ${av.dolor}` : '(sin avatar)'}
MOTIVACIÓN DE COMPRA: ${celda.nombre} — ${celda.descripcion}
COPY/HOOK: ${celda.copy}
${entregables.length ? `ENTREGABLE TANGIBLE: ${entregablesTexto(entregables)}\n` : ''}${formatoVideoTexto ? `FORMATO DE VIDEO A SEGUIR: ${formatoVideoTexto}\n` : ''}
Escribí el guion del video.`;
    const guion = await chatCheapCascade({
      system: sys, user, maxTokens: 1500,
      feature: 'razones', motivo: 'Guion de video de una celda de la matriz',
      provs: CASCADA_DOCS, modelos: MODELO_DOCS, validar: (t) => t.trim().length > 40,
    });
    if (!guion.trim()) return { ok: false, error: 'No hay IA para el guion. Conecta tu API key de Gemini (gratis).' };
    // Releer DESPUÉS de la llamada lenta: si el usuario editó otra celda (o el copy de
    // esta) mientras se generaba, no lo pisamos — solo parcheamos el guion de esta celda.
    const actuales = await getRazones();
    const nuevas = actuales.map((r) => (r.id === celdaId ? { ...r, guion: guion.trim() } : r));
    await setRazones(nuevas);
    return { ok: true, guion: guion.trim() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
