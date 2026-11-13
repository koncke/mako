// =============================================================================
// Lo que dice el sitio de MaKo (la vista previa de /vsl/sitio y /vsl/comparaciones), en un solo lugar
// =============================================================================
// Referencia copiada: la portada de beehiiv (https://www.beehiiv.com/), su barra con los menús «Product» y «Solutions» y
// https://www.beehiiv.com/comparisons, leídas el 12/11/2026. El diseño (valores medidos) vive en ./estilos.ts y en
// docs/diseno/sitio-beehiiv.md; aquí va SÓLO el contenido, y casi todo sale de algo que ya existe:
//   · las funciones del menú «Producto» son las 19 landings de app/vsl/_competencia/registro.ts (su nombre, su ícono y su
//     ruta). Una landing nueva que no esté en ningún grupo entra sola en la columna de su lado (`menuProducto`);
//   · «Industrias» son los avatares de lib/origen-cuenta.ts (AVATARES), cada uno a su landing PUBLICADA (LANDING_DEL_AVATAR,
//     abajo; desde el 12/11/2026, porque /vsl/mako-<avatar> nunca se subió y daba 404);
//   · la tabla de comparaciones sale de ./reemplaza.ts (los trabajos y TODAS las apps que MaKo reemplaza en cada uno, con su
//     logo): si cambia la lista, la tabla, la tira de la portada y el número del titular cambian solos;
//   · las integraciones son las del catálogo (lib/integraciones-catalogo.ts) que un negocio ve y puede conectar hoy;
//   · los números se CUENTAN aquí abajo; ninguno se escribe a mano.
// Las agrupaciones (qué landing va en qué columna) siguen las familias de la barra de la app (app/_components/nav.ts:
// Today, Sales, Marketing, Create) y lo que dice cada landing. Lo que no tiene un lugar en la referencia no se inventa.
// Puro y sin `server-only`: lo leen las páginas y la foto de comparación.
// =============================================================================

import { STACK_QUE_REEMPLAZA, appsQueReemplaza, type AppQueReemplaza } from './reemplaza';
import { LANDINGS_COMPETENCIA } from '../_competencia/registro';
import { CASO } from '../_competencia/marca';
import type { LandingCompetencia } from '../_competencia/tipos';
import { AVATARES, type AvatarOrigen } from '@/lib/origen-cuenta';
import { DEFS, defsVisibles, ordenCategoria, type Def } from '@/lib/integraciones-catalogo';
import { SIN_USO_TODAVIA, tarjetaDeRed, type RedConTarjeta } from '@/lib/zernio-redes';
import { CATALOGO_GRABADORES } from '@/lib/grabadores/catalogo';
import { EMAIL_MAKO } from '@/lib/app-url';
import { NOMBRE_PLAN_CON_PRUEBA, PRUEBA_DIAS } from '@/lib/planes-mako';
import { TOPES } from '@/lib/topes-plan';

// ─────────────────────────────────────────────────────────────────────────────
// Las funciones (las landings de /vsl/<slug>)
// ─────────────────────────────────────────────────────────────────────────────

export type ItemFuncion = { slug: string; nombre: string; href: string; icono: readonly string[] };

const landingDe = (slug: string): LandingCompetencia | undefined => LANDINGS_COMPETENCIA.find((l) => l.slug === slug);

/** El nombre de la función como en la barra de la app: «Automations · tu setter con IA» → «Automations». */
export const nombreCorto = (l: LandingCompetencia): string => l.nombre.split(' · ')[0];

const itemDe = (l: LandingCompetencia): ItemFuncion => ({ slug: l.slug, nombre: nombreCorto(l), href: `/vsl/${l.slug}`, icono: l.icono });

