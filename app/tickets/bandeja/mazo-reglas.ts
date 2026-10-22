// =============================================================================
// La Ticketera de Martín, otra vez un MAZO (22/10/2026): la lógica pura, con test
// =============================================================================
// Martín (22/10, 13:18, desde el teléfono): «La ticketera se ve horrible, mejora el diseño... Y te pedí que vuelva la
// vista de tarjetas y el desplazamiento tipo tinder... Luego si quiero elegir la vista tabla también... ver quién levantó
// el ticket con su foto de perfil, por donde lo levantó, etc...». Lo que se copió de quién: docs/hallazgos-ticketera.md.
//
// Acá vive lo que DECIDE (sin React ni base, lo importan los tests): por dónde entró un ticket y su link, qué hace cada
// gesto con cada ticket, cuándo cuenta un gesto, cómo se arma y se refresca el mazo, y el orden de la tabla.
//
// ⚠️ LOS GESTOS SON LAS ACCIONES QUE YA EXISTÍAN (lib/tickets-reglas.ts → DECISIONES), ninguna nueva:
//   derecha = Aprobar (un bug se ARREGLA, un pedido se HACE; una pregunta no se aprueba: se RESPONDE) ·
//   izquierda = Rechazar · arriba = Preguntar (pedirle más al cliente).
// Rechazar, Preguntar y Responder le escriben al CLIENTE, y el servidor no los acepta sin texto
// (`motivoDecisionInvalida`): el gesto sin texto abre la caja, no manda nada.

import { PRIORIDADES, TIPOS, decisionDeAprobar, type DecisionTicket, type EstadoTicket, type TipoTicket } from '@/lib/tickets-reglas';
import type { FilaTicket } from '@/lib/tickets-db';

export type VistaBandeja = 'mazo' | 'tabla';
export const esVistaBandeja = (v: unknown): v is VistaBandeja => v === 'mazo' || v === 'tabla';

// ── Los grupos (los chips de siempre: ahora son el filtro de la tabla) ───────────────────────────────────────────────
export const GRUPOS: ReadonlyArray<{ clave: string; titulo: string; estados: readonly EstadoTicket[] }> = [
  { clave: 'decidir', titulo: 'Por decidir', estados: ['nuevo', 'esperando_decision'] },
  { clave: 'cliente', titulo: 'Esperan al cliente', estados: ['esperando_cliente'] },
  { clave: 'curso', titulo: 'En curso', estados: ['en_curso', 'arreglado'] },
  { clave: 'cerrados', titulo: 'Cerrados', estados: ['resuelto', 'rechazado', 'duplicado'] },
];
export const grupoDe = (e: EstadoTicket): string => GRUPOS.find((g) => g.estados.includes(e))?.clave ?? 'decidir';
export const enGrupo = (t: Pick<FilaTicket, 'estado'>, clave: string): boolean => grupoDe(t.estado) === clave;
/** ¿Lo decide Martín ahora? Lo que entra al mazo. */
export const porDecidir = (t: Pick<FilaTicket, 'estado'>): boolean => enGrupo(t, 'decidir');

/** En la tabla, el estado que ya dice el filtro elegido no se repite en cada fila (Martín: texto corto, sin rótulos que
 *  repiten lo obvio). Se ve lo que DIFIERE: «Nuevo» entre los por decidir, «Sin desplegar» entre los en curso. */
export function estadoObvio(e: EstadoTicket, grupo: string): boolean {
  return (grupo === 'decidir' && e === 'esperando_decision') || (grupo === 'cliente' && e === 'esperando_cliente') || (grupo === 'curso' && e === 'en_curso');
}

export const ROTULO_ESTADO: Record<EstadoTicket, string> = {
  nuevo: 'Nuevo', esperando_decision: 'Por decidir', esperando_cliente: 'Espera al cliente', en_curso: 'En curso',
  arreglado: 'Sin desplegar', resuelto: 'Resuelto', rechazado: 'Rechazado', duplicado: 'Duplicado',
};
export const tipoCorto = (t: TipoTicket): string => TIPOS.find((x) => x.clave === t)?.corto ?? t;

// ── Por dónde entró ───────────────────────────────────────────────────────────────────────────────────────────────
// El canal lo guarda el servidor (`tickets.canal`), y el detalle sale del contexto que juntó el código (`chat.donde`):
// `error-mako` / `error-navegador` / `error-servidor` (lib/errores-app-reglas.ts), `reportar-problema[-movil]`
// (app/tickets/navegador.ts) o el primer tramo de la ruta del chat de MaKo (lib/api-mako/areas/tickets.run.ts).
export type IconoOrigen = 'mako' | 'soporte' | 'whatsapp' | 'rayo' | 'api';
export type Origen = { clave: 'chat' | 'reportar' | 'whatsapp' | 'automatico' | 'api'; rotulo: string; detalle: string; icono: IconoOrigen };

