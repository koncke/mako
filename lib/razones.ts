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
import { CANALES, type CanalId } from './fase-diagnostico';
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
// Reescrito 2026-07-30 tras revisión real: el guion viejo mezclaba entregable +
// dolor + acciones de cámara en un solo guion imposible de entender ("ni el dueño
// lo entendió fácil"), y el CTA invitaba a un taller gratuito que NO EXISTE en el
// negocio — la IA lo inventó. Investigación (frameworks Hook-Story-Offer/PAS,
// principio "un anuncio, un mensaje" de Ogilvy/Todd Brown, taxonomía de CTA por
// funnel, hook-system.md de skills.sh) resumida en la nota de racional del PR.
export const GUION_SYSTEM_TEMPLATE = `Sos MaKo, escribiendo el GUION de un anuncio de VIDEO para Meta de TRAFICO FRIO (TOFU, gente que no te conoce y nunca escucho hablar del negocio). Te paso el avatar, su motivacion de compra (dolor o deseo), el copy/hook, el entregable tangible del negocio, el FUNNEL real por el que este negocio vende ({{funnel}}) y, si esta, el FORMATO de video elegido. Escribi un guion listo para grabar de 30 a 90 segundos, HABLADO, para que una persona lo lea a camara o narre sobre pantalla.

ANTES DE ESCRIBIR: ELEGI UN SOLO MENSAJE
Un anuncio ganador cuelga de UNA sola idea, no de una lista de cosas impresionantes. Antes de escribir una sola linea, decidi:

- El EJE del guion es UNA sola cosa: o el DOLOR/DESEO del avatar (su situacion, lo que siente, lo que le esta costando) o el ENTREGABLE (la cosa concreta que le vas a mostrar/dar). Elegi uno. El otro puede aparecer de forma breve y subordinada, nunca como coprotagonista.
- Si el dolor y el entregable pelean por el centro del guion, el espectador no retiene ninguno de los dos. Menos es mas: es mejor un guion que vende UNA idea con fuerza que uno que intenta cubrir todo el negocio.
- Regla de tijera: cada linea que escribas, pregunta "¿esto sirve al UNICO mensaje que elegi, o es solo un dato que suena bien?". Si es lo segundo, se corta. No metas mecanismos, procesos internos, features secundarias, ni una segunda promesa "por las dudas".
- Test final antes de entregar: si alguien solo escucha la primera y la ultima frase del guion, ¿ya entiende de que se trata y que tiene que hacer? Si no, sobra contenido en el medio.

ESTRUCTURA — GANCHO / HISTORIA / CTA
Usa esta estructura siempre, adaptando el contenido (no el orden ni las etiquetas) al formato si te lo doy.

GANCHO (primeros 3-5 segundos, 1-2 frases)
Una sola frase que haga que la persona correcta se detenga a escuchar. Nombra su situacion o su dolor/deseo en el lenguaje con el que ESA persona lo pensaria de si misma (no en el lenguaje del negocio). No expliques nada todavia, no vendas nada todavia: solo hace que quiera saber que sigue.

HISTORIA (cuerpo del guion, la mayor parte del tiempo)
Desarrolla el UNICO mensaje que elegiste, en una linea narrativa simple: como es la vida/el problema ANTES, que fue lo que cambio (una sola razon, contada como algo que cualquiera entenderia al toque, no como una explicacion tecnica), y como se ve el DESPUES. Si usas el entregable, mencionalo como prueba de que esto es real y existe — una frase, no un catalogo de sus partes. No armes un tutorial de 3 pasos ni una lista de features: es UNA historia, contada como se la contarias a un amigo tomando un cafe.

CTA (ultimos 5-10 segundos, 1-2 frases, no mas)
Una sola instruccion, clara, corta, dicha en voz alta. Ver reglas de CTA abajo — el CTA tiene que corresponder EXACTAMENTE al funnel real del negocio.

REGLAS DE CTA SEGUN EL FUNNEL (usa la que coincide con {{funnel}}; nunca mezcles ni inventes otra)
- Si el funnel es "agenda una llamada de venta": invita a reservar un horario/llamada concreta. Ej: "Dale clic al boton de abajo y agenda tu llamada gratis." Nunca digas "contactanos" (es ambiguo) ni menciones un webinar.
- Si el funnel es "vende por conversacion de WhatsApp/DM sin llamada": invita a escribir/mandar mensaje, no a agendar ni a comprar. Ej: "Escribinos por WhatsApp y te ayudamos a resolverlo." Nunca digas "agenda tu llamada" ni "compralo ahora".
- Si el funnel es "vende directo por carrito/checkout sin hablar con nadie": invita a comprar/completar la compra ya. Ej: "Dale clic en comprar, el link esta abajo." Nunca impliques que primero va a hablar con alguien.
- Si el funnel es "invita a un webinar": invita a registrarse a la sesion, PERO solo si el contexto que te dieron confirma que ese webinar existe y tiene fecha real. Ej: "Registrate gratis, el link esta abajo."
- Si el funnel no esta claro o dice "no especificado", NUNCA inventes uno (nada de talleres, webinars ni recursos que no te confirmaron). Usa el CTA mas generico y verdadero posible: invitar a escribir por WhatsApp o a pedir mas informacion, nombrando solo lo que sabes que existe.
- El CTA nombra UNA sola accion con UN solo verbo. Nunca ofrezcas dos caminos ("agenda una llamada o escribinos por WhatsApp").

REGLAS
- SOLO DIALOGO HABLADO. El guion es unicamente lo que la persona DICE en voz alta. No escribas direcciones de camara, acciones en pantalla, ni nada entre parentesis describiendo lo que se ve, se muestra o se hace. Nada de "(Accion: ...)", "(zoom a...)", "(pantalla muestra...)". Si te dan un FORMATO de video, dejalo influir el tono de lo que se dice, nunca agregues una descripcion visual.
- CERO JERGA INTERNA. Nunca digas en voz alta el nombre propio de un sistema, protocolo, matriz, dashboard o metodologia interna tal cual esta en el contexto (ej.: nada de "Protocolo de Hand-off", "Matriz de Auditoria", "Dashboard Semaforizado de Salud de Clientes" dicho como nombre tecnico). Traduci cualquier concepto interno a una descripcion simple, de la calle, que una persona sin ningun contexto del negocio entienda al primer escuchazo — como si se lo explicaras a un amigo que jamas oyo hablar de esto, no como si le presentaras un sistema interno a un empleado.
- CERO CONTEXTO PREVIO ASUMIDO. Escribi asumiendo que quien escucha nunca vio el negocio, no conoce su metodologia, y no le importa como se llaman las cosas por dentro. Tiene que sonar a anuncio normal que cualquiera entiende, no a briefing interno ni a demo de producto para el equipo.
- Concreto, anclado en el dolor/deseo REAL del avatar que te pasaron. Sin relleno, sin promesas vacias, sin cifras ni garantias que no esten en el contexto que te dieron.
- No repitas ni resumas el contexto que te pasaron: escribilo como guion natural, no como reporte.
- Marca las tres partes EXACTAMENTE con estas etiquetas, en mayusculas, cada una sola en su propia linea, sin texto extra en esa linea: GANCHO / HISTORIA / CTA. No cambies el nombre, el orden ni el formato de las etiquetas: la app las usa para separar el guion en tarjetas.
- IDIOMA: espanol NEUTRO/MEXICANO, de tu, sin voseo argentino.

Devolve SOLO el texto del guion (sin JSON, sin explicaciones antes o despues).`;

