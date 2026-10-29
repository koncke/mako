// =============================================================================
// copywriter/server — leer y escribir los guiones del negocio (app_settings, compare-and-set)
// =============================================================================
// Diseño: docs/diseno-copywriter.md (D4). Dos lugares por negocio, los dos en `app_settings` (como los guiones del Ads
// Writer en `mako.razones`; no hay migración):
//   · `mako.copywriter.indice` — el árbol (lib/copywriter/arbol.ts);
//   · `mako.copywriter.doc.<id>` — el documento de cada guion (props + contenido + version).
//
// LAS DOS ESCRITURAS SON COMPARE-AND-SET (`cambiarSettingSi`, lib/settings.ts):
//   · el ÍNDICE se lee, se cambia con una función pura y se escribe SÓLO si nadie lo cambió en el medio; si alguien
//     lo hizo, se vuelve a leer y a aplicar (hasta 4 veces). Dos pestañas que crean un guion a la vez no se pisan.
//   · el DOCUMENTO exige la `version` que se abrió. Si otro guardó en el medio, 409: la pantalla ofrece recargar y
//     nunca pisa en silencio (el molde es el del Web Generator, lib/editor-landing/server.ts).
// ⚠️ UN GUION Y SU ÍNDICE SON VALORES LARGOS (un YouTube de 10 minutos, ~15 KB; 100 guiones, ~20 KB). `cambiarSettingSi`
//    ponía el valor entero en la URL del PATCH y desde ~6-8 KB PostgREST no la acepta: hasta el 28/10/2026, desde ~900
//    palabras un guion no se guardaba MÁS y desde ~40 guiones el árbol se congelaba (verificación del Cerebro). Desde ese
//    día `cambiarSettingSi` compara un valor largo en el server y filtra por `updated_at` (lib/settings-cas.ts), para todos
//    los que lo llaman; tests/copywriter-guardar.test.ts lo fija con un guion de 20 KB y 70 guiones.
// El negocio es el de la pestaña (`getWorkspaceActual`, adentro de settings.ts); nunca se lee `?ws=` acá.
// El orden al CREAR: primero el documento, después la fila del índice. Si lo segundo falla queda un documento sin
// página, que nadie ve (y no rompe nada); al revés quedaría una página que abre «no existe».
// =============================================================================

import 'server-only';
import { borrarSettingSi, cambiarSettingSi, getSettingEstricto } from '../settings';
import {
  CLAVE_INDICE, SIN_TITULO, claveDoc, esIdPagina, propsNuevas, sanearProps, TOPES,
  type DocCopy, type EditadoPor, type GuionAbierto, type JsonNodo, type PaginaCopy, type PropsGuion, type TipoGuion,
} from './tipos';
import { sanearContenido, docVacio } from './doc';
import { sanearEditado } from './editado';
import { agregar, aPapelera, cambiarPagina, idPaginaNuevo, mover as moverEnArbol, restaurar as restaurarEnArbol, sanearIndice, type ResultadoArbol } from './arbol';

export type Falla = { ok: false; error: string; status: 400 | 404 | 409 | 422 | 500 };
const falla = (status: Falla['status'], error: string): Falla => ({ ok: false, error, status });

/** El índice tal como está en la base: el texto crudo (para el compare-and-set) y las páginas saneadas. */
async function leerIndiceCrudo(): Promise<{ crudo: string | null; paginas: PaginaCopy[] }> {
  const crudo = await getSettingEstricto(CLAVE_INDICE);
  if (!crudo) return { crudo, paginas: [] };
  try {
    return { crudo, paginas: sanearIndice(JSON.parse(crudo)) };
  } catch {
    // Un índice que no se puede leer NO es «no hay guiones»: escribir encima lo borraría. Se dice.
    throw new Error('No pude leer la lista de guiones.');
  }
}

