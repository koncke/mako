import 'server-only';

// =============================================================================
// comunidad-calendario — los eventos de la comunidad de un producto (leer, crear, editar, borrar, .ics)
// =============================================================================
// La regla pura (la serie, sus ocurrencias, el acceso, el .ics) vive en lib/comunidad-eventos.ts y
// tiene test; acá está lo que toca la base. Lo usan la tab del equipo (sus server actions) y la ruta
// del alumno (/api/compartido/comunidad), las dos con un `Actor` ya resuelto (lib/comunidad-datos.ts).
//
// ⚠️ EL WORKSPACE VA A MANO, por la misma puerta que el resto de la comunidad (`de(ws, tabla)`): las
//    tablas de la 0217 no se leen por `getTenantDb` (ver la cabecera de lib/comunidad-datos.ts).
//
// ⚠️ LO CERRADO NO VIAJA: a un alumno que no entra a un evento (nivel, módulo) le llega el título, la
//    hora y el motivo; NO el link de la llamada ni la descripción, y su .ics se rechaza.
//
// «Editar / borrar: este evento · este y los siguientes · todos» (Skool, B.6):
//   · ESTE: la fecha se anota en las `excepciones` de la serie, y (al editar) nace un evento suelto con
//     `serie_de` = la serie y `ocurrencia_fecha` = la fecha que reemplaza.
//   · ESTE Y LOS SIGUIENTES: la serie se PARTE (`partirSerie`): la vieja termina antes y nace una nueva
//     con lo editado, que se lleva las excepciones y los reemplazos de esa fecha en adelante.
//   · TODOS: se edita la fila de la serie. Si la fecha se movió, se mueven con ella las excepciones y
//     los reemplazos (siguen nombrando a la misma ocurrencia).

import { getSupabaseServer } from './supabase';
import { leerTodo } from './supabase-paginado';
import { nivelDe } from './comunidad-niveles';
import { idValido, puedeGestionarEventos } from './comunidad-reglas';
import {
  ocurrencias, indiceDeFecha, partirSerie, partirExcepciones, excepcionesGuardadas, recurrenciaGuardada, accesoGuardado,
  accesoPermite, motivoBloqueo, textoRecurrencia, sanearEvento, leerFecha, fechaTexto, sumarDias, diasEntre, localDe,
  esZonaValida, icsDeOcurrencia, icsDeSerie, nombreDeIcs, rangoDeCalendario, MAX_OCURRENCIAS,
  type SerieEvento, type QuienMira, type AccesoEvento, type Recurrencia, type LugarTipo,
} from './comunidad-eventos';
import { claveDeAvisoDeEvento, AVISO_EVENTO_MS } from './comunidad-notificaciones';
import { moduloPermitido } from './curso-alcance';
import { de, msg, leadDe, contarPuntos, type Actor, type Fila } from './comunidad-datos';
import type { CalendarioVista, EventoVista, OcurrenciaVista, OpcionesEvento, Resultado } from './comunidad-tipos';

// ── Las filas ─────────────────────────────────────────────────────────────────────

const COLS_EVENTO = 'id, titulo, descripcion, inicio, zona, duracion_min, recurrencia, excepciones, serie_de, ocurrencia_fecha, lugar_tipo, lugar, portada, acceso, created_at';
type FilaEvento = {
  id: number; titulo: string; descripcion: string; inicio: string; zona: string; duracion_min: number;
  recurrencia: unknown; excepciones: unknown; serie_de: number | null; ocurrencia_fecha: string | null;
  lugar_tipo: string; lugar: string; portada: string | null; acceso: unknown; created_at: string;
};

/** La serie de una fila: la regla, leída con su propia fecha de inicio (la que valida los días). */
function serieDe(f: FilaEvento): SerieEvento | null {
  const inicioMs = Date.parse(f.inicio);
  if (!Number.isFinite(inicioMs) || !esZonaValida(f.zona)) return null;
  const local = localDe(inicioMs, f.zona);
  return {
    inicioMs, zona: f.zona, duracionMin: Number(f.duracion_min) || 60,
    recurrencia: recurrenciaGuardada(f.recurrencia, local.fecha),
    excepciones: excepcionesGuardadas(f.excepciones),
  };
}

