// =============================================================================
// workspace — aislamiento multi-inquilino de la capa de datos
// =============================================================================
// getWorkspaceActual() resuelve QUÉ workspace ve el request; getTenantDb()
// devuelve un cliente Supabase que auto-filtra por ese workspace. El scoping
// vive acá (un solo lugar) en vez de recordar .eq('workspace_id') en 300+
// queries: el service_role bypassa RLS, así que la frontera es de la app.
//
// Resolución del workspace (getWorkspaceActual):
//   · usuario logueado            → su workspace_id
//   · admin impersonando          → el workspace de la cookie mako_ws
//   · admin SIN impersonar        → null  (ve el panel /admin, no data de nadie)
//   · sesión legacy / dev         → workspace 1 (dueño = Mauricio)
//   · sin sesión (cron/webhook)   → workspace 1 (dueño)
//
// getTenantDb() aplica ese workspace: filtra los SELECT/UPDATE/DELETE y estampa
// los INSERT/UPSERT de las tablas de datos. Si el workspace es null (admin sin
// impersonar) → fail-closed: 0 filas en lecturas, error de FK en escrituras.

import 'server-only';
import { cache } from 'react';
import { AsyncLocalStorage } from 'node:async_hooks';
import { cookies, headers } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase';
import { getSesionAdmin, getUsuarioActual } from './auth';
import { CAPA_DEFAULT, capaDef, esCapaValida, type CapaId } from './capas';
import { IMPERSONATE_COOKIE, LEGACY_COOKIE, OWNER_WS, SESSION_COOKIE, firmarImpersonacion, leerImpersonacion, type RolWorkspace } from './auth-session';
import { WS_HEADER, conWs, parseWs } from './ws-tab';
import { contextoDeAgencia } from './agencia';

export { firmarImpersonacion, IMPERSONATE_COOKIE, OWNER_WS };

/**
 * El workspace de ESTA pestaña, si el super admin abrió un cliente con `?ws=N`.
 *
 * Lo pone `proxy.ts` como header interno DESPUÉS de verificar contra la sesión
 * firmada que quien pide es admin de agencia — y lo borra en cada request antes
 * de decidir. Acá se lee y ya: si el header está, es porque el proxy lo puso.
 * Nunca leer `?ws=` directo de la URL en el resto de la app: eso saltearía la
 * validación y sería un IDOR.
 *
 * Gana sobre la cookie de impersonación porque es lo que el usuario está mirando
 * AHORA en esta pestaña; la cookie es del navegador entero y no distingue.
 */
async function wsDePestana(): Promise<number | null> {
  return parseWs((await headers()).get(WS_HEADER));
}

/**
 * Un destino interno CON el `?ws=` de esta pestaña. **Para todo `redirect()` del server.**
 *
 * ⚠️ `redirect('/loquesea')` PIERDE la pestaña, y el modo en que falla no se parece a un
 * bug: te deja mirando OTRA cuenta. El caso que lo destapó — el dueño abrió el Cliente de
 * Prueba, el guard del onboarding lo mandó a `redirect('/onboarding')` sin el `?ws=`, y
 * aterrizó en SU propio onboarding, sin barra de agencia y sin forma de volver a entrar.
 * Desde afuera se lee como «la app se rompió», no como «me cambió de cliente».
 *
 * El repo ya tenía la regla escrita para links y `fetch` (`app/_ui/Link`, `WsFetch`), y le
 * faltaba justo la tercera forma de navegar. Un redirect ES navegación.
 *
 * Devuelve el href intacto cuando no hay pestaña, así que ponerlo de más no cuesta nada:
 * para un cliente normal —que nunca tiene `?ws=`— es exactamente el string de antes.
 */
export async function rutaConWs(href: string): Promise<string> {
  return conWs(href, await wsDePestana());
}

// Contexto de workspace por-request. Lo usa la caché (lib/cache.ts): dentro de
// unstable_cache NO se puede llamar cookies(), así que el workspace se fija acá
// antes de ejecutar la lectura cacheada y getWorkspaceActual lo lee de acá.
const wsStore = new AsyncLocalStorage<number | null>();
export function runWithWorkspace<T>(ws: number | null, fn: () => T): T {
  return wsStore.run(ws, fn);
}

