// =============================================================================
// curso-bloqueo — cuándo se ABRE un módulo o una clase del curso, para UN alumno (puro)
// =============================================================================
// Pedido de Martín (07/10/2026, item 8): «implementes la funcionalidad de Skool de poder
// "bloquear" algunas clases, y que se vayan desbloqueando con ciertos requerimientos… investigues
// todo lo que tiene Skool para que lo implementemos». Las decisiones están en
// docs/diseno-curso-skool.md (D2); el relevo de Skool, en su sección A.3-A.6.
//
// ⚠️ ESTO VA MÁS ALLÁ DE SKOOL, Y EL DIAGNÓSTICO OBVIO («Skool ya lo resuelve») ES EL EQUIVOCADO.
// Skool sólo abre por nivel, por tiempo desde que entraste al GRUPO, por compra, por plan o a mano:
// no tiene «completó la clase anterior» ni «entregó la tarea». Acá sí (`anterior`, `tarea`), que es
// justo lo que pide «se van desbloqueando con requerimientos».
//
// LOS OCHO TIPOS (`Bloqueo`, el contrato de D2):
//   · `abierto`  — se ve. Default de un módulo SUELTO y de una clase (null = hereda de su módulo).
//   · `etapa`    — default de un módulo VINCULADO: se abre cuando el alumno LLEGA a esa etapa del
//                  kanban (hecha o actual por su posición: lo de antes del 08/10/2026).
//   · `anterior` — al completar el módulo anterior (un módulo) o la clase anterior (una clase).
//   · `dias`     — N días después de que se le abrió el curso a ESE alumno (ver `contextoDeFechas`).
//   · `fecha`    — un día del calendario, en la zona del negocio (cohortes que arrancan juntas).
//   · `tarea`    — al enviar (o, con `aprobada`, cuando el equipo revisa) la tarea de otra clase.
//   · `nivel`    — al llegar a un nivel de la comunidad (lib/comunidad-niveles.ts, D8).
//   · `manual`   — cerrado hasta que el equipo se lo abre a ese alumno (`curso_desbloqueos`).
//
// ⚠️ SE DECIDE EN EL SERVER Y LO BLOQUEADO NO VIAJA. Este módulo sólo contesta «abierto, o cerrado
// por esto»; quien lo aplica es la ÚNICA puerta del portal (lib/curso-portal.ts: `armarModulos` para
// lo que se dibuja, `claseDelAlumno` para las rutas que leen o escriben). El navegador recibe el
// motivo, nunca el contenido de lo cerrado.
//
// ⚠️ SIN 'server-only' NI 'use client', A PROPÓSITO: lo ejecuta tests/curso-bloqueo.test.ts, lo usa
// el portal (server) y lo puede usar el editor para decir en palabras qué hace cada candado.

import { tieneTarea, reproductorDeClase, PCT_VISTO, type Clase, type EstadoTarea, type Progreso } from './curso';
import { NIVEL_MAX } from './comunidad-niveles';
import { hoyEnTz } from './date-utils';

// ── El contrato ───────────────────────────────────────────────────────────────

export type Bloqueo =
  | { tipo: 'abierto' }
  | { tipo: 'etapa' }
  | { tipo: 'anterior' }
  | { tipo: 'dias'; dias: number }
  | { tipo: 'fecha'; fecha: string }
  | { tipo: 'tarea'; claseId: number; aprobada?: boolean }
  | { tipo: 'nivel'; nivel: number }
  | { tipo: 'manual' };

export type TipoBloqueo = Bloqueo['tipo'];
export const TIPOS_BLOQUEO: readonly TipoBloqueo[] = ['abierto', 'etapa', 'anterior', 'dias', 'fecha', 'tarea', 'nivel', 'manual'];

/** El tope de `dias`: diez años. Más que eso no es un goteo, es un error de tipeo. */
export const MAX_DIAS_BLOQUEO = 3650;

