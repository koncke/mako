// =============================================================================
// inbox-movil-reglas — el «Para decidir» del teléfono: QUÉ es cada cosa y QUIÉN la ve
// =============================================================================
// MaKo Mobile (docs/diseno-mako-mobile.md, fila «Inbox»): «Para decidir» junta en una
// lista todo lo que espera una decisión de una persona. Son CINCO bandejas que en el
// escritorio viven en cuatro pantallas distintas:
//
//   · pendiente    → las acciones `chat` de MaKo que esperan un «sí» (/mako/pendientes).
//                    Vencen a las 2 h. Sólo el admin las confirma (ctxDeBandeja).
//   · accion       → las propuestas genéricas `accion` (/mako/revisar/<id>). Sólo admin.
//                    Simple → se confirman en el teléfono tal como se guardaron; compleja
//                    (algún parámetro object/object[], que el escritorio edita como JSON)
//                    → «Abrir en la computadora».
//   · lead         → contactos que propuso un canal (/crm/revisar/<id>). La revisión es una
//                    tabla editable: en el teléfono, sólo la fila y el link.
//   · borrador     → borradores de tareas del plan (/plan/revisar/<id>), un wizard: link.
//   · confirmacion → los cambios del CRM automático (la tarjeta MakoConfirmGate del CRM):
//                    se dejan, se deshacen o se elige una opción, en el teléfono.
//
// PURO: sin `server-only` ni `'use client'`. Lo importan la lectura (lib/inbox-movil.ts),
// las acciones (app/m/inbox/acciones.ts), las pantallas de /m (los TIPOS) y los tests.
//
// ⚠️ QUIÉN VE QUÉ SALE DE LA MISMA REGLA DEL SIDEBAR (`puedeVerKey`, lib/movil-rutas.ts):
// el rol + la capa del workspace. No hay una segunda tabla de permisos. Y las acciones
// del teléfono vuelven a preguntar `tiposVisibles` antes de escribir: lo que la lista no
// ofrece, la acción tampoco lo hace.
// =============================================================================

import type { Parametro } from './api-mako/tipos';
import { rotuloDeParametro } from './editor-acciones';
import { puedeVerKey, type RolMovil } from './movil-rutas';

export type TipoDecision = 'pendiente' | 'accion' | 'lead' | 'borrador' | 'confirmacion';

/** El orden en que se muestran: primero lo que VENCE (las pendientes, 2 h), después lo
 *  que MaKo ya aplicó y espera un visto bueno, y al final lo que se revisa en la compu. */
export const TIPOS_DECISION: readonly TipoDecision[] = ['pendiente', 'confirmacion', 'accion', 'lead', 'borrador'];

/** Cómo se llama cada bandeja en pantalla (para un vacío o para «No se pudo leer: …»). */
export const NOMBRE_TIPO: Readonly<Record<TipoDecision, string>> = {
  pendiente: 'Acciones por confirmar',
  confirmacion: 'Cambios del CRM',
  accion: 'Acciones para revisar',
  lead: 'Contactos para revisar',
  borrador: 'Borradores del plan',
};

/**
 * Qué hace el teléfono con el ítem:
 *   · confirmar-pendiente   → confirmarPendienteMovil(id) / cancelarPendienteMovil(id)
 *   · confirmar-accion      → confirmarAccionMovil(id, payload) / descartarAccionMovil(id)
 *   · resolver-confirmacion → resolverConfirmacionMovil(id, opcion.decision)
 *   · computadora           → sólo «Abrir en la computadora» con `linkEscritorio`
 */
export type AccionMovil = 'confirmar-pendiente' | 'confirmar-accion' | 'resolver-confirmacion' | 'computadora';

/** Una línea de «lo que se va a ejecutar»: el rótulo humano y el valor legible. */
export type LineaDetalle = { rotulo: string; valor: string };

/** La decisión que se le pasa a `resolverConfirmacionMovil`. */
export type DecisionConfirmacion = 'confirmar' | 'rechazar' | `op:${string}`;

/** Un botón de una confirmación del CRM. El rótulo nombra la acción y su objeto. */
export type OpcionDecision = { decision: DecisionConfirmacion; label: string; tono: 'primary' | 'danger' | 'neutral' };

