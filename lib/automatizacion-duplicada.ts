// =============================================================================
// automatizacion-duplicada — «a la misma gente ya le escribe otra automatización»
// =============================================================================
// 20/10/2026, el Recurrente de Leila (ws11): #282 «Recordatorio clase reactivación» y el d2 de #284 «Recordatorio
// martes sesión LíderMente» iban a la MISMA cohorte (la etapa «reactivacion» del funnel 4) con casi el mismo recordatorio.
// Con las dos activas, cada lead lo recibía dos veces. Al activar o publicar se pregunta (no frena: puede ser a propósito).
//
// ⚠️ EL AVISO SE DECIDE POR HECHOS, NO POR PARECIDO (21/10/2026, después de TRES rondas de reglas sobre el texto: el
// umbral de parecido, la firma calculada de «la mayoría» y la firma al arranque). Cada regla arreglaba unos pares y rompía
// otros: un recordatorio corto con el nombre del negocio pasaba callado, un saludo con «!» hacía «parecidos» dos mensajes
// distintos. La red es que la PERSONA compare (AGENTS.md): se avisa SIEMPRE que otra automatización ACTIVA le escribe a la
// misma gente, por el mismo canal y con horarios que se pisan, y el aviso muestra el arranque de los dos mensajes uno al
// lado del otro. Un aviso así nunca es falso: es un hecho que la persona lee. El parecido sólo ORDENA cuál mostrar.
//
// Misma gente = algún CRON de cada una alcanza a la misma cohorte: la misma etapa del mismo funnel (o de cualquiera: un
// funnel sin elegir es «todos»), la misma etapa de entrega del mismo producto, o la misma etiqueta. ⚠️ Y POR EVENTO TAMBIÉN
// (revisión del 21/10/2026): «un evento no tiene cohorte que se pise» era falso. `enrolarPorEvento` (lib/nutricion.ts)
// inscribe al lead en TODAS las activas del disparador, así que dos con el mismo disparador y el mismo evento (dos «Te
// envía un DM», dos «Se aprueba un pago», dos «Agendó sin confirmar») le escriben a la misma persona. Lo más común:
// «Duplicar» una de DM y prender la copia. ⚠️ Y «el mismo disparador» no alcanza (segunda revisión, 21/10/2026): el motor
// junta disparadores DISTINTOS bajo un mismo evento (`TRIGGERS_POR_EVENTO`, lib/nutricion-eventos.ts). Un lead nuevo
// entra a «Dejó el formulario sin agendar» y a «Un Lead Entró» (la etapa «lead») a la vez; una reserva, a «Agendó pero
// no confirmó» y a «Un Lead Agendó Llamada» (la etapa «agenda»).
//
// Puro: lo usan la tab (SecuenciaPerfil, SimuladorWhatsApp) y el server (`duplicadaDeLaActivacion`, lib/nutricion.ts).
// =============================================================================

import { claseDe, esNodoMensaje, idDe, nodoPorId, raizSalida, type PasoGrafo } from './flujo-grafo';
import { subarbolRespuesta } from './flujo-conversacion';
import { partesDe } from './mensaje-partes';
import { sanearCron, DIA_MES_MAX } from './cron-aviso';
import { TRIGGER_ETAPA, TRIGGER_ENTREGA, TRIGGER_ETIQUETA } from './nutricion-etapa';
import { TRIGGER_ETIQUETA_AGREGADA, TRIGGERS_SOLO_EVENTO } from './disparadores';
import { FAMILIA_POST_AGENDA } from './nutricion-familias';
import { TRIGGERS_POR_EVENTO, ETAPA_DEL_EVENTO, type EventoNutricion } from './nutricion-eventos';

