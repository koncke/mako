// =============================================================================
// El modelo del Second Brain del teléfono (puro: lo usan la pantalla y su test)
// =============================================================================
// Sale de lo que el escritorio ya sabe (lib/cerebro-modelo.ts, lib/cerebro-areas.ts,
// lib/buscar-cerebro.ts): acá sólo vive lo que es del TELÉFONO — qué se lista en cada área,
// el orden de una búsqueda, el mapa chico y los rótulos que se copian de escritorio.
// =============================================================================

import { AREAS, AUTORIA_TEXTO, NIVEL1, radioNodo as radioDe, type AreaId, type Cerebro, type NodoCerebro } from '@/lib/cerebro-modelo';
import { CAMPOS_CEREBRO_DEFECTO, CAMPOS_CEREBRO_TODOS, matchNodo, type CampoCerebro } from '@/lib/buscar-cerebro';
import { esEstructura, gradosDe, OPACIDAD_PENDIENTE, rellenoNodo } from '@/lib/cerebro-areas';

/**
 * Los rótulos que el teléfono COPIA de escritorio, con el archivo que los dice. Un rótulo escrito
 * dos veces se desvía sin error (hallazgos-mobile, Avisos): tests/m-second-brain.test.ts busca
 * cada uno en su archivo de escritorio.
 */
export const ROTULOS_ESCRITORIO = {
  buscar: { t: 'Buscar un dato', en: 'app/second-brain/BuscadorCerebro.tsx' },
  soloNombre: { t: 'Solo el nombre', en: 'app/second-brain/BuscadorCerebro.tsx' },
  todo: { t: 'Todo', en: 'app/second-brain/BuscadorCerebro.tsx' },
  donde: { t: 'Dónde buscar', en: 'app/second-brain/BuscadorCerebro.tsx' },
  conMako: { t: 'Buscar con MaKo', en: 'app/second-brain/BuscadorCerebro.tsx' },
  leyendo: { t: 'MaKo está leyendo tu mapa…', en: 'app/second-brain/BuscadorCerebro.tsx' },
  eligio: { t: 'MaKo eligió', en: 'app/second-brain/BuscadorCerebro.tsx' },
  negocio: { t: 'Tu negocio', en: 'app/second-brain/Grafo.tsx' },
  norte: { t: 'Tu Norte', en: 'app/second-brain/Grafo.tsx' },
  cuello: { t: 'Tu cuello de botella', en: 'app/second-brain/Grafo.tsx' },
  leer: { t: 'Leer lo que MaKo explica', en: 'app/second-brain/Grafo.tsx' },
  deDonde: { t: 'De dónde salió', en: 'app/second-brain/Grafo.tsx' },
  conectado: { t: 'Conectado con', en: 'app/second-brain/Grafo.tsx' },
  verLas: { t: 'Ver las', en: 'app/second-brain/Grafo.tsx' },
  verDoc: { t: 'Ver el documento', en: 'app/second-brain/Grafo.tsx' },
  vacio: { t: 'Todavía no sé nada de tu negocio', en: 'app/second-brain/Grafo.tsx' },
  abrirArchivero: { t: 'Abrir El Archivero', en: 'app/second-brain/Grafo.tsx' },
  elegirArchivos: { t: 'Elegir archivos', en: 'app/onboarding/Archivero.tsx' },
  analizar: { t: 'Analizar', en: 'app/onboarding/Archivero.tsx' },
  subirMas: { t: 'Subir más', en: 'app/onboarding/Archivero.tsx' },
  sinMako: { t: 'No se pudo consultar a MaKo.', en: 'app/second-brain/Grafo.tsx' },
} as const;

export const R = Object.fromEntries(Object.entries(ROTULOS_ESCRITORIO).map(([k, v]) => [k, v.t])) as { [K in keyof typeof ROTULOS_ESCRITORIO]: (typeof ROTULOS_ESCRITORIO)[K]['t'] };

// ── La URL ────────────────────────────────────────────────────────────────────

/** `?area=oferta` (la clave de escritorio, la arma `rutaSeccion`): abre esa área. Validada contra AREAS. */
export function areaDeParam(v: string | string[] | undefined | null): AreaId | null {
  const s = Array.isArray(v) ? v[0] : v;
  return AREAS.find((a) => a.id === s)?.id ?? null;
}

// ── Las secciones de «Tu negocio» ────────────────────────────────────────────

