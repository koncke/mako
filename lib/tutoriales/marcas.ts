// =============================================================================
// Las MARCAS de los tutoriales de cada pestaña (`data-recorrido`), en UN lugar (18/11/2026)
// =============================================================================
// El tutorial de una pestaña (lib/tutoriales) señala cada paso con un selector. Donde el control no tiene
// un atributo propio y estable (un `aria-label`, un `href`), se le pone `data-recorrido="tour-<pestaña>-<cosa>"`.
// La MISMA marca va en la computadora y en el teléfono (MaKo Mobile, /m), así el mismo paso anda en los dos.
//
// Los nombres viven ACÁ y no escritos a mano en cada componente: el componente y el tutorial importan la
// misma constante, y tests/tutoriales-pestanas.test.ts comprueba que cada marca que pide un tutorial se
// ponga en algún componente. Una marca que se escribe distinta en dos lados no da error: el paso se saltea.
// =============================================================================

/** Las marcas fijas, por pestaña. */
export const MARCA = {
  opsCenterQueHagoHoy: 'tour-ops-center-que-hago-hoy',
  crmVerInfo: 'tour-crm-ver-info',
  crmReuniones: 'tour-crm-reuniones',
  /** «Mostrar más integraciones»: la grilla de la computadora muestra doce sin conectar (app/integraciones/IntegracionesBoard.tsx). */
  integracionesMas: 'tour-int-mas',
  avatarAntes: 'tour-avatar-antes',
  avatarGenerar: 'tour-avatar-generar',
  copywritingPegar: 'tour-copywriting-pegar',
  /** «Mis landings» en la computadora (app/web-generator/OutliersLandings.tsx); en el teléfono es el link «Tus landings» (`?ver=lista`). */
  webMisLandings: 'tour-web-mis-landings',
  /** Prioridades · Tareas · Proyectos · Recurrentes del Plan de la computadora (en el teléfono: `.m-seg[aria-label="Vista"]`). */
  planVistas: 'tour-plan-vistas',
  /** «Invitar» de Settings › Equipo (app/equipo/EquipoView.tsx). */
  equipoInvitar: 'tour-equipo-invitar',
  /** La foto de la barra lateral, que abre el menú de Configuración (app/_components/Sidebar.tsx). Sólo computadora. */
  barraFoto: 'tour-barra-foto',
  /** «Mover a…» de la ficha rápida (app/_ui/TarjetaKanban.tsx → CuerpoFichaRapida), en la computadora y en el teléfono. */
  crmMoverA: 'tour-crm-mover-a',
  // Las que pide el manifiesto de los videos (public/tutoriales/manifiesto.json → frases[].sel), con sus ids.
  /** El botón «WhatsApp» de conectar un canal en Chats (app/chats/ConectarCanal.tsx). */
  chatsWhatsapp: 'tour-chats-whatsapp',
  /** «Avisos al celular» del detalle del canal Celular (app/perfil/NotificacionesPanel.tsx, ?canal=celular). */
  notifAvisosCelular: 'tour-settings-notificaciones-avisos-celular',
  /** La fila «Extensión para Chrome» de Instalar la app (app/perfil/instalar/InstalarApp.tsx). */
  instalarExtension: 'tour-settings-instalar-extension',
  // ── Los de los guiones de video (18/11, C:/dev/tutoriales-video/marcas-que-faltan.md): un id por frase, como el manifiesto. ──
  /** Settings › Tu plan (app/configuraciones/plan/PlanPanel.tsx): «Tu primer mes», «Pasar a MaKo Pro» y «Empezar mi plan ya». */
  settingsPlanPrimerMes: 'tour-settings-plan-primer-mes',
  settingsPlanPro: 'tour-settings-plan-pro',
  settingsPlanEmpezar: 'tour-settings-plan-empezar',
  /** Settings › Seguridad (app/perfil/seguridad/SeguridadCuenta.tsx): la fila «Verificación en 2 pasos» y, en su detalle, «Configurar». */
  seguridad2Pasos: 'tour-settings-seguridad-2-pasos',
  seguridadConfigurar: 'tour-settings-seguridad-configurar',
  /** Settings › Identidades fiscales (app/configuraciones/IdentidadesFiscalesPanel.tsx): «Agregar» y, en su ventana, «Llenar desde un PDF…». */
  fiscalAgregar: 'tour-settings-fiscal-agregar',
  fiscalLlenar: 'tour-settings-fiscal-llenar',
  /** MaKo Partners: «Hacerme partner» de la landing (app/mako-partners/LandingPartners.tsx) y «A cobrar» del panel (app/partners/PanelPartner.tsx). */
  partnersHacerme: 'tour-partners-hacerme',
  partnersACobrar: 'tour-partners-a-cobrar',
  /** Agency Dashboard (app/agency/LandingAgency.tsx): «Así de simple», «¿Partner o Agency?» y «Sumarme como Agency». */
  agencyAsiDeSimple: 'tour-agency-asi-de-simple',
  agencyPartnerOAgency: 'tour-agency-partner-o-agency',
  agencySumarme: 'tour-agency-sumarme',
  /** API (app/api-mako/ApiMako.tsx y Tokens.tsx): las pestañas Documentación y Tokens, y «Generar nuevo token». */
  apiDocumentacion: 'tour-api-documentacion',
  apiTokens: 'tour-api-tokens',
  apiGenerar: 'tour-api-generar',
  /** Classroom › Community (app/_comunidad/Feed.tsx y Compositor.tsx). */
  classroomCommunityCategorias: 'tour-classroom-community-categorias',
  classroomCommunityMenuPost: 'tour-classroom-community-menu-post',
  classroomCommunityEscribir: 'tour-classroom-community-escribir',
  /** Classroom › Clients (app/customer-success: la primera tarjeta, el selector de vistas y «Cargar un cliente»). */
  classroomClientsCliente: 'tour-classroom-clients-cliente',
  classroomClientsVistas: 'tour-classroom-clients-vistas',
  classroomClientsCargar: 'tour-classroom-clients-cargar',
  /** Classroom › Calendar (app/_comunidad/Calendario.tsx y EditorEvento.tsx). */
  classroomCalendarNuevo: 'tour-classroom-calendar-nuevo',
  classroomCalendarQuienEntra: 'tour-classroom-calendar-quien-entra',
  classroomCalendarCrear: 'tour-classroom-calendar-crear',
  /** Classroom › Leaderboards (app/_comunidad/Ranking.tsx). */
  classroomLeaderboardsNiveles: 'tour-classroom-leaderboards-niveles',
  classroomLeaderboardsRanking: 'tour-classroom-leaderboards-ranking',
  classroomLeaderboardsNombres: 'tour-classroom-leaderboards-nombres',
  /** Classroom › About (app/_comunidad/About.tsx). */
  classroomAboutEditar: 'tour-classroom-about-editar',
  classroomAboutReglas: 'tour-classroom-about-reglas',
  classroomAboutPublican: 'tour-classroom-about-publican',
  classroomAboutGuardar: 'tour-classroom-about-guardar',
} as const;

/** Una sección de Settings (lib/ajustes-secciones.ts: `info`, `seguridad`, `instalar`, `equipo`, `integraciones`…). */
export const marcaSettings = (clave: string) => `tour-settings-${clave}`;

/** Una integración de /integraciones (su `key` de lib/integraciones-catalogo.ts: `whatsapp`, `meta`, `calendly`…). */
export const marcaIntegracion = (clave: string) => `tour-int-${clave}`;

/** El nombre de una tab en una marca: «AI Avatar» → `ai-avatar`, «Offer» → `offer`. */
export const slugTab = (tab: string) => tab.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Lo de una pantalla de crear (app/_crear/PantallaCrear.tsx, y su par del teléfono): `charla` (el chat con MaKo) y
 * `proyectos` (la flecha que abre la lista de proyectos). Offer → `tour-offer-charla`, `tour-offer-proyectos`.
 */
export const marcaCrear = (tab: string, cosa: 'charla' | 'proyectos') => `tour-${slugTab(tab)}-${cosa}`;

/** El selector de una marca, para los pasos de los tutoriales. */
export const conMarca = (marca: string) => `[data-recorrido="${marca}"]`;
