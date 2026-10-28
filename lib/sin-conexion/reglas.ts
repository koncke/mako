// =============================================================================
// MaKo sin conexión — las reglas que comparten el servidor, la app y el cascarón (28/10/2026)
// =============================================================================
// Martín (28/10): «que la app desktop funcione offline y luego cuando se vuelva a tener conexión se carguen las cosas». El
// diseño entero, con por qué la PWA y no Electron, Tauri ni mako-pc: docs/diseno-mako-desktop-sin-conexion.md.
//
// Este archivo es PURO y sin dependencias de runtime: lo importan el servidor (la ruta de la copia), la app (la que la guarda)
// y el cascarón de public/sin-conexion/ (armado con esbuild: scripts/sin-conexion/armar.mjs). Los tipos de las lecturas del
// teléfono entran sólo como `import type`: no viajan al cascarón.
// =============================================================================

import type { TableroCrmM } from '@/app/m/crm/datos';
import type { ColumnaTareasM, ProyectoPlanM, RecurrenteM, TareaKanbanM } from '@/app/m/plan/tableros';
import type { ItemPlan } from '@/app/plan/board/hoy';

/** El evento de la ventana con el que la fila de Perfil le avisa a <CopiaSinConexion> que la persona lo activó. */
export const EVENTO_ACTIVADO = 'mako-sin-conexion-activado';
/** El formato de la copia. El cascarón que no lo conoce no la abre: pide abrir MaKo con conexión una vez. */
export const VERSION_COPIA = 1;
/** Cada cuánto se renueva la copia con conexión. */
export const CADA_MS = 10 * 60_000;
/** Una copia que no volvió a ver al servidor en tanto tiempo se borra sola (la persona puede haber perdido el acceso). */
export const VENCE_DIAS = 30;
/** El cascarón abierto se cierra solo tras este tiempo sin tocar nada: otra persona en la misma PC no encuentra lo de otra. */
export const BLOQUEO_INACTIVO_MS = 15 * 60_000;
/** PBKDF2-SHA256 de la clave de esta computadora (lo que recomienda OWASP para PBKDF2-HMAC-SHA256). */
export const VUELTAS = 600_000;
/** La clave de esta computadora: 6 caracteres o más. */
/**
 * 8 y no 6 (verificación de 90d6410eb): la clave es lo ÚNICO que protege lo guardado frente a otra persona en la misma PC
 * (Chrome no cifra la IndexedDB en disco), y quien tiene el perfil copia la base y prueba sin el cascarón: limitar los
 * intentos no sirve, sirve que la clave no sea de las primeras que se prueban (`CLAVES_COMUNES`).
 */
export const MIN_CLAVE = 8;
export const MAX_CLAVE = 128;

/** Un lead del tablero, con lo que dibuja la ficha sin conexión (la tarjeta del teléfono no lo trae: `tableroCrm` con `conContacto`). */
export type ContactoCopia = {
  email: string | null;
  empresa: string | null;
  origen: string | null;
  /** ISO de cuando llegó. */
  creado: string | null;
  /** La próxima reunión (ISO, o `YYYY-MM-DD` si es sólo el día). */
  reunion: string | null;
  monto: number;
};

/** `pendiente`: la escribió la persona sin conexión y todavía no subió (lib/sin-conexion/cola.ts → conLoPendiente). */
export type NotaCopia = { texto: string; cuando: string; autor: string; pendiente?: boolean };

export type PlanCopia = {
  /** `YYYY-MM-DD` en la zona del negocio. */
  fecha: string;
  prioridades: ItemPlan[];
  columnas: ColumnaTareasM[];
  tareas: TareaKanbanM[];
  proyectos: ProyectoPlanM[];
  recurrentes: RecurrenteM[];
  /** Una lectura llegó a su tope: puede faltar parte. */
  recortado: boolean;
};

export type CopiaV1 = {
  version: typeof VERSION_COPIA;
  /** ISO: cuándo se leyó. Es la hora de la cinta. */
  hecha: string;
  /** La zona del negocio: la hora de la cinta se dice en ella. */
  tz: string;
  negocio: { id: number; nombre: string };
  /**
   * `email`: el de la SESIÓN que armó la copia (verificación de 90d6410eb: si la cookie pasaba de Ana a Beto entre el pedido
   * de la llave y el de la copia, el negocio de Beto quedaba cifrado en la base de Ana). `guardarCopia` lo compara.
   */
  persona: { nombre: string; email?: string };
  /**
   * null = no se pudo leer (y `faltan` lo dice). Un tablero por funnel, el del negocio primero, con TODAS las tarjetas y su
   * `contacto`. `notas`: las últimas de cada lead, por id.
   */
  crm: { tableros: TableroCrmM[]; notas: Record<string, NotaCopia[]>; notasRecortadas?: boolean } | null;
  plan: PlanCopia | null;
  /** Lo que no se pudo leer, en palabras («el CRM», «el Plan», «el CRM de «Ventas»», «las notas del CRM»). */
  faltan: string[];
  /**
   * Las PARTES que esta renovación no pudo leer aunque el CRM sí (verificación de 90d6410eb, 28/10/2026): los funnels cuyo
   * tablero falló, las notas, la lista de funnels. Con esto `conLoDeAntes` no pisa lo bueno que había con un hueco.
   */
  huecos?: { funnels?: Array<number | null>; notas?: boolean; otrosFunnels?: boolean };
  /** Lo que se dejó de la copia anterior porque esta vez no se pudo leer: qué (como en `faltan`) y de cuándo. */
  deAntes?: Array<{ que: string; hecha: string }>;
};