/** Lo que se compara de un CRON (un `Disparador`, lib/disparadores.ts). */
export type CronParaComparar = {
  trigger_tipo: string;
  etapa?: string | null;
  etapas?: readonly string[] | null;
  funnel_id?: number | string | null;
  producto_id?: number | string | null;
  etiqueta_id?: number | string | null;
  /** Por evento: CUÁL (el DM, el pago aprobado…). */
  subtipo?: string | null;
  /** «Se agrega / se elimina etiqueta a un lead»: las que no disparan. */
  ignorar?: readonly (number | string)[] | null;
  /** El horario de un Recurrente; ausente = escribe cuando el lead entra. */
  cron?: unknown;
};
export type AutoParaComparar = { id: number; nombre: string; activa: boolean; disparadores: readonly CronParaComparar[]; pasos: readonly PasoGrafo[] };

const id = (v: unknown): string | null => {
  const n = Number(v);
  return v == null || v === '' || !Number.isFinite(n) ? null : String(n);
};
const etapasDeCron = (d: CronParaComparar): string[] =>
  (d.etapas?.length ? d.etapas : [d.etapa ?? '']).map((e) => String(e ?? '').trim()).filter(Boolean);

/** «Se agrega etiqueta» (cualquiera, salvo `ignorar`) contra «Se le puso la etiqueta N»: el lead al que le ponen la N entra a las dos. */
const agregadaCruza = (x: CronParaComparar, y: CronParaComparar): boolean => {
  if (x.trigger_tipo !== TRIGGER_ETIQUETA_AGREGADA || y.trigger_tipo !== TRIGGER_ETIQUETA) return false;
  const n = id(y.etiqueta_id);
  return n != null && !(x.ignorar ?? []).some((i) => id(i) === n);
};

/**
 * ¿EL MOTOR METE A ESTE CRON CON ESTE EVENTO, sin preguntar cuál? Los de antes del evento (un lead nuevo: «Dejó el
 * formulario sin agendar», «Vio poco el VSL»…; una reserva: «Agendó pero no confirmó» y las dos mitades de la
 * post-agenda), y la etapa en la que cae el lead con ese evento (`ETAPA_DEL_EVENTO`). Los que el motor filtra por CUÁL
 * (la etapa del evento de etapa, la entrega, la etiqueta, los canales y los pagos) tienen su propia regla.
 */
function entraConElEvento(d: CronParaComparar, ev: EventoNutricion): boolean {
  const t = d.trigger_tipo;
  if (t === TRIGGER_ETAPA) { const e = ETAPA_DEL_EVENTO[ev]; return e != null && etapasDeCron(d).includes(e); }
  if (t === TRIGGER_ENTREGA || t === TRIGGER_ETIQUETA || TRIGGERS_SOLO_EVENTO.has(t)) return false;
  return TRIGGERS_POR_EVENTO[ev].includes(t);
}
const EVENTOS = Object.keys(TRIGGERS_POR_EVENTO) as EventoNutricion[];

/**
 * ¿Dos disparadores DISTINTOS que el motor inscribe con el MISMO evento? Salvo las dos mitades de la post-agenda («ya le
 * hablamos» y «primer contacto»), que se excluyen entre sí (`secuenciasParaElLead`, lib/nutricion-familias.ts).
 */
function mismoEvento(a: CronParaComparar, b: CronParaComparar): boolean {
  if (FAMILIA_POST_AGENDA.includes(a.trigger_tipo) && FAMILIA_POST_AGENDA.includes(b.trigger_tipo)) return false;
  return EVENTOS.some((ev) => entraConElEvento(a, ev) && entraConElEvento(b, ev));
}

/**
 * ¿Estos dos CRON alcanzan a la misma gente? La etapa (del mismo funnel), la entrega (del mismo producto), la etiqueta
 * (la misma, o «cualquiera» contra una que no ignora), y por EVENTO el mismo disparador con el mismo evento (`subtipo`):
 * el motor inscribe al lead en todas las activas de ese disparador. Dos disparadores distintos que entran con el mismo
 * evento, también (`mismoEvento`). Un evento de antes («Agendó sin confirmar») barre por el funnel de la FILA, que el CRON
 * no lleva (`higiene`, lib/disparadores.ts): ante la duda, se avisa. «A mano» no: ahí no entra nadie solo.
 */
