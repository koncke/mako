// =============================================================================
// preview-links — la tarjeta que se ve al pegar un link de MaKo en WhatsApp
// =============================================================================
// EL CASO (2026-08-25). El dueño mirando el grupo de un cliente: «revisá los
// mensajes con link y preview que envía MaKo… deberíamos hacer diferentes preview
// para cada cosa, porque son todos iguales y confunde».
//
// Medido contra producción con el user-agent de WhatsApp, cuatro links distintos
// —un borrador del plan, el resumen de un lead, una integración y el plan— y los
// cuatro devuelven EXACTAMENTE lo mismo:
//
//     og:title       MaKo
//     og:description Marketing, CRM y ventas en una sola app.
//     og:image       /og-mako.jpg
//
// ── POR QUÉ, Y POR QUÉ SE ARREGLA ACÁ ───────────────────────────────────────
//
// El crawler de WhatsApp no tiene sesión, así que `proxy.ts` lo corta ANTES de
// que la página exista: 307 a `/login?next=%2Fplan%2Frevisar%2F…`. O sea que la
// tarjeta que se ve nunca fue la de la pantalla — es el metadata RAÍZ del login.
//
// Y por eso el arreglo no necesita abrirle ninguna ruta a nadie: el destino viaja
// en el `next=` del redirect, que es público y ya está en el link que el cliente
// recibió. `/login` deriva la tarjeta de ESE path.
//
// ⚠️ LA TARJETA SALE DE LA RUTA, NUNCA DEL DATO. «Borrador de tareas», no «3
// tareas para el proyecto X»; «Resumen del lead», no el nombre del lead. Quien
// resuelve el OpenGraph es un servidor de WhatsApp, sin sesión y sin permiso: una
// preview que leyera la base convertiría un link en una filtración. Lo que se
// muestra es de qué TIPO de cosa se trata, que es exactamente lo que el dueño
// pidió y lo único que hace falta para no confundirse.
// =============================================================================

export type PreviewLink = {
  /** Clave corta del tipo. La usa la imagen dinámica. */
  tipo: string;
  titulo: string;
  descripcion: string;
  /** Un emoji que hace de ancla visual en la tarjeta. */
  icono: string;
};

export const PREVIEW_DEFAULT: PreviewLink = {
  tipo: 'mako',
  titulo: 'MaKo',
  descripcion: 'Marketing, CRM y ventas en una sola app.',
  icono: '✦',
};

/** Las llamadas de venta: la ruta vieja (/closing) y la hoja del Dashboard que la reemplazó. */
const CLOSING: PreviewLink = { tipo: 'closing', titulo: 'Análisis de llamadas', descripcion: 'Qué pasó en tus llamadas de venta y dónde se cae el cierre.', icono: '🎧' };

/**
 * De ruta a tarjeta. El orden IMPORTA: lo más específico primero.
 *
 * `/crm/2311/resumen` y `/crm/2311` son pantallas distintas y la primera tiene que
 * ganar; si la genérica de `/crm` estuviera arriba se comería a todas.
 *
 * `hoja`: la regla vale sólo con ese `?hoja=`. Desde el 11/10/2026 Closing Analyst es la hoja
 * «Closing» del Dashboard (`/dashboard?hoja=closing&llamada=<id>`, el link que manda MaKo), y sin
 * esto su tarjeta decía «Tus anuncios». El `?hoja=` es parte de la RUTA, no un dato: el id de la
 * llamada no sale en la tarjeta.
 */