const esSerie = (f: FilaEvento, s: SerieEvento | null) => !!s?.recurrencia && f.ocurrencia_fecha == null;

async function eventosDelProducto(a: Actor, hastaMs?: number): Promise<FilaEvento[]> {
  return leerTodo<FilaEvento>(getSupabaseServer(), 'comunidad_eventos', COLS_EVENTO, {
    orden: 'id', eq: { workspace_id: a.ws, producto_id: a.productoId },
    // Una serie que empieza después del rango no puede tener nada adentro.
    filtros: hastaMs != null ? (q) => q.lte('inicio', new Date(hastaMs).toISOString()) : undefined,
  });
}

async function eventoDe(a: Actor, id: number): Promise<FilaEvento | null> {
  const { data, error } = await de(a.ws, 'comunidad_eventos').select(COLS_EVENTO).eq('producto_id', a.productoId).eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as FilaEvento | null) ?? null;
}

// ── Quién mira: su nivel y sus módulos ───────────────────────────────────────────

/** El acceso de quien mira. El equipo entra a todo; un alumno, por sus puntos y su alcance del curso. */
async function quienMira(a: Actor): Promise<QuienMira> {
  if (a.equipo) return { equipo: true, nivel: 9, tieneModulo: () => true };
  const nivel = nivelDe(await contarPuntos(a.ws, a.productoId, a.clave));
  const alcance = a.alcance ?? null;
  return { equipo: false, nivel, tieneModulo: (clave) => moduloPermitido(alcance, a.productoId, clave) };
}

/**
 * Los módulos del curso de este producto: las etapas del kanban que son módulo (`enCurso !== false`,
 * D1) y los sueltos (`curso_modulos`, mig 0220), EN SU ORDEN. Salen de `modulosDelCurso`
 * (lib/curso-modulos-datos.ts), la misma derivación que usan el curso y el portal: hasta el 08/10/2026
 * acá había una copia que leía la tabla a mano, y una fila que guarda sólo el candado de una etapa
 * sacada del curso aparecía como un módulo «Módulo».
 *
 * ⚠️ PARA DECIDIR VA `{ estricta: true }`, y `null` = NO SE PUDIERON LEER. La lectura tolerante
 *    (`entregaDeProducto`) cae a las etapas DE FÁBRICA cuando la consulta falla: sirve para dibujar
 *    un nombre y es un dato inventado para VALIDAR (AGENTS.md, «una lectura que cae al DEFAULT sirve
 *    para dibujar, nunca para DECIDIR»). Con ella, guardar un evento «con un módulo» con la base
 *    caída rechazaba un módulo real o aceptaba el «onboarding» de fábrica.
 */
async function modulosDelProducto(a: Actor, opts: { estricta?: boolean } = {}): Promise<Array<{ clave: string; nombre: string }> | null> {
  try {
    const { modulosDelCurso } = await import('./curso-modulos-datos');
    if (opts.estricta) {
      const cur = await modulosDelCurso(a.productoId, { estricta: true });
      return cur ? cur.modulos.map((m) => ({ clave: m.clave, nombre: m.nombre })) : null;
    }
    return (await modulosDelCurso(a.productoId)).modulos.map((m) => ({ clave: m.clave, nombre: m.nombre }));
  } catch (e) {
    if (opts.estricta) return null;
    console.warn('[comunidad] no pude leer los módulos del producto:', msg(e, ''));
    return [];
  }
}

// ── Lo que se ve ──────────────────────────────────────────────────────────────────

function vistaDeEvento(f: FilaEvento, s: SerieEvento, quien: QuienMira, modulos: ReadonlyMap<string, string>, a: Actor): EventoVista {
  const acceso = accesoGuardado(f.acceso);
  const entra = accesoPermite(acceso, quien);
  const local = localDe(s.inicioMs, s.zona);
  const editor = puedeGestionarEventos(a);
  return {
    id: Number(f.id),
    titulo: f.titulo,
    // ⚠️ Cerrado: ni la descripción ni el lugar viajan (ver la cabecera).
    descripcion: entra ? f.descripcion : '',
    zona: s.zona,
    duracionMin: s.duracionMin,
    inicio: new Date(s.inicioMs).toISOString(),
    local: { fecha: fechaTexto(local.fecha), hora: `${String(local.h).padStart(2, '0')}:${String(local.min).padStart(2, '0')}` },
    recurrente: !!s.recurrencia,
    textoRecurrencia: textoRecurrencia(s.recurrencia, local.fecha),
    lugarTipo: f.lugar_tipo === 'direccion' ? 'direccion' : 'link',
    lugar: entra ? f.lugar : '',
    portada: f.portada,
    bloqueado: entra ? null : motivoBloqueo(acceso, acceso?.tipo === 'modulo' ? modulos.get(acceso.clave) : null),
    esReemplazo: f.ocurrencia_fecha != null,
    puedoEditar: editor,
    acceso: editor ? acceso ?? { tipo: 'todos' } : null,
    recurrencia: editor ? s.recurrencia : null,
  };
}

