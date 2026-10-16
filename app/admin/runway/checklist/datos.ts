// =============================================================================
// /admin/runway/checklist — lo que se hizo el 15 y 16/10/2026 y lo que queda (datos)
// =============================================================================
// Pedido de Martín (16/10/2026): «Preparamelo tipo checklist en "runway" con todo lo que se hizo y lo que aún queda
// pendiente». Cada ítem tiene un id FIJO: lo marcado se guarda por id (app_settings, ver acciones.ts), así que un id
// no se reusa ni se renombra. El texto se puede corregir sin perder la marca.
//
// La fuente es el resumen que se le mandó (que-revisar-16-10.md, fuera del repo) y el relevo del Cerebro
// (docs/relevo/cerebro.md → «CIERRE»). Lo pendiente lleva el chat que lo tiene y su relevo.

export type ItemChecklist = { id: string; t: string; ruta?: string };
export type SeccionChecklist = { titulo: string; items: ItemChecklist[] };

/** La clave del setting donde se guarda la lista de ids marcados (por workspace: el de quien mira). */
export const CLAVE_CHECKLIST = 'runway.checklist.1610';

export const HECHO: SeccionChecklist[] = [
  { titulo: 'Onboarding nuevo', items: [
    { id: 'onb-chat', t: 'Es una conversación con MaKo: el muñeco vuela a la foto del chat (míralo en el ws3, con el onboarding sin terminar).' },
    { id: 'onb-pasos', t: 'Nombre → negocio → objetivo a 90 días → oferta → el CRM que propone → teléfono o «Ahora no».' },
    { id: 'onb-recarga', t: 'Recargar a mitad vuelve a la misma conversación; la oferta se arma aunque cierres la pestaña.' },
    { id: 'onb-aviso', t: 'Aviso «oferta lista» por WhatsApp (automatización #260).' },
    { id: 'onb-historico', t: 'Conectar Meta, Fathom, YouTube o Panda carga solo su histórico.' },
  ] },
  { titulo: 'Second Brain', items: [
    { id: 'sb-barra', t: '«Pregúntale a MaKo» ahora es «Second Brain»; /mako lleva ahí y los chats viejos quedan en «Antes».', ruta: '/second-brain' },
    { id: 'sb-chat', t: 'Chat con la cara del Centro: «Nuevo chat», sub-chats, micrófono y la tarjeta que se confirma.' },
    { id: 'sb-mapa', t: '«Mapa» arriba, sólo para el admin; closer y setter ven sólo sus chats.' },
    { id: 'sb-adjuntos', t: 'Adjuntar fotos y PDF (+, pegar o arrastrar): vuelven al recargar.' },
    { id: 'sb-movil', t: 'En el celular, /m/second-brain es el chat y el Mapa tiene su pantalla.' },
  ] },
  { titulo: 'Centro de Operaciones', items: [
    { id: 'co-pregunta', t: 'Cada chat pregunta con opciones como Claude Code; la Ticketera vive adentro.', ruta: '/admin/operaciones' },
    { id: 'co-uso', t: 'El Uso de las tres cuentas a la vista, junto a sus Runners.' },
    { id: 'co-jefes', t: 'Chats por jefe, el Cerebro aparte y «Sin asignar»; Plan y Review dentro de cada jefe; micrófono.' },
  ] },
  { titulo: 'Plan', items: [
    { id: 'plan-kanban', t: 'Kanban por estado: Por iniciar · En proceso · Atorada · Completada.', ruta: '/plan' },
    { id: 'plan-arrastre', t: 'Arrastrar mueve sin preguntar la prioridad; «Atorada» pide un motivo.' },
    { id: 'plan-filtro', t: 'La prioridad es un filtro y un chip (con «Sin priorizar»); filtro «Responsable» en clientes.' },
    { id: 'plan-fathom', t: 'Fathom: «Cargar» sin esperar a la IA, leer de fondo y «Sin leer» con «Reintentar».' },
    { id: 'plan-repriorizar', t: 'Tres puntos → «Re-priorizar todo», de fondo y sin tocar lo que fijaste a mano.' },
    { id: 'plan-movil', t: 'En el celular: «Mover a…» o arrastrar, con Deshacer.' },
  ] },
  { titulo: 'CRM', items: [
    { id: 'crm-bloques', t: 'Ficha del lead por bloques con «Personalizar» y vista Escritorio · Tablet · Celular.', ruta: '/crm' },
    { id: 'crm-galeria', t: 'Galería por tab con «Sugerido», «¿Qué vas a crear hoy?», renombrar con doble clic.' },
    { id: 'crm-resumen', t: 'Resumen nuevo: 19 bloques editables con Deshacer y 10 plantillas (cambia el diseño de todos).' },
    { id: 'crm-pagos', t: 'Tab Pagos rehecha: estado de cuenta, cuotas con botones, Movimientos y 4 plantillas.' },
    { id: 'crm-calendly', t: 'Un evento de Calendly o Cal.com se vincula a una etapa de reunión (por la API de MaKo).' },
    { id: 'crm-asignar-campanas', t: '«⋯» de «Lead entrante»: «Asignar campañas» con el logo de Meta.' },
    { id: 'crm-a-revisar-1610', t: '«A revisar»: número junto al nombre, basurero rojo, «Ignorar todos»; «Revisar» abre el «Ver».' },
    { id: 'crm-cabecera-1610', t: 'Cabecera del lead sin «Sin empresa», con la foto grande y el nombre pegado, como en Clientes.' },
    { id: 'crm-renombrar-1610', t: 'Renombrar un CRM cambia el desplegable al instante y el editor ya no muestra el nombre viejo.' },
    { id: 'crm-sin-pendientes', t: 'Ya no existe la vista de pendientes del CRM: todo se resuelve en «A revisar».' },
    { id: 'crm-templates-1610', t: 'Ficha en edición: «Templates» en la barra; la galería sin «Ahora no» ni «Vista previa».' },
    { id: 'sb-claro', t: 'Second Brain en modo claro.', ruta: '/second-brain' },
    { id: 'crm-ver-datos-1610', t: 'El «Ver» de datos sin marcar de la ficha: ícono del bloque, basurero rojo y flecha azul.' },
    { id: 'crm-mako-izq', t: 'El botón y el panel de MaKo del CRM, a la izquierda.', ruta: '/crm' },
    { id: 'crm-editar-azul', t: 'En la ficha, «Personalizar» ahora es «Editar», en azul como en el Dashboard.' },
    { id: 'crm-ficha-rapida', t: 'La ficha del lead abre más rápido (cinco lecturas en paralelo); falta medirla.' },
    { id: 'crm-ai-analyst', t: 'En la ficha, «⋯» con «AI Analyst» (panel a la izquierda) y «Copiar el link»; ya no hay tab MaKo Analyst.' },
    { id: 'crm-estilo-hoja', t: 'Ficha en edición: «Estilo de la hoja» arriba (épica, tarjetas, tema); la barra lateral, más corta.' },
    { id: 'crm-galeria-sola', t: 'La galería ya no se abre sola: cada tab usa su sugerida; tocar un template lo elige.' },
    { id: 'crm-asignar-evento', t: '«Asignar evento» en el «⋯» de las etapas de reunión (Calendly y Cal.com).', ruta: '/crm' },
  ] },
  { titulo: 'Automations', items: [
    { id: 'aut-flechas', t: 'Toda flecha se desconecta; el paso con IA escucha notas de voz.', ruta: '/automations' },
    { id: 'aut-probar', t: '«Probar»: orden de los «antes de», encabezado del caso, «Contesta: …», el grupo de MaKo primero.' },
    { id: 'aut-apagado', t: '«Probar» apagado con el porqué; Instagram y el adjunto ya no fallan al crear con IA.' },
    { id: 'aut-avisos', t: 'Tus avisos de la plataforma como automatizaciones: WhatsApp, oferta lista, cuenta publicitaria, contraseña.' },
    { id: 'aut-anuncios', t: 'El aviso de anuncios del grupo de Mauricio ya no se repite (techo de 3).' },
  ] },
  { titulo: 'Dashboard, General y Offer', items: [
    { id: 'dash-sugerido', t: 'Plantillas «Sugerido» al crear una hoja.', ruta: '/dashboard' },
    { id: 'dash-editar', t: '«Editar con MaKo»: pides un cambio y la hoja cambia; Deshacer; entiende pedidos sueltos.' },
    { id: 'offer-chat', t: 'Offer: el chat no desaparece, la oferta abre encima, PDF en dos partes.', ruta: '/offer' },
    { id: 'offer-nivel', t: 'Una oferta de entrada se mejora en su nivel; marcar varias ofertas; sin cifras inventadas.' },
  ] },
  { titulo: 'Editores y Web Generator', items: [
    { id: 'web-pedidos', t: 'Web Generator: el chat entiende pedidos sueltos y pregunta «¿Para cuál producto?».', ruta: '/web-generator' },
    { id: 've-chat', t: 'Video Editor: el chat guarda la conversación y entiende pedidos sueltos.', ruta: '/video-editor' },
    { id: 've-api', t: 'MaKo (también por WhatsApp) propone cambios en un video que se aceptan en el editor.' },
    { id: 'ie-chat', t: 'Image Editor: chat «MaKo IA» (botón redondo del riel) con «Aceptar» y «Restaurar».', ruta: '/image-editor' },
    { id: 'editores-sugerido', t: 'Plantillas «Sugerido» en Video Editor e Image Editor.' },
  ] },
  { titulo: 'Celular, seguridad e IA', items: [
    { id: 'movil-more', t: 'More completo en el celular: Calendario, Avisos, Second Brain, Offer, Ads Writer, Curso…' },
    { id: 'seg-closer', t: 'Un closer o setter no ve los montos del trimestre ni chats ajenos.' },
    { id: 'seg-pii', t: 'Los datos de los leads ya no van a una IA gratis que entrena.' },
    { id: 'ia-credito', t: 'El crédito de Claude se usa sólo en el onboarding; Leandro tiene su propio Claude.' },
  ] },
];

