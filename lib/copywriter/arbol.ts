// =============================================================================
// copywriter/arbol — el ÁRBOL de páginas del Copywriter (el índice): leer, mover, Papelera (PURO)
// =============================================================================
// Copiado de la barra de Notion (help/writing-and-editing-basics: «Drag-and-drop also works in your sidebar to
// reorder pages, nest pages inside pages»): las páginas cuelgan unas de otras, se reordenan arrastrando y una página
// que va a la Papelera se lleva a sus subpáginas (no se ven), y vuelve con ellas. Diseño: docs/diseno-copywriter.md (D4).
//
// Lo que no se ve en el código:
//   · EL ORDEN SE RENUMERA ENTERO al mover (0, 1, 2… entre hermanas). Con huecos o repetidos, dos pestañas que mueven a
//     la vez dejaban dos páginas con el mismo `orden` y el árbol las mostraba en el orden en que llegaban de la base.
//   · MOVER NO PUEDE ARMAR UN CICLO: una página no puede colgar de sí misma ni de una de sus descendientes (se
//     perdería del árbol entera, con todo lo de abajo, sin error).
//   · RESTAURAR a una página cuyo padre ya no está (o sigue en la Papelera) la vuelve a la RAÍZ: si no, volvía a un
//     lugar que no se dibuja y «Restaurar» no hacía nada visible.
// SIN 'server-only': lo usan el server (que es quien escribe) y la pantalla (que dibuja y mueve en el acto).
// =============================================================================

import { TOPES, esIdPagina, esTipoGuion, SIN_TITULO, type PaginaCopy } from './tipos';

/** Lee el índice a la defensiva: lo que no tiene la forma se cae; los padres que no existen pasan a la raíz. */
export function sanearIndice(raw: unknown): PaginaCopy[] {
  if (!Array.isArray(raw)) return [];
  const vistos = new Set<string>();
  const out: PaginaCopy[] = [];
  for (const x of raw.slice(0, TOPES.paginas * 2)) {
    const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    if (!esIdPagina(o.id) || vistos.has(o.id)) continue;
    vistos.add(o.id);
    const titulo = typeof o.titulo === 'string' ? o.titulo.replace(/\s+/g, ' ').trim().slice(0, TOPES.titulo) : '';
    out.push({
      id: o.id,
      titulo: titulo || SIN_TITULO,
      emoji: typeof o.emoji === 'string' && o.emoji.trim() && o.emoji.length <= 16 ? o.emoji : null,
      tipo: esTipoGuion(o.tipo) ? o.tipo : 'ad',
      padre: esIdPagina(o.padre) ? o.padre : null,
      orden: Number.isFinite(o.orden) ? Number(o.orden) : 0,
      actualizado: typeof o.actualizado === 'string' ? o.actualizado : new Date(0).toISOString(),
      ...(typeof o.papelera === 'string' ? { papelera: o.papelera } : {}),
    });
  }
  return out.map((p) => (p.padre && (!vistos.has(p.padre) || p.padre === p.id) ? { ...p, padre: null } : p));
}

/** Las hermanas de un lugar del árbol, vivas y en su orden. */
export function hijasDe(paginas: readonly PaginaCopy[], padre: string | null): PaginaCopy[] {
  return paginas.filter((p) => p.padre === padre && !p.papelera).sort((a, b) => a.orden - b.orden || a.titulo.localeCompare(b.titulo));
}

/** ¿`id` está en la Papelera, o cuelga de una página que lo está? (lo que no se dibuja) */
export function escondida(paginas: readonly PaginaCopy[], id: string): boolean {
  const porId = new Map(paginas.map((p) => [p.id, p]));
  let p = porId.get(id);
  for (let i = 0; p && i <= TOPES.paginas; i++) {
    if (p.papelera) return true;
    p = p.padre ? porId.get(p.padre) : undefined;
  }
  return !porId.has(id);
}

/** Los ids de `id` y de todo lo que cuelga de ella. */
export function descendientes(paginas: readonly PaginaCopy[], id: string): Set<string> {
  const out = new Set<string>([id]);
  let crecio = true;
  while (crecio) {
    crecio = false;
    for (const p of paginas) if (p.padre && out.has(p.padre) && !out.has(p.id)) { out.add(p.id); crecio = true; }
  }
  return out;
}

