// =============================================================================
// primer-contacto — cuánto tarda una PERSONA del negocio en contactar a un lead desde que entra al CRM
// =============================================================================
// Lo prometió Martín a Código Inmobiliario (agencia, negocio 13) en la llamada del 30/10/2026: cuando un cliente de la agencia
// dice que los leads no sirven, la agencia tiene que poder mostrar cuánto tardó él en escribirles. Hasta acá sólo existía
// «Tiempo de respuesta» de Chat Analyst (lib/graficos-datos-extra.ts, `conversaciones`), que mide CONVERSACIONES (cuánto se
// tarda en contestarle a quien escribe), no cuánto se tarda en contactar a un lead nuevo.
//
// PURO y sin `server-only`: lo usan el lector (lib/primer-contacto-server.ts), el conjunto del Dashboard
// (`primer_contacto`, lib/graficos-fuentes-extra.ts), la tarjeta de la hoja Closing (app/dashboard/disenos/HojaClosing.tsx),
// la API de MaKo (`tiempo_primer_contacto`) y tests/primer-contacto.test.ts, que lo EJECUTA.
//
// ⚠️ UN MENSAJE AUTOMÁTICO NO ES EL CONTACTO DE UNA PERSONA. La bienvenida de una automatización sale al minuto y diría que el
// negocio contesta al instante. Cada saliente trae `automatico`: `true` lo mandó una automatización (lo marca quien lo manda:
// lib/evolution-envio.ts, mig 0396), `false` lo mandó una persona, `null` NO SE SABE (un WhatsApp de antes de que existiera la
// marca). Lo que no se sabe no se reescribe: si lo primero que salió es un `null`, el lead queda «No se sabe», nunca contactado
// ni sin contactar.
//
// ⚠️ LO QUE YA HABLABAN ANTES DE QUE ENTRARA NO ES VELOCIDAD. Si al lead ya le habían escrito antes de entrar al CRM (lo cargó
// alguien desde una conversación vieja), «cuánto tardó desde que entró» no significa nada: queda «Ya hablaban antes» y no entra
// en la mediana.
// =============================================================================

/** Por dónde salió el contacto. */
export type CanalContacto = 'whatsapp' | 'instagram' | 'messenger' | 'email' | 'llamada';

export const ROTULO_CANAL_CONTACTO: Readonly<Record<CanalContacto, string>> = {
  whatsapp: 'WhatsApp', instagram: 'Instagram', messenger: 'Messenger', email: 'Email', llamada: 'Llamada',
};

/** Un mensaje (o una llamada) que le salió al lead. `automatico`: true = una automatización; false = una persona; null = no se sabe. */
export type SalienteContacto = { t: number; canal: CanalContacto; automatico: boolean | null };

export type EstadoContacto = 'contactado' | 'sin_contactar' | 'no_se_sabe' | 'antes';

export type PrimerContacto = {
  estado: EstadoContacto;
  /** Minutos desde que entró hasta que una PERSONA lo contactó (sólo `contactado`). */
  minutos: number | null;
  /** Por dónde lo contactó la persona (sólo `contactado`). */
  canal: CanalContacto | null;
  /** Minutos hasta el primer mensaje AUTOMÁTICO, si salió alguno antes del de la persona (o sin ninguno de una persona). */
  automaticoMinutos: number | null;
  /** Sin contactar: cuántos minutos lleva esperando. */
  esperandoMinutos: number | null;
};

/**
 * Cuánto antes de la hora de entrada se acepta un saliente como «después» (relojes de dos sistemas: la hora de WhatsApp y la
 * del alta). Un minuto: más que eso ya es una conversación de antes.
 */
export const TOLERANCIA_ANTES_MS = 60_000;

/** Un lead que entró hace menos de esto y nadie le escribió todavía está A TIEMPO: no cuenta como tarde en ninguna tasa. */
export const MINUTOS_A_TIEMPO = 60;

const MIN = 60_000;

/**
 * El primer contacto de UN lead. `entroMs`: cuándo entró al CRM; `salientes`: todo lo que le salió, por cualquier canal (en
 * cualquier orden); `ahoraMs`: para lo que todavía espera.
 */
