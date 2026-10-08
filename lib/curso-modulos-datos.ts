import 'server-only';

// =============================================================================
// curso-modulos-datos — leer y escribir los MÓDULOS del curso, sus candados y lo que se abre a mano
// =============================================================================
// Lo puro (qué módulos hay, en qué orden, cómo se reordena el kanban, qué se le abre a un alumno)
// vive en lib/curso-modulos.ts y lib/curso-bloqueo.ts, con test. Acá está lo que toca la base. Las
// decisiones, en docs/diseno-curso-skool.md (D1 y D2).
//
// ⚠️ NADA DE ACÁ PREGUNTA QUIÉN LLAMA: eso lo hacen las server actions
// (app/customer-success/curso/modulos-actions.ts: admin del workspace y producto propio). Acá se
// valida LO QUE SE ESCRIBE, contra la base.
//
// ⚠️ LAS ESCRITURAS LEEN LA ENTREGA ESTRICTA (`entregaDeProductoEstricta`). Escriben la lista ENTERA
// de etapas del kanban (`guardarEtapasEntrega`), así que armarla desde las etapas DE FÁBRICA de una
// lectura caída borraría las reales. Sin poder leer, no se escribe nada (AGENTS.md, «una lectura que
// cae al DEFAULT sirve para dibujar, nunca para DECIDIR»). Y las fases van siempre en la misma
// llamada: sin ellas se les borra el color a las columnas.
//
// ⚠️ DESVINCULAR Y VINCULAR NO SON ATÓMICOS: son varias escrituras (la fila del suelto, las clases, la
// portada, los desbloqueos, los permisos, el kanban) y PostgREST no tiene transacción. El orden está
// elegido para que un corte a mitad deje el curso VISIBLE (lo peor sería que las clases queden
// colgando de una clave que ya no es de ningún módulo: desaparecen del portal), y el error dice qué
// faltó. Ver cada función.

import { getTenantDb, getWorkspaceActual } from './workspace';
import { leerTodo } from './supabase-paginado';
import { entregaDeProducto, entregaDeProductoEstricta, guardarEtapasEntrega } from './entrega-servicio';
import { esModuloDelCurso, type EntregaConfig, type EtapaEntrega } from './servicio-etapas';
import {
  derivarModulos, planReorden, planConEtapaNueva, planConEtapaDevuelta, etapaDeModulo, nuevaClaveSuelto, nombreDeModulo, anclasDe,
  decidirQuitarEtapa, CLAVE_MODULO_RE,
  type FilaModulo, type ModuloCurso, type PreguntaDestino, type DestinoClientes,
} from './curso-modulos';
import { moverClienteDeEtapa, POR_PERSONA } from './cs-mover-etapa';
import {
  saneaBloqueo, bloqueoPermitido, contextoNecesario, contextoDeFechas,
  type Bloqueo, type ContextoBloqueo, type Desbloqueo,
} from './curso-bloqueo';
import type { Clase } from './curso';

export type ResultadoModulos<T extends object = object> = ({ ok: true; modulos: ModuloCurso[] } & T) | { ok: false; error: string };

const msg = (e: unknown, def: string) => (e instanceof Error && e.message ? e.message : def);

type FilaBD = { id: number; producto_id: number; clave: string; vinculado: boolean; nombre: string | null; despues_de: string | null; bloqueo: unknown };
const COLS_MODULO = 'id, producto_id, clave, vinculado, nombre, despues_de, bloqueo';
const aFila = (f: FilaBD): FilaModulo => ({
  id: Number(f.id), clave: f.clave, vinculado: f.vinculado === true, nombre: f.nombre ?? null, despuesDe: f.despues_de ?? null, bloqueo: f.bloqueo,
});

// ── Leer ──────────────────────────────────────────────────────────────────────

/**
 * Las filas de `curso_modulos` de varios productos: productoId → filas. Tira si no puede leer:
 * «no pude leer» no es «no hay sueltos» (las clases de un suelto quedarían colgando de nada).
 */
export async function filasDeModulos(productoIds: readonly number[]): Promise<Map<number, FilaModulo[]>> {
  const out = new Map<number, FilaModulo[]>(productoIds.map((id) => [id, []]));
  if (!productoIds.length) return out;
  const db = await getTenantDb();
  // ⚠️ SIN LO QUE ESTÁ EN LA PAPELERA (mig 0223): un módulo borrado no existe para nadie más que para
  // su «Deshacer» y para `clavesUsadas`, que lee aparte.
  const filas = await leerTodo<FilaBD>(db, 'curso_modulos', COLS_MODULO, { filtros: (q) => q.in('producto_id', [...productoIds]).is('borrado_at', null), orden: 'id' });
  for (const f of filas) out.get(Number(f.producto_id))?.push(aFila(f));
  return out;
}

/**
 * Los módulos del curso de un producto, y la entrega de la que salen.
 *
 *   · `estricta`: para DECIDIR (validar una clave, aplicar un candado, escribir). `null` = no se
 *     pudieron leer las etapas o los módulos: quien llama no decide nada.
 *   · sin `estricta`: para DIBUJAR. Una entrega caída cae a las etapas de fábrica (lo de siempre al
 *     dibujar), y unos módulos sueltos que no se pudieron leer, a ninguno (con un aviso en el log).
 */
export async function modulosDelCurso(productoId: number, opts: { estricta: true }): Promise<{ modulos: ModuloCurso[]; entrega: EntregaConfig; filas: FilaModulo[] } | null>;
export async function modulosDelCurso(productoId: number, opts?: { estricta?: false }): Promise<{ modulos: ModuloCurso[]; entrega: EntregaConfig; filas: FilaModulo[] }>;
export async function modulosDelCurso(productoId: number, opts: { estricta?: boolean } = {}): Promise<{ modulos: ModuloCurso[]; entrega: EntregaConfig; filas: FilaModulo[] } | null> {
  if (opts.estricta) {
    const [entrega, filas] = await Promise.all([
      entregaDeProductoEstricta(productoId),
      filasDeModulos([productoId]).then((m) => m.get(productoId) ?? [], () => null),
    ]);
    if (!entrega || !filas) return null;
    return { modulos: derivarModulos(entrega.etapas, filas), entrega, filas };
  }
  const [entrega, filas] = await Promise.all([
    entregaDeProducto(productoId),
    filasDeModulos([productoId]).then((m) => m.get(productoId) ?? [], (e) => {
      console.warn(`[curso-modulos] no pude leer los módulos sueltos del producto ${productoId}:`, msg(e, ''));
      return [] as FilaModulo[];
    }),
  ]);
  return { modulos: derivarModulos(entrega.etapas, filas), entrega, filas };
}

