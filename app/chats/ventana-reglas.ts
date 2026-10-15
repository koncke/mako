// =============================================================================
// ventana-reglas — lo que decide la VENTANA del chat (cabecera, hilo, composer), sin React ni DOM
// =============================================================================
// La ventana es la columna del medio de la tab Chats, copiada de respond.io (docs/diseno-chats.md §3):
// VentanaChat.tsx (cabecera + sondeo), Hilo.tsx (burbujas) y Composer.tsx (escribir). Lo que esas tres
// piezas DECIDEN vive acá, puro, para que tests/chats-ventana.test.ts lo EJECUTE y no sólo lo lea:
//   · las fechas que se dibujan («Hoy», «Ayer», «12 dic 2025», el tooltip con la hora exacta);
//   · el menú «Posponer hasta» con la fecha que resulta de cada opción;
//   · cómo se agrupa el hilo (por día, por quién habla, las tiradas de eventos plegadas);
//   · por qué identidad se escribe y con qué cuerpo sale un WhatsApp (SIEMPRE con la línea);
//   · el borrador del texto en el navegador, con el workspace en la clave.
//
// Sólo `import type` de lib/chats-tipos: este archivo no arrastra nada al bundle ni al test.

import type { EtapaChat, IdentidadCanal, MensajeChat } from '@/lib/chats-tipos';

// ── Fechas ───────────────────────────────────────────────────────────────────────────────────
// A mano y no con Intl: el «p. m.» de es-MX sale con espacios finos distintos según el motor
// (Node, Chrome y Safari no coinciden), y un test que compara el texto no puede depender de eso.

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

const dos = (n: number) => String(n).padStart(2, '0');