export function primerContacto(entroMs: number, salientes: readonly SalienteContacto[], ahoraMs: number): PrimerContacto {
  const vacio: PrimerContacto = { estado: 'sin_contactar', minutos: null, canal: null, automaticoMinutos: null, esperandoMinutos: null };
  if (!Number.isFinite(entroMs)) return { ...vacio, estado: 'no_se_sabe' };
  const validos = salientes.filter((s) => Number.isFinite(s.t)).slice().sort((a, b) => a.t - b.t);
  if (validos.some((s) => s.t < entroMs - TOLERANCIA_ANTES_MS)) return { ...vacio, estado: 'antes' };
  let automaticoMinutos: number | null = null;
  for (const s of validos) {
    const minutos = Math.max(0, (s.t - entroMs) / MIN);
    if (s.automatico === true) { if (automaticoMinutos == null) automaticoMinutos = minutos; continue; }
    if (s.automatico === false) return { estado: 'contactado', minutos, canal: s.canal, automaticoMinutos, esperandoMinutos: null };
    // `null`: no se sabe si lo escribió una persona. No se adivina.
    return { ...vacio, estado: 'no_se_sabe', automaticoMinutos };
  }
  return { ...vacio, automaticoMinutos, esperandoMinutos: Math.max(0, (ahoraMs - entroMs) / MIN) };
}

// ── Los tramos (la escala del gráfico, en su orden) ─────────────────────────────────────────────────────────

export const TRAMOS_PRIMER_CONTACTO = [
  'En la primera hora', 'De 1 a 24 horas', 'De 1 a 3 días', 'Más de 3 días', 'Sin contactar', 'Ya hablaban antes', 'No se sabe',
] as const;
export type TramoPrimerContacto = (typeof TRAMOS_PRIMER_CONTACTO)[number];

export function tramoDePrimerContacto(p: PrimerContacto): TramoPrimerContacto {
  if (p.estado === 'antes') return 'Ya hablaban antes';
  if (p.estado === 'no_se_sabe') return 'No se sabe';
  if (p.estado === 'sin_contactar' || p.minutos == null) return 'Sin contactar';
  if (p.minutos <= 60) return 'En la primera hora';
  if (p.minutos <= 24 * 60) return 'De 1 a 24 horas';
  if (p.minutos <= 3 * 24 * 60) return 'De 1 a 3 días';
  return 'Más de 3 días';
}

/** ¿Este lead cuenta para «en la primera hora»? Los contactados y los que llevan más de una hora esperando; los otros, no se saben. */
export const cuentaParaLaPrimeraHora = (p: PrimerContacto): boolean =>
  p.estado === 'contactado' || (p.estado === 'sin_contactar' && (p.esperandoMinutos ?? 0) >= MINUTOS_A_TIEMPO);

// ── El resumen (la tarjeta de Closing y la API) ────────────────────────────────────────────────────────────

export type ResumenPrimerContacto = {
  leads: number;
  contactados: number;
  sinContactar: number;
  /** De los sin contactar, los que llevan menos de una hora: todavía están a tiempo. */
  aTiempo: number;
  noSeSabe: number;
  antes: number;
  /** Mediana y p90 de los minutos (sólo los contactados por una persona). null = ninguno. */
  medianaMinutos: number | null;
  p90Minutos: number | null;
  /** Contactados en la primera hora, sobre los que cuentan para eso (`cuentaParaLaPrimeraHora`). */
  enLaPrimeraHora: number;
  baseLaPrimeraHora: number;
  /** A cuántos les escribió una automatización antes que una persona (o sin ninguna persona). */
  conAutomatico: number;
};

/**
 * ¿Hay que decir que las llamadas sin grabar no se ven? (9/11/2026) Medido en los clientes de Código Inmobiliario: casi todos los
 * leads salían «Sin contactar» (123 de 126, 41 de 41) porque los llaman desde el celular sin grabar, y MaKo sólo ve lo que pasa
 * por él (un WhatsApp de la línea conectada con el lead, un mail, una llamada grabada). La métrica dice la verdad, pero sin
 * explicarlo parece que nadie llamó. Se dice cuando los que ya no están a tiempo y nadie contactó son al menos tantos como los
 * contactados.
 */
export function faltaGrabar(r: Pick<ResumenPrimerContacto, 'sinContactar' | 'aTiempo' | 'contactados'>): boolean {
  const sin = Math.max(0, r.sinContactar - r.aTiempo);
  return sin > 0 && sin >= r.contactados;
}

/** El valor en el percentil `p` (0-100) de una lista ya ordenada, por el método del rango más cercano. */
export function percentilOrdenado(orden: readonly number[], p: number): number | null {
  if (!orden.length) return null;
  const i = Math.min(orden.length - 1, Math.max(0, Math.ceil((p / 100) * orden.length) - 1));
  return orden[i];
}

