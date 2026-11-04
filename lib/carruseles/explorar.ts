// =============================================================================
// carruseles/explorar — el explorador de carruseles que funcionan (Image Editor, `?ver=carruseles`): lo puro
// =============================================================================
// Martín, 4/11/2026: «Quiero que scrapees entero, mires y copies las funcionalidades y todos los carruseles de ejemplo para
// ponerlos en MaKo en la sección de imagen generator». Se copian las FUNCIONES de un explorador de carruseles (buscar por
// tema y por @creador, filtros, orden, grilla de dos tamaños, guardados, búsquedas guardadas, lo de esta semana y un
// «outlier score»), nunca su biblioteca: sus términos prohíben bajarla y republicarla, y cada carrusel es de su creador
// (docs/hallazgos-editor-imagen.md, «El explorador de carruseles»).
//
// DE DÓNDE SALEN LOS CARRUSELES: de Competitors Spy. Son las publicaciones públicas de Instagram de las cuentas que ESTE
// negocio sigue, leídas con SU clave de Spy y su tope de crédito (lib/spy.ts, lib/spy-todo.ts). El explorador no lee nada
// nuevo ni gasta nada: muestra lo que Spy ya trajo, con su creador y el link a la publicación original, como referencia del
// negocio. Nunca como una plantilla de MaKo.
//
// EL OUTLIER ES EL DE SPY, no otro: cuántas veces la mediana de las publicaciones de SU cuenta hizo esta pieza
// (`mejoresPiezas`, lib/spy-detalle.ts, la misma que dibuja «Lo que mejor le fue» y el «frente a su mediana» del detalle).
// Con la misma métrica (las vistas si hay en la mayoría; si no, los «me gusta») y null con menos de 3 piezas con número.
// Sólo Instagram: YouTube no cuenta métricas derivadas sin la enmienda III.L (lib/spy.ts, cabecera).
//
// Puro (sin `server-only`): lo usan el lector (./explorar-servidor.ts), la pantalla, la API de MaKo y los tests.
// =============================================================================

import { formatoDe, formatoPorTexto, mejoresPiezas, FORMATOS, type Formato } from '../spy-detalle';
import type { Medio } from '../spy-medio';
import { cierreDeTexto, plano, type Cierre } from './texto';
import { LARGOS_CARRUSEL, ORDENES_CARRUSEL, ORIGENES_CARRUSEL, OUTLIER_MINIMOS, PERIODOS_CARRUSEL, VISTAS_CARRUSEL, type LargoCarrusel, type OrdenCarrusel, type OrigenFiltro, type PeriodoCarrusel, type VistaCarrusel } from './opciones';

/** Un carrusel del explorador: una publicación de Instagram de una cuenta que el negocio sigue en Spy. */
export type Carrusel = {
  /** El id de la pieza en Spy (`spy_piezas.id`). En NEGATIVO, una de la biblioteca de ejemplos: −id es su fila en
   *  `carruseles_biblioteca_piezas` (./biblioteca.ts). Así guardados, «Hacer el mío» y la API usan un número sin chocar. */
  id: number;
  /** El competidor en Spy; en negativo, la cuenta de la biblioteca (`carruseles_biblioteca_cuentas`). */
  competidorId: number;
  /** De dónde sale: las cuentas que el negocio sigue en Spy, o la biblioteca de ejemplos de la plataforma. */
  origen: OrigenCarrusel;
  /** Quién lo publicó: el nombre que el negocio le puso en Spy, su @ y su cara (la caricatura o la foto que guardó Spy). */
  creador: { nombre: string; usuario: string | null; foto: string | null };
  /** El link a la publicación original en Instagram. */
  url: string | null;
  miniatura: string | null;
  /** Su texto (el pie). Spy lo borra a los 30 días de leído: puede venir vacío. */
  texto: string | null;
  /** Con qué abre, como lo leyó la IA del negocio en Spy (vacío si todavía no se analizó), y de qué clase (pregunta, promesa,
   *  dolor…: el vocabulario de Spy). */
  gancho: string | null;
  tipoGancho: string | null;
  /** Qué pide al final («guardar», «mensaje»…), leído del texto ENTERO acá: al navegador el texto viaja cortado
   *  (lib/carruseles/explorar-servidor.ts) y la llamada a la acción suele ir al final. «Hacer el mío» lo toma de acá. */
  cierre: Cierre | null;
  formato: Formato | '';
  /** carrusel · imagen · null (no se sabe: leído antes de la mig 0391). */
  medio: Medio | null;
  laminas: number | null;
  megusta: number | null;
  comentarios: number | null;
  /** Cuándo se publicó (ISO) y cuándo lo trajo Spy por primera vez. */
  publicada: string | null;
  traida: string | null;
  /** Cuántas veces la mediana de su cuenta (el de Spy). null = no se puede decir. */
  outlier: number | null;
};

