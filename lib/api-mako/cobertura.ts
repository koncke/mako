// =============================================================================
// cobertura — qué server action de app/ tiene su operación en la API de MaKo (18/11/2026, F127)
// =============================================================================
// Martín, 25/10/2026: «Todo, todo siempre tiene que ir a la API, todo MaKo se debe poder utilizar por API». La regla estaba
// escrita desde el 13/10 y la guarda que la hacía cumplir (`b85971b9b`, rama wip/api-acciones-1410) nunca llegó a main: el 23/10
// la auditoría contó 174 acciones de pantalla sin declarar y nada que las cazara (docs/hallazgos-api-mako.md, «"Toda capacidad
// nace en la API" es regla desde el 13/10»). tests/api-mako-registro.test.ts mira las operaciones que EXISTEN: una acción que
// nadie declaró no está en ningún lugar que mire.
//
// Cada `export async function` de cada archivo 'use server' de app/ está en UNA de tres listas, y lo hace cumplir
// tests/api-mako-cobertura.test.ts:
//   · CUBIERTAS: la acción → las operaciones del registro que hacen lo mismo (el test comprueba que existan);
//   · EXCEPCIONES: no corresponde que esté en la API, con el motivo;
//   · DEUDA: todavía no tiene su operación. SÓLO BAJA: una acción nueva no puede entrar acá (el test fija el número), y una que
//     ya está cubierta o exceptuada, o que ya no existe, tampoco puede quedar.
// El inventario se armó de cero el 18/11/2026 (el de b85971b9b no está en origin): las CUBIERTAS de abajo son las que el nombre
// de la acción y el id de la operación dicen con las MISMAS palabras, revisadas una por una contra la descripción de la op.
// Todo lo demás arrancó como DEUDA. Sacar una acción de la DEUDA es declarar su operación (lib/api-mako/areas/<área>.def.ts y
// .run.ts) y pasarla a CUBIERTAS, o escribir por qué no corresponde en EXCEPCIONES.
//
// Puro y sin `server-only`: lo lee el test.
// =============================================================================

