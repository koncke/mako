// =============================================================================
// api-mako/flujo — un paso «⚡ Acción» de un flujo corre una acción de MaKo, sin pedir el sí
// =============================================================================
// Decisión de Martín (08/10/2026), textual: un flujo «que pueda hacer todo, sin
// limitaciones». El dueño confirmó la acción al CONFIGURAR el paso; cuando el flujo corre,
// la acción se ejecuta. Vale para los dos lienzos: las secuencias de /automations
// (lib/nutricion.ts) y los flujos de avisos de /mensajes (lib/flujos.ts).
//
// ⚠️ NO HAY UN SEGUNDO CAMINO DE ESCRITURA. Se propone por el MISMO choke point que usa
// todo canal (`ejecutarOperacion`: el validador del registro, el gating de la capa y el
// `preparar()` de cada operación contra la base) y en el acto se confirma por el camino
// que ya existe para cada forma:
//   · chat (77 + las 5 heredadas)  → pendiente → `confirmarPendiente`
//   · pantalla genérica (91)        → propuesta → `aplicarPropuestaGenerica`
//   · pantalla propia (7)           → su propia forma de aplicar: el borrador del plan
//     (`aplicarPropuesta`), el alta de leads (`createLead`, con el chequeo de duplicados) y
//     el borrador de WhatsApp de empresa (`enviarBorrador`).
// Así cada ejecución deja su fila —la pendiente o la propuesta, con el flujo como origen y
// «MaKo · automatización «nombre»» como quien la confirmó—, que es el rastro de qué hizo
// una automatización y cuándo. Medido el 08/10: 168 de las 180 acciones separan
// `preparar` de `ejecutar`; las 12 restantes son las 5 heredadas y las 7 de pantalla propia.
//
// ⚠️ Y SE PROPONE CON EL CANAL `app`, NO UNO NUEVO. Sumar `flujo` a CANALES obligaría a
// declararlo en las 498 operaciones (es una lista en positivo), y la decisión fue que
// TODAS las acciones valen. La clave de scope lleva el prefijo `app:flujo:` (canal.ts) y de
// ahí sale el origen de la fila.
// =============================================================================

import 'server-only';
import { REGISTRO, porId, visible } from './registro';
import { ejecutarOperacion, vistaDe } from './ejecutar';
import { confirmarPendiente, aplicarPropuestaGenerica } from './acciones';
import { PREFIJO_FLUJO } from './canal';
import { paramsDelPaso, pideLead, filasDeLeads } from './flujo-params';
import { AREA_INFO, esAccion, type AccionDef, type Ctx, type Parametro } from './tipos';
import { getPropuesta, marcarAplicada, guardarResultadoPropuesta } from '@/lib/propuestas';
import { aplicarPropuesta, getPropuesta as getBorradorPlan } from '@/lib/plan-propuesta';
import { createLead } from '@/lib/leads';
import { LeadDuplicadoError } from '@/lib/leads-duplicados';
import { enviarBorrador } from '@/lib/evolution-envio';
import { runWithWorkspace } from '@/lib/workspace';
import { ACCIONES_DEL_FLUJO, accionDelFlujo, unaPorEtiqueta, juntarPorEtiqueta, type GrupoAccion } from '@/lib/editor-acciones';

export type ResultadoFlujo = {
  ok: boolean;
  /** Lo que pasó, en una frase: va al log de la corrida y, si falló, al grupo del dueño. */
  resumen: string;
  /** Por qué camino se confirmó, para el rastro. */
  via: 'pendiente' | 'propuesta' | 'propia' | 'ninguna';
  /** Lo que la escritura devolvió además del resumen (`Ejecutado.datos`: el id de lo que creó). Lo lee
   *  la escritura directa de /api/v1 (lib/api-mako/rutas-http.ts): sin esto, quien crea una clase por la
   *  API no sabe su id. Un flujo no lo usa. */
  datos?: Record<string, unknown>;
};

/** El contexto con el que corre un flujo: el admin del negocio, con alcance de ejecutar. */
export function ctxDeFlujo(ws: number, origen: string, nombre: string): Ctx {
  return {
    ws, canal: 'app', canalKey: `${PREFIJO_FLUJO}${origen}`, alcance: 'ejecutar', rol: 'admin',
    actor: `MaKo · automatización «${nombre}»`,
  };
}