type Comun = {
  /** Única en la lista: los ids de tablas distintas pueden coincidir. Para `key` de React. */
  key: string;
  /** Qué, en concreto («Mover a Ana López a Agendado»). */
  titulo: string;
  /** De qué se trata (la operación, el lead, cuántas tareas). Una línea. */
  resumen: string;
  /** Corta y en prosa: «No se puede deshacer», «Ya aplicado». Sin jerga. */
  consecuencia?: string;
  /** Qué escribe y dónde, según la definición de la operación. ⚠️ ES TÉCNICO (nombra
   *  tablas y endpoints): sirve para el detalle de escritorio, no para una fila. */
  escribe?: string | null;
  /** true = se puede deshacer · false = no · null = no se sabe. */
  deshacer?: boolean | null;
  /** ISO. Sólo las pendientes vencen. */
  venceAt?: string;
  /** «16 sep, 18:40 (en 42 min)», en la zona del negocio. Sólo pendientes. */
  vence?: string;
  /** ISO de cuándo se propuso. */
  creadaAt?: string;
  /** De dónde vino: «vino por WhatsApp», «vino de la landing»… */
  origen: string;
  /** El path de escritorio, SIN `?ws=`: lo pone quien navega (`linkApp`/`conWs`). */
  linkEscritorio: string;
  /** Lo que se va a ejecutar, legible y sin ids. Puede venir vacío. */
  detalle: LineaDetalle[];
};

export type ItemDecision =
  | (Comun & { tipo: 'pendiente'; id: number; accionMovil: 'confirmar-pendiente'; operacion: string })
  | (Comun & {
      tipo: 'accion'; id: string; accionMovil: 'confirmar-accion' | 'computadora';
      complejidad: 'simple' | 'compleja';
      /** El título de la operación, o su slug si ya no existe en MaKo. */
      operacion: string;
      /** Los parámetros de la operación, aplanados (`plano`). [] si la operación ya no existe. */
      parametros: Parametro[];
      /** SÓLO si es simple: los parámetros TAL COMO SE GUARDARON. Es lo que se manda a
       *  `confirmarAccionMovil` — el teléfono confirma, no edita. */
      payload?: Record<string, unknown>;
    })
  | (Comun & { tipo: 'lead'; id: string; accionMovil: 'computadora' })
  | (Comun & { tipo: 'borrador'; id: string; accionMovil: 'computadora' })
  | (Comun & { tipo: 'confirmacion'; id: number; accionMovil: 'resolver-confirmacion' | 'computadora'; opciones: OpcionDecision[] });

/** Lo que devuelve cada acción del Inbox. `error` es corto: va a un toast. */
export type ResultadoMovil = { ok: boolean; resumen?: string; error?: string };

// ── Quién ve qué ─────────────────────────────────────────────────────────────

/**
 * Las bandejas que este rol, en esta capa, puede DECIDIR. En positivo:
 *   · pendiente y accion → admin, y la capa con la tab MaKo (la bandeja de escritorio es
 *     `requireRolWs([], { nav: 'mako' })`, y `ctxDeBandeja` rechaza a quien no es admin).
 *   · lead y confirmacion → quien ve el CRM (closer y setter incluidos).
 *   · borrador → quien ve el Plan.
 * Sin rol (sin sesión), nada.
 */
export function tiposVisibles(rol: RolMovil, capa: string | null | undefined): TipoDecision[] {
  if (!rol) return [];
  const ve = new Set<TipoDecision>();
  if (rol === 'admin' && puedeVerKey('mako', rol, capa)) { ve.add('pendiente'); ve.add('accion'); }
  if (puedeVerKey('crm', rol, capa)) { ve.add('lead'); ve.add('confirmacion'); }
  if (puedeVerKey('todo', rol, capa)) ve.add('borrador');
  return TIPOS_DECISION.filter((t) => ve.has(t));
}

// ── Las acciones genéricas: simple o compleja ────────────────────────────────

/** object y object[] se editan como JSON crudo en el escritorio: no van al teléfono. */
export function esParametroComplejo(p: Pick<Parametro, 'tipo'>): boolean {
  return p.tipo === 'object' || p.tipo === 'object[]';
}

/** `null` = la operación ya no existe en MaKo: no se puede confirmar en ningún lado, y
 *  el escritorio es el que sabe decirlo («La operación de esta propuesta ya no existe»). */
export function complejidadDe(parametros: readonly Pick<Parametro, 'tipo'>[] | null): 'simple' | 'compleja' {
  if (!parametros) return 'compleja';
  return parametros.some(esParametroComplejo) ? 'compleja' : 'simple';
}

// ── Lo que se ejecuta, legible ───────────────────────────────────────────────

const MAX_VALOR = 160;

/** Un id en pantalla es jerga: el resumen de la propuesta ya nombra al lead, la campaña… */
const esId = (nombre: string): boolean => nombre === 'id' || /Id$|_id$/.test(nombre);

function valorLegible(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (typeof v === 'string') { const s = v.trim(); return s ? corta(s) : null; }
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : null;
  if (Array.isArray(v)) {
    if (!v.length) return null;
    if (v.every((x) => typeof x === 'string' || typeof x === 'number')) return corta(v.join(', '));
    return v.length === 1 ? '1 elemento' : `${v.length} elementos`;
  }
  try { return corta(JSON.stringify(v)); } catch { return null; }
}

