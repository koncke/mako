// =============================================================================
// extraccion-estado — cómo va lo que se largó con «Extraer» de un grupo de WhatsApp (30/10/2026)
// =============================================================================
// Martín, 30/10/2026: «cuando termina de scrapear debe regresar a la app de mako... Y en el mientras tanto, en el CRM debe
// aparecer un modal que diga "scrapeando" o algo así... Y al finalizar un mensaje de confirmación, algo que se sepa que ya
// funcionó. Porque hoy en día sigue abierto el modal del scraper previo a darle "extraer" eso hace pensar que nunca se extrajo
// nada.»
//
// El aviso no se perdía: terminaba como UNA línea en el pie, y la tabla se releía igual que antes. Y todo vivía adentro del
// componente: si se desmontaba o la página se recargaba, ya no había a quién preguntarle. El estado vive ACÁ, fuera de los
// modales: lo escribe quien corre (app/crm/TraerDeGrupoWA.tsx), lo dibuja el modal del tablero (app/crm/ExtraccionModal.tsx).
//
// ⚠️ `sessionStorage` Y NO `localStorage`: es de ESTA pestaña y sobrevive a una recarga. Una extracción la corre la página (crea
// los leads y guarda los nombres), así que una recarga la CORTA: lo guardado como 'corriendo' sin nadie corriéndola en memoria se
// lee como 'interrumpida', con los leads que alcanzaron a entrar. Nunca se dice «sigue» de algo que ya no corre.
//
// Sin `server-only` ni React arriba del archivo (salvo el hook): lo puro se prueba en node.
// =============================================================================

import { useSyncExternalStore } from 'react';

/** ok = se trajo algo · vacio = terminó bien y no trajo nada · mal = se cortó o falló. */
export type TonoExtraccion = 'ok' | 'vacio' | 'mal';
export type ResultadoExtraccion = { tono: TonoExtraccion; titulo: string; detalle: string | null; chips: string[] };

export type Extraccion = {
  id: string;
  grupo: string;
  /** El CRM donde se largó (`null` = el del negocio): el modal sólo se muestra ahí. */
  funnel: number | null;
  estado: 'corriendo' | 'terminada' | 'interrumpida';
  /** Lo que está pasando ahora, en una frase. */
  texto: string;
  /** Leads nuevos que ya entraron, y de cuántos. */
  nuevos: number;
  total: number;
  /** Se pidió parar: el botón ya no se ofrece. */
  parando: boolean;
  resultado: ResultadoExtraccion | null;
};

const CLAVE = 'mako.extraccion';
export const TEXTO_INICIAL = 'Entrando a tu WhatsApp Web…';

const leads = (n: number) => `${n.toLocaleString('es-AR')} ${n === 1 ? 'lead' : 'leads'}`;
const nuevosTexto = (n: number) => `${n.toLocaleString('es-AR')} ${n === 1 ? 'lead nuevo' : 'leads nuevos'}`;

/**
 * Lo que dice la confirmación. CUÁNTOS, siempre: cero se dice como cero y no como un éxito vacío. Un corte nunca sale como éxito,
 * aunque algo haya entrado. `soloDatos`: «Datos de empresa», que no trae leads.
 */
export function resultadoDeExtraccion(d: {
  grupo: string; etapa: string; etiqueta: string | null; nuevos: number; nombres: number; empresas: number; perfiles: number;
  fallidos: number; motivos: readonly string[]; parado: boolean; soloDatos?: boolean;
}): ResultadoExtraccion {
  const n = (v: number, uno: string, varios: string) => `${v.toLocaleString('es-AR')} ${v === 1 ? uno : varios}`;
  const chips = [
    d.nombres ? n(d.nombres, 'nombre', 'nombres') : '',
    d.empresas ? n(d.empresas, 'empresa', 'empresas') : '',
    d.perfiles ? `${d.perfiles.toLocaleString('es-AR')} con datos de su perfil` : '',
    d.fallidos ? n(d.fallidos, 'no se pudo', 'no se pudieron') : '',
  ].filter(Boolean);
  const motivos = d.motivos.map((m) => m.trim()).filter(Boolean).join(' ') || null;
  if (d.parado) {
    return { tono: 'vacio', titulo: d.nuevos ? `La paraste: entraron ${leads(d.nuevos)}` : 'La paraste: no entró nadie', detalle: motivos, chips };
  }
  if (motivos) {
    return { tono: 'mal', titulo: d.nuevos ? `${nuevosTexto(d.nuevos)}, pero no terminó` : 'No se pudo extraer', detalle: motivos, chips };
  }
  if (d.soloDatos && !d.nuevos) {
    return d.nombres || d.empresas || d.perfiles
      ? { tono: 'ok', titulo: 'Datos actualizados', detalle: `De «${d.grupo}».`, chips }
      : { tono: 'vacio', titulo: 'No encontré datos nuevos', detalle: `De «${d.grupo}».`, chips };
  }
  if (!d.nuevos) {
    return { tono: 'vacio', titulo: 'No entró nadie nuevo', detalle: `Ya estaban todos en tu CRM.`, chips };
  }
  return {
    tono: 'ok', titulo: `${nuevosTexto(d.nuevos)} de «${d.grupo}»`,
    detalle: `En «${d.etapa}»${d.etiqueta ? `, con la etiqueta «${d.etiqueta}»` : ''}.`, chips,
  };
}

