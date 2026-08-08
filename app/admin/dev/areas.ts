// =============================================================================
// Los registros de construcción, uno por área del producto
// =============================================================================
// La idea es la misma que ya funciona en «MaKo UX/UI»: mientras se trabaja una
// tab queda escrito qué se decidió, qué se rompió y qué falta. Después, cambiar
// o debuguear esa tab no arranca de cero.
//
// Nacen VACÍOS a propósito. Un registro se llena trabajando, no de una sentada,
// y uno inventado de antemano es peor que ninguno: se lee como verdad y no lo es.
//
// Para llenar uno: se le agrega su propia página, con el molde de app/admin/ui
// (catálogo de piezas + Change History con su bitácora). Cuando eso pase, esta
// entrada deja de estar acá y pasa a tener carpeta propia.

export type AreaDev = {
  slug: string;
  titulo: string;
  /** Qué parte del producto cubre, para que el registro no se solape con otro. */
  alcance: string;
  /** La ruta del producto, para saltar de la bitácora a la pantalla real. */
  verEnApp: string;
  /** Dónde vive el código de esa área: es lo primero que se pregunta. */
  vive: string[];
  /** El documento de hallazgos que ya cubre parte de esto, si existe. */
  hallazgos?: string;
};

export const AREAS: AreaDev[] = [
  {
    // El shell de la agencia. Tiene registro propio porque nada de esto es
    // rediseño: la barra sí, pero la impersonación, el aislamiento por pestaña y
    // los controles destructivos son funcionalidad, y metidos en el registro del
    // rediseño lo dejaban contando cosas que no le tocan.
    slug: 'admin',
    verEnApp: '/admin',
    titulo: 'Admin',
    alcance: 'El shell del super admin: su barra, la gestión de clientes, cómo se entra a la cuenta de uno y qué se puede hacer adentro.',
    vive: ['app/admin/', 'app/_components/nav.ts', 'app/_components/Sidebar.tsx', 'lib/workspace.ts', 'lib/ws-tab.ts', 'proxy.ts'],
    hallazgos: 'hallazgos-seguridad',
  },
  {
    slug: 'onboarding',
    verEnApp: '/onboarding',
    titulo: 'Onboarding',
    alcance: 'El wizard de alta del cliente y el hub de 10 tabs: fase, El Archivero, productos, avatares, razones, persona, ángulos.',
    vive: ['app/onboarding/', 'lib/onboarding-state.ts', 'lib/tab-onboarding-state.ts', 'lib/archivero.ts'],
    hallazgos: 'hallazgos-crm',
  },
  {
    slug: 'general',
    verEnApp: '/general',
    titulo: 'General',
    alcance: 'La casa del cliente: el semáforo de salud, el reporte del día y lo que MaKo propone al entrar.',
    vive: ['app/general/', 'lib/reportes.ts', 'lib/meta-health.ts'],
    hallazgos: 'hallazgos-ia',
  },
  {
    slug: 'chatbot',
    verEnApp: '/chatbot',
    titulo: 'Chatbot',
    alcance: 'El Chat Agent: jugadas, secuencias de nutrición, el ensayo y el hand-off al humano.',
    vive: ['app/chat-agent/', 'lib/nutricion.ts', 'lib/setting-estrategia.ts', 'lib/evolution-envio.ts'],
    hallazgos: 'hallazgos-comunicacion',
  },
  {
    // Se llama como la FEATURE. Antes el área decía «Ads Generator» y la
    // biblioteca de ángulos vivía aparte, en /admin/guiones, bajo el rótulo
    // «Guiones»: tres nombres para una sola cosa, y ninguno el de la ruta.
    slug: 'ads-writer',
    verEnApp: '/ads-writer',
    titulo: 'Ads Writer',
    alcance: 'La fábrica de creativos y de guiones: la Matriz avatar × razón, más las dos bibliotecas globales que ve todo cliente al generar — los ángulos y las estructuras.',
    vive: ['app/ads-writer/', 'app/admin/guiones/GuionesAdminView.tsx', 'app/onboarding/MatrizView.tsx', 'lib/guion-angulos.ts', 'lib/razones.ts'],
    hallazgos: 'hallazgos-ads',
  },
  {
    // No es una tab del producto: es un CONCEPTO que lo cruza entero (la salud
    // de Meta, los avisos de MaKo, el estado de una campaña). Tiene registro
    // propio porque su historia —eran dos tipos incompatibles— no pertenece a
    // ninguna pantalla en particular y se perdía en el documento de otra.
    slug: 'semaforo',
    verEnApp: '/marketing/salud',
    titulo: 'El semáforo',
    alcance: 'El verde/ámbar/rojo/gris que atraviesa el producto: la salud de la cuenta de Meta, los avisos de MaKo y el estado de cada campaña, conjunto y anuncio.',
    vive: ['lib/mako-gramatica.ts', 'lib/meta-health-ui.ts', 'lib/meta-health.ts', 'lib/avisos-catalogo.ts', 'app/marketing/salud/SaludBoard.tsx'],
    hallazgos: 'hallazgos-ui',
  },
];

export const areaDe = (slug: string) => AREAS.find((a) => a.slug === slug) ?? null;