// Tablas de datos por-cliente que el proxy scopea. app_settings y credenciales NO
// están acá: se manejan con scoping explícito en sus libs (settings.ts,
// credenciales.ts) por su semántica de key/singleton.
//
// `funnels` (mig 0170) SÍ está, y ese es el cambio: la tabla vieja era un
// SINGLETON —una fila por workspace, con el .eq a mano en cada call-site— y
// `funnels` tiene N filas. Con N filas, olvidarse el .eq ya no da «no encuentra»:
// da los funnels de OTRO cliente. Lo mismo vale para las tablas de la oferta.
const TENANT_TABLES = new Set<string>([
  // `agente_sesiones` va acá para que el CLIENTE, cuando mire su propio panel de «lo
  // que tu agente le contó a MaKo», vea solo lo suyo. El panel del DUEÑO la lee con
  // el cliente de servicio y sin scope, a propósito: es el único lugar del sistema
  // donde el aislamiento se cruza, y está declarado en la migración 0124.
  'agente_sesiones',
  // La cola del resumen diario de avisos (mig 0161): una fila por aviso pospuesto. Va acá
  // porque las filas son de un workspace y el cron las manda por el grupo de ESE workspace.
  'avisos_cola',
  // El agendado por TIEMPO de cada mensaje (mig 0183). ⚠️ SIN ESTO LA TABLA ES
  // PASSTHROUGH: `getProgramado` devolvía la fila de CUALQUIER workspace para ese
  // `aviso_id` —o sea el horario de otro cliente— y `drenarProgramados`, que corre
  // adentro de un `runWithWorkspace`, leía y avanzaba las filas de TODOS. Medido el
  // 30/09/2026: la tabla quedó vacía porque el upsert fallaba, y eso tapó el agujero
  // de casualidad. Es el mismo modo de falla del `wsDeInstancia` de la 0180.
  'avisos_programados',
  // El «AI Analyst» del Dashboard (mig 0247): una fila por negocio, persona y hoja, que es a la vez el
  // estado, el candado y el horario. Sin esta línea el cron de un negocio leería y avanzaría lo
  // programado de TODOS, y el panel podría mostrar el análisis de otro negocio con el mismo hoja_id
  // (los del informe inicial son fijos: «marketing», «comercial»).
  'dashboard_analisis',
  // Las cajas «Conclusiones de MaKo» del Dashboard (mig 0260, tanda v5): una fila por negocio, persona, hoja,
  // pop-up, caja y lo abierto. Mismo porqué que la de arriba, y uno más: la de una caja de llamada guarda lo que
  // se dijo en esa llamada (el transcript), así que sin esta línea se leería el de OTRO negocio.
  'dashboard_ia_elementos',
  // ⚠️ SIN ESTA LINEA `getTenantDb()` ES PASSTHROUGH, no «sin scope»: la lectura
  // devolveria las corridas de CUALQUIER workspace y el drenador de un cliente
  // avanzaria y mandaria las filas de todos. No da error: contesta de mas.
  'flujo_corridas',
  // La ENTREGA de un servicio (mig 0188): el catálogo de etapas por producto y en qué
  // etapa está cada cliente. Las dos van acá por la misma razón que `funnels`: tienen N
  // filas por workspace, así que olvidarse el .eq ya no da «no encuentra» — da el
  // tablero de Customer Success de OTRO cliente, con sus clientes adentro.
  'producto_entrega', 'cliente_entrega',
  // Y las dos de la 0196: quién se sacó de su producto y el orden manual de cada columna.
  'cliente_entrega_fuera', 'cliente_entrega_orden',
  // El CURSO de un servicio (mig 0202): las clases, el avance de cada cliente, su acceso y
  // sus llamadas. Las cuatro tienen N filas por workspace: sin el `.eq`, la lectura devolvería
  // el curso y las respuestas de los clientes de OTRO negocio.
  'curso_clases', 'curso_progreso', 'curso_accesos', 'curso_sesiones',
  // Las notas del equipo sobre una clase o una etapa (mig 0208). Sin esta línea las notas de
  // OTRO negocio aparecerían debajo de una clase, con sus adjuntos.
  'curso_clase_notas',
  // Cómo se ve el curso de cada producto: color, título y portadas (mig 0214). Sin esta línea el
  // curso de un negocio se dibujaría con el color y las tapas que eligió OTRO.
  'curso_estilo',
  // Los adjuntos de la descripción de una clase (mig 0216). Sin esta línea, la lista de adjuntos de
  // una clase traería los de OTRO negocio.
  'curso_adjuntos',
  // Los módulos SUELTOS del curso y el candado de los vinculados, y lo que el equipo le abre a mano a
  // cada alumno (mig 0220). Sin estas líneas, un curso dibujaría los módulos de OTRO negocio y el
  // portal le abriría a un alumno lo que se le abrió a otro.
  'curso_modulos', 'curso_desbloqueos',
  // La COMUNIDAD de cada producto (mig 0217, la tab Comunidad y la pestaña del alumno). Las doce
  // tienen N filas por workspace: sin estas líneas, el feed, los likes, el ranking y la campana de un
  // negocio mostrarían los de TODOS. (El código de la comunidad igual escribe el workspace a mano en
  // cada consulta, porque nació antes de este registro.)
  'comunidad_ajustes', 'comunidad_categorias', 'comunidad_posts', 'comunidad_comentarios',
  'comunidad_likes', 'comunidad_votos', 'comunidad_perfiles', 'comunidad_notificaciones',
  'comunidad_seguimientos', 'comunidad_baneos', 'comunidad_eventos', 'comunidad_evento_avisos',
  // El orden manual de las columnas del kanban del CRM (mig 0200), la gemela de `cliente_entrega_orden`.
  // Sin esta línea la lectura devolvería el orden de las columnas de CUALQUIER workspace.
  'lead_orden',
  // Los productos de un lead ADEMÁS de su casa (mig 0207). Sin esta línea getTenantDb no acota
  // por cliente y el tablero de un producto dibujaría los agregados de TODOS los workspaces.
  'lead_funnel',
  // Los eventos de la agenda (Calendly, Cal.com) vinculados a una etapa de reunión (mig 0293). Sin esta
  // línea, el webhook leería los vínculos de TODOS los negocios y una reserva podría caer en el embudo
  // de otro (el ruteo puro igual los filtra por workspace: lib/agenda-evento-etapa.ts).
  'agenda_evento_etapa',
  // Las ETIQUETAS del CRM (mig 0224): el catálogo de cada negocio y qué lead tiene cuál. Sin estas
  // líneas `getTenantDb()` es PASSTHROUGH: el CRUD listaría las etiquetas de TODOS los negocios y
  // «¿este lead ya la tiene?» contestaría con filas de otro cliente.
  'crm_etiquetas', 'crm_lead_etiquetas',
  // El feed de avisos POR WORKSPACE (mig 0250, MaKo Mobile): la 0048 no tenía `workspace_id` y
  // aplicada habría mostrado a cada cliente los avisos de todos. lib/notificaciones.ts escribe y
  // lee con el ws explícito; esta línea es la red si alguien la lee con getTenantDb.
  // (`push_suscripciones` NO va: no tiene `workspace_id`, se ata a la PERSONA.)
  'notificaciones',
  // Las insistencias vivas (mig 0180): un aviso que vuelve hasta que alguien dice «lo vi».
  // Va acá porque la fila es del workspace cuyo grupo recibe el mensaje — y porque el
  // techo que protege SU línea de WhatsApp no puede depender de leer la de otro.
  'insistencias',
  // Bitácora de la API de MaKo (mig 0158): una fila por llamada HTTP. Va acá para que
  // el cliente vea solo las suyas; la escribe lib/api-mako/bitacora.ts con ws explícito.
  'api_llamadas',
  'archivero_files',
  'ad_transcripts', 'adset_budget_daily', 'anthropic_usage', 'chart_chats', 'chart_sessions',
  'chat_agent_handoffs',
  'closing_analyses', 'closing_jobs', 'creative_transcripts', 'cs_clientes', 'cs_respuestas', 'email_broadcast_envios', 'email_broadcasts', 'evolution_contactos', 'evolution_instancias', 'evolution_labels', 'evolution_stage_labels', 'experimento_tareas',
  'experimentos', 'flow_puentes', 'flow_trabajos', 'formatos', 'landing_analyses', 'landing_drafts', 'landing_visits', 'lead_audit', 'leads', 'marketing_metrics_daily', 'montaje_trabajos',
  // Objectives y KPIs (mig 0155). `kpi_registros` va acá igual que las otras dos
  // aunque sólo la escriban acciones con sesión: el scope no se decide por quién
  // escribe hoy, sino por de quién son las filas.
  'objectives', 'kpis', 'kpi_registros',
  // El Calendario (mig 0271, 13/10/2026): lo que la persona agenda. Sin esta línea getTenantDb() es
  // PASSTHROUGH y el calendario de un negocio mostraría las publicaciones de todos.
  'calendario_eventos',
  // La tab Chats (mig 0284, 14/10/2026): el estado de cada conversación, lo que leyó cada persona y los eventos
  // del hilo. Sin estas líneas getTenantDb() es PASSTHROUGH: la bandeja de un negocio vería cerradas las
  // conversaciones que cerró OTRO, y `chat_leidos` mezclaría las marcas de dos negocios con la misma clave.
  'chat_estado', 'chat_leidos', 'chat_eventos',
  'identidades_fiscales', 'lead_insights', 'lead_respuestas', 'mako_acciones_pendientes', 'mako_confirmaciones', 'mako_doer_buffer', 'mako_doer_conv', 'mako_doer_lock', 'mako_knowledge', 'meta_campaign_drafts', 'meta_health_history', 'nutricion_envios', 'nutricion_inscripciones', 'nutricion_secuencias', 'pagos',
  'pipeline_stages', 'plan_dependencias', 'plan_propuestas', 'plan_reprios', 'propuestas', 'plan_proyectos', 'plan_tareas', 'productos', 'retros',
  // Los cobros de la pasarela (Stripe / Mercado Pago, mig 0255). Sin esta línea getTenantDb() es
  // PASSTHROUGH y la tab Pagos de una ficha listaría los cobros de TODOS los negocios. Las rutas
  // públicas (/pagar/<token>) y los webhooks leen con service role y ws explícito, a propósito.
  'cobros',
  // El Leads Scraper (mig 0289, 15/10/2026): las búsquedas de prospectos y lo que encontraron. Sin esta
  // línea getTenantDb() es PASSTHROUGH y la lista de prospectos de un negocio mostraría la de todos.
  'prospeccion_busquedas', 'prospectos',
  // El funnel y la oferta, desde el día uno de su migración (0169-0171). `funnels`
  // reemplaza a `funnel_config`, que era singleton y por eso quedaba afuera.
  'funnels', 'ofertas', 'oferta_productos', 'funnel_ofertas', 'lead_magnets',
  // Las conversaciones de la tab Offer (mig 0254): N filas por negocio, con lo que el dueño contó de
  // su oferta y el texto de sus documentos. Sin esta línea `getTenantDb()` es PASSTHROUGH y la lista
  // de conversaciones de un negocio mostraría las de todos (lib/offer-sesiones.ts).
  'offer_sesiones',
  // Grabación de sesión (mig 0191). Las DOS, y acá no hay margen: son las filas más
  // sensibles del producto —la pantalla de un visitante— y `getTenantDb()` sin esta
  // línea es PASSTHROUGH, así que la ficha de un lead listaría las grabaciones de
  // cualquier cliente y el sellador comprimiría los lotes de todos. El contrato
  // (lib/replay-contrato.ts) no puede atajarlo: decide qué se graba, no quién lo lee.
  'replay_sesiones', 'replay_lotes',
  'review_queue', 'script_analyses', 'script_drafts', 'service_incidents', 'setting_audios',
  // La biblioteca de archivos de los mensajes (mig 0225), al lado de la de audios: sin esta línea
  // `getAdjunto(id)` devolvería el archivo de OTRO negocio (lib/setting-adjuntos.ts filtra a mano
  // igual, por si esta línea se pierde al juntar las partes del rediseño del chatbot).
  'setting_adjuntos',
  'tarea_categorias', 'vsl_events', 'wa_bloqueados', 'wa_borradores', 'wa_mensajes', 'wa_ocultos', 'whatsapp_template_drafts', 'workspace_telefonos',
  // El editor de landings copiado de Gamma (mig 0246): las landings, su historial de versiones y
  // los comentarios por sección. Las tres tienen N filas por workspace: sin estas líneas
  // `getTenantDb()` es PASSTHROUGH y el Panel de un negocio listaría las landings de TODOS, con su
  // contenido. (lib/editor-landing/server.ts escribe además el `.eq` a mano en cada consulta.) La
  // página PÚBLICA no pasa por acá: lee por slug o por token con el cliente crudo.
  'landing_docs', 'landing_doc_versiones', 'landing_doc_comentarios',
  // Los comentarios del diagnóstico de una landing (mig 0264, tanda 2 T5): N filas por workspace.
  'landing_sugerencias',
  // El Image Editor (la copia de Canva, mig 0278): los diseños y «Subidos». N filas por workspace:
  // sin esta línea el inicio del editor de un negocio listaría los diseños de TODOS.
  'image_disenos', 'image_subidos',
  // El hilo del chat «Editar con IA» del Video Editor (mig 0298): una fila por persona y proyecto,
  // N por workspace. Sin esta línea un negocio podría leer el hilo de otro con el mismo proyecto.
  'video_editor_chats',
  // Canal Instagram vía Zernio (mig 0136). La tab se retiró el 06/10/2026 y ya no
  // las lee ni las escribe nadie, pero las TABLAS quedan en la base (sin migración
  // de drop), así que siguen acá: si alguien vuelve a leerlas por getTenantDb, que
  // salgan scopeadas y no con las filas de todos.
  'contenido_posts', 'ig_conversaciones', 'ig_mensajes', 'zernio_workspace',
  // Vistas de cohortes: getTenantDb NO scopea vistas por sí solo, pero estas
  // exponen workspace_id (mig 0084) y solo se LEEN (select) → el proxy inyecta
  // .eq('workspace_id', ws) y corta el leak del agregado global. OJO: scripts de
  // mantenimiento owner-side que las lean con `sql` crudo verán todos los ws.
  'v_cohortes_semanales', 'v_cohortes_mensuales',
]);