const RUTAS: Array<{ re: RegExp; hoja?: string; p: PreviewLink }> = [
  {
    re: /^\/plan\/revisar\//,
    p: {
      tipo: 'borrador',
      titulo: 'Borrador de tareas',
      descripcion: 'MaKo anotó lo que le pasaste. Revísalo y confirma qué entra a tu plan.',
      icono: '📝',
    },
  },
  {
    re: /^\/crm\/revisar/,
    p: {
      tipo: 'lead-propuesto',
      titulo: 'Lead para confirmar',
      descripcion: 'Todavía no está en el CRM. Revisa los datos y confirma para que entre.',
      icono: '👤',
    },
  },
  {
    re: /^\/crm\/[^/]+\/resumen/,
    p: {
      tipo: 'resumen-lead',
      titulo: 'Resumen del lead',
      descripcion: 'Todo lo que sabemos de esta persona, para leer antes de la reunión.',
      icono: '🗂️',
    },
  },
  { re: /^\/crm/, p: { tipo: 'crm', titulo: 'Tu CRM', descripcion: 'Tus leads, su etapa y qué sigue con cada uno.', icono: '👥' } },
  { re: /^\/plan/, p: { tipo: 'plan', titulo: 'Tu plan', descripcion: 'En qué estás trabajando y qué sigue, priorizado.', icono: '📋' } },
  { re: /^\/integraciones/, p: { tipo: 'integraciones', titulo: 'Tus integraciones', descripcion: 'Conecta tus herramientas y mira el estado de cada una.', icono: '🔌' } },
  { re: /^\/dashboard\/?$/, hoja: 'closing', p: CLOSING },
  { re: /^\/(marketing|dashboard|ads-manager)/, p: { tipo: 'ads', titulo: 'Tus anuncios', descripcion: 'Gasto, resultados y salud de tus campañas.', icono: '📊' } },
  // La ruta vieja redirige a la hoja, pero sus links ya salieron en mensajes de MaKo.
  { re: /^\/closing(?![\w-])/, p: CLOSING },
  { re: /^\/experimentos/, p: { tipo: 'experimentos', titulo: 'Tus experimentos', descripcion: 'Lo que ya está validado y lo que sigue en prueba.', icono: '🧪' } },
  { re: /^\/(email|whatsapp|chatbot|chat-agent)/, p: { tipo: 'mensajes', titulo: 'Tus mensajes', descripcion: 'Conversaciones, nutrición y secuencias.', icono: '💬' } },
  { re: /^\/(conocimiento|conocimientos)/, p: { tipo: 'conocimiento', titulo: 'Tu conocimiento', descripcion: 'El material y la metodología cargados en MaKo.', icono: '📚' } },
  { re: /^\/(configuraciones|perfil)/, p: { tipo: 'config', titulo: 'Configuración', descripcion: 'Quién recibe qué, y cómo te avisa MaKo.', icono: '⚙️' } },
  { re: /^\/onboarding/, p: { tipo: 'onboarding', titulo: 'Termina de configurar MaKo', descripcion: 'Los datos que le faltan a MaKo para trabajar contigo.', icono: '🚀' } },
];

/**
 * La tarjeta de un destino. Acepta el path con o sin query, y también la URL
 * entera (que es como llega el `next=` a veces).
 */
export function previewDeDestino(destino: string | null | undefined): PreviewLink {
  const crudo = (destino ?? '').trim();
  if (!crudo) return PREVIEW_DEFAULT;
  let path = crudo;
  // El `next=` puede venir como path o como URL completa según quién lo arme.
  if (/^https?:\/\//i.test(path)) {
    try { const u = new URL(path); path = u.pathname + u.search; } catch { return PREVIEW_DEFAULT; }
  }
  const [sinHash] = path.split('#');
  const [ruta, query = ''] = sinHash.split('?');
  path = ruta.startsWith('/') ? ruta : `/${ruta}`;
  const hoja = new URLSearchParams(query).get('hoja');
  return RUTAS.find((r) => r.re.test(path) && (!r.hoja || r.hoja === hoja))?.p ?? PREVIEW_DEFAULT;
}

/** Búsqueda por CLAVE de tipo — la usa la imagen de /api/og, que solo recibe eso. */
export function previewDeTipo(tipo: string | null | undefined): PreviewLink | null {
  const t = (tipo ?? '').trim();
  if (!t) return null;
  if (t === PREVIEW_DEFAULT.tipo) return PREVIEW_DEFAULT;
  return RUTAS.find((r) => r.p.tipo === t)?.p ?? null;
}
