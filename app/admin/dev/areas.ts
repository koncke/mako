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
    slug: 'ads-generator',
    verEnApp: '/ads-writer',
    titulo: 'Ads Generator',
    alcance: 'La fábrica de creativos y de guiones: la Matriz avatar × razón, los ángulos y las estructuras.',
    vive: ['app/ads-writer/', 'app/onboarding/MatrizView.tsx', 'lib/guion-angulos.ts', 'lib/razones.ts'],
    hallazgos: 'hallazgos-ads',
  },
];

export const areaDe = (slug: string) => AREAS.find((a) => a.slug === slug) ?? null;