export function mismaCohorte(a: CronParaComparar, b: CronParaComparar): boolean {
  if (agregadaCruza(a, b) || agregadaCruza(b, a)) return true;
  if (a.trigger_tipo !== b.trigger_tipo) return mismoEvento(a, b);
  const t = a.trigger_tipo;
  const cruzan = (): boolean => { const eb = new Set(etapasDeCron(b)); return etapasDeCron(a).some((e) => eb.has(e)); };
  if (t === TRIGGER_ETAPA) {
    const fa = id(a.funnel_id); const fb = id(b.funnel_id);
    return (fa == null || fb == null || fa === fb) && cruzan();
  }
  if (t === TRIGGER_ENTREGA) return id(a.producto_id) != null && id(a.producto_id) === id(b.producto_id) && cruzan();
  if (t === TRIGGER_ETIQUETA) return id(a.etiqueta_id) != null && id(a.etiqueta_id) === id(b.etiqueta_id);
  if (!t || t === 'manual') return false;
  return String(a.subtipo ?? '') === String(b.subtipo ?? '');
}

/** A menos de esto, dos horarios de días distintos se pisan igual (las 23:30 de un día y las 00:30 del siguiente). */
const CERCA_MIN = 12 * 60;
const DIA_MIN = 24 * 60;

/**
 * ¿LOS HORARIOS DE ESTOS DOS CRON SE PISAN? Sí, salvo dos Recurrentes que no comparten ningún día: semanales en días
 * distintos, o mensuales en días del mes distintos, y a 12 horas o más. Uno que escribe al entrar (sin horario) se pisa
 * con cualquiera. Ante la duda (un horario que no se entiende, unidades distintas), se pisan: se avisa.
 * ⚠️ Los días se comparan sólo en la MISMA zona (revisión del 21/10/2026): «lunes 23:30» de Tijuana y «martes 00:30» de
 * Ciudad de México salen en el mismo instante. Con zonas distintas (`tz` de cada CRON; sin `tz`, la del negocio), se pisan.
 */
export function horariosSePisan(a: unknown, b: unknown): boolean {
  const ca = a == null ? null : sanearCron(a);
  const cb = b == null ? null : sanearCron(b);
  if (!ca || !cb) return true;
  if ((ca.tz ?? '') !== (cb.tz ?? '')) return true;
  const enElDia = (c: typeof ca): number => c.hora * 60 + c.minuto;
  if (ca.unidad === 'semana' && cb.unidad === 'semana') {
    const dias = (c: typeof ca) => new Set(c.dias?.length ? c.dias : c.diaSemana != null ? [c.diaSemana] : []);
    const da = dias(ca); const db = dias(cb);
    if (!da.size || !db.size) return true;
    const SEMANA = 7 * DIA_MIN;
    for (const x of da) for (const y of db) {
      const d = Math.abs((x * DIA_MIN + enElDia(ca)) - (y * DIA_MIN + enElDia(cb)));
      if (x === y || Math.min(d, SEMANA - d) < CERCA_MIN) return true;
    }
    return false;
  }
  if (ca.unidad === 'mes' && cb.unidad === 'mes' && ca.ordinal == null && cb.ordinal == null && ca.diaMes != null && cb.diaMes != null) {
    if (ca.diaMes === cb.diaMes) return true;
    // Con la vuelta del mes: el 28 a las 23 y el 1 a la 1 quedan a dos horas en febrero (el día va hasta `DIA_MES_MAX`).
    const MES = DIA_MES_MAX * DIA_MIN;
    const d = Math.abs((ca.diaMes * DIA_MIN + enElDia(ca)) - (cb.diaMes * DIA_MIN + enElDia(cb)));
    return Math.min(d, MES - d) < CERCA_MIN;
  }
  return true;
}