/**
 * Los eventos y sus ocurrencias en `[desde, hasta)` (ms). El calendario del mes pide su grilla; la
 * lista de próximos, de ahora a unos meses. Cada ocurrencia nombra su evento; el evento viaja una vez.
 * El rango lo acota `rangoDeCalendario` (lo manda el navegador, también el del alumno).
 */
export async function calendarioComunidad(a: Actor, q: { desde?: unknown; hasta?: unknown }): Promise<CalendarioVista> {
  const { desde, hasta } = rangoDeCalendario(q.desde, q.hasta, Date.now());

  const [filas, quien] = await Promise.all([eventosDelProducto(a, hasta), quienMira(a)]);
  const conModulo = filas.some((f) => (f.acceso as { tipo?: unknown } | null)?.tipo === 'modulo');
  // Para DIBUJAR el motivo («Con el módulo X»): la lectura tolerante alcanza, y sin ella el motivo
  // dice «Con un módulo del curso».
  const modulos = new Map((conModulo ? (await modulosDelProducto(a)) ?? [] : []).map((m) => [m.clave, m.nombre] as const));

  const eventos: EventoVista[] = [];
  const ocs: OcurrenciaVista[] = [];
  for (const f of filas) {
    const s = serieDe(f);
    if (!s) continue;
    const lista = ocurrencias(s, desde, hasta, MAX_OCURRENCIAS);
    if (!lista.length) continue;
    eventos.push(vistaDeEvento(f, s, quien, modulos, a));
    for (const o of lista) ocs.push({ eventoId: Number(f.id), inicio: new Date(o.inicio).toISOString(), fin: new Date(o.fin).toISOString(), fecha: o.fecha });
  }
  ocs.sort((x, y) => (x.inicio < y.inicio ? -1 : x.inicio > y.inicio ? 1 : x.eventoId - y.eventoId));
  return { eventos, ocurrencias: ocs.slice(0, MAX_OCURRENCIAS) };
}

/** Lo que necesita el editor (el equipo): los módulos del curso y la zona por defecto de la comunidad. */
export async function opcionesDeEvento(a: Actor): Promise<Resultado<OpcionesEvento>> {
  try {
    if (!puedeGestionarEventos(a)) return { ok: false, error: 'Solo el equipo arma el calendario.' };
    const [modulos, { data }] = await Promise.all([
      modulosDelProducto(a),
      de(a.ws, 'comunidad_ajustes').select('zona_horaria').eq('producto_id', a.productoId).maybeSingle(),
    ]);
    let zona = (data as { zona_horaria: string | null } | null)?.zona_horaria ?? null;
    if (!zona || !esZonaValida(zona)) {
      const { tzDeWorkspace } = await import('./timezone');
      zona = await tzDeWorkspace(a.ws);
    }
    return { ok: true, modulos: modulos ?? [], zona };
  } catch (e) {
    return { ok: false, error: msg(e, 'No pude preparar el evento.') };
  }
}

// ── Crear y editar ────────────────────────────────────────────────────────────────

export type AlcanceEdicion = 'este' | 'siguientes' | 'todos';
const leerAlcance = (x: unknown): AlcanceEdicion => (x === 'este' || x === 'siguientes' ? x : 'todos');