const corta = (s: string): string => (s.length > MAX_VALOR ? `${s.slice(0, MAX_VALOR)}…` : s);

/**
 * Las líneas de «lo que se va a ejecutar». Con los `parametros` de la operación van en
 * SU orden y con SU rótulo (`rotuloDeParametro`, el mismo del paso «⚡ Acción»); sin ellos
 * (una pendiente lleva el payload ya preparado), en el orden del payload. Se saltean los
 * vacíos y los ids.
 */
export function lineasDelPayload(payload: Record<string, unknown> | null | undefined, parametros?: readonly Pick<Parametro, 'nombre' | 'rotulo'>[] | null): LineaDetalle[] {
  const p = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const nombres = parametros?.length
    ? [...parametros.map((x) => x.nombre), ...Object.keys(p).filter((k) => !parametros.some((x) => x.nombre === k))]
    : Object.keys(p);
  const out: LineaDetalle[] = [];
  for (const nombre of nombres) {
    if (esId(nombre)) continue;
    const valor = valorLegible(p[nombre]);
    if (valor == null) continue;
    const def = parametros?.find((x) => x.nombre === nombre);
    out.push({ rotulo: rotuloDeParametro(def ?? { nombre }), valor });
  }
  return out;
}

/** «No se puede deshacer» / «Se puede deshacer», o nada si no se sabe. */
export function consecuenciaDeshacer(reversible: boolean | null | undefined): string | undefined {
  if (reversible === false) return 'No se puede deshacer';
  if (reversible === true) return 'Se puede deshacer';
  return undefined;
}

// ── De dónde vino ────────────────────────────────────────────────────────────

const ORIGEN_TXT: Readonly<Record<string, string>> = {
  whatsapp: 'vino por WhatsApp', 'hola-mako': 'vino por WhatsApp',
  claude: 'vino por la API', api: 'vino por la API',
  app: 'vino del chat de la app',
  landing: 'vino de la landing',
  fathom: 'vino de una reunión',
  archivo: 'vino de un archivo',
  'claude-code': 'vino de Claude Code',
  mako: 'vino de MaKo', 'proyecto-vacio': 'vino de MaKo',
};

/**
 * La columna `origen` de una propuesta o un borrador, como la lee una persona. Mismo
 * idioma que `etiquetaDeCanal` (lib/api-mako/canal.ts), que es el de las pendientes.
 * Un origen desconocido no se inventa: «vino de MaKo», que es lo único seguro.
 */
export function etiquetaDeOrigen(origen: string | null | undefined): string {
  const o = (origen ?? '').trim();
  if (o.startsWith('flujo:')) return 'vino de una automatización';
  return ORIGEN_TXT[o] ?? 'vino de MaKo';
}

// ── Las confirmaciones del CRM automático ────────────────────────────────────

type ConfMin = { aplicado: boolean; opciones: Array<{ key: string; label: string; tone?: 'primary' | 'danger' | 'neutral' }> | null };

/**
 * Los botones de una confirmación, con la misma lógica que la tarjeta del CRM
 * (MakoConfirmGate): si MaKo YA aplicó el cambio, se deja o se deshace, más las opciones;
 * si no lo aplicó, sólo las opciones. Los rótulos nombran acción + objeto (nunca
 * «Confirmar» / «Deshacer» a secas).
 */
export function opcionesDeConfirmacion(c: ConfMin): OpcionDecision[] {
  const ops: OpcionDecision[] = (c.opciones ?? [])
    .filter((o) => typeof o?.key === 'string' && o.key && typeof o.label === 'string' && o.label.trim())
    .map((o) => ({ decision: `op:${o.key}` as const, label: o.label.trim(), tono: o.tone ?? 'neutral' }));
  if (!c.aplicado) return ops;
  return [
    { decision: 'confirmar', label: 'Dejar el cambio', tono: 'primary' },
    ...ops,
    { decision: 'rechazar', label: 'Deshacer el cambio', tono: 'danger' },
  ];
}

/** Una decisión con la forma que entiende `resolverConfirmacion`. Lo demás, null. */
export function decisionValida(d: unknown): DecisionConfirmacion | null {
  if (d === 'confirmar' || d === 'rechazar') return d;
  if (typeof d === 'string' && /^op:[A-Za-z0-9_-]{1,60}$/.test(d)) return d as `op:${string}`;
  return null;
}

/** Una línea por cambio. El «antes» sólo entra cuando dice algo (casi siempre es «Sin
 *  marcar», el hueco que la automatización vino a llenar). Igual que la tarjeta del CRM. */