/** La ruta de una página, de la raíz a ella (las «migas» de la barra de Notion). */
export function rutaDe(paginas: readonly PaginaCopy[], id: string): PaginaCopy[] {
  const porId = new Map(paginas.map((p) => [p.id, p]));
  const out: PaginaCopy[] = [];
  let p = porId.get(id);
  while (p && out.length <= TOPES.profundidadArbol + 1 && !out.includes(p)) {
    out.unshift(p);
    p = p.padre ? porId.get(p.padre) : undefined;
  }
  return out;
}

/** La página viva tocada más recientemente (la que abre /copywriter a secas). */
export function masReciente(paginas: readonly PaginaCopy[]): PaginaCopy | null {
  let mejor: PaginaCopy | null = null;
  for (const p of paginas) {
    if (escondida(paginas, p.id)) continue;
    if (!mejor || p.actualizado > mejor.actualizado) mejor = p;
  }
  return mejor;
}

/** Renumera las hermanas de `padre` en el orden dado (0, 1, 2…). */
function renumerar(paginas: PaginaCopy[], padre: string | null, orden: readonly string[]): PaginaCopy[] {
  const lugar = new Map(orden.map((id, i) => [id, i]));
  return paginas.map((p) => (p.padre === padre && lugar.has(p.id) ? { ...p, orden: lugar.get(p.id)! } : p));
}

export type ResultadoArbol = { ok: true; paginas: PaginaCopy[] } | { ok: false; error: string };

/** Agrega una página nueva al final de `padre` (o en `posicion`). */
export function agregar(paginas: readonly PaginaCopy[], nueva: Omit<PaginaCopy, 'orden'>, posicion?: number): ResultadoArbol {
  if (paginas.filter((p) => !p.papelera).length >= TOPES.paginas) return { ok: false, error: `Llegaste al tope de ${TOPES.paginas} guiones.` };
  if (paginas.some((p) => p.id === nueva.id)) return { ok: false, error: 'Ese guion ya existe.' };
  if (nueva.padre && (!paginas.some((p) => p.id === nueva.padre) || escondida(paginas, nueva.padre))) return { ok: false, error: 'La página de arriba ya no existe.' };
  if (nueva.padre && rutaDe(paginas, nueva.padre).length >= TOPES.profundidadArbol) return { ok: false, error: 'No se puede anidar más.' };
  const hermanas = hijasDe(paginas, nueva.padre).map((p) => p.id);
  const en = posicion == null ? hermanas.length : Math.max(0, Math.min(hermanas.length, Math.round(posicion)));
  hermanas.splice(en, 0, nueva.id);
  return { ok: true, paginas: renumerar([...paginas, { ...nueva, orden: en }], nueva.padre, hermanas) };
}

/**
 * Mueve `id` para que cuelgue de `padre`, en el lugar `posicion` entre sus nuevas hermanas (0 = primera). Renumera las
 * hermanas de los dos lugares. Rechaza el ciclo y un padre que no está.
 */
export function mover(paginas: readonly PaginaCopy[], id: string, padre: string | null, posicion: number): ResultadoArbol {
  const p = paginas.find((x) => x.id === id);
  if (!p || p.papelera) return { ok: false, error: 'Ese guion ya no existe.' };
  if (padre) {
    if (!paginas.some((x) => x.id === padre) || escondida(paginas, padre)) return { ok: false, error: 'La página de destino ya no existe.' };
    if (descendientes(paginas, id).has(padre)) return { ok: false, error: 'Un guion no puede ir adentro de sí mismo.' };
    const profundidadAbajo = Math.max(...[...descendientes(paginas, id)].map((d) => rutaDe(paginas, d).length - rutaDe(paginas, id).length + 1));
    if (rutaDe(paginas, padre).length + profundidadAbajo > TOPES.profundidadArbol) return { ok: false, error: 'No se puede anidar más.' };
  }
  const viejas = hijasDe(paginas, p.padre).map((x) => x.id).filter((x) => x !== id);
  const nuevas = hijasDe(paginas, padre).map((x) => x.id).filter((x) => x !== id);
  const en = Math.max(0, Math.min(nuevas.length, Math.round(Number.isFinite(posicion) ? posicion : nuevas.length)));
  nuevas.splice(en, 0, id);
  let out = paginas.map((x) => (x.id === id ? { ...x, padre } : x));
  if (p.padre !== padre) out = renumerar(out, p.padre, viejas);
  out = renumerar(out, padre, nuevas);
  return { ok: true, paginas: out };
}