/** Las operaciones de pantalla PROPIA del plan: todas dejan un borrador de `plan_propuestas`. */
const DEL_PLAN = new Set(['proponer_tareas_plan', 'proponer_cierre_tareas', 'proponer_ampliar_tareas', 'proponer_tareas_proyecto_vacio']);

/**
 * Corre una acción de MaKo desde un paso de un flujo. Nunca lanza: un flujo es
 * best-effort y un paso que falla no corta el webhook que lo disparó.
 */
export async function ejecutarDesdeFlujo(
  operacion: string,
  params: Record<string, unknown> | null | undefined,
  opts: { ws: number; origen: string; nombre: string; leadId?: number | null },
): Promise<ResultadoFlujo> {
  const def = porId(operacion);
  if (!def || !esAccion(def)) return { ok: false, resumen: `«${operacion}» no es una acción de MaKo.`, via: 'ninguna' };
  // ⚠️ UNA TARJETA TAG CON VARIAS ETIQUETAS CORRE UNA VEZ POR ETIQUETA (sexta tanda, TAG 2). La def del
  // registro acepta UNA (`etiquetaId`) y el validador tira en silencio lo que no declara (`etiquetaIds`):
  // sin esto, «Agregar Cualificado, Seguimiento y Llamar» agregaba sólo Cualificado, sin un error. Cada
  // tanda pasa por el mismo camino de siempre (y deja su fila); el resultado es UNO, ok sólo si salieron
  // todas, y el resumen dice cada una (`juntarPorEtiqueta`, lib/editor-acciones.ts).
  const tandas = unaPorEtiqueta(operacion, params);
  if (tandas.length > 1) {
    const rs: ResultadoFlujo[] = [];
    for (const p of tandas) rs.push(await ejecutarDesdeFlujo(operacion, p, opts));
    return juntarPorEtiqueta(rs);
  }
  const ctx = ctxDeFlujo(opts.ws, opts.origen, opts.nombre);
  // La tanda única (con una etiqueta en la lista, ésa queda en `etiquetaId`); para todo lo demás, `params`.
  const input = paramsDelPaso(def.parametros, tandas[0], { leadId: opts.leadId ?? null });
  // ⚠️ EL WORKSPACE LO FIJA EL EJECUTOR, no quien lo llama. `ejecutarOperacion` lo fija para
  // proponer, pero confirmar (`confirmarPendiente`) corre el `ejecutar()` de la acción tal
  // cual, y ahí `logLeadEvent` → `getTenantDb` sin contexto cae a las cookies: medido el
  // 08/10 en la prueba del ws3, la nota salía y el historial tiraba «`cookies` was called
  // outside a request scope». Un cron que itera clientes no tiene cookies.
  return runWithWorkspace(opts.ws, () => aplicarEnElActo(def, input, ctx, opts));
}

/**
 * Propone una acción por el choke point y la confirma EN EL ACTO, por el camino que ya
 * existe para cada forma (pendiente, propuesta genérica, pantalla propia). Lo comparten
 * los dos que escriben sin pedir el «sí»: un paso de un flujo y un token detallado con
 * «Lectura y escritura» por /api/v1 (decisión de Martín del 08/10/2026, copiar GitHub).
 *
 * ⚠️ NO FIJA EL WORKSPACE: quien llama lo envuelve en `runWithWorkspace(ws)` (ver arriba).
 * ⚠️ Y «ya está así» (`yaEstaba`) vuelve como `ok: true` con `via: 'ninguna'`: para un
 * flujo es éxito; quien necesite distinguirlo mira esa combinación.
 */
