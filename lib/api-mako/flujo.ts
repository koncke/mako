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
import { DEFS as DEL_ESTUDIO_DE_VIDEO } from './areas/video-estudio.def';
import { paramsDelPaso, pideLead, filasDeLeads, sinLoDeFueraDelFlujo } from './flujo-params';
import { AREA_INFO, esAccion, type AccionDef, type Ctx, type Parametro } from './tipos';
import { getPropuesta, marcarAplicada, guardarResultadoPropuesta } from '@/lib/propuestas';
import { aplicarPropuesta, getPropuesta as getBorradorPlan } from '@/lib/plan-propuesta';
import { createLead } from '@/lib/leads';
import { usuarioInstagram } from '@/app/crm/campo-inline';
import { LeadDuplicadoError } from '@/lib/leads-duplicados';
import { enviarBorrador } from '@/lib/evolution-envio';
import { runWithWorkspace } from '@/lib/workspace';
import { ACCIONES_DEL_FLUJO, accionDelFlujo, unaPorEtiqueta, juntarPorEtiqueta, crmDelPaso, dondeMoverEtapa, type DondeMover, type GrupoAccion } from '@/lib/editor-acciones';
import { productosDelLead, etapasDeProducto } from '@/lib/lead-funnel';
import { OP_MOVER_ETAPA } from '@/lib/flujo-legado';

/** La acción que mueve la tarjeta de un CRM AGREGADO (lib/api-mako/areas/crm.run.ts). */
const OP_MOVER_EN_PRODUCTO = 'mover_lead_en_producto';

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
  /** Se sabe que NO se ejecutó nada (la pendiente no entró): el motor lo reintenta (lib/nutricion-paso-accion.ts). */
  noCorrio?: true;
  /** Lo que contestó la base cuando la pendiente no entró: SÓLO para el rastro del motor, nunca a una persona ni por HTTP. */
  motivo?: string;
  /** Los parámetros que faltan (o la pregunta de MaKo, en el parámetro que la contesta): por /api/v1 vuelven como `faltan`
   *  con un 400, como un obligatorio que no vino. Sin esto la pregunta de crear con IA llegaba como un 422 de texto. */
  faltan?: string[];
};

/** El contexto con el que corre un flujo: el admin del negocio, con alcance de ejecutar. */
export function ctxDeFlujo(ws: number, origen: string, nombre: string): Ctx {
  return {
    ws, canal: 'app', canalKey: `${PREFIJO_FLUJO}${origen}`, alcance: 'ejecutar', rol: 'admin',
    actor: `MaKo · automatización «${nombre}»`,
  };
}

/**
 * LAS ACCIONES QUE UN FLUJO NO PUEDE CORRER, aunque su canal (`app`) las vea. `ctxDeFlujo` usa el canal `app`, así que
 * toda acción con `app` aparece SOLA como «⚡ Acción» en los lienzos (`accionesParaFlujo` filtra por `visible`):
 *   · `crear_automatizacion_con_ia` (décima tanda, docs/diseno-automations-galeria-v2.md §4): una automatización que crea
 *     automatizaciones con IA cada vez que entra un lead es un lazo que gasta la IA del negocio. Su `preparar` también la
 *     rechaza desde un flujo (la clave de scope con `PREFIJO_FLUJO`): esto la saca de la lista, aquello frena un paso viejo.
 */
