// =============================================================================
// graficos-secciones — la «Sección» del Dashboard: qué agrupa, qué se esconde al plegarla, y la grilla
// =============================================================================
// Decisión 2 de Martín (tanda v5, 12/10/2026): el contenedor es una SECCIÓN A LO ANCHO que agrupa las filas
// que tiene debajo hasta la siguiente sección, con título, fondo y plegable. Es también el «Desplegable» del
// punto 24. No hay grilla anidada: la sección va siempre en x=0 y w=12 (el saneo lo fuerza,
// lib/graficos-catalogo.ts → `sanearElemento`).
//
// PURO y sin `server-only`: lo usan la pantalla (app/dashboard/EditorInforme.tsx, Seccion.tsx), el pedido de
// datos (app/dashboard/exportar.ts → `pedidosDeHoja`, que corre también en el server en la primera pintada) y
// tests/graficos-secciones.test.ts.
//
// Lo que no se ve en la firma:
//   · LA MEMBRESÍA SE DERIVA, NO SE GUARDA. Un componente es de la sección S si S.y <= c.y < (la y de la
//     sección siguiente). Guardar «quién es de quién» sería un segundo dato que se desincroniza al mover una
//     tarjeta, y un campo nuevo que una pestaña vieja borraría en su autoguardado.
//   · UNA SECCIÓN SIN TÍTULO Y NO PLEGABLE ES UN DIVISOR (`esCierre`): cierra el grupo de arriba y no agrupa
//     nada. La migración de «A quién cobrarle» la usa (lib/graficos-migrar-v5.ts): sin el cierre, plegar la
//     sección escondía todo lo que venía después en la hoja.
//   · PLEGAR NO MUEVE NADA DE LO GUARDADO. Lo plegado sale de la grilla y lo de abajo SUBE en lo que se dibuja
//     (`aVista`); lo que la grilla avise de vuelta se traduce a lo guardado con `aGuardado`, que suma de
//     vuelta las filas escondidas. Sin la vuelta, editar con una sección plegada escribía las `y` compactadas
//     y al desplegarla el grupo caía DESPUÉS de la sección siguiente: se perdía el orden (pedido de Martín:
//     «editando se puede plegar sin perder el orden»).
//   · Plegar MIRANDO es estado de la VISTA (como los filtros): no se guarda. Lo que se guarda es cómo arranca
//     (`seccion.abierto`), y eso se edita en el panel.

import type { Componente, Elemento } from './graficos-catalogo';

/** Una sección (el elemento de tipo 'seccion'). */
export type ElementoSeccion = Elemento & { tipo: 'seccion' };

export const esSeccion = (c: Componente): c is ElementoSeccion => c.clase === 'elemento' && c.tipo === 'seccion';

/** Un DIVISOR: sin título y no plegable. Cierra el grupo de la sección de arriba y no agrupa nada. */
export const esCierre = (s: ElementoSeccion): boolean => !s.texto.trim() && !s.seccion?.plegable;

/** Lo que se puede plegar: una sección plegable que no es un divisor. */
export const esPlegable = (s: ElementoSeccion): boolean => !!s.seccion?.plegable && !esCierre(s);

/** El grupo de una sección, en filas de la grilla GUARDADA. */
export type GrupoSeccion = {
  id: string;
  /** La fila de la sección y cuántas ocupa. */
  y: number;
  h: number;
  /** La primera fila del grupo (debajo de la sección) y la fila donde termina (exclusiva). */
  desde: number;
  hasta: number;
  /** Los ids de lo que agrupa, en el orden en que se lee. */
  miembros: string[];
  cierre: boolean;
  plegable: boolean;
  /** Cómo arranca (lo guardado): abierta o plegada. */
  abierto: boolean;
  /** El fondo del grupo: índice de la paleta de la hoja, o null. */
  fondo: number | null;
};

type Caja = { x: number; y: number; w: number; h: number };
const porLectura = <T extends Caja>(a: T, b: T) => a.y - b.y || a.x - b.x;

/**
 * Los grupos de la hoja, en orden. Un componente que está ARRIBA de la primera sección no es de ninguna; uno
 * que está debajo de un divisor tampoco (hasta la sección siguiente).
 */
export function gruposDe(componentes: readonly Componente[]): GrupoSeccion[] {
  const secciones = componentes.filter(esSeccion).sort(porLectura);
  const resto = componentes.filter((c) => !esSeccion(c)).sort(porLectura);
  return secciones.map((s, i) => {
    const siguiente = secciones[i + 1];
    const cierre = esCierre(s);
    const tope = siguiente ? siguiente.y : Number.POSITIVE_INFINITY;
    const miembros = cierre ? [] : resto.filter((c) => c.y >= s.y && c.y < tope);
    const fondoMiembros = miembros.reduce((m, c) => Math.max(m, c.y + c.h), s.y + s.h);
    const hasta = cierre ? s.y + s.h : siguiente ? Math.max(siguiente.y, s.y + s.h) : fondoMiembros;
    return {
      id: s.id, y: s.y, h: s.h, desde: s.y + s.h, hasta,
      miembros: miembros.map((c) => c.id), cierre,
      plegable: esPlegable(s), abierto: s.seccion?.abierto !== false,
      fondo: cierre ? null : s.seccion?.fondo ?? null,
    };
  });
}

