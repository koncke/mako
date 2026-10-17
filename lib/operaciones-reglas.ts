// =============================================================================
// El Centro de Operaciones — las reglas puras (sin server-only, a propósito: las importan la
// pantalla, el servidor y los tests)
// =============================================================================
// Pedido de Martín (15/10/2026): «continua y termina el centro de operaciones». El diseño, en
// docs/diseno-centro-de-operaciones.md; lo que costó, en docs/hallazgos-operaciones.md.
//
// ⚠️ LA VERDAD DE UN PEDIDO ES EL TEXTO FIRMADO. El navegador de Martín arma el JSON con
// `armarFirmable`, lo firma con una clave que no se puede exportar y que el servidor no tiene, y
// el cartero de la PC verifica la firma y entrega lo que dice ESE texto. El servidor lo guarda tal
// cual y no lo vuelve a armar: si lo reconstruyera, la firma dejaría de cubrir lo que se entrega.
// Por eso acá no hay una «canonicalización» que tenga que coincidir entre dos lugares: el cartero
// sólo PARSEA el texto que verificó (scripts/operaciones/cartero.mjs, y un test diferencial
// prueba que los dos lados leen lo mismo).
// =============================================================================

import { TOPE_ADJUNTOS, TOPE_TOTAL_BYTES } from './mako-adjuntos';

export const VERSION_PEDIDO = 1 as const;
/** Tope del texto de un pedido. Se RECHAZA, no se recorta (AGENTS.md: un tope en un texto que
 *  escribe una persona rechaza). */
export const MAX_TEXTO = 8000;
/** Un pedido firmado vale dos semanas: alcanza para que vuelva una cuenta inactiva. */
export const VENCE_DIAS = 14;
/** Más que esto sin noticias del cartero y la pantalla deja de decir «vivo». El cartero pasa
 *  cada uno o dos minutos (el cron del chat Cartero). */
export const CARTERO_VIVO_MS = 4 * 60 * 1000;
/** Un trabajo `tomado` sin acuse por más que esto se da por «no sé si llegó» (y sus adjuntos se borran). Es mucho más que
 *  los 30 minutos con que la PC vence su buzón: el acuse de la PC llega antes, salvo que se haya perdido (un Runner que
 *  se cortó bajando un adjunto, un acuse cuyo UPDATE falló). Sin esto, quedaba `tomado` para siempre. */
export const TOMADO_VENCE_MS = 2 * 3600 * 1000;

/** Cuántos pedidos reclama el cartero por vuelta. */
export const POR_VUELTA = 10;

export const ESTADOS = ['escrito', 'tomado', 'entregado', 'no_entregado', 'incierto', 'hecho', 'comprobado', 'cancelado'] as const;
export type EstadoPedido = (typeof ESTADOS)[number];

/** Los rótulos de la pantalla: una o dos palabras. escrito ≠ entregado ≠ hecho ≠ comprobado. */
export const ROTULO: Record<EstadoPedido, string> = {
  escrito: 'Escrito',
  tomado: 'Entregando',
  entregado: 'Entregado',
  no_entregado: 'No se pudo',
  incierto: 'No sé si llegó',
  hecho: 'Hecho',
  comprobado: 'Comprobado',
  cancelado: 'Cancelado',
};

export const ALCANCES = ['solo_esto', 'de_ahora_en_mas'] as const;
export type Alcance = (typeof ALCANCES)[number];

/**
 * El modelo y el esfuerzo con los que Martín quiere que corra el chat (17/10/2026: «que los jefes y el cerebro tengan la
 * capacidad de ahorrar tokens... eligiendo qué modelo de IA debe correr»). Van ADENTRO de la firma, OPCIONALES: sin
 * ellos el texto firmado es idéntico al de siempre, y un cartero de antes los ignora. Los aplica el Runner (lib/runner.ts)
 * y sólo en un chat de la app (lib/centro-cuentas.ts → aceptaModelo). El cartero los valida igual (test diferencial).
 */