// `vender_plan_mako` (23/10/2026, revisión adversarial): un paso de un flujo se confirma solo, y vender un plan de MaKo lo
// confirma el super admin. Su runner además lo rechaza desde un flujo (un paso viejo o importado).
// El Media Buyer (25/10/2026): lo que mueve plata en la cuenta de Meta lo confirma una persona o el piloto automático que el
// negocio prendió, nunca un paso de una automatización (docs/diseno-ads-autopilot.md, «Seguridad e inquilinos»).
// Los botones del estudio de Video Generator (27/10/2026, areas/video-estudio.def.ts): llaman a las server actions de la tab,
// que leen la sesión de la persona, y un paso de un flujo no tiene. Su runner además los rechaza desde un flujo.
// La biblioteca de carruseles de ejemplo (4/11/2026, areas/imagen.def.ts): la ven TODOS los negocios, y sacar una cuenta borra
// sus publicaciones de todos; lo decide una persona de la plataforma, nunca un paso que se confirma solo.
// Los recibos de MaKo (5/11/2026, lib/recibos.ts): cargar un pago numera un documento y reenviarlo le escribe a un tercero; los
// confirma el super admin, nunca un paso.
export const NO_EN_FLUJOS: ReadonlySet<string> = new Set(['crear_automatizacion_con_ia', 'vender_plan_mako',
  'lanzar_decision_media_buyer', 'deshacer_decision_media_buyer', 'modo_media_buyer', 'topes_media_buyer', 'automatizacion_media_buyer',
  'cuenta_media_buyer', 'modo_agente_media_buyer', 'zona_media_buyer', 'hasta_media_buyer', 'proponer_crear_campana',
  'subir_creativos_media_buyer', 'cambiar_biblioteca_carruseles', 'cargar_pago_a_mano', 'reenviar_recibo',
  // La mensualidad de una agencia (lib/agencia-mes.ts): las escribe el super admin global, que un flujo no tiene.
  'marcar_mensualidad_pagada', 'corregir_reloj_mensualidad', 'prender_mensualidad_agencia', 'marcar_entrada_pagada',
  // El Lead Magnet Generator (5/11/2026, areas/leadmagnet.def.ts): un paso corre una vez por lead y armaría una pieza, una landing
  // o un link por cada uno; el orden de la lista lo decide una persona.
  'armar_magnet', 'pagina_captura_magnet', 'link_publico_magnet', 'primero_magnet', 'dejar_compartir_magnet', ...DEL_ESTUDIO_DE_VIDEO.map((d) => d.id)]);

/**
 * Y lo que se acepta EN EL EDITOR DE VIDEO (pantalla `/video-editor`: las operaciones de su chat, lib/editor-video/chat-api.ts,
 * 16/10/2026). Un flujo corre en el server cuando entra un evento, sin nadie mirando el editor en el navegador donde vive
 * el proyecto: la propuesta quedaría colgada y el paso, como falla la pantalla genérica, contestaría un error cada vez.
 */
export const enElEditorDeVideo = (d: AccionDef): boolean => d.pantalla === '/video-editor';

/** Las operaciones de pantalla PROPIA del plan: todas dejan un borrador de `plan_propuestas`. */
const DEL_PLAN = new Set(['proponer_tareas_plan', 'proponer_cierre_tareas', 'proponer_ampliar_tareas', 'proponer_tareas_proyecto_vacio']);

/**
 * «MOVER DE ETAPA» CORRE EN EL CRM QUE ELIGIÓ EL PASO (21/10/2026, `dondeMoverEtapa`, lib/editor-acciones.ts): en un CRM
 * AGREGADO mueve su fila (`mover_lead_en_producto`); en uno donde el lead no está, no mueve nada. Sin esto, la key de la
 * etapa del otro CRM se escribía en la etapa PRINCIPAL del lead. El `embudoId` se lee de lo GUARDADO: la def no lo
 * declara y `paramsDelPaso` lo saca. Devuelve `null` cuando toca lo de siempre (la casa, o un paso sin CRM).
 */