/** Lo que había cuando la página se recargó en plena corrida. */
export function resultadoInterrumpido(nuevos: number): ResultadoExtraccion {
  return {
    tono: 'mal',
    titulo: nuevos ? `Se cortó: entraron ${leads(nuevos)}` : 'Se cortó antes de traer a nadie',
    detalle: 'La página se recargó. Vuelve a tocar «Extraer»: el que ya está no se duplica.',
    chips: [],
  };
}

/** Lo guardado, saneado. Lo de 'corriendo' pasa a 'interrumpida': si hubiera alguien corriéndola, estaría en memoria. */
export function extraccionGuardada(crudo: string | null): Extraccion | null {
  if (!crudo) return null;
  let o: Partial<Extraccion> | null = null;
  try { o = JSON.parse(crudo) as Partial<Extraccion>; } catch { return null; }
  if (!o || typeof o.id !== 'string' || typeof o.grupo !== 'string') return null;
  const nuevos = typeof o.nuevos === 'number' && Number.isFinite(o.nuevos) ? o.nuevos : 0;
  const base: Extraccion = {
    id: o.id, grupo: o.grupo, funnel: typeof o.funnel === 'number' ? o.funnel : null, estado: 'interrumpida', texto: '',
    nuevos, total: typeof o.total === 'number' ? o.total : 0, parando: false, resultado: resultadoInterrumpido(nuevos),
  };
  const r = o.resultado;
  if (o.estado === 'corriendo' || !r || typeof r.titulo !== 'string') return base;
  return {
    ...base, estado: o.estado === 'terminada' ? 'terminada' : 'interrumpida',
    resultado: { tono: r.tono === 'ok' || r.tono === 'vacio' ? r.tono : 'mal', titulo: r.titulo, detalle: typeof r.detalle === 'string' ? r.detalle : null, chips: Array.isArray(r.chips) ? r.chips.filter((c): c is string => typeof c === 'string') : [] },
  };
}

// ── El estado, uno por pestaña ───────────────────────────────────────────────
let actual: Extraccion | null = null;
let leido = false;
/** Quién la corre en memoria: sin esto, lo guardado como 'corriendo' es de una página que ya no está. */
let pararLaQueCorre: (() => void) | null = null;
const oyentes = new Set<() => void>();

function publicar(): void {
  try {
    if (actual) window.sessionStorage.setItem(CLAVE, JSON.stringify(actual));
    else window.sessionStorage.removeItem(CLAVE);
  } catch { /* sin guardar: igual se ve mientras no se recargue */ }
  for (const f of oyentes) f();
}

function hidratar(): void {
  if (leido || typeof window === 'undefined') return;
  leido = true;
  if (actual) return;
  let crudo: string | null = null;
  try { crudo = window.sessionStorage.getItem(CLAVE); } catch { /* sin nada */ }
  actual = extraccionGuardada(crudo);
}

export function empezarExtraccion(e: { id: string; grupo: string; funnel: number | null; total: number; parar: () => void }): void {
  leido = true;
  pararLaQueCorre = e.parar;
  actual = { id: e.id, grupo: e.grupo, funnel: e.funnel, estado: 'corriendo', texto: TEXTO_INICIAL, nuevos: 0, total: e.total, parando: false, resultado: null };
  publicar();
}

export function avanzarExtraccion(id: string, c: { texto?: string; nuevos?: number }): void {
  if (actual?.id !== id || actual.estado !== 'corriendo') return;
  actual = { ...actual, ...(c.texto ? { texto: c.texto } : {}), ...(c.nuevos != null ? { nuevos: c.nuevos } : {}) };
  publicar();
}

export function terminarExtraccion(id: string, resultado: ResultadoExtraccion, nuevos: number): void {
  if (actual?.id !== id) return;
  pararLaQueCorre = null;
  actual = { ...actual, estado: 'terminada', nuevos, parando: false, resultado };
  publicar();
}

/** «Parar», desde el modal. */
export function pararExtraccion(): void {
  if (actual?.estado !== 'corriendo' || !pararLaQueCorre) return;
  pararLaQueCorre();
  actual = { ...actual, parando: true, texto: 'Parando…' };
  publicar();
}

/** La confirmación leída. Una que corre no se cierra: se para. */
export function cerrarExtraccion(): void {
  if (actual?.estado === 'corriendo') return;
  actual = null;
  publicar();
}

function suscribir(f: () => void): () => void {
  hidratar();
  oyentes.add(f);
  return () => { oyentes.delete(f); };
}
const foto = () => actual;
const fotoServidor = () => null;

/** La extracción de esta pestaña, si hay. */
export function useExtraccion(): Extraccion | null {
  return useSyncExternalStore(suscribir, foto, fotoServidor);
}

/** Para los tests: vuelve a empezar, como una recarga de la página. */
export function olvidarParaProbar(): void {
  actual = null; leido = false; pararLaQueCorre = null; oyentes.clear();
}