/** `archivo#accion` → las operaciones del registro que hacen lo mismo. */
export const CUBIERTAS: Readonly<Record<string, readonly string[]>> = {
  'app/admin/cobros/recibos-actions.ts#reenviarReciboAction': ['reenviar_recibo'],
  'app/admin/operaciones/acciones.ts#desconectarComputadoraAction': ['desconectar_computadora'],
  'app/agency/actions.ts#marcarEntradaPagadaAction': ['marcar_entrada_pagada'],
  'app/ai-avatar/cubos/actions.ts#inicioCubosAction': ['ver_videos_cubos'],
  'app/ai-avatar/cubos/actions.ts#crearVideoCubosAction': ['crear_video_cubos'],
  'app/calendario/actions.ts#crearEventoGoogleAction': ['crear_evento_google'],
  'app/competitor-spy/actions.ts#sumarSugeridoAction': ['sumar_sugerido'],
  'app/copywriter/inspiracion/acciones.ts#leerInspiracionAction': ['listar_inspiracion'],
  'app/copywriter/inspiracion/acciones.ts#decidirInspiracionAction': ['ordenar_inspiracion'],
  'app/copywriter/inspiracion/acciones.ts#volverInspiracionAction': ['ordenar_inspiracion'],
  'app/copywriter/inspiracion/acciones.ts#borrarInspiracionAction': ['borrar_inspiracion'],
  'app/configuraciones/plan/actions.ts#empezarPlanYaAction': ['empezar_mi_plan_ya'],
  'app/creaciones/actions.ts#listarCreacionesAction': ['listar_creaciones'],
  'app/creaciones/actions.ts#verCreacionAction': ['ver_creacion'],
  'app/creaciones/actions.ts#misCreacionesAction': ['mis_creaciones'],
  'app/creaciones/actions.ts#publicarCreacionAction': ['publicar_creacion'],
  'app/creaciones/actions.ts#retirarCreacionAction': ['retirar_creacion'],
  'app/creaciones/actions.ts#usarCreacionAction': ['usar_creacion'],
  'app/creaciones/actions.ts#compartirPlantillaAction': ['compartir_plantilla'],
  'app/crm/[id]/cobros-actions.ts#reembolsarCobroAction': ['reembolsar_cobro'],
  'app/crm/[id]/cobros-actions.ts#cancelarSuscripcionAction': ['cancelar_suscripcion'],
  'app/crm/[id]/deal-actions.ts#registrarPagoSueltoAction': ['registrar_pago_suelto'],
  'app/crm/[id]/pagos-campo-actions.ts#editarCuotaAction': ['editar_cuota'],
  'app/crm/[id]/pagos-campo-actions.ts#guardarCuotasAction': ['guardar_cuotas'],
  'app/crm/[id]/suscripcion-actions.ts#cambiarSuscripcionAction': ['cambiar_suscripcion'],
  'app/crm/agenda-evento-actions.ts#listarEventosAgendaAction': ['listar_eventos_agenda'],
  'app/crm/agenda-evento-actions.ts#vincularEventoEtapaAction': ['vincular_evento_etapa'],
  'app/crm/agenda-evento-actions.ts#desvincularEventoEtapaAction': ['desvincular_evento_etapa'],
  'app/crm/curso-al-ganar-actions.ts#cambiarCursoAlGanarAction': ['cambiar_curso_al_ganar'],
  // «Asignar fuentes» → Formularios (20/11/2026): la pantalla y la API llaman a lib/fuentes-crm-server.ts.
  'app/crm/fuentes-actions.ts#formulariosAction': ['listar_formularios'],
  'app/crm/fuentes-actions.ts#alternarFormularioAction': ['elegir_embudo_de_formulario'],
  'app/crm/fuentes-actions.ts#reglasAction': ['ver_reglas_formulario'],
  'app/crm/fuentes-actions.ts#guardarReglasAction': ['guardar_reglas_formulario'],
  'app/crm/fuentes-actions.ts#reaplicarAction': ['reaplicar_reglas_formulario'],
  'app/crm/ficha-actions.ts#cambiarFichaFunnelAction': ['cambiar_ficha_funnel'],
  'app/crm/grupo-wa-actions.ts#completarNombresDeGrupoAction': ['completar_nombres_de_grupo'],
  'app/crm/insights-actions.ts#leadTieneLlamadaAction': ['lead_tiene_llamada'],
  'app/crm/lead-view/ficha/pagos/cuotas-actions.ts#bajaDelClienteAction': ['baja_del_cliente'],
  'app/crm/lead-view/ficha/resumen/bloques-actions.ts#duplicadosDelLeadAction': ['duplicados_lead'],
  'app/crm/nuevo-crm-actions.ts#crearCrmAction': ['crear_crm'],
  'app/crm/oferta-lead-actions.ts#asignarOfertaLeadAction': ['asignar_oferta_lead'],
  'app/customer-success/curso-ficha-actions.ts#quitarCursoDelAccesoAction': ['quitar_curso_del_acceso'],
  'app/customer-success/curso-ficha-actions.ts#cortarAccesoCursoAction': ['cortar_acceso_curso'],
  'app/customer-success/curso-ficha-actions.ts#habilitarAccesoCursoAction': ['habilitar_acceso_curso'],
  'app/general/actions.ts#guardarKpiAction': ['guardar_kpi'],
  'app/general/actions.ts#apagarKpiAction': ['apagar_kpi'],
  'app/image-editor/carruseles/actions.ts#guardarCarruselAction': ['guardar_carrusel'],
  'app/image-editor/carruseles/actions.ts#guardarThumbnailAction': ['guardar_thumbnail'],
  'app/integraciones/landing-actions.ts#ocultarVideoAction': ['ocultar_video'],
  'app/integraciones/landing-config-actions.ts#guardarLandingAction': ['guardar_landing'],
  'app/integraciones/landing-config-actions.ts#borrarLandingAction': ['borrar_landing'],
  'app/integraciones/landing-config-actions.ts#analizarLandingAction': ['analizar_landing'],
  'app/m/crm/acciones.ts#buscarLeadsAction': ['buscar_leads'],
  'app/partners/actions.ts#hacermePartnerAction': ['hacerme_partner'],
  'app/tickets/acciones.ts#misTicketsAction': ['mis_tickets'],
  'app/tickets/acciones.ts#verMiTicketAction': ['ver_ticket'],
  'app/video-generator/actions.ts#reescribirTomaAction': ['reescribir_toma_con_ia'],
  // Confirmar o descartar una pendiente desde una pantalla es `confirmar_accion` / `cancelar_accion`: las cuatro bandejas
  // (computadora y teléfono, la pendiente de chat y la propuesta de pantalla) llaman a la misma puerta (lib/api-mako/acciones.ts).
  'app/mako/pendientes/acciones.ts#confirmarPendienteAction': ['confirmar_accion'],
  'app/mako/pendientes/acciones.ts#cancelarPendienteAction': ['cancelar_accion'],
  'app/mako/revisar/[id]/acciones.ts#confirmarAccionAction': ['confirmar_accion'],
  'app/mako/revisar/[id]/acciones.ts#descartarAccionAction': ['cancelar_accion'],
  'app/m/inbox/acciones.ts#confirmarPendienteMovil': ['confirmar_accion'],
  'app/m/inbox/acciones.ts#cancelarPendienteMovil': ['cancelar_accion'],
  'app/m/inbox/acciones.ts#confirmarAccionMovil': ['confirmar_accion'],
  'app/m/inbox/acciones.ts#descartarAccionMovil': ['cancelar_accion'],
};