export type AreaM = { id: AreaId; nombre: string; color: string };
export type CarpetaM = { id: string; nombre: string; areas: AreaM[] };

/** Las cinco carpetas madre con sus áreas, en el orden del mapa (NIVEL1 y AREAS de escritorio). */
export function carpetas(): CarpetaM[] {
  return NIVEL1
    .map((c) => ({
      id: c.id,
      nombre: c.nombre,
      areas: AREAS.filter((a) => a.padre === c.id).map((a) => ({ id: a.id, nombre: a.nombre, color: a.color })),
    }))
    .filter((c) => c.areas.length > 0);
}

export const areaPorId = (id: AreaId): AreaM => {
  const a = AREAS.find((x) => x.id === id) ?? AREAS[0];
  return { id: a.id, nombre: a.nombre, color: a.color };
};

/** El nombre de la carpeta madre de un área («Oferta» para Productos): la segunda línea de un área encontrada. */
export const carpetaDeArea = (id: AreaId): string => {
  const padre = AREAS.find((a) => a.id === id)?.padre;
  return NIVEL1.find((c) => c.id === padre)?.nombre ?? '';
};

/** La primera línea de un texto (la segunda línea de una fila: FilaM la corta con «…»). */
export const primeraLinea = (s: string | null | undefined): string => (s ?? '').split('\n').map((l) => l.trim()).find(Boolean) ?? '';