export function origenDe(t: Pick<FilaTicket, 'canal' | 'contexto'>): Origen {
  const donde = t.contexto.chat?.donde ?? '';
  if (t.canal === 'sistema') {
    const detalle = donde === 'error-mako' ? 'MaKo falló en un chat' : donde === 'error-servidor' ? 'Falló el servidor' : 'Se rompió una pantalla';
    return { clave: 'automatico', rotulo: 'Automático', detalle, icono: 'rayo' };
  }
  if (t.canal === 'whatsapp') return { clave: 'whatsapp', rotulo: 'WhatsApp', detalle: 'MaKo en WhatsApp', icono: 'whatsapp' };
  if (t.canal === 'formulario') {
    return { clave: 'reportar', rotulo: 'Reportar problema', detalle: donde.endsWith('-movil') ? 'Desde el teléfono' : 'Desde la computadora', icono: 'soporte' };
  }
  if (t.canal === 'api') return { clave: 'api', rotulo: 'API', detalle: 'La API de MaKo', icono: 'api' };
  return { clave: 'chat', rotulo: 'Chat de MaKo', detalle: t.canal === 'chat_movil' ? 'Desde el teléfono' : 'Desde la computadora', icono: 'mako' };
}

/**
 * El link a donde nació el ticket, ENTRANDO al negocio del cliente (`?ws=`, el mismo «Inspeccionar» de la ficha: el proxy
 * sólo se lo acepta a un admin). La conversación con MaKo si se sabe cuál (`?chat=` del Second Brain), si no la pantalla.
 * WhatsApp no tiene link: la conversación vive en el teléfono de la persona.
 */
export function linkDeOrigen(t: Pick<FilaTicket, 'canal' | 'contexto' | 'workspace_id'>): { href: string; rotulo: string } | null {
  const ws = Number(t.workspace_id);
  if (!Number.isInteger(ws) || ws <= 0) return null;
  const hilo = t.contexto.chat?.hilo ?? '';
  const delChat = t.canal === 'chat_app' || t.canal === 'chat_movil' || (t.canal === 'sistema' && t.contexto.chat?.donde === 'error-mako');
  if (delChat && /^\d{1,12}$/.test(hilo)) return { href: `/second-brain?chat=${hilo}&ws=${ws}`, rotulo: 'Abrir el chat' };
  const ruta = t.contexto.ruta;
  if (ruta && ruta.startsWith('/') && !ruta.startsWith('//')) {
    const u = new URL(ruta, 'https://x.invalid');
    u.searchParams.set('ws', String(ws));
    return { href: `${u.pathname}${u.search}`, rotulo: 'Ver la pantalla' };
  }
  return null;
}

/** El nombre de quien lo levantó. Por WhatsApp sin usuario, su teléfono o el nombre de su WhatsApp. */
export function nombreDe(t: Pick<FilaTicket, 'usuario_nombre' | 'usuario_email'>): string {
  const n = (t.usuario_nombre || '').trim();
  if (n) return n;
  const e = (t.usuario_email || '').trim();
  const wa = /^whatsapp:(.+)$/.exec(e);
  if (!wa) return e || 'Sin nombre';
  return /^\+?\d{8,15}$/.test(wa[1]) ? `+${wa[1].replace(/^\+/, '')}` : wa[1].replace(/-/g, ' ');
}

