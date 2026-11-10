// =============================================================================
// «Ops Center = lo principal», pieza 1.2: el clasificador del chat de la APP (tanda 1: CRM y Chats, Automations y Clients, núcleo)
// =============================================================================
// Martín (20/10/2026): «comienza a implementar directamente toda mi idea de que Ops Center sea lo principal en MaKo... quiero
// que en Ops Center se pueda hacer todo, editar videos, crear webs, etc...». Lo que manda (docs/hallazgos-ia.md, 20/10;
// docs/ops-center-principal.md, 2.3): el chat de la APP usaba el clasificador del grupo de WhatsApp, que ante la duda anota el
// pedido como idea y le saca a MaKo la herramienta de escribir. Medido con el turno REAL (`clasificarIntencion` +
// `herramientasDelChat`, canal app, admin) sobre las frases de los mapas de cada área:
//
//                       antes     ahora
//   CRM y Chats         41/91     91/91
//   Automations y Clients 17/48   44/44 que existen en la app (las otras 4 son operaciones sólo http: ver abajo)
//   Núcleo              23/40     40/40
//   Tandas 2 y 3 (con la maquinaria de la tanda 1 ya puesta): Plan 28/30, Calendario 5/8, Dashboard 26/28, video 35/37,
//   imagen y creaciones 8/10 → 30/30, 8/8, 28/28, 37/37 y 10/10 con las filas nuevas (tuteo y voseo de cada frase).
//   Tandas 5 a 7 (misma medición): Offer, Copywriting y Second Brain 24/26 y 6/8 → 26/26 y 8/8, experimentos 10/10, Web Generator
//   35/39 → 39/39 y Meta Ads 30/30 de entrada (con tuteo y voseo; los mapas medían Meta con tuteo en 0 de 18).
//   Tanda 4 (Pagos y cuenta): cobros 21/22 y equipo y cuenta 23/28 → 22/22 y 26/26. Las 2 frases de «exigí el 2FA» salieron de la batería:
//   `exigir_2fa_desde` tiene gating de PLATAFORMA (sólo el super admin), no es del admin de un cliente.
//
// Qué cambió (lib/mako-intencion.ts, lib/mako-intencion-app.ts, lib/doer-herramientas.ts):
//  · D1 = A: en la app, sin señal clara se ACTÚA (se arma la tarjeta; nada se hace sin el toque), no se anota. WhatsApp sigue
//    anotando: el test de abajo lo fija.
//  · un verbo de hacer al arranque (crear, mandar, poner, cambiar… en tuteo y voseo, con pronombre pegado, o «quiero / ¿podés…?»);
//  · las familias de pedidos (áreas y palabras de la operación que el pedido no nombra);
//  · si el texto no nombra un área, la operación se busca en TODO el registro por relevancia.
//
// Las frases son las MEDIDAS de los mapas (scratchpads de la corrida del 20/10), con tuteo y voseo. Quedan afuera las 4 cuyo
// destino es una operación sólo http (`crear_modulo_curso`, `crear_clase_curso`, `publicar_post_comunidad`,
// `crear_evento_comunidad`: canales ['http'], no viajan por la app; es de Clients abrirlas).
//
// Probado rompiéndolo (20/10/2026): ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { AREA_KEYWORDS, clasificarIntencion, RELEVANCIA_AGENDA } from '../lib/mako-intencion';
import { pideHacerAlApp, familiasDe, pideQuitar, sinVerboAlArranque } from '../lib/mako-intencion-app';
import { herramientasDelChat, entraAlChat } from '../lib/mako-turno-app-reglas';
import { herramientasDelTurno } from '../lib/doer-herramientas';
import { esDestructiva, nombraLaCosa, lecturasQueNombra, INSTRUCCION_QUITAR_SIN_OBJETO } from '../lib/relevancia-app';
import { REGISTRO, porId, type Vista } from '../lib/api-mako/registro';
import { alcanceMinimo } from '../lib/api-mako/tipos';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

/** Los nombres de las herramientas de siempre del turno de la app, pedidos a un node con la condición del server. */
function nombresDeSiempre(): string[] {
  const url = (rel: string) => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);
  const codigo = `import { MAKO_TOOLS } from ${url('lib/mako-tools.ts')}; import { MAKO_ACCION_TOOLS } from ${url('lib/mako-doer-acciones.ts')}; import { porId } from ${url('lib/api-mako/registro.ts')}; const t = porId('levantar_ticket'); process.stdout.write(JSON.stringify([...MAKO_TOOLS, ...MAKO_ACCION_TOOLS].map((x) => x.name).concat(t ? [t.id] : [])));`;
  return JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  })) as string[];
}
const DE_SIEMPRE = nombresDeSiempre().map((name) => ({ name }));
const vistaApp: Vista = { canal: 'app', alcance: 'proponer', ws: 13, rol: 'admin', tabs: null };
const vistaWa: Vista = { canal: 'whatsapp', alcance: 'ejecutar', ws: 13, rol: 'admin', tabs: null };

type Caso = [texto: string, operaciones: string[]];

/** El turno de la app: lo MISMO que corre lib/mako-turno-app.ts (`canal: 'app'` + `herramientasDelChat`). */
function turnoApp(texto: string, ctx: { hayPendientes?: boolean; makoPregunto?: boolean } = {}) {
  const veredicto = clasificarIntencion(texto, { canal: 'app', ...ctx });
  const t = herramientasDelChat({ veredicto, texto, agendaAbierta: false, deSiempre: DE_SIEMPRE, vista: vistaApp, hayPendientes: !!ctx.hayPendientes });
  return { veredicto, nombres: t.tools.map((x) => x.name), delRegistro: t.delRegistro.map((x) => x.name), instruccion: t.instruccion };
}
/** El turno de WhatsApp: el clasificador sin `canal`. */
function turnoWhatsApp(texto: string) {
  const veredicto = clasificarIntencion(texto);
  const t = herramientasDelTurno({ veredicto, texto, agendaAbierta: false, deSiempre: DE_SIEMPRE, vista: vistaWa, hayPendientes: false });
  return { veredicto, nombres: t.tools.map((x) => x.name) };
}
function faltan(casos: Caso[]): string[] {
  const out: string[] = [];
  for (const [texto, ops] of casos) {
    const r = turnoApp(texto);
    if (!ops.some((o) => r.nombres.includes(o))) out.push(`«${texto.slice(0, 80)}» → ${r.veredicto.intencion}${r.veredicto.dudosa ? ' (dudosa)' : ''}: no trae ${ops.join(' | ')}`);
  }
  return out;
}

const NUCLEO: Caso[] = [
  ["creame una landing para mi mentoría", ["generar_landing_con_ia","crear_landing_en_blanco","crear_landing_desde_diseno"]],
  ["quiero una web para mi negocio", ["generar_landing_con_ia","crear_landing_en_blanco"]],
  ["cambiá el título de la landing del webinar por \"Aprende a vender\"", ["cambiar_texto_landing","editar_landing_con_ia"]],
  ["publicá la landing del webinar", ["publicar_landing"]],
  ["replicá esta página https://ejemplo.com", ["replicar_landing"]],
  ["agregale una sección de testimonios a mi página", ["agregar_seccion_landing","editar_landing_con_ia"]],
  ["editá mi último video y sacale las muletillas", ["eliminar_muletillas_video"]],
  ["ponele subtítulos al video del lunes", ["generar_subtitulos_video"]],
  ["cortá los primeros 5 segundos del video", ["recortar_clip_video","cortar_tramo_video"]],
  ["creame un flyer para la promo de noviembre", ["crear_diseno_imagen"]],
  ["cambiá el texto del banner a 50% off", ["cambiar_textos_diseno_imagen"]],
  ["escribime un guion para un reel de mi oferta", ["escribir_guion_anuncio","escribir_guion_anuncio_auto","sugerir_guion_anuncio"]],
  ["mandale un WhatsApp a Juan diciendo que mañana lo llamo", ["crear_borrador_whatsapp_empresa"]],
  ["¿quién me escribió hoy?", ["listar_chats","listar_bandeja_chats"]],
  ["todos los martes a las 3 mandale un recordatorio a todo el funnel", ["crear_automatizacion_con_ia"]],
  ["creame una automatización que le escriba a los que no vinieron a la reunión", ["crear_automatizacion_con_ia"]],
  ["cambiá el segundo mensaje de la secuencia de bienvenida", ["editar_pasos_secuencia_mensajes"]],
  ["pasá a Nicolás a calificado", ["marcar_calificado","proponer_cambio_etapa"]],
  ["agendame una reunión con Ana mañana a las 12", ["proponer_agendar_agenda","proponer_agendar_reunion"]],
  ["mis 5 leads más calientes", ["buscar_leads"]],
  ["mandale el link de pago a Ana", ["crear_link_pago"]],
  ["pausá la campaña de remarketing", ["proponer_estado_campana"]],
  ["subí el presupuesto de la campaña de remarketing a 50 dólares", ["proponer_presupuesto_campana"]],
  ["cambiá el texto del anuncio ganador", ["proponer_editar_textos_anuncio"]],
  ["mandá un mail a todos mis leads con la promo", ["crear_broadcast"]],
  ["agregá un gráfico de leads por semana al dashboard", ["agregar_grafico_dashboard"]],
  ["¿cómo viene el mes?", ["metricas_negocio","analisis_negocio"]],
  ["cargá que este mes vendimos 12 en el KPI de ventas", ["registrar_valor_kpi"]],
  ["anotá: llamar al contador", ["proponer_tareas_plan"]],
  ["cerrá la tarea de grabar el VSL, ya la hice", ["cerrar_tareas_plan","proponer_cierre_tareas"]],
  ["analizá mi oferta", ["ver_analisis_oferta","listar_analisis_oferta"]],
  ["¿qué sabés de mi negocio?", ["contexto_negocio","ver_perfil_negocio","buscar_en_segundo_cerebro"]],
  ["mi negocio se llama Florencia Carballo, corregilo", ["guardar_campo_perfil"]],
  ["programá un reel para el jueves", ["crear_evento_calendario"]],
  ["invitá a pedro@mail.com al equipo como setter", ["invitar_miembro_equipo"]],
  ["marcá a Carla como cliente en riesgo", ["marcar_estado_cliente_cs"]],
  ["creá un experimento para probar un hook nuevo", ["crear_experimento"]],
  ["esto no funciona, avisale al equipo de MaKo", ["levantar_ticket"]],
  ["¿qué hago hoy?", ["ver_plan"]],
  ["¿qué hiciste en este chat?", ["lo_que_hizo_chat_mako"]],
];