const FECHA_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** ¿Es un día que existe? `2026-02-30` tiene la forma y no existe: se tira, no se corre al 2 de marzo. */
function fechaReal(s: unknown): string | null {
  if (typeof s !== 'string') return null;
  const m = FECHA_RE.exec(s.trim());
  if (!m) return null;
  const [y, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mes - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mes - 1 && t.getUTCDate() === d && y >= 2000 && y <= 2200 ? m[0] : null;
}

/** Un entero en [min, max] que llega de afuera. Un decimal o un texto NO se redondean: se tiran. */
function enteroEn(v: unknown, min: number, max: number): number | null {
  const n = typeof v === 'number' ? v : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

/**
 * Lo que llegue (de la base o del navegador), a un bloqueo que se puede creer. `null` = no hay uno
 * válido, que quiere decir «el default» (hereda). Nunca tira.
 *
 * ⚠️ UN BLOQUEO MAL FORMADO VUELVE COMO `null` Y NO COMO «abierto»: son la misma cosa para un
 * suelto y una clase, pero no para un vinculado, cuyo default es `etapa`. Un jsonb roto no puede
 * abrirle a todos un módulo que esperaba a su etapa.
 *
 * El objeto de salida se arma de cero: lo que no se nombró acá no viaja (un `__proto__` del jsonb no
 * termina siendo el prototipo de nada).
 */
export function saneaBloqueo(x: unknown): Bloqueo | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  switch (o.tipo) {
    case 'abierto': case 'etapa': case 'anterior': case 'manual':
      return { tipo: o.tipo };
    case 'dias': {
      const dias = enteroEn(o.dias, 0, MAX_DIAS_BLOQUEO);
      return dias == null ? null : { tipo: 'dias', dias };
    }
    case 'fecha': {
      const fecha = fechaReal(o.fecha);
      return fecha ? { tipo: 'fecha', fecha } : null;
    }
    case 'tarea': {
      const claseId = enteroEn(o.claseId, 1, 999_999_999_999);
      if (claseId == null) return null;
      return o.aprobada === true ? { tipo: 'tarea', claseId, aprobada: true } : { tipo: 'tarea', claseId };
    }
    case 'nivel': {
      const nivel = enteroEn(o.nivel, 1, NIVEL_MAX);
      return nivel == null ? null : { tipo: 'nivel', nivel };
    }
    default:
      return null;
  }
}

/** De qué es un bloqueo: decide qué tipos tienen sentido. */
export type ObjetoBloqueo = 'vinculado' | 'suelto' | 'clase';

/**
 * Si este bloqueo se puede GUARDAR en este objeto. `null` = sí; si no, el error CORTO (se dibuja).
 *
 *   · `etapa` es sólo de un módulo VINCULADO: un suelto no es una etapa del kanban, y una clase hereda
 *     la etapa de su módulo (guardarla en la clase sería decir dos veces lo mismo, con dos lugares que
 *     se pueden contradecir).
 *   · `tarea` no puede apuntar a la MISMA clase (no se abriría nunca). Que la clase apuntada sea del
 *     mismo producto lo mira quien guarda, contra la base.
 */
export function bloqueoPermitido(objeto: ObjetoBloqueo, b: Bloqueo | null, propia?: { claseId?: number }): string | null {
  if (!b) return null;
  if (b.tipo === 'etapa' && objeto !== 'vinculado') return objeto === 'clase' ? 'La clase ya sigue a su módulo.' : 'Un módulo suelto no es una etapa.';
  if (b.tipo === 'tarea' && propia?.claseId != null && b.claseId === propia.claseId) return 'Una clase no puede esperarse a sí misma.';
  return null;
}

/** El bloqueo que manda cuando no hay uno guardado (o el guardado no tiene sentido ahí). */
export function bloqueoEfectivo(objeto: Exclude<ObjetoBloqueo, 'clase'>, b: Bloqueo | null): Bloqueo {
  if (b && !(b.tipo === 'etapa' && objeto === 'suelto')) return b;
  return objeto === 'vinculado' ? { tipo: 'etapa' } : { tipo: 'abierto' };
}

// ── El kanban: dónde está el alumno (lo de antes del 08/10/2026) ─────────────────

/**
 * `hecha` = una etapa anterior a la actual. `actual` = donde está HOY. `bloqueada` = una que todavía
 * no le toca. Es el estado POR POSICIÓN en el kanban, que es lo que decide el bloqueo `etapa`.
 */
export type EstadoEtapa = 'hecha' | 'actual' | 'bloqueada';

/**
 * El estado de cada etapa por su POSICIÓN respecto de la actual, en el orden de la entrega.
 *
 * ⚠️ SIN ETAPA ACTUAL CONOCIDA, LA PRIMERA ES LA ACTUAL. Es la regla del kanban de la entrega
 * (`repartirEnEtapas`) y la de `etapaActualDe`: un cliente sin fila en `cliente_entrega` está en
 * la primera etapa, no «en ninguna». Si acá se tomara «ninguna» como «todo bloqueado», los 14
 * clientes de Mauricio —que al arrancar no tienen fila— abrirían el link a un programa cerrado.
 *
 * ⚠️ «Hecha» es por posición, no por tareas: si Mauricio lo movió a mano, lo de atrás queda
 * hecho aunque falte algo. La etapa la manda la entrega, no esta pantalla.
 *
 * (Vivía en lib/curso-portal.ts hasta el 08/10/2026; aquél la re-exporta.)
 */
export function estadosDeEtapas(claves: readonly string[], actual: string | null | undefined): Record<string, EstadoEtapa> {
  const out: Record<string, EstadoEtapa> = {};
  if (!claves.length) return out;
  const i = actual ? claves.indexOf(actual) : -1;
  const iActual = i >= 0 ? i : 0;
  claves.forEach((k, j) => { out[k] = j < iActual ? 'hecha' : j === iActual ? 'actual' : 'bloqueada'; });
  return out;
}

// ── Completar ─────────────────────────────────────────────────────────────────

/**
 * ¿El alumno COMPLETÓ esta clase? (D2) — es lo que abre lo que espera a la «anterior».
 *   · Con tarea: la ENVIÓ (o el equipo ya la revisó). Un quiz desaprobado no queda enviado
 *     (lib/curso.ts, `corregirEnvio`), así que no la completa.
 *   · Sin tarea: la marcó HECHA (`hechaAt`, el tilde de Skool) o vio el video hasta `PCT_VISTO`.
 *     Un video que no se puede medir (Drive, Loom) sólo se completa con el tilde: «no sé cuánto vio»
 *     no es «lo vio».
 *
 * `p` es el progreso EFECTIVO (lib/curso.ts, `progresoEfectivo`): una clase por área cuenta enviada
 * cuando la enviaron todas sus áreas.
 */
export function claseCompleta(
  c: Pick<Clase, 'tarea' | 'campos' | 'videoTipo' | 'videoUrl' | 'videoPath'>,
  p: Pick<Progreso, 'estado' | 'pct' | 'hechaAt'> | null | undefined,
): boolean {
  if (tieneTarea(c)) return p?.estado === 'enviada' || p?.estado === 'aprobada';
  if (p?.hechaAt) return true;
  return reproductorDeClase(c).medible && (p?.pct ?? 0) >= PCT_VISTO;
}

// ── Las fechas, en la zona del negocio ────────────────────────────────────────

/** El día de un instante en una zona, `YYYY-MM-DD`. `null` = el instante o la zona no se entienden. */
export function fechaEnZona(iso: string | null | undefined, tz: string): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  try { return hoyEnTz(tz, new Date(t)); } catch { return null; }
}