/** Las columnas de un evento ya validado (sin `producto_id`, que pone quien inserta). */
function columnas(v: { titulo: string; descripcion: string; inicioMs: number; zona: string; duracionMin: number; lugarTipo: LugarTipo; lugar: string; portada: string | null; acceso: AccesoEvento; recurrencia: Recurrencia | null }): Fila {
  return {
    titulo: v.titulo, descripcion: v.descripcion, inicio: new Date(v.inicioMs).toISOString(), zona: v.zona,
    duracion_min: v.duracionMin, lugar_tipo: v.lugarTipo, lugar: v.lugar, portada: v.portada, acceso: v.acceso,
    recurrencia: v.recurrencia, updated_at: new Date().toISOString(),
  };
}

const iguales = (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y);

/**
 * Crea un evento (sin `id`) o edita uno. Con una serie, `alcance` dice qué se edita (`este`,
 * `siguientes`, `todos`) y `ocurrencia` la fecha (local, `YYYY-MM-DD`) de la ocurrencia desde la que
 * se abrió. Sólo el equipo.
 */
export async function guardarEvento(a: Actor, raw: unknown): Promise<Resultado<{ id: number }>> {
  try {
    if (!puedeGestionarEventos(a)) return { ok: false, error: 'Solo el equipo arma el calendario.' };
    const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const id = b.id != null ? idValido(b.id) : null;
    if (b.id != null && !id) return { ok: false, error: 'Ese evento ya no está.' };

    // El módulo de un acceso «con un módulo» tiene que ser de ESTE producto. Se valida con la lectura
    // ESTRICTA: sin poder leer las etapas no se decide nada (ver `modulosDelProducto`).
    const validarModulo = async (acceso: AccesoEvento): Promise<string | null> => {
      if (acceso.tipo !== 'modulo') return null;
      const mods = await modulosDelProducto(a, { estricta: true });
      if (!mods) return 'No pude leer los módulos. Intenta de nuevo.';
      return mods.some((m) => m.clave === acceso.clave) ? null : 'Ese módulo no es de este curso.';
    };

    if (!id) {
      const v = sanearEvento(b);
      if (!v.ok) return v;
      const malModulo = await validarModulo(v.evento.acceso);
      if (malModulo) return { ok: false, error: malModulo };
      const { data, error } = await de(a.ws, 'comunidad_eventos').insert({ ...columnas(v.evento), producto_id: a.productoId, creado_por: a.nombre })
        .select('id').single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, id: Number((data as { id: number }).id) };
    }

    const fila = await eventoDe(a, id);
    const s = fila ? serieDe(fila) : null;
    if (!fila || !s) return { ok: false, error: 'Ese evento ya no está.' };
    const alcance = leerAlcance(b.alcance);

    // Un evento suelto (o una ocurrencia ya movida): se edita entero, sin alcance.
    // ⚠️ UNA OCURRENCIA MOVIDA («editar este evento») NO PUEDE VOLVERSE UNA SERIE: es el reemplazo de
    //    UNA fecha de otra serie (`ocurrencia_fecha`), que la borra con ella («todos»). Guardada con
    //    una recurrencia, se expandía como serie propia y se iba entera al borrar la de origen.
    if (!esSerie(fila, s)) {
      const v = sanearEvento(fila.ocurrencia_fecha != null ? { ...b, recurrencia: null } : b);
      if (!v.ok) return v;
      const malModulo = await validarModulo(v.evento.acceso);
      if (malModulo) return { ok: false, error: malModulo };
      const { error } = await de(a.ws, 'comunidad_eventos').update(columnas(v.evento)).eq('producto_id', a.productoId).eq('id', id);
      if (error) return { ok: false, error: error.message };
      return { ok: true, id };
    }

    const inicioLocal = localDe(s.inicioMs, s.zona).fecha;
    const fechaOc = leerFecha(b.ocurrencia) ?? inicioLocal;
    const indice = indiceDeFecha(s, fechaTexto(fechaOc));
    if (indice == null) return { ok: false, error: 'Esa fecha ya no está en la serie.' };

    // ── ESTE: la fecha sale de la serie y nace un evento suelto que la reemplaza ──
    if (alcance === 'este') {
      const v = sanearEvento({ ...b, recurrencia: null });
      if (!v.ok) return v;
      const malModulo = await validarModulo(v.evento.acceso);
      if (malModulo) return { ok: false, error: malModulo };
      const { data, error } = await de(a.ws, 'comunidad_eventos').insert({
        ...columnas(v.evento), producto_id: a.productoId, creado_por: a.nombre, serie_de: id, ocurrencia_fecha: fechaTexto(fechaOc),
      }).select('id').single();
      if (error) return { ok: false, error: error.message };
      const { error: e2 } = await de(a.ws, 'comunidad_eventos').update({ excepciones: [...s.excepciones, fechaTexto(fechaOc)], updated_at: new Date().toISOString() })
        .eq('producto_id', a.productoId).eq('id', id);
      if (e2) {
        // Sin la excepción la ocurrencia saldría DOS veces (la vieja y la nueva): se deshace la nueva.
        await de(a.ws, 'comunidad_eventos').delete().eq('producto_id', a.productoId).eq('id', Number((data as { id: number }).id));
        return { ok: false, error: e2.message };
      }
      return { ok: true, id: Number((data as { id: number }).id) };
    }

    // ── ESTE Y LOS SIGUIENTES: se parte la serie (salvo en la primera, que es «todos») ──
    if (alcance === 'siguientes' && indice > 0) {
      const corte = partirSerie(s.recurrencia!, fechaOc, indice)!;
      const exc = partirExcepciones(s.excepciones, fechaOc);
      const v0 = sanearEvento(b);
      if (!v0.ok) return v0;
      // «Tras N veces» sin tocar: a la serie nueva le quedan las que faltaban, no N de nuevo.
      const recNueva = v0.evento.recurrencia && iguales(v0.evento.recurrencia.fin, s.recurrencia!.fin)
        ? { ...v0.evento.recurrencia, fin: corte.despues } : v0.evento.recurrencia;
      const v = sanearEvento({ ...b, recurrencia: recNueva });
      if (!v.ok) return v;
      const malModulo = await validarModulo(v.evento.acceso);
      if (malModulo) return { ok: false, error: malModulo };
      const { data, error } = await de(a.ws, 'comunidad_eventos').insert({
        ...columnas(v.evento), producto_id: a.productoId, creado_por: a.nombre, serie_de: id, excepciones: exc.despues,
      }).select('id').single();
      if (error) return { ok: false, error: error.message };
      const nuevo = Number((data as { id: number }).id);
      const { error: e2 } = await de(a.ws, 'comunidad_eventos').update({
        recurrencia: { ...s.recurrencia!, fin: corte.antes }, excepciones: exc.antes, updated_at: new Date().toISOString(),
      }).eq('producto_id', a.productoId).eq('id', id);
      if (e2) {
        await de(a.ws, 'comunidad_eventos').delete().eq('producto_id', a.productoId).eq('id', nuevo);
        return { ok: false, error: e2.message };
      }
      // Las ocurrencias movidas de esa fecha en adelante ahora son de la serie nueva.
      const { error: e3 } = await de(a.ws, 'comunidad_eventos').update({ serie_de: nuevo })
        .eq('producto_id', a.productoId).eq('serie_de', id).gte('ocurrencia_fecha', fechaTexto(fechaOc));
      if (e3) console.warn('[comunidad] no pude mudar los reemplazos a la serie nueva:', e3.message);
      return { ok: true, id: nuevo };
    }

    // ── TODOS: la fila de la serie. Si la fecha se movió, la serie entera se corre lo mismo ──
    const pedida = leerFecha(b.fecha);
    if (!pedida) return { ok: false, error: 'Falta la fecha.' };
    const delta = diasEntre(fechaOc, pedida);
    const nuevaInicio = sumarDias(inicioLocal, delta);
    const v = sanearEvento({ ...b, fecha: fechaTexto(nuevaInicio) });
    if (!v.ok) return v;
    const malModulo = await validarModulo(v.evento.acceso);
    if (malModulo) return { ok: false, error: malModulo };
    const correr = (f: string) => { const x = leerFecha(f); return x ? fechaTexto(sumarDias(x, delta)) : f; };
    const { error } = await de(a.ws, 'comunidad_eventos').update({
      ...columnas(v.evento), excepciones: delta ? s.excepciones.map(correr) : s.excepciones,
    }).eq('producto_id', a.productoId).eq('id', id);
    if (error) return { ok: false, error: error.message };
    if (delta) {
      const { data: reemplazos } = await de(a.ws, 'comunidad_eventos').select('id, ocurrencia_fecha').eq('producto_id', a.productoId).eq('serie_de', id)
        .not('ocurrencia_fecha', 'is', null);
      for (const r of (reemplazos ?? []) as Array<{ id: number; ocurrencia_fecha: string }>) {
        await de(a.ws, 'comunidad_eventos').update({ ocurrencia_fecha: correr(r.ocurrencia_fecha) }).eq('producto_id', a.productoId).eq('id', r.id);
      }
    }
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo guardar el evento.') };
  }
}