async function moverEnElCrmDelPaso(
  guardado: Record<string, unknown> | null | undefined, input: Record<string, unknown>, ctx: Ctx,
  opts: { ws: number; origen: string },
): Promise<ResultadoFlujo | null> {
  const crm = crmDelPaso((guardado ?? {})?.embudoId);
  const leadId = typeof input.leadId === 'number' ? input.leadId : null;
  if (leadId == null || crm == null) return null;
  let donde: DondeMover;
  try {
    const { productos } = await runWithWorkspace(opts.ws, () => productosDelLead(leadId));
    // ¿La etapa existe en su casa? Sólo si no está en el CRM del paso (lo de antes, ver `dondeMoverEtapa`).
    const casa = productos.find((p) => p.esCasa);
    const etapaEnLaCasa = casa && !productos.some((p) => p.funnelId === crm)
      ? (await runWithWorkspace(opts.ws, () => etapasDeProducto(casa.funnelId))).some((e) => e.key === input.etapa)
      : null;
    donde = dondeMoverEtapa(crm, productos, etapaEnLaCasa);
  } catch (e) {
    return { ok: false, resumen: `No moví de etapa: no pude leer los CRM del lead (${e instanceof Error ? e.message : String(e)}).`, via: 'ninguna' };
  }
  if (donde === 'fuera') return { ok: false, resumen: 'No moví de etapa: no está en ese CRM (súmalo antes con «Agregar a un funnel»).', via: 'ninguna' };
  if (donde !== 'agregado') return null;
  const enProducto = porId(OP_MOVER_EN_PRODUCTO);
  if (!enProducto || !esAccion(enProducto)) return { ok: false, resumen: `«${OP_MOVER_EN_PRODUCTO}» no es una acción de MaKo.`, via: 'ninguna' };
  const mover = { leadId, embudoId: crm, etapa: input.etapa };
  return runWithWorkspace(opts.ws, () => aplicarEnElActo(enProducto, mover, ctx, opts));
}

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
  if (enElEditorDeVideo(def)) return { ok: false, resumen: `«${def.titulo}» se acepta en el editor de video: no corre en una automatización.`, via: 'ninguna' };
  // ⚠️ UNA TARJETA TAG CON VARIAS ETIQUETAS CORRE UNA VEZ POR ETIQUETA (sexta tanda, TAG 2). La def del
  // registro acepta UNA (`etiquetaId`) y el validador tira en silencio lo que no declara (`etiquetaIds`):
  // sin esto, «Agregar Cualificado, Seguimiento y Llamar» agregaba sólo Cualificado, sin un error. Cada
  // tanda pasa por el mismo camino de siempre (y deja su fila); el resultado es UNO, ok sólo si salieron
  // todas, y el resumen dice cada una (`juntarPorEtiqueta`, lib/editor-acciones.ts).
  const tandas = unaPorEtiqueta(operacion, sinLoDeFueraDelFlujo(operacion, params));
  if (tandas.length > 1) {
    const rs: ResultadoFlujo[] = [];
    for (const p of tandas) rs.push(await ejecutarDesdeFlujo(operacion, p, opts));
    return juntarPorEtiqueta(rs);
  }
  const ctx = ctxDeFlujo(opts.ws, opts.origen, opts.nombre);
  // La tanda única (con una etiqueta en la lista, ésa queda en `etiquetaId`); para todo lo demás, `params`.
  const input = paramsDelPaso(def.parametros, tandas[0], { leadId: opts.leadId ?? null });
  // «Mover de etapa» corre en el CRM que eligió el paso (`moverEnElCrmDelPaso`, abajo).
  if (def.id === OP_MOVER_ETAPA) {
    const r = await moverEnElCrmDelPaso(tandas[0], input, ctx, opts);
    if (r) return r;
  }
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
    // Con lo que contestó la base APARTE (`motivo`, 23/10/2026, el ws13): el motor lo escribe en `nutricion_envios.error`;
    // por /api/v1 (que también pasa por acá) sale sólo el `resumen`, como siempre.
    if (!r.ok) {
      return {
        ok: r.yaEstaba === true, resumen: r.error, via: 'ninguna',
        ...(r.motivo ? { motivo: r.motivo } : {}), ...(r.noCorrio ? { noCorrio: true as const } : {}),
        ...(r.faltan?.length ? { faltan: r.faltan } : {}),
      };
    }

    if (r.tipo === 'pendiente') {
      const c = await confirmarPendiente(ctx, r.pendiente.id);
      if ('error' in c) return { ok: false, resumen: String(c.error), via: 'pendiente' };
      // La pregunta que hizo el modelo al ejecutar (crear con IA) viaja en `datos.faltan`: sale como `faltan`.
      const faltanAlEjecutar = !c.ok && 'datos' in c && Array.isArray((c.datos as { faltan?: unknown } | undefined)?.faltan)
        ? ((c.datos as { faltan: unknown[] }).faltan).map(String) : null;
      if (faltanAlEjecutar?.length) return { ok: false, resumen: c.resumen, via: 'pendiente', faltan: faltanAlEjecutar };
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
        // Si aplicar TIRA (la base, un corte), el id del borrador vuelve igual: quien llama lo descarta en vez de dejarlo
        // colgado en /plan/revisar (el catch de abajo no lo conoce).
        const a = await runWithWorkspace(opts.ws, () => aplicarPropuesta(id, undefined, undefined, undefined, cerrarIds))
          .catch((e: unknown) => ({ tiro: e instanceof Error ? e.message : String(e) }));
        if (a && 'tiro' in a) return { ok: false, resumen: `Falló «${def.titulo}»: ${a.tiro}`, via: 'propia', datos: { propuestaId: id, creadas: 0, cerradas: 0 } };
        if (!a) return { ok: false, resumen: 'El borrador del plan ya no existe.', via: 'propia' };
        // `datos`: el borrador (quien llama lo puede descartar si no se aplicó, en vez de dejarlo colgado en
        // /plan/revisar) y cuántas tareas NACIERON (0 = las que había ya estaban y se ampliaron). Lo lee el Centro.
        const datos = { propuestaId: id, creadas: a.ids?.length ?? 0, cerradas: a.cerradas ?? 0 };
        return { ok: a.ok, resumen: a.ok ? `Plan: ${a.ids?.length ?? 0} tareas aplicadas.` : (a.error ?? 'No se pudo aplicar el borrador del plan.'), via: 'propia', datos };
      }
      if (def.id === 'crear_borrador_whatsapp_empresa') {
        const e = await runWithWorkspace(opts.ws, () => enviarBorrador(Number(id), ctx.actor ?? 'MaKo · automatización'));
        return { ok: e.ok, resumen: e.ok ? 'Mensaje enviado por el WhatsApp de empresa.' : (e.error ?? 'No se pudo enviar el mensaje.'), via: 'propia' };
      }
      if (def.id === 'proponer_lead' || def.id === 'proponer_leads') return await crearLeadsDePropuesta(opts.ws, id, ctx);
      // La pantalla genérica: se aplica con el mismo `preparar()` + `ejecutar()` de siempre. Con sus
      // `datos`, como la rama de la pendiente: sin ellos, un token detallado que escribe en el acto una
      // acción de pantalla recibía 200 sin el id de lo que creó (relevo de la pasarela, 11/10/2026).
      const e = await aplicarPropuestaGenerica(id, null, ctx);
      return { ok: e.ok, resumen: e.resumen, via: 'propuesta', ...(e.datos ? { datos: e.datos } : {}) };
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
      try { await createLead({ nombre: f.nombre, email: f.email, telefono: f.telefono, instagram: usuarioInstagram(f.instagram), empresa: f.empresa }); creados++; }
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
  return REGISTRO.filter((d) => esAccion(d) && visible(d, vista) && !NO_EN_FLUJOS.has(d.id) && !enElEditorDeVideo(d)).map((d): AccionEditor => {
    const lista = accionDelFlujo(d.id);
    return {
      id: d.id, area: d.area, areaTitulo: AREA_INFO[d.area]?.titulo ?? d.area, titulo: lista?.titulo ?? d.titulo, descripcion: d.descripcion,
      costo: d.costo, reversible: esAccion(d) ? d.reversible : false, pideLead: pideLead(d.parametros),
      parametros: d.parametros.map((p) => ({ nombre: p.nombre, tipo: p.tipo, descripcion: p.descripcion, obligatorio: p.obligatorio, enum: p.enum, minimo: p.minimo, maximo: p.maximo, entero: p.entero, rotulo: p.rotulo })),
      curada: lista != null, grupo: lista?.grupo ?? null, que: lista?.que ?? null,
    };
  }).sort((a, b) => (orden.get(a.id) ?? 9999) - (orden.get(b.id) ?? 9999));
}