export function lineasDeCambios(cambios: Array<{ campo: string; antes: string | null; despues: string | null }> | null | undefined): LineaDetalle[] {
  return (cambios ?? []).map((ch) => {
    const antes = (ch.antes ?? '').trim();
    const despues = (ch.despues ?? '—').trim() || '—';
    return { rotulo: ch.campo, valor: antes && antes.toLowerCase() !== 'sin marcar' ? `${antes} → ${despues}` : despues };
  });
}

// ── Los borradores del plan ──────────────────────────────────────────────────

const TOPE_TITULO = 140;

/**
 * El título de un borrador para una fila. El `resumen` de un borrador es un PÁRRAFO
 * (medido en el ws9: «Cierre del proyecto Customer Success (06-07/10). Las 7 hechas ya se
 * cerraron…», 400 caracteres): la fila lleva el nombre de la reunión de la que salió si lo
 * hay, y si no la primera frase del resumen. El párrafo entero se lee en la computadora.
 */
export function tituloDeBorrador(b: { resumen?: string | null; fuenteTitulo?: string | null }): string {
  const fuente = (b.fuenteTitulo ?? '').trim();
  if (fuente) return fuente;
  const resumen = (b.resumen ?? '').trim();
  if (!resumen) return 'Borrador del plan';
  const frase = resumen.split(/(?<=\.)\s+|\n/)[0].trim();
  if (frase.length <= TOPE_TITULO) return frase;
  const corte = frase.slice(0, TOPE_TITULO - 1);
  const espacio = corte.lastIndexOf(' ');
  return `${(espacio > 60 ? corte.slice(0, espacio) : corte).replace(/[\s,;:]+$/, '')}…`;
}

/**
 * La línea de un borrador: cuántas tareas TUYAS trae para cargar y cuántas propone
 * cerrar. Las de otra persona (`esDeOtro`) esperan a esa persona y no cuentan, igual que
 * en Today (`leerBorradores`, lib/plan-hoy.ts).
 */
export function resumenDeBorrador(b: { tareas: ReadonlyArray<{ esDeOtro?: boolean }>; cerrar?: ReadonlyArray<unknown> | null }): string {
  const tareas = b.tareas.filter((x) => !x.esDeOtro).length;
  const cierres = b.cerrar?.length ?? 0;
  const partes = [
    tareas ? (tareas === 1 ? '1 tarea' : `${tareas} tareas`) : null,
    cierres ? `${cierres} para cerrar` : null,
  ].filter(Boolean);
  return partes.length ? partes.join(' · ') : 'Tareas de otras personas';
}

// ── Conteos ──────────────────────────────────────────────────────────────────

/**
 * El total del badge: la suma de las bandejas que este rol VE. Si UNA no se pudo leer
 * (`null`), el total es `null` — «no sé» no es cero, y un badge en 0 sobre una lectura
 * caída le dice a la persona que no tiene nada que decidir.
 */
export function sumarConteos(porTipo: Partial<Record<TipoDecision, number | null>>, visibles: readonly TipoDecision[]): number | null {
  let total = 0;
  for (const t of visibles) {
    const n = porTipo[t];
    if (n == null || !Number.isFinite(n)) return null;
    total += n;
  }
  return total;
}

/** Un id numérico de una server action (lo escribe cualquiera): entero positivo o null. */
export function idNumerico(id: unknown): number | null {
  const n = typeof id === 'number' ? id : typeof id === 'string' && /^\d{1,15}$/.test(id.trim()) ? Number(id.trim()) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Un id de propuesta (`prop…`): el mismo formato que valida la action de escritorio. */
export function idDePropuesta(id: unknown): string | null {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(id) ? id : null;
}

// ── Orden ────────────────────────────────────────────────────────────────────

const t = (iso?: string): number => { const n = Date.parse(iso ?? ''); return Number.isFinite(n) ? n : 0; };

/**
 * Por bandeja en el orden de `TIPOS_DECISION`. Adentro: las pendientes por lo que vence
 * antes; las confirmaciones del CRM de la más vieja a la más nueva (como la tarjeta del
 * CRM: lo que MaKo aplicó hace más tiempo lleva más tiempo sin mirar); el resto, lo más
 * nuevo primero (como las bandejas de escritorio).
 */
export function ordenarItems<T extends Pick<Comun, 'venceAt' | 'creadaAt'> & { tipo: TipoDecision }>(items: readonly T[]): T[] {
  const rango = (x: T) => TIPOS_DECISION.indexOf(x.tipo);
  return [...items].sort((a, b) => {
    if (a.tipo !== b.tipo) return rango(a) - rango(b);
    if (a.tipo === 'pendiente') return t(a.venceAt) - t(b.venceAt);
    if (a.tipo === 'confirmacion') return t(a.creadaAt) - t(b.creadaAt);
    return t(b.creadaAt) - t(a.creadaAt);
  });
}