/**
 * La copia nueva con lo que NO se pudo leer tomado de la anterior (verificación de 90d6410eb, 28/10/2026): MaKo se degrada
 * antes de caerse, y una renovación a medias reemplazaba la última copia buena justo cuando más falta hace. El CRM o el
 * Plan que llegaron en null, el tablero de un funnel que falló, las notas y los otros funnels vuelven de la anterior, y
 * `deAntes` dice qué y de cuándo (de la anterior, o de lo que ella misma ya traía de antes). Lo que se cubrió deja de
 * estar en `faltan`. Sin anterior del mismo negocio, la nueva tal cual. Pura.
 */
export function conLoDeAntes(nueva: CopiaV1, previa: CopiaV1 | null): CopiaV1 {
  if (!previa || previa.negocio.id !== nueva.negocio.id) return nueva;
  const deAntes = [...(nueva.deAntes ?? [])];
  const de = (que: string, previo?: string) => {
    const hecha = previa.deAntes?.find((d) => d.que === (previo ?? que))?.hecha ?? previa.hecha;
    deAntes.push({ que, hecha });
  };
  let crm = nueva.crm;
  let plan = nueva.plan;
  if (!plan && previa.plan) { plan = previa.plan; de('el Plan'); }
  if (!crm && previa.crm) { crm = previa.crm; de('el CRM'); }
  else if (crm && previa.crm) {
    const h = nueva.huecos ?? {};
    const tableros = [...crm.tableros];
    const hay = new Set(tableros.map((t) => t.funnelId));
    const nombre = (id: number | null) => previa.crm!.tableros[0]?.funnels.find((f) => f.id === id)?.nombre ?? 'otro funnel';
    for (const id of h.funnels ?? []) {
      const viejo = previa.crm.tableros.find((t) => t.funnelId === id);
      if (viejo && !hay.has(id)) { tableros.push(viejo); hay.add(id); de(`el CRM de «${nombre(id)}»`); }
    }
    if (h.otrosFunnels) {
      const otros = previa.crm.tableros.filter((t) => !hay.has(t.funnelId));
      if (otros.length) { tableros.push(...otros); de('los otros funnels del CRM'); }
    }
    const notas = h.notas ? previa.crm.notas : crm.notas;
    if (h.notas) de('las notas del CRM');
    crm = { ...crm, tableros, notas };
  }
  const cubiertas = new Set(deAntes.map((d) => d.que));
  return { ...nueva, crm, plan, faltan: nueva.faltan.filter((f) => !cubiertas.has(f)), ...(deAntes.length ? { deAntes } : {}) };
}

export type MotivoSinConexion = 'sin-red' | 'no-responde';

/** El email como se compara: sin espacios y en minúsculas. */
export const normalizarEmail = (email: string): string => email.trim().toLowerCase();

/** Las que se prueban primero (listas de claves filtradas y las del teclado). Se comparan en minúsculas. */
const CLAVES_COMUNES = new Set([
  'password', 'password1', 'password123', 'passw0rd', 'contraseña', 'contrasena', 'contraseña1', 'contrasena1', 'qwertyuiop',
  'qwerty123', 'qwerty12', 'asdfghjkl', 'asdfghjk', 'zxcvbnm1', 'qazwsxedc', '1qaz2wsx', '1q2w3e4r', '1q2w3e4r5t', 'q1w2e3r4',
  'abc12345', 'abcd1234', 'a1b2c3d4', '12345678a', 'iloveyou', 'iloveyou1', 'teamo123', 'tequiero', 'sunshine', 'princess',
  'football', 'baseball', 'superman', 'trustno1', 'letmein1', 'welcome1', 'admin123', 'administrador', 'mako1234', 'makomako',
  'hola1234', 'clave123', 'clave1234', 'argentina', 'mexico123', 'colombia', 'america1', 'dragon12', 'monkey12', 'master12',
  '11223344', '12341234', '12121212', '11112222', '00000001', '13579246', '24682468', '01020304', 'abcdabcd', 'aaaa1111',
]);

/** ¿Sirve como clave de esta computadora? null = sí; si no, el motivo en una frase. */
export function problemaDeClave(clave: string, repetida?: string): string | null {
  if (clave.length < MIN_CLAVE) return `Tiene que tener ${MIN_CLAVE} caracteres o más.`;
  if (clave.length > MAX_CLAVE) return 'Es demasiado larga.';
  if (/^(.)\1+$/.test(clave)) return 'No puede ser el mismo carácter repetido.';
  if ('0123456789'.includes(clave) || '9876543210'.includes(clave)) return 'No puede ser una escalera de números.';
  // Lo mismo repetido («abcabcabc», «12341234») y las de la lista: las primeras que prueba cualquiera.
  if (/^(.{1,4})\1+$/.test(clave) || CLAVES_COMUNES.has(clave.toLowerCase())) return 'Es de las claves más usadas: elige otra.';
  if (repetida !== undefined && repetida !== clave) return 'Las dos claves no coinciden.';
  return null;
}