const CRM: Caso[] = [
  ["¿cuántos leads tengo en cada etapa?", ["contar_leads_por_etapa"]],
  ["buscame a Juan Pérez", ["buscar_leads"]],
  ["mostrame la ficha de Juan Pérez", ["ficha_lead"]],
  ["pasá a Juan Pérez a la etapa Calificado", ["proponer_cambio_etapa"]],
  ["mové a Juan a Ganado", ["proponer_cambio_etapa"]],
  ["agregale una nota a Juan: llamó y pidió precio", ["agregar_nota_lead"]],
  ["cargá un lead nuevo: Ana López, 5491122334455", ["proponer_lead"]],
  ["asignale a Juan el closer Pedro", ["asignar_closer_setter"]],
  ["ponele la etiqueta VIP a Juan", ["poner_etiqueta_lead"]],
  ["creá una etiqueta que se llame Caliente", ["crear_etiqueta"]],
  ["creá un CRM nuevo para inmobiliaria", ["crear_crm"]],
  ["vinculá el evento Llamada de descubrimiento a la etapa R1", ["vincular_evento_etapa"]],
  ["¿qué leads hay para revisar?", ["propuestas_lead_pendientes"]],
  ["marcá que Juan asistió a la reunión", ["marcar_asistencia_reunion"]],
  ["Juan pagó la cuota 2, marcala cobrada", ["marcar_pago_cobrado"]],
  ["agendale a Juan una reunión el jueves a las 15", ["proponer_agendar_agenda","proponer_agendar_reunion"]],
  ["pasá a Juan al producto Mentoría", ["agregar_lead_a_producto"]],
  ["asigná la campaña Black Friday al funnel Mentoría", ["asignar_campana_funnels"]],
  ["prendé el CRM automático", ["activar_crm_automatico"]],
  ["generá el diagnóstico de Juan", ["generar_insight_lead"]],
  ["cambiale el teléfono a Juan por 5491199998888", ["editar_contacto_lead"]],
  ["sacá el bloque de notas de la ficha del CRM", ["cambiar_ficha_funnel"]],
  ["¿qué cambios del CRM automático tengo por confirmar?", ["confirmaciones_crm_automatico"]],
  ["pasá a Juan a nutrición manual por 30 días", ["mover_a_nutricion_manual"]],
  ["cargá el plan de pagos de Juan: 3 cuotas de 500", ["guardar_plan_pagos"]],
  ["creale una oferta a Juan de 1500 dólares", ["crear_oferta_lead"]],
  ["¿cómo llegó Juan? mostrame su recorrido", ["journey_lead"]],
  ["¿quién me escribió hoy?", ["listar_chats"]],
  ["¿qué chats tengo sin responder?", ["listar_chats"]],
  ["leeme la conversación con Juan", ["hilo_chat"]],
  ["mandale un WhatsApp a Juan diciendo que mañana lo llamo", ["crear_borrador_whatsapp_empresa"]],
  ["escribile a Juan que mañana lo llamo", ["crear_borrador_whatsapp_empresa"]],
  ["cerrá el chat de Juan", ["cerrar_chat"]],
  ["posponé la conversación con Juan hasta mañana", ["posponer_chat"]],
  ["asignale el chat de Juan a Pedro", ["asignar_closer_setter"]],
  ["¿qué le contesto a Juan?", ["recomendar_mensajes_whatsapp"]],
  ["bloqueá el número 5491122334455", ["bloquear_contacto_whatsapp_empresa"]],
  ["mostrame los borradores de MaKo", ["listar_borradores_whatsapp_empresa"]],
  ["descartá el borrador para Juan", ["descartar_borrador_whatsapp_empresa"]],
  ["¿está conectado mi WhatsApp?", ["estado_canal_whatsapp_empresa"]],
  ["mandá un broadcast por email a los leads de Nutrición", ["crear_broadcast"]],
  ["analizá mis chats de WhatsApp y decime cuál es mi cliente ideal", ["listar_chats","hilo_chat"]],
  ["mándale un WhatsApp a Juan diciendo que mañana le llamo", ["crear_borrador_whatsapp_empresa"]],
  ["envíale un mensaje por WhatsApp a Juan Pérez", ["crear_borrador_whatsapp_empresa"]],
  ["manda un whatsapp a Juan: mañana te llamo", ["crear_borrador_whatsapp_empresa"]],
  ["cierra la conversación de Juan", ["cerrar_chat"]],
  ["pospón el chat de Juan hasta mañana", ["posponer_chat"]],
  ["crea una etiqueta llamada Caliente", ["crear_etiqueta"]],
  ["crea un CRM nuevo", ["crear_crm"]],
  ["vincula el evento de Calendly a la etapa R1", ["vincular_evento_etapa"]],
  ["abre la conversación de Juan y léemela", ["hilo_chat"]],
  ["dame el hilo de WhatsApp con Juan", ["hilo_whatsapp_empresa","hilo_chat"]],
  ["qué le respondo a Juan por WhatsApp", ["recomendar_mensajes_whatsapp"]],
  ["crea un broadcast de email para los leads de Nutrición", ["crear_broadcast"]],
  ["cambia el teléfono del lead Juan a 5491199998888", ["editar_contacto_lead"]],
  ["activa el CRM automático", ["activar_crm_automatico"]],
  ["genera el diagnóstico del lead Juan", ["generar_insight_lead"]],
  ["carga el plan de pagos del lead Juan: 3 cuotas de 500", ["guardar_plan_pagos"]],
  ["reabrí el chat de Juan", ["reabrir_chat"]],
  ["quitale la etiqueta VIP a Juan", ["sacar_etiqueta_lead"]],
  ["archivá la etiqueta Frío", ["archivar_etiqueta"]],
  ["renombrá la etiqueta Frío a Tibio", ["editar_etiqueta"]],
  ["sincronizá la historia del chat de Juan", ["sincronizar_chat_whatsapp_empresa"]],
  ["ocultá el chat de mi mamá del WhatsApp", ["ocultar_contacto_whatsapp_empresa"]],
  ["prendé el envío real de WhatsApp", ["prender_envio_whatsapp"]],
  ["sacá a Juan del producto Mentoría", ["quitar_lead_de_producto"]],
  ["marcá a Juan como calificado", ["marcar_calificado"]],
  ["registrá un pago suelto de Juan de 200 dólares", ["registrar_pago_suelto"]],
  ["¿qué datos le faltan a Juan para pasar a Ganado?", ["requisitos_para_mover","faltantes_del_lead"]],
  ["¿qué notas tiene Juan?", ["notas_lead"]],
  ["¿qué reuniones tengo esta semana?", ["reuniones_proximas"]],
  ["¿Juan ya está cargado en el CRM? su tel es 5491122334455", ["duplicados_lead","buscar_leads"]],
  ["¿qué etiquetas tiene Juan?", ["etiquetas_lead"]],
  ["¿qué oferta tiene Juan?", ["oferta_del_lead"]],
  ["asignale a Juan la oferta Mentoría 1500", ["asignar_oferta_lead"]],
  ["¿cómo entran los leads a mi funnel?", ["ver_funnel","sugerencias_crm"]],
  ["declarar que los leads entran por anuncios de Meta y por Instagram", ["declarar_entradas_funnel"]],
  ["cargá la grabación de Fathom de Juan: https://fathom.video/share/abc", ["agregar_link_fathom"]],
  ["cancelá la reunión de Juan", ["proponer_cancelar_reunion","cancelar_reunion_calendly"]],
  ["reagendá la reunión de Juan al viernes a las 10", ["proponer_mover_reunion"]],
  ["mandale a Juan el link de Calendly", ["link_agenda_calendly"]],
  ["¿qué leads entraron hoy?", ["listar_leads"]],
  ["¿cuántos chats tiene asignados Pedro?", ["listar_chats"]],
  ["¿quién me escribió por Instagram?", ["listar_chats"]],
  ["¿qué emails mandamos a Juan?", ["historial_email_lead"]],
  ["programá el broadcast de Black Friday para el viernes a las 10", ["programar_broadcast"]],
  ["armá una secuencia de emails para los que no asistieron", ["crear_secuencia_email"]],
  ["¿está verificado mi dominio de email?", ["estado_email"]],
  ["poné el chat de Juan en la etapa Calificado", ["proponer_cambio_etapa"]],
  ["dejá un comentario interno en el chat de Juan: ojo que es amigo", ["agregar_nota_lead"]],
  ["creá una plantilla de WhatsApp para recordar la reunión", ["guardar_borrador_plantilla","redactar_plantilla_con_mako"]],
];

const AUTOMATIONS_CLIENTS: Caso[] = [
  ["Creame una automatización que todos los martes a las 3 de la tarde le escriba a todo el funnel recordándoles la clase", ["crear_automatizacion_con_ia"]],
  ["Creá una automatización desde la plantilla de lead que no asistió", ["crear_automatizacion_desde_plantilla"]],
  ["Mostrame cómo quedó la automatización de bienvenida", ["ficha_secuencia_mensajes"]],
  ["Pausá la automatización de bienvenida", ["proponer_toggle_nutricion"]],
  ["Pausa la automatización de bienvenida", ["proponer_toggle_nutricion"]],
  ["Activá la automatización Recordatorio clase reactivación", ["proponer_toggle_nutricion"]],
  ["Activa la automatización de bienvenida", ["proponer_toggle_nutricion"]],
  ["Duplicá la automatización de cobranza", ["duplicar_automatizacion"]],
  ["Duplica la automatización de cobranza", ["duplicar_automatizacion"]],
  ["Archivá la automatización vieja de reactivación", ["archivar_secuencia"]],
  ["Archiva la automatización vieja de reactivación", ["archivar_secuencia"]],
  ["Cambiá el segundo mensaje de la automatización de bienvenida para que diga que la clase es a las 19", ["editar_pasos_secuencia_mensajes"]],
  ["Cambiá la espera del paso 2 de la automatización de bienvenida a 48 horas", ["cambiar_espera_paso"]],
  ["Agregale una espera de 2 días antes del segundo mensaje de la automatización de bienvenida", ["cambiar_espera_paso","editar_pasos_secuencia_mensajes"]],
  ["Cambiá el disparador de la automatización de bienvenida para que arranque cuando le ponen la etiqueta VIP", ["cambiar_crons_secuencia"]],
  ["Hacé que la automatización de reactivación salga todos los martes a las 15", ["cambiar_crons_secuencia"]],
  ["Cambia el horario de la automatización de reactivación a los martes 15:00", ["cambiar_crons_secuencia"]],
  ["Mandame una prueba de la automatización de bienvenida", ["probar_secuencia"]],
  ["Prueba la automatización de bienvenida", ["probar_secuencia"]],
  ["¿Cuántos mensajes salieron esta semana de las automatizaciones?", ["metricas_chatbot"]],
  ["¿Qué etapas de mi funnel no tienen automatización?", ["huecos_secuencias"]],
  ["¿Qué mensajes de las automatizaciones están esperando que los apruebe?", ["listar_borradores_whatsapp_empresa"]],
  ["Meté a Juan Pérez en la secuencia de reactivación", ["inscribir_lead_secuencia"]],
  ["Inscribe a Juan Pérez en la secuencia de reactivación", ["inscribir_lead_secuencia"]],
  ["Sacá a Juan Pérez de la secuencia de bienvenida", ["sacar_lead_de_secuencia"]],
  ["¿En qué secuencias está Juan Pérez?", ["inscripciones_lead"]],
  ["Enseñale a MaKo qué responder cuando un lead pregunta el precio en la secuencia de bienvenida", ["agregar_escenario_secuencia"]],
  ["Cambiá la estrategia de la automatización de bienvenida: el objetivo es agendar", ["guardar_estrategia_secuencia"]],
  ["Mandá a aprobar a Meta la plantilla del paso 3 de la secuencia de bienvenida", ["enviar_plantilla_meta_paso"]],
  ["Publicá mi automatización de bienvenida en Creaciones", ["publicar_creacion"]],
  ["Respondé automáticamente los comentarios de Instagram con el link de la clase", ["crear_automatizacion_con_ia"]],
  ["¿Por qué no salió la automatización recurrente de ayer?", ["ficha_secuencia_mensajes","plan_nutricion_hoy"]],
  ["¿Cómo va mi cartera de clientes?", ["ver_cartera_cs"]],
  ["¿Qué clientes no tuvieron contacto en las últimas dos semanas?", ["ver_cartera_cs"]],
  ["Mostrame la ficha de la clienta Ana López", ["ver_cliente_cs"]],
  ["¿Cuánto avanzó Ana López en el curso?", ["ver_avance_curso_cs"]],
  ["¿Cuánto avanzó Ana López en el curso del programa?", ["ver_avance_curso_cs"]],
  ["Invitá a Ana López al curso", ["invitar_cliente_curso_cs"]],
  ["Invita a Ana López al curso", ["invitar_cliente_curso_cs"]],
  ["Marcá a Ana López como baja porque se fue", ["marcar_estado_cliente_cs"]],
  ["Marcá a Ana López como baja en la cartera", ["marcar_estado_cliente_cs"]],
  ["¿Qué cursos tengo?", ["listar_cursos"]],
  ["Mostrame el curso", ["ver_curso"]],
  ["Llevá a Juan Pérez a MaKo Partners", ["llevar_a_partners"]],
];

const PLAN: Caso[] = [
  ["¿qué tengo que hacer hoy?", ["ver_prioridades_plan","ver_plan","listar_tareas_plan"]],
  ["mostrame mis tareas", ["listar_tareas_plan","ver_plan"]],
  ["muéstrame mis tareas", ["listar_tareas_plan","ver_plan"]],
  ["anotá: llamar al contador el jueves", ["proponer_tareas_plan"]],
  ["creá una tarea para revisar la landing el viernes", ["proponer_tareas_plan"]],
  ["crea una tarea para revisar la landing el viernes", ["proponer_tareas_plan"]],
  ["agregá una tarea: mandar la factura a Leila", ["proponer_tareas_plan"]],
  ["agrega una tarea: mandar la factura a Leila", ["proponer_tareas_plan"]],
  ["cambiá la fecha de la tarea de revisar la landing al viernes", ["cambiar_fecha_tarea_plan"]],
  ["cambia la fecha de la tarea de revisar la landing al viernes", ["cambiar_fecha_tarea_plan"]],
  ["pasá la tarea de revisar la landing a en progreso", ["mover_tarea_plan"]],
  ["pasa la tarea de revisar la landing a en progreso", ["mover_tarea_plan"]],
  ["marcá como hecha la tarea de revisar la landing", ["cerrar_tareas_plan","proponer_cierre_tareas"]],
  ["marca como hecha la tarea de revisar la landing", ["cerrar_tareas_plan","proponer_cierre_tareas"]],
  ["cerrá la tarea de grabar el VSL, ya la hice", ["cerrar_tareas_plan","proponer_cierre_tareas"]],
  ["cierra la tarea de grabar el VSL, ya la hice", ["cerrar_tareas_plan","proponer_cierre_tareas"]],
  ["ya terminé el video de ventas", ["proponer_cierre_tareas","cerrar_tareas_plan"]],
  ["repriorizá todo el plan", ["repriorizar_plan"]],
  ["reprioriza todo el plan", ["repriorizar_plan"]],
  ["¿qué tareas están vencidas?", ["listar_tareas_vencidas"]],
  ["creá una tarea que se repita todos los martes a las 3", ["proponer_tareas_plan"]],
  ["sacá las tareas de la última reunión de Fathom", ["ver_borrador_de_reunion","listar_reuniones_fathom","proponer_tareas_plan"]],
  ["la tarea de la landing depende de la del dominio", ["agregar_dependencia_plan"]],
  ["poneme el avance de la tarea de la landing al 50%", ["actualizar_avance_tarea"]],
  ["ponme el avance de la tarea de la landing al 50%", ["actualizar_avance_tarea"]],
  ["¿qué proyectos no tienen tareas?", ["listar_proyectos_vacios"]],
  ["¿cómo va el proyecto Lanzamiento?", ["ver_proyecto_plan"]],
  ["quitá la dependencia entre la tarea de la landing y la del dominio", ["quitar_dependencia_plan"]],
  ["descartá el borrador de tareas", ["descartar_borrador_plan"]],
  ["descarta el borrador de tareas", ["descartar_borrador_plan"]],
];

