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
import { faseNegocioTexto, getDiagnosticoFase } from './fase-store';
import { type CanalId } from './fase-diagnostico';
import { personalidadNegocioTexto } from './personalidad-store';
import { anguloGuionPorId, instruccionesTexto } from './guion-angulos';
import { getAngulosGuion } from './guion-angulos-store';
import { estructuraPorId } from './guion-estructuras';
import { getEstructurasGuion } from './guion-estructuras-store';
import { getSetting, setSetting } from './settings';
import { getAvatares, avataresTexto, type Avatar } from './avatares';
import { getEntregables, entregablesTexto } from './entregable';
import { chatCheapCascade, CASCADA_DOCS, MODELO_DOCS } from './ai-cheap';

// Un guion de video de una celda. Una celda puede tener VARIOS (pedido
// explícito): uno de testimonio, otro de lead magnet, otro de dolor… — cada uno
// con su ÁNGULO DE GUION (lib/guion-angulos.ts) y listo para testear por separado.
export type GuionItem = { id: string; anguloId: string; anguloNombre: string; texto: string };

// Una celda: una motivación de compra de un avatar + su material de anuncio.
//  · nombre      = la motivación en pocas palabras ("Un mejor salario").
//  · descripcion = la motivación A FONDO (el deseo detrás + la situación concreta).
//  · copy        = el hook/copy del anuncio para esa motivación.
//  · guiones     = los guiones de video (a pedido; puede haber varios, por ángulo).
//  · imagenUrl   = placeholder de la imagen generada (vacío hasta que existan).
//  · anguloImagen/anguloVideo = el FORMATO elegido (id de la biblioteca de formatos)
//    para la imagen y el video de este anuncio ('' hasta que la IA lo elija).
export type RazonCelda = { id: string; avatarId: string; nombre: string; descripcion: string; copy: string; guiones: GuionItem[]; imagenUrl: string; anguloImagen: string; anguloVideo: string };
export type Uso = { tokens: number; costUsd: number } | null;

const SETTING_KEY = 'mako.razones';
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

function normalizarGuiones(o: Record<string, unknown>): GuionItem[] {
  const out: GuionItem[] = [];
  if (Array.isArray(o.guiones)) {
    for (const raw of o.guiones) {
      const g = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
      const texto = str(g.texto);
      if (!texto) continue;
      out.push({ id: str(g.id) || randomUUID(), anguloId: str(g.anguloId), anguloNombre: str(g.anguloNombre) || 'General', texto });
    }
  }
  // Compat: las celdas guardadas ANTES del multi-guion tienen un solo string en
  // `guion` — se adopta como primer guion "General" y no se pierde nada.
  const legacy = str(o.guion);
  if (legacy && !out.length) out.push({ id: randomUUID(), anguloId: '', anguloNombre: 'General', texto: legacy });
  return out;
}

