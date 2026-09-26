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
import { chatCheapCascade, CASCADA_DOCS, MODELO_DOCS, errorDeCascada } from './ai-cheap';

// El shape del guion y su pipeline de producción viven en lib/guion-estado.ts
// (sin 'server-only'): los componentes de cliente los necesitan igual, y una
// copia del lado del cliente se desincroniza en silencio. Se re-exportan acá
// para que quien ya importaba de razones.ts no tenga que cambiar.
export { ESTADOS_GUION, ESTADO_GUION_LABEL, COLOR_ESTADO_GUION, esEstadoGuion, fechaGuion, type EstadoGuion, type GuionItem } from './guion-estado';
import { esEstadoGuion, type EstadoGuion, type GuionItem } from './guion-estado';

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

/** Un guion crudo (de la DB o del cliente) normalizado al shape actual. Los
 *  guiones escritos antes de que existieran `creadoEn`/`estado` entran con
 *  creadoEn 0 ("sin fecha") y estado 'borrador': no se les inventa una fecha. */
export function normalizarGuion(raw: unknown): GuionItem | null {
  const g = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const texto = str(g.texto);
  if (!texto) return null;
  const creadoEn = typeof g.creadoEn === 'number' && Number.isFinite(g.creadoEn) && g.creadoEn > 0 ? g.creadoEn : 0;
  return {
    id: str(g.id) || randomUUID(),
    anguloId: str(g.anguloId),
    anguloNombre: str(g.anguloNombre) || 'General',
    texto,
    creadoEn,
    estado: esEstadoGuion(g.estado) ? g.estado : 'borrador',
    estructuraId: str(g.estructuraId),
    estructuraNombre: str(g.estructuraNombre),
  };
}