const CALENDARIO: Caso[] = [
  ["agendá en el calendario un reel el jueves a las 10", ["crear_evento_calendario"]],
  ["agenda un reel para el jueves a las 10", ["crear_evento_calendario"]],
  ["agregá un evento al calendario: grabar el VSL el viernes", ["crear_evento_calendario"]],
  ["agrega un evento al calendario: grabar el VSL el viernes", ["crear_evento_calendario"]],
  ["¿qué eventos hay en el calendario esta semana?", ["listar_eventos_calendario"]],
  ["creá un evento en Google Calendar mañana a las 9", ["crear_evento_google","proponer_agendar_agenda"]],
  ["crea un evento en Google Calendar mañana a las 9", ["crear_evento_google","proponer_agendar_agenda"]],
  ["¿cuándo se repiten mis tareas recurrentes?", ["ver_proximas_recurrentes"]],
];

const DASHBOARD: Caso[] = [
  ["¿cuánto vendí este mes?", ["metricas_negocio","ver_revenue_periodo","analisis_negocio"]],
  ["creá una hoja de ventas con los leads por etapa", ["crear_hoja_dashboard"]],
  ["crea una hoja de ventas con los leads por etapa", ["crear_hoja_dashboard"]],
  ["agregá un gráfico de inversión por campaña a la hoja de Marketing", ["agregar_grafico_dashboard"]],
  ["agrega un gráfico de leads por semana al dashboard", ["agregar_grafico_dashboard"]],
  ["analizá la hoja de Marketing", ["analizar_hoja_dashboard","leer_analisis_dashboard"]],
  ["analiza la hoja de Marketing", ["analizar_hoja_dashboard","leer_analisis_dashboard"]],
  ["cambiá el color de la hoja de Marketing a oscuro", ["editar_hoja_dashboard","editar_hoja_con_ia_dashboard"]],
  ["cambia el color de la hoja de Marketing a oscuro", ["editar_hoja_dashboard","editar_hoja_con_ia_dashboard"]],
  ["borrá la hoja de Marketing", ["borrar_hoja_dashboard"]],
  ["borra la hoja de Marketing", ["borrar_hoja_dashboard"]],
  ["duplicá la hoja de Marketing", ["duplicar_hoja_dashboard"]],
  ["duplica la hoja de Marketing", ["duplicar_hoja_dashboard"]],
  ["filtrá la hoja de Marketing por la campaña Black Friday", ["agregar_filtro_dashboard"]],
  ["filtra la hoja de Marketing por la campaña Black Friday", ["agregar_filtro_dashboard"]],
  ["quitá el filtro de la hoja de Marketing", ["quitar_filtro_dashboard"]],
  ["programá el análisis de la hoja de Marketing todos los lunes", ["programar_analisis_dashboard"]],
  ["programa el análisis de la hoja de Marketing todos los lunes", ["programar_analisis_dashboard"]],
  ["generá las conclusiones de la hoja de Marketing", ["generar_conclusiones_dashboard"]],
  ["genera las conclusiones de la hoja de Marketing", ["generar_conclusiones_dashboard"]],
  ["unime el gráfico de leads con el de ventas con una flecha", ["conectar_componentes_dashboard"]],
  ["une el gráfico de leads con el de ventas con una flecha", ["conectar_componentes_dashboard"]],
  ["insertá un texto en la hoja de Marketing", ["insertar_elemento_dashboard"]],
  ["inserta un texto en la hoja de Marketing", ["insertar_elemento_dashboard"]],
  ["restablecé el informe del Dashboard", ["restablecer_informe_dashboard"]],
  ["restablece el informe del Dashboard", ["restablecer_informe_dashboard"]],
  ["quitá el gráfico de leads de la hoja de Marketing", ["quitar_componente_dashboard"]],
  ["quita el gráfico de leads de la hoja de Marketing", ["quitar_componente_dashboard"]],
];

const VIDEO: Caso[] = [
  ["editá mi último video y sacale las muletillas", ["eliminar_muletillas_video"]],
  ["edita mi último video y quítale las muletillas", ["eliminar_muletillas_video"]],
  ["ponele subtítulos al video del lunes", ["generar_subtitulos_video"]],
  ["ponle subtítulos al video del lunes", ["generar_subtitulos_video"]],
  ["cortá los primeros 5 segundos del video", ["recortar_clip_video","cortar_tramo_video"]],
  ["corta los primeros 5 segundos del video", ["recortar_clip_video","cortar_tramo_video"]],
  ["dividí el clip en dos en el segundo 10", ["dividir_clip_video"]],
  ["divide el clip en dos en el segundo 10", ["dividir_clip_video"]],
  ["subile el volumen al clip 2", ["cambiar_volumen_video"]],
  ["sube el volumen al clip 2", ["cambiar_volumen_video"]],
  ["silenciá el clip del fondo", ["silenciar_clip_video"]],
  ["silencia el clip del fondo", ["silenciar_clip_video"]],
  ["acelerá el clip a 1.5x", ["cambiar_velocidad_video"]],
  ["acelera el clip a 1.5x", ["cambiar_velocidad_video"]],
  ["cambiá la velocidad del clip v1 a 2x", ["cambiar_velocidad_video"]],
  ["agregá un texto que diga Oferta final al video", ["agregar_texto_video"]],
  ["agrega un texto que diga Oferta final al video", ["agregar_texto_video"]],
  ["cambiá el texto del título del video a Aprende a vender", ["cambiar_texto_video"]],
  ["poné un fundido de salida al audio", ["poner_fundido_video"]],
  ["pon un fundido de salida al audio", ["poner_fundido_video"]],
  ["reducí el ruido del audio del video", ["reducir_ruido_video"]],
  ["reduce el ruido de fondo del audio", ["reducir_ruido_video"]],
  // Leila (27/10/2026) se lo pidió así a MaKo en el editor; «borrar silencios» no estaba en el chat.
  ["eliminá el ruido del video", ["reducir_ruido_video"]],
  ["elimina el ruido del video", ["reducir_ruido_video"]],
  ["borrá los silencios de mi último video", ["borrar_silencios_video"]],
  ["borra los silencios de mi último video", ["borrar_silencios_video"]],
  ["sacale los silencios al video Promo", ["borrar_silencios_video"]],
  ["quítale los silencios al video Promo", ["borrar_silencios_video"]],
  ["normalizá el audio del video", ["normalizar_audio_video"]],
  ["sacale el audio al clip y dejame solo el sonido", ["separar_audio_video"]],
  ["poné una transición entre el clip 1 y el 2", ["poner_transicion_video"]],
  ["ponele un filtro cálido al clip", ["poner_filtro_video"]],
  ["ajustá el color del clip: más contraste", ["ajustar_color_video"]],
  ["ajusta el color del clip", ["ajustar_color_video"]],
  ["reflejá el clip", ["reflejar_clip_video"]],
  ["congelá un cuadro en el segundo 5", ["congelar_cuadro_video"]],
  ["cortá la frase donde digo eh", ["cortar_frase_video"]],
  ["resaltá la palabra que se dice en los subtítulos", ["resaltar_palabras_video"]],
  ["reemplazá la palabra gratis por sin costo en los subtítulos", ["reemplazar_en_subtitulos_video"]],
  ["borrá el clip 3 del video", ["borrar_elementos_video"]],
  ["usá la plantilla de anuncio para armar el video", ["usar_plantilla_video"]],
  ["mostrame mis proyectos de video", ["listar_proyectos_video"]],
  ["¿cuántos créditos de Flow me quedan?", ["ver_saldo_flow"]],
  // Los motion graphics (10/11/2026): «motion» no nombraba el área video y agregar_motion_video no viajaba.
  ["agrega un motion graphic que diga Vende más", ["agregar_motion_video"]],
  ["agregá un motion graphic que diga Vende más", ["agregar_motion_video"]],
  ["cambia el título del motion a Vende más", ["editar_motion_video"]],
  ["cambiá el título del motion a Vende más", ["editar_motion_video"]],
];

const IMAGEN: Caso[] = [
  ["creame un flyer para la promo de noviembre", ["crear_diseno_imagen"]],
  ["creá un flyer para la promo de noviembre", ["crear_diseno_imagen"]],
  ["crea un banner para el webinar", ["crear_diseno_imagen"]],
  ["cambiá el texto del banner a 50% off", ["cambiar_textos_diseno_imagen"]],
  ["cambia el texto del flyer a 50% off", ["cambiar_textos_diseno_imagen"]],
  ["duplicá el diseño del flyer", ["duplicar_diseno_imagen"]],
  ["borrá el diseño del banner", ["borrar_diseno_imagen"]],
  ["mostrame mis diseños", ["listar_disenos_imagen"]],
  // Los carruseles que funcionan (4/11/2026, lib/carruseles/): llegan sin una familia propia (medido: con una, igual 48/48).
  ["¿qué carruseles funcionan esta semana?", ["buscar_carruseles"]],
  ["buscame carruseles con outlier alto de @estudio.lumen", ["buscar_carruseles"]],
  ["guardá ese carrusel en mis referencias", ["guardar_carrusel"]],
  ["haceme uno con la estructura de ese carrusel de @estudio.lumen", ["crear_carrusel_desde_referencia"]],
  ["crea un carrusel como el de @cafebrasa pero para mi negocio", ["crear_carrusel_desde_referencia"]],
  ["publicá mi landing en la galería de la comunidad", ["publicar_creacion"]],
  ["dale una estrella a esa creación", ["dar_estrella"]],
];

const COBROS: Caso[] = [
  ["mandale el link de pago a Ana", ["crear_link_pago"]],
  ["generá un link de pago de 500 dólares para Juan", ["crear_link_pago"]],
  ["genera un link de pago de 500 dólares para Juan", ["crear_link_pago"]],
  ["anulá el link de pago de Ana", ["anular_link_pago"]],
  ["anula el link de pago de Ana", ["anular_link_pago"]],
  ["reembolsale el pago a Carlos", ["reembolsar_cobro"]],
  ["reembolsa el cobro de Carlos", ["reembolsar_cobro"]],
  ["cancelá la suscripción de Pedro", ["cancelar_suscripcion"]],
  ["cancela la suscripción de Pedro", ["cancelar_suscripcion"]],
  ["¿cuánto cobré este mes?", ["listar_cobros","ver_revenue_periodo","metricas_negocio"]],
  ["mostrame los cobros de Stripe", ["listar_cobros"]],
  ["cambiá la moneda del negocio a dólares", ["cambiar_moneda_negocio"]],
  ["cambia la moneda del negocio a pesos", ["cambiar_moneda_negocio"]],
  ["editá la cuota 3 de Juan: que sea de 600", ["editar_cuota"]],
  ["edita la cuota 3 de Juan", ["editar_cuota"]],
  ["cobrale la cuota 2 a Juan con un link", ["crear_link_cuota"]],
  ["cobra la cuota 2 de Juan con un link", ["crear_link_cuota"]],
  ["cortá el recordatorio de la cuota de Juan", ["cortar_recordatorio_cuota"]],
  ["corta el recordatorio de la cuota de Juan", ["cortar_recordatorio_cuota"]],
  ["dale de baja a Juan", ["baja_del_cliente"]],
  ["cancelá la suscripción manual de Ana", ["estado_suscripcion_manual","cancelar_suscripcion"]],
  ["editá la venta de Juan: 1500 dólares", ["editar_venta_lead"]],
  // El plan por tramos (ticket #26, 29/10/2026): la frase LITERAL de Mauricio, que no traía la herramienta, y la de Leila (#13).
  ["7500 dolares en 3 pagos, primer pago 28 de octubre, segundo pago 28 de noviembre y tercer pago 28 de diciembre. Cada uno de $2,500 dólares.", ["armar_plan_por_tramos"]],
  ["el plan de Nadia son 300 dólares cada quincena, los días 1 y 15", ["armar_plan_por_tramos"]],
  ["armá el plan de pagos de Fernando: 3 cuotas de 2500 dólares los 28", ["armar_plan_por_tramos"]],
  ["arma el plan de pagos de Juan: 6 meses de 12.000 pesos y después 6 de 10.000", ["armar_plan_por_tramos"]],
];

