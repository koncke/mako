// =============================================================================
// curso-mensajes-texto — QUÉ le dice el curso al cliente y a Mauricio, y CUÁNDO (puro)
// =============================================================================
// Sin 'server-only' a propósito: tests/curso-mensajes.test.ts lo EJECUTA. Acá no se lee ni
// se manda nada; eso vive en lib/curso-mensajes.ts.
//
// ⚠️ LOS CLIENTES DE MAURICIO SON MEXICANOS: todo lo que sale de acá va en español NEUTRO y de
// TÚ («tienes», «avanza», «empieza»), jamás de vos. Los comentarios del repo están escritos de
// vos y copiar de ahí es la forma más fácil de meter un «tenés»: el test lo persigue sobre los
// textos ARMADOS, con datos, no sobre este archivo.
//
// ⚠️ EL LINK ENTRA COMO DATO, nunca lo escribe un modelo: es una firma (lib/curso-acceso.ts) y un
// carácter cambiado es un link que no abre. Estos textos son plantillas fijas con código.
//
// Los textos son cortos a propósito: un WhatsApp que se lee de un vistazo. Lo que pidió
// Mauricio (8/9) es «te recuerdo que ya viene la junta y están estas pendientes», sin deadline
// y sin aprobación previa; el detalle de cada tarea está detrás del link.

import { partesEn } from './cron-aviso';

// ── Piezas ───────────────────────────────────────────────────────────────────

/** Cuántas tareas se nombran en un mensaje; el resto va como «y N más». */
export const TOPE_PENDIENTES = 3;

/** El primer nombre, para el saludo. Vacío si el lead no tiene nombre (el saludo queda «Hola,»). */
export function primerNombreDe(nombre: string | null | undefined): string {
  return String(nombre ?? '').trim().split(/\s+/)[0] ?? '';
}

const saludo = (nombre: string | null | undefined): string => {
  const n = primerNombreDe(nombre);
  return n ? `Hola ${n},` : 'Hola,';
};