/** `fecha` + `n` días de calendario (sin horas: no hay horario de verano que corra el día). */
export function sumarDias(fecha: string, n: number): string {
  const m = FECHA_RE.exec(fecha);
  if (!m) return fecha;
  const t = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + n));
  return t.toISOString().slice(0, 10);
}

/** Cuántos días de calendario hay de `desde` a `hasta` (negativo si `hasta` es antes). */
export function diasEntre(desde: string, hasta: string): number {
  const a = FECHA_RE.exec(desde);
  const b = FECHA_RE.exec(hasta);
  if (!a || !b) return 0;
  const ta = Date.UTC(Number(a[1]), Number(a[2]) - 1, Number(a[3]));
  const tb = Date.UTC(Number(b[1]), Number(b[2]) - 1, Number(b[3]));
  return Math.round((tb - ta) / 86_400_000);
}

/** Las fechas que necesitan `dias` y `fecha`: hoy y el día en que se le abrió el curso. */
export type FechasBloqueo = { hoy: string; inicio: string | null };

/**
 * Hoy y el día en que se le abrió el curso, LOS DOS EN LA ZONA DEL NEGOCIO (`tzDeWorkspace`).
 *
 * ⚠️ EN LA ZONA DEL NEGOCIO Y NO EN UTC: los crons y las funciones corren en UTC (Vercel), y un
 * alumno de Tijuana que entra a las 23:30 del 30/09 entró el 30/09, no el 01/10 — con UTC, el «se
 * abre en 1 día» se le abriría a las 17:00 de su mismo día. Y un `fecha: '2026-10-12'` se abre a la
 * medianoche del negocio, que es lo que entiende quien lo eligió.
 *
 * `abiertoDesde` es el INSTANTE en que se le abrió ese curso (ver lib/curso-datos.ts,
 * `abiertoDesdeDe`): `null` = no se pudo saber, y entonces `dias` queda cerrado esa vez.
 */