// ── Borrar ────────────────────────────────────────────────────────────────────────

/** Borra un evento; con una serie, `alcance` (`este`, `siguientes`, `todos`) desde la `ocurrencia` elegida. */
export async function borrarEvento(a: Actor, raw: unknown): Promise<Resultado> {
  try {
    if (!puedeGestionarEventos(a)) return { ok: false, error: 'Solo el equipo arma el calendario.' };
    const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const id = idValido(b.id);
    const fila = id ? await eventoDe(a, id) : null;
    if (!fila || !id) return { ok: true };
    const s = serieDe(fila);
    const alcance = leerAlcance(b.alcance);
    const borrarTodo = async () => {
      // Con la serie se van sus ocurrencias movidas; una serie nacida de «este y los siguientes» es
      // otra serie y se queda (su `serie_de` pasa a null por la FK).
      const { error: e1 } = await de(a.ws, 'comunidad_eventos').delete().eq('producto_id', a.productoId).eq('serie_de', id).not('ocurrencia_fecha', 'is', null);
      if (e1) return { ok: false as const, error: e1.message };
      const { error } = await de(a.ws, 'comunidad_eventos').delete().eq('producto_id', a.productoId).eq('id', id);
      return error ? { ok: false as const, error: error.message } : { ok: true as const };
    };
    if (!s || !esSerie(fila, s) || alcance === 'todos') return await borrarTodo();

    const fecha = leerFecha(b.ocurrencia);
    const indice = fecha ? indiceDeFecha(s, fechaTexto(fecha)) : null;
    if (!fecha || indice == null) return { ok: false, error: 'Esa fecha ya no está en la serie.' };
    if (alcance === 'este') {
      const { error } = await de(a.ws, 'comunidad_eventos').update({ excepciones: [...s.excepciones, fechaTexto(fecha)], updated_at: new Date().toISOString() })
        .eq('producto_id', a.productoId).eq('id', id);
      return error ? { ok: false, error: error.message } : { ok: true };
    }
    // Este y los siguientes: desde la primera es todo.
    if (indice === 0) return await borrarTodo();
    const corte = partirSerie(s.recurrencia!, fecha, indice)!;
    const { error } = await de(a.ws, 'comunidad_eventos').update({
      recurrencia: { ...s.recurrencia!, fin: corte.antes }, excepciones: partirExcepciones(s.excepciones, fecha).antes, updated_at: new Date().toISOString(),
    }).eq('producto_id', a.productoId).eq('id', id);
    if (error) return { ok: false, error: error.message };
    const { error: e2 } = await de(a.ws, 'comunidad_eventos').delete().eq('producto_id', a.productoId).eq('serie_de', id).gte('ocurrencia_fecha', fechaTexto(fecha));
    if (e2) console.warn('[comunidad] no pude borrar los reemplazos de la serie:', e2.message);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo borrar el evento.') };
  }
}