const EQUIPO: Caso[] = [
  ["invitá a pedro@mail.com al equipo como setter", ["invitar_miembro_equipo"]],
  ["invita a pedro@mail.com al equipo como setter", ["invitar_miembro_equipo"]],
  ["cambiale el rol a Pedro a closer", ["cambiar_rol_miembro"]],
  ["cambia el rol de Pedro a closer", ["cambiar_rol_miembro"]],
  ["suspendé a Pedro del equipo", ["suspender_miembro"]],
  ["suspende a Pedro del equipo", ["suspender_miembro"]],
  ["eliminá a Pedro del equipo", ["eliminar_miembro"]],
  ["elimina a Pedro del equipo", ["eliminar_miembro"]],
  ["reenviale la invitación a Pedro", ["reenviar_invitacion"]],
  ["reenvía la invitación a Pedro", ["reenviar_invitacion"]],
  ["prendé el reporte diario", ["configurar_reporte"]],
  ["activa el reporte semanal", ["configurar_reporte"]],
  ["apagá el aviso de reunión agendada", ["configurar_aviso_whatsapp"]],
  ["apaga el aviso de nueva venta", ["configurar_aviso_whatsapp"]],
  ["sumá a ana@mail.com a los reportes", ["agregar_destinatario_notificaciones"]],
  ["suma a ana@mail.com a los reportes", ["agregar_destinatario_notificaciones"]],
  ["sacá a Ana de los reportes", ["quitar_destinatario_notificaciones"]],
  ["saca a Ana de los reportes", ["quitar_destinatario_notificaciones"]],
  ["poné la zona horaria en Buenos Aires", ["fijar_zona_horaria_workspace"]],
  ["pon la zona horaria de México", ["fijar_zona_horaria_workspace"]],
  ["guardá mi identidad fiscal: Mi Negocio SA", ["guardar_identidad_fiscal"]],
  ["borrá la identidad fiscal vieja", ["borrar_identidad_fiscal"]],
  ["¿quién está en mi equipo?", ["listar_equipo"]],
  ["levantá un ticket: no me carga el CRM", ["levantar_ticket"]],
  ["levanta un ticket: no me carga el CRM", ["levantar_ticket"]],
  ["renombrá este chat a Reunión semanal", ["renombrar_chat_mako"]],
];

const NEGOCIO: Caso[] = [
  ["completá el campo propuesta de valor del perfil: ayudo a vender más", ["guardar_campo_perfil"]],
  ["completa el campo propuesta de valor del perfil", ["guardar_campo_perfil"]],
  ["guardá mi muletilla o sea", ["guardar_muletillas_marca"]],
  ["guarda las muletillas de mi marca: o sea, tipo", ["guardar_muletillas_marca"]],
  ["regenerá mis avatares", ["generar_avatares"]],
  ["regenera los avatares con MaKo", ["generar_avatares"]],
  ["afiná los avatares con estas respuestas", ["afinar_avatares"]],
  ["editá el avatar de la mamá emprendedora", ["editar_avatar_negocio"]],
  ["edita el avatar de la mamá emprendedora", ["editar_avatar_negocio"]],
  ["borrá el avatar viejo", ["borrar_avatar_negocio"]],
  ["generá lead magnets para mi negocio", ["generar_lead_magnets"]],
  ["genera lead magnets para mi negocio", ["generar_lead_magnets"]],
  ["editá el lead magnet de la guía", ["editar_lead_magnet"]],
  ["armame el catálogo de productos", ["sugerir_productos"]],
  ["arma el catálogo de productos con MaKo", ["sugerir_productos"]],
  ["borrá el producto Mentoría", ["borrar_producto"]],
  ["reiniciá el quiz de voz", ["reiniciar_personalidad"]],
  ["reinicia el quiz de personalidad", ["reiniciar_personalidad"]],
  ["guardá el diagnóstico de fase: etapa de validación", ["guardar_diagnostico_fase"]],
  ["borrá el documento del archivero", ["borrar_documento_archivero"]],
  // Ticket #44 (3/11/2026): la frase del cliente salía `consultar` y la tarjeta que lo guarda no viajaba.
  ["te cargo un documento con toda la información que necesitas saber de mi negocio, analizalo e incorporalo al second brain", ["sumar_documento_second_brain"]],
  ["sumá este documento al second brain", ["sumar_documento_second_brain"]],
  ["guardá este documento en el archivero", ["sumar_documento_second_brain"]],
  ["incorporá esto a mi segundo cerebro", ["sumar_documento_second_brain"]],
  ["quiero dar de baja mi plan de MaKo", ["dar_de_baja_mi_plan"]],
  ["mostrame el análisis de mi oferta", ["ver_analisis_oferta","listar_analisis_oferta"]],
  ["guardá la oferta del análisis en los funnels", ["guardar_oferta_analisis"]],
  ["buscá en mi segundo cerebro lo que dije del precio", ["buscar_en_segundo_cerebro","recuperar_del_segundo_cerebro"]],
  ["mostrame mis avatares", ["listar_avatares_negocio"]],
  ["¿cuál es mi cara de marca?", ["ver_cara_de_marca"]],
];

const CONTENIDO: Caso[] = [
  ["escribí un guion de anuncio para la mentoría", ["escribir_guion_anuncio","escribir_guion_anuncio_auto","sugerir_guion_anuncio"]],
  ["escribe un guion de anuncio para la mentoría", ["escribir_guion_anuncio","escribir_guion_anuncio_auto","sugerir_guion_anuncio"]],
  ["reescribí el texto del guion 3", ["editar_texto_guion_anuncio"]],
  ["reescribe el guion del anuncio ganador", ["editar_texto_guion_anuncio"]],
  ["borrá el guion 3 del anuncio", ["borrar_guion_anuncio"]],
  ["pasá el guion 3 a aprobado", ["mover_estado_guion_anuncio"]],
  // La recomendación de formatos a nivel negocio salió el 23/10/2026: la frase lleva al formato POR ANUNCIO.
  ["recomendame formatos de creativo para mi anuncio", ["elegir_formato_creativo_anuncio", "listar_formatos_creativo"]],
  ["mostrame mis guiones de anuncio", ["listar_guiones_anuncio"]],
];

const EXPERIMENTOS: Caso[] = [
  ["creá un experimento para probar un hook nuevo", ["crear_experimento"]],
  ["crea un experimento: probar un precio de 500", ["crear_experimento"]],
  ["arrancá el experimento del hook", ["iniciar_experimento"]],
  ["arranca el experimento del hook nuevo", ["iniciar_experimento"]],
  ["cerrá el experimento con veredicto: funcionó", ["cerrar_experimento"]],
  ["descartá el experimento del precio", ["descartar_experimento"]],
  ["proponeme experimentos para subir las ventas", ["idear_experimentos"]],
  ["¿cómo van los experimentos?", ["estado_experimentos","listar_experimentos","vista_experimentos"]],
  ["borrá la retro del mes pasado", ["borrar_retro"]],
  ["aceptá el item 2 del plan de la retro", ["aceptar_item_plan_retro"]],
];

const LANDING: Caso[] = [
  ["creame una landing para mi mentoría", ["generar_landing_con_ia","crear_landing_en_blanco","crear_landing_desde_diseno"]],
  ["quiero una web para mi negocio", ["generar_landing_con_ia","crear_landing_en_blanco","crear_landing_desde_diseno"]],
  ["cambiá el título de la landing del webinar por Aprende a vender", ["cambiar_texto_landing","editar_landing_con_ia"]],
  ["cambia el título de la landing del webinar por Aprende a vender", ["cambiar_texto_landing","editar_landing_con_ia"]],
  ["publicá la landing del webinar", ["publicar_landing"]],
  ["publica la landing del webinar", ["publicar_landing"]],
  ["despublicá la landing del webinar", ["despublicar_landing"]],
  ["despublica la landing del webinar", ["despublicar_landing"]],
  ["pausá la landing del webinar", ["pausar_landing"]],
  ["replicá esta página https://ejemplo.com", ["replicar_landing"]],
  ["replica esta landing https://ejemplo.com", ["replicar_landing"]],
  ["agregale una sección de testimonios a mi página", ["agregar_seccion_landing","editar_landing_con_ia"]],
  ["agrega una sección de testimonios a mi landing", ["agregar_seccion_landing","editar_landing_con_ia"]],
  ["movele la sección de precios arriba en la landing", ["acomodar_seccion_landing"]],
  ["mueve la sección de precios arriba en la landing", ["acomodar_seccion_landing"]],
  ["borrá la sección de preguntas de la landing", ["acomodar_seccion_landing"]],
  ["ocultá la sección de testimonios de la landing", ["acomodar_seccion_landing"]],
  ["cambiá el tema de la landing a oscuro", ["cambiar_tema_landing"]],
  ["cambia el tema de la landing del webinar", ["cambiar_tema_landing"]],
  ["conectá el dominio midominio.com a la landing", ["conectar_dominio_landing"]],
  ["conecta el dominio midominio.com a mi landing", ["conectar_dominio_landing"]],
  ["verificá el dominio de la landing", ["verificar_dominio_landing"]],
  ["sacale el dominio a la landing", ["quitar_dominio_landing"]],
  ["ponele el link del VSL a la landing", ["poner_enlace_landing"]],
  ["poné el enlace de la agenda en la landing", ["poner_enlace_landing"]],
  ["cambiá el botón de la landing: que diga Quiero mi cupo", ["configurar_boton_landing"]],
  ["cambia el formulario de la landing: agrega el teléfono", ["configurar_formulario_landing"]],
  ["duplicá la landing del webinar", ["duplicar_landing"]],
  ["renombrá la landing del webinar a Webinar octubre", ["renombrar_landing"]],
  ["mandá la landing vieja a la papelera", ["mandar_landing_a_papelera"]],
  ["guardá una versión de la landing", ["guardar_version_landing"]],
  ["volvé la landing a la versión de ayer", ["restaurar_version_landing"]],
  ["pasame un link privado del borrador de la landing", ["compartir_borrador_landing"]],
  ["aplicá todos los comentarios del diagnóstico a la landing", ["aplicar_todos_comentarios_landing"]],
  ["analizá mi landing", ["analizar_landing","diagnosticar_landing_creada"]],
  ["ponele animación al hero de la landing", ["cambiar_animacion_landing"]],
  ["cobrá 500 dólares con el botón de la landing", ["cobrar_producto_landing"]],
  ["agregá una página de gracias al sitio", ["acomodar_pagina_landing"]],
  ["cambiá la barra de navegación de la landing", ["configurar_navegacion_landing"]],
];

const ADS: Caso[] = [
  ["pausá la campaña de remarketing", ["proponer_estado_campana"]],
  ["pausa la campaña de remarketing", ["proponer_estado_campana"]],
  ["activá la campaña de remarketing", ["proponer_estado_campana"]],
  ["activa el conjunto de Buenos Aires", ["proponer_estado_conjunto"]],
  ["pausá el anuncio ganador", ["proponer_estado_anuncio"]],
  ["subí el presupuesto de la campaña de remarketing a 50 dólares", ["proponer_presupuesto_campana"]],
  ["sube el presupuesto de la campaña a 50 dólares", ["proponer_presupuesto_campana"]],
  ["bajale el presupuesto al conjunto de México a 20", ["proponer_presupuesto_conjunto"]],
  ["baja el presupuesto del conjunto de México a 20", ["proponer_presupuesto_conjunto"]],
  ["renombrá la campaña de remarketing a Retargeting", ["proponer_renombrar_campana"]],
  ["renombra la campaña Black Friday a BF 2026", ["proponer_renombrar_campana"]],
  ["cambiá el texto del anuncio ganador", ["proponer_editar_textos_anuncio"]],
  ["cambia el texto del anuncio ganador", ["proponer_editar_textos_anuncio"]],
  ["eliminá el conjunto pausado de prueba", ["proponer_eliminar_entidad_meta"]],
  ["elimina el anuncio pausado", ["proponer_eliminar_entidad_meta"]],
  ["agregá un anuncio al conjunto de Buenos Aires", ["proponer_agregar_anuncio"]],
  ["agrega un anuncio al conjunto", ["proponer_agregar_anuncio"]],
  ["editá el público del conjunto de Buenos Aires", ["proponer_editar_publico_conjunto"]],
  ["creá un público de retargeting de los que vieron el VSL", ["proponer_crear_publico_meta"]],
  ["crea un público de retargeting", ["proponer_crear_publico_meta"]],
  ["creá un formulario instantáneo para el webinar", ["proponer_crear_formulario_meta"]],
  ["crea un formulario instantáneo", ["proponer_crear_formulario_meta"]],
  ["sincronizá los guiones pendientes", ["proponer_sincronizar_guiones"]],
  ["volvé a analizar el guion 3", ["proponer_reanalizar_guion"]],
  ["corregí el ángulo del guion 3", ["proponer_corregir_angulo_guion"]],
  ["agregá un ángulo al vocabulario: urgencia", ["proponer_agregar_angulo"]],
  ["borrá el ángulo urgencia del vocabulario", ["proponer_borrar_angulo"]],
  ["agregá un avatar al vocabulario: mamá emprendedora", ["proponer_agregar_avatar"]],
  ["¿cómo van las campañas?", ["listar_campanas_meta"]],
  ["¿qué anuncios fueron rechazados?", ["listar_anuncios_con_problemas_meta"]],
];