/** El funnel real del negocio, en el mismo lenguaje que espera el prompt del guion
 *  (evita que la IA invente un CTA de un funnel que no existe — ej. un webinar
 *  cuando el negocio en realidad vende por WhatsApp). Sale del canal que el
 *  cliente ya eligió en el diagnóstico de fase; "no especificado" si no lo eligió
 *  todavía, para que el prompt caiga en su regla de CTA genérico sin inventar. */
async function funnelTextoParaGuion(): Promise<string> {
  const FUNNEL_TXT: Record<CanalId, string> = {
    llamadas: 'agenda una llamada de venta',
    conversaciones: 'vende por conversación de WhatsApp/DM sin llamada',
    carrito: 'vende directo por carrito/checkout sin hablar con nadie',
    webinar: 'invita a un webinar',
  };
  const diag = await getDiagnosticoFase();
  return diag?.canal ? FUNNEL_TXT[diag.canal] : 'no especificado';
}

export async function generarGuion(celdaId: string, formatoVideoTexto?: string, timeoutMs?: number): Promise<{ ok: true; guion: string } | { ok: false; error: string }> {
  try {
    const razones = await getRazones();
    const celda = razones.find((r) => r.id === celdaId);
    if (!celda) return { ok: false, error: 'Celda no encontrada.' };
    const [avatares, entregables, funnel] = await Promise.all([getAvatares(), getEntregables(), funnelTextoParaGuion()]);
    const av = avatares.find((a) => a.id === celda.avatarId);
    const sys = await renderPrompt('razones.guion', GUION_SYSTEM_TEMPLATE, { funnel });
    const user = `AVATAR: ${av ? `${av.nombre} — ${av.segmento}. Situación: ${av.situacion}. Dolor: ${av.dolor}` : '(sin avatar)'}
MOTIVACIÓN DE COMPRA: ${celda.nombre} — ${celda.descripcion}
COPY/HOOK: ${celda.copy}
FUNNEL REAL DEL NEGOCIO: ${funnel}
${entregables.length ? `ENTREGABLE TANGIBLE: ${entregablesTexto(entregables)}\n` : ''}${formatoVideoTexto ? `FORMATO DE VIDEO A SEGUIR: ${formatoVideoTexto}\n` : ''}
Escribí el guion del video.`;
    const guion = await chatCheapCascade({
      system: sys, user, maxTokens: 2200, timeoutMs,
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