function normalizarGuiones(o: Record<string, unknown>): GuionItem[] {
  const out: GuionItem[] = [];
  if (Array.isArray(o.guiones)) {
    for (const raw of o.guiones) {
      const g = normalizarGuion(raw);
      if (g) out.push(g);
    }
  }
  // Compat: las celdas guardadas ANTES del multi-guion tienen un solo string en
  // `guion` — se adopta como primer guion "General" y no se pierde nada.
  const legacy = str(o.guion);
  if (legacy && !out.length) {
    const g = normalizarGuion({ anguloNombre: 'General', texto: legacy });
    if (g) out.push(g);
  }
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
export const RAZONES_SYSTEM_TEMPLATE = `Eres MaKo, encontrando las RAZONES/MOTIVACIONES de compra de un negocio para sus anuncios de Meta (metodología de Jan, "Anuncio Ganador"). Una RAZÓN no es un hook ni una categoría abstracta: es una MOTIVACIÓN concreta por la que ese avatar compra. Ejemplo de Jan (curso de inglés): un avatar lo compra por un MEJOR SALARIO, otro porque SE VA DE VIAJE, otro por un ASCENSO. Un mismo avatar tiene varias motivaciones distintas.

Te paso los AVATARES ya definidos. Para CADA avatar, encontrá 3 MOTIVACIONES de compra DISTINTAS y CONCRETAS (no 3 formas de decir lo mismo). Cada una:
- "nombre": la motivación en 2-5 palabras, concreta ("Un mejor salario", "Escalar sin perder el control", "Dejar de ser el cuello de botella").
- "descripcion": la motivación A FONDO — el deseo real detrás + la situación concreta de ESE avatar que la dispara (2-3 frases). Aquí es donde profundizas.
- "copy": UNA línea de anuncio (hook) que le habla a ESA motivación de ESE avatar; frena el scroll, del deseo/dolor real. Usa el ENTREGABLE tangible si viene en el contexto.

REGLAS:
- Las 3 motivaciones de un avatar tienen que ser genuinamente distintas entre sí.
- NO inventes cifras ni garantías que no estén en el contexto.
- IDIOMA: español NEUTRO/MEXICANO, de "tú", SIN voseo ni modismos argentinos.

Devolvé EXCLUSIVAMENTE un objeto JSON válido (sin markdown, sin texto afuera). "avatar" es el NÚMERO del avatar (1, 2, 3) tal como te lo paso:
{"matriz":[{"avatar":1,"razones":[{"nombre":"","descripcion":"","copy":""}]}]}`;

export const RAZONES_USER_TEMPLATE = `AVATARES (usa EXACTAMENTE estos, referéncialos por su número):
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
    // `erroresOut` NO es opcional en la práctica: sin él, este `if (!text)` no puede
    // distinguir "no hay ninguna IA" de "las tres cuentas contestaron 503", y le pide
    // una key de Gemini a alguien que ya tiene tres. Pasó, y fue el reporte que obligó
    // a centralizar el mensaje (ver lib/ia-mensajes.ts).
    const errores: string[] = [];
    const text = await chatCheapCascade({
      system: sys, user, json: true, maxTokens: 4000,
      feature: 'razones', motivo: 'Matriz de motivaciones de compra por avatar',
      provs: CASCADA_DOCS, modelos: MODELO_DOCS, validar: (t) => parseRazones(t, avatares).length > 0,
      erroresOut: errores,
    });
    if (!text) return { ok: false, error: await errorDeCascada(errores, 'generar las razones') };
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
export const GUION_SYSTEM_TEMPLATE = `Eres MaKo, escribiendo el GUION de un anuncio de VIDEO para Meta (gente que no conoce el negocio, salvo que el angulo diga lo contrario). Te paso el avatar, su motivacion de compra, el copy/hook, el lead magnet del negocio, el ANGULO del guion con sus instrucciones, el SIGUIENTE PASO real del funnel y el TONO del creador. Escribe un guion listo para grabar de 30 a 90 segundos, HABLADO, para que una persona lo lea a camara o narre sobre pantalla.

EL ANGULO DE ESTE GUION: {{anguloNombre}}
{{anguloInstrucciones}}
Todo el guion se juega a ESTE angulo. No lo mezcles con otros enfoques: un anuncio, un angulo, un mensaje.
EL ANGULO MANDA: el bloque de APERTURA sale de los PATRONES DE HOOK del angulo de arriba (adaptado al negocio real) — no de la guia generica de la estructura ni del copy de la celda. Si chocan, gana el patron del angulo.

ANTES DE ESCRIBIR: UN SOLO MENSAJE
Un anuncio ganador cuelga de UNA sola idea. Regla de tijera: cada linea que escribas, pregunta "¿esto sirve al angulo y al unico mensaje, o es solo un dato que suena bien?". Si es lo segundo, se corta. No metas mecanismos, procesos internos, features secundarias, ni una segunda promesa "por las dudas". Test final: si alguien solo escucha la primera y la ultima frase, ¿ya entiende de que se trata y que tiene que hacer?

ESTRUCTURA — {{estructuraNombre}}
{{estructuraGuia}}

EL CTA: EXACTAMENTE EL SIGUIENTE PASO REAL
Lo que pasa cuando la persona hace clic en este anuncio es: {{siguientePaso}}.
- El CTA invita EXACTAMENTE a eso, nombrando lo que la persona VE o RECIBE al hacer clic (el video, el recurso, el registro, la compra, la llamada) — no un paso generico ni uno distinto.
- 1-2 frases, UNA sola accion con UN solo verbo. Nunca dos caminos ("agenda o escríbenos").
- NUNCA inventes un activo que no este confirmado en el contexto (nada de talleres, webinars, guias o descuentos que no te dieron).

TONO Y PERSONALIDAD DEL CREADOR (escribi TODO el guion con esta voz — es SU anuncio, tiene que sonar a el, no a una IA):
{{tono}}

REGLAS
- UN SOLO LEAD MAGNET / UNA SOLA COSA A VENDER. Si el contexto trae VARIOS lead magnets o recursos, elegi UNO SOLO (el que mejor calza con la motivacion de este anuncio) y el guion entero vende SOLO ese. Los demas NO EXISTEN en este guion: no los nombres, no los enumeres, no armes un "paquete" de varios. Y al nombrarlo, decilo en lenguaje simple (que es y que le resuelve), no con su nombre interno largo.
- SOLO DIALOGO HABLADO. El guion es unicamente lo que la persona DICE en voz alta. No escribas direcciones de camara, acciones en pantalla, ni nada entre parentesis describiendo lo que se ve, se muestra o se hace. Nada de "(Accion: ...)", "(zoom a...)", "(pantalla muestra...)".
- CERO JERGA INTERNA. Nunca digas en voz alta el nombre propio de un sistema, protocolo, matriz, dashboard o metodologia interna tal cual esta en el contexto. Traduci cualquier concepto interno a una descripcion simple, de la calle, que una persona sin ningun contexto entienda al primer escuchazo — como si se lo explicaras a un amigo, no como si presentaras un sistema interno a un empleado.
- CERO CONTEXTO PREVIO ASUMIDO. Tiene que sonar a anuncio normal que cualquiera entiende, no a briefing interno ni a demo para el equipo.
- Concreto, anclado en el dolor/deseo REAL del avatar. Sin relleno, sin promesas vacias, sin cifras ni garantias que no esten en el contexto.
- Si el dueño te dejo una NOTA sobre que quiere comunicar, respetala — manda sobre cualquier default.
- Marca las partes EXACTAMENTE con estas etiquetas, en mayusculas, cada una sola en su propia linea, sin texto extra en esa linea: {{etiquetas}}. No cambies el nombre, el orden ni el formato: la app las usa para separar el guion en tarjetas.
- IDIOMA: la voz de la PERSONALIDAD manda. Si define VOSEO, escribi TODO el guion de "vos" con las conjugaciones correctas (vos sabes/sabés, tenes/tenés, hace/hacé, mira/mirá); si define "tu" o "usted", respetalo en todo el guion. Solo si no hay personalidad definida: espanol neutro/mexicano de "tu".

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
    // Sin fecha ni dirección: son datos del negocio y este texto viaja a un modelo,
    // que los inventaría. El lugar y el día salen de `funnels.data.evento`,
    // y solo por código (ver guionDe en lib/audios-paso.ts).
    presencial: 'escribe por WhatsApp para ir a la sesión presencial',
  };
  const diag = await getDiagnosticoFase();
  return diag?.canal ? PASO_TXT[diag.canal] : 'no especificado — usa el CTA más genérico y verdadero posible (pedir más información), sin inventar activos';
}