export const PENDIENTE: SeccionChecklist[] = [
  { titulo: 'Te toca a ti', items: [
    { id: 'p-borrar-claves', t: 'Decirle «sí» al chat Onboarding para borrar de la cuenta de Mauricio las dos copias de claves.' },
    { id: 'p-mirar-resumen', t: 'Mirar el Resumen nuevo del CRM y la tab Pagos en el ws3, en escritorio y celular.' },
    { id: 'p-video-t5', t: 'Video Editor tanda 5: pospuesta (cuando quieras, con Chrome sin minimizar).' },
  ] },
  { titulo: 'Para la próxima cuenta (cada uno con su relevo)', items: [
    { id: 'p-ie-api', t: 'Image Editor: sus operaciones en la API de MaKo y «entender el pedido» (relevo de Video Editor).' },
    { id: 'p-sb-pantallas', t: 'Second Brain: las pantallas que faltan y los chats como nodos del grafo (relevo de Centro).' },
    { id: 'p-crm-t2', t: 'CRM: Reuniones y Tracking rehechos, tarjeta del kanban y Customer Success (relevo de CRM).' },
    { id: 'p-aut-pedidos', t: 'Automations: «entender el pedido» en su chat (regresiones anotadas) y la campanita.' },
    { id: 'p-aut-sin-grupo', t: 'Automations: avisar cuando un negocio no tiene grupo de MaKo.' },
    { id: 'p-doer-pii', t: 'Onboarding: cortar la IA gratis del chat de WhatsApp cuando lee datos de leads.' },
    { id: 'p-web-producto', t: 'Web Generator: preguntar el producto con texto libre cuando no está cargado.' },
    { id: 'p-pagos-cs', t: 'Pagos: dos ajustes chicos y Customer Success en bloques, junto con CRM.' },
  ] },
  // Feedback del 16/10 a la tarde: textual y con su archivo en docs/feedback-16-10-crm-onboarding-second-brain.md.
  { titulo: 'Tu feedback del 16/10 a la tarde', items: [
    { id: 'p16-crm-calendar', t: 'CRM: «Asignar evento» también con Google Calendar.' },
    { id: 'p16-crm-velocidad', t: 'CRM: que la ficha del lead abra rápido.' },
    { id: 'p16-crm-hojas', t: 'CRM: tabs como las hojas del Dashboard, templates con miniaturas propias, sin la barra lateral.' },
    { id: 'p16-crm-obligatorio', t: 'CRM: «Obligatorio» en cada bloque decide los datos sin marcar; el «Ver» igual que «A revisar».' },
    { id: 'p16-crm-chat2', t: 'CRM: el chat de MaKo con la cara del Second Brain y el muñeco de la tab.' },
    { id: 'p16-crm-editar2', t: 'CRM: en el «⋯» de la ficha, exportar y el tutorial; al editar, el chat para editar la vista.' },
    { id: 'p16-onb-pdf', t: 'Onboarding: sin el análisis de Offer; sólo ordenar en un PDF lo que vendes.' },
    { id: 'p16-sb-skills', t: 'Second Brain: «Skills» como skills.sh, se instalan solas y crean un chat para todos.' },
  ] },
];
