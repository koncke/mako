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
import { clasificarIntencion } from '../lib/mako-intencion';
import { pideHacerAlApp, familiasDe } from '../lib/mako-intencion-app';
import { herramientasDelChat } from '../lib/mako-turno-app-reglas';
import { herramientasDelTurno } from '../lib/doer-herramientas';
import type { Vista } from '../lib/api-mako/registro';

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
function turnoApp(texto: string) {
  const veredicto = clasificarIntencion(texto, { canal: 'app' });
  const t = herramientasDelChat({ veredicto, texto, agendaAbierta: false, deSiempre: DE_SIEMPRE, vista: vistaApp, hayPendientes: false });
  return { veredicto, nombres: t.tools.map((x) => x.name) };
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

// Probado rompiéndolo (20/10/2026), una rotura por vez, con todo en verde antes (12 de 12). 29 roturas, cada una con su fallo:
//   · el default de la app sin actuar · la regla del verbo de hacer · el volcado con verbo que vuelve a anotarse · el link con verbo
//     que vuelve a ser material · la pregunta que no busca en todo el registro · «llamada Caliente» que vuelve a ser agenda · la
//     plantilla que no le gana a la agenda · «prueba la automatización» que vuelve a ser saludo · sin la búsqueda en todo el registro ·
//     sin la segunda pasada del presupuesto · las áreas que se comen todo (sin el 60%) · «cerrá» fuera de los verbos · sin el pedido
//     indirecto · sin los pronombres pegados · sin el preludio (saludo y nombre de MaKo) · el verbo en el medio de la frase ·
//     el turno de la app sin `canal: 'app'` · y las familias recurrente, email-masivo, borradores, archivar-automatización,
//     contenido-programado, perfil-negocio, secuencia-email, que-le-contesto, contacto-lead, cliente-cs, probar-automatización,
//     responder-comentarios y mensaje-a-alguien, cada una sacada por separado.
//   Dos filas (la de «etiqueta» y la de «fathom») no cayeron al romperlas: no hacían falta y se borraron.