export const MODELOS = ['opus', 'sonnet', 'haiku'] as const;
export type Modelo = (typeof MODELOS)[number];
export const ESFUERZOS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type Esfuerzo = (typeof ESFUERZOS)[number];

export type PayloadPedido = {
  v: typeof VERSION_PEDIDO;
  /** uuid que pone el navegador; va adentro de la firma. */
  id: string;
  texto: string;
  /** El id del chat: `local_…` para uno de la app de escritorio, `cli_…` para una sesión de
   *  terminal. Nunca el nombre: se repiten entre cuentas y dentro de una. */
  destino: string;
  /** claude1 … claude4, o null si el cartero no lo sabe. Informativo. */
  cuenta: string | null;
  /** El título del chat al firmar. Informativo: el cartero entrega por `destino`. */
  titulo: string | null;
  alcance: Alcance;
  creado: string;
  vence: string;
  /** null o ausente = «Automático»: no se toca el modelo del chat. */
  modelo?: Modelo | null;
  esfuerzo?: Esfuerzo | null;
  /** Las fotos y los PDF que van con el trabajo (17/10/2026). Ausente = sin adjuntos: el texto firmado es el de siempre. */
  adjuntos?: AdjuntoPedido[];
};

// ── Los adjuntos de un trabajo (17/10/2026) ──────────────────────────────────────────────────────────────────────────
// Martín: adjuntar imágenes y archivos en la caja, y pegar una captura con Ctrl+V, y que lleguen al chat. Dio el OK de que
// un archivo baje a la PC, con estas condiciones, que no se negocian:
//   · baja SÓLO lo que nombra un trabajo FIRMADO: el `sha256` de cada archivo lo calcula el navegador sobre los bytes que
//     sube y va adentro de la firma; la PC lo compara con lo que baja. Con MaKo comprometida, lo peor es que no baje;
//   · a una carpeta fija por trabajo (`~/.claude/operaciones/adjuntos/<id>/`), con un nombre que arma la PC;
//   · con el tipo y el tamaño validados (por los primeros bytes, no por la extensión), y nunca un ejecutable: sólo las
//     fotos y el PDF que ya acepta el chat con MaKo (lib/mako-adjuntos.ts), con los mismos topes;
//   · el chat recibe la RUTA local en el mensaje (scripts/operaciones/cartero.mjs → bajarAdjuntos).
export const MIMES_ADJUNTO = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'] as const;
export type MimeAdjunto = (typeof MIMES_ADJUNTO)[number];
/** Cuántos archivos y cuántos bytes en total: los del chat con MaKo (Vercel corta un POST de más de ~4,5 MB). */
export const MAX_ADJUNTOS = TOPE_ADJUNTOS;
export const MAX_BYTES_ADJUNTOS = TOPE_TOTAL_BYTES;
export const MAX_NOMBRE_ADJUNTO = 120;
/** `ref`: dónde lo guardó MaKo (un uuid); `bytes` y `sha256`: los del archivo que salió del navegador. */
export type AdjuntoPedido = { ref: string; nombre: string; mime: MimeAdjunto; bytes: number; sha256: string };

/** null si los adjuntos de un texto firmado valen; si no, el motivo. La MISMA regla que el cartero (test diferencial). */
export function problemaDeAdjuntos(x: unknown): string | null {
  if (!Array.isArray(x) || !x.length || x.length > MAX_ADJUNTOS) return 'adjuntos inválidos';
  const refs = new Set<string>();
  let total = 0;
  for (const a of x) {
    if (!a || typeof a !== 'object' || Array.isArray(a)) return 'adjuntos inválidos';
    const o = a as Record<string, unknown>;
    if (typeof o.ref !== 'string' || !UUID_RE.test(o.ref) || refs.has(o.ref)) return 'adjuntos inválidos';
    refs.add(o.ref);
    if (typeof o.nombre !== 'string' || !o.nombre.trim() || o.nombre.length > MAX_NOMBRE_ADJUNTO || /[\u0000-\u001f]/.test(o.nombre)) return 'adjuntos inválidos';
    if (!(MIMES_ADJUNTO as readonly unknown[]).includes(o.mime)) return 'adjuntos inválidos';
    if (typeof o.bytes !== 'number' || !Number.isInteger(o.bytes) || o.bytes < 1) return 'adjuntos inválidos';
    if (typeof o.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(o.sha256)) return 'adjuntos inválidos';
    total += o.bytes;
  }
  return total > MAX_BYTES_ADJUNTOS ? 'adjuntos inválidos' : null;
}