/** El error que registró el sistema, en corto: sin el digest de Next ni espacios de más, y cortado en una palabra. */
export function errorCorto(e: string | undefined | null, tope = 160): string | null {
  const t = (e ?? '').replace(/\s*\(digest [^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  if (t.length <= tope) return t;
  const corte = t.slice(0, tope);
  const sp = corte.lastIndexOf(' ');
  return `${(sp > tope * 0.6 ? corte.slice(0, sp) : corte).replace(/[\s.,;:—-]+$/, '')}…`;
}

/** Lo que escribió la persona. En un ticket AUTOMÁTICO no escribió nada: el texto es el aviso fijo del sistema. */
export function textoDeLaPersona(t: Pick<FilaTicket, 'canal' | 'descripcion' | 'titulo' | 'contexto'>): string | null {
  if (t.canal === 'sistema') return t.contexto.pedido?.trim() || null;
  const d = (t.descripcion || '').trim();
  return d && d !== t.titulo.trim() ? d : null;
}

const RTF = typeof Intl !== 'undefined' && 'RelativeTimeFormat' in Intl ? new Intl.RelativeTimeFormat('es', { numeric: 'auto' }) : null;
/** «hace 5 minutos», «ayer», «hace 4 días». */
export function haceCuanto(iso: string | null | undefined, ahora: number): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return '';
  const s = Math.round((t - ahora) / 1000);
  const a = Math.abs(s);
  if (a < 60) return 'recién';
  if (!RTF) return new Date(t).toLocaleDateString('es');
  if (a < 3600) return RTF.format(Math.round(s / 60), 'minute');
  if (a < 86_400) return RTF.format(Math.round(s / 3600), 'hour');
  if (a < 30 * 86_400) return RTF.format(Math.round(s / 86_400), 'day');
  return new Date(t).toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

/** Quién lo dijo, en la nota: el Cerebro que lo devolvió o el cliente que contestó. */
export function quienDiceLaNota(n: { actor: string; tipo: string }): string {
  if (n.actor === 'cliente' || n.tipo === 'comentario') return 'Respondió';
  if (n.actor === 'cerebro' || n.tipo === 'reclasificado') return 'Cerebro';
  return n.actor.charAt(0).toUpperCase() + n.actor.slice(1);
}

// ── Qué hace cada gesto ───────────────────────────────────────────────────────────────────────────────────────────
export type Salida = 'derecha' | 'izquierda' | 'arriba';
export type AccionMazo = { decision: DecisionTicket; rotulo: string; pideTexto: boolean; salida: Salida };

export function accionesDe(t: Pick<FilaTicket, 'tipo' | 'estado'>): Record<Salida, AccionMazo | null> {
  const aprobar = t.estado === 'en_curso' ? null : decisionDeAprobar(t.tipo);
  const derecha: AccionMazo = aprobar
    ? { decision: aprobar, rotulo: aprobar === 'arreglar' ? 'Arreglar' : 'Hacer', pideTexto: false, salida: 'derecha' }
    : { decision: 'responder', rotulo: 'Responder', pideTexto: true, salida: 'derecha' };
  return {
    derecha,
    izquierda: { decision: 'rechazar', rotulo: 'Rechazar', pideTexto: true, salida: 'izquierda' },
    arriba: { decision: 'preguntar', rotulo: 'Preguntar', pideTexto: true, salida: 'arriba' },
  };
}

/** Lo que lee el cliente según la acción, para no escribirlo cada vez (las «respuestas guardadas» de Front y Help Scout).
 *  Se tocan para llenar la caja, y se pueden editar antes de mandar: ninguna sale sola. */
export const RESPUESTAS_GUARDADAS: Readonly<Partial<Record<DecisionTicket, readonly string[]>>> = {
  rechazar: [
    'No es un error de MaKo: así funciona hoy.',
    'Por ahora no lo vamos a hacer. Gracias por proponerlo.',
  ],
  preguntar: [
    '¿Me cuentas qué estabas haciendo cuando pasó?',
    '¿Te sigue pasando?',
  ],
  responder: [
    'Ya está arreglado: prueba de nuevo.',
  ],
};

/**
 * ¿El arrastre cuenta, y para dónde? La receta de siempre del mazo (Tinder, Bumble): cuenta si se llevó LEJOS (un
 * cuarto largo de la tarjeta, nunca menos de 100 px) o si fue un TIRÓN (≥ 500 px/s) que ya salió del lugar (≥ 40 px).
 * Arriba con la misma regla, sobre el alto. Llevarla lejos y tirar para atrás al soltar (> 300 px/s) la devuelve.
 * Hacia ABAJO no hay nada: vuelve.
 */
export function veredictoGesto(p: { dx: number; dy: number; vx: number; vy: number; ancho: number; alto: number }): Salida | null {
  const vertical = Math.abs(p.dy) > Math.abs(p.dx);
  if (vertical) {
    if (p.dy >= 0) return null;
    const umbral = Math.max(100, p.alto * 0.22);
    const vuelve = p.vy > 300;
    if (-p.dy >= umbral && !vuelve) return 'arriba';
    if (-p.dy >= 40 && p.vy <= -500) return 'arriba';
    return null;
  }
  const umbral = Math.max(100, p.ancho * 0.28);
  const lado: Salida = p.dx > 0 ? 'derecha' : 'izquierda';
  const vuelve = Math.sign(p.vx) === -Math.sign(p.dx) && Math.abs(p.vx) > 300;
  if (Math.abs(p.dx) >= umbral && !vuelve) return lado;
  if (Math.abs(p.dx) >= 40 && Math.abs(p.vx) >= 500 && Math.sign(p.vx) === Math.sign(p.dx)) return lado;
  return null;
}

// ── El mazo ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** Cuánto espera una decisión antes de salir, para que «Volver» la deshaga ENTERA (el «Deshacer envío» de Gmail: 5 a
 *  30 s). Después de salir no hay vuelta: le avisó al cliente o se la firmó al Cerebro. */
export const VENTANA_DESHACER_MS = 8000;

/** El orden del mazo: lo más urgente primero y, dentro de cada prioridad, el que espera hace más. */
export function ordenDelMazo(ts: readonly FilaTicket[]): number[] {
  return ts.filter(porDecidir)
    .sort((a, b) => PRIORIDADES.indexOf(a.prioridad) - PRIORIDADES.indexOf(b.prioridad) || Date.parse(a.created_at) - Date.parse(b.created_at))
    .map((t) => t.id);
}

/**
 * Lo que llega al refrescar, sobre el mazo que ya se está mirando: el orden NO se rearma (la tarjeta de adelante no
 * cambia sola), se sacan los que ya no esperan una decisión (los decidió otro, o el Cerebro), y lo NUEVO va al final.
 * `vistos` = lo que ya pasó por este mazo; `apartados` = lo decidido acá que todavía no salió (sigue «por decidir» en la
 * base hasta que vence su ventana).
 */
export function refrescarMazo(orden: readonly number[], ts: readonly FilaTicket[], vistos: ReadonlySet<number>, apartados: ReadonlySet<number>): number[] {
  const abiertos = new Set(ts.filter(porDecidir).map((t) => t.id));
  const quedan = orden.filter((id) => abiertos.has(id) && !apartados.has(id));
  const nuevos = ordenDelMazo(ts).filter((id) => !vistos.has(id) && !apartados.has(id) && !quedan.includes(id));
  return [...quedan, ...nuevos];
}

// ── La tabla ──────────────────────────────────────────────────────────────────────────────────────────────────────
export type ColumnaTabla = 'id' | 'titulo' | 'quien' | 'negocio' | 'canal' | 'estado' | 'cuando';
export const COLUMNAS: ReadonlyArray<{ clave: ColumnaTabla; titulo: string }> = [
  { clave: 'id', titulo: '#' }, { clave: 'titulo', titulo: 'Título' }, { clave: 'quien', titulo: 'Quién' },
  { clave: 'negocio', titulo: 'Negocio' }, { clave: 'canal', titulo: 'Canal' }, { clave: 'estado', titulo: 'Estado' },
  { clave: 'cuando', titulo: 'Cuándo' },
];
export type Orden = { col: ColumnaTabla; dir: 'asc' | 'desc' };
export const ORDEN_INICIAL: Orden = { col: 'cuando', dir: 'desc' };

const quienDe = (t: FilaTicket) => (t.usuario_nombre || t.usuario_email || '').toLowerCase();
const clave = (t: FilaTicket, c: ColumnaTabla): string | number => {
  switch (c) {
    case 'id': return t.id;
    case 'titulo': return t.titulo.toLowerCase();
    case 'quien': return quienDe(t);
    case 'negocio': return (t.negocio ?? '').toLowerCase();
    case 'canal': return origenDe(t).rotulo.toLowerCase();
    case 'estado': return GRUPOS.findIndex((g) => g.estados.includes(t.estado)) * 10 + PRIORIDADES.indexOf(t.prioridad);
    case 'cuando': return Date.parse(t.created_at) || 0;
  }
};

/** Ordena la tabla por una columna. Los empates, por número (el más nuevo arriba): el orden nunca salta. */
export function ordenarTabla(ts: readonly FilaTicket[], o: Orden): FilaTicket[] {
  const s = o.dir === 'asc' ? 1 : -1;
  return [...ts].sort((a, b) => {
    const x = clave(a, o.col), y = clave(b, o.col);
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'es');
    return c !== 0 ? c * s : b.id - a.id;
  });
}

/** Tocar el título de una columna: la misma la da vuelta; otra empieza por lo que más sirve (lo nuevo, lo alto). */
export function siguienteOrden(o: Orden, col: ColumnaTabla): Orden {
  if (o.col === col) return { col, dir: o.dir === 'asc' ? 'desc' : 'asc' };
  return { col, dir: col === 'cuando' || col === 'id' ? 'desc' : 'asc' };
}