// Resolución desde cookies (memoizada por request). Solo se llama FUERA de
// unstable_cache; adentro se usa el AsyncLocalStorage.
const resolverDesdeCookies = cache(async (): Promise<number | null> => {
  const sesion = await getUsuarioActual();
  if (sesion) {
    if (sesion.legacy) return OWNER_WS;        // login compartido viejo / dev → dueño
    if (sesion.rol === 'admin') {
      // 1) LA PESTAÑA manda. `?ws=N` es lo que el admin está mirando acá y ahora,
      //    y es lo único que le permite tener varios clientes abiertos a la vez.
      const pestana = await wsDePestana();
      if (pestana) return pestana;
      // 2) La cookie de impersonación, que es del navegador ENTERO. Queda por las
      //    sesiones que ya la tienen puesta; la UI no la escribe más.
      const store = await cookies();
      const imp = leerImpersonacion(store.get(IMPERSONATE_COOKIE)?.value);
      // 3) Si no hay nada, el admin cae a SU PROPIO workspace (si tiene uno
      //    asignado) → un super-admin con espacio propio entra a lo suyo por
      //    default, sin pisar al dueño. null solo si el admin no tiene workspace
      //    → ve el panel /admin (contrato de siempre).
      return imp ?? sesion.ws ?? null;
    }
    // 4) LA VISTA DE AGENCIA. Una agencia NO es rol global admin —darle ese bit
    //    le abriría /admin y los workspaces de todos los clientes de MaKo—, así
    //    que entra por su propia puerta: una cookie firmada que dice QUIÉN entró
    //    y a dónde, más la cartera aprobada, revalidada contra la base en este
    //    mismo request. Todo eso es `contextoDeAgencia` (lib/agencia.ts).
    //
    //    ⚠️ Va DESPUÉS de la rama de admin y ANTES del workspace propio, y ese
    //    orden es el punto: si cayera después, la agencia vería SUS datos con la
    //    cara del cliente —sin 403 y sin nada roto—, que es el modo de falla que
    //    esta feature entera existe para evitar.
    const cliente = await contextoDeAgencia();
    if (cliente) return cliente;
    return sesion.ws ?? null;                   // usuario → su workspace
  }
  // Sin sesión resuelta: distinguir "no hay cookie de sesión" (cron / webhook /
  // público → dueño) de "hay cookie pero su fila ya no vale" (usuario suspendido
  // o eliminado cuyo token sigue firmado → FAIL-CLOSED: nunca caer al dueño).
  const store = await cookies();
  const tieneCookieSesion = Boolean(store.get(SESSION_COOKIE)?.value || store.get(LEGACY_COOKIE)?.value);
  return tieneCookieSesion ? null : OWNER_WS;
});