/** La LISTA CERRADA de siguientes pasos posibles (la del funnel primero). Es la
 *  única fuente: los chips de la UI, la sugerencia de la IA y el modo auto
 *  eligen SIEMPRE de acá — nunca un texto libre. */
export async function siguientePasoOpciones(): Promise<string[]> {
  const base = [
    await siguientePasoDefault(),
    've un video de ventas (VSL) y después puede agendar una llamada',
    'recibe un recurso gratis por WhatsApp',
    'recibe una cotización por WhatsApp',
    'se registra a un webinar en vivo',
    'compra directo en la página',
  ];
  return base.filter((o, i) => o && base.indexOf(o) === i);
}

// El mensaje de "no salió por la IA" ya no vive acá: lo arma `errorDeCascada`
// (lib/ai-cheap.ts → lib/ia-mensajes.ts), que es el único que sabe distinguir «no hay
// ninguna IA» de «hay tres cuentas y las tres fallaron». Había TRES copias de esta
// frase en el repo y la de `generarRazones`, veinte líneas más arriba en este mismo
// archivo, decía lo contrario que las otras dos.

// ── Sugerencia de guion: MaKo elige TODO (la IA facilita, no interroga) ──────
// Pedido explícito del dueño: crear un guion se volvió "super complejo, me pide
// muchas preguntas abiertas". La regla nueva: la IA sugiere el ángulo y la
// estructura sola, y si el ángulo trae preguntas para el dueño, las convierte en
// preguntas CERRADAS con opciones concretas sacadas del contexto real — el dueño
// solo toca un botón. NUNCA una pregunta abierta.
export type PreguntaCerrada = { pregunta: string; opciones: string[] };
export type SugerenciaGuion = { anguloId: string; porQue: string; estructuraId: string; siguientePaso: string; preguntas: PreguntaCerrada[] };