/** `archivo#accion` → por qué NO va en la API. Un motivo que no se pueda leer en una frase no es un motivo. */
export const EXCEPCIONES: Readonly<Record<string, string>> = {
  // Administrar credenciales de la API: ninguna operación del registro lo hace, a propósito (un token filtrado se perpetuaría;
  // lo frena tests/api-mako-rest.test.ts).
  'app/api-mako/actions.ts#crearTokenApi': 'acuña un token de la API: la API no administra sus propias credenciales',
  'app/api-mako/actions.ts#editarTokenApi': 'edita un token de la API: la API no administra sus propias credenciales',
  'app/api-mako/actions.ts#regenerarTokenApi': 'regenera un token de la API: la API no administra sus propias credenciales',
  'app/api-mako/actions.ts#revocarTokenApi': 'revoca un token de la API: la API no administra sus propias credenciales',
  // La consola de la tab API: corre una operación del registro, o devuelve su referencia. Es la API, no una capacidad nueva.
  'app/api-mako/actions.ts#probarOperacion': 'la consola de la API: corre una operación que ya está en el registro',
  'app/api-mako/actions.ts#referenciaApi': 'devuelve la referencia de la API (docs/api-mako.md), que sale del registro',
  'app/api-mako/actions.ts#openApiApi': 'devuelve el OpenAPI de la API, que sale del registro',
  // A dónde le paga el PÚBLICO (alias, CVU, Binance Pay ID y links del checkout, setting `planes.pago_directo`): si el chat o la API pudieran editarlo,
  // un texto malicioso metido en una conversación cambiaría el alias de cobro de MaKo (fraude directo). Sólo lo cambia el super admin en Settings › Payments.
  // Si un negocio se cobra o no: lo decide Martín al tocar el interruptor, en pantalla; por el chat o la API un texto malicioso podría dejar de cobrarle a un negocio.
  'app/admin/_polar/datos/sin-cobro-actions.ts#ponerSinCobroAction': 'decide si un negocio se cobra (habilitado sin cobro): sólo el super admin, en pantalla; el código no cambia ninguna cuenta solo',
  'app/admin/cobros/actions.ts#guardarPagoDirectoAction': 'cambia a dónde le paga el público (alias, CVU, Binance): por el chat o la API sería un vector de fraude; sólo el super admin, en pantalla',
  // El personaje en cubos de AI Avatar (19/11/2026, docs/editor-video/ai-avatar-por-codigo.md). Leer y crear tienen su operación
  // (ver_videos_cubos, crear_video_cubos, arriba en CUBIERTAS). Lo de acá son los PASOS de la pantalla, que por la API se
  // resuelven adentro de crear_video_cubos; y el MP4 se arma en el navegador de la persona («Descargar MP4»), sin acción del servidor.
  'app/ai-avatar/cubos/actions.ts#guionCubosAction': 'el guion lo escribe el propio chat de MaKo: por la API se pasa ya escrito a crear_video_cubos',
  'app/ai-avatar/cubos/actions.ts#personajeDesdeFotoAction': 'leer la foto es un paso de la pantalla: por la API el personaje se pasa por partes a crear_video_cubos',
  'app/ai-avatar/cubos/actions.ts#cambiarCubosAction': 'retocar el personaje o el formato de un video ya hecho es de la pantalla del estudio; por la API se crea otro con crear_video_cubos',
  'app/ai-avatar/cubos/actions.ts#borrarCubosAction': 'borrar un video (y su voz, que no se recupera) se hace en la pantalla del estudio, con su confirmación',
  // El clip de 10 s que el reto REGALA el día 6 (20/11/2026, R57-02, app/ai-avatar/regalo/clip.ts). No es una función de la app:
  // es UNA pieza por prueba, que pide la tarjeta del día 6 del reto. Lo que queda (el video) se lee por la API como cualquier
  // video con avatar del historial; pedirlo por fuera del reto sería abrir un generador de Pro sin candado.
  'app/ai-avatar/regalo/actions.ts#clipDeRegaloAction': 'es la tarjeta del día 6 del reto preguntando cómo va su regalo; el video, una vez hecho, queda en el historial de videos',
  'app/ai-avatar/regalo/actions.ts#pedirClipDeRegaloAction': 'el regalo del reto (uno por prueba, sin el candado de Pro) lo pide la tarjeta del día 6; por la API sería un generador de Pro abierto',
};