/** Workspace efectivo del request, o null si un admin no está impersonando. */
/**
 * El workspace del contexto EN CURSO, sin `await`.
 *
 * Existe para armar links que se mandan afuera desde funciones sincrónicas (ver `linkApp`):
 * `getStore()` ya es sincrónico, y volver async a un helper que se usa inline obligaba a
 * tocar sus catorce llamadores para resolver un dato que ya estaba a mano.
 *
 * ⚠️ Fuera de `runWithWorkspace` devuelve `null` y NO mira las cookies — no es un reemplazo
 * de `getWorkspaceActual()`, que es el que resuelve de verdad en un request.
 */
export function wsEnContexto(): number | null {
  return wsStore.getStore() ?? null;
}

export async function getWorkspaceActual(): Promise<number | null> {
  const enContexto = wsStore.getStore();
  if (enContexto !== undefined) return enContexto; // dentro de la caché
  return resolverDesdeCookies();
}

/**
 * true si el request opera sobre el workspace dueño (Mauricio). En Fase 1 las
 * integraciones (Meta/Calendly/etc.) son globales del dueño: las vistas EN VIVO
 * (WhatsApp, insights de Meta) solo se sirven al dueño para no filtrarle sus
 * datos a un cliente nuevo. Las integraciones por-cliente son Fase 2.
 */