/**
 * Las claves que NO se pueden usar para un módulo o una etapa nueva: las de la entrega, las de los
 * módulos, las que nombran las clases (aunque su módulo se haya borrado) y las del kanban de los
 * clientes (aunque la etapa se haya borrado). Es la regla de `nuevaClaveEtapa`: una clave reusada
 * haría reaparecer adentro de lo nuevo lo que apuntaba a lo viejo — clientes en una columna a la que
 * nadie los movió, clases huérfanas en un módulo que no es el suyo.
 *
 * ⚠️ LAS DOS LECTURAS TIRAN si no pueden (revisión del 08/10/2026). Era `clientesEnEntrega`, que con
 * la consulta caída devuelve `[]` —lo correcto para dibujar un tablero—, y acá eso DECIDE: sin las
 * claves de los clientes, una etapa nueva «Bonus» podía llevarse la clave `bonus` de una borrada y
 * sentar adentro a los clientes que quedaron con esa fila. Sin poder leer, no se crea nada.
 */
async function clavesUsadas(productoId: number, entrega: EntregaConfig, filas: readonly FilaModulo[]): Promise<string[]> {
  const db = await getTenantDb();
  // ⚠️ CON LO QUE ESTÁ EN LA PAPELERA, a propósito (mig 0223; excepción nombrada en
  // tests/curso-papelera.test.ts): una clase o un módulo borrados siguen nombrando su clave hasta la
  // purga, y su «Deshacer» los devuelve CON ella. Una clave reusada en el medio metería la clase
  // devuelta adentro del módulo nuevo.
  const [clases, clientes, modulos] = await Promise.all([
    leerTodo<{ id: number; etapa: string }>(db, 'curso_clases', 'id, etapa', { filtros: (q) => q.eq('producto_id', productoId), orden: 'id' }),
    leerTodo<{ id: number; etapa: string }>(db, 'cliente_entrega', 'id, etapa', { filtros: (q) => q.eq('producto_id', productoId), orden: 'id' }),
    leerTodo<{ id: number; clave: string }>(db, 'curso_modulos', 'id, clave', { filtros: (q) => q.eq('producto_id', productoId), orden: 'id' }),
  ]);
  return [...new Set([
    ...entrega.etapas.map((e) => e.key), ...filas.map((f) => f.clave),
    ...clases.map((c) => c.etapa), ...clientes.map((c) => c.etapa), ...modulos.map((m) => m.clave),
  ])];
}

// ── Escribir: las piezas ─────────────────────────────────────────────────────

/** Escribe las anclas que CAMBIARON. Una por fila: son los sueltos de UN curso (un puñado). */
async function guardarAnclas(productoId: number, filas: readonly FilaModulo[], anclas: ReadonlyArray<{ clave: string; despuesDe: string | null }>): Promise<void> {
  const db = await getTenantDb();
  const antes = new Map(filas.filter((f) => !f.vinculado).map((f) => [f.clave, f.despuesDe]));
  const ahora = new Date().toISOString();
  for (const a of anclas) {
    if (!antes.has(a.clave) || antes.get(a.clave) === a.despuesDe) continue;
    const { error } = await db.from('curso_modulos').update({ despues_de: a.despuesDe, updated_at: ahora })
      .eq('producto_id', productoId).eq('clave', a.clave).eq('vinculado', false);
    if (error) throw new Error(error.message);
  }
}

/**
 * Le cambia la CLAVE a un módulo en todo lo que lo nombra: sus clases, su portada, lo que se le abrió
 * a mano a cada alumno, las notas del equipo, los eventos de la comunidad «con este módulo» y los
 * permisos de cada alumno. Es lo que hace que desvincular o vincular un módulo no le cambie a nadie
 * lo que ve.
 *
 * ⚠️ LOS PERMISOS SE REESCRIBEN, NO SE DEJAN: un alumno con «Elegir módulos» tiene la clave VIEJA en
 * su lista, y la clave vieja ya no es de ningún módulo — sin esto, perdía el módulo sin que nadie lo
 * decidiera (la regla de lib/curso-alcance.ts: un producto restringido ve SÓLO lo listado).
 */
/** Una fila de `curso_accesos` con sus permisos (un tipo con nombre: el guard de las consultas a la
 *  tabla, tests/curso-accesos-area.test.ts, lee la sentencia hasta el primer `;`). */
type AccesoConAlcance = { id: number; alcance: unknown };