const VIDEO_ED_AVATAR: Caso[] = [
  ["cortá los primeros 3 segundos del video Promo octubre", ["recortar_clip_video","cortar_tramo_video"]],
  ["corta los primeros 3 segundos del video Promo octubre", ["recortar_clip_video","cortar_tramo_video"]],
  ["¿podés cortar el video Promo en el segundo 5?", ["dividir_clip_video"]],
  ["agregale subtítulos al video de la promo", ["generar_subtitulos_video"]],
  ["agrega subtítulos al video Promo", ["generar_subtitulos_video"]],
  ["quiero que le pongas subtítulos al video Promo", ["generar_subtitulos_video"]],
  ["cambiá el video Promo: ponele subtítulos", ["generar_subtitulos_video"]],
  ["¿le podés poner subtítulos al video Promo?", ["generar_subtitulos_video"]],
  ["sacale las muletillas a mi último video", ["eliminar_muletillas_video"]],
  ["elimina las muletillas del video Promo", ["eliminar_muletillas_video"]],
  ["eliminá las muletillas del video Promo", ["eliminar_muletillas_video"]],
  ["poné un texto que diga 50% off al inicio del video Promo", ["agregar_texto_video"]],
  ["Mako, ponle un texto que diga 50% off al inicio del video Promo", ["agregar_texto_video"]],
  ["agregá un texto que diga Oferta al video Promo", ["agregar_texto_video"]],
  ["cambia el texto del video Promo que dice Hola por Bienvenidos", ["cambiar_texto_video"]],
  ["cambiá el texto del video Promo que dice Hola por Bienvenidos", ["cambiar_texto_video"]],
  ["subile el volumen a la música del video Promo", ["cambiar_volumen_video"]],
  ["sube la música del video Promo", ["cambiar_volumen_video"]],
  ["subí el volumen de la música del video Promo", ["cambiar_volumen_video"]],
  ["ponele una transición entre los clips del video Promo", ["poner_transicion_video"]],
  ["actualizá el video Promo con una transición entre v1 y v2", ["poner_transicion_video"]],
  ["acelera el clip 2 del video Promo al doble", ["cambiar_velocidad_video"]],
  ["cambiá la velocidad del clip v1 del video Promo al doble", ["cambiar_velocidad_video"]],
  ["mové el texto t2 del video Promo al segundo 3", ["mover_elemento_video"]],
  ["armame un video con la plantilla de testimonio", ["usar_plantilla_video","listar_plantillas_video"]],
  ["usa la plantilla de testimonio en el video Promo", ["usar_plantilla_video"]],
  ["editá mi video", ["listar_proyectos_video"]],
  ["necesito editar un video", ["listar_proyectos_video"]],
  ["quiero editar mis videos desde acá", ["listar_proyectos_video"]],
  ["hazme un video para Instagram con mis fotos", ["listar_plantillas_video"]],
  ["exportá el video Promo en 1080", ["ver_proyecto_video"]],
  ["quitale el fondo al clip del video Promo", ["ver_proyecto_video"]],
  ["borrá los silencios del video Promo", ["ver_proyecto_video"]],
];

const PREGUNTAS_EDITOR_AVATAR: Caso[] = [
  ["¿qué proyectos tengo en el editor de video?", ["listar_proyectos_video"]],
  ["¿qué plantillas de video hay?", ["listar_plantillas_video"]],
];

const IMAGEN_AVATAR: Caso[] = [
  ["creame un flyer para la inauguración del sábado", ["crear_diseno_imagen","listar_plantillas_imagen"]],
  ["diseñame un banner para la promo", ["crear_diseno_imagen","listar_plantillas_imagen"]],
  ["haceme una historia de instagram para la promo", ["crear_diseno_imagen","listar_plantillas_imagen"]],
  ["cambiá el texto del banner de la promo a 30% off", ["cambiar_textos_diseno_imagen"]],
  ["¿qué diseños tengo?", ["listar_disenos_imagen"]],
  ["duplicá el diseño de la promo", ["duplicar_diseno_imagen"]],
  ["borrá el diseño Promo vieja", ["borrar_diseno_imagen"]],
  ["eliminá el diseño Promo vieja", ["borrar_diseno_imagen"]],
  ["cambiá el diseño Promo: fondo azul", ["listar_disenos_imagen"]],
  ["cambiá el color de fondo del flyer a azul", ["listar_disenos_imagen"]],
  ["poné mi logo en el flyer", ["listar_disenos_imagen"]],
  ["descargá el flyer en PNG", ["listar_disenos_imagen"]],
  ["exportá el diseño Promo en PDF", ["listar_disenos_imagen"]],
];

const GENERATOR_AVATAR: Caso[] = [
  ["¿cómo van mis videos?", ["listar_anuncios_video"]],
  ["filmá el guion de la promo", ["listar_guiones_para_video"]],
  ["grabá el anuncio del guion nuevo", ["listar_guiones_para_video"]],
  ["¿qué guiones me faltan filmar?", ["listar_guiones_para_video"]],
  ["¿me alcanzan los créditos de Flow para filmar el anuncio?", ["ver_saldo_flow","calcular_alcance_anuncio"]],
  ["¿por qué no se filma mi anuncio?", ["ver_puente_flow","listar_trabajos_flow"]],
  ["¿está conectada la extensión de Flow?", ["ver_puente_flow"]],
  ["montá el anuncio de la promo", ["ver_montaje_anuncio"]],
  ["¿cómo va el montaje del anuncio?", ["ver_montaje_anuncio"]],
  ["regenerá la toma 3 del anuncio", ["ver_anuncio_video"]],
  ["¿tengo listo mi avatar?", ["ver_avatares"]],
  ["creame un avatar en la oficina", ["ver_avatares"]],
  ["hacé que mi avatar diga: hola, soy Juan", ["ver_avatares"]],
  ["¿qué acento tiene mi voz?", ["ver_voz_cliente"]],
  ["cloná mi voz", ["ver_voz_cliente"]],
  ["cambiá el acento a mexicano", ["ver_contexto_video"]],
];

// --- 1. Cada frase medida llega a su operación ------------------------------------------------------------------------------

test('núcleo: 40 pedidos naturales llegan a su operación por la app', () => {
  assert.deepEqual(faltan(NUCLEO), []);
});
test('CRM y Chats: las 91 frases medidas llegan a su operación por la app', () => {
  assert.deepEqual(faltan(CRM), []);
});
test('Automations y Clients: las frases medidas llegan a su operación por la app', () => {
  assert.deepEqual(faltan(AUTOMATIONS_CLIENTS), []);
});
test('Plan: las 30 frases (tuteo y voseo) llegan a su operación por la app', () => {
  assert.deepEqual(faltan(PLAN), []);
});
test('Calendario: las 8 frases (tuteo y voseo) llegan a su operación por la app', () => {
  assert.deepEqual(faltan(CALENDARIO), []);
});
test('Dashboard: las 28 frases (tuteo y voseo) llegan a su operación por la app', () => {
  assert.deepEqual(faltan(DASHBOARD), []);
});
test('video: las 41 frases (tuteo y voseo) llegan a su operación por la app', () => {
  assert.deepEqual(faltan(VIDEO), []);
});

test('video: «motion» nombra el área video, salvo en una frase de la landing (ahí es una animación de la landing)', () => {
  // Sin la excepción, las herramientas del editor de video le sacaban el lugar a las de la landing en el presupuesto
  // (medido el 10/11/2026: «agrega un motion graphic a la landing…» perdía guardar_landing y listar_landings).
  assert.ok(AREA_KEYWORDS.video.test('agrega un motion graphic que diga Vende más'));
  assert.ok(AREA_KEYWORDS.video.test('pon unos motion graphics al inicio'));
  for (const f of ['agrega un motion graphic a la landing con el título Vende más', 'en mi landing pon un motion graphic', 'agrégale una animación motion al hero de mi landing', 'quiero un motion graphics en mi página']) {
    assert.equal(AREA_KEYWORDS.video.test(f), false, `«${f}»: es de la landing`);
  }
  // «promotion» no es un motion.
  assert.equal(AREA_KEYWORDS.video.test('la promotion de noviembre'), false);
  const landing = turnoApp('agrégale una animación motion al hero de mi landing');
  assert.ok(landing.nombres.includes('cambiar_animacion_landing'), 'la animación de la landing llega');
  assert.ok(!landing.nombres.includes('agregar_motion_video'), 'y no la del editor de video');
});
test('imagen: las 10 frases (tuteo y voseo) llegan a su operación por la app', () => {
  assert.deepEqual(faltan(IMAGEN), []);
});
test('cobros: las 26 frases (tuteo y voseo) llegan a su operación por la app', () => {
  assert.deepEqual(faltan(COBROS), []);
});
test('equipo: las 26 frases (tuteo y voseo) llegan a su operación por la app', () => {
  assert.deepEqual(faltan(EQUIPO), []);
});
test('negocio: las 26 frases (tuteo y voseo) llegan a su operación por la app', () => {
  assert.deepEqual(faltan(NEGOCIO), []);
});
test('contenido: las 8 frases (tuteo y voseo) llegan a su operación por la app', () => {
  assert.deepEqual(faltan(CONTENIDO), []);
});
test('experimentos: las 10 frases (tuteo y voseo) llegan a su operación por la app', () => {
  assert.deepEqual(faltan(EXPERIMENTOS), []);
});
test('landing: las 39 frases (tuteo y voseo) llegan a su operación por la app', () => {
  assert.deepEqual(faltan(LANDING), []);
});
test('ads: las 30 frases (tuteo y voseo) llegan a su operación por la app', () => {
  assert.deepEqual(faltan(ADS), []);
});
test('video_ed_avatar: las 33 frases (tuteo y voseo) llegan a su operación por la app', () => {
  assert.deepEqual(faltan(VIDEO_ED_AVATAR), []);
});
test('preguntas_editor_avatar: las 2 frases (tuteo y voseo) llegan a su operación por la app', () => {
  assert.deepEqual(faltan(PREGUNTAS_EDITOR_AVATAR), []);
});
test('imagen_avatar: las 13 frases (tuteo y voseo) llegan a su operación por la app', () => {
  assert.deepEqual(faltan(IMAGEN_AVATAR), []);
});
test('generator_avatar: las 16 frases (tuteo y voseo) llegan a su operación por la app', () => {
  assert.deepEqual(faltan(GENERATOR_AVATAR), []);
});

// --- 2. WhatsApp sigue anotando ------------------------------------------------------------------------------------------------