export const SUGERIR_GUION_TEMPLATE = `Eres MaKo, PREPARANDO (todavia no escribiendo) el guion de un anuncio de video para Meta. Tu trabajo es que el dueño del negocio no tenga que pensar ni redactar NADA: tú eliges y el, como mucho, toca un boton.

Te paso el contexto del negocio, el avatar y su motivacion de compra (la celda), la biblioteca de ANGULOS de guion y las ESTRUCTURAS disponibles.

1. ANGULO{{anguloFijado}}
- Elegi EL mejor angulo para ESTA celda, respetando los REQUISITOS de cada uno contra el contexto REAL: si el negocio no tiene testimonios/casos/resultados confirmados en el contexto, los angulos que los requieren NO se pueden elegir.
- Si la celda ya tiene guiones de ciertos angulos, elegi uno DISTINTO (para testear enfoques diferentes).
- "porQue": UNA frase simple de por que este angulo para esta celda (se la mostramos al dueño).

2. ESTRUCTURA
- De las estructuras COMPATIBLES del angulo elegido, la que mejor calza para este caso.

3. SIGUIENTE PASO (define el CTA)
- De la LISTA CERRADA de siguientes pasos que te paso, elegi el que mejor calza con el ANGULO y el negocio. Ejemplo: con el angulo de Lead Magnet, el paso natural es el de recibir el recurso — no una llamada. Copia el texto EXACTO de la opcion elegida.

4. PREGUNTAS CERRADAS (maximo 3, pueden ser 0)
El angulo trae preguntas pensadas para sacarle material concreto al dueño. NO se las hagas abiertas: convierte cada una en una pregunta CERRADA con 2 a 4 OPCIONES ya escritas por ti, con material REAL del contexto (SU negocio, SU avatar, SU motivacion). El dueño solo elige la que mas le suena.
- Opciones cortas (maximo ~18 palabras), concretas, en primera persona del dueño cuando aplique.
- Genuinamente DISTINTAS entre si, y TODAS verosimiles para ESTE negocio (nada generico, nada de "otro").
- Si el contexto ya responde una pregunta de una sola manera obvia, NO la incluyas.
- NO inventes datos duros (cifras, nombres de clientes, resultados) que no esten en el contexto.

Devolve EXCLUSIVAMENTE un objeto JSON valido (sin markdown, sin texto afuera):
{"anguloId":"","porQue":"","estructuraId":"","siguientePaso":"","preguntas":[{"pregunta":"","opciones":["",""]}]}`;

const preguntasCerradasDe = (v: unknown): PreguntaCerrada[] => {
  if (!Array.isArray(v)) return [];
  const out: PreguntaCerrada[] = [];
  for (const raw of v.slice(0, 3)) {
    const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const pregunta = str(o.pregunta).slice(0, 200);
    const opciones = (Array.isArray(o.opciones) ? o.opciones : []).map((x) => str(x).slice(0, 180)).filter(Boolean).slice(0, 4);
    if (pregunta && opciones.length >= 2) out.push({ pregunta, opciones });
  }
  return out;
};