async function reclavear(productoId: number, vieja: string, nueva: string): Promise<void> {
  const db = await getTenantDb();
  const ahora = new Date().toISOString();
  // ⚠️ TAMBIÉN las de la papelera (mig 0223; excepción nombrada en tests/curso-papelera.test.ts): una
  // clase borrada de este módulo que se devuelve con «Deshacer» tiene que volver a SU módulo, que ahora
  // tiene esta clave. Sin ella, volvería a «Sin módulo».
  const r1 = await db.from('curso_clases').update({ etapa: nueva, updated_at: ahora }).eq('producto_id', productoId).eq('etapa', vieja);
  if (r1.error) throw new Error(`las clases: ${r1.error.message}`);
  const r2 = await db.from('curso_estilo').update({ clave: `portada:etapa:${nueva}`, updated_at: ahora })
    .eq('producto_id', productoId).eq('clave', `portada:etapa:${vieja}`);
  if (r2.error) throw new Error(`la portada: ${r2.error.message}`);
  const r3 = await db.from('curso_desbloqueos').update({ clave: nueva })
    .eq('producto_id', productoId).eq('objeto', 'modulo').eq('clave', vieja);
  if (r3.error) throw new Error(`lo abierto a mano: ${r3.error.message}`);
  const r4 = await db.from('curso_clase_notas').update({ etapa: nueva }).eq('producto_id', productoId).eq('etapa', vieja);
  if (r4.error) throw new Error(`las notas: ${r4.error.message}`);
  const r5 = await db.from('comunidad_eventos').update({ acceso: { tipo: 'modulo', clave: nueva } })
    .eq('producto_id', productoId).eq('acceso->>tipo', 'modulo').eq('acceso->>clave', vieja);
  if (r5.error) throw new Error(`los eventos de la comunidad: ${r5.error.message}`);
  // Sólo las filas DEL CLIENTE (`area is null`): el líder de un área no tiene permisos propios, usa los
  // de su cliente (lib/curso-datos.ts, `resolverAccesoPortal`).
  const accesos = await leerTodo<AccesoConAlcance>(db, 'curso_accesos', 'id, alcance',
    { filtros: (q) => q.is('area', null).not('alcance', 'is', null), orden: 'id' });
  const k = String(productoId);
  for (const a of accesos) {
    const al = a.alcance as { modulos?: Record<string, unknown> } | null;
    const lista = al?.modulos && Object.prototype.hasOwnProperty.call(al.modulos, k) ? al.modulos[k] : null;
    if (!Array.isArray(lista) || !lista.includes(vieja)) continue;
    const modulos = { ...al!.modulos, [k]: lista.map((x) => (x === vieja ? nueva : x)) };
    const { error } = await db.from('curso_accesos').update({ alcance: { ...al, modulos } }).eq('id', a.id);
    if (error) throw new Error(`los permisos: ${error.message}`);
  }
}

/** El curso, releído después de escribir: la pantalla dibuja ESTO, no lo que pidió. */
async function releer(productoId: number): Promise<ModuloCurso[]> {
  return (await modulosDelCurso(productoId)).modulos;
}

// ── Escribir: lo que hace el editor ───────────────────────────────────────────

/**
 * Crea un módulo DESPUÉS de `despuesDe` (null = al principio). Vinculado (el default de D1) agrega una
 * etapa al kanban en su lugar (`etapaNuevaEn`); suelto, una fila con su ancla.
 *
 * ⚠️ UN VINCULADO NO PUEDE IR ANTES DE LA PRIMERA ETAPA del kanban (`ERROR_PRIMERA`): «al principio»
 * de un curso cuya primera etapa es módulo se rechaza, y la pantalla lo ofrece suelto o más abajo.
 */
export async function crearModulo(productoId: number, raw: { nombre?: unknown; vinculado?: unknown; despuesDe?: unknown }): Promise<ResultadoModulos<{ clave: string }>> {
  try {
    const n = nombreDeModulo(raw?.nombre);
    if (!n.ok) return n;
    const vinculado = raw?.vinculado !== false;
    const despuesDe = raw?.despuesDe == null ? null : String(raw.despuesDe);
    const cur = await modulosDelCurso(productoId, { estricta: true });
    if (!cur) return { ok: false, error: 'No pude leer los módulos. Intenta de nuevo.' };
    const claves = cur.modulos.map((m) => m.clave);
    if (despuesDe != null && !claves.includes(despuesDe)) return { ok: false, error: 'Ese módulo ya no existe.' };
    const i = despuesDe == null ? 0 : claves.indexOf(despuesDe) + 1;
    const usadas = await clavesUsadas(productoId, cur.entrega, cur.filas);
    const esVinc = new Map(cur.modulos.map((m) => [m.clave, m.vinculado]));

    if (!vinculado) {
      const clave = nuevaClaveSuelto(usadas);
      const deseado = [...claves.slice(0, i), clave, ...claves.slice(i)];
      const anclas = anclasDe(deseado, (k) => k === clave || esVinc.get(k) === false);
      const db = await getTenantDb();
      const { error } = await db.from('curso_modulos').insert([{
        producto_id: productoId, clave, vinculado: false, nombre: n.nombre, despues_de: anclas.find((a) => a.clave === clave)?.despuesDe ?? null,
      }]);
      if (error) return { ok: false, error: error.message };
      await guardarAnclas(productoId, cur.filas, anclas);
      return { ok: true, clave, modulos: await releer(productoId) };
    }

    const etapa = etapaDeModulo(n.nombre, usadas, cur.entrega.etapas.length);
    const deseado = [...claves.slice(0, i), etapa.key, ...claves.slice(i)];
    // La primera se compara contra el kanban de ANTES: «al principio» no puede ganarle a la entrada.
    const plan = planConEtapaNueva(cur.entrega, cur.modulos, deseado, etapa);
    if (!plan.ok) return plan;
    if (!(await guardarEtapasEntrega(productoId, plan.etapas, plan.fases))) return { ok: false, error: 'No se pudo guardar la etapa.' };
    await guardarAnclas(productoId, cur.filas, plan.anclas);
    return { ok: true, clave: etapa.key, modulos: await releer(productoId) };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo crear el módulo.') };
  }
}

/**
 * Renombra un módulo. Vinculado: RENOMBRA LA ETAPA DEL KANBAN (es la misma cosa: pedido de Martín, «que
 * se editen en las etapas del kanban»), con la entrega ESTRICTA y sus fases. Suelto: su fila.
 */
export async function renombrarModulo(productoId: number, clave: string, raw: unknown): Promise<ResultadoModulos<{ nombre: string }>> {
  try {
    const n = nombreDeModulo(raw);
    if (!n.ok) return n;
    const cur = await modulosDelCurso(productoId, { estricta: true });
    if (!cur) return { ok: false, error: 'No pude leer los módulos. Intenta de nuevo.' };
    const m = cur.modulos.find((x) => x.clave === clave);
    if (!m) return { ok: false, error: 'Ese módulo ya no existe.' };
    if (m.vinculado) {
      const cfg = cur.entrega;
      const etapas = cfg.etapas.map((e) => (e.key === clave ? { ...e, label: n.nombre } : e));
      if (!(await guardarEtapasEntrega(productoId, etapas, cfg.fases))) return { ok: false, error: 'No se pudo guardar.' };
    } else {
      const db = await getTenantDb();
      const { error } = await db.from('curso_modulos').update({ nombre: n.nombre, updated_at: new Date().toISOString() })
        .eq('producto_id', productoId).eq('clave', clave).eq('vinculado', false);
      if (error) return { ok: false, error: error.message };
    }
    return { ok: true, nombre: n.nombre, modulos: await releer(productoId) };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo renombrar.') };
  }
}