test('WhatsApp NO cambia: sin señal clara el pedido se anota como idea, con las herramientas del plan', () => {
  // Sin `canal`, el default es el de siempre: capturar, dudosa, y nada de buscar en todo el registro.
  const v = clasificarIntencion('Juan dijo algo sobre el precio de la propiedad de la calle Alem');
  assert.equal(v.intencion, 'capturar');
  assert.equal(v.dudosa, true);
  assert.equal(v.buscaEnTodo, undefined);
  for (const [texto] of [...NUCLEO.slice(0, 12), ...CRM.slice(0, 12)]) {
    const w = clasificarIntencion(texto);
    assert.equal(w.buscaEnTodo, undefined, `«${texto}»: WhatsApp buscó en todo el registro`);
  }
  // Y el doer de WhatsApp no manda `canal`; el turno de la app sí.
  assert.doesNotMatch(leer('lib/mako-doer-in.ts'), /canal:\s*'app'/, 'el doer de WhatsApp pasa canal app al clasificador');
  assert.match(leer('lib/mako-turno-app.ts'), /clasificarIntencion\(textoClasificar, \{[^}]*canal: 'app'/, 'el turno de la app no le dice al clasificador que es la app');
  // «creá una etiqueta…» en WhatsApp, sin verbo de la lista: no es una acción (el dueño dicta ideas por ahí).
  assert.notEqual(turnoWhatsApp('creá una etiqueta que se llame Caliente').veredicto.buscaEnTodo, true);
});

// --- 3. Lo que NO es un pedido sigue sin serlo ------------------------------------------------------------------------------

test('«hola», «test» y «prueba» solos siguen siendo saludos, también en la app', () => {
  for (const s of ['hola', 'Hola MaKo', 'test', 'prueba', 'probando', 'gracias', 'buen día', 'ok']) {
    assert.equal(clasificarIntencion(s, { canal: 'app' }).intencion, 'charlar', `«${s}» dejó de ser un saludo en la app`);
  }
  // Un saludo con un pedido: se pela el saludo y manda el pedido.
  assert.equal(clasificarIntencion('hola mako, creame una etiqueta que se llame Caliente', { canal: 'app' }).intencion, 'actuar');
});

test('el verbo cuenta sólo al arranque, y lo que no es del canal ni del verbo se queda donde estaba', () => {
  for (const s of [
    'creá una etiqueta', 'Crea una etiqueta', 'mandale un mail a Juan', 'poné una tarea para mañana', 'ponele la etiqueta VIP a Juan',
    'cortá los primeros 5 segundos', 'quiero crear una landing', 'necesito agregar un lead', '¿podés cambiar la hora?', 'che mako, subí el presupuesto',
    'por favor activá la campaña', 'cerrá la tarea', 'invitá a Ana al curso', 'cambiale el teléfono a Juan',
  ]) assert.equal(pideHacerAlApp(s), true, `«${s}» no se leyó como un pedido de hacer`);
  for (const s of [
    'si el closer crea un lead', 'hace dos días le escribí', 'pasa que no anda', 'la agenda de mañana', 'Juan me dijo que quiere comprar',
    '¿qué tareas tengo?', 'mostrame los leads', 'qué le contesto a Juan', 'prueba', 'Crear una landing para el webinar', 'voy a crear una landing',
    'el cliente quiere que le cree una web',
  ]) assert.equal(pideHacerAlApp(s), false, `«${s}» se leyó como un pedido de hacer`);
});

test('en la app, un volcado con un verbo de pedir propone con tarjeta; en WhatsApp se anota con el aviso de duda', () => {
  const volcado = 'Armá lo siguiente:\n- una landing para el webinar\n- el guion del VSL';
  assert.equal(clasificarIntencion(volcado, { canal: 'app' }).intencion, 'actuar');
  const wa = clasificarIntencion(volcado);
  assert.equal(wa.intencion, 'capturar');
  assert.equal(wa.dudosa, true);
});

test('un título dictado y un «anotá» siguen siendo para el plan, también en la app', () => {
  for (const s of ['Crear una landing para el webinar', 'anotá: llamar al contador', 'Idea: que MaKo mueva los leads solo']) {
    const v = clasificarIntencion(s, { canal: 'app' });
    assert.equal(v.intencion, 'capturar', `«${s}» ya no se anota en la app (${v.porque})`);
  }
});

// --- 4. Las piezas ------------------------------------------------------------------------------------------------------------

test('«una etiqueta llamada Caliente» es un nombre, no una llamada que agendar; «una llamada con Ana mañana» sí', () => {
  const nombre = clasificarIntencion('crea una etiqueta llamada Caliente', { canal: 'app' });
  assert.doesNotMatch(nombre.porque, /agenda/, `se leyó como agenda: ${nombre.porque}`);
  const llamada = clasificarIntencion('agendá una llamada con Ana mañana a las 12', { canal: 'app' });
  assert.match(llamada.porque, /agenda/, `ya no es agenda: ${llamada.porque}`);
  assert.equal(clasificarIntencion('agendame una reunión que se llame Cierre con Ana para mañana a las 12').intencion, 'actuar');
});

test('«creá una plantilla de WhatsApp para recordar la reunión» pide una plantilla, no una reunión', () => {
  const r = turnoApp('creá una plantilla de WhatsApp para recordar la reunión');
  assert.doesNotMatch(r.veredicto.porque, /agenda/);
  assert.ok(r.nombres.includes('guardar_borrador_plantilla') || r.nombres.includes('redactar_plantilla_con_mako'));
});

test('las familias suman el área y las palabras de la operación; una frase sin familia no suma nada', () => {
  assert.deepEqual(familiasDe('mandá un mail a todos mis leads con la promo')?.ids, ['email-masivo']);
  assert.ok(familiasDe('todos los martes a las 3 mandale un recordatorio a todo el funnel')?.areas.includes('chatbot'));
  assert.equal(familiasDe('hola, ¿cómo estás?'), null);
  // Una frase de la familia que actúa, aunque no arranque con un verbo de la lista.
  assert.equal(clasificarIntencion('el 15 todos los martes a las 3 recordales la clase', { canal: 'app' }).intencion, 'actuar');
});

test('si el texto no nombra un área, la operación se busca en todo el registro; con área, las del área van primero', () => {
  const sin = turnoApp('creá una etiqueta que se llame Caliente');
  assert.ok(sin.nombres.includes('crear_etiqueta'));
  // El control: el MISMO veredicto sin `buscaEnTodo` no la trae (el texto no nombra el CRM).
  const v = clasificarIntencion('cortá los primeros 5 segundos del video', { canal: 'app' });
  const sinBusqueda = herramientasDelChat({ veredicto: { ...v, buscaEnTodo: false, areas: undefined }, texto: 'cortá los primeros 5 segundos del video', agendaAbierta: false, deSiempre: DE_SIEMPRE, vista: vistaApp, hayPendientes: false });
  const conBusqueda = turnoApp('cortá los primeros 5 segundos del video');
  assert.ok(conBusqueda.nombres.some((n) => /recortar_clip_video|cortar_tramo_video/.test(n)), 'cortar el video no trae su operación');
  assert.ok(conBusqueda.nombres.length >= sinBusqueda.tools.length);
});

// --- 5. Lo que encontró la revisión adversarial de la tanda 1 (20/10/2026) ------------------------------------------------------
// docs/hallazgos-ia.md, «Lo que encontró la revisión de la tanda 1 del clasificador antes de subirla».

test('WhatsApp NO cambia: «la llamada pendiente» sigue siendo la reunión (NOMBRADO es sólo de la app)', () => {
  // Estas 6 eran pedido de agenda antes de la tanda 1; con NOMBRADO en los dos canales dejaban de serlo (y con una pendiente
  // vigente caían en `confirmar`, con cancelar_accion, que corre sin tarjeta).
  for (const f of [
    'cancela la llamada pendiente con Juan', 'cancelá la llamada agendada con Pedro', 'cambiale la hora a la llamada pactada con Ana para mañana a las 11',
    'poneme una llamada 15 min con Juan el lunes', 'movela la llamada r1 al jueves a las 10', 'eliminá la llamada programada del martes',
  ]) {
    for (const ctx of [{}, { hayPendientes: true }]) {
      const v = clasificarIntencion(f, ctx);
      assert.equal(v.relevancia, RELEVANCIA_AGENDA, `WhatsApp: «${f}» ${JSON.stringify(ctx)} dejó de ser agenda (${v.intencion}: ${v.porque})`);
      assert.equal(clasificarIntencion(f, { ...ctx, canal: 'app' }).relevancia, RELEVANCIA_AGENDA, `app: «${f}» ${JSON.stringify(ctx)} dejó de ser agenda`);
    }
  }
  // Y en WhatsApp «crea una etiqueta llamada Caliente» queda como estaba (agenda): NOMBRADO es sólo de la app.
  assert.equal(clasificarIntencion('crea una etiqueta llamada Caliente').relevancia, RELEVANCIA_AGENDA, 'WhatsApp: NOMBRADO le cambió el veredicto');
  // Y el nombre de lo que se crea sigue siendo un nombre en la app, no una llamada.
  assert.doesNotMatch(clasificarIntencion('creá una automatización llamada Bienvenida', { canal: 'app' }).porque, /agenda/);
});

test('una adivinanza de la app no crea un borrador del plan ni cancela una propuesta (el bug del 25/08)', () => {
  for (const f of ['ahí hice la prueba', 'probá de vuelta, ya agregué otra api key', 'eso está mal', 'esto no anda', 'Hola Mauricio, gracias por la reunión de ayer. Saludos, Laura']) {
    for (const hayPendientes of [false, true]) {
      const r = turnoApp(f, { hayPendientes });
      assert.ok(!r.nombres.includes('proponer_tareas_plan'), `«${f}» (pendientes ${hayPendientes}) trae proponer_tareas_plan: crearía un borrador que nadie pidió`);
      if (r.veredicto.adivina) assert.ok(!r.nombres.includes('cancelar_accion'), `«${f}» (pendientes ${hayPendientes}) trae cancelar_accion con una adivinanza`);
    }
  }
  // Un «no» o un «cancelá» explícito con una propuesta abierta es `confirmar`; cancelar es el botón de la tarjeta, no una herramienta del modelo.
  const no = turnoApp('no, cancelá eso', { hayPendientes: true });
  assert.equal(no.veredicto.intencion, 'confirmar');
  assert.ok(!no.nombres.includes('cancelar_accion'));
  // Una orden real trae lo suyo aunque el veredicto no sea una adivinanza.
  assert.equal(clasificarIntencion('creá una tarea para llamar al contador', { canal: 'app' }).adivina, undefined);
});

test('un acuse o un saludo de la app es charla, sin herramientas; y sin raíces útiles no se busca en todo el registro', () => {
  for (const f of ['bueno', 'entendido', 'buenas tardes', 'buenas noches', 'ah ok', 'mmm no sé', 'ya está', 'me parece bien', 'vale']) {
    const r = turnoApp(f);
    assert.equal(r.veredicto.intencion, 'charlar', `«${f}» no es charla (${r.veredicto.porque})`);
    assert.deepEqual(r.nombres, [], `«${f}» viaja con herramientas`);
  }
  // Un mensaje sin señal que SÍ es del negocio sigue siendo una adivinanza con las de siempre, pero no llena el registro por orden de declaración.
  const sin = turnoApp('estoy cansado, mañana sigo');
  assert.ok(sin.veredicto.adivina);
  const delRegistro = herramientasDelChat({ veredicto: sin.veredicto, texto: 'estoy cansado, mañana sigo', agendaAbierta: false, deSiempre: DE_SIEMPRE, vista: vistaApp, hayPendientes: false }).delRegistro;
  assert.ok(delRegistro.length <= 3, `«estoy cansado, mañana sigo» trae ${delRegistro.length} operaciones del registro: se llenó por orden de declaración`);
});

test('buscar en todo el registro no trae una escritura irreversible de OTRA cosa cuando la pedida no existe', () => {
  const IRREVERSIBLES = ['borrar_audio', 'borrar_chat_whatsapp_empresa', 'proponer_eliminar_entidad_meta', 'cancelar_suscripcion', 'cancelar_reunion_calendly', 'borrar_foto_cara_de_marca', 'eliminar_miembro', 'anular_link_pago', 'proponer_borrar_angulo', 'proponer_borrar_avatar', 'desarchivar_secuencia', 'ver_archivero'];
  for (const f of ['borrá la nota que le dejé a Juan', 'borrá la nota', 'pausá todo', 'cancelá eso', 'cancelá lo de Juan', 'borrá la foto', 'eliminá la cuenta', 'anulá eso', 'archivá la conversación con Juan', 'borrá esto']) {
    const r = turnoApp(f);
    const cuelan = r.nombres.filter((n) => IRREVERSIBLES.includes(n));
    assert.deepEqual(cuelan, [], `«${f}» trae ${cuelan.join(', ')}: una escritura de otra área que el texto no nombra`);
  }
  // Con el área NOMBRADA, la destructiva de esa área sí viaja: es lo que se pidió.
  assert.ok(turnoApp('archivá la etiqueta Frío').nombres.includes('archivar_etiqueta'));
  assert.ok(turnoApp('borrá el documento del archivero').nombres.includes('borrar_documento_archivero'));
});

test('una raíz puntúa al PRINCIPIO de una palabra, nunca adentro de otra, y las palabras vacías no puntúan', () => {
  // «cance» está adentro de «alcance», «texto» adentro de «contexto»: antes de la revisión entraban operaciones de otra cosa por eso.
  assert.ok(!turnoApp('cancelá eso').nombres.includes('calcular_alcance_anuncio'));
  assert.ok(!turnoApp('corregí el texto del flyer').nombres.includes('proponer_ampliar_tareas'));
  assert.ok(!turnoApp('dejá un comentario en la tarea').nombres.includes('resumen_bandejas_confirmacion'));
  // «esto», «para» y «esta» no dicen qué operación se pide (y «esta» es el principio de «estado»).
  const r = turnoApp('cambiá esto para esta semana');
  const conEstado = r.delRegistro.filter((n) => /estado|parametro/.test(n));
  assert.deepEqual(conEstado, [], `«cambiá esto para esta semana» trae del registro ${conEstado.join(', ')} por una palabra vacía`);
});

test('en una pregunta no viaja una lectura que gasta IA de otra área', () => {
  for (const f of ['buscame a Juan Pérez', '¿qué chats tengo sin responder?', 'leeme la conversación con Juan']) {
    const nombres = turnoApp(f).nombres;
    for (const n of ['buscar_duplicados_tarea', 'cruzar_tareas_con_plan', 'sugerir_experimento']) assert.ok(!nombres.includes(n), `«${f}» trae ${n}`);
  }
  assert.ok(!turnoApp('¿quién me escribió hoy?').nombres.includes('recomendar_mensajes_whatsapp'));
});

test('una acción viaja con la lectura que le da el id, y la acción pedida llega con ella', () => {
  const CASOS: Array<[frase: string, acciones: string[], lecturas: string[]]> = [
    ['dividí el clip del video Promo en el segundo 10', ['dividir_clip_video'], ['ver_proyecto_video', 'listar_proyectos_video']],
    ['silenciá el clip 2', ['silenciar_clip_video'], ['ver_proyecto_video', 'listar_proyectos_video']],
    ['renombrá la landing del webinar a Masterclass', ['renombrar_landing', 'renombrar_landing_creada'], ['listar_landings_creadas']],
    ['pausá el sitio del webinar', ['pausar_landing'], ['listar_landings_creadas']],
    ['quitá la torta de orígenes de la hoja comercial', ['quitar_componente_dashboard'], ['leer_hoja_dashboard']],
    ['sacá la dependencia entre la landing y el dominio', ['quitar_dependencia_plan'], ['listar_dependencias_plan']],
    ['agregale un texto que diga 50% off al video Promo', ['agregar_texto_video', 'agregar_elemento_video'], ['ver_proyecto_video', 'listar_proyectos_video']],
  ];
  for (const [f, acciones, lecturas] of CASOS) {
    const nombres = turnoApp(f).nombres;
    assert.ok(acciones.some((a) => nombres.includes(a)), `«${f}» no trae la acción pedida (${acciones.join(' | ')}): llegó la inversa o ninguna`);
    assert.ok(lecturas.some((l) => nombres.includes(l)), `«${f}» no trae ${lecturas.join(' | ')} (la lectura que da el id)`);
  }
});

test('un sustantivo o una tercera persona al arranque no es una orden', () => {
  for (const f of [
    'marca registrada', 'factura electrónica', 'copia de seguridad', 'carga lenta la app', 'cobra caro el closer', 'responde siempre tarde el setter',
    'abre a las 9 el local', 'suma 2 + 2', 'deja de inventar', 'deja que lo piense', 'cierra a las 20 el local', 'baja de ventas este mes',
  ]) assert.equal(pideHacerAlApp(f), false, `«${f}» se leyó como una orden`);
  for (const f of ['marcá el lead como calificado', 'marcalo como calificado', 'pausá la campaña', 'pausala', 'cargá el plan de pagos', 'cargalo', 'facturale a Juan', 'copiá el diseño', 'dejale una nota a Juan', 'programá el análisis', '¿le podés poner subtítulos al video Promo?', '¿me podés cambiar la hora?', '¿les puedes mandar el link?',
    'cargá 3 tareas para mañana', 'cargá tareas: llamar al contador y grabar el VSL', 'cargá en el plan llamar al contador', 'sumá 3 tareas al proyecto Lanzamiento',
    'guardá como tarea llamar a Juan', 'dejá como tarea llamar al contador', 'programá para el lunes la tarea de llamar al contador', 'pausá el sitio del webinar']) {
    assert.equal(pideHacerAlApp(f), true, `«${f}» dejó de ser una orden`);
  }
});

test('el peso de un turno: la charla no viaja con herramientas y el registro no pasa su presupuesto más el margen de las lecturas', () => {
  const MAX = 12_000 + 3_500;
  for (const [f] of [...NUCLEO, ...CRM, ...VIDEO]) {
    const v = clasificarIntencion(f, { canal: 'app' });
    const t = herramientasDelChat({ veredicto: v, texto: f, agendaAbierta: false, deSiempre: DE_SIEMPRE, vista: vistaApp, hayPendientes: false });
    const chars = t.delRegistro.reduce((n, x) => n + JSON.stringify(x).length, 0);
    assert.ok(chars <= MAX, `«${f}»: el registro pesa ${chars} caracteres (tope ${MAX})`);
  }
});

// --- 6. La segunda revisión adversarial (21/10/2026): la red es la tarjeta, no la regla ---------------------------------------------
// docs/hallazgos-ia.md, «La red es la tarjeta, no la regla». Una primera ronda de reglas dejó 11 errores medidos en la app: cada regla
// nueva dejaba afuera una frase legítima y metía otra irreversible. Acá se prueba la RED (nada que cambie algo corre sin tarjeta), la
// PUERTA de las destructivas (por la COSA que se nombra, no por el área) y cada una de las frases de la nota de la revisión.

const BATERIAS: Caso[] = [
  ...NUCLEO, ...CRM, ...AUTOMATIONS_CLIENTS, ...PLAN, ...CALENDARIO, ...DASHBOARD, ...VIDEO, ...IMAGEN, ...COBROS, ...EQUIPO, ...NEGOCIO,
  ...CONTENIDO, ...EXPERIMENTOS, ...LANDING, ...ADS, ...VIDEO_ED_AVATAR, ...PREGUNTAS_EDITOR_AVATAR, ...IMAGEN_AVATAR, ...GENERATOR_AVATAR,
];
const quitan = (r: { nombres: string[]; delRegistro: string[] }): string[] => r.nombres.filter((n) => r.delRegistro.includes(n) && esDestructiva(porId(n)!));

test('la red es la tarjeta: en el chat de la app nada que cambie algo corre sin dejar una tarjeta', () => {
  let viajan = 0;
  for (const rol of ['admin', 'miembro'] as const) for (const ws of [13, 1]) {
    const vista: Vista = { canal: 'app', alcance: 'proponer', ws, rol, tabs: null };
    for (const d of REGISTRO) {
      if (!entraAlChat(d.id, vista)) continue;
      viajan++;
      // Un control (confirmar_accion, cancelar_accion) cambia algo SIN tarjeta; una lectura no cambia nada; una acción siempre deja pendiente o propuesta.
      assert.ok(d.tipo === 'lectura' || d.tipo === 'accion', `«${d.id}» (${d.tipo}) viaja por el chat de la app y corre sin que nadie toque una tarjeta`);
      if (d.tipo === 'accion') {
        assert.ok(d.confirmacion === 'chat' || d.confirmacion === 'pantalla', `«${d.id}» no declara cómo se confirma`);
        assert.equal(alcanceMinimo(d), 'proponer', `«${d.id}» pide un alcance mayor que proponer: en la app no hay quien lo dé`);
      }
    }
  }
  assert.ok(viajan > 600, `sólo ${viajan} operaciones viajan: cambió el registro y este test ya no mira nada`);
  // D2 (Martín, 21/10/2026): lo que mueve plata se confirma en el chat. En la app, ninguna operación de plata (`costo: 'dinero'`, y toda
  // escritura del área de cobros) deja de ser una ACCIÓN con tarjeta: el clasificador no puede dejar una sin ella.
  const dePlata = REGISTRO.filter((d) => entraAlChat(d.id, vistaApp) && (d.costo === 'dinero' || (d.area === 'cobros' && d.tipo !== 'lectura')));
  assert.ok(dePlata.length >= 15, `sólo ${dePlata.length} operaciones de plata viajan: cambió el registro y este test ya no mira nada`);
  for (const d of dePlata) assert.ok(d.tipo === 'accion' && (d.confirmacion === 'chat' || d.confirmacion === 'pantalla'), `«${d.id}» mueve plata y no deja una tarjeta`);
  // Lo irreversible y lo que quita algo son ACCIONES con tarjeta, ni lecturas ni controles.
  const peligrosas = REGISTRO.filter((d) => d.tipo !== 'lectura' && (esDestructiva(d) || (d.tipo === 'accion' && d.reversible === false)));
  assert.ok(peligrosas.length > 100, `sólo ${peligrosas.length} operaciones peligrosas`);
  for (const d of peligrosas) if (entraAlChat(d.id, vistaApp)) assert.equal(d.tipo, 'accion', `«${d.id}» quita o es irreversible y no deja tarjeta`);
  // Lo único que EJECUTA una pendiente es confirmarPendiente (lib/api-mako/acciones.ts): ejecutarOperacion, el camino de las herramientas, no.
  assert.doesNotMatch(leer('lib/api-mako/ejecutar.ts'), /\.ejecutar\(/, 'ejecutarOperacion llama a run.ejecutar: una herramienta ejecutaría sin la tarjeta');
  assert.ok(!entraAlChat('confirmar_accion', vistaApp) && !entraAlChat('cancelar_accion', vistaApp));
});

test('en ninguna frase de las baterías viaja un control, y toda destructiva que viaja NOMBRÓ su cosa', () => {
  const sinCosa: string[] = [];
  for (const [f] of BATERIAS) for (const ctx of [{}, { hayPendientes: true }]) {
    const r = turnoApp(f, ctx);
    for (const n of ['confirmar_accion', 'cancelar_accion']) assert.ok(!r.nombres.includes(n), `«${f}» ${JSON.stringify(ctx)} trae ${n}`);
    for (const n of quitan(r)) if (!pideQuitar(f) || !nombraLaCosa(porId(n)!, sinVerboAlArranque(f))) sinCosa.push(`«${f}» → ${n}`);
  }
  assert.deepEqual(sinCosa, [], 'una operación que quita algo viajó sin que el pedido nombrara su cosa');
});

test('«llamada» es un nombre sólo detrás de un sustantivo que se nombra; sin él es la reunión, con o sin una tarjeta abierta', () => {
  for (const f of [
    'cancelá llamada pendiente con Juan', 'cancelá nuestra llamada pendiente con Juan', 'cancelá la siguiente llamada agendada',
    'cancelá la 2da llamada agendada', 'cancelá cualquier llamada agendada hoy', 'cancelá ambas llamadas agendadas con Juan',
  ]) for (const ctx of [{}, { hayPendientes: true }]) {
    const r = turnoApp(f, ctx);
    assert.equal(r.veredicto.relevancia, RELEVANCIA_AGENDA, `«${f}» ${JSON.stringify(ctx)} dejó de ser agenda (${r.veredicto.intencion}: ${r.veredicto.porque})`);
    assert.ok(r.nombres.includes('proponer_cancelar_reunion'), `«${f}» ${JSON.stringify(ctx)} no trae proponer_cancelar_reunion`);
  }
  for (const f of ['creá una etiqueta llamada Caliente', 'creá una secuencia llamada Reactivación', 'creá un contacto llamado Juan', 'creá una plantilla titulada Bienvenida']) {
    assert.doesNotMatch(clasificarIntencion(f, { canal: 'app' }).porque, /agenda/, `«${f}» se leyó como agenda`);
  }
});

test('una familia sola, sin un verbo de hacer, es una adivinanza: pone el área pero no crea un borrador del plan', () => {
  for (const f of [
    'ahí hice la prueba con el reel de hoy', 'el reel de hoy anduvo bárbaro', 'sos una estrella', 'se me borró todo automáticamente',
    'los mails a todos los leads llegaron a spam', 'esto pasa todos los lunes', 'el link de la agenda no anda',
  ]) for (const hayPendientes of [false, true]) {
    const r = turnoApp(f, { hayPendientes });
    assert.equal(r.veredicto.adivina, true, `«${f}» (pendientes ${hayPendientes}) ya no es una adivinanza (${r.veredicto.porque})`);
    assert.ok(!r.nombres.includes('proponer_tareas_plan'), `«${f}» (pendientes ${hayPendientes}) trae proponer_tareas_plan`);
    assert.ok(!r.nombres.includes('cancelar_accion'), `«${f}» (pendientes ${hayPendientes}) trae cancelar_accion`);
  }
  // Una orden que cae en una familia sigue siendo una orden.
  assert.equal(clasificarIntencion('mandá un mail a todos mis leads con la promo', { canal: 'app' }).adivina, undefined);
  assert.equal(clasificarIntencion('creá una automatización que corra todos los lunes', { canal: 'app' }).adivina, undefined);
});

test('un mensaje o un envío no trae un borrado, y el área de una palabra («muletillas», «guion», «comunidad») tampoco abre los de su área', () => {
  for (const f of [
    'escribile a Juan que mañana lo llamo', 'mandale un WhatsApp a Juan diciendo que mañana lo llamo', 'envíale un mensaje por WhatsApp a Juan Pérez',
    'mandale a Juan el link de Calendly', 'programá el broadcast de Black Friday para el viernes a las 10',
    'Mandá a aprobar a Meta la plantilla del paso 3 de la secuencia de bienvenida', 'me cobraron dos veces', 'leeme la conversación con Juan', 'corregí el texto del flyer',
    // Una queja que nombra la cosa tampoco es un pedido de quitarla.
    'el borrador salió mal', 'se me borró la landing', 'el audio no se escucha',
  ]) {
    const r = turnoApp(f);
    assert.deepEqual(quitan(r), [], `«${f}» trae operaciones que quitan algo`);
  }
  const muletillas = turnoApp('eliminá las muletillas del video Promo');
  assert.ok(muletillas.nombres.includes('eliminar_muletillas_video'));
  assert.ok(!muletillas.nombres.includes('reiniciar_personalidad'), 'reiniciar_personalidad (borra el quiz de voz entero) viaja por «muletillas»');
  assert.deepEqual(quitan(turnoApp('borrá las muletillas')).filter((n) => n !== 'eliminar_muletillas_video'), []);
  const guion = turnoApp('eliminá el guion viejo');
  assert.ok(guion.nombres.includes('borrar_guion_anuncio') && !guion.nombres.includes('proponer_eliminar_entidad_meta'));
  assert.deepEqual(quitan(turnoApp('borrá lo que publicó Juan en la comunidad')), [], '«publicó» abre las destructivas de Meta Ads');
  assert.ok(!familiasDe('borrá lo que publicó Juan en la comunidad')?.ids.includes('area-ads'), '«publicó» (sin tilde, «publico») se leyó como el público de una campaña');
  assert.ok(!turnoApp('borrá el reporte de Marketing').nombres.includes('borrar_identidad_fiscal'));
});

test('lo que se quita llega por su nombre: la cosa de la operación, o una palabra con la que se la nombra', () => {
  const DESTRUCTIVAS: Caso[] = [
    ['borrá el audio 3', ['borrar_audio']], ['borrá la nota de voz de bienvenida', ['borrar_audio']], ['suspendé al miembro Pedro', ['suspender_miembro']],
    ['anulá el link de Juan', ['anular_link_pago']], ['cancelá el análisis', ['cancelar_analisis_dashboard']],
    ['borrá la foto de mi cara de marca', ['borrar_foto_cara_de_marca']], ['sacá a Juan de la secuencia Bienvenida', ['sacar_lead_de_secuencia']],
    ['dejá de recordarle la cuota a Ana', ['cortar_recordatorio_cuota']], ['sacá la dependencia entre la landing y el dominio', ['quitar_dependencia_plan']],
    ['pausá el sitio del webinar', ['pausar_landing']], ['eliminá el dominio', ['quitar_dominio_landing']], ['sacá el filtro', ['quitar_filtro_dashboard']],
    ['quitá el gráfico de leads de la hoja de Marketing', ['quitar_componente_dashboard']], ['sacá la torta de orígenes', ['quitar_componente_dashboard']], ['borrá el clip 3 del video', ['borrar_elementos_video']],
    // Las que dicen «chat» de un contacto (el área `chats` no es la de `whatsapp`: las abre la cosa, no el área).
    ['borrá el historial del chat de Juan', ['borrar_chat_whatsapp_empresa']], ['ocultá el chat de mi vieja', ['ocultar_contacto_whatsapp_empresa']],
    ['marcá como leído el chat de Juan', ['marcar_leido_whatsapp_oficial']], ['descartá el mensaje que le armaste a Juan', ['descartar_borrador_whatsapp_empresa']],
  ];
  assert.deepEqual(faltan(DESTRUCTIVAS), []);
});

test('si le piden quitar algo y no nombra la cosa, no llega una operación parecida: MaKo pregunta cuál', () => {
  for (const f of ['borrá la nota', 'pausá todo', 'borrá esto', 'suspendé a Pedro', 'sacá a Juan de Bienvenida', 'eliminá la cuenta', 'anulá eso']) {
    const r = turnoApp(f);
    assert.deepEqual(quitan(r), [], `«${f}» trae ${quitan(r).join(', ')}: una operación que quita algo que el pedido no nombra`);
    assert.ok((r.instruccion ?? '').includes(INSTRUCCION_QUITAR_SIN_OBJETO), `«${f}»: MaKo no recibe la instrucción de preguntar cuál`);
  }
  // Si nombra la cosa, la operación llega y no hay nada que preguntar; y una queja no es un pedido de quitar.
  const nombra = turnoApp('borrá el audio 3');
  assert.ok(nombra.nombres.includes('borrar_audio'));
  assert.ok(!(nombra.instruccion ?? '').includes(INSTRUCCION_QUITAR_SIN_OBJETO));
  for (const f of ['se me borró todo', 'me cobraron dos veces', 'el borrador salió mal']) assert.equal(pideQuitar(f), false, `«${f}» se leyó como un pedido de quitar`);
  for (const f of ['borrá la landing', 'editá mi último video y sacale las muletillas', 'no puedo eliminar la landing', 'dale de baja a Juan', 'pausala']) assert.equal(pideQuitar(f), true, `«${f}» no se leyó como un pedido de quitar`);
});

test('«irreversible» no es «destructiva»: enviar, invitar y crear no pasan por la puerta de lo que se quita', () => {
  for (const id of ['invitar_miembro_equipo', 'enviar_broadcast', 'crear_secuencia_email', 'proponer_lead', 'levantar_ticket', 'destilar_voz', 'responder_huecos_voz']) {
    const d = porId(id);
    assert.ok(d, `${id} no existe en el registro`);
    assert.equal(esDestructiva(d), false, `${id} cuenta como destructiva`);
  }
  assert.deepEqual(faltan([
    ['invitá a Ana a MaKo', ['invitar_miembro_equipo']], ['invitá a ana@mail.com', ['invitar_miembro_equipo', 'invitar_cliente_curso_cs']],
    ['destilá la voz de mis anuncios', ['destilar_voz']], ['completá la guía de voz', ['responder_huecos_voz']],
  ]), []);
});

test('lo que llega con una acción: la lectura que da el id llega en TODO turno de la app, no sólo en la búsqueda por todo el registro', () => {
  for (const [f, acciones, lecturas] of [
    ['poné el enlace de la agenda en la landing', ['poner_enlace_landing'], ['listar_landings_creadas', 'ver_secciones_landing']],
    ['cambia el formulario de la landing: agrega el teléfono', ['configurar_formulario_landing'], ['listar_landings_creadas']],
    ['cambiá el botón de la landing del webinar', ['cambiar_texto_landing'], ['listar_landings_creadas']],
    ['agregá un gráfico de leads por semana al dashboard', ['agregar_grafico_dashboard'], ['leer_hoja_dashboard', 'ver_catalogo_dashboard']],
  ] as Array<[string, string[], string[]]>) {
    const nombres = turnoApp(f).nombres;
    assert.ok(acciones.some((a) => nombres.includes(a)), `«${f}» no trae ${acciones.join(' | ')}`);
    assert.ok(lecturas.some((l) => nombres.includes(l)), `«${f}» trae la acción y no la lectura que da el id (${lecturas.join(' | ')})`);
  }
  // Y en todas las frases de las baterías: la acción pedida llega con una de las lecturas que nombra (si nombra alguna que viaje por el chat).
  const sinLectura: string[] = [];
  for (const [f, ops] of BATERIAS) {
    const r = turnoApp(f);
    for (const n of ops) {
      const d = porId(n);
      if (!d || d.tipo === 'lectura' || !r.delRegistro.includes(n)) continue;
      const dan = lecturasQueNombra(d).filter((l) => entraAlChat(l, vistaApp));
      if (dan.length && !dan.some((l) => r.nombres.includes(l))) sinLectura.push(`«${f}» → ${n} sin ${dan.join(' | ')}`);
    }
  }
  assert.deepEqual(sinLectura, []);
});

test('un acuse después de una pregunta de MaKo es el sí a lo que ofreció; sin pregunta, es charla', () => {
  for (const f of ['me parece bien', 'vale', 'está bien', 'bueno', 'entendido', 'ahí va']) {
    const con = turnoApp(f, { makoPregunto: true });
    assert.equal(con.veredicto.intencion, 'actuar', `«${f}» después de una pregunta de MaKo quedó en ${con.veredicto.intencion}`);
    assert.equal(con.veredicto.sigueOfrecimiento, true);
    assert.equal(turnoApp(f).veredicto.intencion, 'charlar', `«${f}» sin pregunta dejó de ser charla`);
  }
  // Un saludo no acepta nada, ni después de una pregunta.
  assert.equal(turnoApp('buenas tardes', { makoPregunto: true }).veredicto.intencion, 'charlar');
});

test('completar o abrir de nuevo una tarea llega a cerrarla o reabrirla aunque «tarea» y el nombre llenen el área', () => {
  assert.deepEqual(faltan([
    ['completá la tarea de grabar', ['proponer_cierre_tareas', 'cerrar_tareas_plan']], ['completá la tarea de grabar el reel', ['proponer_cierre_tareas', 'cerrar_tareas_plan']],
    ['abre de nuevo la tarea de grabar', ['actualizar_avance_tarea']],
    ['cargá 3 tareas para mañana', ['proponer_tareas_plan']], ['cargá tareas: llamar al contador y grabar el VSL', ['proponer_tareas_plan']],
    ['cargá en el plan llamar al contador', ['proponer_tareas_plan']], ['sumá 3 tareas al proyecto Lanzamiento', ['proponer_tareas_plan']],
    ['guardá como tarea llamar a Juan', ['proponer_tareas_plan']], ['dejá como tarea llamar al contador', ['proponer_tareas_plan']],
    ['programá para el lunes la tarea de llamar al contador', ['proponer_tareas_plan']],
  ]), []);
});

// Probado rompiéndolo (20/10/2026), una rotura por vez, con todo en verde antes. 85 roturas, cada una con su fallo (29 de la tanda 1, 9 de las 2 y 3, 5 de la 4, 5 de la 5, 4 de la 6, 26 de los arreglos de la revisión adversarial y 7 de las frases del chat de Video / AI Avatar):
//   · el default de la app sin actuar · la regla del verbo de hacer · el volcado con verbo que vuelve a anotarse · el link con verbo
//     que vuelve a ser material · la pregunta que no busca en todo el registro · «llamada Caliente» que vuelve a ser agenda · la
//     plantilla que no le gana a la agenda · «prueba la automatización» que vuelve a ser saludo · sin la búsqueda en todo el registro ·
//     sin la segunda pasada del presupuesto · las áreas que se comen todo (sin el 60%) · «cerrá» fuera de los verbos · sin el pedido
//     indirecto · sin los pronombres pegados · sin el preludio (saludo y nombre de MaKo) · el verbo en el medio de la frase ·
//     el turno de la app sin `canal: 'app'` · y las familias recurrente, email-masivo, borradores, archivar-automatización,
//     contenido-programado, perfil-negocio, secuencia-email, que-le-contesto, contacto-lead, cliente-cs, probar-automatización,
//     responder-comentarios y mensaje-a-alguien, cada una sacada por separado.
//   Tandas 2 y 3: las familias pasar-tarea, velocidad-video, estrella, dashboard-quitar-componente (y que le gane al lead), contenido-
//   programado (que le gane a la agenda), creaciones-galería (que le gane a la landing) y «comunidad» con verbos sueltos en la relevancia.
//   Tanda 4 (Pagos y cuenta): dar-de-baja, rol-equipo (y que le gane al lead) y renombrar-chat (y que le gane a la agenda).
//   Tanda 5 (Offer, Copywriting, Second Brain, experimentos): catalogo-productos, diagnostico-fase (y que le gane al lead), pasar-guion
//   y formatos-creativo. Tanda 6 (Web Generator): seccion-landing, enlace-landing, link-privado-landing y que la landing sume las
//   palabras de la familia a su relevancia. La tanda 7 (Meta Ads) no necesitó filas.
//   Revisión adversarial: NOMBRADO también en WhatsApp y sin el determinante delante · la marca `adivina` (en el default y en
//     toolsParaIntencion) y `cancelar_accion` en una adivinanza · el acuse «buenas tardes» · destructivas y lecturas que cuestan de otra área ·
//     la raíz adentro de una palabra · las palabras vacías · el puntaje mínimo · las lecturas que dan el id · el resto de las áreas nombradas
//     (pasada 3) · formas homógrafas · puntuar con la orden incluida · el verbo de acción sobre la cuenta sin lo de la app · las filas de
//     palabras de área (crm, whatsapp, etiqueta, estrategia, equipo, negocio, ads, partners, sabes-del-negocio) y el curso que nombra cs.
//   Tres filas/líneas sobraban (area-cobros, `ganaAlLead` de cliente-cs y el corte temprano sin raíces) y se borraron.
//   Dos filas (la de «etiqueta» y la de «fathom») no cayeron al romperlas: no hacían falta y se borraron.
//   22/10/2026, al traer main (las herramientas de Chats 2.1): «mandale a Juan el link de Calendly» se quedaba sin
//   `link_agenda_calendly`. Lo nombrado por una palabra de pocas operaciones entra primero (relevancia-app.ts → porSuNombre);
//   apagarlo da 47/1 (CRM y Chats). Darle el doble a lo que escribió la persona lo arreglaba, pero rompía seis grupos: se descartó.
//   10/11/2026, los motion graphics (lib/mako-intencion.ts, el área video, base 49/0): sin «motion» en el área -> 47/2 (video y
//   «motion»); sin la excepción de la landing -> 48/1; sin el borde (caza «promotion») -> 48/1.