// ── «Agregar a mi calendario» ─────────────────────────────────────────────────────

/**
 * El .ics de un evento, generado en el SERVER con lo que quien lo pide puede ver: la ocurrencia de
 * `fecha` (la que tocó), o la serie entera (`serie`). Un evento cerrado para quien lo pide no lo tiene.
 */
export async function icsComunidad(a: Actor, q: { id?: unknown; fecha?: unknown; serie?: unknown }): Promise<Resultado<{ nombre: string; ics: string }>> {
  try {
    const id = idValido(q.id);
    const fila = id ? await eventoDe(a, id) : null;
    const s = fila ? serieDe(fila) : null;
    if (!fila || !s) return { ok: false, error: 'Ese evento ya no está.' };
    const quien = await quienMira(a);
    if (!accesoPermite(accesoGuardado(fila.acceso), quien)) return { ok: false, error: 'Ese evento está cerrado para ti.' };
    const datos = {
      uid: `comunidad-${a.ws}-${fila.id}@hola-mako.com`, titulo: fila.titulo, descripcion: fila.descripcion,
      lugarTipo: (fila.lugar_tipo === 'direccion' ? 'direccion' : 'link') as LugarTipo, lugar: fila.lugar, ahoraMs: Date.now(),
    };
    if (q.serie === true && s.recurrencia) return { ok: true, nombre: nombreDeIcs(fila.titulo), ics: icsDeSerie({ ...datos, serie: s }) };
    const fecha = leerFecha(q.fecha) ?? localDe(s.inicioMs, s.zona).fecha;
    const [oc] = ocurrencias(s, Date.parse(`${fechaTexto(sumarDias(fecha, -2))}T00:00:00Z`), Date.parse(`${fechaTexto(sumarDias(fecha, 3))}T00:00:00Z`), 10)
      .filter((o) => o.fecha === fechaTexto(fecha));
    if (!oc) return { ok: false, error: 'Esa fecha ya no está en el calendario.' };
    return {
      ok: true, nombre: nombreDeIcs(fila.titulo),
      ics: icsDeOcurrencia({ ...datos, uid: `comunidad-${a.ws}-${fila.id}-${oc.fecha}@hola-mako.com`, inicioMs: oc.inicio, finMs: oc.fin }),
    };
  } catch (e) {
    return { ok: false, error: msg(e, 'No pude armar el archivo.') };
  }
}