/** El cartero que baja adjuntos. Con uno de antes, el trabajo saldría SIN sus archivos y nadie lo diría: la caja no ofrece
 *  adjuntar hasta que el Runner de esa cuenta suba esta versión (o una más nueva). */
export const VERSION_ADJUNTOS = '1.9.1';
export function aceptaAdjuntos(version: string | null | undefined): boolean {
  const v = /^(\d+)\.(\d+)\.(\d+)/.exec(version ?? '');
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(VERSION_ADJUNTOS)!;
  if (!v) return false;
  for (let i = 1; i <= 3; i++) if (Number(v[i]) !== Number(m[i])) return Number(v[i]) > Number(m[i]);
  return true;
}

/** Los nombres de los adjuntos de un texto firmado, para dibujarlos en la conversación (vacío si no tiene). */
export function nombresDeAdjuntos(firmado: string | null | undefined): string[] {
  try {
    const o = JSON.parse(firmado ?? '') as { adjuntos?: unknown };
    if (!Array.isArray(o.adjuntos)) return [];
    return o.adjuntos.map((a) => (a as { nombre?: unknown })?.nombre).filter((n): n is string => typeof n === 'string' && !!n.trim()).slice(0, MAX_ADJUNTOS).map((n) => n.slice(0, MAX_NOMBRE_ADJUNTO));
  } catch {
    return [];
  }
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const DESTINO_RE = /^(local|cli)_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const CUENTA_RE = /^claude\d{1,2}$/;

/** El texto que se firma. El orden de las claves es fijo, pero nadie tiene que reproducirlo:
 *  se guarda y se verifica este mismo string. */
export function armarFirmable(p: PayloadPedido): string {
  return JSON.stringify({
    v: p.v, id: p.id, texto: p.texto, destino: p.destino, cuenta: p.cuenta,
    titulo: p.titulo, alcance: p.alcance, creado: p.creado, vence: p.vence,
    // Sólo si se eligieron: sin ellos, el texto firmado es el de siempre.
    ...(p.modelo ? { modelo: p.modelo } : {}),
    ...(p.esfuerzo ? { esfuerzo: p.esfuerzo } : {}),
    // Los adjuntos, sólo si hay: sin ellos, el texto firmado es el de siempre.
    ...(p.adjuntos?.length ? { adjuntos: p.adjuntos.map((a) => ({ ref: a.ref, nombre: a.nombre, mime: a.mime, bytes: a.bytes, sha256: a.sha256 })) } : {}),
  });
}

export function nuevoPayload(entrada: {
  id: string; texto: string; destino: string; cuenta: string | null; titulo: string | null; alcance: Alcance;
  modelo?: Modelo | null; esfuerzo?: Esfuerzo | null; adjuntos?: readonly AdjuntoPedido[];
}, ahora: number): PayloadPedido {
  return {
    v: VERSION_PEDIDO,
    id: entrada.id,
    texto: entrada.texto.trim(),
    destino: entrada.destino,
    cuenta: entrada.cuenta,
    titulo: entrada.titulo,
    alcance: entrada.alcance,
    creado: new Date(ahora).toISOString(),
    vence: new Date(ahora + VENCE_DIAS * 86_400_000).toISOString(),
    modelo: entrada.modelo ?? null,
    esfuerzo: entrada.esfuerzo ?? null,
    ...(entrada.adjuntos?.length ? { adjuntos: [...entrada.adjuntos] } : {}),
  };
}

export type Lectura = { ok: true; p: PayloadPedido } | { ok: false; motivo: string };

/** Lee y valida un texto firmado. La usan el servidor (al encolar) y los tests; el cartero tiene
 *  la suya, en JS plano, y el test diferencial las compara. */
export function leerFirmable(texto: string, ahora: number): Lectura {
  let x: unknown;
  try { x = JSON.parse(texto); } catch { return { ok: false, motivo: 'no es JSON' }; }
  if (!x || typeof x !== 'object' || Array.isArray(x)) return { ok: false, motivo: 'no es un objeto' };
  const o = x as Record<string, unknown>;
  if (o.v !== VERSION_PEDIDO) return { ok: false, motivo: 'versión desconocida' };
  if (typeof o.id !== 'string' || !UUID_RE.test(o.id)) return { ok: false, motivo: 'id inválido' };
  if (typeof o.texto !== 'string' || !o.texto.trim()) return { ok: false, motivo: 'sin texto' };
  if (o.texto.length > MAX_TEXTO) return { ok: false, motivo: `el texto pasa de ${MAX_TEXTO} caracteres` };
  if (typeof o.destino !== 'string' || !DESTINO_RE.test(o.destino)) return { ok: false, motivo: 'destino inválido' };
  if (o.cuenta !== null && (typeof o.cuenta !== 'string' || !CUENTA_RE.test(o.cuenta))) return { ok: false, motivo: 'cuenta inválida' };
  if (o.titulo !== null && typeof o.titulo !== 'string') return { ok: false, motivo: 'título inválido' };
  if (!(ALCANCES as readonly unknown[]).includes(o.alcance)) return { ok: false, motivo: 'alcance inválido' };
  if (o.modelo != null && !(MODELOS as readonly unknown[]).includes(o.modelo)) return { ok: false, motivo: 'modelo inválido' };
  if (o.esfuerzo != null && !(ESFUERZOS as readonly unknown[]).includes(o.esfuerzo)) return { ok: false, motivo: 'esfuerzo inválido' };
  if (o.adjuntos !== undefined) { const m = problemaDeAdjuntos(o.adjuntos); if (m) return { ok: false, motivo: m }; }
  const creado = typeof o.creado === 'string' ? Date.parse(o.creado) : NaN;
  const vence = typeof o.vence === 'string' ? Date.parse(o.vence) : NaN;
  if (!Number.isFinite(creado) || !Number.isFinite(vence)) return { ok: false, motivo: 'fechas inválidas' };
  if (vence <= creado || vence - creado > (VENCE_DIAS + 1) * 86_400_000) return { ok: false, motivo: 'vencimiento inválido' };
  // Un minuto de margen por relojes corridos entre el teléfono y el servidor.
  if (creado > ahora + 60_000) return { ok: false, motivo: 'fecha en el futuro' };
  if (vence <= ahora) return { ok: false, motivo: 'venció' };
  return {
    ok: true,
    p: {
      v: VERSION_PEDIDO, id: o.id, texto: o.texto, destino: o.destino,
      cuenta: (o.cuenta as string | null) ?? null, titulo: (o.titulo as string | null) ?? null,
      alcance: o.alcance as Alcance, creado: o.creado as string, vence: o.vence as string,
      modelo: (o.modelo as Modelo | null | undefined) ?? null, esfuerzo: (o.esfuerzo as Esfuerzo | null | undefined) ?? null,
      ...(o.adjuntos !== undefined ? { adjuntos: o.adjuntos as AdjuntoPedido[] } : {}),
    },
  };
}

/** El id corto de una clave pública: los primeros 16 hex del SHA-256 de su SPKI. */
export const claveIdDe = (sha256Hex: string): string => sha256Hex.slice(0, 16).toLowerCase();

// ── La guarda de plataforma ─────────────────────────────────────────────────────────────────
// ⚠️ `getSesionAdmin()` contesta «¿es admin global?», y eso no alcanza para una puerta a la PC de
// Martín. Se pide además, EN POSITIVO: que la sesión sea del workspace de la plataforma
// (`wsSuperAdmin()`, nunca OWNER_WS), que tenga una fila real (no `dev`, `password` ni `legacy`) y
// que haya pasado un segundo factor de verdad (`mfa` firmado y distinto de `dev`). Medido el 15/10:
// hay UN admin global, Martín, en el ws 9 (capa superadmin) y con 2FA.
export type SesionMinima = {
  sub: string; rol: string; ws?: number | null; legacy?: boolean; mfa?: string;
};
const SUBS_SIN_FILA = new Set(['dev', 'password', 'legacy']);

export function puedeOperar<T extends SesionMinima>(s: T | null | undefined, wsPlataforma: number): s is T {
  if (!s) return false;
  if (s.rol !== 'admin') return false;
  if (s.legacy) return false;
  if (!s.sub || SUBS_SIN_FILA.has(s.sub)) return false;
  if (!s.mfa || s.mfa === 'dev') return false;
  return typeof s.ws === 'number' && s.ws === wsPlataforma;
}

// ── Lo que sube el cartero ──────────────────────────────────────────────────────────────────
export type ChatCartero = {
  local: string;
  titulo: string;
  cuenta: string | null;
  /** true = la sesión está corriendo en la PC ahora (puede recibir). */
  vivo: boolean;
  /** busy / idle cuando está vivo. */
  estado: 'busy' | 'idle' | null;
  /** La última actividad que registra la app, ISO. */
  actividad: string | null;
  /**
   * ¿Hay un Runner abierto en la carpeta de config de esta sesión? SendMessage sólo llega a las sesiones de la
   * MISMA carpeta (medido el 16/10/2026: «ENOINBOX: no-key»), y cada cuenta de terminal tiene la suya: un chat vivo
   * sin Runner en su carpeta no recibe. Falta (undefined) en lo que subió un cartero de antes de la 1.4.0.
   */
  runner?: boolean;
};

const corto = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function sanearChats(x: unknown): ChatCartero[] {
  if (!Array.isArray(x)) return [];
  const out: ChatCartero[] = [];
  const vistos = new Set<string>();
  for (const c of x.slice(0, 400)) {
    if (!c || typeof c !== 'object') continue;
    const o = c as Record<string, unknown>;
    const local = corto(o.local, 60);
    if (!DESTINO_RE.test(local) || vistos.has(local)) continue;
    vistos.add(local);
    const cuenta = corto(o.cuenta, 12);
    const act = corto(o.actividad, 40);
    out.push({
      local,
      titulo: corto(o.titulo, 120) || '(sin título)',
      cuenta: CUENTA_RE.test(cuenta) ? cuenta : null,
      vivo: o.vivo === true,
      estado: o.estado === 'busy' || o.estado === 'idle' ? o.estado : null,
      actividad: act && Number.isFinite(Date.parse(act)) ? act : null,
      ...(typeof o.runner === 'boolean' ? { runner: o.runner } : {}),
    });
  }
  return out;
}

/**
 * Lo que un cartero dice que la PC puede entregar ahora (1.4.0): sus chats vivos con un Runner en su carpeta. Sólo
 * cuenta lo que ESTE mismo cartero subió vivo en la vuelta: no se reclama nada para un chat que no mostró. Sin la
 * lista (un cartero de antes), todos sus vivos, como siempre.
 */
export function sanearEntregables(x: unknown, chats: readonly ChatCartero[]): string[] {
  const vivos = chats.filter((c) => c.vivo).map((c) => c.local);
  if (!Array.isArray(x)) return vivos;
  const pedidos = new Set(x.filter((v): v is string => typeof v === 'string'));
  return vivos.filter((l) => pedidos.has(l));
}

export function sanearClaves(x: unknown): string[] {
  if (!Array.isArray(x)) return [];
  return [...new Set(x.filter((k): k is string => typeof k === 'string' && /^[0-9a-f]{16}$/.test(k)))].slice(0, 20);
}

export type Acuse = { id: string; estado: 'entregado' | 'no_entregado' | 'incierto'; motivo: string | null };

export function sanearAcuses(x: unknown): Acuse[] {
  if (!Array.isArray(x)) return [];
  const out: Acuse[] = [];
  for (const a of x.slice(0, 100)) {
    if (!a || typeof a !== 'object') continue;
    const o = a as Record<string, unknown>;
    if (typeof o.id !== 'string' || !UUID_RE.test(o.id)) continue;
    if (o.estado !== 'entregado' && o.estado !== 'no_entregado' && o.estado !== 'incierto') continue;
    out.push({ id: o.id, estado: o.estado, motivo: corto(o.motivo, 300) || null });
  }
  return out;
}

// ── Lo que se dijo en cada chat (17/10/2026) ──────────────────────────────────────────────────────────────────────
// Martín, mirando el Centro en producción: «los chats no se entienden... No se entiende la conversación que se tiene».
// La conversación tiene que leerse como un chat de verdad: lo que se le dijo y lo que CONTESTÓ (el texto final de cada
// turno). Lo saca la PC del transcript de cada chat (cartero.mjs → turnosDeLineas) y lo sube en la vuelta, sólo lo
// nuevo; MaKo guarda los últimos de cada chat (lib/centro-turnos-db.ts).

/** Un turno: `yo` = lo que se le escribió (Martín, en la app o por un trabajo); `el` = lo que contestó al terminar;
 *  `otro` = lo que le mandó otra sesión (`de`: su nombre, por ejemplo «Cerebro»). `trabajo` = el id del trabajo del Centro
 *  que lo trajo (ese ya se ve como trabajo: el turno no se repite). */
export type TurnoChat = { local: string; uuid: string; rol: 'yo' | 'el' | 'otro'; de: string | null; texto: string; at: string; trabajo: string | null };
/** Lo más largo de un turno que se guarda (la PC ya lo corta). */
export const TOPE_TURNO = 4000;
/** Cuántos turnos sube una vuelta, como mucho (la primera de un chat largo trae su historia). */
export const MAX_TURNOS_VUELTA = 300;
/** Cuántos turnos se guardan por chat (los últimos). */
export const TURNOS_POR_CHAT = 60;

export function sanearTurnos(x: unknown): TurnoChat[] {
  if (!Array.isArray(x)) return [];
  const out: TurnoChat[] = [];
  for (const a of x.slice(0, MAX_TURNOS_VUELTA)) {
    if (!a || typeof a !== 'object') continue;
    const o = a as Record<string, unknown>;
    if (typeof o.local !== 'string' || !DESTINO_RE.test(o.local)) continue;
    if (typeof o.uuid !== 'string' || !/^[\w-]{8,64}$/.test(o.uuid)) continue;
    if (o.rol !== 'yo' && o.rol !== 'el' && o.rol !== 'otro') continue;
    if (typeof o.texto !== 'string' || !o.texto.trim()) continue;
    const at = typeof o.at === 'string' ? Date.parse(o.at) : NaN;
    if (!Number.isFinite(at)) continue;
    out.push({
      local: o.local, uuid: o.uuid, rol: o.rol, de: o.rol === 'otro' ? corto(o.de, 60) || null : null,
      texto: o.texto.slice(0, TOPE_TURNO), at: new Date(at).toISOString(),
      trabajo: typeof o.trabajo === 'string' && UUID_RE.test(o.trabajo) ? o.trabajo : null,
    });
  }
  return out;
}

/** Une lo que había con lo nuevo: sin repetir (por `uuid`: dos Runners pueden subir lo mismo), por hora, y sólo los
 *  últimos `TURNOS_POR_CHAT`. */
export function unirTurnos(antes: readonly TurnoChat[], nuevos: readonly TurnoChat[]): TurnoChat[] {
  const porId = new Map<string, TurnoChat>();
  for (const t of [...antes, ...nuevos]) porId.set(t.uuid, t);
  return [...porId.values()].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).slice(-TURNOS_POR_CHAT);
}