/** Un título en una línea: sin saltos y con tope, para que un título largo no se coma el mensaje. */
function renglon(t: string, max = 80): string {
  const s = String(t ?? '').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/** La lista de pendientes: hasta `tope` títulos y, si hay más, «y N más». */
export function listaPendientes(titulos: readonly string[], tope = TOPE_PENDIENTES): string {
  const lineas = titulos.slice(0, tope).map((t) => `· ${renglon(t)}`);
  const resto = titulos.length - tope;
  if (resto > 0) lineas.push(`· y ${resto} más`);
  return lineas.join('\n');
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const mayuscula = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
/** Cierra con punto sin duplicarlo: la hora ya termina en «a. m.» y «a. m..» se lee como un error. */
const conPunto = (s: string) => (s.endsWith('.') ? s : `${s}.`);

// ── Cuándo (la hora del NEGOCIO, no la del server) ───────────────────────────
// El cron corre en UTC; la sesión se le anuncia al cliente en la zona del workspace
// (`tzDeWorkspace`, lib/timezone.ts). `partesEn` es el conversor sin librería que ya usa el
// motor de mensajes agendados (lib/cron-aviso.ts), con su test.

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/**
 * «hoy», «mañana» o «el martes 7», según el DÍA DE CALENDARIO en `tz`, no las horas que faltan.
 *
 * ⚠️ No es «faltan 24 h = mañana»: el previo puede salir a las 9:00 por una sesión de las 8:00
 * del día siguiente (23 h) o a las 20:00 por una de mañana a las 10:00 (14 h), y una sesión
 * agendada con pocas horas sale el mismo día. Decir «mañana» por las horas mentiría.
 */
export function cuandoEs(fecha: Date, ahora: Date, tz: string): string {
  const a = partesEn(tz, ahora);
  const f = partesEn(tz, fecha);
  const dias = Math.round((Date.UTC(f.y, f.m - 1, f.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'mañana';
  if (dias === -1) return 'ayer';
  return `el ${DIAS[f.dow]} ${f.d}`;
}

/** La hora como se dice en México: «10:00 a. m.», «4:30 p. m.». Armada a mano: el ICU de cada Node la escribe distinto. */
export function horaDe(fecha: Date, tz: string): string {
  const p = partesEn(tz, fecha);
  const h12 = p.h % 12 || 12;
  return `${h12}:${String(p.min).padStart(2, '0')} ${p.h < 12 ? 'a. m.' : 'p. m.'}`;
}

/**
 * «en 52 minutos», «en 1 hora»: lo que falta AL SALIR, no lo que faltaba al programarse.
 *
 * Vivía en lib/recordatorio-lead.ts (que lo re-exporta). Se mudó acá, al lado de `cuandoEs` y `horaDe`, en la
 * undécima tanda (11/10/2026): es el dato `{{reunion_faltan}}` del «{ }» (lib/variables-del-lead.ts), y las
 * tres formas de decir una reunión tienen que vivir juntas.
 */
export function faltanTexto(minutos: number): string {
  const m = Math.max(0, Math.round(minutos));
  if (m < 1) return 'ahora';
  if (m < 60) return `en ${m} ${m === 1 ? 'minuto' : 'minutos'}`;
  const h = Math.round(m / 60);
  return `en ${h} ${h === 1 ? 'hora' : 'horas'}`;
}

// ── CUÁNDO toca cada mensaje de una llamada ──────────────────────────────────
// El cron corre cada hora. Las ventanas son anchas a propósito: una corrida que falla, o una
// hora fuera de horario, no pierde el mensaje — lo toma la corrida siguiente. Lo que impide
// que salga dos veces es la marca con compare-and-set (lib/curso-mensajes.ts), no la ventana.

/** El previo sale cuando faltan como mucho estas horas… */
const PREVIO_DESDE_HORAS = 24;
/** …y como poco éstas: un «te recuerdo tu sesión» a minutos de empezar llega tarde y molesta. */
const PREVIO_HASTA_HORAS = 1;
/** El posterior sale pasadas estas horas (que la llamada haya terminado)… */
const POSTERIOR_DESDE_HORAS = 2;
/** …y hasta éstas: después de dos días ya no es «después de la llamada», es ruido. */
const POSTERIOR_HASTA_HORAS = 48;

/** El rango de fechas que el cron tiene que leer para no perderse ninguna sesión en ventana. */
export function ventanaDeSesiones(ahora: Date): { desde: string; hasta: string } {
  const t = ahora.getTime();
  return {
    desde: new Date(t - POSTERIOR_HASTA_HORAS * 3_600_000).toISOString(),
    hasta: new Date(t + PREVIO_DESDE_HORAS * 3_600_000).toISOString(),
  };
}

export type FaseSesion = 'previo' | 'posterior';

/** ¿Qué mensaje le toca HOY a esta sesión? `null` = ninguno (fuera de ventana o ya marcado). */
export function faseDeSesion(
  s: { fecha: string; avisoPrevioAt: string | null; avisoPosteriorAt: string | null },
  ahora: Date,
): FaseSesion | null {
  const t = Date.parse(s.fecha);
  if (!Number.isFinite(t)) return null;
  const faltanH = (t - ahora.getTime()) / 3_600_000;
  if (!s.avisoPrevioAt && faltanH > PREVIO_HASTA_HORAS && faltanH <= PREVIO_DESDE_HORAS) return 'previo';
  const pasaronH = -faltanH;
  if (!s.avisoPosteriorAt && pasaronH >= POSTERIOR_DESDE_HORAS && pasaronH <= POSTERIOR_HASTA_HORAS) return 'posterior';
  return null;
}

/**
 * ¿Hay que volver a buscar la grabación de esta sesión? Es la JUNTA, que se marca aparte del
 * mensaje de después (`curso_sesiones.aviso_junta_at`, mig 0210).
 *
 * ⚠️ POR QUÉ VA APARTE (06/10/2026, la revisión del grupo). Los compromisos se leían UNA vez,
 * en la corrida que abre la ventana del posterior (2 h después de la hora anotada), y la sesión
 * se marcaba en esa misma corrida. Pero la grabación de una sesión de entrega llega a
 * `closing_analyses` sólo por el cron closing-sync («30 14-23 * * *» UTC: el webhook de Fathom
 * ignora las sesiones de entrega) y después espera su análisis. Una sesión que empieza a las
 * 16:30 de CDMX (22:30 UTC) termina después del último sync del día: el posterior salía con
 * «sin grabación» y los compromisos no le llegaban NUNCA a Mauricio — y si el cliente iba al
 * día, ni siquiera salía aviso.
 *
 * Ahora el posterior sale cuando le toca (al cliente no se lo hace esperar por una grabación) y
 * la junta queda ABIERTA hasta que la grabación se lea: cada corrida vuelve a mirar, mientras
 * dure la ventana del posterior (48 h). Pasado eso la sesión sale de la lectura del cron y la
 * junta queda en NULL, que es lo cierto: nunca llegaron.
 *
 * Sólo DESPUÉS de procesado el posterior: mientras ése no sale, su propio aviso lleva los
 * compromisos si ya están (y su dedup por resultado hace que lleguen una vez).
 */
export function juntaPendiente(
  s: { fecha: string; avisoPosteriorAt: string | null; avisoJuntaAt: string | null },
  ahora: Date,
): boolean {
  if (!s.avisoPosteriorAt || s.avisoJuntaAt) return false;
  const t = Date.parse(s.fecha);
  if (!Number.isFinite(t)) return false;
  const pasaronH = (ahora.getTime() - t) / 3_600_000;
  return pasaronH >= POSTERIOR_DESDE_HORAS && pasaronH <= POSTERIOR_HASTA_HORAS;
}

// ── El motivo de cada fase, en UNA columna ───────────────────────────────────
// `curso_sesiones.aviso_motivo` es una sola columna y las fases son dos. Si cada una la pisara,
// el «después» borraría por qué no salió el «antes», y la marca del antes (que dice «se
// procesó», no «le llegó») quedaría leyéndose como enviado. Por eso cada fase escribe SU
// renglón: «Antes: sin teléfono · Después: al día, no se le escribió».
//
// ⚠️ LA MARCA (`aviso_previo_at`) ES «SE PROCESÓ», NO «LE LLEGÓ»: se escribe ANTES de mandar
// (compare-and-set) y no se deshace si el envío falla. Lo que dice si le llegó es la marca SIN
// motivo de esa fase: quien la pinte pregunta `motivoDeFase` (la ficha, curso-ficha-lectura.ts).

const ETIQUETA_FASE: Record<FaseSesion, string> = { previo: 'Antes', posterior: 'Después' };
const SEP_MOTIVOS = ' · ';

function partesDeMotivo(motivo: string | null | undefined): Partial<Record<FaseSesion, string>> {
  const out: Partial<Record<FaseSesion, string>> = {};
  for (const seg of String(motivo ?? '').split(SEP_MOTIVOS)) {
    const m = /^(Antes|Después): ([\s\S]+)$/.exec(seg.trim());
    if (m) out[m[1] === 'Antes' ? 'previo' : 'posterior'] = m[2].trim();
  }
  return out;
}

/** Por qué NO salió el mensaje de esa fase. `null` = no hay motivo anotado (salió, o todavía no tocó). */
export function motivoDeFase(motivo: string | null | undefined, fase: FaseSesion): string | null {
  return partesDeMotivo(motivo)[fase] ?? null;
}

/** El valor nuevo de la columna con el motivo de UNA fase puesto (o sacado, con `null`). La otra fase no se toca. */
export function conMotivoDeFase(motivo: string | null | undefined, fase: FaseSesion, nuevo: string | null): string | null {
  const p = partesDeMotivo(motivo);
  // Un error de un proveedor puede traer cualquier cosa: sin el separador y en un renglón corto.
  const limpio = nuevo ? nuevo.replace(/\s+/g, ' ').split(SEP_MOTIVOS).join(', ').trim().slice(0, 200) : '';
  if (limpio) p[fase] = limpio; else delete p[fase];
  const segs = (['previo', 'posterior'] as const).filter((f) => p[f]).map((f) => `${ETIQUETA_FASE[f]}: ${p[f]}`);
  return segs.length ? segs.join(SEP_MOTIVOS) : null;
}

/** Horario en el que se le escribe a un cliente: de 9 a 21 en la zona del negocio (el mismo del motor de nutrición). */
const HORARIO_DESDE = 9;
const HORARIO_HASTA = 21;

/**
 * ¿Se le puede escribir AHORA? Fuera de horario el cron no marca nada y espera a la corrida
 * siguiente: una sesión de las 20:00 recibe su posterior a las 9:00 del otro día, no a las 22:00.
 */
export function enHorarioDeMensajes(ahora: Date, tz: string): boolean {
  const h = partesEn(tz, ahora).h;
  return h >= HORARIO_DESDE && h < HORARIO_HASTA;
}

// ── Los mensajes al CLIENTE ──────────────────────────────────────────────────

/** El link del portal, a mano desde la ficha. */
export function textoLinkCurso(p: { nombre: string | null; link: string }): string {
  return `${saludo(p.nombre)} este es tu acceso al programa:\n${p.link}\n\nEs personal: ahí ves tus clases y tus tareas.`;
}

/**
 * Entró a una etapa con clases. `anterior` = el rótulo de la etapa que terminó; `null` si es la
 * primera (no hay nada que felicitar).
 */
export function textoEntradaAEtapa(p: { nombre: string | null; anterior: string | null; nueva: string; clases: number; link: string }): string {
  const abre = `Ya tienes abierta *${p.nueva}*: ${plural(p.clases, 'clase', 'clases')}.`;
  const primera = p.anterior ? `${saludo(p.nombre)} terminaste *${p.anterior}*. ${abre}` : `${saludo(p.nombre)} ${abre[0].toLowerCase()}${abre.slice(1)}`;
  return `${primera}\nEmpieza aquí: ${p.link}`;
}

/**
 * Lo que le queda de la etapa, como bloque. `null` = la etapa no tiene clases cargadas: no se
 * dice ni «te falta» ni «vas al día», porque las dos serían mentira.
 */
function bloquePendientes(etapa: string, pendientes: readonly string[] | null): string {
  if (pendientes == null) return '';
  if (!pendientes.length) return `\nVas al día con *${etapa}*.`;
  return `\nDe *${etapa}* te queda pendiente:\n${listaPendientes(pendientes)}`;
}

/** El día antes de la llamada. Sin pendientes dice que va al día. */
export function textoPrevioCliente(p: {
  nombre: string | null; cuando: string; hora: string; etapa: string; pendientes: readonly string[] | null; link: string;
}): string {
  return `${saludo(p.nombre)} te recuerdo tu sesión ${p.cuando} a las ${conPunto(p.hora)}${bloquePendientes(p.etapa, p.pendientes)}\n\nAvanza aquí: ${p.link}`;
}

/**
 * Después de la llamada, lo que le quedó pendiente. `null` = NO SE MANDA: sin pendientes no hay
 * nada que pedirle, y un «gracias, no te falta nada» por cada llamada es un mensaje de más.
 *
 * ⚠️ Sin «la sesión de hoy»: fuera de horario el posterior sale a la mañana siguiente.
 */
export function textoPosteriorCliente(p: { nombre: string | null; etapa: string; pendientes: readonly string[] | null; link: string }): string | null {
  if (!p.pendientes?.length) return null;
  return `${saludo(p.nombre)} gracias por la sesión.${bloquePendientes(p.etapa, p.pendientes)}\n\nAvanza aquí: ${p.link}`;
}

// ── Los compromisos de la junta (SÓLO para Mauricio) ─────────────────────────
// Lo que Mauricio pidió el 8/9: «después de cada junta… los compromisos». Decidido el
// 06/10/2026 (opción a): van en el aviso POSTERIOR AL DUEÑO y nunca al cliente — un texto que
// redactó un modelo no le sale solo a un cliente que paga; Mauricio decide qué reenvía.
//
// Salen de la GRABACIÓN de esa sesión: `closing_analyses` del mismo lead, categoría
// `entrega_servicio`, analizada con la versión 3 en adelante (la que escribe `proximos_pasos`,
// otro grupo de trabajo), con `started_at` adentro de una ventana alrededor de la hora de la
// sesión. `curso_sesiones` no tiene `recording_id`: el cruce es lead + hora, y por eso vive
// acá, puro y con test.

/** Un próximo paso de la junta. Contrato de `closing_analyses.proximos_pasos`. */
export type PasoJunta = { que: string; quien: 'cliente' | 'equipo' | null };

/**
 * Lo que se sabe de la junta de UNA sesión. Son tres estados y no dos: «no hay grabación
 * analizada» y «no pude leerla» se dicen distinto, como todo en esta casa.
 */
export type CompromisosJunta =
  | { estado: 'leida'; pasos: PasoJunta[] }
  | { estado: 'sin-grabacion' }
  | { estado: 'error' };

/** La grabación puede arrancar antes de la hora anotada (como mucho esto)… */
export const GRABACION_ANTES_HORAS = 2;
/** …y después (una llamada que empezó tarde, o una segunda parte). */
export const GRABACION_DESPUES_HORAS = 6;

/** El rango de `started_at` que hay que leer para una sesión. */
export function ventanaDeGrabacion(fechaSesion: string): { desde: string; hasta: string } | null {
  const t = Date.parse(fechaSesion);
  if (!Number.isFinite(t)) return null;
  return {
    desde: new Date(t - GRABACION_ANTES_HORAS * 3_600_000).toISOString(),
    hasta: new Date(t + GRABACION_DESPUES_HORAS * 3_600_000).toISOString(),
  };
}

/**
 * Las sesiones del mismo lead que podrían reclamar una grabación de ESTA ventana: una
 * grabación a la hora t entra en la ventana de las sesiones entre t − DESPUÉS y t + ANTES.
 */
export function ventanaDeSesionesVecinas(fechaSesion: string): { desde: string; hasta: string } | null {
  const t = Date.parse(fechaSesion);
  if (!Number.isFinite(t)) return null;
  const ancho = (GRABACION_ANTES_HORAS + GRABACION_DESPUES_HORAS) * 3_600_000;
  return { desde: new Date(t - ancho).toISOString(), hasta: new Date(t + ancho).toISOString() };
}

/**
 * Los pasos de una grabación, saneados contra el contrato. Lo escribe un modelo en otro
 * proceso: lo que no tenga `que` se descarta, y un `quien` fuera del contrato queda sin rótulo
 * (no se le inventa uno).
 */
export function pasosDeGrabacion(raw: unknown): PasoJunta[] {
  if (!Array.isArray(raw)) return [];
  const out: PasoJunta[] = [];
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue;
    const que = String((p as { que?: unknown }).que ?? '').replace(/\s+/g, ' ').trim();
    if (!que) continue;
    const q = (p as { quien?: unknown }).quien;
    out.push({ que, quien: q === 'cliente' || q === 'equipo' ? q : null });
  }
  return out;
}

/**
 * Qué grabaciones son de ESTA sesión.
 *
 * ⚠️ CADA GRABACIÓN VA A LA SESIÓN MÁS CERCANA de las que la tienen en su ventana, no a todas.
 * Con dos sesiones del mismo lead el mismo día (una a las 10, otra a las 15), una grabación de
 * las 15:05 está adentro de la ventana de las DOS: sin esto, el aviso de la de las 10 —si esa
 * no se grabó— le adjudicaría los compromisos de la de las 15. En un empate gana la sesión que
 * ya había empezado (una llamada arranca tarde más seguido que temprano).
 *
 * `sesiones` son las del lead (incluida ésta); `grabaciones` traen su `startedAt`.
 */
export function grabacionesDeLaSesion<G extends { startedAt: string }>(
  sesion: { id: number; fecha: string },
  sesiones: ReadonlyArray<{ id: number; fecha: string }>,
  grabaciones: readonly G[],
): G[] {
  const todas = sesiones.some((s) => s.id === sesion.id) ? sesiones : [...sesiones, sesion];
  const dentro = (g: number, s: number) => g >= s - GRABACION_ANTES_HORAS * 3_600_000 && g <= s + GRABACION_DESPUES_HORAS * 3_600_000;
  return grabaciones.filter((gr) => {
    const g = Date.parse(gr.startedAt);
    if (!Number.isFinite(g)) return false;
    let mejor: { id: number; dist: number; despues: boolean } | null = null;
    for (const s of todas) {
      const t = Date.parse(s.fecha);
      if (!Number.isFinite(t) || !dentro(g, t)) continue;
      const cand = { id: s.id, dist: Math.abs(g - t), despues: g >= t };
      if (!mejor || cand.dist < mejor.dist || (cand.dist === mejor.dist && cand.despues && !mejor.despues)) mejor = cand;
    }
    return mejor?.id === sesion.id;
  });
}

/** Los compromisos de una sesión, juntando los pasos de sus grabaciones sin repetir. */
export function compromisosDeGrabaciones(grabaciones: ReadonlyArray<{ startedAt: string; pasos: unknown }>): CompromisosJunta {
  if (!grabaciones.length) return { estado: 'sin-grabacion' };
  const vistos = new Set<string>();
  const pasos: PasoJunta[] = [];
  for (const g of [...grabaciones].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt))) {
    for (const p of pasosDeGrabacion(g.pasos)) {
      const k = `${p.quien ?? ''}|${p.que.toLowerCase()}`;
      if (vistos.has(k)) continue;
      vistos.add(k);
      pasos.push(p);
    }
  }
  return { estado: 'leida', pasos };
}

/**
 * ¿La junta queda CERRADA con esto? Sólo con la grabación LEÍDA (con pasos o sin ellos: «se
 * analizó y no dejó ninguno» también es una respuesta). «Sin grabación» y «no pude leerla»
 * dejan la junta abierta y la corrida siguiente vuelve a mirar (`juntaPendiente`).
 */
export function juntaResuelta(c: CompromisosJunta | null | undefined): c is Extract<CompromisosJunta, { estado: 'leida' }> {
  return c?.estado === 'leida';
}

/** Cuántos compromisos se nombran; el resto va como «y N más». */
export const TOPE_COMPROMISOS = 6;

const QUIEN: Record<'cliente' | 'equipo', string> = { cliente: 'Cliente', equipo: 'Equipo' };

function lineasCompromisos(pasos: readonly PasoJunta[]): string {
  const lineas = pasos.slice(0, TOPE_COMPROMISOS).map((p) => `· ${p.quien ? `${QUIEN[p.quien]}: ` : ''}${renglon(p.que, 100)}`);
  const resto = pasos.length - TOPE_COMPROMISOS;
  if (resto > 0) lineas.push(`· y ${resto} más`);
  return lineas.join('\n');
}

/**
 * El bloque de la junta en el aviso al dueño. Vacío = no aplica (no se pidió).
 *
 * «todavía»: desde el 06/10/2026 la junta sigue abierta después de este aviso y, si la
 * grabación llega dentro de la ventana, los compromisos le llegan en uno aparte
 * (`textoJuntaDueno`). Sin la palabra se leía como «esta junta no se grabó».
 */
function bloqueCompromisos(c: CompromisosJunta | null | undefined): string {
  if (!c) return '';
  if (c.estado === 'error') return '\nNo pude leer la grabación.';
  if (c.estado === 'sin-grabacion') return '\nSin grabación analizada todavía.';
  if (!c.pasos.length) return '\nLa grabación no dejó próximos pasos.';
  return `\nDe la junta:\n${lineasCompromisos(c.pasos)}`;
}

/**
 * La clave de dedup del aviso al dueño de UNA sesión.
 *
 * ⚠️ DEPENDE DEL RESULTADO, y es lo que arregla el aviso que se comía al corregido. Con la
 * clave `sesion:<id>` a secas y 72 h de dedup, el aviso «No le escribí: envío de WhatsApp
 * apagado» (que se repite cada hora mientras la sesión espera) dejaba deduplicado el «Ya le
 * mandé el recordatorio» de cuando el negocio lo prendía. Ahora cada resultado tiene su
 * clave: el mismo resultado no se repite cada hora, y un resultado NUEVO sale una vez.
 *
 * Los compromisos entran a la clave sólo como «los tiene / no los tiene»: si la grabación se
 * analiza mientras la sesión espera, a Mauricio le llegan una vez; un «no pude leer» y un
 * «sin grabación» no se alternan como dos avisos distintos.
 */
export function claveAvisoSesion(sesionId: number, noLlego: string | null, compromisos?: CompromisosJunta | null): string {
  const resultado = noLlego ? `no:${noLlego}` : 'ok';
  const junta = compromisos ? (compromisos.estado === 'leida' && compromisos.pasos.length ? ':junta' : ':sin-junta') : '';
  return `sesion:${sesionId}:${resultado}${junta}`;
}

/**
 * La clave del aviso de la junta que llega TARDE (la grabación se leyó después del posterior).
 * Distinta de todas las de `claveAvisoSesion` —que siempre llevan el resultado del cliente en
 * el medio—, así que el posterior que salió «sin grabación» no la deduplica. Lo que impide
 * mandarla dos veces es la marca `aviso_junta_at` con compare-and-set; esto es la red.
 */
export function claveAvisoJunta(sesionId: number): string {
  return `sesion:${sesionId}:junta-tarde`;
}

/** El motivo que va en el aviso al dueño cuando al cliente no se le escribió porque va al día. */
export const NO_TENIA_PENDIENTES = 'no tenía pendientes';

// ── Los avisos a MAURICIO (el dueño) ─────────────────────────────────────────
// Van al grupo «MaKo <> cliente» del workspace por el choke point de avisos (lib/avisos.ts).
// Llevan lo mismo que el cliente —la cuenta y los títulos— y si al cliente NO le llegó, el
// porqué: sin esa línea, Mauricio da por recordado a alguien a quien nadie le escribió.

function estadoDelCliente(fase: FaseSesion, noLlego: string | null): string {
  if (noLlego) return `\nNo le escribí: ${noLlego}.`;
  return fase === 'previo' ? '\nYa le mandé el recordatorio.' : '\nYa le mandé sus pendientes.';
}

function resumenPendientes(etapa: string, pendientes: readonly string[] | null): string {
  if (pendientes == null) return `*${etapa}*, sin clases cargadas.`;
  if (!pendientes.length) return `va al día con *${etapa}*.`;
  return `${plural(pendientes.length, 'tarea pendiente', 'tareas pendientes')} de *${etapa}*:\n${listaPendientes(pendientes)}`;
}

/** «Mañana a las 10:00 a. m. tienes sesión con *Ana*: 3 tareas pendientes de *Norte*». */
export function textoPrevioDueno(p: {
  cliente: string; cuando: string; hora: string; etapa: string; pendientes: readonly string[] | null; noLlego: string | null;
}): string {
  const quien = renglon(p.cliente, 60) || 'un cliente';
  return `${mayuscula(p.cuando)} a las ${p.hora} tienes sesión con *${quien}*: ${resumenPendientes(p.etapa, p.pendientes)}${estadoDelCliente('previo', p.noLlego)}`;
}

/**
 * Después de la llamada: el mismo resumen y, si se leyeron, los compromisos de la junta. Sale
 * con pendientes (ver `textoPosteriorCliente`) o, sin pendientes, sólo si la junta dejó
 * compromisos — es lo único que Mauricio no tiene en otro lado.
 */
export function textoPosteriorDueno(p: {
  cliente: string; etapa: string; pendientes: readonly string[] | null; noLlego: string | null;
  compromisos?: CompromisosJunta | null;
}): string {
  const quien = renglon(p.cliente, 60) || 'un cliente';
  return `Después de la sesión con *${quien}*: ${resumenPendientes(p.etapa, p.pendientes)}${estadoDelCliente('posterior', p.noLlego)}${bloqueCompromisos(p.compromisos)}`;
}

/** El título del aviso en el feed. Corto: es el renglón de la lista. */
export function tituloAvisoDueno(fase: FaseSesion, cliente: string): string {
  const quien = renglon(cliente, 40) || 'un cliente';
  return fase === 'previo' ? `Sesión con ${quien}` : `Pendientes de ${quien}`;
}

/**
 * Los compromisos de una junta cuya grabación se leyó DESPUÉS del aviso posterior. Sólo con
 * pasos: «la grabación no dejó próximos pasos» no se manda solo, sería un aviso que no pide
 * nada. Y sólo a Mauricio, igual que en el posterior.
 */
export function textoJuntaDueno(p: { cliente: string; pasos: readonly PasoJunta[] }): string {
  const quien = renglon(p.cliente, 60) || 'un cliente';
  return `De la sesión con *${quien}*:\n${lineasCompromisos(p.pasos)}`;
}

/** El título del aviso de la junta tardía en el feed. */
export function tituloAvisoJunta(cliente: string): string {
  return `Junta con ${renglon(cliente, 40) || 'un cliente'}`;
}

// ── El RECORDATORIO de clases (#780) ─────────────────────────────────────────
// Decisión de Martín (06/10/2026, memoria cs-decisiones-cierre-0610): «por WhatsApp, a los 3 días
// sin entrar al portal, sólo videos sin ver de su etapa». Lo manda el cron horario
// (`correrRecordatoriosDeClases`, lib/curso-mensajes.ts); acá vive lo puro: a quién le toca,
// cuándo, y qué dice. Qué videos son «sin ver» lo decide `videosSinVer` (lib/curso.ts).
//
// ⚠️ NO ES EL PREVIO DE UNA LLAMADA. Ése nombra TAREAS sin enviar y sale el día antes de una
// sesión; éste nombra VIDEOS sin ver y sale cuando el cliente se alejó del portal. Por eso quien
// tiene una sesión cerca (antes O después: el previo y el posterior ya le escriben) se saltea.

/**
 * Días sin contacto con su portal para que le toque: desde su último ingreso, la invitación por
 * mail o el último WhatsApp del curso que le llevó su link — el más reciente de los tres.
 */
export const DIAS_SIN_ENTRAR = 3;
/** Y como mucho uno cada tantos días: si sigue sin entrar, le vuelve a tocar recién ahí. */
export const DIAS_ENTRE_RECORDATORIOS = 3;
/**
 * Una sesión de la entrega a menos de esto —antes o después— lo saltea. Antes, porque el previo
 * le va a escribir (sale hasta 24 h antes); después, porque el posterior sale de 2 a 48 h después
 * de la llamada. Dos mensajes automáticos del mismo número en el mismo día no suman: restan.
 */
export const SESION_CERCA_HORAS = 48;

const DIA_MS = 86_400_000;

/** Lo que el cron lee de `curso_accesos` para decidir (mig 0202 + 0206 + 0211). */
export type AccesoParaRecordar = {
  revocado: boolean;
  ingresos: number;
  ultimoIngresoAt: string | null;
  /** La invitación POR MAIL (`marcarInvitacion`). El link por WhatsApp NO la escribe: va abajo. */
  invitacionEnviadaAt: string | null;
  /**
   * El último WhatsApp del curso que le LLEGÓ con su link (mig 0211): el «Mandar su link» de la
   * ficha, la etapa nueva, el previo y el posterior de una llamada. Lo escribe `mandar`
   * (lib/curso-mensajes.ts) sólo cuando el envío contestó ok.
   */
  linkEnviadoAt: string | null;
  /** La marca del último recordatorio (mig 0211): «se procesó», no «le llegó». */
  recordatorioAt: string | null;
};

const instante = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
};

/**
 * ¿Es del universo del recordatorio? NO REVOCADO, y le dieron su acceso (invitación por mail o su
 * link por WhatsApp) o ya ENTRÓ alguna vez.
 *
 * ⚠️ «TIENE FILA» NO ES «LO INVITARON» (mig 0206): hubo una época en que abrir la pestaña Curso de
 * la ficha creaba la fila sola, y «Copiar link» la crea hoy sin que se sepa si alguien lo mandó.
 * Un cliente al que nadie le dio el acceso no recibe un «te faltan videos» de un portal que no
 * conoce.
 *
 * ⚠️ EL LINK POR WHATSAPP CUENTA (`linkEnviadoAt`, revisión del 07/10/2026). Sin él quedaba
 * afuera el caso más típico de «nunca entró»: Mauricio le manda el link desde la ficha, el cliente
 * no lo abre, y no tiene invitación por mail ni ingresos.
 */
export function enUniversoDeRecordatorio(a: Pick<AccesoParaRecordar, 'revocado' | 'ingresos' | 'invitacionEnviadaAt' | 'linkEnviadoAt'>): boolean {
  return !a.revocado && (a.invitacionEnviadaAt != null || a.linkEnviadoAt != null || (Number(a.ingresos) || 0) > 0);
}

/**
 * ¿Le toca HOY el recordatorio?
 *
 *   · El ANCLA es el contacto más reciente con su portal: su último ingreso, la invitación por mail
 *     o el último WhatsApp del curso que le llevó su link. Gana la MÁS RECIENTE: quien entró hace
 *     10 días y hoy recibió su link (por mail o por WhatsApp) tuvo contacto hoy, y un «tienes
 *     videos pendientes» una hora después del link es un segundo mensaje que resta.
 *   · Toca a los `DIAS_SIN_ENTRAR` del ancla, y no más de uno cada `DIAS_ENTRE_RECORDATORIOS`.
 *   · ⚠️ FAIL-CLOSED: sin ancla, o con una marca que no se puede leer, NO toca. El default de lo
 *     que le escribe a un cliente es no escribirle.
 */
export function tocaRecordatorio(a: AccesoParaRecordar, ahora: Date): boolean {
  if (!enUniversoDeRecordatorio(a)) return false;
  const anclas = [instante(a.ultimoIngresoAt), instante(a.invitacionEnviadaAt), instante(a.linkEnviadoAt)]
    .filter((x): x is number => x != null);
  if (!anclas.length) return false;
  const t = ahora.getTime();
  if (t - Math.max(...anclas) < DIAS_SIN_ENTRAR * DIA_MS) return false;
  if (a.recordatorioAt != null) {
    const r = instante(a.recordatorioAt);
    if (r == null || t - r < DIAS_ENTRE_RECORDATORIOS * DIA_MS) return false;
  }
  return true;
}

/** El rango de fechas de sesión que hay que leer para saber si alguna está cerca. */
export function ventanaDeSesionCerca(ahora: Date): { desde: string; hasta: string } {
  const t = ahora.getTime();
  return {
    desde: new Date(t - SESION_CERCA_HORAS * 3_600_000).toISOString(),
    hasta: new Date(t + SESION_CERCA_HORAS * 3_600_000).toISOString(),
  };
}

/** ¿Alguna de sus sesiones de la entrega está a menos de `SESION_CERCA_HORAS`, antes o después? */
export function sesionCerca(fechas: readonly string[], ahora: Date): boolean {
  const t = ahora.getTime();
  return fechas.some((f) => {
    const x = instante(f);
    return x != null && Math.abs(x - t) <= SESION_CERCA_HORAS * 3_600_000;
  });
}

/**
 * ¿Sigue en el programa? EN POSITIVO: sin fila en `cs_clientes` (el default: está activo) o con
 * `estado = 'activo'`. Graduado y baja son decisiones de Mauricio (mig 0129) y no reciben nada;
 * PAUSADO tampoco: está suspendido, y «te faltan videos» a quien frenó a propósito es presión que
 * nadie pidió. Un estado nuevo que se agregue mañana queda AFUERA hasta que alguien lo sume acá.
 */
export function sigueEnElPrograma(estado: string | null | undefined): boolean {
  return estado == null || estado === 'activo';
}

/** Los videos pendientes de una etapa: su rótulo y los títulos, en el orden de la etapa. */
export type BloqueVideos = { etapa: string; videos: readonly string[] };

/**
 * El WhatsApp al cliente. `null` = no hay videos pendientes: NO SE MANDA NADA (un «vas al día»
 * cada tres días es un mensaje de más). Con más de un curso (dos productos) va un bloque por etapa.
 * El link es el de SU portal y entra como dato: lo firma el código, nunca un modelo.
 */
export function textoRecordatorioClases(p: { nombre: string | null; bloques: readonly BloqueVideos[]; link: string }): string | null {
  const con = p.bloques.filter((b) => b.videos.length);
  if (!con.length) return null;
  const total = con.reduce((s, b) => s + b.videos.length, 0);
  const cuantos = plural(total, 'video pendiente', 'videos pendientes');
  const cuerpo = con.length === 1
    ? `tienes ${cuantos} de *${con[0].etapa}*:\n${listaPendientes(con[0].videos)}`
    : `tienes ${cuantos}:\n${con.map((b) => `De *${b.etapa}*:\n${listaPendientes(b.videos)}`).join('\n')}`;
  return `${saludo(p.nombre)} ${cuerpo}\n\n${total === 1 ? 'Míralo' : 'Míralos'} aquí: ${p.link}`;
}

/** Lo que pasó con UN cliente en la corrida, para la copia a Mauricio. */
export type RecordatorioHecho = { cliente: string; bloques: readonly BloqueVideos[]; noLlego: string | null };
/** Un cliente al que le tocaba y no se le pudo escribir (sin teléfono, bloqueado…), con el porqué. */
export type RecordatorioSinEscribir = { cliente: string; motivo: string };

const quienEs = (cliente: string) => renglon(cliente, 60) || 'un cliente';

/** Los títulos en una línea: hasta `TOPE_PENDIENTES` y «y N más». */
function titulosEnLinea(titulos: readonly string[]): string {
  const vis = titulos.slice(0, TOPE_PENDIENTES).map((t) => renglon(t, 50));
  const resto = titulos.length - TOPE_PENDIENTES;
  return resto > 0 ? `${vis.join(', ')} y ${resto} más` : vis.join(', ');
}

/**
 * La copia CORTA a Mauricio: a quién se le recordó qué, en UN aviso por corrida (no uno por
 * cliente: diez recordatorios a las 9:00 serían diez WhatsApps al grupo). Lleva también a quién
 * no le llegó y a quién no se le pudo escribir — sin esa línea, Mauricio da por recordado a alguien
 * a quien nadie le escribió. `null` = no hay nada que contarle.
 *
 * ⚠️ Nunca lleva el link del cliente: va a un grupo.
 */
export function textoRecordatorioDueno(p: { hechos: readonly RecordatorioHecho[]; sinEscribir?: readonly RecordatorioSinEscribir[] }): string | null {
  const ok = p.hechos.filter((h) => !h.noLlego);
  const mal = p.hechos.filter((h) => h.noLlego);
  const sin = p.sinEscribir ?? [];
  const partes: string[] = [];
  if (ok.length) {
    const lineas = ok.map((h) => {
      const con = h.bloques.filter((b) => b.videos.length);
      const etapas = con.map((b) => `*${b.etapa}*`).join(', ');
      return `· *${quienEs(h.cliente)}* (${etapas}): ${titulosEnLinea(con.flatMap((b) => [...b.videos]))}`;
    });
    partes.push(`${ok.length === 1 ? 'Le' : 'Les'} recordé sus videos pendientes a ${plural(ok.length, 'cliente', 'clientes')} con ${DIAS_SIN_ENTRAR} días sin entrar:\n${lineas.join('\n')}`);
  }
  if (mal.length) partes.push(`No ${mal.length === 1 ? 'le' : 'les'} llegó el recordatorio:\n${mal.map((h) => `· *${quienEs(h.cliente)}*: ${h.noLlego}`).join('\n')}`);
  if (sin.length) partes.push(`No ${sin.length === 1 ? 'le' : 'les'} pude escribir:\n${sin.map((s) => `· *${quienEs(s.cliente)}*: ${s.motivo}`).join('\n')}`);
  return partes.length ? partes.join('\n') : null;
}

/** El título del aviso en el feed. */
export const TITULO_AVISO_RECORDATORIO = 'Recordatorio de clases';

/**
 * La clave de dedup de la copia. Lo que impide recordarle dos veces a un cliente es la marca
 * `recordatorio_at` con compare-and-set; esto es la red de la copia.
 *
 * ⚠️ LLEVA LOS CLIENTES, NO SÓLO LA HORA. Dos corridas del mismo tick (un reintento de Vercel) se
 * reparten clientes DISTINTOS gracias al CAS: con una clave por hora, la copia de la segunda se
 * deduplicaría y Mauricio no se enteraría de esos recordatorios, que sí salieron.
 */
export function claveAvisoRecordatorio(ws: number, leadIds: readonly number[], ahora: Date): string {
  const ids = [...new Set(leadIds)].sort((a, b) => a - b).join('-');
  return `recordatorio:${ws}:${ahora.toISOString().slice(0, 13)}:${ids}`;
}

// ── El reloj del cron (revisión del 07/10/2026) ──────────────────────────────
// La función de Vercel muere a los `maxDuration` segundos, y lo que muere con ella es la COPIA a
// Mauricio: los recordatorios ya salieron y quedaron marcados (la marca va antes del envío), pero
// la copia se arma con lo que se hizo en ESTA corrida, que vive sólo en memoria. Si la función se
// corta antes de mandarla, Mauricio no se entera nunca de lo que se le escribió a sus clientes —
// que es justo lo que pidió ver. Antes había un presupuesto de 90 s sobre 120 sin nada reservado
// para lo que viene DESPUÉS del último envío: un envío que arranca a los 89 s (hasta 30 s) más la
// copia (otros 30 s de grupo, más el mail) pasaba los 120.
//
// Por eso el último recordatorio se EMPIEZA con tiempo para terminarlo entero y para la copia.

/**
 * Lo más que puede tardar UN pedido a Evolution: el tope de `evFetch` (lib/evolution.ts) y el de
 * `ev` (lib/mako-grupo.ts), los dos 30 s. El `delay` de tipeo (hasta ~10,8 s) va adentro de ese
 * tope: Evolution retiene el pedido mientras «escribe». tests/curso-recordatorio.test.ts lee los
 * dos topes del fuente y falla si alguno crece por encima de éste.
 */
export const TOPE_PEDIDO_EVOLUTION_MS = 30_000;
/** Un recordatorio desde la marca: la marca, la línea, el envío con su tope, el espejo en `wa_mensajes` y los motivos. */
export const RESERVA_RECORDATORIO_MS = TOPE_PEDIDO_EVOLUTION_MS + 5_000;
/**
 * La copia a Mauricio (`emitirAviso`): el grupo de MaKo con su tope, el mail —Resend no tiene tope
 * propio: se le dan unos segundos— y las escrituras del aviso (feed, dedup, turno del grupo).
 */
export const RESERVA_COPIA_MS = TOPE_PEDIDO_EVOLUTION_MS + 10_000;
/** Lo que la función gastó antes de `inicio` (arranque, auth) y el cierre de la respuesta. */
export const MARGEN_CIERRE_MS = 5_000;

/**
 * Hasta qué momento (epoch ms) se puede EMPEZAR un recordatorio sin poner en riesgo la copia a
 * Mauricio. Con `maxDuration = 120`: 120 − 35 − 40 − 5 = 40 s desde que arrancó la corrida. Las
 * llamadas de la entrega corren antes y se comen de ese mismo reloj; lo que no entra, sale la hora
 * siguiente (la marca no se escribe sin mandar).
 */
export function ultimoInicioDeRecordatorio(inicioMs: number, maxDuracionS: number): number {
  return inicioMs + maxDuracionS * 1000 - RESERVA_RECORDATORIO_MS - RESERVA_COPIA_MS - MARGEN_CIERRE_MS;
}