export async function esWorkspaceDueno(): Promise<boolean> {
  return (await getWorkspaceActual()) === OWNER_WS;
}

/**
 * Guard para acciones de la AGENCIA sobre su propia cuenta: mover plata en Meta,
 * leer el gasto de IA, conectar la agenda del dueño.
 *
 * Por qué NO alcanza esWorkspaceDueno() a secas: solo dice "el workspace actual
 * es el principal", y NO mira el rol. El workspace principal tiene closers y
 * setters adentro (ws1 tiene 3 cuentas), así que cualquiera de ellos pasaba ese
 * gate y llegaba a publicar, pausar, renombrar, cambiar presupuesto y BORRAR
 * campañas con plata puesta. No es cross-tenant: es plata real.
 *
 * Pasan dos: el admin de la agencia (aunque no impersone) y el admin del
 * workspace principal. Un closer/setter, no.
 *
 * Vive acá y no copiado en cada ruta a propósito: el bug fue justamente que el
 * chequeo del rol estaba en UN solo lugar (/api/anthropic-usage) y las otras 14
 * puertas se olvidaron de repetirlo.
 */
export async function esDuenoAdmin(): Promise<boolean> {
  if (await getSesionAdmin()) return true;
  return (await esWorkspaceDueno()) && (await getRolWsEfectivo()) === 'admin';
}