/**
 * Reordena los módulos (el arrastre del editor): `claves` es la lista ENTERA en el orden nuevo. Los
 * vinculados reordenan el KANBAN (con sus fases y sin tocar la primera etapa: `planReorden`) y los
 * sueltos guardan su ancla nueva. Devuelve los módulos como QUEDARON: si el kanban agrupó por fases
 * distinto de lo pedido, la pantalla dibuja eso.
 */
export async function reordenarModulos(productoId: number, claves: unknown): Promise<ResultadoModulos> {
  try {
    if (!Array.isArray(claves) || claves.some((k) => typeof k !== 'string')) return { ok: false, error: 'El orden no se entiende.' };
    const cur = await modulosDelCurso(productoId, { estricta: true });
    if (!cur) return { ok: false, error: 'No pude leer los módulos. Intenta de nuevo.' };
    const plan = planReorden(cur.entrega, cur.modulos, claves as string[]);
    if (!plan.ok) return plan;
    if (plan.cambiaEntrega && !(await guardarEtapasEntrega(productoId, plan.etapas, plan.fases))) return { ok: false, error: 'No se pudo guardar el orden.' };
    await guardarAnclas(productoId, cur.filas, plan.anclas);
    return { ok: true, modulos: await releer(productoId) };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo ordenar.') };
  }
}

// ── Quitar una etapa del kanban desde el curso (08/10/2026, item 15) ─────────

/** Una etapa que se quitó del kanban: cómo era, dónde estaba y a cuántos clientes se mudó. */
export type EtapaQuitada = { etapa: EtapaEntrega; indice: number; movidos: number };

/**
 * Lo que contesta quitar una etapa: lo de siempre, o la PREGUNTA de a dónde van sus clientes
 * (`pregunta`, ver `decidirQuitarEtapa`). Una pregunta no es un error: la pantalla abre el diálogo y
 * vuelve a llamar con el destino.
 */
export type ResultadoQuitar<T extends object = object> = ResultadoModulos<T> | { ok: false; error: string; pregunta?: PreguntaDestino };

/** Los clientes con fila en esta etapa del kanban. TIRA si no puede leer: decide a quién se mueve. */
async function clientesDeLaEtapa(productoId: number, clave: string): Promise<number[]> {
  const db = await getTenantDb();
  const filas = await leerTodo<{ id: number; lead_id: number }>(db, 'cliente_entrega', 'id, lead_id',
    { filtros: (q) => q.eq('producto_id', productoId).eq('etapa', clave), orden: 'id' });
  return [...new Set(filas.map((f) => Number(f.lead_id)))];
}

/**
 * Muda a los clientes de una etapa que se quita a `destino` por el choke point de siempre
 * (`moverClienteDeEtapa`), SIN MENSAJES (`silencioso`): deja la línea del historial, cierra lo agendado
 * de la etapa que se va y bloquea las secuencias de la nueva (con el WhatsApp del ws1 prendido, un
 * «¡llegaste a Hito 2!» saldría por algo que no le pasó a nadie). Devuelve los que NO se movieron.
 */
async function moverClientesEnSilencio(productoId: number, leads: readonly number[], destino: string, por: string): Promise<number[]> {
  const fallidos: number[] = [];
  for (const leadId of leads) {
    const r = await moverClienteDeEtapa({ leadId, productoId, etapa: destino, por, silencioso: true });
    if (!r.ok) fallidos.push(leadId);
  }
  return fallidos;
}

const noSeMovieron = (n: number) => `No pude mover ${n} ${n === 1 ? 'cliente' : 'clientes'}. Intenta de nuevo.`;

/**
 * Lo que la pantalla necesita para PREGUNTAR antes de «Eliminar módulo» (la confirmación dice cuántas
 * clases y cuántos clientes, corto): cuántos clientes hay en su etapa y a dónde pueden ir. No escribe
 * nada. Un suelto no tiene clientes; la entrada del kanban contesta su motivo (no se elimina).
 */
export async function previaDeQuitar(productoId: number, clave: string): Promise<{ ok: true; clientes: number; destinos: DestinoClientes[] } | { ok: false; error: string }> {
  try {
    const cur = await modulosDelCurso(productoId, { estricta: true });
    if (!cur) return { ok: false, error: 'No pude leer los módulos. Intenta de nuevo.' };
    const m = cur.modulos.find((x) => x.clave === clave);
    if (!m) return { ok: false, error: 'Ese módulo ya no existe.' };
    if (!m.vinculado) return { ok: true, clientes: 0, destinos: [] };
    const leads = await clientesDeLaEtapa(productoId, clave);
    const d = decidirQuitarEtapa(cur.entrega, clave, leads.length, null);
    if (d.ok) return { ok: true, clientes: 0, destinos: [] };
    if (!d.pregunta) return { ok: false, error: d.error };
    return { ok: true, clientes: d.pregunta.clientes, destinos: d.pregunta.destinos };
  } catch (e) {
    return { ok: false, error: msg(e, 'No pude contar sus clientes.') };
  }
}