/** Lo que entra de Spy, con la forma de `spy_piezas` (las columnas que se leen) y su competidor. */
export type PiezaParaCarrusel = {
  id: number; competidor_id: number; canal: string; tipo: string; url: string | null; texto: string | null; titulo?: string | null;
  analisis?: { gancho?: string; tipoGancho?: string; formato?: string } | null; vistas: number | null; megusta: number | null; comentarios: number | null;
  duracion?: string | null; publicada_en: string | null; visto_primera_vez: string; dejo_de_verse_en: string | null;
  miniatura: string | null; medio?: string | null; laminas?: number | null;
};
export type CompetidorParaCarrusel = { id: number; nombre: string; instagram: string | null; avatar?: string | null };

export type OrigenCarrusel = 'cuentas' | 'biblioteca';

const MEDIO_VALIDO = (v: unknown): Medio | null => (v === 'carrusel' || v === 'imagen' || v === 'video' ? v : null);

/**
 * Las publicaciones de Instagram de los competidores como carruseles del explorador, cada una con su outlier. Los reels
 * no entran (son video corto: otro gráfico en Spy), ni lo que ya no se ve, ni un medio «video». El outlier se calcula por
 * cuenta sobre TODAS sus publicaciones (no sólo las que se muestran): así el número es el mismo que dice Spy.
 */
