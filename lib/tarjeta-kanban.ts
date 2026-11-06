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

import { plantillasPropiasDe, type PlantillaTarjeta } from './plantillas-tarjeta';

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

/**
 * ¿La foto ya terminó y no cargó? (recorrido visual del 30/10/2026, C1: 16 de 42 caras del CRM con el ícono de imagen
 * rota). Una foto que falla ANTES de que React tome la página (el HTML del server la pide de entrada y el proxy del avatar
 * contesta 404) dispara su `error` sin nadie escuchando: el `onError` no corre nunca y la imagen rota queda a la vista.
 * Al montar se pregunta esto: terminada (`complete`) y sin ancho (`naturalWidth` 0) es una foto que no cargó. Una que
 * todavía está cargando da `complete` false, y para ésa sigue valiendo el `onError`.
 */
export function fotoQueNoCargo(img: { complete: boolean; naturalWidth: number } | null | undefined): boolean {
  return !!img && img.complete && img.naturalWidth === 0;
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

/**
 * «jue 23 oct»: la fecha de una reunión para la plantilla «Próxima reunión» (21/10/2026). En UTC, como `fmtDay`
 * (app/crm/crm-map.ts): el server y el navegador dibujan lo mismo y no hay salto al hidratar. Sin fecha válida, «Sin agendar».
 */
export function fechaReunionCorta(iso: string | null | undefined): string {
  const s = String(iso ?? '').trim();
  const d = s.length <= 10 ? new Date(`${s}T00:00:00Z`) : new Date(s);
  if (!s || Number.isNaN(d.getTime())) return 'Sin agendar';
  return new Intl.DateTimeFormat('es', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(d).replace(/[,.]/g, '').replace(/\s+/g, ' ').trim();
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
// ⚠️ Una VARIABLE con su valor claro y oscuro (app/globals.css), no `--surface-2`: el 18/10 se puso `--surface-2` y
// era el mismo color que la página (#F5F7FA sobre #F4F6F9); el 20/10 Martín seguía viendo las columnas invisibles.
export const FONDO_COLUMNA = 'var(--fondo-columna)';

/**
 * LO QUE MUESTRA LA TARJETA DE UN LEAD, a elección de cada persona (20/10/2026, Martín: «Las cards, las debería poder
 * personalizar también, por si el usuario quiere más o menos info»). Se guarda POR PERSONA (`usuarios.perfil`, igual
 * que sus avisos), la misma en todos los funnels: es cómo mira cada uno, y un closer y un setter quieren ver cosas
 * distintas del mismo tablero; guardarlo por funnel le cambiaría la tarjeta a todo el equipo. El nombre va siempre.
 * El ORDEN es el de la persona (lo arrastra en el pop-up, 20/10/2026); lo que no está en el catálogo se descarta (un dato
 * viejo no rompe la pantalla).
 */
export const CAMPOS_TARJETA_LEAD = ['foto', 'plata', 'canal', 'vence', 'datos', 'agenda', 'fuera', 'empresa', 'telefono', 'campana', 'alta'] as const;
export type CampoTarjetaLead = (typeof CAMPOS_TARJETA_LEAD)[number];
export const NOMBRE_CAMPO_TARJETA: Readonly<Record<CampoTarjetaLead, string>> = {
  foto: 'Foto o iniciales', plata: 'Plata', canal: 'Por dónde llegó', vence: 'Vencimientos', datos: 'Datos pendientes',
  agenda: 'Reunión agendada', fuera: 'Fuera del funnel', empresa: 'Empresa', telefono: 'Teléfono', campana: 'Campaña',
  alta: 'Fecha de alta',
};
/** Lo de siempre: la tarjeta del 17/10. Empresa, teléfono, campaña y fecha de alta son «más info». */
export const CAMPOS_TARJETA_DEFAULT: readonly CampoTarjetaLead[] = ['foto', 'plata', 'canal', 'vence', 'datos', 'agenda', 'fuera'];

/**
 * Lo guardado, limpio y EN EL ORDEN DE LA PERSONA (el que arrastró): sin lo desconocido y sin repetidos. Sin nada
 * guardado (o algo que no es una lista): lo de siempre.
 */
export function camposTarjetaDe(raw: unknown): CampoTarjetaLead[] {
  if (!Array.isArray(raw)) return [...CAMPOS_TARJETA_DEFAULT];
  const vistos = new Set<string>();
  const out: CampoTarjetaLead[] = [];
  for (const x of raw) {
    if (typeof x !== 'string' || vistos.has(x) || !(CAMPOS_TARJETA_LEAD as readonly string[]).includes(x)) continue;
    vistos.add(x);
    out.push(x as CampoTarjetaLead);
  }
  return out;
}

/**
 * LAS FORMAS DE LA TARJETA (13/10/2026, Martín: «Tener varios diseños template, como el que tenemos en Clientes, y
 * otros»; y el 21/10: «otros estilos también… piensa en varios diseños»). Cómo se DIBUJA; los datos van aparte:
 *   · completa: la de la familia (17/10), con la cara y «Ver info»;
 *   · compacta: la cara chica y menos aire, para ver más leads por columna;
 *   · avance: como la de Clients, con la barra del paso del lead en su funnel («Paso N de M»);
 *   · monto: la plata GRANDE arriba, como la tarjeta de un trato (21/10);
 *   · evento: la reunión agendada GRANDE, con su fecha (21/10);
 *   · portada: una banda de color arriba con la cara montada, como la tarjeta de /admin (21/10).
 * Las PLANTILLAS (forma + datos) están abajo, en PLANTILLAS_TARJETA_LEAD.
 */
export const DISENOS_TARJETA = ['completa', 'compacta', 'avance', 'monto', 'evento', 'portada'] as const;
export type DisenoTarjeta = (typeof DISENOS_TARJETA)[number];
export const NOMBRE_DISENO_TARJETA: Readonly<Record<DisenoTarjeta, string>> = {
  completa: 'Completa', compacta: 'Compacta', avance: 'Con avance', monto: 'Monto grande', evento: 'Próxima reunión', portada: 'Con portada',
};
export const DETALLE_DISENO_TARJETA: Readonly<Record<DisenoTarjeta, string>> = {
  completa: 'La de siempre.', compacta: 'Más leads por columna.', avance: 'Con la barra del paso, como Clients.',
  monto: 'La plata grande, arriba.', evento: 'La reunión agendada, grande.', portada: 'Una banda de color arriba, con la cara.',
};
export type PlantillaTarjetaLead = PlantillaTarjeta<DisenoTarjeta, CampoTarjetaLead>;
export type PrefsTarjetaLead = { diseno: DisenoTarjeta; campos: CampoTarjetaLead[]; plantillas: PlantillaTarjetaLead[] };

/**
 * LAS PLANTILLAS DE FÁBRICA del CRM (21/10/2026). Martín nombró dos («como las que tenemos en CLIENTES», «otra que no
 * tenga foto de perfil») y dejó el resto a criterio («piensa en varios diseños»). Cada una contesta una pregunta
 * distinta de quien mira el tablero: ¿quién es? (Completa), ¿cuántos hay? (Compacta, Sólo el nombre), ¿cuánta plata?
 * (Monto grande), ¿cuándo lo veo? (Próxima reunión), ¿cuánto le falta? (Con avance). Sin foto y Con portada son la
 * misma información con otro peso visual. La primera es la de siempre.
 */
export const PLANTILLAS_TARJETA_LEAD: readonly PlantillaTarjetaLead[] = [
  { id: 'fabrica:completa', nombre: 'Completa', forma: 'completa', campos: CAMPOS_TARJETA_DEFAULT },
  { id: 'fabrica:compacta', nombre: 'Compacta', forma: 'compacta', campos: ['foto', 'plata', 'vence', 'datos'] },
  { id: 'fabrica:sin-foto', nombre: 'Sin foto', forma: 'completa', campos: CAMPOS_TARJETA_DEFAULT.filter((c) => c !== 'foto') },
  { id: 'fabrica:monto', nombre: 'Monto grande', forma: 'monto', campos: ['foto', 'plata', 'canal', 'vence', 'datos', 'agenda', 'fuera'] },
  { id: 'fabrica:evento', nombre: 'Próxima reunión', forma: 'evento', campos: ['foto', 'plata', 'canal', 'vence', 'datos', 'agenda', 'fuera'] },
  { id: 'fabrica:avance', nombre: 'Con avance', forma: 'avance', campos: CAMPOS_TARJETA_DEFAULT },
  { id: 'fabrica:portada', nombre: 'Con portada', forma: 'portada', campos: CAMPOS_TARJETA_DEFAULT },
  { id: 'fabrica:nombre', nombre: 'Sólo el nombre', forma: 'compacta', campos: [] },
];

/**
 * Lo guardado en el perfil: `{ diseno, campos }` desde el 20/10/2026 noche; antes, sólo la lista de campos (se lee igual,
 * con el diseño de siempre). Lo que no se entiende, lo de siempre.
 */
export function prefsTarjetaDe(raw: unknown): PrefsTarjetaLead {
  if (Array.isArray(raw)) return { diseno: 'completa', campos: camposTarjetaDe(raw), plantillas: [] };
  if (raw && typeof raw === 'object') {
    const o = raw as { diseno?: unknown; campos?: unknown; plantillas?: unknown };
    const diseno = (DISENOS_TARJETA as readonly unknown[]).includes(o.diseno) ? (o.diseno as DisenoTarjeta) : 'completa';
    // Las propias (21/10/2026), limpias con la MISMA regla que la tarjeta de todos los días.
    return { diseno, campos: camposTarjetaDe(o.campos), plantillas: plantillasPropiasDe(o.plantillas, DISENOS_TARJETA, camposTarjetaDe) };
  }
  return { diseno: 'completa', campos: [...CAMPOS_TARJETA_DEFAULT], plantillas: [] };
}

/** El subtítulo de la tarjeta con la plata y el canal EN EL ORDEN que eligió la persona (y sólo los que eligió). */
export function subtituloEnOrden(campos: readonly CampoTarjetaLead[], datos: { plata: string | null; canal: string | null | undefined }): string {
  const partes: string[] = [];
  for (const c of campos) {
    if (c === 'plata' && datos.plata) partes.push(datos.plata);
    if (c === 'canal') {
      const k = String(datos.canal ?? '').trim();
      if (k && k.toLowerCase() !== 'sin origen') partes.push(k);
    }
  }
  return partes.join(' · ');
}

/** Mueve el dato `de` a la posición `a` («Personalizar tarjetas»: el arrastre y las flechas usan lo mismo). */
export function moverCampo(campos: readonly CampoTarjetaLead[], de: number, a: number): CampoTarjetaLead[] {
  const out = [...campos];
  if (de < 0 || de >= out.length || a < 0 || a >= out.length || de === a) return out;
  const [c] = out.splice(de, 1);
  out.splice(a, 0, c);
  return out;
}