/** A la Papelera (con lo que cuelga de ella, que deja de verse). */
export function aPapelera(paginas: readonly PaginaCopy[], id: string, ahora: string): ResultadoArbol {
  const p = paginas.find((x) => x.id === id);
  if (!p) return { ok: false, error: 'Ese guion ya no existe.' };
  if (p.papelera) return { ok: true, paginas: [...paginas] };
  return { ok: true, paginas: paginas.map((x) => (x.id === id ? { ...x, papelera: ahora } : x)) };
}

/** Restaura: vuelve a su lugar, o a la raíz si su lugar ya no se dibuja; al final de sus hermanas. */
export function restaurar(paginas: readonly PaginaCopy[], id: string): ResultadoArbol {
  const p = paginas.find((x) => x.id === id);
  if (!p) return { ok: false, error: 'Ese guion ya no existe.' };
  const sinMarca = paginas.map((x) => {
    if (x.id !== id) return x;
    const { papelera: _fuera, ...resto } = x;
    return resto;
  });
  const padre = p.padre && !escondida(sinMarca, p.padre) ? p.padre : null;
  const hermanas = hijasDe(sinMarca, padre).map((x) => x.id).filter((x) => x !== id);
  hermanas.push(id);
  return { ok: true, paginas: renumerar(sinMarca.map((x) => (x.id === id ? { ...x, padre } : x)), padre, hermanas) };
}

/** Las páginas de la Papelera, la última que entró primero (las que cuelgan de otra de la Papelera no se listan). */
export function dePapelera(paginas: readonly PaginaCopy[]): PaginaCopy[] {
  return paginas.filter((p) => p.papelera && !(p.padre && escondida(paginas, p.padre)))
    .sort((a, b) => String(b.papelera).localeCompare(String(a.papelera)));
}

/** Cambia título, emoji o tipo de una página. */
export function cambiarPagina(paginas: readonly PaginaCopy[], id: string, c: Partial<Pick<PaginaCopy, 'titulo' | 'emoji' | 'tipo' | 'actualizado'>>): ResultadoArbol {
  if (!paginas.some((x) => x.id === id)) return { ok: false, error: 'Ese guion ya no existe.' };
  return {
    ok: true,
    paginas: paginas.map((x) => {
      if (x.id !== id) return x;
      const titulo = c.titulo != null ? c.titulo.replace(/\s+/g, ' ').trim().slice(0, TOPES.titulo) || SIN_TITULO : x.titulo;
      return { ...x, ...c, titulo };
    }),
  };
}

/** Las páginas vivas en el orden del árbol (cada una seguida de las suyas), con su nivel. */
export function enOrdenDeArbol(paginas: readonly PaginaCopy[]): { p: PaginaCopy; nivel: number; padre: PaginaCopy | null }[] {
  return arbolCon(paginas, hijasDe);
}

/**
 * Lo mismo, con la última editada ARRIBA entre hermanas (12/11/2026, en producción: «Mis guiones» del teléfono y la «←» de
 * escritorio iban de la más vieja a la más nueva, y el guion recién hecho quedaba al fondo). Las de una página, debajo de ella.
 */
export function enOrdenReciente(paginas: readonly PaginaCopy[]): { p: PaginaCopy; nivel: number; padre: PaginaCopy | null }[] {
  return arbolCon(paginas, (ps, padre) => hijasDe(ps, padre).sort((a, b) => (b.actualizado > a.actualizado ? 1 : b.actualizado < a.actualizado ? -1 : 0)));
}

function arbolCon(paginas: readonly PaginaCopy[], hijas: (ps: readonly PaginaCopy[], padre: string | null) => PaginaCopy[]): { p: PaginaCopy; nivel: number; padre: PaginaCopy | null }[] {
  const out: { p: PaginaCopy; nivel: number; padre: PaginaCopy | null }[] = [];
  const bajar = (padre: PaginaCopy | null, nivel: number) => {
    for (const p of hijas(paginas, padre?.id ?? null)) {
      out.push({ p, nivel, padre });
      if (nivel < TOPES.profundidadArbol) bajar(p, nivel + 1);
    }
  };
  bajar(null, 0);
  return out;
}

/** Un id de página nuevo («g» + 10). */
export function idPaginaNuevo(): string {
  let s = '';
  while (s.length < 10) s += Math.random().toString(36).slice(2);
  return `g${s.slice(0, 10)}`;
}