export function carruselesDe(piezas: readonly PiezaParaCarrusel[], competidores: readonly CompetidorParaCarrusel[], ahora = Date.now(), origen: OrigenCarrusel = 'cuentas'): Carrusel[] {
  const porId = new Map(competidores.map((c) => [c.id, c]));
  const porCompetidor = new Map<number, PiezaParaCarrusel[]>();
  for (const p of piezas) {
    if (p.canal !== 'instagram' || !porId.has(p.competidor_id)) continue;
    const xs = porCompetidor.get(p.competidor_id);
    if (xs) xs.push(p); else porCompetidor.set(p.competidor_id, [p]);
  }
  const out: Carrusel[] = [];
  for (const [cid, suyas] of porCompetidor) {
    const c = porId.get(cid)!;
    // `mejoresPiezas` con tope = todas: devuelve las veces de cada pieza de cada grupo con mediana (lib/spy-detalle.ts).
    const veces = new Map(mejoresPiezas(suyas.map((p) => ({ ...p, tipo: p.tipo as never, canal: p.canal as never, duracion: p.duracion ?? null })), suyas.length, ahora).map((d) => [d.id, d.veces]));
    for (const p of suyas) {
      const medio = MEDIO_VALIDO(p.medio);
      if (p.tipo !== 'publicacion' || medio === 'video' || p.dejo_de_verse_en) continue;
      out.push({
        id: p.id,
        competidorId: cid,
        origen,
        creador: { nombre: c.nombre, usuario: c.instagram, foto: c.avatar ?? null },
        url: p.url,
        miniatura: p.miniatura,
        texto: p.texto,
        gancho: p.analisis?.gancho?.trim() || null,
        tipoGancho: p.analisis?.tipoGancho?.trim() || null,
        cierre: cierreDeTexto(p.texto),
        formato: formatoDe(p.analisis?.formato) || formatoPorTexto(p.texto),
        medio,
        laminas: medio === 'carrusel' && typeof p.laminas === 'number' ? p.laminas : null,
        megusta: p.megusta,
        comentarios: p.comentarios,
        publicada: p.publicada_en,
        traida: p.visto_primera_vez,
        outlier: veces.get(p.id) ?? null,
      });
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Filtros, orden y búsqueda
// ─────────────────────────────────────────────────────────────────────────────

// Las opciones (orden, outlier, período, largo, vista) viven en ./opciones.ts: sin dependencias, para que la API de MaKo
// (lib/api-mako/areas/imagen.def.ts) las importe sin arrastrar Spy. Acá se re-exportan.
export {
  LARGOS_CARRUSEL, ORDENES_CARRUSEL, ORIGENES_CARRUSEL, OUTLIER_MINIMOS, PERIODOS_CARRUSEL, VISTAS_CARRUSEL,
  type LargoCarrusel, type OrdenCarrusel, type OrigenFiltro, type PeriodoCarrusel, type VistaCarrusel,
} from './opciones';

export type FiltrosCarrusel = {
  /** Lo que se busca: palabras del tema, o un @creador. */
  q: string;
  /** Los competidores elegidos (vacío = todos). Los de la biblioteca van en negativo, como su id. */
  creadores: number[];
  /** De las cuentas que sigue el negocio, de la biblioteca de ejemplos, o de los dos. */
  origen: OrigenFiltro;
  outlierMin: number;
  periodo: PeriodoCarrusel;
  largo: LargoCarrusel;
  formato: Formato | '';
  /** Con las imágenes sueltas (que se sabe que no son carrusel). Por defecto, no. */
  conImagenes: boolean;
  orden: OrdenCarrusel;
  vista: VistaCarrusel;
};

export const FILTROS_INICIALES: FiltrosCarrusel = {
  q: '', creadores: [], origen: 'todos', outlierMin: 0, periodo: 'todo', largo: 'todos', formato: '', conImagenes: false, orden: 'outlier', vista: 'todos',
};

// `plano` vive en ./texto.ts (lo usa también «Hacer el mío»): se re-exporta acá, donde lo buscaban.
export { plano };

const DIA = 86_400_000;
const enRango = (iso: string | null, dias: number, ahora: number): boolean => {
  const t = Date.parse(iso ?? '');
  return Number.isFinite(t) && t >= ahora - dias * DIA && t <= ahora + DIA;
};

/** La búsqueda: con «@» es por creador (su @ o su nombre); si no, TODAS las palabras en el texto, el gancho o el creador. */
export function coincide(c: Carrusel, q: string): boolean {
  const t = plano(q);
  if (!t) return true;
  if (t.startsWith('@')) {
    const u = t.slice(1).replace(/\s+/g, '');
    if (!u) return true;
    return plano(c.creador.usuario ?? '').replace(/\s+/g, '').includes(u) || plano(c.creador.nombre).replace(/\s+/g, '').includes(u);
  }
  const donde = plano([c.texto, c.gancho, c.creador.nombre, c.creador.usuario, rotuloFormato(c.formato)].filter(Boolean).join(' '));
  return t.split(' ').every((palabra) => donde.includes(palabra));
}

const interaccion = (c: Carrusel): number | null => (c.megusta == null && c.comentarios == null ? null : (c.megusta ?? 0) + (c.comentarios ?? 0));

const enLargo = (c: Carrusel, largo: LargoCarrusel): boolean => {
  if (largo === 'todos') return true;
  if (c.laminas == null) return false;
  return largo === 'cortos' ? c.laminas <= 4 : largo === 'medios' ? c.laminas >= 5 && c.laminas <= 7 : c.laminas >= 8;
};

/** Lo que se ve con estos filtros, en su orden. `guardados` son los ids guardados del negocio. */
export function filtrarCarruseles(todos: readonly Carrusel[], f: FiltrosCarrusel, guardados: ReadonlySet<number>, ahora = Date.now()): Carrusel[] {
  const creadores = new Set(f.creadores);
  const xs = todos.filter((c) => {
    if (f.vista === 'guardados' && !guardados.has(c.id)) return false;
    if (f.vista === 'semana' && !enRango(c.publicada, 7, ahora)) return false;
    if (!f.conImagenes && c.medio === 'imagen') return false;
    if (creadores.size && !creadores.has(c.competidorId)) return false;
    if (f.origen !== 'todos' && c.origen !== f.origen) return false;
    if (f.outlierMin > 0 && (c.outlier == null || c.outlier < f.outlierMin)) return false;
    if (f.periodo !== 'todo' && !enRango(c.publicada, Number(f.periodo), ahora)) return false;
    if (f.formato && c.formato !== f.formato) return false;
    if (!enLargo(c, f.largo)) return false;
    return coincide(c, f.q);
  });
  return ordenarCarruseles(xs, f.vista === 'semana' && f.orden === 'nuevos' ? 'nuevos' : f.orden);
}

/**
 * El orden. Lo que no tiene el número del orden va al final (no se afirma un cero). Entre los que no lo tienen (los de un
 * tema de la biblioteca no llevan outlier), primero el que más interacción tuvo y después lo más nuevo.
 */
export function ordenarCarruseles(xs: readonly Carrusel[], orden: OrdenCarrusel): Carrusel[] {
  const fecha = (iso: string | null) => { const t = Date.parse(iso ?? ''); return Number.isFinite(t) ? t : null; };
  const clave = (c: Carrusel): number | null =>
    orden === 'outlier' ? c.outlier
      : orden === 'interaccion' ? interaccion(c)
      : orden === 'traidos' ? fecha(c.traida)
      : fecha(c.publicada);
  const asc = orden === 'viejos';
  return [...xs].sort((a, b) => {
    const ka = clave(a); const kb = clave(b);
    if (ka == null && kb == null) return (interaccion(b) ?? -1) - (interaccion(a) ?? -1) || (fecha(b.publicada) ?? 0) - (fecha(a.publicada) ?? 0) || b.id - a.id;
    if (ka == null) return 1;
    if (kb == null) return -1;
    return (asc ? ka - kb : kb - ka) || (fecha(b.publicada) ?? 0) - (fecha(a.publicada) ?? 0) || b.id - a.id;
  });
}

/** Las tendencias de la semana: lo publicado en los últimos 7 días, del outlier más alto al más bajo. */
export function tendenciasDeLaSemana(todos: readonly Carrusel[], tope = 8, ahora = Date.now()): Carrusel[] {
  return filtrarCarruseles(todos, { ...FILTROS_INICIALES, vista: 'semana', orden: 'outlier' }, new Set(), ahora).slice(0, Math.max(0, tope));
}

/** Los creadores que tienen algo en el explorador, con cuántos carruseles: los chips del filtro y «Cuentas que sigues». */
export function creadoresDe(todos: readonly Carrusel[]): Array<{ id: number; nombre: string; usuario: string | null; foto: string | null; n: number }> {
  const m = new Map<number, { id: number; nombre: string; usuario: string | null; foto: string | null; n: number }>();
  for (const c of todos) {
    const x = m.get(c.competidorId) ?? { id: c.competidorId, nombre: c.creador.nombre, usuario: c.creador.usuario, foto: c.creador.foto, n: 0 };
    x.n += 1;
    m.set(c.competidorId, x);
  }
  return [...m.values()].sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre, 'es'));
}

/** Los formatos que aparecen, para el filtro (sólo los que tienen algo). */
export function formatosDe(todos: readonly Carrusel[]): Array<{ value: Formato; label: string; n: number }> {
  const n = new Map<Formato, number>();
  for (const c of todos) if (c.formato && c.formato !== 'otro') n.set(c.formato, (n.get(c.formato) ?? 0) + 1);
  return FORMATOS.filter((f) => n.has(f.value)).map((f) => ({ value: f.value, label: f.label, n: n.get(f.value) ?? 0 })).sort((a, b) => b.n - a.n);
}

export const rotuloFormato = (v: Formato | ''): string => (v ? FORMATOS.find((f) => f.value === v)?.label ?? '' : '');

/** «4,2×»: el outlier como se lee. */
export const rotuloOutlier = (v: number): string => `${String(Math.round(v * 10) / 10).replace('.', ',')}×`;

/** «1,2k»: un contador corto. */
export function contadorCorto(v: number | null): string {
  if (v == null) return '—';
  if (v >= 1_000_000) return `${String(Math.round(v / 100_000) / 10).replace('.', ',')}M`;
  if (v >= 10_000) return `${Math.round(v / 1000)}k`;
  if (v >= 1000) return `${String(Math.round(v / 100) / 10).replace('.', ',')}k`;
  return String(v);
}

// ─────────────────────────────────────────────────────────────────────────────
// Los filtros en la URL (`?ver=carruseles&q=…`): un link copiado abre lo mismo, y la API devuelve ese link
// ─────────────────────────────────────────────────────────────────────────────

const unoDe = <T extends string>(v: string | null, lista: readonly { value: T }[], def: T): T =>
  (lista.find((x) => x.value === v)?.value ?? def);

/** Los filtros que dice una URL (lo que no se entiende vuelve al valor inicial). */
export function filtrosDeQuery(q: URLSearchParams | Record<string, string | string[] | undefined>): FiltrosCarrusel {
  const get = (k: string): string | null => {
    if (q instanceof URLSearchParams) return q.get(k);
    const v = q[k];
    return Array.isArray(v) ? v[0] ?? null : v ?? null;
  };
  const min = Number(get('min'));
  // En negativo, una cuenta de la biblioteca (su id); el cero no es nadie.
  const creadores = (get('de') ?? '').split(',').filter((x) => x.trim() !== '').map(Number).filter((n) => Number.isSafeInteger(n) && n !== 0).slice(0, 25);
  const formato = formatoDe(get('formato') ?? '');
  return {
    q: (get('q') ?? '').slice(0, 120),
    creadores,
    origen: unoDe(get('origen'), ORIGENES_CARRUSEL, 'todos'),
    outlierMin: (OUTLIER_MINIMOS as readonly number[]).includes(min) ? min : 0,
    periodo: unoDe(get('periodo'), PERIODOS_CARRUSEL, 'todo'),
    largo: unoDe(get('largo'), LARGOS_CARRUSEL, 'todos'),
    formato,
    conImagenes: get('imagenes') === '1',
    orden: unoDe(get('orden'), ORDENES_CARRUSEL, 'outlier'),
    vista: unoDe(get('vista'), VISTAS_CARRUSEL, 'todos'),
  };
}

/** La query de unos filtros, sólo con lo que no es el valor inicial (más `ver=carruseles`). */
export function queryDeFiltros(f: FiltrosCarrusel): string {
  const q = new URLSearchParams({ ver: 'carruseles' });
  if (f.q.trim()) q.set('q', f.q.trim());
  if (f.creadores.length) q.set('de', f.creadores.join(','));
  if (f.origen !== 'todos') q.set('origen', f.origen);
  if (f.outlierMin) q.set('min', String(f.outlierMin));
  if (f.periodo !== 'todo') q.set('periodo', f.periodo);
  if (f.largo !== 'todos') q.set('largo', f.largo);
  if (f.formato) q.set('formato', f.formato);
  if (f.conImagenes) q.set('imagenes', '1');
  if (f.orden !== 'outlier') q.set('orden', f.orden);
  if (f.vista !== 'todos') q.set('vista', f.vista);
  return q.toString();
}

/** ¿Los filtros son los de entrada? (sin nada que guardar como búsqueda). */
export const sinFiltros = (f: FiltrosCarrusel): boolean => queryDeFiltros(f) === 'ver=carruseles';

// ─────────────────────────────────────────────────────────────────────────────
// Guardados y búsquedas guardadas (app_settings del negocio: `carruseles.guardados`, `carruseles.busquedas`)
// ─────────────────────────────────────────────────────────────────────────────
// Son del NEGOCIO, no de una persona: son las referencias del equipo («como referencia del negocio», el pedido). Se guardan
// como JSON en un setting, con un tope: un setting no es una tabla.

export const TOPE_GUARDADOS = 500;
export const TOPE_BUSQUEDAS = 20;
export const CLAVE_GUARDADOS = 'carruseles.guardados';
export const CLAVE_BUSQUEDAS = 'carruseles.busquedas';

export type Guardado = { id: number; en: string };
export type BusquedaGuardada = { id: string; nombre: string; query: string; en: string };

const json = (raw: string | null | unknown): unknown => {
  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(raw); } catch { return null; }
};