// ── El aviso de «empieza pronto» (la campana) ─────────────────────────────────────

const ultimoRepaso = new Map<string, number>();

/**
 * Anota en la campana de quien mira los eventos que empiezan en las próximas 24 h y a los que entra.
 * Se corre al abrir la campana (no hay cron todavía: ver lib/comunidad-notificaciones.ts) y deja UNA
 * fila por persona, evento y fecha (`clave` única: abrir la campana diez veces no avisa diez).
 *
 * ⚠️ COMO MUCHO CADA 5 MINUTOS POR PERSONA (por instancia): la campana se refresca sola cada minuto.
 *    NO TIRA: un aviso que falta no puede tumbar la campana.
 */
export async function avisarEventosProximos(a: Actor): Promise<void> {
  const k = `${a.ws}:${a.productoId}:${a.clave}`;
  const ahora = Date.now();
  if ((ultimoRepaso.get(k) ?? 0) > ahora - 5 * 60_000) return;
  if (ultimoRepaso.size > 5000) for (const [x, t] of ultimoRepaso) if (t < ahora - 5 * 60_000) ultimoRepaso.delete(x);
  ultimoRepaso.set(k, ahora);
  try {
    const hasta = ahora + AVISO_EVENTO_MS;
    const [filas, quien] = await Promise.all([eventosDelProducto(a, hasta), quienMira(a)]);
    const avisos: Fila[] = [];
    for (const f of filas) {
      const s = serieDe(f);
      if (!s || !accesoPermite(accesoGuardado(f.acceso), quien)) continue;
      for (const o of ocurrencias(s, ahora, hasta, 5)) {
        if (o.inicio < ahora) continue;
        avisos.push({
          producto_id: a.productoId, para_miembro: a.clave, para_lead_id: leadDe(a.clave), tipo: 'evento',
          evento_id: f.id, ocurrencia: new Date(o.inicio).toISOString(), clave: claveDeAvisoDeEvento(Number(f.id), o.fecha),
        });
      }
    }
    if (!avisos.length) return;
    const { error } = await de(a.ws, 'comunidad_notificaciones').upsert(avisos, { onConflict: 'workspace_id,para_miembro,clave', ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  } catch (e) {
    ultimoRepaso.delete(k);
    console.warn('[comunidad] no pude anotar los eventos próximos:', msg(e, ''));
  }
}

/** Los títulos de unos eventos (para la campana). Los que ya no están, no vienen. */
export async function titulosDeEventos(a: Actor, ids: readonly number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (!ids.length) return out;
  const { data, error } = await de(a.ws, 'comunidad_eventos').select('id, titulo').eq('producto_id', a.productoId).in('id', [...new Set(ids)].slice(0, 200));
  if (error) throw new Error(error.message);
  for (const f of (data ?? []) as Array<{ id: number; titulo: string }>) out.set(Number(f.id), f.titulo);
  return out;
}