export function contextoDeFechas(ahora: Date, abiertoDesde: string | null | undefined, tz: string): FechasBloqueo | null {
  let hoy: string;
  try { hoy = hoyEnTz(tz, ahora); } catch { return null; }
  return { hoy, inicio: fechaEnZona(abiertoDesde, tz) };
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** «12 de octubre», y el año sólo si no es el de hoy. Sin `Intl`: un locale distinto no cambia el texto. */
export function fraseDeFecha(fecha: string, hoy?: string | null): string {
  const m = FECHA_RE.exec(fecha);
  if (!m) return fecha;
  const base = `${Number(m[3])} de ${MESES[Number(m[2]) - 1]}`;
  return hoy && hoy.slice(0, 4) === m[1] ? base : `${base} de ${m[1]}`;
}

// ── Los motivos (lo que lee el alumno: CORTO) ─────────────────────────────────

/** Un nombre adentro de un motivo: con tope, para que el candado no ocupe dos renglones. */
const nombreCorto = (s: string): string => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > 40 ? `${t.slice(0, 39).trimEnd()}…` : t;
};

export const MOTIVO_MANUAL = 'Lo abre tu equipo';
export const motivoTerminar = (nombre: string) => `Se abre al terminar «${nombreCorto(nombre)}»`;
export const motivoRevisar = (nombre: string) => `Se abre cuando revisen «${nombreCorto(nombre)}»`;
export const motivoNivel = (nivel: number) => `Se abre en el nivel ${nivel}`;
export const motivoDias = (faltan: number) => (faltan <= 1 ? 'Se abre mañana' : `Se abre en ${faltan} días`);
export const motivoFecha = (fecha: string, hoy?: string | null) => `Se abre el ${fraseDeFecha(fecha, hoy)}`;
/** Cuando no se pudo saber CUÁNDO (la fecha de inicio no se leyó): no se inventa un número. */
export const MOTIVO_MAS_ADELANTE = 'Se abre más adelante';

// ── El evaluador ──────────────────────────────────────────────────────────────

/** `abierta` + por qué no. `manual` = la abrió el equipo a mano (gana sobre cualquier bloqueo). */
export type Apertura = { abierta: boolean; motivo: string | null; manual?: boolean };

export type ModuloParaBloqueo = { clave: string; nombre: string; vinculado: boolean; bloqueo: Bloqueo | null };
export type ClaseParaBloqueo = { id: number; modulo: string; orden: number; titulo: string; bloqueo: Bloqueo | null };
export type Desbloqueo = { objeto: 'modulo' | 'clase'; clave: string };