/**
 * Lo que todavía no tiene su operación, por archivo. SÓLO BAJA (tests/api-mako-cobertura.test.ts fija cuántas son).
 * Generado el 18/11/2026 con el inventario de todos los 'use server' de app/ menos CUBIERTAS y EXCEPCIONES.
 */
export const DEUDA: Readonly<Record<string, readonly string[]>> = {
  'app/_chat/bloques/cobranza-actions.ts': ['leerCobranzaDelHilo'],
  'app/_components/zona-actions.ts': ['detectarZonaAction'],
  'app/_sin-conexion/acciones.ts': ['revisarCambiosAction', 'subirCambioAction'],
  'app/admin/cobros/actions.ts': [
    'venderPlanAction', 'cobrosDeMakoAction', 'anularCobroMakoAction', 'reembolsarCobroMakoAction', 'atarCobroMakoAction',
    'cancelarSuscripcionMakoAction', 'precioClienteAgenciaAction', 'guardarPrecioClienteAgenciaAction', 'preciosLocalesAction',
    'guardarPrecioLocalAction',
  ],
  'app/admin/cobros/recibos-actions.ts': [
    'recibosAction', 'cargarPagoAction', 'anularReciboAction', 'marcarDevueltoReciboAction', 'guardarEmisorAction',
    'guardarWaSoloAction',
  ],
  'app/admin/operaciones/acciones.ts': [
    'fotoCentroAction', 'pedidosDelChatAction', 'pushesCentroAction', 'turnosCentroAction', 'guardarAliasCuentaAction',
    'creditoApiAction', 'creditoDelNegocioAction', 'computadorasDelNegocioAction', 'marcarMensajeAction', 'marcarYaVistoAction',
    'guardarBorradorAction', 'contestarPreguntaAction', 'ignorarPreguntaAction', 'ignorarDecisionAction', 'encolarPedidoAction',
    'cancelarPedidoAction', 'crearTokenCarteroAction', 'guardarMunecoAction', 'decidirChatNuevoAction',
  ],
  'app/admin/plantillas/actions.ts': ['retirarPlantillaAction'],
  'app/admin/runway/acciones.ts': ['responderDecision', 'deshacerDecision'],
  'app/ads-writer/onboarding-actions.ts': ['marcarPasoCopyAction'],
  'app/agency/actions.ts': [
    'sumarmeComoAgencyAction', 'abrirCuentaClienteAction', 'leadParaAgencyAction', 'aplicarPlantillaAction',
    'darDeBajaClienteAction', 'cambiarPlanClienteAction', 'marcarMesPagadoAction', 'quitarMesPagadoAction', 'corregirRelojAction',
    'mensualidadPrendidaAction',
  ],
  'app/ai-avatar/actions.ts': [
    'inicioAvatarAction', 'crearLookAction', 'estadoLookAction', 'borrarLookAction', 'crearVideoAction',
  ],
  'app/automations/automatizaciones-del-lead-actions.ts': [
    'enAutomatizacionesAction', 'automatizacionesDelLeadAction', 'automatizacionesDelLeadDetalleAction',
    'frenarEnAutomatizacionAction', 'empezarDeNuevoEnAutomatizacionAction', 'volverAProbarEnAutomatizacionAction',
    'frenarLeadsEnAutomatizacionesAction',
  ],
  'app/automations/config-automatizacion-actions.ts': ['getConfigAutomatizacionAction', 'saveConfigAutomatizacionAction'],
  'app/automations/difusion/actions.ts': ['prepararDifusionAction', 'crearDifusionAction'],
  'app/calendario/actions.ts': [
    'crearEventosAction', 'cambiarEventoAction', 'marcarEventoAction', 'borrarEventoAction', 'restaurarEventoAction',
    'cambiarEventoGoogleAction', 'borrarEventoGoogleAction', 'restaurarEventoGoogleAction', 'linkDeAgendaAction',
    'publicacionAction', 'guardarPublicacionAction', 'publicacionDesdeCrearAction', 'repeticionAction', 'guardarRepeticionAction',
    'subidaArchivoAction', 'programarAction', 'listasParaProgramarAction', 'cancelarPublicacionAction', 'noQuedoProgramadaAction',
    'resolverEnZernioAction', 'releerPublicacionesAction', 'emailDelEventoAction', 'revisarEmailAction', 'enlazarEmailAction',
    'soltarEmailAction',
  ],
  'app/competitor-spy/actions.ts': [
    'competidoresAction', 'piezasAction', 'sumarCompetidorAction', 'sugeridosAction', 'quitarCanalAction', 'ponerPaisAction',
    'sumarCanalAction', 'revisarAction', 'guardarAnuncioAction', 'juntarCompetidoresAction', 'quitarCompetidorAction',
    'seguidosAction', 'seguirAction',
  ],
  'app/configuraciones/gcal-actions.ts': ['getGoogleCalendarStatusAction', 'disconnectGoogleCalendarAction'],
  'app/configuraciones/horario-actions.ts': ['getHorarioEnvioAction', 'saveHorarioEnvioAction', 'saveZonaHorarioAction'],
  'app/configuraciones/negocio-actions.ts': ['nombreDelNegocioAction', 'guardarNombreNegocioAction'],
  'app/configuraciones/plan/actions.ts': ['darmeDeBajaAction', 'aceptarRetencionAction', 'pasarAProAction', 'pedirProAction'],
  'app/configuraciones/telefonos-actions.ts': ['getTelefonosAction', 'saveTelefonoAction', 'deleteTelefonoAction'],
  'app/conocimientos/ajustes-actions.ts': [
    'guardarAjusteConocimientoAction', 'ordenarModulosConocimientoAction', 'llevarClaseConocimientoAction',
  ],
  'app/creaciones/actions.ts': [
    'estrellaAction', 'opcionesPublicarAction', 'guardarPlantillaAction', 'plantillasDelTipoAction', 'tomarPlantillaAction', 'rankingAction',
  ],
  'app/crm/[id]/cobros-actions.ts': [
    'opcionesCobroAction', 'monedasCobroAction', 'cobrosDelLeadAction', 'senalesDeCobroAction', 'crearCobroAction',
    'anularCobroAction',
  ],
  'app/crm/[id]/deal-actions.ts': [
    'getIdentidadesFiscalesAction', 'saveIdentidadFiscalAction', 'deleteIdentidadFiscalAction', 'quitarSinCobroAction',
    'marcarPagoManualAction',
  ],
  'app/crm/[id]/pagos-campo-actions.ts': [
    'guardarCampoDealAction', 'guardarObligacionAction', 'guardarVentaAction', 'ajustarPlanAction',
    'cortarRecordatoriosCuotaAction', 'cambiarEstadoSuscripcionAction', 'monedaDelNegocioAction', 'guardarMonedaNegocioAction',
    'cobradoDelLeadAction',
  ],
  'app/crm/[id]/suscripcion-actions.ts': ['deshacerCambioSuscripcionAction', 'registrarPagoSuscripcionAction'],
  'app/crm/actions.ts': [
    'getLeadInsights', 'getLeadFullAction', 'requisitosDeEtapaAction', 'completeStageMoveAction', 'resolverQueHacerAction',
    'leadsDeProductoAction', 'crearLeadEnTableroAction', 'createLeadAction', 'crearLeadDesdeWhatsappAction',
    'savePlanPagosAction', 'marcarPagoAction', 'deleteLeadAction', 'deleteLeadInlineAction', 'setLeadStageAction',
    'bulkFillLeadFieldAction', 'moverLeadsDeEtapaAction', 'eliminarLeadsAction', 'recuperarLeadsAction', 'papeleraDeLeadsAction',
    'contarPapeleraAction', 'bulkIgnoreEmpresaAction', 'contarLeadsExportAction', 'getOpcionesExportAction',
    'topeDeExportarAction', 'exportLeadsAction', 'importarLeadsRevisadosAction', 'reagendarReunionAction',
    'duracionReunionAction', 'permisoCalendarioAction', 'saveLeadMetaAction', 'guardarCampoLeadAction', 'deshacerCampoLeadAction',
    'deshacerContactoLeadAction', 'getEquipoAction', 'undoStageMoveAction', 'getLeadAuditAction', 'getLeadNotasAction',
    'addLeadNoteAction', 'revertAuditChangeAction', 'revertMoveAction', 'markManualNutritionAction', 'markMeetingManualAction',
    'saveFunnelAction', 'embudoEnDetalleAction', 'extrasDelEmbudoAction', 'renombrarEmbudoAction', 'archivarEmbudoAction',
    'eliminarEmbudoDefinitivoAction', 'restaurarEmbudoAction', 'embudosArchivadosAction', 'editarEtapaAction',
    'declararEntradasAction', 'linkDeAgendaAction',
  ],
  'app/crm/agenda-evento-actions.ts': [
    'vinculadosDeEtapaAction', 'crearEventoAgendaAction', 'editarEventoAgendaAction', 'detalleEventoAgendaAction',
  ],
  'app/crm/agendar-r2-actions.ts': ['puedeAgendarR2Action', 'huecosR2Action', 'reservarR2Action'],
  'app/crm/auto-actions.ts': ['autoReunionesAction'],
  'app/crm/calificacion-actions.ts': ['adondeVaLaCalificacionAction'],
  'app/crm/campanas-actions.ts': [
    'campanasAsignadasAction', 'campanasDelProductoAction', 'previaLoteAction', 'previaCampanaAction', 'asignarLoteAction',
    'asignarCampanaAction', 'alternarFunnelCampanaAction', 'deshacerLoteAction', 'deshacerAsignacionAction', 'quitarLoteAction',
    'quitarCampanaAction',
  ],
  'app/crm/cobro-etapa-actions.ts': [
    'leerCobroDeEtapaAction', 'vincularProductoAEtapaAction', 'preciosDeStripeAction', 'vincularPrecioDeStripeAction',
    'cambiarCuentasDelVinculoAction', 'desvincularProductoAction', 'guardarProductoCobroAction', 'linkDelVinculoAction',
  ],
  'app/crm/datos-sin-marcar-actions.ts': [
    'ignorarDatoAction', 'ignorarDatosDelLeadAction', 'avisosDatosAction', 'guardarAvisosDatosAction',
  ],
  'app/crm/enriquecer-actions.ts': ['pedidosDeFichasAction', 'completarFichasDeLeadsAction', 'completarPerfilesDeLeadsAction'],
  'app/crm/ficha-actions.ts': ['leerFichaFunnelAction', 'historialFichaAction', 'volverFichaAction'],
  'app/crm/grupo-wa-actions.ts': [
    'abrirTraerDeGrupoAction', 'etapasDeFunnelAction', 'gruposDeLineaAction', 'participantesDeGrupoAction', 'traerDeGrupoAction',
    'completarPerfilesDeGrupoAction', 'completarFichasDeGrupoAction',
  ],
  'app/crm/insights-actions.ts': ['generateLeadInsightAction', 'analizarLlamadaLeadAction', 'insightsDeLlamadaAction'],
  'app/crm/lead-cabecera-actions.ts': ['guardarCaraLeadAction'],
  'app/crm/lead-funnel-actions.ts': [
    'productosDeLaFichaAction', 'agregarAProductoAction', 'quitarDeProductoAction', 'deshacerQuitarAction',
    'moverEtapaEnProductoAction', 'agregarLoteAProductoAction', 'quitarLoteDeProductoAction', 'previaPasarAction',
    'pasarAOtroFunnelAction', 'deshacerPasarAction',
  ],
  'app/crm/lead-view/ficha/pagos/cliente-en-cs-actions.ts': ['clienteEnCsAction'],
  'app/crm/lead-view/ficha/pagos/cuotas-actions.ts': ['proteccionesDeCuotasAction', 'quitarCuotaAction', 'agregarCuotaAction'],
  'app/crm/lead-view/ficha/pagos/documento-actions.ts': ['completarConDocumentoAction'],
  'app/crm/lead-view/ficha/pagos/seguimiento-actions.ts': [
    'recordatoriosDeCobroAction', 'motivosDeExcepcionesAction', 'quitarExcepcionAction', 'volverExcepcionAction',
  ],
  'app/crm/lead-view/ficha/resumen/bloques-actions.ts': ['tiempoEnEtapaAction'],
  'app/crm/lead-view/ficha/resumen/charla-actions.ts': [
    'charlaWhatsAppAction', 'charlaDmAction', 'paseAHumanoAction', 'cambiosDeMakoAction', 'mensajesListosAction',
    'loQueLeMandamosAction',
  ],
  'app/crm/lead-view/tz-workspace.ts': ['tzWorkspaceAction'],
  'app/crm/mako-confirm-actions.ts': ['listConfirmacionesAction', 'resolverConfirmacionAction'],
  'app/crm/nombres-actions.ts': ['leerNombresAction', 'marcarPalabraAction'],
  'app/crm/notas-actions.ts': [
    'editarNotaLeadAction', 'borrarNotaLeadAction', 'urlSubidaNotaLeadAction', 'urlAdjuntoNotaLeadAction',
    'descartarAdjuntoNotaLeadAction',
  ],
  'app/crm/oferta-lead-actions.ts': ['ofertasDelLeadAction', 'crearOfertaDesdeLeadAction'],
  'app/crm/orden-actions.ts': ['ordenarColumnaCrmAction'],
  'app/crm/piezas-web-actions.ts': ['piezasWebAction', 'asignarPiezaAction'],
  'app/crm/producto-cierre-actions.ts': ['productosParaCierreAction'],
  'app/crm/reuniones-actions.ts': ['contextoDeReunionesAction'],
  'app/crm/revisar/[id]/acciones.ts': ['confirmarLeadsAction', 'descartarLeadsAction'],
  'app/crm/tarjeta-campos-actions.ts': ['guardarCamposTarjetaAction'],
  'app/crm/unificar-actions.ts': ['previaDeUnificarAction', 'unificarFichasAction'],
  'app/customer-success/actions.ts': [
    'pagosDeClienteAction', 'crearClienteAction', 'autoasignarAction', 'guardarImagenClienteAction', 'guardarDatosClienteAction',
    'crearCuentaMakoAction', 'moverEntregaAction', 'moverEntregaLoteAction', 'sacarDeEntregaAction', 'quitarDeProductoAction',
    'volverAProductoAction', 'ordenarEtapaAction', 'guardarEtapasEntregaAction', 'crearServicioAction', 'renombrarServicioAction',
    'eliminarServicioAction', 'previaEliminarServicioAction', 'restaurarServicioAction', 'duplicarServicioAction',
    'anotarFichaAbiertaAction',
  ],
  'app/customer-success/comunidad/actions.ts': [
    'inicioComunidadAction', 'feedComunidadAction', 'detallePostAction', 'publicarPostAction', 'editarPostAction',
    'borrarPostAction', 'fijarPostAction', 'comentarAction', 'editarComentarioAction', 'borrarComentarioAction', 'likeAction',
    'votarAction', 'rankingAction', 'miembrosAction', 'perfilAction', 'guardarPerfilAction', 'subidaAdjuntoAction',
    'descartarAdjuntoAction', 'guardarCategoriaAction', 'borrarCategoriaAction', 'moverCategoriaAction',
    'guardarNombresNivelAction', 'calendarioAction', 'icsAction', 'opcionesEventoAction', 'guardarEventoAction',
    'borrarEventoAction', 'campanaAction', 'leerCampanaAction', 'seguirPostAction', 'aboutAction', 'guardarAboutAction',
    'guardarAjustesAction', 'buscarAction', 'sacarAlumnoAction', 'admitirAlumnoAction', 'sacadosAction',
    'cerrarComentariosAction', 'hiloDeClaseAction', 'comentarEnClaseAction',
  ],
  'app/customer-success/curso-ficha-actions.ts': [
    'cursoDeClienteAction', 'aprobarTareaCursoAction', 'linkDelCursoAction', 'mandarLinkCursoAction', 'invitarAlCursoAction',
    'guardarAlcanceCursoAction', 'desbloquearAction', 'invitarLiderAction', 'linkDeLiderAction', 'cambiarLiderAction',
    'agendarLlamadaCursoAction', 'borrarLlamadaCursoAction', 'urlEntregaCursoAction', 'otroIntentoQuizAction',
  ],
  'app/customer-success/curso/actions.ts': [
    'borrarClaseAction', 'moverClaseAction', 'opcionesComunidadAction', 'marcarVistaAlumnoAction', 'urlVerVideoAction',
    'guardarEstiloCursoAction', 'renombrarClaseAction',
  ],
  'app/customer-success/curso/adjuntos-actions.ts': [
    'urlSubidaAdjuntoAction', 'registrarAdjuntoAction', 'urlAdjuntoAction', 'urlsAdjuntosAction',
  ],
  'app/customer-success/curso/invitar-actions.ts': [
    'invitarClientesAction', 'invitarNuevoAlumnoAction', 'invitarAlCursoDelProductoAction', 'opcionesDeInvitarAction',
    'productosDeLosAccesosAction', 'buscarLeadsParaInvitarAction', 'invitarLeadDeCualquierEtapaAction',
    'cortarAccesoDadoAManoAction', 'habilitarAccesoDadoAManoAction',
  ],
  'app/customer-success/curso/modulos-actions.ts': [
    'crearModuloAction', 'renombrarModuloAction', 'vincularModuloAction', 'reordenarModulosAction', 'borrarModuloAction',
    'previaQuitarAction', 'restaurarModuloAction', 'guardarBloqueoAction', 'crearClaseAction', 'restaurarClasesAction',
    'moverClaseAAction', 'guardarLeccionAction', 'guardarCampoClaseAction',
  ],
  'app/customer-success/tarjeta-actions.ts': ['guardarTarjetaClientesAction'],
  'app/general/actions.ts': [
    'guardarObjectiveAction', 'cerrarObjectiveAction', 'registrarKpiAction', 'sembrarKpisAction', 'setCapacidadAction',
    'setObjetivoAction',
  ],
  'app/image-editor/actions.ts': ['crearDisenoNuevoAction', 'crearCarruselDesdeGuionAction'],
  'app/image-editor/carruseles/actions.ts': ['guardarBusquedaAction', 'borrarBusquedaAction'],
  'app/integraciones/landing-actions.ts': [
    'getPaginasAction', 'guardarPaginaAction', 'borrarPaginaAction', 'getVideosAction', 'guardarVideoAction', 'finPruebaAction',
    'borrarVideoAction',
  ],
  'app/integraciones/prueba-lead-actions.ts': ['leadDePruebaAction'],
  'app/integraciones/servicio-actions.ts': ['integracionAction'],
  'app/m/crm/acciones.ts': ['notaLeadAction', 'moverEtapaAction', 'deshacerMoverAction'],
  'app/m/image-editor/actions.ts': ['borrarDisenoMAction'],
  'app/m/inbox/acciones.ts': ['resolverConfirmacionMovil'],
  'app/m/mako/acciones.ts': ['confirmarEnChatAction', 'cancelarEnChatAction'],
  'app/m/plan/acciones.ts': ['marcarHechaAction', 'moverTareaAction'],
  'app/newsletters/actions.ts': [
    'recargarAction', 'responderAperturaAction', 'proponerEdicionAction', 'guardarAjustesAction', 'landingAlNewsletterAction',
    'permisoParaSumarAction', 'nuevaEdicionAction', 'guardarEdicionAction', 'eliminarEdicionAction', 'escribirEnCopywriterAction',
    'traerDelCopywriterAction', 'vistaPreviaAction', 'pruebaAction', 'programarAction', 'desprogramarAction', 'enviarAction',
  ],
  'app/partners/actions.ts': [
    'cambiarCodigoPartnerAction', 'cambiarCobroPartnerAction', 'marcarPagoPartnerAction', 'llevarAPartnersAction',
    'leadParaPartnersAction',
  ],
  'app/plan/board/columnas-actions.ts': ['cambiarColumnasPlanAction'],
  'app/plan/board/tarjeta-actions.ts': ['guardarTarjetaPlanAction'],
  'app/second-brain/recolector-actions.ts': ['cambiarRecolectorAction'],
  'app/stories/actions.ts': ['generarSecuenciaAction', 'historialStoriesAction', 'marcarContextoStoriesAction'],
  'app/tickets/acciones.ts': ['levantarDesdeSoporteAction', 'contestarTicketAction'],
  'app/tickets/bandeja/acciones.ts': [
    'leerBandejaAction', 'guardarVistaAction', 'verTicketBandejaAction', 'decidirTicketAction', 'anotarDespachoAction',
    'corregirTipoAction', 'cambiarPrioridadAction', 'autoArregloAction', 'cuantosEsperanAction',
  ],
  'app/video-editor/avatar/actions.ts': ['avataresAction', 'crearAvatarAction'],
  'app/video-generator/actions.ts': ['generarPlanAction', 'editarLineaPlanAction'],
  'app/video-generator/cargar-guiones-action.ts': [
    'previoCargaAction', 'cargarGuionesAction', 'textoDeArchivoAction', 'textoDeLinkAction', 'editarGuionAction',
  ],
  'app/video-generator/estudio/acciones.ts': ['releerProyectosAction'],
  'app/video-generator/onboarding-actions.ts': [
    'marcarPasoVideoAction', 'guardarAcentoAction', 'guardarMuletillasAction', 'leerVozAction', 'escucharMiVozAction',
  ],
  'app/video-generator/puente-actions.ts': [
    'conectarPuenteAction', 'estadoPuenteAction', 'probarPuenteAction', 'estadoPruebaAction', 'probarImagenAction',
    'rehabilitarPuenteAction',
  ],
  'app/video-generator/video-action.ts': [
    'generarTomaAction', 'estadoTomaAction', 'pedirSaldoAction', 'saldoAction', 'escribirEscenasAction', 'corregirEscenaAction',
    'generarImagenAction', 'estadoImagenAction', 'elegirImagenAction', 'descartarTomaAction', 'editarClipsAction',
    'escribirVozTomaAction', 'guardarPromptEscenaAction', 'guardarPromptTomaAction', 'restaurarTomaAction', 'elegirFotoAction',
    'elegirUltimaFotoAction', 'marcarEjemploVistoAction', 'marcarCaraVistaAction', 'confirmarEscenaAction',
    'subirImagenEscenaAction', 'cambiarMuletillasAction', 'montarAnuncioAction', 'estadoMontajeAction',
    'escenariosYaGeneradosAction', 'reusarEscenariosAction', 'elegirEscenarioAction', 'otroFondoAction',
  ],
};