/** Las páginas del negocio (todas, también las de la Papelera: la pantalla decide qué dibuja). */
export async function listar(): Promise<{ ok: true; paginas: PaginaCopy[] } | Falla> {
  try {
    return { ok: true, paginas: (await leerIndiceCrudo()).paginas };
  } catch (e) {
    return falla(500, e instanceof Error ? e.message : 'No pude leer la lista de guiones.');
  }
}

/** Cambia el índice con `f` y lo escribe si nadie lo cambió en el medio (hasta 4 intentos). */
async function cambiarIndice(f: (paginas: PaginaCopy[]) => ResultadoArbol): Promise<{ ok: true; paginas: PaginaCopy[] } | Falla> {
  for (let intento = 0; intento < 4; intento++) {
    let leido: { crudo: string | null; paginas: PaginaCopy[] };
    try { leido = await leerIndiceCrudo(); } catch (e) { return falla(500, e instanceof Error ? e.message : 'No pude leer la lista de guiones.'); }
    const r = f(leido.paginas);
    if (!r.ok) return falla(422, r.error);
    const nuevo = JSON.stringify(r.paginas);
    if (nuevo === leido.crudo) return { ok: true, paginas: r.paginas };
    let gano: boolean;
    try { gano = await cambiarSettingSi(CLAVE_INDICE, leido.crudo, nuevo); } catch (e) { return falla(500, e instanceof Error ? e.message : 'No pude guardar la lista de guiones.'); }
    if (gano) return { ok: true, paginas: r.paginas };
  }
  return falla(409, 'Otra pestaña está cambiando la lista de guiones. Vuelve a intentar.');
}

/** El documento tal como está en la base. null = no existe. */
async function leerDoc(id: string): Promise<{ crudo: string; doc: DocCopy } | null> {
  const crudo = await getSettingEstricto(claveDoc(id));
  if (!crudo) return null;
  let o: Record<string, unknown>;
  try { o = JSON.parse(crudo) as Record<string, unknown>; } catch { throw new Error('No pude leer este guion.'); }
  const s = sanearContenido(o.contenido);
  return {
    crudo,
    doc: {
      version: Number.isInteger(o.version) && (o.version as number) >= 1 ? (o.version as number) : 1,
      props: sanearProps(o.props),
      contenido: s.ok ? s.doc : docVacio(),
      editado: sanearEditado(o.editado),
    },
  };
}

/** Abre un guion: su página y su documento. 404 si no existe en ESTE negocio (o está en la Papelera y no se pide). */
export async function abrir(id: string): Promise<({ ok: true } & GuionAbierto) | Falla> {
  if (!esIdPagina(id)) return falla(404, 'No existe');
  try {
    const [{ paginas }, leido] = await Promise.all([leerIndiceCrudo(), leerDoc(id)]);
    const pagina = paginas.find((p) => p.id === id);
    if (!pagina || !leido) return falla(404, 'No existe');
    return { ok: true, pagina, doc: leido.doc };
  } catch (e) {
    return falla(500, e instanceof Error ? e.message : 'No pude abrir el guion.');
  }
}

export type PedidoCrear = {
  titulo?: string;
  tipo: TipoGuion;
  padre?: string | null;
  posicion?: number;
  props?: Partial<PropsGuion>;
  contenido?: JsonNodo;
  emoji?: string | null;
};