/**
 * ELIMINAR UN MÓDULO (08/10/2026, item 15: «en módulo falta la opción de eliminar módulo, si se
 * elimina, se elimina también la etapa»). Va a la PAPELERA (mig 0223): sus clases quedan con
 * `borrada_at` y la fila del módulo con `borrado_at`, invisibles para todo lo demás, y el «Deshacer»
 * de 5 segundos (`restaurarModulo`) los devuelve con la MISMA identidad —el avance de cada alumno, sus
 * entregas y su portada siguen ahí—. La purga los borra de verdad después (lib/curso-papelera.ts).
 *
 * Un VINCULADO es además una columna del kanban: se QUITA (`decidirQuitarEtapa`: la entrada no, y con
 * clientes adentro primero se pregunta a dónde van y se los muda SIN mensajes). Un suelto no mueve a
 * nadie.
 *
 * ⚠️ EL ORDEN DEJA EL CURSO VISIBLE si algo se corta a mitad: primero los clientes (si uno no se
 *    mueve, no se toca nada más), después el módulo (la etapa o la fila del suelto), y recién al final
 *    sus clases. Cortado antes de las clases, quedan en «Sin módulo» —se ven y se mueven—, nunca
 *    escondidas debajo de un módulo vivo.
 * ⚠️ LO QUE ESTABA ANCLADO A ÉL se engancha a lo que venía antes (como siempre), y el «Deshacer» lo
 *    vuelve a su lugar con el orden de antes.
 */
export async function borrarModulo(
  productoId: number,
  clave: string,
  opts: { destino?: string | null; por?: string } = {},
): Promise<ResultadoQuitar<{ clases: number[]; movidos: number; quitada: EtapaQuitada | null }>> {
  try {
    const cur = await modulosDelCurso(productoId, { estricta: true });
    if (!cur) return { ok: false, error: 'No pude leer los módulos. Intenta de nuevo.' };
    const m = cur.modulos.find((x) => x.clave === clave);
    if (!m) return { ok: false, error: 'Ese módulo ya no existe.' };
    const db = await getTenantDb();
    // Las clases VIVAS del módulo: las que ya estaban en la papelera se quedan donde estaban (tienen su
    // propio «Deshacer», o ya se les venció).
    const vivas = await leerTodo<{ id: number }>(db, 'curso_clases', 'id',
      { filtros: (q) => q.eq('producto_id', productoId).eq('etapa', clave).is('borrada_at', null), orden: 'id' });
    const ids = vivas.map((c) => Number(c.id));
    const ahora = new Date().toISOString();
    let quitada: EtapaQuitada | null = null;

    if (m.vinculado) {
      const leads = await clientesDeLaEtapa(productoId, clave);
      const d = decidirQuitarEtapa(cur.entrega, clave, leads.length, opts.destino);
      if (!d.ok) return d;
      if (leads.length) {
        const no = await moverClientesEnSilencio(productoId, leads, d.destino!, opts.por ?? POR_PERSONA);
        if (no.length) return { ok: false, error: noSeMovieron(no.length) };
      }
      if (!(await guardarEtapasEntrega(productoId, d.etapas, d.fases))) return { ok: false, error: 'No se pudo quitar la etapa. Intenta de nuevo.' };
      quitada = { etapa: d.etapa, indice: d.indice, movidos: leads.length };
      // Su candado (la fila de un vinculado existe sólo para eso), a la papelera con él: el «Deshacer»
      // lo devuelve junto con la etapa. Best-effort: sin la etapa, una fila de más no abre ni dibuja nada.
      const { error: eFila } = await db.from('curso_modulos').update({ borrado_at: ahora, updated_at: ahora })
        .eq('producto_id', productoId).eq('clave', clave).eq('vinculado', true).is('borrado_at', null);
      if (eFila) console.warn('[curso-modulos] se quitó la etapa y su candado no fue a la papelera:', eFila.message);
    } else {
      const { error } = await db.from('curso_modulos').update({ borrado_at: ahora, updated_at: ahora })
        .eq('producto_id', productoId).eq('clave', clave).eq('vinculado', false).is('borrado_at', null);
      if (error) return { ok: false, error: error.message };
    }

    const deseado = cur.modulos.map((x) => x.clave).filter((k) => k !== clave);
    const esVinc = new Map(cur.modulos.map((x) => [x.clave, x.vinculado]));
    await guardarAnclas(productoId, cur.filas, anclasDe(deseado, (k) => esVinc.get(k) === false));

    if (ids.length) {
      const { error } = await db.from('curso_clases').update({ borrada_at: ahora, updated_at: ahora })
        .in('id', ids).eq('producto_id', productoId).is('borrada_at', null);
      if (error) return { ok: false, error: `Se borró el módulo y sus clases quedaron en «Sin módulo». ${error.message}` };
    }
    return { ok: true, modulos: await releer(productoId), clases: ids, movidos: quitada?.movidos ?? 0, quitada };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo borrar el módulo.') };
  }
}

/**
 * El «DESHACER» DE «Eliminar módulo»: devuelve el MISMO módulo —la fila del suelto, o la etapa en su
 * lugar del kanban con su clave, su color y su fase—, sus clases de la papelera (las que se borraron
 * con él, por id: no las que ya estaban borradas de antes), y el orden de antes (`orden`, la lista de
 * módulos como estaba).
 *
 * ⚠️ LA ETAPA SE DEVUELVE SÓLO SI NO TENÍA CLIENTES (la pantalla no lo ofrece de otro modo): a los
 *    que se mudaron no se los vuelve a mover — sería un segundo movimiento silencioso de N personas
 *    con su reloj de etapa arrancando hoy. Por eso, con clientes, «Eliminar módulo» no ofrece deshacer.
 * ⚠️ LO QUE MANDA EL NAVEGADOR SE VALIDA: la clave con su forma, la etapa con esa MISMA clave (y la
 *    sanea `guardarEtapasEntrega`), los ids como enteros, y sólo se tocan filas de este producto, de
 *    esta clave y que estén en la papelera.
 */
