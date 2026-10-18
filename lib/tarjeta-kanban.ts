// =============================================================================
// tarjeta-kanban — lo PURO de la familia de tarjetas de CRM, Clients y Plan (17/10/2026)
// =============================================================================
// Martín, 17/10/2026 22:40 (punto 8): «No me gustan las cards y cómo se ven... Quiero que tengan coherencia... si hacés
// esto del CRM también debe tener cierto sentido en diseño los otros kanban, como el PLAN y Clients... Plan tal vez un
// poco diferente porque son tareas». La fuente es el prototipo docs/prototipos/coherencia-1710.html («8 · CRM»,
// «8 · Clients», «8 · Plan» y «Piezas y referencias»): UNA tarjeta grande y redonda con algo redondo a la izquierda
// (la foto, o las iniciales con la insignia del canal; en una tarea, el círculo de prioridad), el nombre en negrita, un
// subtítulo gris y una píldora a la derecha.
//
// Acá vive lo que se puede equivocar sin que nada se vea roto, con test (tests/tarjeta-kanban.test.ts): las iniciales,
// el color de las iniciales, la insignia del canal y el subtítulo «plata · por dónde llegó». Lo dibujan
// app/_ui/TarjetaKanban.tsx (escritorio y teléfono) y lo usan el tablero del CRM, MaKo Mobile, Clients y el Plan.
//
// Sin `server-only` ni `'use client'`: lo importan los componentes y los tests.
// =============================================================================

/** Los colores de la familia: los de sección del prototipo (azul, verde, violeta, turquesa, gris). */
export type ColorTarjeta = 'blue' | 'green' | 'purple' | 'teal' | 'grey';
const COLORES: readonly ColorTarjeta[] = ['blue', 'green', 'purple', 'teal', 'grey'];

/** FNV-1a sin signo. ⚠️ Con `>>>` en todo el camino: con `>>` el número puede salir NEGATIVO y `arr[neg % n]` es
 *  `undefined` — en el prototipo reventaba la foto de algunos nombres y la pantalla quedaba en blanco sin mensaje. */
function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Las iniciales de un nombre: dos letras, en mayúscula. Sin nombre, «?». Ignora lo que no es letra ni número. */
export function inicialesDe(nombre: string | null | undefined): string {
  const palabras = String(nombre ?? '').trim().split(/\s+/).map((p) => p.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean);
  if (!palabras.length) return '?';
  const dos = palabras.length === 1 ? palabras[0].slice(0, 2) : palabras[0][0] + palabras[palabras.length - 1][0];
  return dos.toLocaleUpperCase('es');
}

/** El color de las iniciales: SIEMPRE el mismo para el mismo nombre (sin acentos ni mayúsculas que lo cambien). */
export function colorDeNombre(nombre: string | null | undefined): ColorTarjeta {
  const base = String(nombre ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return COLORES[hash(base) % COLORES.length];
}

/** La insignia de la foto: el ícono y el color del canal por donde llegó. Los nombres son los de app/_components/icons. */
export type InsigniaCanal = { icono: 'meta' | 'whatsapp' | 'web' | 'calendario' | 'instagram' | 'chats' | 'users' | 'descargar' | 'sales' | 'comunidad'; color: ColorTarjeta; nombre: string };

/**
 * El canal de un lead (`canalDeLead`, app/crm/origen-lead.ts: «Meta · Instant Form», «Landing», «WhatsApp»…) como
 * insignia. `null` = sin origen o uno que no tiene insignia: la foto va sola, nunca con un ícono inventado.
 * El color es el del canal, no el de la persona: azul Meta, verde WhatsApp, violeta la web, turquesa la agenda.
 */
export function insigniaDeCanal(canal: string | null | undefined): InsigniaCanal | null {
  const c = String(canal ?? '').trim().toLowerCase();
  if (!c || c === 'sin origen') return null;
  if (c.startsWith('meta') || c.includes('anuncio') || c.includes('instant form')) return { icono: 'meta', color: 'blue', nombre: 'Meta Ads' };
  if (c.includes('whatsapp')) return { icono: 'whatsapp', color: 'green', nombre: 'WhatsApp' };
  if (c.includes('instagram')) return { icono: 'instagram', color: 'purple', nombre: 'Instagram' };
  if (c.includes('messenger')) return { icono: 'chats', color: 'blue', nombre: 'Messenger' };
  if (c.includes('landing') || c.includes('web')) return { icono: 'web', color: 'purple', nombre: 'Landing' };
  if (c.includes('calendly') || c.includes('cal.com')) return { icono: 'calendario', color: 'teal', nombre: canal!.trim() };
  if (c.includes('hotmart')) return { icono: 'sales', color: 'green', nombre: 'Hotmart' };
  if (c.includes('skool')) return { icono: 'comunidad', color: 'teal', nombre: 'Skool' };
  if (c.includes('importad')) return { icono: 'descargar', color: 'grey', nombre: 'Importado' };
  if (c.includes('mano')) return { icono: 'users', color: 'grey', nombre: 'Cargado a mano' };
  return null;
}

/** «$850», «$12.4K», «$1.2M»: lo mismo que el total de la columna (`plataCorta`, app/crm/total-columna.ts). */
export function plataCorta(usd: number): string {
  return '$' + new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(usd);
}

/**
 * La plata de la tarjeta de un lead, o `null`. La MISMA regla que el total de su columna (total-columna.ts): en Ganado
 * lo vendido (una suscripción, su mensualidad «/mes»); abierto, el ingreso estimado con «≈» (no es una venta). Sin
 * dato, nada: un «$0» se lee como una venta de cero.
 */
export function plataDeLead(l: { ganado: boolean; monto?: number | null; ingresoEstimado?: number | null; suscripcionMonto?: number | null }): string | null {
  const pos = (n: unknown) => { const v = Number(n); return Number.isFinite(v) && v > 0 ? v : 0; };
  if (l.ganado) {
    if (pos(l.suscripcionMonto)) return `${plataCorta(pos(l.suscripcionMonto))}/mes`;
    return pos(l.monto) ? plataCorta(pos(l.monto)) : null;
  }
  return pos(l.ingresoEstimado) ? `≈ ${plataCorta(pos(l.ingresoEstimado))}` : null;
}

/** El subtítulo de la tarjeta de un lead: «plata · por dónde llegó», con lo que haya. «Sin origen» no se escribe. */
export function subtituloLead(plata: string | null, canal: string | null | undefined): string {
  const c = String(canal ?? '').trim();
  return [plata, c && c.toLowerCase() !== 'sin origen' ? c : null].filter(Boolean).join(' · ');
}

/** La prioridad de una tarea, para el círculo: 1 urgente … 4 baja, 0 sin prioridad (punteado). */
export type PrioridadTarea = 0 | 1 | 2 | 3 | 4;
export const NOMBRE_PRIORIDAD: Readonly<Record<PrioridadTarea, string>> = { 0: 'Sin prioridad', 1: 'Urgente', 2: 'Alta', 3: 'Media', 4: 'Baja' };

/**
 * El fondo de una COLUMNA de kanban, el mismo en CRM, Clients y Plan (18/10/2026, Martín, pt 8: «cada columna lleva su
 * bloque de fondo, no vacía»). El de la familia del 17/10 era `--surface-2` al 55 %, que sobre el fondo de la página casi
 * no se ve: una columna sin tarjetas parecía un hueco. Lo fija tests/tarjetas-familia.test.ts.
 */
export const FONDO_COLUMNA = 'var(--surface-2)';