export type EntradaBloqueos = {
  /** TODOS los módulos del curso, en su orden (`derivarModulos`). */
  modulos: readonly ModuloParaBloqueo[];
  /** Las clases del producto (cada una con la clave de su módulo). */
  clases: readonly ClaseParaBloqueo[];
  /** ¿Completó esta clase? (`claseCompleta` sobre su progreso efectivo). */
  completa: (claseId: number) => boolean;
  /** En qué quedó su tarea: lo que mira `tarea` con `aprobada`. */
  estadoTarea: (claseId: number) => EstadoTarea | undefined;
  /** El kanban de la entrega ENTERO (también las etapas que no son módulo) y dónde está el alumno. */
  kanban: { etapas: readonly { key: string; label: string }[]; actual: string | null | undefined };
  /** Los permisos (lib/curso-alcance.ts). Un módulo no permitido no cuenta como «el anterior». */
  permitido?: (clave: string) => boolean;
  /** `null` = no se pudieron calcular: `dias` y `fecha` quedan cerrados esa vez. */
  fechas: FechasBloqueo | null;
  /** Su nivel en la comunidad. `null` = no se pudo leer: `nivel` queda cerrado esa vez. */
  nivel: number | null;
  /** Lo que el equipo le abrió a mano. */
  desbloqueos: readonly Desbloqueo[];
  /**
   * Qué se le puede NOMBRAR en un motivo a quien mira (además de sus permisos, que ya acotan). Ausente
   * = todo lo permitido. El LÍDER de un área ve sólo las clases por área y los módulos que las tienen
   * (`armarModulos` lo pasa): un «Se abre al terminar «X»» con X fuera de eso le contaría que existe.
   */
  nombrable?: { clase: (claseId: number) => boolean; modulo: (clave: string) => boolean };
};

export type Aperturas = {
  /** Clave del módulo → apertura. Un módulo NO PERMITIDO sale cerrado y sin motivo: no viaja. */
  modulos: Map<string, Apertura>;
  /** Id de la clase → apertura. Una clase de un módulo cerrado lleva el motivo DEL MÓDULO. */
  clases: Map<number, Apertura>;
};

/**
 * Qué se le abre a UN alumno: cada módulo y cada clase, con el motivo de lo cerrado.
 *
 * El ORDEN de las preguntas es el contrato:
 *   1. ¿El módulo está en sus permisos? Si no, cerrado y sin motivo (no se le muestra).
 *   2. ¿Se lo abrieron a mano? Gana sobre cualquier bloqueo.
 *   3. Su bloqueo (o el default: `etapa` un vinculado, `abierto` un suelto).
 * Y para cada clase:
 *   1. ¿Su módulo está cerrado? Cerrada, con el motivo del módulo: una clase no puede estar más
 *      abierta que la caja que la contiene (ni a mano: lo que se abre a mano es el MÓDULO).
 *   2. ¿Se la abrieron a mano? 3. Su bloqueo; sin ninguno, hereda (abierta).
 *
 * ⚠️ NO PODER LEER ES CERRADO, NUNCA ABIERTO. Sin las fechas, `dias` y `fecha` no se abren; sin el
 * nivel, `nivel` tampoco; una `tarea` que apunta a una clase que ya no existe, tampoco (la abre el
 * equipo a mano, y el editor tiene que mostrar el candado roto). Es la regla de la casa: una lectura
 * que cae al default sirve para dibujar, nunca para DECIDIR — y lo que se decide acá es qué contenido
 * le llega a alguien.
 *
 * ⚠️ «COMPLETAR UN MÓDULO» = COMPLETAR TODAS SUS CLASES, y un módulo SIN clases está completo. Es lo
 * contrario de `etapaCompleta` (lib/curso.ts), y a propósito: allá una etapa vacía no se completa
 * porque eso MOVERÍA al cliente en cascada por el kanban; acá no se mueve nada, y un módulo vacío que
 * no se completara dejaría cerrado PARA SIEMPRE todo lo que espera al «anterior».
 *
 * ⚠️ UN MOTIVO NO NOMBRA LO QUE QUIEN MIRA NO VE (revisión del 08/10/2026). El motivo VIAJA al
 * navegador, y «Se abre al terminar «X»» cuenta que X existe: con X en un módulo que sus permisos no
 * le dan (la regla del portal: ése no viaja «ni el nombre»), o —al líder de un área— una clase que no
 * es por área. Ahí el motivo es «Se abre más adelante». Y una `tarea` que espera a una clase de un
 * módulo que no le permiten no la puede completar NUNCA (las rutas le contestan 404): «Lo abre tu
 * equipo», que es lo cierto.
 */