export async function aplicarEnElActo(
  def: AccionDef, input: Record<string, unknown>, ctx: Ctx,
  opts: { ws: number; origen: string },
): Promise<ResultadoFlujo> {
  try {
    const r = await ejecutarOperacion(def.id, input, ctx, 'json');
    // «Ya está así» no es un fallo para un flujo: el estado que el paso pide ya es el actual.
    // Sin esto, «cuando agenda, movelo a Agendado» alarmaba al dueño en cada reagenda.
    if (!r.ok) return { ok: r.yaEstaba === true, resumen: r.error, via: 'ninguna' };

    if (r.tipo === 'pendiente') {
      const c = await confirmarPendiente(ctx, r.pendiente.id);
      if ('error' in c) return { ok: false, resumen: String(c.error), via: 'pendiente' };
      return { ok: c.ok, resumen: c.resumen, via: 'pendiente', ...('datos' in c && c.datos ? { datos: c.datos as Record<string, unknown> } : {}) };
    }

    if (r.tipo === 'propuesta') {
      const id = r.propuesta.id;
      if (DEL_PLAN.has(def.id)) {
        // ⚠️ UN BORRADOR DE CIERRES SE APLICA CON SUS IDS. `aplicarPropuesta` sólo cierra lo
        // confirmado explícitamente (`cerrarIds`): sin ellos contestaba «No hay nada para crear,
        // cerrar ni borrar», cada corrida dejaba otro borrador colgado y una alarma al dueño. El
        // dueño confirmó los cierres al configurar el paso (decisión del 08/10).
        const cerrarIds = def.id === 'proponer_cierre_tareas'
          ? ((await runWithWorkspace(opts.ws, () => getBorradorPlan(id)))?.cerrar ?? []).map((c) => String(c.id))
          : undefined;
        const a = await runWithWorkspace(opts.ws, () => aplicarPropuesta(id, undefined, undefined, undefined, cerrarIds));
        if (!a) return { ok: false, resumen: 'El borrador del plan ya no existe.', via: 'propia' };
        return { ok: a.ok, resumen: a.ok ? `Plan: ${a.ids?.length ?? 0} tareas aplicadas.` : (a.error ?? 'No se pudo aplicar el borrador del plan.'), via: 'propia' };
      }
      if (def.id === 'crear_borrador_whatsapp_empresa') {
        const e = await runWithWorkspace(opts.ws, () => enviarBorrador(Number(id), ctx.actor ?? 'MaKo · automatización'));
        return { ok: e.ok, resumen: e.ok ? 'Mensaje enviado por el WhatsApp de empresa.' : (e.error ?? 'No se pudo enviar el mensaje.'), via: 'propia' };
      }
      if (def.id === 'proponer_lead' || def.id === 'proponer_leads') return await crearLeadsDePropuesta(opts.ws, id, ctx);
      // La pantalla genérica: se aplica con el mismo `preparar()` + `ejecutar()` de siempre.
      const e = await aplicarPropuestaGenerica(id, null, ctx);
      return { ok: e.ok, resumen: e.resumen, via: 'propuesta' };
    }

    return { ok: true, resumen: 'Hecho.', via: 'ninguna' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api-mako/flujo] ${def.id} (ws ${opts.ws}, ${opts.origen}):`, msg);
    return { ok: false, resumen: `Falló «${def.titulo}»: ${msg}`, via: 'ninguna' };
  }
}

/**
 * Las personas de una propuesta de leads, dadas de alta en el acto. Con el MISMO chequeo de
 * duplicados de toda alta (`createLead`): una persona que ya existe no se crea dos veces, se
 * cuenta como omitida. Y la propuesta queda aplicada, con el resultado, como la cierra la
 * pantalla de revisión.
 */
async function crearLeadsDePropuesta(ws: number, propuestaId: string, ctx: Ctx): Promise<ResultadoFlujo> {
  return runWithWorkspace(ws, async () => {
    const prop = await getPropuesta(propuestaId);
    if (!prop || prop.estado !== 'pendiente') return { ok: false, resumen: 'La propuesta de leads ya no está pendiente.', via: 'propia' as const };
    // ⚠️ SE RECLAMA ANTES DE CREAR (marcar va antes de mandar). Al revés, dos corridas con el
    // mismo id —`crearPropuesta` deduplica por `ref` y devuelve la pendiente—, o una corrida y
    // una persona en /crm/revisar, creaban los leads dos veces: el chequeo de duplicados de
    // `createLead` lee y después inserta, sin atomicidad. El resultado se escribe al final.
    if (!(await marcarAplicada(propuestaId, { en_curso: true, por: ctx.actor ?? null }))) {
      return { ok: false, resumen: 'La propuesta de leads la está aplicando otro.', via: 'propia' as const };
    }
    let creados = 0; let omitidos = 0; const errores: string[] = [];
    for (const f of filasDeLeads(prop.datos as Record<string, unknown>)) {
      try { await createLead({ nombre: f.nombre, email: f.email, telefono: f.telefono, empresa: f.empresa }); creados++; }
      catch (e) {
        if (e instanceof LeadDuplicadoError) omitidos++;
        else errores.push(`${f.nombre}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    await guardarResultadoPropuesta(propuestaId, { creados, omitidos, por: ctx.actor ?? null, ...(errores.length ? { errores } : {}) });
    const ok = creados > 0 || (omitidos > 0 && !errores.length);
    return { ok, resumen: `Leads: ${creados} creados${omitidos ? `, ${omitidos} ya existían` : ''}${errores.length ? ` · ${errores.join(' · ')}` : ''}.`, via: 'propia' as const };
  });
}