function normalizarRazon(v: unknown): RazonCelda {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return {
    id: str(o.id) || randomUUID(),
    avatarId: str(o.avatarId),
    nombre: str(o.nombre),
    descripcion: str(o.descripcion),
    copy: str(o.copy),
    guiones: normalizarGuiones(o),
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
      out.push({ id: randomUUID(), avatarId: av.id, nombre, descripcion: str(o.descripcion), copy: str(o.copy), guiones: [], imagenUrl: '', anguloImagen: '', anguloVideo: '' });
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
// Reescrito 2026-07-30 tras revisión real: el guion viejo mezclaba entregable +
// dolor + acciones de cámara en un solo guion imposible de entender ("ni el dueño
// lo entendió fácil"), y el CTA invitaba a un taller gratuito que NO EXISTE en el
// negocio — la IA lo inventó. Investigación (frameworks Hook-Story-Offer/PAS,
// principio "un anuncio, un mensaje" de Ogilvy/Todd Brown, taxonomía de CTA por
// funnel, hook-system.md de skills.sh) resumida en la nota de racional del PR.
// v3 (2026-07-31): el guion ya no fuerza UNA estructura fija — recibe el ÁNGULO
// elegido (lib/guion-angulos.ts: dolor, testimonio, lead magnet, retargeting…) con
// sus instrucciones y su ESTRUCTURA (Gancho-Historia/Valor/Propuesta-CTA, del doc
// de referencia), el SIGUIENTE PASO real del funnel (lo que la persona recibe al
// hacer clic — definido por el dueño en el wizard de creación, no adivinado), y el
// TONO/personalidad del creador (para humanizar: que suene a él, no a una IA).
export const GUION_SYSTEM_TEMPLATE = `Sos MaKo, escribiendo el GUION de un anuncio de VIDEO para Meta (gente que no conoce el negocio, salvo que el angulo diga lo contrario). Te paso el avatar, su motivacion de compra, el copy/hook, el lead magnet del negocio, el ANGULO del guion con sus instrucciones, el SIGUIENTE PASO real del funnel y el TONO del creador. Escribi un guion listo para grabar de 30 a 90 segundos, HABLADO, para que una persona lo lea a camara o narre sobre pantalla.

EL ANGULO DE ESTE GUION: {{anguloNombre}}
{{anguloInstrucciones}}
Todo el guion se juega a ESTE angulo. No lo mezcles con otros enfoques: un anuncio, un angulo, un mensaje.

ANTES DE ESCRIBIR: UN SOLO MENSAJE
Un anuncio ganador cuelga de UNA sola idea. Regla de tijera: cada linea que escribas, pregunta "¿esto sirve al angulo y al unico mensaje, o es solo un dato que suena bien?". Si es lo segundo, se corta. No metas mecanismos, procesos internos, features secundarias, ni una segunda promesa "por las dudas". Test final: si alguien solo escucha la primera y la ultima frase, ¿ya entiende de que se trata y que tiene que hacer?

ESTRUCTURA — {{estructuraNombre}}
{{estructuraGuia}}

EL CTA: EXACTAMENTE EL SIGUIENTE PASO REAL
Lo que pasa cuando la persona hace clic en este anuncio es: {{siguientePaso}}.
- El CTA invita EXACTAMENTE a eso, nombrando lo que la persona VE o RECIBE al hacer clic (el video, el recurso, el registro, la compra, la llamada) — no un paso generico ni uno distinto.
- 1-2 frases, UNA sola accion con UN solo verbo. Nunca dos caminos ("agenda o escribinos").
- NUNCA inventes un activo que no este confirmado en el contexto (nada de talleres, webinars, guias o descuentos que no te dieron).

TONO Y PERSONALIDAD DEL CREADOR (escribi TODO el guion con esta voz — es SU anuncio, tiene que sonar a el, no a una IA):
{{tono}}

REGLAS
- SOLO DIALOGO HABLADO. El guion es unicamente lo que la persona DICE en voz alta. No escribas direcciones de camara, acciones en pantalla, ni nada entre parentesis describiendo lo que se ve, se muestra o se hace. Nada de "(Accion: ...)", "(zoom a...)", "(pantalla muestra...)".
- CERO JERGA INTERNA. Nunca digas en voz alta el nombre propio de un sistema, protocolo, matriz, dashboard o metodologia interna tal cual esta en el contexto. Traduci cualquier concepto interno a una descripcion simple, de la calle, que una persona sin ningun contexto entienda al primer escuchazo — como si se lo explicaras a un amigo, no como si presentaras un sistema interno a un empleado.
- CERO CONTEXTO PREVIO ASUMIDO. Tiene que sonar a anuncio normal que cualquiera entiende, no a briefing interno ni a demo para el equipo.
- Concreto, anclado en el dolor/deseo REAL del avatar. Sin relleno, sin promesas vacias, sin cifras ni garantias que no esten en el contexto.
- Si el dueño te dejo una NOTA sobre que quiere comunicar, respetala — manda sobre cualquier default.
- Marca las partes EXACTAMENTE con estas etiquetas, en mayusculas, cada una sola en su propia linea, sin texto extra en esa linea: {{etiquetas}}. No cambies el nombre, el orden ni el formato: la app las usa para separar el guion en tarjetas.
- IDIOMA: espanol NEUTRO/MEXICANO, sin voseo argentino. Si el tono de arriba define tu/usted, respetalo; si no, de "tu".

Devolve SOLO el texto del guion (sin JSON, sin explicaciones antes o despues).`;

/** El siguiente paso del funnel por default, si el dueño no lo definió en el
 *  wizard: derivado del canal del diagnóstico, conservador (nunca inventa un
 *  activo). El wizard de "Nuevo guion" pisa esto con lo que el dueño elija. */
export async function siguientePasoDefault(): Promise<string> {
  const PASO_TXT: Record<CanalId, string> = {
    llamadas: 'agenda una llamada con el equipo',
    conversaciones: 'abre una conversación de WhatsApp con el negocio',
    carrito: 'llega al checkout y puede comprar directo',
    webinar: 'llega a la página de registro del webinar',
  };
  const diag = await getDiagnosticoFase();
  return diag?.canal ? PASO_TXT[diag.canal] : 'no especificado — usa el CTA más genérico y verdadero posible (pedir más información), sin inventar activos';
}

export type GenerarGuionOpts = {
  /** id del ángulo de guion elegido (lib/guion-angulos). */
  anguloId?: string;
  /** id de la estructura elegida (lib/guion-estructuras); default = la sugerida del ángulo. */
  estructuraId?: string;
  /** Qué ve/recibe la persona al hacer clic (definido por el dueño en el wizard). */
  siguientePaso?: string;
  /** Respuestas del dueño a las preguntas propias del ángulo (van al prompt). */
  respuestasAngulo?: Array<{ pregunta: string; respuesta: string }>;
  /** Nota libre del dueño: qué quiere comunicar puntualmente. */
  nota?: string;
  /** Formato de video elegido (biblioteca de formatos), si hay. */
  formatoVideoTexto?: string;
  timeoutMs?: number;
};

export async function generarGuion(celdaId: string, opts: GenerarGuionOpts = {}): Promise<{ ok: true; guion: GuionItem } | { ok: false; error: string }> {
  try {
    const razones = await getRazones();
    const celda = razones.find((r) => r.id === celdaId);
    if (!celda) return { ok: false, error: 'Celda no encontrada.' };
    const [avatares, entregables, tono, angulos, estructuras] = await Promise.all([
      getAvatares(), getEntregables(), personalidadNegocioTexto(), getAngulosGuion(), getEstructurasGuion(),
    ]);
    const angulo = (opts.anguloId ? anguloGuionPorId(angulos, opts.anguloId) : undefined) ?? angulos.find((a) => a.activo) ?? angulos[0];
    if (!angulo) return { ok: false, error: 'No hay ángulos de guion en la biblioteca.' };
    // La estructura elegida (si vino y existe activa), o la primera compatible del
    // ángulo, o la primera activa del catálogo — nunca sin estructura.
    const activas = estructuras.filter((e) => e.activo);
    const estructura =
      (opts.estructuraId ? activas.find((e) => e.id === opts.estructuraId) : undefined) ??
      angulo.estructuras.map((id) => estructuraPorId(activas, id)).find(Boolean) ??
      activas[0];
    if (!estructura) return { ok: false, error: 'No hay estructuras de guion en la biblioteca.' };
    const siguientePaso = opts.siguientePaso?.trim() || (await siguientePasoDefault());
    const av = avatares.find((a) => a.id === celda.avatarId);
    const sys = await renderPrompt('razones.guion', GUION_SYSTEM_TEMPLATE, {
      anguloNombre: angulo.nombre,
      anguloInstrucciones: instruccionesTexto(angulo),
      estructuraNombre: estructura.nombre,
      estructuraGuia: estructura.guia,
      siguientePaso,
      etiquetas: estructura.etiquetas.join(' / '),
      tono: tono || '(sin definir — voz cercana y natural, de "tú")',
    });
    const respAngulo = (opts.respuestasAngulo ?? []).filter((r) => r.respuesta.trim());
    const user = `AVATAR: ${av ? `${av.nombre} — ${av.segmento}. Situación: ${av.situacion}. Dolor: ${av.dolor}` : '(sin avatar)'}
MOTIVACIÓN DE COMPRA: ${celda.nombre} — ${celda.descripcion}
COPY/HOOK: ${celda.copy}
SIGUIENTE PASO AL HACER CLIC: ${siguientePaso}
${entregables.length ? `LEAD MAGNET: ${entregablesTexto(entregables)}\n` : ''}${opts.formatoVideoTexto ? `FORMATO DE VIDEO A SEGUIR: ${opts.formatoVideoTexto}\n` : ''}${respAngulo.length ? `LO QUE EL DUEÑO PRECISÓ PARA ESTE ÁNGULO (úsalo, es el material concreto):\n${respAngulo.map((r) => `- ${r.pregunta} → ${r.respuesta.trim()}`).join('\n')}\n` : ''}${opts.nota?.trim() ? `NOTA DEL DUEÑO (qué quiere comunicar — respetala):\n${opts.nota.trim()}\n` : ''}
Escribí el guion del video con el ángulo "${angulo.nombre}" y la estructura "${estructura.nombre}".`;
    const texto = await chatCheapCascade({
      system: sys, user, maxTokens: 2200, timeoutMs: opts.timeoutMs,
      feature: 'razones', motivo: `Guion de video (ángulo ${angulo.nombre})`,
      provs: CASCADA_DOCS, modelos: MODELO_DOCS, validar: (t) => t.trim().length > 40,
    });
    if (!texto.trim()) return { ok: false, error: 'No hay IA para el guion. Conecta tu API key de Gemini (gratis).' };
    const item: GuionItem = { id: randomUUID(), anguloId: angulo.id, anguloNombre: angulo.nombre, texto: texto.trim() };
    // Releer DESPUÉS de la llamada lenta: si el usuario editó otra celda mientras
    // se generaba, no lo pisamos — solo AGREGAMOS el guion nuevo a esta celda.
    const actuales = await getRazones();
    const nuevas = actuales.map((r) => (r.id === celdaId ? { ...r, guiones: [...r.guiones, item] } : r));
    await setRazones(nuevas);
    return { ok: true, guion: item };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