/** Las secciones que arrancan plegadas (lo GUARDADO: plegables y con `abierto: false`). */
export function plegadasDeEntrada(componentes: readonly Componente[]): Set<string> {
  return new Set(gruposDe(componentes).filter((g) => g.plegable && !g.abierto).map((g) => g.id));
}

/**
 * Las plegadas AHORA: lo de entrada con lo que se eligió mirando encima (`vista[id]` = true plegada, false
 * abierta). Una sección que dejó de ser plegable no cuenta aunque la vista la tenga plegada.
 */
export function plegadasDe(componentes: readonly Componente[], vista: Readonly<Record<string, boolean>> = {}): Set<string> {
  const out = new Set<string>();
  for (const g of gruposDe(componentes)) {
    if (!g.plegable) continue;
    const plegada = vista[g.id] ?? !g.abierto;
    if (plegada) out.add(g.id);
  }
  return out;
}

/** Lo que NO se dibuja (ni se pide): los miembros de las secciones plegadas. */
export function ocultosPorPlegado(componentes: readonly Componente[], plegadas: ReadonlySet<string>): Set<string> {
  const out = new Set<string>();
  if (!plegadas.size) return out;
  for (const g of gruposDe(componentes)) if (plegadas.has(g.id) && g.plegable) for (const id of g.miembros) out.add(id);
  return out;
}

/** Cuántas filas esconde una sección plegada. */
const altoEscondido = (g: GrupoSeccion) => Math.max(0, g.hasta - g.desde);

/**
 * La grilla que se DIBUJA: sin lo plegado, y lo de abajo de cada sección plegada subido las filas que se
 * escondieron. Lo guardado no cambia.
 */
export function aVista<T extends Caja & { i: string }>(items: readonly T[], grupos: readonly GrupoSeccion[], plegadas: ReadonlySet<string>): T[] {
  const plegados = grupos.filter((g) => g.plegable && plegadas.has(g.id));
  if (!plegados.length) return [...items];
  const ocultos = new Set(plegados.flatMap((g) => g.miembros));
  return items.filter((it) => !ocultos.has(it.i)).map((it) => {
    const sube = plegados.reduce((s, g) => (it.y >= g.hasta ? s + altoEscondido(g) : s), 0);
    return sube ? { ...it, y: it.y - sube } : it;
  });
}

/**
 * La vuelta: lo que la grilla avisa (en filas DIBUJADAS) traducido a filas GUARDADAS. Cada cosa que quedó
 * debajo de una sección plegada baja las filas que esa sección esconde; lo escondido viaja con su sección
 * (si la sección se movió, su grupo se mueve con ella). `antes` es lo guardado (con lo escondido incluido).
 */
export function aGuardado(vistos: ReadonlyArray<Caja & { i: string }>, antes: ReadonlyArray<Caja & { i: string }>, grupos: readonly GrupoSeccion[], plegadas: ReadonlySet<string>): Map<string, Caja> {
  const out = new Map<string, Caja>();
  const plegados = grupos.filter((g) => g.plegable && plegadas.has(g.id));
  const visto = new Map(vistos.map((v) => [v.i, v] as const));
  // Dónde termina cada sección plegada en lo DIBUJADO después del cambio.
  const finDibujado = plegados.map((g) => {
    const s = visto.get(g.id);
    return { g, fin: s ? s.y + s.h : g.desde };
  });
  for (const v of vistos) {
    const baja = finDibujado.reduce((s, { g, fin }) => (v.i !== g.id && v.y >= fin ? s + altoEscondido(g) : s), 0);
    out.set(v.i, { x: v.x, y: v.y + baja, w: v.w, h: v.h });
  }
  // Lo escondido: la misma distancia a su sección que tenía.
  const porId = new Map(antes.map((a) => [a.i, a] as const));
  for (const g of plegados) {
    const s = out.get(g.id);
    if (!s) continue;
    const corrimiento = s.y - g.y;
    for (const id of g.miembros) {
      const a = porId.get(id);
      if (a) out.set(id, { x: a.x, y: a.y + corrimiento, w: a.w, h: a.h });
    }
  }
  return out;
}

/**
 * El fondo de cada sección que tiene uno, en filas DIBUJADAS: desde la sección hasta donde termina su grupo
 * (plegada, sólo la sección). Es el rectángulo que va detrás de las tarjetas.
 */
export function fondosDe(grupos: readonly GrupoSeccion[], plegadas: ReadonlySet<string>): Array<{ id: string; fondo: number; y: number; filas: number }> {
  const plegados = grupos.filter((g) => g.plegable && plegadas.has(g.id));
  const sube = (y: number) => plegados.reduce((s, g) => (y >= g.hasta ? s + altoEscondido(g) : s), 0);
  const out: Array<{ id: string; fondo: number; y: number; filas: number }> = [];
  for (const g of grupos) {
    if (g.fondo == null || g.cierre) continue;
    const y = g.y - sube(g.y);
    const filas = plegadas.has(g.id) && g.plegable ? g.h : Math.max(g.h, g.hasta - g.y);
    out.push({ id: g.id, fondo: g.fondo, y, filas });
  }
  return out;
}