export function evaluarBloqueos(e: EntradaBloqueos): Aperturas {
  const permitido = e.permitido ?? (() => true);
  const nombraModulo = (clave: string) => permitido(clave) && (e.nombrable?.modulo(clave) ?? true);
  const nombraClase = (c: ClaseParaBloqueo) => permitido(c.modulo) && (e.nombrable?.clase(c.id) ?? true);
  const esModulo = new Set(e.modulos.map((m) => m.clave));
  const manualMod = new Set(e.desbloqueos.filter((d) => d.objeto === 'modulo').map((d) => d.clave));
  const manualClase = new Set(e.desbloqueos.filter((d) => d.objeto === 'clase').map((d) => d.clave));
  const claves = e.kanban.etapas.map((x) => x.key);
  const estados = estadosDeEtapas(claves, e.kanban.actual);
  const porId = new Map(e.clases.map((c) => [c.id, c]));

  const porModulo = new Map<string, ClaseParaBloqueo[]>();
  for (const c of e.clases) {
    if (!porModulo.has(c.modulo)) porModulo.set(c.modulo, []);
    porModulo.get(c.modulo)!.push(c);
  }
  for (const xs of porModulo.values()) xs.sort((a, b) => a.orden - b.orden || a.id - b.id);
  const moduloCompleto = (clave: string) => (porModulo.get(clave) ?? []).every((c) => e.completa(c.id));

  // El orden del curso que ve ESTE alumno: el de «la clase anterior» cruza de módulo.
  const visibles = e.modulos.filter((m) => permitido(m.clave));
  const ordenCurso = visibles.flatMap((m) => porModulo.get(m.clave) ?? []);
  const posEnCurso = new Map(ordenCurso.map((c, i) => [c.id, i]));

  /**
   * La regla de un bloqueo que no es `etapa` ni `abierto` (lo comparten módulos y clases). El `nombre`
   * del anterior en `null` = no se le puede nombrar a quien mira (ver la cabecera).
   */
  const regla = (b: Bloqueo, anterior: { nombre: string | null; completo: boolean } | null): Apertura => {
    switch (b.tipo) {
      case 'abierto': case 'etapa':
        return { abierta: true, motivo: null };
      case 'anterior':
        return !anterior || anterior.completo ? { abierta: true, motivo: null }
          : { abierta: false, motivo: anterior.nombre != null ? motivoTerminar(anterior.nombre) : MOTIVO_MAS_ADELANTE };
      case 'dias': {
        if (!e.fechas) return { abierta: false, motivo: MOTIVO_MAS_ADELANTE };
        if (!e.fechas.inicio) return { abierta: false, motivo: MOTIVO_MAS_ADELANTE };
        const abre = sumarDias(e.fechas.inicio, b.dias);
        const faltan = diasEntre(e.fechas.hoy, abre);
        return faltan <= 0 ? { abierta: true, motivo: null } : { abierta: false, motivo: motivoDias(faltan) };
      }
      case 'fecha':
        if (!e.fechas) return { abierta: false, motivo: motivoFecha(b.fecha) };
        return e.fechas.hoy >= b.fecha ? { abierta: true, motivo: null } : { abierta: false, motivo: motivoFecha(b.fecha, e.fechas.hoy) };
      case 'tarea': {
        const otra = porId.get(b.claseId);
        if (!otra) return { abierta: false, motivo: MOTIVO_MANUAL };
        const ok = b.aprobada ? e.estadoTarea(otra.id) === 'aprobada' : e.completa(otra.id);
        if (ok) return { abierta: true, motivo: null };
        // Una clase de un módulo que no le permiten no la puede completar: sólo la abre el equipo.
        if (!permitido(otra.modulo)) return { abierta: false, motivo: MOTIVO_MANUAL };
        if (!nombraClase(otra)) return { abierta: false, motivo: MOTIVO_MAS_ADELANTE };
        return { abierta: false, motivo: b.aprobada ? motivoRevisar(otra.titulo) : motivoTerminar(otra.titulo) };
      }
      case 'nivel':
        return e.nivel != null && e.nivel >= b.nivel ? { abierta: true, motivo: null } : { abierta: false, motivo: motivoNivel(b.nivel) };
      case 'manual':
        return { abierta: false, motivo: MOTIVO_MANUAL };
    }
  };

  const modulos = new Map<string, Apertura>();
  let previo: ModuloParaBloqueo | null = null;
  for (const m of e.modulos) {
    if (!permitido(m.clave)) { modulos.set(m.clave, { abierta: false, motivo: null }); continue; }
    const anterior = previo ? { nombre: nombraModulo(previo.clave) ? previo.nombre : null, completo: moduloCompleto(previo.clave) } : null;
    previo = m;
    if (manualMod.has(m.clave)) { modulos.set(m.clave, { abierta: true, motivo: null, manual: true }); continue; }
    const b = bloqueoEfectivo(m.vinculado ? 'vinculado' : 'suelto', m.bloqueo);
    if (b.tipo === 'etapa') {
      const est = estados[m.clave];
      if (est === 'hecha' || est === 'actual') { modulos.set(m.clave, { abierta: true, motivo: null }); continue; }
      // La etapa del kanban que hay que terminar es la de ANTES en el kanban (puede no ser un módulo:
      // una «Onboarding» que no tiene clases), que es la que mueve al alumno a ésta. Si ESA es un módulo
      // que quien mira no ve, no se la nombra (ver la cabecera).
      const i = claves.indexOf(m.clave);
      const antes = i > 0 ? e.kanban.etapas[i - 1] : null;
      const motivo = !antes ? MOTIVO_MANUAL : esModulo.has(antes.key) && !nombraModulo(antes.key) ? MOTIVO_MAS_ADELANTE : motivoTerminar(antes.label);
      modulos.set(m.clave, { abierta: false, motivo });
      continue;
    }
    modulos.set(m.clave, regla(b, anterior));
  }

  const clases = new Map<number, Apertura>();
  for (const c of e.clases) {
    const mod = modulos.get(c.modulo);
    // Una clase de un módulo que no existe (su etapa se borró) no es de ningún módulo: no se abre.
    if (!mod) { clases.set(c.id, { abierta: false, motivo: null }); continue; }
    if (!mod.abierta) { clases.set(c.id, { abierta: false, motivo: mod.motivo }); continue; }
    if (manualClase.has(String(c.id))) { clases.set(c.id, { abierta: true, motivo: null, manual: true }); continue; }
    if (!c.bloqueo || c.bloqueo.tipo === 'etapa') { clases.set(c.id, { abierta: true, motivo: null }); continue; }
    const i = posEnCurso.get(c.id) ?? 0;
    const prev = i > 0 ? ordenCurso[i - 1] : null;
    clases.set(c.id, regla(c.bloqueo, prev ? { nombre: nombraClase(prev) ? prev.titulo : null, completo: e.completa(prev.id) } : null));
  }
  return { modulos, clases };
}