/**
 * Guard para lo que CADA CLIENTE hace sobre SU PROPIO workspace: conectar su
 * agenda de Google. Devuelve el workspace objetivo, o null si esta sesión no
 * administra ninguno.
 *
 * NO es esDuenoAdmin(), y la diferencia no es cosmética: ese pregunta "¿sos la
 * agencia?" y existe para mover PLATA en la cuenta de Meta de la agencia. Este
 * pregunta "¿administrás ESTE workspace?". Conectar la agenda propia es lo
 * segundo, y haberlo gateado con el primero es lo que le devolvía un 403 a todo
 * cliente que apretaba "Conectar Google Calendar" (ws13, Código Inmobiliario).
 *
 * El ws SIEMPRE sale del request (getWorkspaceActual): jamás del body ni del
 * query, que sería un IDOR. Fail-closed cuando no resuelve — caer a OWNER_WS
 * ahí escribiría adentro del workspace de Mauricio, que es un CLIENTE y no la
 * plataforma. Mismo criterio (y mismas dos primeras preguntas) que
 * resolverContexto() en app/api/integraciones/credencial/route.ts.
 */
export async function adminDeWorkspaceActual(): Promise<number | null> {
  if (!(await getUsuarioActual())) return null;
  const esSuperAdmin = (await getSesionAdmin()) != null;
  const esAdminWs = (await getRolWsEfectivo()) === 'admin';
  if (!esSuperAdmin && !esAdminWs) return null;
  return await getWorkspaceActual();
}

/** true si un admin está metido adentro de un cliente, en ESTA pestaña.
 *  Sirve para distinguir "admin viendo su propio panel" de "admin metido en un
 *  cliente": p.ej. el board /plan muestra el PlanBoard del dueño solo si NO impersona,
 *  y el tablero del cliente (incl. Mauricio/ws1) cuando sí.
 *
 *  ⚠️ Tiene que mirar lo MISMO que `getWorkspaceActual`, y en el mismo orden. Si
 *  uno mirara la pestaña y el otro solo la cookie, la app quedaría mostrando los
 *  datos de un cliente con el chrome del panel de admin (o al revés), que es la
 *  clase de incoherencia que nadie reporta como bug: se lee como "se ve raro". */
export async function estaImpersonando(): Promise<boolean> {
  const sesion = await getUsuarioActual();
  // ⚠️ LA AGENCIA TAMBIÉN ESTÁ «VIENDO A OTRO», y olvidarlo acá no se ve como un
  // bug de esta función: se ve como que la app no tiene salida. De este booleano
  // cuelga `/api/auth/me` → `ImpersonationBanner`, y el banner es lo ÚNICO que
  // se dibuja en todas las pantallas. Con `false`, la agencia entra al cliente
  // sin cartel que diga de quién son los datos y sin botón para volver.
  // Mismo orden que `resolverDesdeCookies`: la rama de admin primero, la de
  // agencia después.
  if (sesion?.rol !== 'admin') return (await contextoDeAgencia()) != null;
  if (await wsDePestana()) return true;
  const store = await cookies();
  return leerImpersonacion(store.get(IMPERSONATE_COOKIE)?.value) != null;
}

/**
 * Rol EFECTIVO dentro del workspace que ve el request, para gatear tabs:
 *   · admin de agencia (impersonando o no) → 'admin' (acceso total a las tabs;
 *     el aislamiento de DATOS lo hace getWorkspaceActual, no este rol)
 *   · owner / legacy / dev                 → 'admin'
 *   · usuario cliente                      → su rol_ws (null → 'admin' por backfill)
 *   · sin sesión                           → null
 * OJO: es distinto del rol GLOBAL. Un admin-cliente devuelve 'admin' pero jamás
 * ve el shell /admin de la agencia (eso lo decide el rol GLOBAL en el Sidebar).
 */
export async function getRolWsEfectivo(): Promise<RolWorkspace | null> {
  const sesion = await getUsuarioActual();
  if (!sesion) return null;
  if (sesion.legacy) return 'admin';
  if (sesion.rol === 'admin') return 'admin';
  return sesion.rolWs ?? 'admin';
}

/**
 * Cliente Supabase con scoping automático por workspace. Drop-in de
 * getSupabaseServer() para las libs de datos por-cliente.
 */
export async function getTenantDb(): Promise<SupabaseClient> {
  const ws = await getWorkspaceActual();
  return scopedClient(getSupabaseServer(), ws);
}

function scopedClient(real: SupabaseClient, ws: number | null): SupabaseClient {
  return new Proxy(real, {
    get(target, prop, receiver) {
      if (prop === 'from') {
        return (table: string) => scopedFrom(target.from(table), table, ws);
      }
      const v = Reflect.get(target, prop, receiver);
      return typeof v === 'function' ? v.bind(target) : v;
    },
  }) as SupabaseClient;
}