/**
 * Los cuatro grandes de «Producto» (donde beehiiv pone Newsletters, Podcasts, Digital Products y Community): el centro de MaKo
 * y las tres funciones de punta de una venta High Ticket. La bajada es lo que dice su landing, recortado a un renglón:
 *   · mako        → su etiqueta: «MaKo, el chat que conoce tu negocio»
 *   · crm         → su metaTitle: «CRM de MaKo para High Ticket: se llena y se mueve solo»
 *   · seguimiento → su nombre: «Automations · tu setter con IA»
 *   · ads         → su metaTitle: «Marketing CoPilot de MaKo: tu estrategia y tus anuncios, con un copiloto que propone»
 * `familia` es la columna del pie donde va (la de la barra de la app); el Ops Center va en la de MaKo.
 */
// Las cuatro grandes de arriba (Ops Center, CRM, Automations y CoPilot con ícono y bajada) se fueron el 12/11/2026. Martín: «No me
// gusta tampoco de que esté arriba las cuatro esas y abajo esas otras. Me gustaría que todas estén como están abajo».
const GRANDES: readonly { slug: string; bajada: string; familia: string | null }[] = [];

/**
 * Las columnas de «Producto» (las de beehiiv: Publish, Grow, Earn, Analyze, Connect): las familias de la barra de la app, con
 * las landings que caen en cada una. Ads Analyst (las hojas de tus anuncios) y Funnels (lo que Meta aprende de tu CRM) van en
 * Marketing porque hablan de tus anuncios; Cobranza (el plan de cuotas del CRM) y Agenda (Calendar) en Sales.
 */
// Sin una columna «MaKo» con sólo Ops Center (Martín, 12/11/2026, noche: «no tiene sentido que haya una opción de MaKo y que
// tenga Ops Center, tanto en la bottom bar como en producto»): Ops Center va primero en Today, que es donde vive en la app.
const COLUMNAS: readonly { rotulo: string; slugs: readonly string[] }[] = [
  { rotulo: 'Today', slugs: ['mako', 'dashboard', 'whatsapp', 'prioridades', 'email'] },
  { rotulo: 'Sales', slugs: ['crm', 'seguimiento', 'agenda', 'cobranza'] },
  { rotulo: 'Marketing', slugs: ['ads', 'offer', 'competitor-spy', 'script', 'funnel'] },
  { rotulo: 'Create', slugs: ['video', 'ai-avatar', 'image', 'copywriting', 'web-generator'] },
];

export type MenuProducto = {
  grandes: (ItemFuncion & { bajada: string })[];
  columnas: { rotulo: string; items: ItemFuncion[] }[];
};

/** El menú «Producto»: las 19 landings, cada una una sola vez. Una landing nueva sin lugar va a la última columna. */
export function menuProducto(): MenuProducto {
  const grandes = GRANDES.flatMap((g) => { const l = landingDe(g.slug); return l ? [{ ...itemDe(l), bajada: g.bajada }] : []; });
  const columnas = COLUMNAS.map((c) => ({ rotulo: c.rotulo, items: c.slugs.flatMap((s) => { const l = landingDe(s); return l ? [itemDe(l)] : []; }) }));
  const usados = new Set([...GRANDES.map((g) => g.slug), ...COLUMNAS.flatMap((c) => c.slugs)]);
  const sueltas = LANDINGS_COMPETENCIA.filter((l) => !usados.has(l.slug)).map(itemDe);
  if (sueltas.length) columnas[columnas.length - 1].items.push(...sueltas);
  return { grandes, columnas };
}

// ─────────────────────────────────────────────────────────────────────────────
// Industrias: los avatares de MaKo
// ─────────────────────────────────────────────────────────────────────────────

export type ItemIndustria = { avatar: AvatarOrigen; nombre: string; bajada: string; href: string; icono: readonly string[] };

const NOMBRE_AVATAR: Record<AvatarOrigen, string> = {
  inmobiliarias: 'Inmobiliarias', infoproductores: 'Infoproductores', coaches: 'Coaches', agencias: 'Agencias',
};

/** Lo que dice cada landing de avatar en su `seo`, después del «·» (scripts/landings-mako-v2-funnels.mts). */
const BAJADA_AVATAR: Record<AvatarOrigen, string> = {
  inmobiliarias: 'Cada interesado atendido al instante',
  infoproductores: 'Más llamadas agendadas por la misma inversión',
  coaches: 'Tú das las sesiones, MaKo te llena la agenda',
  agencias: 'Los negocios de tus clientes, desde tu cuenta',
};

