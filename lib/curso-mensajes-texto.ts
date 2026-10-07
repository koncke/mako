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