/** El cierre de cuatro renglones (§3 del diseño): lo deja el chat al terminar. */
/** `revisar`: la página de MaKo donde se mira lo que hizo (punto 6, la sub-tab «Review»). Sólo una ruta interna. */
export type Cierre = { decidido: string; hecho: string; comprobado: string; sigue: string; prueba: string | null; revisar?: string | null };

/**
 * Una ruta para revisar: «/algo» de MaKo, en un renglón y hasta 300 caracteres; lo demás no se guarda (null). Es la
 * MISMA regla que `esHrefInterno` de la Ticketera (app/admin/runway/decisiones.ts), escrita acá porque ese módulo
 * importa éste: importarla al revés sería circular. tests/centro-revisar.test.ts fija que las dos digan lo mismo.
 */
export function rutaParaRevisar(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const r = v.trim();
  if (!r || r.length > 300 || /[\s\u0000-\u001f]/.test(r)) return null;
  return r.startsWith('/') && !r.startsWith('//') && !r.startsWith('/\\') ? r : null;
}
export type CierreEntrante = { id: string; cierre: Cierre };

export function sanearCierres(x: unknown): CierreEntrante[] {
  if (!Array.isArray(x)) return [];
  const out: CierreEntrante[] = [];
  for (const c of x.slice(0, 100)) {
    if (!c || typeof c !== 'object') continue;
    const o = c as Record<string, unknown>;
    if (typeof o.id !== 'string' || !UUID_RE.test(o.id)) continue;
    const k = (o.cierre && typeof o.cierre === 'object' ? o.cierre : {}) as Record<string, unknown>;
    const cierre: Cierre = {
      decidido: corto(k.decidido, 600), hecho: corto(k.hecho, 600),
      comprobado: corto(k.comprobado, 600), sigue: corto(k.sigue, 600),
      prueba: corto(k.prueba, 300) || null,
    };
    const revisar = rutaParaRevisar(k.revisar);
    if (revisar) cierre.revisar = revisar;
    if (!cierre.hecho && !cierre.decidido) continue;
    out.push({ id: o.id, cierre });
  }
  return out;
}