/**
 * El dato asociado (AAD) de cada copia cifrada: la persona y el negocio. Una copia pasada de una cuenta a otra, o de un negocio
 * a otro, no abre aunque la llave sea la misma.
 */
export const aadDeCopia = (email: string, ws: number): string => `mako-sc:v1|${normalizarEmail(email)}|ws=${ws}`;
/** El de la llave envuelta con la clave de esta computadora. */
export const aadDeLlave = (email: string, dispositivo: string): string => `mako-sc:v1|${normalizarEmail(email)}|llave|${dispositivo}`;

/** El id de esta computadora para esta persona: 16 bytes al azar en base64url (22 caracteres). Lo valida la ruta de la llave. */
export const RE_DISPOSITIVO = /^[A-Za-z0-9_-]{22,64}$/;

/** Lo que guarda IndexedDB de una persona (en claro sólo lo que no dice nada del negocio). */
export type LlaveGuardada = {
  dispositivo: string;
  /** base64url */
  sal: string;
  vueltas: number;
  /** La DEK cifrada con la clave de esta computadora. base64url. */
  iv: string;
  envuelta: string;
  /**
   * La huella de la DEK (SHA-256, base64url): sin la clave, la app sabe si la llave que da HOY el servidor es la que está
   * envuelta. Si no lo es (se rotó `CREDENCIALES_SECRET`), una copia nueva no abriría con la clave: no se guarda y se pide
   * elegir la clave de nuevo. Es el hash de 32 bytes al azar: no ayuda a adivinarla.
   */
  huella: string;
  /** ISO: la última vez que el servidor dio la llave (para el vencimiento). */
  vistoServidor: string;
};
export type CopiaGuardada = { ws: number; iv: string; datos: string; version: number };
/**
 * Un cambio hecho sin conexión (T2), cifrado como la copia. En claro sólo el orden (`seq`) y el negocio (`ws`): el panel
 * cuenta cuántos hay sin descifrar nada, y nada de eso dice qué se escribió.
 */
export type ColaGuardada = { id: string; ws: number; seq: number; iv: string; datos: string };
/** El AAD de un cambio de la cola: la persona y su id. Un cambio pasado a otra cuenta no abre. */
export const aadDeCola = (email: string, id: string): string => `mako-sc:v1|${normalizarEmail(email)}|cola|${id}`;

/** ¿Venció? Pasó `VENCE_DIAS` sin que el servidor diera la llave. */
export function vencida(vistoServidor: string, ahora: number = Date.now()): boolean {
  const t = Date.parse(vistoServidor);
  return !Number.isFinite(t) || ahora - t > VENCE_DIAS * 86_400_000;
}

/** El día `YYYY-MM-DD` de un instante en la zona `tz`. */
function diaEn(ms: number, tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms);
  } catch {
    return new Date(ms).toISOString().slice(0, 10);
  }
}
function horaEn(ms: number, tz: string): string {
  try {
    return new Intl.DateTimeFormat('es-AR', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ms);
  } catch {
    return new Date(ms).toISOString().slice(11, 16);
  }
}

/** «lo de las 10:42», «lo de ayer a las 18:30» o «lo del 26/10 a las 18:30». */
export function deCuando(hecha: string, tz: string, ahora: number = Date.now()): string {
  const t = Date.parse(hecha);
  if (!Number.isFinite(t)) return 'lo de la última vez que hubo conexión';
  const hoy = diaEn(ahora, tz);
  const dia = diaEn(t, tz);
  const hora = horaEn(t, tz);
  if (dia === hoy) return `lo de las ${hora}`;
  if (dia === diaEn(ahora - 86_400_000, tz)) return `lo de ayer a las ${hora}`;
  return `lo del ${dia.slice(8, 10)}/${dia.slice(5, 7)} a las ${hora}`;
}

/** La cinta de arriba: «Sin conexión · lo que ves es lo de las 10:42». */
export function textoDeLaCinta(p: { motivo: MotivoSinConexion; hecha: string; tz: string; ahora?: number }): string {
  const que = p.motivo === 'sin-red' ? 'Sin conexión' : 'MaKo no responde';
  return `${que} · lo que ves es ${deCuando(p.hecha, p.tz, p.ahora)}`;
}

/** Lo que la pantalla dice de algo que no anda sin conexión. Una línea, con el motivo. */
export const NECESITA_CONEXION = {
  whatsapp: 'Necesita conexión: WhatsApp sale desde MaKo.',
  ia: 'Necesita conexión: MaKo piensa en el servidor.',
  escribir: 'Lo que escribes aquí se sube cuando vuelva la conexión, con tu OK.',
} as const;