/**
 * Lo que la evaluación necesita y no sale del curso: las fechas, el nivel y lo abierto a mano. Lo lee
 * el server para un alumno (lib/curso-modulos-datos.ts, `contextoDelAlumno`); la vista previa del
 * equipo arma el del «día uno» (hoy es el inicio, nivel 1, nada abierto a mano).
 */
export type ContextoBloqueo = { fechas: FechasBloqueo | null; nivel: number | null; desbloqueos: readonly Desbloqueo[] };

/** Sin contexto: lo que depende de fechas o del nivel queda cerrado (no se pudo saber). */
export const CONTEXTO_VACIO: ContextoBloqueo = { fechas: null, nivel: null, desbloqueos: [] };

/**
 * `evaluarBloqueos` con las clases y el progreso como los tiene el curso: el ÚNICO armado de la
 * entrada, que usan las dos mitades de la puerta del portal (lo que se dibuja y lo que las rutas
 * dejan leer o escribir). Con dos armados, «completó la clase» podría querer decir dos cosas.
 */
export function aperturasDe(p: {
  modulos: readonly ModuloParaBloqueo[];
  etapas: readonly { key: string; label: string }[];
  actual: string | null | undefined;
  clases: readonly (Pick<Clase, 'id' | 'etapa' | 'orden' | 'titulo' | 'tarea' | 'campos' | 'videoTipo' | 'videoUrl' | 'videoPath'> & { bloqueo?: Bloqueo | null })[];
  progreso: ReadonlyMap<number, Pick<Progreso, 'estado' | 'pct' | 'hechaAt'>>;
  permitido?: (clave: string) => boolean;
  contexto?: ContextoBloqueo;
  /** Qué se le puede nombrar en un motivo (ver `EntradaBloqueos.nombrable`). Ausente = lo permitido. */
  nombrable?: EntradaBloqueos['nombrable'];
}): Aperturas {
  const ctx = p.contexto ?? CONTEXTO_VACIO;
  const porId = new Map(p.clases.map((c) => [c.id, c]));
  return evaluarBloqueos({
    modulos: p.modulos,
    clases: p.clases.map((c) => ({ id: c.id, modulo: c.etapa, orden: c.orden, titulo: c.titulo, bloqueo: c.bloqueo ?? null })),
    completa: (id) => {
      const c = porId.get(id);
      return c ? claseCompleta(c, p.progreso.get(id)) : false;
    },
    estadoTarea: (id) => p.progreso.get(id)?.estado,
    kanban: { etapas: p.etapas, actual: p.actual },
    permitido: p.permitido,
    fechas: ctx.fechas,
    nivel: ctx.nivel,
    desbloqueos: ctx.desbloqueos,
    nombrable: p.nombrable,
  });
}

