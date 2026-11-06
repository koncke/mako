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
    //
    // ⚠️ PERO ANTES DE BORRAR SE VUELVE A LEER EL ÍNDICE (6/11/2026, B7). `cambiarIndice` devuelve `!ok` por dos
    // motivos que no se parecen: el árbol rechazó el cambio (422) o nadie ganó el compare-and-set (409) —ahí la fila
    // NO está—, pero también `falla(500, …)` cuando `cambiarSettingSi` **TIRA**. Un timeout cuya escritura sí llegó
    // deja la fila puesta, y borrar el documento ahí produce justo lo que el encabezado de este archivo manda evitar:
    // una página que abre «no existe», sobre un texto que el cliente acaba de escribir y que se guardó bien.
    // Un rollback se dispara con «la operación no dejó rastro», nunca con «la operación falló».
    //   · la fila está → la creación SALIÓ: se devuelve ok con el índice real;
    //   · la fila no está → se borra el huérfano, como antes;
    //   · no se pudo releer → NO se borra. Un documento huérfano no lo ve nadie; uno borrado no vuelve.
    const despues = await leerIndiceCrudo().then((x) => x.paginas).catch(() => null);
    const puesta = despues?.find((x) => x.id === id);
    if (puesta && despues) return { ok: true, pagina: puesta, doc, paginas: despues };
    if (despues) await borrarSettingSi(claveDoc(id), valorDoc).catch(() => false);
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
 * Crea VARIAS páginas de una vez (la mudanza de lo de antes, D14) con ids ESTABLES que elige quien llama (los de la mudanza
 * salen del guion de origen, lib/copywriter/mudanza-reglas.ts → `idDeMudanza`). Así, repetirla NO duplica:
 *   · una página cuyo id ya está en el índice se saltea (ya se creó en una corrida anterior);
 *   · un documento que ya existe sin su fila es de una corrida cortada: se ADOPTA (nadie lo pudo editar: sin fila no se ve);
 *   · NO se borra nada si el índice falla. Verificación del Cerebro de 544991179 (ALTA): con la respuesta del índice perdida
 *     (llegó a la base, el pedido «falló»), borrar los documentos dejaba 6 de 7 páginas abriendo «No existe». El documento
 *     sin fila queda hasta el reintento, que lo adopta.
 * Las hijas van debajo de su padre (`padreId`); si el padre no está todavía, la hija espera al reintento (no va a la raíz).
 * Devuelve cuántas creó y cuántas FALTAN (un documento que no se pudo escribir, o una hija sin su padre): con alguna, quien
 * llama no da la tanda por terminada. Las que el árbol no acepta (el tope, un padre en la Papelera) no se reintentan.
 */
export async function crearVarias(ps: readonly (PedidoCrear & { id: string; padreId: string | null })[]): Promise<{ ok: true; creadas: number; faltan: number } | Falla> {
  let yaEstan: Set<string>;
  try { yaEstan = new Set((await leerIndiceCrudo()).paginas.map((p) => p.id)); } catch (e) { return falla(500, e instanceof Error ? e.message : 'No pude leer la lista de guiones.'); }
  const listos: { p: (typeof ps)[number]; valor: string }[] = [];
  for (const p of ps) {
    if (!esIdPagina(p.id) || yaEstan.has(p.id)) continue;
    const s = sanearContenido(p.contenido ?? docVacio());
    if (!s.ok) { console.warn('[copywriter] una página de la mudanza no pasa el saneo y no se crea:', s.error); continue; }
    const props = sanearProps({ ...propsNuevas(p.tipo), ...(p.props ?? {}), tipo: p.tipo }, p.tipo);
    listos.push({ p, valor: JSON.stringify({ version: 1, props, contenido: s.doc } satisfies DocCopy) });
  }
  // El documento primero (de a 6 a la vez). `false` = ya existía: de una corrida cortada, se adopta. Lo que tira no se sabe
  // si llegó: esa página falta y el reintento la encuentra (escrita, se adopta; si no, se escribe).
  const escritos: typeof listos = [];
  let noEscritos = 0;
  for (let i = 0; i < listos.length; i += 6) {
    const tanda = listos.slice(i, i + 6);
    const r = await Promise.allSettled(tanda.map((x) => cambiarSettingSi(claveDoc(x.p.id), null, x.valor)));
    r.forEach((y, k) => { if (y.status === 'fulfilled') escritos.push(tanda[k]); else noEscritos += 1; });
  }
  if (noEscritos) console.warn(`[copywriter] la mudanza no pudo escribir ${noEscritos} documento(s): se reintenta en la próxima apertura`);
  const ahora = new Date().toISOString();
  let agregadas = 0;
  let sinPadre = 0;
  const r = await cambiarIndice((paginas) => {
    // Pura y repetible: cambiarIndice la vuelve a correr si otra pestaña escribió el índice en el medio.
    agregadas = 0;
    sinPadre = 0;
    let actual = [...paginas];
    for (const x of escritos) {
      if (actual.some((q) => q.id === x.p.id)) continue;
      const padre = x.p.padreId;
      if (padre && !actual.some((q) => q.id === padre)) { sinPadre += 1; continue; }
      const a = agregar(actual, {
        id: x.p.id, titulo: (x.p.titulo ?? '').replace(/\s+/g, ' ').trim().slice(0, TOPES.titulo) || SIN_TITULO,
        emoji: typeof x.p.emoji === 'string' && x.p.emoji.trim() && x.p.emoji.length <= 16 ? x.p.emoji : null,
        tipo: x.p.tipo, padre, actualizado: ahora,
      }, padre ? undefined : 0);
      if (!a.ok) continue;
      actual = a.paginas;
      agregadas += 1;
    }
    return { ok: true, paginas: actual };
  });
  if (!r.ok) return r;
  return { ok: true, creadas: agregadas, faltan: noEscritos + sinPadre };
}