// Estampa/filtra por workspace en el query builder de una tabla tenant.
// ws null (admin sin impersonar) → id imposible: lecturas vacías, escrituras
// fallan por FK (fail-closed). Tablas no-tenant → passthrough sin tocar.
type Chain = { eq: (c: string, v: unknown) => Chain };
type QB = ReturnType<SupabaseClient['from']>;
function scopedFrom(builder: QB, table: string, ws: number | null): QB {
  if (!TENANT_TABLES.has(table)) return builder;
  const wsId = ws ?? -1;
  const b = builder as unknown as {
    select: (...a: unknown[]) => Chain;
    insert: (rows: unknown, opts?: unknown) => unknown;
    upsert: (rows: unknown, opts?: unknown) => unknown;
    update: (vals: unknown, opts?: unknown) => Chain;
    delete: (opts?: unknown) => Chain;
  };
  const stamp = (rows: unknown): unknown =>
    Array.isArray(rows)
      ? rows.map((r) => ({ ...(r as object), workspace_id: wsId }))
      : { ...(rows as object), workspace_id: wsId };

  const origSelect = b.select.bind(b);
  b.select = (...a: unknown[]) => origSelect(...a).eq('workspace_id', wsId);
  const origUpdate = b.update.bind(b);
  b.update = (vals: unknown, opts?: unknown) => origUpdate(vals, opts).eq('workspace_id', wsId);
  const origDelete = b.delete.bind(b);
  b.delete = (opts?: unknown) => origDelete(opts).eq('workspace_id', wsId);
  const origInsert = b.insert.bind(b);
  b.insert = (rows: unknown, opts?: unknown) => origInsert(stamp(rows), opts);
  const origUpsert = b.upsert.bind(b);
  b.upsert = (rows: unknown, opts?: unknown) => origUpsert(stamp(rows), opts);
  return builder;
}

// ── CRUD de workspaces (para el panel de admin, cliente crudo cross-workspace) ─

export type Workspace = {
  id: number;
  nombre: string;
  slug: string | null;
  estado: 'activo' | 'pausado';
  /** Qué capa de la oferta compró (mig 0092). El catálogo vive en lib/capas.ts. */
  capa: CapaId;
  created_at: string;
  /**
   * Su CARA (mig 0179): la portada, su encuadre, la marca y el encuadre de la marca.
   *
   * ⚠️ MISMO FORMATO QUE `leads` Y `plan_proyectos` a propósito: las tres las pinta
   * `fondoPortada` (lib/portadas.ts) y las tres las dibuja `Marca`. Un cuarto formato
   * sería un cuarto parser.
   *
   * ⚠️ Y `icono` NULL NO ES «SIN MARCA»: es «usar la cara de su admin» (su foto de
   * Google, o el Gravatar de su email — ver `caraDeUsuario`), y sin eso las iniciales.
   * Es la misma cadena de respaldos que la tarjeta ya dibuja; lo que esta columna
   * agrega es la única de las tres que alguien eligió A PROPÓSITO para este cliente.
   */
  portada: string | null;
  portada_y: number | null;
  icono: string | null;
  avatar_y: number | null;
};

// ⚠️ LAS CUATRO DE LA CARA VAN EN EL SELECT, y no es prolijidad: una columna que la
// lectura no trae llega a la pantalla como `undefined`, y el próximo guardado de
// cualquier otro campo la manda como null y la BORRA. Es el modo de falla que
// AGENTS.md tiene documentado para el tablero, y es destructivo, no inerte.
const WS_COLS = 'id, nombre, slug, estado, capa, created_at, portada, portada_y, icono, avatar_y';

export async function listarWorkspaces(): Promise<Workspace[]> {
  const { data, error } = await getSupabaseServer()
    .from('workspaces').select(WS_COLS).order('id', { ascending: true });
  if (error) throw new Error(`workspaces: ${error.message}`);
  return (data ?? []) as Workspace[];
}

/**
 * El workspace del SUPER-ADMIN, resuelto por su capa y no por un número.
 *
 * OJO CON `OWNER_WS`: vale 1 y ese es **Mauricio, un cliente** — el nombre engaña y ya
 * se llevó puestas varias cosas. El tablero de desarrollo, las credenciales de la
 * plataforma y el catálogo de proyectos del producto viven en el workspace con
 * `capa: 'superadmin'`, que hoy es el 9.
 *
 * Se resuelve por capa a propósito: si mañana ese id cambia, esto sigue andando, y el
 * que lo lee entiende POR QUÉ es ese y no otro.
 */
let cacheSuper: number | null = null;
export async function wsSuperAdmin(): Promise<number> {
  if (cacheSuper != null) return cacheSuper;
  const { data } = await getSupabaseServer()
    .from('workspaces').select('id').eq('capa', 'superadmin').order('id').limit(1).maybeSingle();
  // Sin fila con esa capa el fallback es 9, que es el que existe hoy: es preferible
  // eso a devolver OWNER_WS y terminar leyendo las credenciales de un cliente.
  cacheSuper = Number((data as { id?: unknown } | null)?.id ?? 9);
  return cacheSuper;
}

export async function getWorkspace(id: number): Promise<Workspace | null> {
  const { data, error } = await getSupabaseServer()
    .from('workspaces').select(WS_COLS).eq('id', id).maybeSingle();
  if (error) throw new Error(`workspaces: ${error.message}`);
  return (data as Workspace | null) ?? null;
}

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'cliente';