export async function restaurarModulo(
  productoId: number,
  raw: { clave?: unknown; clases?: unknown; orden?: unknown; quitada?: { etapa?: unknown; indice?: unknown } | null },
): Promise<ResultadoModulos<{ clases: Clase[] }>> {
  try {
    const clave = String(raw?.clave ?? '');
    if (!CLAVE_MODULO_RE.test(clave)) return { ok: false, error: 'No se entiende qué devolver.' };
    const ids = Array.isArray(raw?.clases) ? [...new Set(raw.clases.map(Number))].filter((n) => Number.isInteger(n) && n > 0).slice(0, 1000) : [];
    const orden = Array.isArray(raw?.orden) ? raw.orden.filter((k): k is string => typeof k === 'string') : [];
    const etapaRaw = raw?.quitada?.etapa as EtapaEntrega | undefined;
    if (raw?.quitada && (!etapaRaw || etapaRaw.key !== clave)) return { ok: false, error: 'No se entiende qué devolver.' };
    const cur = await modulosDelCurso(productoId, { estricta: true });
    if (!cur) return { ok: false, error: 'No pude leer los módulos. Intenta de nuevo.' };
    const db = await getTenantDb();
    const ahora = new Date().toISOString();

    if (etapaRaw && !cur.entrega.etapas.some((e) => e.key === clave)) {
      const largo = cur.entrega.etapas.length;
      const i = Math.max(1, Math.min(Number(raw.quitada?.indice) || largo, largo));
      const etapas = [...cur.entrega.etapas.slice(0, i), etapaRaw, ...cur.entrega.etapas.slice(i)];
      if (!(await guardarEtapasEntrega(productoId, etapas, cur.entrega.fases))) return { ok: false, error: 'No se pudo devolver la etapa.' };
    }
    const { error: eFila } = await db.from('curso_modulos').update({ borrado_at: null, updated_at: ahora })
      .eq('producto_id', productoId).eq('clave', clave).not('borrado_at', 'is', null);
    if (eFila) return { ok: false, error: eFila.message };

    let clases: Clase[] = [];
    if (ids.length) {
      const { COLUMNAS_CLASE, aClase } = await import('./curso-datos');
      const { data, error } = await db.from('curso_clases').update({ borrada_at: null, updated_at: ahora })
        .in('id', ids).eq('producto_id', productoId).eq('etapa', clave).not('borrada_at', 'is', null).select(COLUMNAS_CLASE);
      if (error) return { ok: false, error: error.message };
      clases = ((data ?? []) as Parameters<typeof aClase>[0][]).map(aClase);
    }

    // El orden de antes: lo que estaba anclado a él vuelve detrás de él. Sólo si la lista es la MISMA
    // (si alguien creó o borró otro módulo en el medio, se deja como quedó).
    const despues = await modulosDelCurso(productoId, { estricta: true });
    if (despues && orden.length === despues.modulos.length && despues.modulos.every((m) => orden.includes(m.clave))) {
      const plan = planReorden(despues.entrega, despues.modulos, orden);
      if (plan.ok) {
        if (plan.cambiaEntrega) await guardarEtapasEntrega(productoId, plan.etapas, plan.fases);
        await guardarAnclas(productoId, despues.filas, plan.anclas);
      }
    }
    return { ok: true, modulos: await releer(productoId), clases };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo devolver el módulo.') };
  }
}

/**
 * EL INTERRUPTOR «Etapa del kanban» de un módulo (`vincular`).
 *
 * APAGARLO QUITA LA ETAPA DEL KANBAN (cambió de sentido el 08/10/2026, item 15: «si se desactiva se
 * elimina esa etapa del kanban, y si hay leads debería preguntar a dónde los mueve»). Hasta entonces
 * la etapa quedaba en el kanban con `enCurso: false` y los clientes no se movían. Ahora:
 *   · la ENTRADA del kanban no se quita (`ERROR_ENTRADA`);
 *   · con clientes adentro y sin `destino`, PREGUNTA (`pregunta`) y no escribe nada;
 *   · con destino, los muda SIN MENSAJES (`moverClientesEnSilencio`) antes que nada;
 *   · nace un suelto con clave NUEVA en el mismo lugar, sus clases y todo lo que nombraba al módulo
 *     pasan a esa clave (`reclavear`), y la etapa sale del kanban con las fases intactas.
 * Su candado pasa al suelto salvo `etapa` (un suelto no es una etapa): ése vuelve al de un suelto.
 *
 * PRENDERLO crea la etapa en su lugar (`etapaNuevaEn`: la regla de la primera etapa vale) y re-clavea
 * al revés; su candado pasa a la etapa. Con `devolver` (el «Deshacer» de haberlo apagado) es la MISMA
 * etapa en el MISMO lugar (`planConEtapaDevuelta`), si su clave sigue libre.
 *
 * ⚠️ EL ORDEN DE LAS ESCRITURAS ES EL QUE DEJA EL CURSO VISIBLE si algo se corta a mitad: los clientes
 * primero, después nace el módulo nuevo (la fila del suelto, o la etapa), se mudan las clases, y recién
 * al final se apaga el viejo. Cortado en el medio queda un módulo de más (vacío, o con las clases),
 * nunca clases colgando de una clave que no es de ningún módulo.
 */