/** Un cierre con prueba pasa a `comprobado`; sin prueba, a `hecho`. */
export const estadoDeCierre = (c: Cierre): EstadoPedido => (c.prueba ? 'comprobado' : 'hecho');

// ── Qué dice la pantalla de un pedido que espera ────────────────────────────────────────────
// Hay UN CARTERO POR CUENTA (las tres corren a la vez, decisión de Martín del 15/10): cada uno lee
// el registro de sesiones de SU directorio de configuración y entrega adentro de su cuenta, que es
// donde SendMessage funciona. La pantalla junta lo que suben los tres.
export type VistaCartero = { cuenta: string; vistoAt: string | null; chats: ChatCartero[] };

export function carteroVivo(c: { vistoAt: string | null } | null | undefined, ahora: number): boolean {
  if (!c?.vistoAt) return false;
  const t = Date.parse(c.vistoAt);
  return Number.isFinite(t) && ahora - t < CARTERO_VIVO_MS;
}

/** Los chats de todos los carteros, cada uno con la cuenta de SU cartero si no trae la suya. */
export function todosLosChats(carteros: VistaCartero[]): ChatCartero[] {
  const vistos = new Map<string, ChatCartero>();
  for (const k of carteros) {
    for (const c of k.chats) {
      const previo = vistos.get(c.local);
      if (!previo || (c.vivo && !previo.vivo)) vistos.set(c.local, { ...c, cuenta: c.cuenta ?? k.cuenta });
    }
  }
  return [...vistos.values()];
}

/** Para un pedido `escrito`: por qué todavía no salió. null = sale en la próxima vuelta. */
export function motivoDeEspera(
  p: { estado: EstadoPedido; destino: string; destino_cuenta: string | null },
  carteros: VistaCartero[],
  ahora: number,
): string | null {
  if (p.estado !== 'escrito') return null;
  const chat = todosLosChats(carteros).find((x) => x.local === p.destino);
  const cuenta = chat?.cuenta ?? p.destino_cuenta;
  const suyo = carteros.find((k) => k.cuenta === cuenta);
  const n = cuenta ? cuenta.replace('claude', '') : '?';
  if (!carteroVivo(suyo, ahora)) return `Espera al cartero de la cuenta ${n}`;
  if (chat?.vivo) return null;
  return 'El chat está cerrado: sale cuando se abra';
}