/** Los guardados como se leen de la base: sin repetidos, el más nuevo primero, con el tope. Lo roto se descarta. */
export function sanearGuardados(raw: unknown): Guardado[] {
  const v = json(raw);
  if (!Array.isArray(v)) return [];
  const vistos = new Set<number>();
  const out: Guardado[] = [];
  for (const g of v) {
    const id = Number((g as Guardado)?.id);
    const en = String((g as Guardado)?.en ?? '');
    // En negativo, un carrusel de la biblioteca de ejemplos (./biblioteca.ts); el cero no es ninguno.
    if (!Number.isSafeInteger(id) || id === 0 || vistos.has(id) || !Number.isFinite(Date.parse(en))) continue;
    vistos.add(id);
    out.push({ id, en });
  }
  return out.sort((a, b) => b.en.localeCompare(a.en)).slice(0, TOPE_GUARDADOS);
}

/** Guardar o sacar uno. Guardar lo que ya está no cambia nada (idempotente); `ya` dice si ya estaba como se pide. */
export function conGuardado(lista: readonly Guardado[], id: number, guardar: boolean, ahora: string): { lista: Guardado[]; ya: boolean } {
  const esta = lista.some((g) => g.id === id);
  if (guardar === esta) return { lista: [...lista], ya: true };
  const nueva = guardar ? [{ id, en: ahora }, ...lista] : lista.filter((g) => g.id !== id);
  return { lista: sanearGuardados(nueva), ya: false };
}