/** La fecha de un ISO, o null si no se puede leer (un `Invalid Date` no se dibuja nunca). */
export function fechaDe(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** El día LOCAL (la zona del navegador), para agrupar el hilo y comparar «hoy». */
export function claveDia(d: Date): string {
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

function sumarDias(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + n);
  return x;
}

/** «4:22 p. m.» */
export function horaCorta(d: Date): string {
  const h = d.getHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${dos(d.getMinutes())} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

/** El chip de fecha del hilo: «Hoy», «Ayer», «12 dic 2025» (respond.io: Today / Yesterday / Dec 12, 2025). */
export function etiquetaDia(d: Date, ahora: Date): string {
  const k = claveDia(d);
  if (k === claveDia(ahora)) return 'Hoy';
  if (k === claveDia(sumarDias(ahora, -1))) return 'Ayer';
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * El tooltip de la burbuja: «Enviado: 4 jun, 2:57:41 p. m.» (respond.io: «Sent: Jun 4, 2:57:41 PM»).
 * `saliente` null = sin prefijo (la hora de un evento o de un comentario).
 */
export function momentoExacto(iso: string, saliente: boolean | null): string {
  const d = fechaDe(iso);
  if (!d) return '';
  const h = d.getHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const cuando = `${d.getDate()} ${MESES[d.getMonth()]}, ${h12}:${dos(d.getMinutes())}:${dos(d.getSeconds())} ${h < 12 ? 'a. m.' : 'p. m.'}`;
  return saliente == null ? cuando : `${saliente ? 'Enviado' : 'Recibido'}: ${cuando}`;
}

/** La fecha a la derecha de cada opción de «Posponer hasta»: «jue, 4:22 p. m.». */
export function fechaOpcion(d: Date): string {
  return `${DIAS[d.getDay()]}, ${horaCorta(d)}`;
}

/** El subtítulo de la cabecera: «hoy, 6:15 p. m.», «mañana, 8:00 a. m.», «12 dic, 8:00 a. m.». */
export function textoHasta(iso: string | null, ahora: Date): string | null {
  const d = fechaDe(iso);
  if (!d) return null;
  const k = claveDia(d);
  const dia = k === claveDia(ahora) ? 'hoy' : k === claveDia(sumarDias(ahora, 1)) ? 'mañana' : `${d.getDate()} ${MESES[d.getMonth()]}`;
  return `${dia}, ${horaCorta(d)}`;
}

// ── Posponer ─────────────────────────────────────────────────────────────────────────────────

export type OpcionPosponer = { key: string; label: string; hasta: Date };

function alas(base: Date, dias: number, hora: number): Date {
  const d = sumarDias(base, dias);
  d.setHours(hora, 0, 0, 0);
  return d;
}

/**
 * El menú «Posponer hasta» de respond.io (43-snooze-contact, medido a las 3:52 p. m. de un jueves):
 * 30 min (4:22), 1 hora (4:52), 3 horas (6:52), Más tarde hoy (6:00 p. m.), Mañana (vie 8:00),
 * Este fin de semana (sáb 8:00), Próxima semana (jue 8:00, el mismo día de la semana que viene).
 *
 * ⚠️ «Más tarde hoy» son las 18:00 y SALE del menú cuando falta menos de una hora: a las 17:30 diría
 *    «hoy, 6:00 p. m.» por debajo de «1 hora» (6:30), y un «más tarde» que cae antes que «1 hora» se
 *    lee como un error. respond.io no documenta qué hace a esa hora; esto es lo que no miente.
 * ⚠️ «Este fin de semana» un sábado es el DOMINGO, y un domingo el sábado que viene: el sábado
 *    «que viene» a las 8:00 de un sábado a la tarde ya pasó.
 */
export function opcionesPosponer(ahora: Date): OpcionPosponer[] {
  const mas = (min: number) => new Date(ahora.getTime() + min * 60_000);
  const out: OpcionPosponer[] = [
    { key: '30m', label: '30 min', hasta: mas(30) },
    { key: '1h', label: '1 hora', hasta: mas(60) },
    { key: '3h', label: '3 horas', hasta: mas(180) },
  ];
  const tarde = alas(ahora, 0, 18);
  if (tarde.getTime() - ahora.getTime() >= 60 * 60_000) out.push({ key: 'hoy', label: 'Más tarde hoy', hasta: tarde });
  out.push({ key: 'manana', label: 'Mañana', hasta: alas(ahora, 1, 8) });
  const dia = ahora.getDay();
  const hastaFinde = dia === 6 ? 1 : dia === 0 ? 6 : 6 - dia;
  out.push({ key: 'finde', label: 'Este fin de semana', hasta: alas(ahora, hastaFinde, 8) });
  out.push({ key: 'semana', label: 'Próxima semana', hasta: alas(ahora, 7, 8) });
  return out;
}

// ── El hilo ──────────────────────────────────────────────────────────────────────────────────

export type ItemHilo =
  | { k: 'msg'; m: MensajeChat; primero: boolean; ultimo: boolean }
  | { k: 'eventos'; id: string; eventos: MensajeChat[] };

export type DiaHilo = { dia: string; etiqueta: string; items: ItemHilo[] };

/** Quién habla: dos burbujas seguidas del mismo «quién» van juntas y sólo la última lleva avatar. */
function quienHabla(m: MensajeChat): string {
  return `${m.tipo}|${m.saliente ? 1 : 0}|${m.canal ?? ''}|${m.autor ?? ''}`;
}

/**
 * El hilo como lo dibuja respond.io: por DÍA (cada día con su chip fijo arriba), las burbujas
 * agrupadas por quién habla (el avatar con la insignia de canal sólo en la última del grupo; las
 * anteriores, sangradas) y los eventos seguidos juntos en una tirada (para poder plegarla).
 *
 * El orden es el que llega (la API lo manda ascendente por fecha); un mensaje sin fecha legible va al
 * día del anterior, nunca a un «1 ene 1970».
 */
export function armarHilo(mensajes: readonly MensajeChat[], ahora: Date): DiaHilo[] {
  const dias: DiaHilo[] = [];
  let dia: DiaHilo | null = null;
  let ultimaFecha: Date | null = null;
  for (const m of mensajes) {
    const f: Date = fechaDe(m.fecha) ?? ultimaFecha ?? ahora;
    ultimaFecha = f;
    const k = claveDia(f);
    if (!dia || dia.dia !== k) {
      dia = { dia: k, etiqueta: etiquetaDia(f, ahora), items: [] };
      dias.push(dia);
    }
    const prev = dia.items[dia.items.length - 1];
    if (m.tipo === 'evento') {
      if (prev && prev.k === 'eventos') prev.eventos.push(m);
      else dia.items.push({ k: 'eventos', id: m.id, eventos: [m] });
      continue;
    }
    const sigue = prev && prev.k === 'msg' && quienHabla(prev.m) === quienHabla(m);
    if (sigue && prev.k === 'msg') prev.ultimo = false;
    dia.items.push({ k: 'msg', m, primero: !sigue, ultimo: true });
  }
  return dias;
}

/**
 * Una tirada larga de eventos se pliega como en respond.io («> 4 more events»): las 3 primeras, el
 * link con cuántas faltan, y las 2 últimas. Con 6 o menos no se pliega: un link que esconde una sola
 * línea ocupa lo mismo que la línea.
 */
export function plegarEventos<T>(xs: readonly T[]): { cabeza: T[]; ocultos: T[]; cola: T[] } {
  if (xs.length <= 6) return { cabeza: [...xs], ocultos: [], cola: [] };
  return { cabeza: xs.slice(0, 3), ocultos: xs.slice(3, xs.length - 2), cola: xs.slice(xs.length - 2) };
}

export type Tick = 'enviado' | 'entregado' | 'leido' | 'fallido' | null;

/** El estado de entrega de una saliente (a la izquierda de la burbuja). */
export function tickDe(status: MensajeChat['status']): Tick {
  if (status === 'failed') return 'fallido';
  if (status === 'read') return 'leido';
  if (status === 'delivered') return 'entregado';
  if (status === 'sent') return 'enviado';
  return null;
}

/**
 * El texto en pedazos: los links y los emails van aparte para dibujarlos en azul (respond.io linkea
 * solo). El cierre de un link no se come el punto o el paréntesis de la frase que lo rodea.
 */
export function partirEnlaces(texto: string): Array<{ t: string; href?: string }> {
  const re = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"»])|([\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[a-z]{2,})/gi;
  const out: Array<{ t: string; href?: string }> = [];
  let i = 0;
  for (const hit of texto.matchAll(re)) {
    const desde = hit.index ?? 0;
    if (desde > i) out.push({ t: texto.slice(i, desde) });
    out.push({ t: hit[0], href: hit[1] ? hit[0] : `mailto:${hit[0]}` });
    i = desde + hit[0].length;
  }
  if (i < texto.length) out.push({ t: texto.slice(i) });
  return out;
}

/** La extensión de un documento para su tarjeta («PDF»), del nombre o del MIME. */
export function extensionDoc(nombre: string | null, mime: string | null): string {
  const n = (nombre ?? '').split(/[\\/]/).pop() ?? '';
  const i = n.lastIndexOf('.');
  if (i > 0 && i < n.length - 1) return n.slice(i + 1).toUpperCase().slice(0, 5);
  const m = (mime ?? '').toLowerCase();
  if (m.includes('pdf')) return 'PDF';
  if (m.includes('sheet') || m.includes('excel')) return 'XLS';
  if (m.includes('word')) return 'DOC';
  return 'ARCHIVO';
}

// ── Por dónde se escribe ─────────────────────────────────────────────────────────────────────

/** Una identidad, como clave estable (el selector de canal la usa de valor). */
export function claveIdentidad(i: Pick<IdentidadCanal, 'canal' | 'cuenta' | 'ref'>): string {
  return `${i.canal}|${i.cuenta ?? ''}|${i.ref}`;
}

/** «WhatsApp (Ventas) · +52 55 1234 5678» · «Instagram · @usuario» · «Messenger». */
export function rotuloIdentidad(i: Pick<IdentidadCanal, 'rotulo' | 'destino'>): string {
  return i.destino ? `${i.rotulo} · ${i.destino}` : i.rotulo;
}

/**
 * Con qué identidad arranca el composer: la de la última actividad que pueda escribir (los canales
 * llegan ordenados por última actividad); si ninguna puede, la primera igual (se ve gris con su
 * motivo, y el selector deja ver las demás).
 */
export function identidadInicial(canales: readonly IdentidadCanal[]): IdentidadCanal | null {
  return canales.find((c) => c.puedeEscribir && !c.bloqueado) ?? canales[0] ?? null;
}

/** Por qué no se puede escribir por esta identidad; null = se puede. Corto: es el placeholder. */
export function motivoNoEnvio(i: IdentidadCanal | null, contactoBloqueado: boolean): string | null {
  if (!i) return 'Sin canal para escribir';
  if (contactoBloqueado || i.bloqueado) return 'Contacto bloqueado';
  if (!i.puedeEscribir) return i.motivoNoEscribir ?? 'No se puede escribir por aquí';
  // ⚠️ Un WhatsApp sin línea NO sale: el servidor caería a la línea por default (AGENTS.md, «hay N
  //    líneas por negocio») y el mensaje saldría por otro número que el del hilo.
  if (i.canal === 'whatsapp' && !i.cuenta) return 'Falta la línea de WhatsApp';
  return null;
}

/**
 * El cuerpo del POST de texto a /api/whatsapp/evolution/mensajes (docs/diseno-chats.md §2.3).
 * ⚠️ SIEMPRE con `linea`: la de la identidad elegida. Sin ella el servidor elige la línea por
 *    default, y en un negocio con dos números el mensaje sale por el que no es.
 */
export function cuerpoTextoWhatsApp(i: IdentidadCanal, texto: string, leadId: number | null) {
  return { chat: i.ref, telefono: i.telefono, texto, leadId, linea: i.cuenta };
}

/** El multipart del mismo POST (archivo o nota de voz), también con la línea. Tope del servidor: 4 MB. */
export function formArchivoWhatsApp(
  i: IdentidadCanal,
  archivo: Blob,
  nombre: string,
  opts: { leadId: number | null; caption?: string; tipo: '' | 'audio' },
): FormData {
  const fd = new FormData();
  fd.append('chat', i.ref);
  if (i.telefono) fd.append('telefono', i.telefono);
  if (opts.leadId) fd.append('leadId', String(opts.leadId));
  if (opts.caption) fd.append('caption', opts.caption);
  fd.append('tipo', opts.tipo);
  if (i.cuenta) fd.append('linea', i.cuenta);
  fd.append('archivo', archivo, nombre);
  return fd;
}

/** El tope de CADA archivo: el envío es multipart y Vercel corta el cuerpo en 4,5 MB. */
export const TOPE_ARCHIVO = 4 * 1024 * 1024;

/** Lo que MaKo lee para sugerir: los últimos mensajes con texto (no comentarios ni eventos). */
export function mensajesParaMaKo(ms: readonly MensajeChat[], max = 30): Array<{ saliente: boolean; texto: string }> {
  return ms
    .filter((m) => m.tipo === 'mensaje' && !!m.texto?.trim())
    .slice(-max)
    .map((m) => ({ saliente: m.saliente, texto: m.texto as string }));
}

/**
 * Dónde va la sugerencia de MaKo en el campo. MaKo NUNCA envía: escribe en el campo y la persona
 * decide. Reemplaza el campo vacío o la sugerencia anterior (pedir otra es cambiar de idea); si la
 * persona escribió algo suyo, la sugerencia va DEBAJO y no se pierde nada.
 */
export function ponerSugerencia(actual: string, anterior: string | null, sugerencia: string): string {
  const a = actual.trim();
  if (!a || (anterior != null && a === anterior.trim())) return sugerencia;
  return `${actual.replace(/\s+$/, '')}\n\n${sugerencia}`;
}

// ── Lo que el hilo no pudo leer ──────────────────────────────────────────────────────────────

/** Cómo se dice cada fuente de `fallas` del hilo (lib/chats.ts, `hiloDeChat`). */
const FUENTES: Record<string, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram y Messenger',
  notas: 'comentarios',
  eventos: 'eventos',
  borradores: 'borradores de MaKo',
  crm: 'CRM',
  estado: 'estado',
  leidos: 'leídos',
};

/**
 * La franja de la ventana cuando una fuente del hilo no se pudo leer: «No pude leer: WhatsApp (Ventas),
 * comentarios.» null = se leyó todo. «No pude leer» es un TERCER estado: un hilo al que le falta una
 * línea caída se ve igual que una conversación que nunca pasó por esa línea, y lo único que lo
 * distingue es decirlo. Una línea (`whatsapp:<instancia>`) se nombra con el rótulo de su identidad.
 */
export function textoFallas(fallas: readonly string[], canales: readonly Pick<IdentidadCanal, 'canal' | 'cuenta' | 'rotulo'>[]): string | null {
  const nombres: string[] = [];
  for (const f of fallas) {
    if (typeof f !== 'string' || !f.trim()) continue;
    let n: string;
    if (f.startsWith('whatsapp:')) {
      const linea = f.slice('whatsapp:'.length);
      n = canales.find((c) => c.canal === 'whatsapp' && c.cuenta === linea)?.rotulo ?? `WhatsApp (${linea})`;
    } else n = FUENTES[f] ?? f;
    if (!nombres.includes(n)) nombres.push(n);
  }
  return nombres.length ? `No pude leer: ${nombres.join(', ')}.` : null;
}

// ── Asignar ──────────────────────────────────────────────────────────────────────────────────

/**
 * A quién ofrece el menú de asignar: el equipo (sin repetidos, sin la asignada actual, que va arriba
 * resaltada) filtrado por el buscador. ⚠️ SIN MAKO: /api/chats/asignar la rechaza («MaKo se asigna
 * solo», al pasar a una nutrición automática); ofrecerla sería un clic que siempre da error.
 */
export function candidatosAsignar(equipo: readonly { nombre: string }[], actual: string | null, busca: string): string[] {
  const q = busca.trim().toLowerCase();
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const e of equipo) {
    const n = (e.nombre ?? '').trim();
    if (!n || vistos.has(n) || n === actual || n.toLowerCase() === 'mako') continue;
    vistos.add(n);
    if (!q || n.toLowerCase().includes(q)) out.push(n);
  }
  return out;
}

// ── La etapa ─────────────────────────────────────────────────────────────────────────────────

/** La flecha del split de etapa (respond.io: «pasa a la siguiente»). Sin etapa, la primera. */
export function siguienteEtapa(etapas: readonly EtapaChat[], actual: string | null): EtapaChat | null {
  if (!etapas.length) return null;
  const i = actual ? etapas.findIndex((e) => e.key === actual) : -1;
  if (i < 0) return actual ? null : etapas[0];
  return etapas[i + 1] ?? null;
}

// ── El borrador del texto, en el navegador ───────────────────────────────────────────────────

type Almacen = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * La clave del navegador para los borradores de Chats. ⚠️ LLEVA EL WORKSPACE (AGENTS.md, «lo que se
 * guarda en el navegador lleva el workspace en la clave»): el super admin abre dos clientes en dos
 * pestañas del mismo origen, y sin el ws el borrador de un cliente aparece en el chat del otro.
 */
export const claveBorradoresLocal = (ws: number): string => `mako-chats-borradores:ws${ws}`;

/** Cuántas conversaciones guardan borrador: las más viejas se van (el almacén es chico y compartido). */
const MAX_BORRADORES = 60;

type MapaBorradores = Record<string, { t: string; at: number }>;

function leerMapa(st: Almacen, ws: number): MapaBorradores {
  try {
    const raw = st.getItem(claveBorradoresLocal(ws));
    const j = raw ? (JSON.parse(raw) as unknown) : null;
    return j && typeof j === 'object' ? (j as MapaBorradores) : {};
  } catch {
    return {};
  }
}

/** El borrador de una conversación ('' si no hay, o si el navegador no deja leer). Sin ws, nada. */
export function leerBorradorLocal(st: Almacen | null, ws: number | null, clave: string): string {
  if (!st || ws == null) return '';
  const v = leerMapa(st, ws)[clave];
  return v && typeof v.t === 'string' ? v.t : '';
}

/** Guarda (o borra, con texto vacío) el borrador de una conversación. Nunca tira. */
export function guardarBorradorLocal(st: Almacen | null, ws: number | null, clave: string, texto: string, ahora = Date.now()): void {
  if (!st || ws == null) return;
  const mapa = leerMapa(st, ws);
  if (texto.trim()) mapa[clave] = { t: texto, at: ahora };
  else delete mapa[clave];
  const claves = Object.keys(mapa);
  if (claves.length > MAX_BORRADORES) {
    claves.sort((a, b) => (mapa[a]?.at ?? 0) - (mapa[b]?.at ?? 0));
    for (const k of claves.slice(0, claves.length - MAX_BORRADORES)) delete mapa[k];
  }
  try { st.setItem(claveBorradoresLocal(ws), JSON.stringify(mapa)); } catch { /* lleno o bloqueado: el borrador vive en memoria */ }
}

// ── Avatares ─────────────────────────────────────────────────────────────────────────────────

/** Las iniciales de un nombre («Mandy R» → «MR»). Sin nombre, ''. */
export function inicialesDe(nombre: string): string {
  const p = (nombre ?? '').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '';
  return (p.length >= 2 ? `${p[0][0]}${p[1][0]}` : p[0].slice(0, 1)).toUpperCase();
}

/**
 * Los colores de los avatares sin foto (las manchas de color de respond.io). Fijos y no tokens: van
 * con letras blancas encima, que se leen igual en claro y en oscuro.
 */
const PALETA = ['#ff8a3d', '#4287ff', '#9b6bff', '#2ca54a', '#ff5f57', '#14b8a6', '#f2b01e'];

/** El color del avatar sin foto: estable por nombre (la misma persona, el mismo color en todos lados). */
export function colorDe(nombre: string): string {
  let h = 0;
  for (const ch of nombre ?? '') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETA[h % PALETA.length];
}