export async function vincularModulo(
  productoId: number,
  clave: string,
  vincular: boolean,
  opts: { destino?: string | null; por?: string; devolver?: { etapa: EtapaEntrega; indice: number } | null } = {},
): Promise<ResultadoQuitar<{ clave: string; quitada?: EtapaQuitada }>> {
  try {
    const cur = await modulosDelCurso(productoId, { estricta: true });
    if (!cur) return { ok: false, error: 'No pude leer los módulos. Intenta de nuevo.' };
    const m = cur.modulos.find((x) => x.clave === clave);
    if (!m) return { ok: false, error: 'Ese módulo ya no existe.' };
    if (m.vinculado === vincular) return { ok: true, clave, modulos: cur.modulos };
    const db = await getTenantDb();
    const claves = cur.modulos.map((x) => x.clave);
    const esVinc = new Map(cur.modulos.map((x) => [x.clave, x.vinculado]));
    const ahora = new Date().toISOString();

    if (!vincular) {
      const leads = await clientesDeLaEtapa(productoId, clave);
      const d = decidirQuitarEtapa(cur.entrega, clave, leads.length, opts.destino);
      if (!d.ok) return d;
      if (leads.length) {
        const no = await moverClientesEnSilencio(productoId, leads, d.destino!, opts.por ?? POR_PERSONA);
        if (no.length) return { ok: false, error: noSeMovieron(no.length) };
      }
      const usadas = await clavesUsadas(productoId, cur.entrega, cur.filas);
      const nueva = nuevaClaveSuelto(usadas);
      const deseado = claves.map((k) => (k === clave ? nueva : k));
      esVinc.set(nueva, false);
      const anclas = anclasDe(deseado, (k) => esVinc.get(k) === false);
      const candado = m.bloqueo && m.bloqueo.tipo !== 'etapa' ? m.bloqueo : null;
      const ins = await db.from('curso_modulos').insert([{
        producto_id: productoId, clave: nueva, vinculado: false, nombre: m.nombre,
        despues_de: anclas.find((a) => a.clave === nueva)?.despuesDe ?? null, bloqueo: candado,
      }]);
      if (ins.error) return { ok: false, error: ins.error.message };
      await reclavear(productoId, clave, nueva);
      if (!(await guardarEtapasEntrega(productoId, d.etapas, d.fases))) {
        return { ok: false, error: 'Se movieron las clases y la etapa no se pudo quitar. Intenta de nuevo.' };
      }
      await guardarAnclas(productoId, cur.filas, anclas);
      await db.from('curso_modulos').delete().eq('producto_id', productoId).eq('clave', clave).eq('vinculado', true);
      return { ok: true, clave: nueva, modulos: await releer(productoId), quitada: { etapa: d.etapa, indice: d.indice, movidos: leads.length } };
    }

    const usadas = await clavesUsadas(productoId, cur.entrega, cur.filas);
    const previa = opts.devolver?.etapa;
    // El «Deshacer» devuelve la MISMA clave si sigue libre; si no (alguien la tomó en el medio), una
    // nueva, como cualquier vincular.
    const devuelta = previa && CLAVE_MODULO_RE.test(previa.key) && !usadas.includes(previa.key) ? { ...previa, label: m.nombre } : null;
    const etapa = devuelta ?? etapaDeModulo(m.nombre, usadas, cur.entrega.etapas.length);
    const deseado = claves.map((k) => (k === clave ? etapa.key : k));
    // Los módulos de hoy SIN el suelto que se vincula (su clave vieja ya no está en `deseado`).
    const sinEl = cur.modulos.filter((x) => x.clave !== clave);
    const plan = devuelta
      ? planConEtapaDevuelta(cur.entrega, sinEl, deseado, etapa, Number(opts.devolver?.indice))
      : planConEtapaNueva(cur.entrega, sinEl, deseado, etapa);
    if (!plan.ok) return plan;
    if (!(await guardarEtapasEntrega(productoId, plan.etapas, plan.fases))) return { ok: false, error: 'No se pudo crear la etapa.' };
    await reclavear(productoId, clave, etapa.key);
    if (m.bloqueo) {
      // `borrado_at: null`: si quedó en la papelera una fila con esta clave, el candado nuevo la revive.
      const up = await db.from('curso_modulos').upsert([{ producto_id: productoId, clave: etapa.key, vinculado: true, nombre: null, despues_de: null, bloqueo: m.bloqueo, borrado_at: null, updated_at: ahora }],
        { onConflict: 'workspace_id,producto_id,clave' });
      if (up.error) console.warn('[curso-modulos] se vinculó y no se pudo pasar su candado:', up.error.message);
    }
    await guardarAnclas(productoId, cur.filas, plan.anclas);
    await db.from('curso_modulos').delete().eq('producto_id', productoId).eq('clave', clave).eq('vinculado', false);
    return { ok: true, clave: etapa.key, modulos: await releer(productoId) };
  } catch (e) {
    return { ok: false, error: msg(e, vincular ? 'No se pudo vincular.' : 'No se pudo quitar la etapa.') };
  }
}

/** A qué se le pone un candado. */
export type ObjetivoBloqueo = { modulo: string } | { clase: number };

/**
 * Guarda el candado de un módulo o de una clase (`null` = el default: un vinculado espera a su
 * etapa, un suelto está abierto, una clase hereda de su módulo).
 *
 * ⚠️ LO QUE LLEGA DEL NAVEGADOR SE SANEA ACÁ, y uno que no se entiende se RECHAZA en vez de guardarse
 * como `null`: `null` es una decisión (el default), y un candado roto convertido en default le
 * abriría a todos algo que se quiso cerrar.
 *
 * ⚠️ `tarea` APUNTA A UNA CLASE DE ESTE PRODUCTO, y no a una del mismo módulo cuando el candado es del
 * módulo: el módulo cerrado no deja completar sus clases, así que esperaría para siempre.
 */
export async function guardarBloqueo(productoId: number, objetivo: ObjetivoBloqueo, raw: unknown): Promise<ResultadoModulos<{ clase?: Clase }>> {
  try {
    const b: Bloqueo | null = raw == null ? null : saneaBloqueo(raw);
    if (raw != null && !b) return { ok: false, error: 'Ese candado no se entiende.' };
    const db = await getTenantDb();
    const cur = await modulosDelCurso(productoId, { estricta: true });
    if (!cur) return { ok: false, error: 'No pude leer los módulos. Intenta de nuevo.' };
    const ahora = new Date().toISOString();
    const claseDelProducto = async (id: number): Promise<{ id: number; etapa: string } | null> => {
      // Sin las de la papelera (mig 0223): una clase borrada no existe para un candado.
      const { data, error } = await db.from('curso_clases').select('id, etapa').eq('id', id).eq('producto_id', productoId).is('borrada_at', null).maybeSingle();
      if (error) throw new Error(error.message);
      return (data as { id: number; etapa: string } | null) ?? null;
    };

    if ('modulo' in objetivo) {
      const m = cur.modulos.find((x) => x.clave === objetivo.modulo);
      if (!m) return { ok: false, error: 'Ese módulo ya no existe.' };
      const no = bloqueoPermitido(m.vinculado ? 'vinculado' : 'suelto', b);
      if (no) return { ok: false, error: no };
      if (b?.tipo === 'tarea') {
        const otra = await claseDelProducto(b.claseId);
        if (!otra) return { ok: false, error: 'Esa clase ya no existe.' };
        if (otra.etapa === m.clave) return { ok: false, error: 'Un módulo no puede esperar a una clase suya.' };
      }
      if (m.vinculado) {
        // La fila de un vinculado existe SÓLO para guardar su candado: sin candado, se borra.
        const r = b
          ? await db.from('curso_modulos').upsert([{ producto_id: productoId, clave: m.clave, vinculado: true, nombre: null, despues_de: null, bloqueo: b, borrado_at: null, updated_at: ahora }],
            { onConflict: 'workspace_id,producto_id,clave' })
          : await db.from('curso_modulos').delete().eq('producto_id', productoId).eq('clave', m.clave).eq('vinculado', true);
        if (r.error) return { ok: false, error: r.error.message };
      } else {
        const { error } = await db.from('curso_modulos').update({ bloqueo: b, updated_at: ahora })
          .eq('producto_id', productoId).eq('clave', m.clave).eq('vinculado', false);
        if (error) return { ok: false, error: error.message };
      }
      return { ok: true, modulos: await releer(productoId) };
    }

    const id = Number(objetivo.clase);
    if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Esa clase ya no existe.' };
    const propia = await claseDelProducto(id);
    if (!propia) return { ok: false, error: 'Esa clase ya no existe.' };
    const no = bloqueoPermitido('clase', b, { claseId: id });
    if (no) return { ok: false, error: no };
    if (b?.tipo === 'tarea' && !(await claseDelProducto(b.claseId))) return { ok: false, error: 'Esa clase ya no existe.' };
    const { COLUMNAS_CLASE, aClase } = await import('./curso-datos');
    const { data, error } = await db.from('curso_clases').update({ bloqueo: b, updated_at: ahora })
      .eq('id', id).eq('producto_id', productoId).is('borrada_at', null).select(COLUMNAS_CLASE).single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, modulos: cur.modulos, clase: aClase(data as Parameters<typeof aClase>[0]) };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo guardar el candado.') };
  }
}