/**
 * El slug, garantizando que no choque con uno que ya exista.
 *
 * ⚠️ `workspaces.slug` es UNIQUE (mig 0054:32) y `slugify` no desambigua nada.
 * Con los clientes dándose de alta de a uno y por una sola persona casi no se
 * notaba; desde que una AGENCIA da de alta a SUS clientes deja de ser raro —
 * «Inmobiliaria Sur» existe en más de una cartera— y el segundo alta moría con
 * un mensaje crudo de Postgres («duplicate key value violates unique
 * constraint») arriba de un workspace a medio crear. El compilador no ve nada y
 * el error no nombra el problema real, que es el NOMBRE repetido.
 *
 * Consulta los que empiezan igual y agrega el primer sufijo libre. La carrera
 * entre dos altas simultáneas sigue existiendo y la ataja el UNIQUE: por eso
 * `crearWorkspace` traduce igual el error de duplicado.
 */
async function slugLibre(nombre: string): Promise<string> {
  const base = slugify(nombre);
  try {
    const { data } = await getSupabaseServer()
      .from('workspaces').select('slug').like('slug', `${base}%`);
    const tomados = new Set(((data ?? []) as { slug: string | null }[]).map((r) => r.slug).filter(Boolean));
    if (!tomados.has(base)) return base;
    for (let i = 2; i <= 99; i++) {
      const cand = `${base.slice(0, 37)}-${i}`;
      if (!tomados.has(cand)) return cand;
    }
    // Cien homónimos es otra clase de problema; que lo diga el UNIQUE.
    return base;
  } catch {
    // Si no se puede consultar, se intenta con el base: el UNIQUE decide.
    return base;
  }
}

export async function crearWorkspace(nombre: string, capa: CapaId = CAPA_DEFAULT): Promise<Workspace> {
  // Fail-closed: una capa inventada haría que el gating la trate como 'completo'
  // (capaDef cae al default) y el cliente vería tabs que no compró.
  if (!esCapaValida(capa)) throw new Error(`capa inválida: ${capa}`);
  const { data, error } = await getSupabaseServer()
    .from('workspaces')
    .insert({ nombre: nombre.trim(), slug: await slugLibre(nombre), estado: 'activo', capa })
    .select(WS_COLS).single();
  // Un choque de slug llega acá sólo si dos altas corrieron a la vez (el `slugLibre`
  // de arriba cubre el caso normal). Se traduce, porque «duplicate key value violates
  // unique constraint workspaces_slug_key» no le dice a nadie que el problema es el
  // nombre repetido.
  if (error?.code === '23505') throw new Error(`Ya hay un cliente llamado «${nombre.trim()}». Usa otro nombre.`);
  if (error) throw new Error(`workspaces: ${error.message}`);
  const ws = data as Workspace;
  // Un workspace SIEMPRE tiene exactamente un funnel default (mig 0170). La
  // migración se lo dio a los que ya existían; a los nuevos hay que dárselo acá,
  // porque ya no hay upsert que lo cree solo en la primera escritura como hacía
  // `funnel_config`. Nace SIN declarar (`declarado:false`): tiene fila, pero no
  // afirma ningún embudo hasta que el cliente lo edite.
  // El catch no es fatal a propósito: sin la migración aplicada, crear un cliente
  // tiene que seguir funcionando — y saveFunnelDefault() recrea el funnel si falta.
  const { error: eFunnel } = await getSupabaseServer()
    .from('funnels')
    .insert({ workspace_id: ws.id, nombre: 'Funnel principal', data: {}, declarado: false, es_default: true });
  if (eFunnel) console.error(`[workspaces] el cliente ${ws.id} quedó sin funnel default: ${eFunnel.message}`);
  return ws;
}

/**
 * Capa del workspace ACTUAL — de acá salen las tabs visibles, los pasos del
 * onboarding y los seeds. Sin workspace (agencia sin impersonar, cron) → la capa
 * completa: el dueño ve todo. `cache` = una sola query por request.
 */
export const getCapaActual = cache(async (): Promise<CapaId> => {
  const ws = await getWorkspaceActual();
  if (ws == null) return CAPA_DEFAULT;
  const { data } = await getSupabaseServer()
    .from('workspaces').select('capa').eq('id', ws).maybeSingle();
  return capaDef((data as { capa?: string } | null)?.capa).id;
});

export async function actualizarWorkspace(
  id: number,
  patch: Partial<Pick<Workspace, 'nombre' | 'estado' | 'capa' | 'portada' | 'portada_y' | 'icono' | 'avatar_y'>>,
): Promise<Workspace> {
  if (patch.capa != null && !esCapaValida(patch.capa)) throw new Error(`capa inválida: ${patch.capa}`);
  const { data, error } = await getSupabaseServer()
    .from('workspaces')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id).select(WS_COLS).single();
  if (error) throw new Error(`workspaces: ${error.message}`);
  return data as Workspace;
}