export function resumirPrimerContacto(lista: readonly PrimerContacto[]): ResumenPrimerContacto {
  const minutos = lista.filter((p) => p.estado === 'contactado' && p.minutos != null).map((p) => p.minutos!).sort((a, b) => a - b);
  const sin = lista.filter((p) => p.estado === 'sin_contactar');
  return {
    leads: lista.length,
    contactados: minutos.length,
    sinContactar: sin.length,
    aTiempo: sin.filter((p) => (p.esperandoMinutos ?? 0) < MINUTOS_A_TIEMPO).length,
    noSeSabe: lista.filter((p) => p.estado === 'no_se_sabe').length,
    antes: lista.filter((p) => p.estado === 'antes').length,
    medianaMinutos: percentilOrdenado(minutos, 50),
    p90Minutos: percentilOrdenado(minutos, 90),
    enLaPrimeraHora: lista.filter((p) => p.estado === 'contactado' && (p.minutos ?? Infinity) <= 60).length,
    baseLaPrimeraHora: lista.filter(cuentaParaLaPrimeraHora).length,
    conAutomatico: lista.filter((p) => p.automaticoMinutos != null && p.estado !== 'antes').length,
  };
}

/** «12 min», «3 h 20 min», «2 días 4 h». Para la tarjeta y la API: el número dicho como lo lee una persona. */
export function duracionLegible(minutos: number | null): string | null {
  if (minutos == null || !Number.isFinite(minutos)) return null;
  const m = Math.round(minutos);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), resto = m % 60;
  if (h < 24) return resto ? `${h} h ${resto} min` : `${h} h`;
  const d = Math.floor(h / 24), hr = h % 24;
  return hr ? `${d} ${d === 1 ? 'día' : 'días'} ${hr} h` : `${d} ${d === 1 ? 'día' : 'días'}`;
}

// ── Qué leads cuentan ────────────────────────────────────────────────────────────────────────────────────

/**
 * Los orígenes de un lead que LLEGA solo (EN POSITIVO: uno nuevo nace afuera hasta que alguien decida). Un lead cargado a mano
 * o importado ya era conocido (se habló por otro lado), uno de prueba no es de nadie, y uno traído de un grupo no lo decidió
 * contactar nadie (`quedaDondeLoPusieron`, app/crm/origen-lead.ts): en los cuatro, «cuánto tardó en contactarlo» no mide nada.
 * `null` (sin origen) cuenta: hasta el 03/10/2026 ninguna alta lo estampaba, y la mayoría de esos leads llegaron por un formulario.
 */
export const ORIGENES_QUE_LLEGAN: readonly string[] = [
  'instant_form', 'landing', 'calendly', 'calcom', 'instagram', 'messenger', 'chat_whatsapp', 'hotmart', 'skool',
];

export const cuentaParaPrimerContacto = (origen: string | null | undefined): boolean =>
  origen == null || origen === '' || ORIGENES_QUE_LLEGAN.includes(origen);

/** Un lead con su primer contacto (lo que arma el lector). */
export type ConPrimerContacto = { id: number; nombre: string | null; pc: PrimerContacto };
/** Lo que se muestra de un lead que esperó: si lo contactaron, cuánto tardaron; si no, cuánto lleva esperando. */
export type Espero = { id: number; nombre: string; estado: 'contactado' | 'sin_contactar'; minutos: number };

/**
 * Los `n` que más esperaron: los sin contactar que pasaron la hora, y los contactados, por cuántos minutos esperaron (lo que
 * lleva o lo que tardó). Los «No se sabe» y los «Ya hablaban antes» no: de ellos no hay espera que mostrar.
 */
export function losQueMasEsperaron(lista: readonly ConPrimerContacto[], n = 3): Espero[] {
  const out: Espero[] = [];
  for (const l of lista) {
    const nombre = l.nombre?.trim() || `Lead #${l.id}`;
    if (l.pc.estado === 'contactado' && l.pc.minutos != null) out.push({ id: l.id, nombre, estado: 'contactado', minutos: l.pc.minutos });
    else if (l.pc.estado === 'sin_contactar' && (l.pc.esperandoMinutos ?? 0) >= MINUTOS_A_TIEMPO) out.push({ id: l.id, nombre, estado: 'sin_contactar', minutos: l.pc.esperandoMinutos! });
  }
  return out.sort((a, b) => b.minutos - a.minutos || a.id - b.id).slice(0, Math.max(0, n));
}
