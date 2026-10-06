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

/** Después de la llamada: el mismo resumen. Sólo se emite con pendientes (ver `textoPosteriorCliente`). */
export function textoPosteriorDueno(p: { cliente: string; etapa: string; pendientes: readonly string[] | null; noLlego: string | null }): string {
  const quien = renglon(p.cliente, 60) || 'un cliente';
  return `Después de la sesión con *${quien}*: ${resumenPendientes(p.etapa, p.pendientes)}${estadoDelCliente('posterior', p.noLlego)}`;
}

/** El título del aviso en el feed. Corto: es el renglón de la lista. */
export function tituloAvisoDueno(fase: FaseSesion, cliente: string): string {
  const quien = renglon(cliente, 40) || 'un cliente';
  return fase === 'previo' ? `Sesión con ${quien}` : `Pendientes de ${quien}`;
}