/**
 * Qué contexto CARO necesita la evaluación: la zona y las fechas (`dias`, `fecha`), la fecha de
 * inicio del alumno (`dias`) y su nivel en la comunidad (`nivel`). Lo usa quien lee, para no pagar la
 * zona del negocio ni los likes de la comunidad en un curso que no tiene ninguno de esos candados (la
 * ruta del progreso pega cada ~10 s por video abierto).
 */
export function contextoNecesario(bloqueos: Iterable<Bloqueo | null | undefined>): { fechas: boolean; inicio: boolean; nivel: boolean } {
  const out = { fechas: false, inicio: false, nivel: false };
  for (const b of bloqueos) {
    if (!b) continue;
    if (b.tipo === 'fecha') out.fechas = true;
    if (b.tipo === 'dias') { out.fechas = true; out.inicio = true; }
    if (b.tipo === 'nivel') out.nivel = true;
  }
  return out;
}

/** «Se abre…» de un bloqueo, en palabras de QUIEN LO ARMA (el editor). Corto. */
export function rotuloDeBloqueo(b: Bloqueo, titulo?: (claseId: number) => string | null): string {
  switch (b.tipo) {
    case 'abierto': return 'Abierto';
    case 'etapa': return 'Al llegar a su etapa';
    case 'anterior': return 'Al terminar el anterior';
    case 'dias': return b.dias === 0 ? 'Desde el primer día' : `${b.dias} ${b.dias === 1 ? 'día' : 'días'} después de entrar`;
    case 'fecha': return `El ${fraseDeFecha(b.fecha)}`;
    case 'tarea': {
      const t = titulo?.(b.claseId);
      return t ? `${b.aprobada ? 'Al revisar' : 'Al terminar'} «${nombreCorto(t)}»` : 'Su clase ya no existe';
    }
    case 'nivel': return `Nivel ${b.nivel}`;
    case 'manual': return 'A mano';
  }
}