/** El primer mensaje de la salida (sin «Si responde»): la primera tarjeta que se le manda al lead, con su canal. */
export function primerMensajeDe(pasos: readonly PasoGrafo[]): { texto: string; canal: string } | null {
  const respuestas = subarbolRespuesta(pasos);
  const texto = (p: PasoGrafo): string =>
    partesDe(p as Parameters<typeof partesDe>[0]).map((x) => (x.tipo === 'audio' ? '' : x.cuerpo ?? '')).join('\n').trim();
  const de = (p: PasoGrafo) => ({ texto: texto(p), canal: String(p.canal ?? 'whatsapp') });
  // Desde la raíz, saltando las esperas y los «ir a» (una condición abre caminos: ahí se cae a la primera del orden).
  let actual = raizSalida(pasos);
  for (let i = 0; actual && i < 12; i++) {
    const p = nodoPorId(pasos, actual);
    if (!p) break;
    if (esNodoMensaje(p) && texto(p)) return de(p);
    if (claseDe(p) !== 'esperar' && claseDe(p) !== 'ir_a' && !esNodoMensaje(p)) break;
    actual = p.siguiente ?? null;
  }
  let sinTexto: { texto: string; canal: string } | null = null;
  for (let i = 0; i < pasos.length; i++) {
    const p = pasos[i];
    if (!esNodoMensaje(p) || respuestas.has(idDe(p, i))) continue;
    if (texto(p)) return de(p);
    sinTexto ??= de(p);
  }
  // Un mensaje sin texto (un audio, un archivo) también le escribe al lead.
  return sinTexto;
}

/** El texto del primer mensaje (vacío si no tiene). */
export const primerMensaje = (pasos: readonly PasoGrafo[]): string => primerMensajeDe(pasos)?.texto ?? '';

/** Las palabras con peso: sin `{{datos}}`, sin acentos, sin números, de 4 letras o más. */
export function palabrasConPeso(texto: string): Set<string> {
  const limpio = texto.replace(/\{\{[^}]*\}\}/g, ' ').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return new Set(limpio.split(/[^a-zñ]+/).filter((w) => w.length >= 4));
}

/** Dice entre las palabras con peso de dos textos (0 a 1). SÓLO ORDENA cuál mostrar: nunca decide si se avisa. */
export function parecido(a: string, b: string): number {
  const pa = palabrasConPeso(a); const pb = palabrasConPeso(b);
  if (!pa.size || !pb.size) return 0;
  let comunes = 0;
  for (const w of pa) if (pb.has(w)) comunes++;
  return (2 * comunes) / (pa.size + pb.size);
}

/** Cuánto se muestra del arranque de cada mensaje en el aviso. */
export const LARGO_ARRANQUE = 70;
/**
 * Los caracteres como los ve la persona (grafemas): un emoji, una familia 👨‍👩‍👧 o una letra con tilde son UNO. ⚠️ Cortar por
 * unidades de UTF-16 (`slice`) partía un emoji y dejaba medio par suelto: en pantalla «�», y la pendiente del Doer o de la
 * API (que lleva el aviso) no se podía guardar (revisión del 21/10/2026). Sin `Intl.Segmenter`, por puntos de código.
 */
function grafemas(t: string): string[] {
  const S = typeof Intl !== 'undefined' ? Intl.Segmenter : undefined;
  return S ? Array.from(new S(undefined, { granularity: 'grapheme' }).segment(t), (s) => s.segment) : Array.from(t);
}

/** El arranque de un mensaje para el aviso: en una línea, cortado a `LARGO_ARRANQUE` sin partir una palabra ni un emoji. Sin texto, lo dice. */
export function arranqueParaAviso(texto: string): string {
  const t = texto.replace(/\s+/g, ' ').trim();
  if (!t) return '(un audio o un archivo, sin texto)';
  const g = grafemas(t);
  if (g.length <= LARGO_ARRANQUE) return t;
  const corte = g.slice(0, LARGO_ARRANQUE - 1);
  const espacio = corte.lastIndexOf(' ');
  return `${(espacio > LARGO_ARRANQUE / 2 ? corte.slice(0, espacio) : corte).join('').trimEnd()}…`;
}