/** Íconos de Tabler (MIT), como los del resto de las landings: casa, birrete, mensajes y maletín. */
const ICONO_AVATAR: Record<AvatarOrigen, readonly string[]> = {
  inmobiliarias: ['M5 12l-2 0l9 -9l9 9l-2 0', 'M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7', 'M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6'],
  infoproductores: ['M22 9l-10 -4l-10 4l10 4l10 -4v6', 'M6 10.6v5.4a6 3 0 0 0 12 0v-5.4'],
  coaches: ['M21 14l-3 -3h-7a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1h9a1 1 0 0 1 1 1v10', 'M14 15v2a1 1 0 0 1 -1 1h-7l-3 3v-10a1 1 0 0 1 1 -1h2'],
  agencias: ['M3 9a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z', 'M8 7v-2a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v2', 'M12 12l0 .01', 'M3 13a20 20 0 0 0 18 0'],
};

/**
 * La landing PUBLICADA de cada avatar (documentos de Web Generator de la tanda del 23/10, medido en producción el 12/11/2026:
 * /vsl/coaches, /vsl/infoproductores y /vsl/inmobiliarias dan 200). Antes el menú iba a /vsl/mako-<avatar>, que arma
 * scripts/landings-mako-v2-funnels.mts pero nunca se subieron: los cuatro links daban 404. Agencias no tiene página publicada
 * y queda fuera del menú hasta que la tenga (Martín, 12/11: «revisa todo lo que falta porque tal vez hay botones que no andan»).
 */
const LANDING_DEL_AVATAR: Partial<Record<AvatarOrigen, string>> = {
  coaches: '/vsl/coaches',
  infoproductores: '/vsl/infoproductores',
  inmobiliarias: '/vsl/inmobiliarias',
  // Martín (12/11/2026, noche): «en industria falta justamente agencia, que ya tenemos todo un apartado de agencia». Es la
  // landing de Agency Dashboard (app/agency, la de sumarse como agencia): pide iniciar sesión, no es un documento publicado.
  agencias: '/agency',
};

export const INDUSTRIAS: readonly ItemIndustria[] = AVATARES.flatMap((a) => {
  const href = LANDING_DEL_AVATAR[a];
  return href ? [{ avatar: a, nombre: NOMBRE_AVATAR[a], bajada: BAJADA_AVATAR[a], href, icono: ICONO_AVATAR[a] }] : [];
});

/**
 * La tarjeta de «Featured stories»: el caso de Mauricio, el único que hay. Lleva a su lugar en la portada. La foto es la que ya
 * usan las landings para su caso (app/vsl/_detalle/CasoCarrusel.tsx: «Mauricio con su equipo»).
 */