/** Las búsquedas guardadas: cada una con su nombre y la query de sus filtros (re-saneada: lo que no se entiende se cae). */
export function sanearBusquedas(raw: unknown): BusquedaGuardada[] {
  const v = json(raw);
  if (!Array.isArray(v)) return [];
  const out: BusquedaGuardada[] = [];
  const ids = new Set<string>();
  for (const b of v) {
    const id = String((b as BusquedaGuardada)?.id ?? '').slice(0, 40);
    const nombre = String((b as BusquedaGuardada)?.nombre ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
    const en = String((b as BusquedaGuardada)?.en ?? '');
    if (!/^[a-z0-9-]{4,40}$/.test(id) || ids.has(id) || !nombre || !Number.isFinite(Date.parse(en))) continue;
    const query = queryDeFiltros(filtrosDeQuery(new URLSearchParams(String((b as BusquedaGuardada)?.query ?? ''))));
    ids.add(id);
    out.push({ id, nombre, query, en });
  }
  return out.slice(0, TOPE_BUSQUEDAS);
}

/** Un nombre para una búsqueda, de sus filtros: «@sofia · 2×+ · Lista». */
export function nombreDeBusqueda(f: FiltrosCarrusel, creadores: ReadonlyArray<{ id: number; nombre: string }>): string {
  const partes: string[] = [];
  if (f.q.trim()) partes.push(f.q.trim());
  if (f.creadores.length) partes.push(f.creadores.map((id) => creadores.find((c) => c.id === id)?.nombre ?? '').filter(Boolean).join(', '));
  if (f.origen !== 'todos') partes.push(ORIGENES_CARRUSEL.find((o) => o.value === f.origen)?.label ?? '');
  if (f.vista === 'semana') partes.push('Esta semana');
  if (f.outlierMin) partes.push(`${f.outlierMin}×+`);
  if (f.formato) partes.push(rotuloFormato(f.formato));
  if (f.largo !== 'todos') partes.push(LARGOS_CARRUSEL.find((l) => l.value === f.largo)?.label ?? '');
  if (f.periodo !== 'todo') partes.push(PERIODOS_CARRUSEL.find((p) => p.value === f.periodo)?.label ?? '');
  return partes.filter(Boolean).join(' · ').slice(0, 60) || 'Mi búsqueda';
}

// ─────────────────────────────────────────────────────────────────────────────
// En qué paso está (la pantalla vacía y la API: guía, no un error seco)
// ─────────────────────────────────────────────────────────────────────────────

export type PasoExplorador = 'sin-cuentas' | 'sin-instagram' | 'sin-carruseles' | 'listo';

/**
 * Qué falta para que el explorador tenga carruseles, y qué hacer. Lo cuenta el código sobre lo que hay: cero cuentas
 * seguidas, cuentas sin Instagram, o Instagram sin publicaciones traídas todavía (Spy las está trayendo).
 */
export function pasoDelExplorador(n: { competidores: number; conInstagram: number; carruseles: number }): { paso: PasoExplorador; frase: string; accion: { texto: string; ruta: string } | null } {
  if (n.competidores === 0) {
    return { paso: 'sin-cuentas', frase: 'Sigue a las cuentas de tu rubro en Competitors Spy: aquí ves sus carruseles que mejor funcionan.', accion: { texto: 'Seguir una cuenta', ruta: '/competitor-spy' } };
  }
  if (n.conInstagram === 0) {
    return { paso: 'sin-instagram', frase: 'Súmale el Instagram a una de las cuentas que sigues para ver sus carruseles.', accion: { texto: 'Abrir Competitors Spy', ruta: '/competitor-spy' } };
  }
  if (n.carruseles === 0) {
    return { paso: 'sin-carruseles', frase: 'Abre una cuenta en Competitors Spy para traer sus publicaciones: aparecen aquí al leerla.', accion: { texto: 'Abrir Competitors Spy', ruta: '/competitor-spy' } };
  }
  return { paso: 'listo', frase: '', accion: null };
}