/** Crea un guion: el documento primero, la página después (ver la cabecera). Devuelve lo abierto. */
export async function crear(p: PedidoCrear): Promise<({ ok: true; paginas: PaginaCopy[] } & GuionAbierto) | Falla> {
  const s = sanearContenido(p.contenido ?? docVacio());
  if (!s.ok) return falla(422, s.error);
  const props = sanearProps({ ...propsNuevas(p.tipo), ...(p.props ?? {}), tipo: p.tipo }, p.tipo);
  const id = idPaginaNuevo();
  const doc: DocCopy = { version: 1, props, contenido: s.doc };
  const valorDoc = JSON.stringify(doc);
  try {
    if (!(await cambiarSettingSi(claveDoc(id), null, valorDoc))) return falla(409, 'Vuelve a intentar.');
  } catch (e) {
    return falla(500, e instanceof Error ? e.message : 'No pude crear el guion.');
  }
  const ahora = new Date().toISOString();
  const nueva: Omit<PaginaCopy, 'orden'> = {
    id, titulo: (p.titulo ?? '').replace(/\s+/g, ' ').trim().slice(0, TOPES.titulo) || SIN_TITULO,
    emoji: typeof p.emoji === 'string' && p.emoji.trim() && p.emoji.length <= 16 ? p.emoji : null,
    tipo: p.tipo, padre: esIdPagina(p.padre) ? p.padre : null, actualizado: ahora,
  };
  const r = await cambiarIndice((ps) => agregar(ps, nueva, p.posicion));
  if (!r.ok) {
    // Sin su fila en el índice el documento no lo ve nadie: se borra (verificación del Cerebro: quedaba uno huérfano por
    // cada «crear» fallido). ⚠️ `borrarSettingSi` pone el valor en la URL: un documento de más de ~6 KB queda igual.
    await borrarSettingSi(claveDoc(id), valorDoc).catch(() => false);
    return r;
  }
  const pagina = r.paginas.find((x) => x.id === id)!;
  return { ok: true, pagina, doc, paginas: r.paginas };
}

export type PedidoGuardar = { id: string; version: number; contenido?: unknown; props?: unknown };

/**
 * Guarda el documento si la versión es la que se abrió. Devuelve la versión nueva. 409 = otro guardó en el medio (la
 * pantalla ofrece recargar). Lo que no vino (contenido o props) queda como estaba.
 *
 * `autor` es la marca de quién guardó (D9): el usuario de la sesión desde la pantalla, quien entró con un link
 * compartido desde /api/compartido/guion. Sin `autor` (la API de MaKo), la marca de antes queda como estaba.
 */
export async function guardar(p: PedidoGuardar, autor?: Omit<EditadoPor, 'at'>): Promise<{ ok: true; version: number; actualizado: string; editado: EditadoPor | null } | Falla> {
  if (!esIdPagina(p.id)) return falla(404, 'No existe');
  let leido: Awaited<ReturnType<typeof leerDoc>>;
  try { leido = await leerDoc(p.id); } catch (e) { return falla(500, e instanceof Error ? e.message : 'No pude leer este guion.'); }
  if (!leido) return falla(404, 'No existe');
  if (leido.doc.version !== p.version) return falla(409, 'Este guion cambió en otra pestaña. Recarga para ver lo último.');
  let contenido = leido.doc.contenido;
  if (p.contenido !== undefined) {
    const s = sanearContenido(p.contenido);
    if (!s.ok) return falla(422, s.error);
    contenido = s.doc;
  }
  const props = p.props !== undefined ? sanearProps(p.props, leido.doc.props.tipo) : leido.doc.props;
  const editado = autor ? { ...autor, at: new Date().toISOString() } : leido.doc.editado ?? null;
  const nuevo: DocCopy = { version: leido.doc.version + 1, props, contenido, ...(editado ? { editado } : {}) };
  try {
    if (!(await cambiarSettingSi(claveDoc(p.id), leido.crudo, JSON.stringify(nuevo)))) {
      return falla(409, 'Este guion cambió en otra pestaña. Recarga para ver lo último.');
    }
  } catch (e) {
    return falla(500, e instanceof Error ? e.message : 'No pude guardar el guion.');
  }
  // La fecha (y el tipo, que el árbol dibuja con su emoji) van al índice. Si eso falla, lo guardado sigue guardado.
  const actualizado = new Date().toISOString();
  await cambiarIndice((ps) => cambiarPagina(ps, p.id, { actualizado, tipo: props.tipo }));
  return { ok: true, version: nuevo.version, actualizado, editado };
}

