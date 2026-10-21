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
// funnel sin elegir es «todos»), la misma etapa de entrega del mismo producto, o la misma etiqueta. Los CRON por evento
// (un formulario, un DM, un pago) no se comparan: no hay cohorte que se pise.
//
// Puro: lo usan la tab (SecuenciaPerfil, SimuladorWhatsApp) y el server (`duplicadaDeLaActivacion`, lib/nutricion.ts).
// =============================================================================

import { claseDe, esNodoMensaje, idDe, nodoPorId, raizSalida, type PasoGrafo } from './flujo-grafo';
import { subarbolRespuesta } from './flujo-conversacion';
import { partesDe } from './mensaje-partes';
import { sanearCron } from './cron-aviso';
import { TRIGGER_ETAPA, TRIGGER_ENTREGA, TRIGGER_ETIQUETA } from './nutricion-etapa';

/** Lo que se compara de un CRON (un `Disparador`, lib/disparadores.ts). */
export type CronParaComparar = {
  trigger_tipo: string;
  etapa?: string | null;
  etapas?: readonly string[] | null;
  funnel_id?: number | string | null;
  producto_id?: number | string | null;
  etiqueta_id?: number | string | null;
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

/** ¿Estos dos CRON alcanzan a la misma gente? */
export function mismaCohorte(a: CronParaComparar, b: CronParaComparar): boolean {
  if (a.trigger_tipo !== b.trigger_tipo) return false;
  const cruzan = (): boolean => { const eb = new Set(etapasDeCron(b)); return etapasDeCron(a).some((e) => eb.has(e)); };
  if (a.trigger_tipo === TRIGGER_ETAPA) {
    const fa = id(a.funnel_id); const fb = id(b.funnel_id);
    return (fa == null || fb == null || fa === fb) && cruzan();
  }
  if (a.trigger_tipo === TRIGGER_ENTREGA) return id(a.producto_id) != null && id(a.producto_id) === id(b.producto_id) && cruzan();
  if (a.trigger_tipo === TRIGGER_ETIQUETA) return id(a.etiqueta_id) != null && id(a.etiqueta_id) === id(b.etiqueta_id);
  return false;
}

/**
 * ¿LOS HORARIOS DE ESTOS DOS CRON SE PISAN? Sí, salvo dos Recurrentes que no comparten ningún día: semanales en días
 * distintos, o mensuales en días del mes distintos. Uno que escribe al entrar (sin horario) se pisa con cualquiera. Ante
 * la duda (un horario que no se entiende, unidades distintas), se pisan: se avisa.
 */
export function horariosSePisan(a: unknown, b: unknown): boolean {
  const ca = a == null ? null : sanearCron(a);
  const cb = b == null ? null : sanearCron(b);
  if (!ca || !cb) return true;
  if (ca.unidad === 'semana' && cb.unidad === 'semana') {
    const dias = (c: typeof ca) => new Set(c.dias?.length ? c.dias : c.diaSemana != null ? [c.diaSemana] : []);
    const da = dias(ca); const db = dias(cb);
    return !da.size || !db.size || [...da].some((d) => db.has(d));
  }
  if (ca.unidad === 'mes' && cb.unidad === 'mes' && ca.ordinal == null && cb.ordinal == null && ca.diaMes != null && cb.diaMes != null) {
    return ca.diaMes === cb.diaMes;
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
/** El arranque de un mensaje para el aviso: en una línea, cortado a `LARGO_ARRANQUE` sin partir una palabra. Sin texto, lo dice. */
export function arranqueParaAviso(texto: string): string {
  const t = texto.replace(/\s+/g, ' ').trim();
  if (!t) return '(un audio o un archivo, sin texto)';
  if (t.length <= LARGO_ARRANQUE) return t;
  const corte = t.slice(0, LARGO_ARRANQUE - 1);
  const espacio = corte.lastIndexOf(' ');
  return `${(espacio > LARGO_ARRANQUE / 2 ? corte.slice(0, espacio) : corte).trimEnd()}…`;
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
    const suyo = primerMensajeDe(otra.pasos);
    if (!suyo || suyo.canal !== mio.canal) continue;
    if (!esta.disparadores.some((a) => otra.disparadores.some((b) => mismaCohorte(a, b) && horariosSePisan(a.cron, b.cron)))) continue;
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
 * que ya está activa, y el server.
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