export async function sugerirGuion(celdaId: string, opts: { anguloId?: string; timeoutMs?: number } = {}): Promise<{ ok: true; sugerencia: SugerenciaGuion } | { ok: false; error: string }> {
  try {
    const razones = await getRazones();
    const celda = razones.find((r) => r.id === celdaId);
    if (!celda) return { ok: false, error: 'Celda no encontrada.' };
    const [brief, avatares, entregables, angulos, estructuras, pasos] = await Promise.all([
      perfilNegocioTexto(), getAvatares(), getEntregables(), getAngulosGuion(), getEstructurasGuion(), siguientePasoOpciones(),
    ]);
    const activos = angulos.filter((a) => a.activo);
    const activas = estructuras.filter((e) => e.activo);
    const fijado = opts.anguloId ? activos.find((a) => a.id === opts.anguloId) : undefined;
    const candidatos = fijado ? [fijado] : activos;
    if (!candidatos.length) return { ok: false, error: 'No hay ángulos de guion en la biblioteca.' };
    const av = avatares.find((a) => a.id === celda.avatarId);

    const sys = await renderPrompt('razones.sugerir', SUGERIR_GUION_TEMPLATE, {
      anguloFijado: fijado ? ` — YA ELEGIDO: el dueño eligió "${fijado.nombre}" (anguloId "${fijado.id}"). Usa exactamente ese; no lo cambies.` : '',
    });
    const user = `NEGOCIO:
${brief}
${entregables.length ? `LEAD MAGNET: ${entregablesTexto(entregables)}\n` : ''}
LA CELDA (este anuncio):
- AVATAR: ${av ? `${av.nombre} — ${av.segmento}. Situación: ${av.situacion}. Dolor: ${av.dolor}` : '(sin avatar)'}
- MOTIVACIÓN DE COMPRA: ${celda.nombre} — ${celda.descripcion}
- COPY/HOOK: ${celda.copy}
${celda.guiones.length ? `- ÁNGULOS YA USADOS EN ESTA CELDA (elige uno distinto): ${celda.guiones.map((g) => g.anguloNombre).join(', ')}\n` : ''}
BIBLIOTECA DE ÁNGULOS:
${candidatos.map((a) => `- anguloId "${a.id}" · ${a.nombre} · Cuándo: ${a.cuando} · Requisitos: ${a.requisitos || '(sin requisitos)'} · Estructuras compatibles: ${a.estructuras.join(', ') || '(cualquiera)'}${a.preguntas.length ? ` · Preguntas del ángulo para el dueño (convertilas en cerradas): ${a.preguntas.join(' | ')}` : ' · (sin preguntas: devolvé preguntas [])'}`).join('\n')}

ESTRUCTURAS ACTIVAS:
${activas.map((e) => `- estructuraId "${e.id}" · ${e.nombre} · Cuándo: ${e.cuando}`).join('\n')}

SIGUIENTES PASOS POSIBLES (elige UNO, copia el texto exacto; el 1ro es el default del funnel):
${pasos.map((p) => `- "${p}"`).join('\n')}

Devolvé solo el JSON.`;

    const parsear = (t: string): SugerenciaGuion | null => {
      try {
        const raw = parseJsonObject(t);
        const angulo = candidatos.find((a) => a.id === str(raw.anguloId));
        if (!angulo) return null;
        const estructura =
          activas.find((e) => e.id === str(raw.estructuraId) && (!angulo.estructuras.length || angulo.estructuras.includes(e.id))) ??
          angulo.estructuras.map((id) => estructuraPorId(activas, id)).find(Boolean) ??
          activas[0];
        // El siguiente paso tiene que ser UNO de la lista cerrada (si la IA lo
        // parafraseó, se descarta y decide el default del funnel).
        const siguientePaso = pasos.includes(str(raw.siguientePaso)) ? str(raw.siguientePaso) : '';
        return { anguloId: angulo.id, porQue: str(raw.porQue).slice(0, 240), estructuraId: estructura?.id ?? '', siguientePaso, preguntas: preguntasCerradasDe(raw.preguntas) };
      } catch { return null; }
    };

    const errores: string[] = [];
    const text = await chatCheapCascade({
      system: sys, user, json: true, maxTokens: 1400, timeoutMs: opts.timeoutMs,
      feature: 'razones', motivo: fijado ? `Preguntas cerradas del ángulo ${fijado.nombre}` : 'Sugerencia de ángulo y estructura del guion',
      provs: CASCADA_DOCS, modelos: MODELO_DOCS, validar: (t) => parsear(t) !== null,
      erroresOut: errores,
    });
    if (!text) return { ok: false, error: await errorDeCascada(errores, 'preparar el guion') };
    const sugerencia = parsear(text);
    if (!sugerencia) return { ok: false, error: 'MaKo no pudo armar la sugerencia. Reintenta en un momento.' };
    return { ok: true, sugerencia };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Mueve un guion por el pipeline de producción (borrador → publicado). Es una
 *  escritura mínima y quirúrgica a propósito: la vista global de guiones cambia
 *  el estado de UNO sin mandar de vuelta la matriz entera (que pisaría cualquier
 *  edición hecha en otra pestaña mientras tanto). */
export async function setEstadoGuion(celdaId: string, guionId: string, estado: EstadoGuion): Promise<{ ok: true } | { ok: false; error: string }> {
  const razones = await getRazones();
  const celda = razones.find((r) => r.id === celdaId);
  if (!celda) return { ok: false, error: 'Celda no encontrada.' };
  if (!celda.guiones.some((g) => g.id === guionId)) return { ok: false, error: 'Guion no encontrado.' };
  await setRazones(razones.map((r) => (
    r.id === celdaId ? { ...r, guiones: r.guiones.map((g) => (g.id === guionId ? { ...g, estado } : g)) } : r
  )));
  return { ok: true };
}

/**
 * Borra UN guion. Como `setEstadoGuion`, relee del servidor antes de escribir.
 *
 * ⚠️ Es la diferencia entre perder trabajo y no perderlo. La acción `guardar`
 * reemplaza la matriz ENTERA con lo que le mande el cliente: si esa pantalla
 * tenía una copia vieja (porque la otra vista escribió mientras tanto), guardar
 * un cambio chico borra todo lo que no estaba en esa copia. Pasó exactamente
 * así: generabas un guion en la matriz y borrar otro en la galería lo hacía
 * desaparecer.
 */
export async function borrarGuionDeCelda(celdaId: string, guionId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const razones = await getRazones();
  const celda = razones.find((r) => r.id === celdaId);
  if (!celda) return { ok: false, error: 'Celda no encontrada.' };
  if (!celda.guiones.some((g) => g.id === guionId)) return { ok: false, error: 'Guion no encontrado.' };
  await setRazones(razones.map((r) => (
    r.id === celdaId ? { ...r, guiones: r.guiones.filter((g) => g.id !== guionId) } : r
  )));
  return { ok: true };
}

/** Reescribe el TEXTO de un guion, sin tocar el resto de la matriz. */
export async function editarTextoGuion(celdaId: string, guionId: string, texto: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const limpio = texto.trim();
  if (!limpio) return { ok: false, error: 'El guion no puede quedar vacío.' };
  const razones = await getRazones();
  const celda = razones.find((r) => r.id === celdaId);
  if (!celda) return { ok: false, error: 'Celda no encontrada.' };
  if (!celda.guiones.some((g) => g.id === guionId)) return { ok: false, error: 'Guion no encontrado.' };
  await setRazones(razones.map((r) => (
    r.id === celdaId ? { ...r, guiones: r.guiones.map((g) => (g.id === guionId ? { ...g, texto: limpio } : g)) } : r
  )));
  return { ok: true };
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
Escribe el guion del video con el ángulo "${angulo.nombre}" y la estructura "${estructura.nombre}".`;
    // Sin `erroresOut`, "no hay IA configurada" y "la IA falló" daban EXACTAMENTE
    // el mismo mensaje: a un cliente con su key puesta le decíamos que la conecte
    // (pasó en vivo, con la cuota agotada). El motivo real cambia qué tiene que
    // hacer: esperar, o cargar otra key.
    const errores: string[] = [];
    const texto = await chatCheapCascade({
      system: sys, user, maxTokens: 2200, timeoutMs: opts.timeoutMs,
      feature: 'razones', motivo: `Guion de video (ángulo ${angulo.nombre})`,
      provs: CASCADA_DOCS, modelos: MODELO_DOCS, validar: (t) => t.trim().length > 40,
      erroresOut: errores,
    });
    if (!texto.trim()) return { ok: false, error: await errorDeCascada(errores, 'escribir el guion') };
    const item: GuionItem = {
      id: randomUUID(), anguloId: angulo.id, anguloNombre: angulo.nombre, texto: texto.trim(),
      creadoEn: Date.now(), estado: 'borrador',
      estructuraId: estructura.id, estructuraNombre: estructura.nombre,
    };
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