// ── Lo que se le abre a UN alumno ─────────────────────────────────────────────

/**
 * Lo que la evaluación de los candados necesita de UN alumno y no sale del curso
 * (lib/curso-bloqueo.ts, `ContextoBloqueo`): lo que el equipo le abrió a mano, las fechas en la zona
 * del negocio y su nivel en la comunidad. Lo llaman las dos mitades de la ÚNICA puerta del portal
 * (lib/curso-portal.ts: `armarVistaAlumno` y `claseDelAlumno`) y la ficha del cliente.
 *
 * ⚠️ LO CARO SE LEE SÓLO SI ALGÚN CANDADO LO NECESITA (`contextoNecesario`): la zona del negocio, el
 * día en que se le abrió el curso y sus puntos de la comunidad. La ruta del progreso pasa por acá cada
 * ~10 s por video abierto, y un curso sin `dias`, `fecha` ni `nivel` no paga ninguna de las tres.
 *
 * ⚠️ NO PODER LEER ES CERRADO: sin lo abierto a mano, sin la zona o sin su nivel, se evalúa como si
 * no hubiera (lo cerrado sigue cerrado esa vez), con un aviso en el log. Nunca abre de más por un error.
 *
 * ⚠️ Corre adentro del workspace del alumno (`runWithWorkspace(firma.ws, …)` en el portal).
 */
export async function contextoDelAlumno(p: {
  leadId: number;
  productoId: number;
  casa: number | null;
  modulos: readonly Pick<ModuloCurso, 'bloqueo'>[];
  clases: readonly Pick<Clase, 'bloqueo'>[];
  /** El instante de la evaluación (los tests lo fijan). Default: ahora. */
  ahora?: Date;
}): Promise<ContextoBloqueo> {
  const necesita = contextoNecesario([...p.modulos.map((m) => m.bloqueo), ...p.clases.map((c) => c.bloqueo ?? null)]);
  const [desbloqueos, fechas, nivel] = await Promise.all([
    import('./curso-datos').then((d) => d.desbloqueosDe(p.leadId, p.productoId)).catch((e): Desbloqueo[] => {
      console.warn(`[curso-bloqueo] no pude leer lo abierto a mano del lead ${p.leadId}:`, msg(e, ''));
      return [];
    }),
    necesita.fechas ? fechasDelAlumno(p.leadId, p.productoId, p.casa, necesita.inicio, p.ahora ?? new Date()) : Promise.resolve(null),
    necesita.nivel ? nivelDelAlumno(p.leadId, p.productoId) : Promise.resolve(null),
  ]);
  return { desbloqueos, fechas, nivel };
}

/** Hoy y el día uno del alumno, en la zona del negocio. `null` = no se pudo (cerrado esa vez). */
async function fechasDelAlumno(leadId: number, productoId: number, casa: number | null, conInicio: boolean, ahora: Date) {
  try {
    const ws = await getWorkspaceActual();
    if (!ws) return null;
    const [{ tzDeWorkspace }, datos] = await Promise.all([import('./timezone'), import('./curso-datos')]);
    const [tz, desde] = await Promise.all([tzDeWorkspace(ws), conInicio ? datos.abiertoDesdeDe(leadId, productoId, casa) : Promise.resolve(null)]);
    return contextoDeFechas(ahora, desde, tz);
  } catch (e) {
    console.warn(`[curso-bloqueo] no pude calcular las fechas del lead ${leadId}:`, msg(e, ''));
    return null;
  }
}

/** Su nivel en la comunidad del producto. `null` = no se pudo leer (cerrado esa vez, no «nivel 1»). */
async function nivelDelAlumno(leadId: number, productoId: number): Promise<number | null> {
  try {
    const [{ puntosDeLead }, { nivelDe }] = await Promise.all([import('./comunidad-datos'), import('./comunidad-niveles')]);
    return nivelDe(await puntosDeLead(productoId, leadId));
  } catch (e) {
    console.warn(`[curso-bloqueo] no pude leer el nivel del lead ${leadId}:`, msg(e, ''));
    return null;
  }
}

/** ¿Esta clave tiene la forma de una clave de módulo? Para lo que llega del navegador. */
export const claveDeModuloValida = (k: unknown): k is string => typeof k === 'string' && CLAVE_MODULO_RE.test(k);

/** ¿Este módulo es un VINCULADO del curso? (para el avance automático y los mensajes por etapa). */
export const esVinculado = (etapas: readonly EtapaEntrega[], clave: string): boolean =>
  etapas.some((e) => e.key === clave && esModuloDelCurso(e));