export const HISTORIA = {
  quien: CASO.quien,
  rol: CASO.rol,
  texto: CASO.titulo.replace(/<[^>]+>/g, ''),
  foto: '/vsl-assets/caso-equipo.jpg',
  fotoAlt: 'Mauricio con su equipo',
  href: '/vsl/sitio#caso',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// La barra y el pie: los links fijos
// ─────────────────────────────────────────────────────────────────────────────

export const RUTA_PRECIOS = '/planes';
export const RUTA_COMPARACIONES = '/vsl/comparaciones';
export const RUTA_ENTRAR = '/login';

/**
 * Las columnas del pie (las de beehiiv: Company, Product, Solutions, Resources, Connect): Empezar, las familias, Industrias y
 * Legal. Martín (12/11/2026): «no tiene sentido que pongas dos secciones que se llamen MaKo» (la primera es «Empezar»; «MaKo»
 * queda como la familia del menú) y «términos, privacidad, uso aceptable, soporte y el email deberían estar en una sección
 * como la de Industrias».
 */
export function columnasDelPie(): { titulo: string; links: { nombre: string; href: string }[] }[] {
  const m = menuProducto();
  const grandes = GRANDES.flatMap((g) => { const l = landingDe(g.slug); return l ? [{ familia: g.familia, item: itemDe(l) }] : []; });
  const ops = grandes.find((g) => g.familia == null)?.item;
  return [
    // MaKo Partners (la landing pública del programa de referidos, /mako-partners): Martín, 12/11: «en algún lado tiene que estar».
    { titulo: 'Empezar', links: [...(ops ? [{ nombre: ops.nombre, href: ops.href }] : []), { nombre: 'Precios', href: RUTA_PRECIOS }, { nombre: 'Comparaciones', href: RUTA_COMPARACIONES }, { nombre: 'MaKo Partners', href: '/mako-partners' }, { nombre: 'Iniciar sesión', href: RUTA_ENTRAR }] },
    ...m.columnas.map((c) => ({
      titulo: c.rotulo,
      links: [...grandes.filter((g) => g.familia === c.rotulo).map((g) => g.item), ...c.items].map((i) => ({ nombre: i.nombre, href: i.href })),
    })),
    { titulo: 'Industrias', links: INDUSTRIAS.map((i) => ({ nombre: i.nombre, href: i.href })) },
    { titulo: 'Legal', links: [...LEGALES, { nombre: EMAIL_MAKO, href: `mailto:${EMAIL_MAKO}` }] },
  ];
}

/** Los links legales de la línea de abajo del pie (los de la portada sin JavaScript, app/vsl/PortadaSinJs.tsx). */
export const LEGALES: readonly { nombre: string; href: string }[] = [
  { nombre: 'Términos', href: '/terminos' },
  { nombre: 'Privacidad', href: '/privacidad' },
  { nombre: 'Uso aceptable', href: '/aup' },
  { nombre: 'Soporte', href: '/soporte' },
];

// ─────────────────────────────────────────────────────────────────────────────
// La portada
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Las ocho tarjetas de «Everything you need…» (las de beehiiv, de a pares en filas de 2 a 1 y de 1 a 2). El texto es una frase de
 * su landing (su hero o su metaDesc), y el visual el que ya tiene esa landing:
 *   · crm         → «La ficha se crea cuando entra el lead, se mueve de etapa cuando agenda…» (hero). Su visual de portada se
 *                   dibuja en un canvas; va el tablero de etapas de app/vsl/_detalle/feature-visuals.ts (`kanban` de pipeline).
 *   · seguimiento → su metaDesc. · ads → su hero. · video → su hero. · whatsapp → su metaDesc.
 *   · competitor-spy → su «Después de MaKo». · web-generator → la bajada de su hero (replicar). · copywriting → su FAQ de los
 *                   referentes; la pared de caricaturas lleva «Inspirado en» (la regla de lib/asesores/catalogo.ts).
 */
/** Lo que dibuja una fila: el visual de su landing, uno de app/vsl/_detalle/feature-visuals.ts, una grabación de la app o los referentes. */
export type VisualTarjeta = 'hero' | 'gurus' | 'tableros' | 'avatar' | { video: string; poster: string } | { falta: string };

/**
 * NADA INVENTADO (Martín, 12/11/2026, noche: «identifica la cantidad de cosas que hiciste inventándote cosas. Eso yo no lo quiero…
 * pon un placeholder con que aquí falta una animación»). Cada fila muestra la app de verdad (`video`: el componente real grabado;
 * `gurus`: las caricaturas; `hero` sólo donde el visual de su landing son fotos reales, AI Avatar) o `falta`: el recuadro que dice
 * qué animación va ahí, con las palabras de Martín. `slug` lleva a su landing; sin landing (Classroom) va sin link.
 */
export const TARJETAS_PORTADA: readonly { slug?: string; rotulo?: string; titulo: string; texto: string; visual: VisualTarjeta }[] = [
  { slug: 'competitor-spy', titulo: 'Mira todo lo que publica tu competencia.', texto: 'Cada competidor con sus piezas, ordenadas por formato, y tu versión a un toque en Image.', visual: { video: '/vsl-assets/sitio/spy.webm', poster: '/vsl-assets/sitio/spy.jpg' } },
  { slug: 'web-generator', titulo: 'Copia una landing que ya vende.', texto: 'Pega el link de una landing que ya funciona y MaKo la replica con tu oferta, sección por sección.', visual: { video: '/vsl-assets/sitio/replicar.webm', poster: '/vsl-assets/sitio/replicar.jpg' } },
  { slug: 'image', rotulo: 'Carruseles', titulo: 'Replica los carruseles que funcionan.', texto: 'Eliges un carrusel de los outliers y MaKo arma el tuyo con su diseño y tus textos.', visual: { video: '/vsl-assets/sitio/carruseles.webm', poster: '/vsl-assets/sitio/carruseles.jpg' } },
  { slug: 'copywriting', titulo: 'Escribe con IA lo que vende.', texto: 'Eliges un reel de tu competencia, MaKo lee su guion y escribe el tuyo con tu oferta, en segundos.', visual: { video: '/vsl-assets/sitio/copywriting.webm', poster: '/vsl-assets/sitio/copywriting.jpg' } },
  { slug: 'copywriting', rotulo: 'Referentes', titulo: 'Trabaja con el método de los que más venden.', texto: 'Los referentes del marketing, cada uno con su método destilado de su curso: en el chat de MaKo eliges con quién trabajar.', visual: 'gurus' },
  { slug: 'ai-avatar', titulo: 'Tu cara, en videos hechos con IA.', texto: 'Tu personaje, con tu cara, en la escena que elijas y diciendo tu guion.', visual: 'avatar' },
  { slug: 'video', titulo: 'Edita tus videos sin saber editar.', texto: 'Un editor como CapCut con un equipo de MaKo editando: cortes, subtítulos y B-roll.', visual: { falta: 'El lienzo de video con los cursores del equipo de MaKo editando sobre la línea de tiempo y el video.' } },
  { slug: 'ads', titulo: 'Tus anuncios, mirados todos los días.', texto: 'Cada día mira tus anuncios de Meta y te propone qué subir, pausar o probar.', visual: { falta: 'Marketing CoPilot: lo que MaKo mira de tus anuncios y lo que te propone, con un diseño a la altura.' } },
  { slug: 'crm', titulo: 'Cada cliente, en su etapa.', texto: 'La ficha se crea cuando entra el lead y se mueve de etapa cuando agenda.', visual: { falta: 'El CRM de MaKo tal cual: una tarjeta que cambia de etapa y el menú «…» para asignar campañas.' } },
  { slug: 'crm', rotulo: 'Grupos de WhatsApp', titulo: 'Trae los contactos de tus grupos.', texto: 'Con MaKo Pro, los contactos de tus grupos de WhatsApp entran a tu CRM.', visual: { falta: 'El scrapeo de un grupo de WhatsApp: la pestaña de WhatsApp, los grupos y los contactos entrando, con el cartel de MaKo.' } },
  { slug: 'seguimiento', titulo: 'Un agente que contesta por ti.', texto: 'Contesta por WhatsApp, Instagram, Messenger y email, califica a cada interesado y lo lleva a agendar.', visual: { falta: 'La vista del lienzo con todas las automatizaciones.' } },
  { slug: 'whatsapp', titulo: 'Todos tus chats en una bandeja.', texto: 'Una conversación por contacto, con su ficha del CRM al lado.', visual: { falta: 'La bandeja de Chats de MaKo tal cual es.' } },
  { slug: 'dashboard', titulo: 'Tus números, en tableros.', texto: 'Tableros de ventas, de anuncios y de llamadas listos para usar, con tus datos.', visual: 'tableros' },
  { rotulo: 'Classroom', titulo: 'Tu escuela, dentro de MaKo.', texto: 'El curso por módulos y lecciones, y la comunidad de tus alumnos.', visual: { falta: 'Cómo se ven las clases del Classroom.' } },
];

/**
 * Los tableros de MaKo, para el carrusel de la fila «Tus números, en tableros» (Martín, 12/11/2026, noche: «un carrusel con todos
 * los dashboards que tenemos y que se vea la animación de entrada»). Son las capturas de la app de cada plantilla, con sus datos de
 * ejemplo (docs/diseno/mockups-dashboard/<id>/captura/mako-1440.png), recortadas a 16:10 en public/vsl-assets/sitio/tableros/.
 */
export const TABLEROS: readonly { id: string; nombre: string }[] = [
  { id: 'velocidad-tend', nombre: 'Velocidad de llamada' }, { id: 'cobranza', nombre: 'Cobranza' }, { id: 'vsl-pelago', nombre: 'VSL y YouTube' },
  { id: 'hooks-ondra', nombre: 'Hooks y retención' }, { id: 'inmobiliaria-torque', nombre: 'Inmobiliaria' }, { id: 'closing', nombre: 'Closing' },
  { id: 'cold-calling-corvane', nombre: 'Cold Calling' }, { id: 'comercial-selvar', nombre: 'Comercial' }, { id: 'marketing-kestrel', nombre: 'Marketing' },
  { id: 'general-orvel', nombre: 'General' }, { id: 'operacion-moorly', nombre: 'Operación' }, { id: 'focus-pane', nombre: 'Focus' },
  { id: 'focus-lumora', nombre: 'Mi día' },
];

/**
 * AI Avatar en la portada: el personaje de Martín y TRES escenas suyas, la misma persona en todas (las tomas del método Avatar Hype
 * de su reel, 9/11/2026: C:/dev/reel-mentores/omni/, en public/vsl-assets/sitio/avatar/). Antes había una foto de catálogo como
 * «tu foto» y una persona distinta en cada escena: decía «tu personaje» y mostraba a otros (Martín, 12/11: «fíjate lo que pones
 * y critícalo»).
 */
export const ESCENAS_AVATAR: readonly { foto: string; nombre: string }[] = [
  { foto: 'celular', nombre: 'Con tu celular' }, { foto: 'pizarra', nombre: 'En la pizarra' }, { foto: 'crm', nombre: 'Mostrando tu CRM' },
];

/** La landing de una función (para sus tarjetas), o undefined si ya no existe. */
export const landingDeSlug = landingDe;

/** Las apps de la tira de arriba (la de los logos de beehiiv): las conocidas de una venta High Ticket, si están conectables. */
const TIRA: readonly string[] = ['meta', 'whatsapp', 'red-instagram', 'red-facebook', 'calendly', 'calcom', 'zoom', 'fathom', 'stripe', 'mercadopago', 'youtube', 'red-tiktok'];

/**
 * El logo ORIGINAL de cada app de la tira, flotando (Martín, 12/11/2026: «hay logos que están un poco raros todavía, como el de
 * Mercado Pago»). En public/vsl-assets/logos/integraciones/: el ícono que publica su sitio, o, donde era chico (Meta, WhatsApp,
 * Zoom, Mercado Pago), su logo de simple-icons 13.21.0 en el color de su marca.
 */
export const LOGO_INTEGRACION: Readonly<Record<string, string>> = {
  meta: 'meta.svg', whatsapp: 'whatsapp.svg', 'red-instagram': 'instagram.png', 'red-facebook': 'facebook.png', calendly: 'calendly.png',
  calcom: 'calcom.png', zoom: 'zoom.svg', fathom: 'fathom.png', stripe: 'stripe.png', mercadopago: 'mercadopago.svg', youtube: 'youtube.png',
  'red-tiktok': 'tiktok.png',
};

/**
 * Las integraciones que un negocio puede conectar HOY: las que ve un negocio en /integraciones (`defsVisibles` sin super
 * admin), menos las que su tarjeta dice que todavía no hacen nada (Pinterest y Reddit, `SIN_USO_TODAVIA`), los grabadores
 * que no se conectan (Loom, Read AI, Google Meet: `conectable: false`) y el Pixel, que es de MaKo.
 */
export function integracionesVivas(): Def[] {
  const noConectan = new Set<string>([
    ...(Object.keys(SIN_USO_TODAVIA) as RedConTarjeta[]).map(tarjetaDeRed),
    ...Object.values(CATALOGO_GRABADORES).filter((g) => !g.conectable).map((g) => g.id as string),
    'landing',
  ]);
  return defsVisibles(DEFS, { cats: null, ocultas: new Set(), esSuper: false })
    .filter((d) => !noConectan.has(d.key))
    .sort((a, b) => ordenCategoria(a.categoria) - ordenCategoria(b.categoria));
}

export function integracionesDeLaTira(): Def[] {
  const vivas = integracionesVivas();
  return TIRA.flatMap((k) => vivas.filter((d) => d.key === k));
}

/** El número de plantillas de Copywriting, el mismo que cuenta su landing (su bloque `cifras`). */
function plantillasDeCopywriting(): string | null {
  const b = landingDe('copywriting')?.bloques.find((x) => x.tipo === 'cifras');
  return b && b.tipo === 'cifras' ? b.items[0]?.valor ?? null : null;
}

/** «The numbers tell the story»: cuatro números contados del código. */
export function numerosDelSitio(): { valor: string; texto: string }[] {
  const plantillas = plantillasDeCopywriting();
  return [
    { valor: String(LANDINGS_COMPETENCIA.length), texto: 'funciones en una sola app' },
    { valor: String(nAppsQueReemplaza()), texto: 'apps que MaKo reemplaza' },
    { valor: String(integracionesVivas().length), texto: 'integraciones con las apps que ya usas' },
    ...(plantillas ? [{ valor: plantillas, texto: 'plantillas de Copywriting, cada una con su ejemplo' }] : []),
  ];
}

/**
 * Las preguntas: las de las landings de MaKo (PREGUNTAS de scripts/landings-mako-v2.mts, que ya revisó el Cerebro contra el
 * código), menos la del bloqueo del WhatsApp, que vende el ritmo de envío como protección. La de la permanencia, con la parte
 * que no depende de la prueba gratis.
 */
/**
 * LAS OBJECIONES de quien vende High Ticket (Martín, 12/11/2026, noche: «tienes que pensar más sobre las objeciones que pueden
 * tener nuestros clientes. No preguntas genéricas»). Cada respuesta dice sólo lo que MaKo hace (los números, de los topes y de la
 * prueba del código): el setter LLEVA a agendar, no reserva (app/vsl/_competencia/seguimiento.ts); el análisis de llamadas y los
 * grupos de WhatsApp son de Pro (lib/topes-plan.ts); la IA es la del cliente.
 */
export const PREGUNTAS_SITIO: readonly { p: string; r: string }[] = [
  { p: 'Ya pago GoHighLevel, ManyChat y un editor de video. ¿Para qué cambiar?', r: `Porque MaKo hace ese trabajo en una sola app, con una IA que conoce tu negocio de punta a punta. En «Comparaciones» ves, trabajo por trabajo, las ${appsQueReemplaza().length} apps que reemplaza.` },
  { p: 'No tengo tiempo de aprender otra herramienta.', r: 'Le cuentas a MaKo qué vendes y a quién, y arma tu oferta, tus páginas y tus mensajes: tú revisas y apruebas. Si prefieres que lo armemos nosotros, el Acelerador lo deja listo en la primera semana.' },
  { p: '¿Y si la IA le contesta mal a un cliente y lo pierdo?', r: 'Cada conversación queda en tu bandeja y la tomas cuando quieras. El setter contesta con tu oferta, califica con tus propios criterios y lleva al interesado a agendar: no cierra ventas por ti.' },
  { p: 'Mi venta se cierra en una llamada. ¿En qué me ayuda?', r: 'La llamada la haces tú. MaKo te llena la agenda con interesados calificados y, con MaKo Pro, te dice qué mejorar en cada llamada de venta.' },
  { p: 'Ya tengo setters y closers.', r: `Entran con su propio acceso: en MaKo Pro, hasta ${TOPES.agencia['equipo.usuarios']} personas de tu equipo, y todas ven la misma historia de cada cliente.` },
  { p: 'Vendo por WhatsApp, no con anuncios.', r: 'Te sirve igual: conectas tu número escaneando un código QR, como WhatsApp Web, y los seguimientos salen por ahí. Con MaKo Pro, además, traes a tu CRM los contactos de tus grupos.' },
  { p: '¿Cuánto me va a salir en total?', r: 'El plan, más lo que consuma tu propia IA (Claude, ChatGPT o Gemini), que pagas directo a tu proveedor: MaKo no le pone recargo. Con Gemini puedes empezar gratis, con un tope por día.' },
  { p: '¿Y si no me sirve?', r: `${NOMBRE_PLAN_CON_PRUEBA} empieza con ${PRUEBA_DIAS} días gratis: si te das de baja antes del día ${PRUEBA_DIAS + 1}, no pagas nada. Y no hay permanencia: te das de baja cuando quieras.` },
  { p: '¿Qué pasa con los datos de mis clientes?', r: 'MaKo no entrena modelos con tus datos: lo que la IA necesita pasa por tu propia cuenta de Claude, ChatGPT o Gemini.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Comparaciones: MaKo contra el stack que reemplaza
// ─────────────────────────────────────────────────────────────────────────────

export type FilaComparacion = {
  key: string;
  familia: string;
  /** El trabajo («Dashboards»): la primera columna. */
  trabajo: string;
  /** Las apps que hoy hacen ese trabajo, con su logo (./reemplaza.ts). */
  apps: readonly AppQueReemplaza[];
  /** Sus nombres en una frase («CapCut, Submagic y Captions»). */
  app: string;
  /** La función de MaKo que lo hace. */
  funcion: string;
  /** Su landing, o el ancla de su fila si no tiene. */
  href: string;
  ancla: string;
};

const enFrase = (xs: readonly string[]) => (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);

/**
 * Las filas de la tabla: un trabajo por fila, con todas las apps que MaKo reemplaza en él (./reemplaza.ts; hasta el 12/11/2026
 * era una sola app por función, de los `reemplaza` de lib/funciones-mako.ts, y eran 8). Classroom no tiene landing: su tarjeta
 * lleva a su fila de la tabla.
 */
export function filasDeComparacion(): FilaComparacion[] {
  return STACK_QUE_REEMPLAZA.map((t) => {
    const key = t.landing ?? t.trabajo.toLowerCase().replace(/[^a-z]+/g, '-');
    const ancla = `fila-${key}`;
    return { key, familia: t.familia, trabajo: t.trabajo, apps: t.apps, app: enFrase(t.apps.map((a) => a.nombre)), funcion: t.funcion, href: t.landing ? `/vsl/${t.landing}` : `#${ancla}`, ancla };
  });
}

/** Cuántas apps distintas reemplaza: el titular de la comparación. */
export const nAppsQueReemplaza = () => appsQueReemplaza().length;

/** Las filas agrupadas por familia (los encabezados de la tabla, como «Pricing» o «Website Features» en beehiiv). */
export function gruposDeComparacion(): { familia: string; filas: FilaComparacion[] }[] {
  const grupos: { familia: string; filas: FilaComparacion[] }[] = [];
  for (const f of filasDeComparacion()) {
    const g = grupos.find((x) => x.familia === f.familia);
    if (g) g.filas.push(f); else grupos.push({ familia: f.familia, filas: [f] });
  }
  return grupos;
}

/** «Dashboards, chats y textos»: la lista de trabajos en una frase. */
export function listaDeTrabajos(filas: readonly FilaComparacion[]): string {
  const t = filas.map((f, i) => (i === 0 ? f.trabajo : f.trabajo.toLowerCase()));
  return t.length < 2 ? (t[0] ?? '') : `${t.slice(0, -1).join(', ')} y ${t[t.length - 1]}`;
}