// ── El catálogo que ve el editor del lienzo ───────────────────────────────────

export type ParametroEditor = Pick<Parametro, 'nombre' | 'tipo' | 'descripcion' | 'obligatorio' | 'enum' | 'minimo' | 'maximo' | 'entero' | 'rotulo'>;
export type AccionEditor = {
  id: string; area: string; areaTitulo: string;
  /** El nombre en el lienzo: el de la lista corta si está en ella, si no el del registro. */
  titulo: string;
  descripcion: string;
  costo: string; reversible: boolean; pideLead: boolean; parametros: ParametroEditor[];
  /** ¿Está en la lista corta del lienzo (`ACCIONES_DEL_FLUJO`)? Sólo éstas se ofrecen. */
  curada: boolean;
  /** Su grupo en el selector (null fuera de la lista corta). */
  grupo: GrupoAccion | null;
  /** La línea de qué hace, de la lista corta (null fuera de ella: el editor la saca de la descripción). */
  que: string | null;
};

/**
 * Las acciones que un paso puede correr en ESTE workspace: las que su capa ve (el mismo
 * `visible()` de todo canal). Se arma en el server y baja por la API: el registro no se
 * importa desde un componente cliente (AGENTS.md).
 *
 * ⚠️ RESPETA LA LISTA CORTA (`ACCIONES_DEL_FLUJO`, lib/editor-acciones.ts; tercera tanda, punto 16:
 * «siento que pusiste muchísimas acciones que tal vez no son necesarias»). Las de la lista van
 * primero, en su orden, con su nombre de lienzo y `curada: true`; el selector sólo ofrece ésas. Las
 * demás SIGUEN VINIENDO, con `curada: false`: un paso ya guardado con una de ellas (de antes, de la
 * API, de Crear con IA) se tiene que poder dibujar con su nombre y editar con su formulario. Sacarlas
 * del catálogo dejaba esa tarjeta con el id crudo y sin formulario.
 */
export async function accionesParaFlujo(ws: number): Promise<AccionEditor[]> {
  const vista = await vistaDe(ctxDeFlujo(ws, 'catalogo', 'catálogo'));
  const orden = new Map(ACCIONES_DEL_FLUJO.map((a, i) => [a.id, i]));
  return REGISTRO.filter((d) => esAccion(d) && visible(d, vista)).map((d): AccionEditor => {
    const lista = accionDelFlujo(d.id);
    return {
      id: d.id, area: d.area, areaTitulo: AREA_INFO[d.area]?.titulo ?? d.area, titulo: lista?.titulo ?? d.titulo, descripcion: d.descripcion,
      costo: d.costo, reversible: esAccion(d) ? d.reversible : false, pideLead: pideLead(d.parametros),
      parametros: d.parametros.map((p) => ({ nombre: p.nombre, tipo: p.tipo, descripcion: p.descripcion, obligatorio: p.obligatorio, enum: p.enum, minimo: p.minimo, maximo: p.maximo, entero: p.entero, rotulo: p.rotulo })),
      curada: lista != null, grupo: lista?.grupo ?? null, que: lista?.que ?? null,
    };
  }).sort((a, b) => (orden.get(a.id) ?? 9999) - (orden.get(b.id) ?? 9999));
}