/** La otra activa que le escribe a la misma gente: su nombre y el arranque de los dos mensajes, para compararlos. */
export type Duplicada = { id: number; nombre: string; suyo: string; mio: string };

/**
 * LA OTRA ACTIVA QUE LE ESCRIBE A LA MISMA GENTE, por el mismo canal y con horarios que se pisan, o null. `esta` es la que
 * se activa o se publica (con su lienzo y sus CRON de ahora); `otras`, las del negocio (ella misma y las pausadas no
 * cuentan). Con varias, la que más se parece primero (el parecido sólo ordena).
 */
export function duplicadaDe(esta: Omit<AutoParaComparar, 'activa'>, otras: readonly AutoParaComparar[]): Duplicada | null {
  const mio = primerMensajeDe(esta.pasos);
  if (!mio) return null;
  const candidatas: Array<{ otra: AutoParaComparar; suyo: { texto: string; canal: string } }> = [];
  for (const otra of otras) {
    if (otra.id === esta.id || !otra.activa) continue;
    // La cohorte primero (es lo barato): el primer mensaje se arma sólo de las que le escriben a la misma gente.
    if (!esta.disparadores.some((a) => otra.disparadores.some((b) => mismaCohorte(a, b) && horariosSePisan(a.cron, b.cron)))) continue;
    const suyo = primerMensajeDe(otra.pasos);
    if (!suyo || suyo.canal !== mio.canal) continue;
    candidatas.push({ otra, suyo });
  }
  if (!candidatas.length) return null;
  const [primera] = candidatas.sort((x, y) => parecido(mio.texto, y.suyo.texto) - parecido(mio.texto, x.suyo.texto));
  return { id: primera.otra.id, nombre: primera.otra.nombre, suyo: arranqueParaAviso(primera.suyo.texto), mio: arranqueParaAviso(mio.texto) };
}

/**
 * LO QUE SE COMPARA DE UNA AUTOMATIZACIÓN DE LA LISTA: lo PUBLICADO (es lo que manda el motor) y sus CRON. `cronsDe` es la
 * lista de la pantalla (`disparadoresDeSecuencia`, app/automations/EditorDisparadores.tsx), para que haya UNA.
 */
export function paraComparar<S extends { id: number; nombre: string; activa: boolean; pasos?: readonly unknown[] | null }>(
  s: S, cronsDe: (s: S) => readonly CronParaComparar[],
): AutoParaComparar {
  return { id: s.id, nombre: s.nombre, activa: s.activa, disparadores: cronsDe(s), pasos: (s.pasos ?? []) as readonly PasoGrafo[] };
}

/**
 * ¿LA QUE SE ACTIVA YA TIENE OTRA ACTIVA QUE LE ESCRIBE A LA MISMA GENTE? Con lo PUBLICADO de las dos (Activar no publica
 * nada). La usan TODOS los caminos que prenden algo: el interruptor del lienzo, el «⋯» de la lista, un CRON nuevo en una
 * que ya está activa (`crons`), un canal nuevo en su primer mensaje (`pasos`), y el server.
 */
export function duplicadaAlActivar<S extends { id: number; nombre: string; activa: boolean; pasos?: readonly unknown[] | null }>(
  esta: S, todas: readonly S[], cronsDe: (s: S) => readonly CronParaComparar[],
  o: { pasos?: readonly PasoGrafo[]; crons?: readonly CronParaComparar[] } = {},
): Duplicada | null {
  const base = paraComparar(esta, cronsDe);
  return duplicadaDe({ ...base, ...(o.pasos ? { pasos: o.pasos } : {}), ...(o.crons ? { disparadores: o.crons } : {}) }, todas.map((s) => paraComparar(s, cronsDe)));
}

/** El aviso, con lo necesario para comparar: el nombre de la otra y el arranque de los dos mensajes. */
export const avisoDuplicada = (d: Pick<Duplicada, 'nombre' | 'suyo' | 'mio'>): string =>
  `A la misma gente ya le escribe «${d.nombre}»: «${d.suyo}». Ésta: «${d.mio}»`;