/** Título y emoji (la página). */
export async function renombrar(id: string, c: { titulo?: string; emoji?: string | null }) {
  if (!esIdPagina(id)) return falla(404, 'No existe');
  const cambio: { titulo?: string; emoji?: string | null; actualizado: string } = { actualizado: new Date().toISOString() };
  if (typeof c.titulo === 'string') cambio.titulo = c.titulo;
  if (c.emoji === null || (typeof c.emoji === 'string' && c.emoji.trim() && c.emoji.length <= 16)) cambio.emoji = c.emoji;
  return cambiarIndice((ps) => cambiarPagina(ps, id, cambio));
}

export async function mover(id: string, padre: string | null, posicion: number) {
  if (!esIdPagina(id) || (padre != null && !esIdPagina(padre))) return falla(404, 'No existe');
  return cambiarIndice((ps) => moverEnArbol(ps, id, padre, posicion));
}

export async function papelera(id: string) {
  if (!esIdPagina(id)) return falla(404, 'No existe');
  return cambiarIndice((ps) => aPapelera(ps, id, new Date().toISOString()));
}

export async function restaurar(id: string) {
  if (!esIdPagina(id)) return falla(404, 'No existe');
  return cambiarIndice((ps) => restaurarEnArbol(ps, id));
}

/**
 * Crea VARIAS páginas de una vez (la mudanza de lo de antes, D14): cada documento con su compare-and-set (de a 6 a la vez)
 * y el índice en UNA escritura, con las hijas debajo de su padre por `clave`. Si el índice no se pudo escribir, los
 * documentos quedan sin fila (como en `crear`) y se intenta borrarlos.
 */
export async function crearVarias(ps: readonly (PedidoCrear & { clave: string; padreClave: string | null })[]): Promise<{ ok: true; creadas: number } | Falla> {
  const listos: { p: (typeof ps)[number]; id: string; valor: string }[] = [];
  for (const p of ps) {
    const s = sanearContenido(p.contenido ?? docVacio());
    if (!s.ok) continue;
    const props = sanearProps({ ...propsNuevas(p.tipo), ...(p.props ?? {}), tipo: p.tipo }, p.tipo);
    listos.push({ p, id: idPaginaNuevo(), valor: JSON.stringify({ version: 1, props, contenido: s.doc } satisfies DocCopy) });
  }
  const escritos: typeof listos = [];
  for (let i = 0; i < listos.length; i += 6) {
    const tanda = listos.slice(i, i + 6);
    const r = await Promise.allSettled(tanda.map((x) => cambiarSettingSi(claveDoc(x.id), null, x.valor)));
    r.forEach((y, k) => { if (y.status === 'fulfilled' && y.value) escritos.push(tanda[k]); });
  }
  const idDe = new Map(escritos.map((x) => [x.p.clave, x.id]));
  const ahora = new Date().toISOString();
  const r = await cambiarIndice((paginas) => {
    let actual: ResultadoArbol = { ok: true, paginas };
    for (const x of escritos) {
      if (!actual.ok) break;
      const padre = x.p.padreClave ? idDe.get(x.p.padreClave) ?? null : null;
      actual = agregar(actual.paginas, {
        id: x.id, titulo: (x.p.titulo ?? '').replace(/\s+/g, ' ').trim().slice(0, TOPES.titulo) || SIN_TITULO,
        emoji: typeof x.p.emoji === 'string' && x.p.emoji.trim() && x.p.emoji.length <= 16 ? x.p.emoji : null,
        tipo: x.p.tipo, padre, actualizado: ahora,
      }, padre ? undefined : 0);
    }
    return actual;
  });
  if (!r.ok) {
    await Promise.allSettled(escritos.map((x) => borrarSettingSi(claveDoc(x.id), x.valor)));
    return r;
  }
  return { ok: true, creadas: escritos.length };
}