/** «820 KB», «2,4 MB»: lo que pesa un archivo elegido. */
export function pesoArchivo(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

/** El Norte y el cuello de botella: los dos accesos que el mapa pone primero. */
export function accesos(nodos: readonly NodoCerebro[]): { norte: NodoCerebro | null; cuello: NodoCerebro | null } {
  return { norte: nodos.find((n) => n.destacado) ?? null, cuello: nodos.find((n) => n.alerta) ?? null };
}

/**
 * Lo que se lista al abrir un área: sus datos, del más conectado al menos (el que resume esa parte
 * del negocio va arriba), y después lo que falta. Sin la estructura ni el «falta:» del área entera
 * (eso es el vacío de la hoja, no una fila).
 */
export function datosDelArea(c: Pick<Cerebro, 'nodos' | 'aristas'>, area: AreaId): { reales: NodoCerebro[]; pendientes: NodoCerebro[] } {
  const g = gradosDe(c.nodos, c.aristas);
  const dentro = c.nodos
    .filter((n) => n.area === area && !esEstructura(n) && !n.id.startsWith('falta:'))
    .sort((a, b) => (g[b.id] ?? 0) - (g[a.id] ?? 0));
  return { reales: dentro.filter((n) => n.autoria !== 'pendiente'), pendientes: dentro.filter((n) => n.autoria === 'pendiente') };
}

// ── La búsqueda ──────────────────────────────────────────────────────────────

export type DondeBuscar = 'nombre' | 'todo';

/** Los dos atajos del «Dónde buscar» de escritorio: «Solo el nombre» y «Todo». */
export const camposDe = (d: DondeBuscar): CampoCerebro[] => (d === 'todo' ? CAMPOS_CEREBRO_TODOS : CAMPOS_CEREBRO_DEFECTO);

/** Lo que se puede encontrar: todo menos la raíz y las carpetas madre (un área sí: abre su lista). */
const buscable = (n: NodoCerebro) => n.id !== 'raiz' && !n.id.startsWith('n1:');

/** Los nodos que matchean, del más conectado al menos (el mismo orden que el mapa de escritorio). */
export function buscarNodos(c: Pick<Cerebro, 'nodos' | 'aristas'>, q: string, donde: DondeBuscar): NodoCerebro[] {
  if (!q.trim()) return [];
  const g = gradosDe(c.nodos, c.aristas);
  const campos = camposDe(donde);
  return c.nodos.filter((n) => buscable(n) && matchNodo(n, q, campos)).sort((a, b) => (g[b.id] ?? 0) - (g[a.id] ?? 0));
}

/** Lo que eligió MaKo, en SU orden (le pedimos «del que más responde al que menos»), sin ids inventados. */
export function elegidosPorMako(c: Pick<Cerebro, 'nodos'>, ids: readonly string[]): NodoCerebro[] {
  const porId = new Map(c.nodos.map((n) => [n.id, n]));
  const vistos = new Set<string>();
  const out: NodoCerebro[] = [];
  for (const id of ids) {
    const n = porId.get(id);
    if (!n || vistos.has(id) || !buscable(n)) continue;
    vistos.add(id);
    out.push(n);
  }
  return out;
}

/** Cuántos datos hay para buscar (el «3/72» del campo). */
export const totalBuscable = (c: Pick<Cerebro, 'nodos'>): number => c.nodos.filter(buscable).length;

// ── El dato abierto ──────────────────────────────────────────────────────────

/** Un valor que entra al lado de su nombre (FilaDatoM) o uno que va debajo, entero. */
export const esCorto = (v: string): boolean => v.length <= 26 && !v.includes('\n');

/** Los pares nombre/valor con valor: nada se dibuja vacío. */
export const datosConValor = (n: NodoCerebro): Array<{ k: string; v: string }> =>
  (n.datos ?? []).filter((d) => d.v && d.v.trim()).map((d) => ({ k: d.k, v: d.v.trim() }));

/** «De dónde salió»: la fuente y quién lo puso, como en la tarjeta del mapa. */
export function deDondeSalio(n: NodoCerebro): string {
  return [n.fuente, AUTORIA_TEXTO[n.autoria]].filter(Boolean).join(' · ');
}

/** Los vecinos con su motivo (el texto de la arista), sin repetir. */
export function conexionesDe(c: Pick<Cerebro, 'nodos' | 'aristas'>, id: string): Array<{ nodo: NodoCerebro; motivo: string }> {
  const porId = new Map(c.nodos.map((n) => [n.id, n]));
  const vistos = new Set<string>();
  const out: Array<{ nodo: NodoCerebro; motivo: string }> = [];
  for (const e of c.aristas) {
    const otro = e.de === id ? e.a : e.a === id ? e.de : null;
    if (!otro || vistos.has(otro)) continue;
    const n = porId.get(otro);
    if (!n || n.id === 'raiz' || n.id.startsWith('n1:')) continue;
    vistos.add(otro);
    out.push({ nodo: n, motivo: e.motivo });
  }
  return out;
}

// ── El mapa chico ────────────────────────────────────────────────────────────

export type PuntoMapa = { id: string; x: number; y: number; r: number; color: string; opacidad: number };
export type LineaMapa = { x1: number; y1: number; x2: number; y2: number };

/**
 * El mapa de escritorio en una caja de `ancho`×`alto` (unidades = px): las MISMAS posiciones que
 * calcula el server (d3-force, `cerebro.posiciones`), escaladas al bbox de los puntos, con el
 * radio de Obsidian escalado igual (y un piso para que se vea). Sin interacción: es una foto.
 */
export function miniMapa(c: Pick<Cerebro, 'nodos' | 'aristas' | 'posiciones'>, ancho: number, alto: number, margen = 14): { puntos: PuntoMapa[]; lineas: LineaMapa[] } {
  const g = gradosDe(c.nodos, c.aristas);
  const con = c.nodos.filter((n) => c.posiciones[n.id]);
  if (!con.length) return { puntos: [], lineas: [] };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of con) {
    const p = c.posiciones[n.id];
    const r = radioDe(g[n.id] ?? 0);
    x0 = Math.min(x0, p.x - r); y0 = Math.min(y0, p.y - r); x1 = Math.max(x1, p.x + r); y1 = Math.max(y1, p.y + r);
  }
  const bw = Math.max(x1 - x0, 1), bh = Math.max(y1 - y0, 1);
  const k = Math.min((ancho - 2 * margen) / bw, (alto - 2 * margen) / bh);
  const dx = (ancho - bw * k) / 2 - x0 * k;
  const dy = (alto - bh * k) / 2 - y0 * k;
  const aPx = (p: { x: number; y: number }) => ({ x: Math.round((p.x * k + dx) * 10) / 10, y: Math.round((p.y * k + dy) * 10) / 10 });
  const puntos: PuntoMapa[] = con.map((n) => {
    const p = aPx(c.posiciones[n.id]);
    return {
      id: n.id, x: p.x, y: p.y,
      r: Math.round(Math.max(1.8, radioDe(g[n.id] ?? 0) * k) * 10) / 10,
      color: rellenoNodo(n),
      opacidad: n.autoria === 'pendiente' ? OPACIDAD_PENDIENTE : 1,
    };
  });
  const lineas: LineaMapa[] = [];
  for (const e of c.aristas) {
    const a = c.posiciones[e.de], b = c.posiciones[e.a];
    if (!a || !b) continue;
    const pa = aPx(a), pb = aPx(b);
    lineas.push({ x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y });
  }
  return { puntos, lineas };
}
