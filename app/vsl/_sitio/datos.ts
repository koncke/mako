// =============================================================================
// Lo que dice el sitio de MaKo (la vista previa de /vsl/sitio y /vsl/comparaciones), en un solo lugar
// =============================================================================
// Referencia copiada: la portada de beehiiv (https://www.beehiiv.com/), su barra con los menús «Product» y «Solutions» y
// https://www.beehiiv.com/comparisons, leídas el 12/11/2026. El diseño (valores medidos) vive en ./estilos.ts y en
// docs/diseno/sitio-beehiiv.md; aquí va SÓLO el contenido, y casi todo sale de algo que ya existe:
//   · las funciones del menú «Producto» son las landings de app/vsl/_competencia/registro.ts (24 el 16/11/2026: su nombre, su
//     ícono y su ruta). Una landing nueva que no esté en ningún grupo entra sola en la columna de su lado (`menuProducto`);
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
// Lo que es de MaKo Pro se DERIVA del plan, no se tipea (app/vsl/_competencia/solo-pro.ts): las filas de la portada que lo venden.
import { soloPro, soloProEntre } from '../_competencia/solo-pro';
import { AVISO_PRO_CLOSING } from '../_competencia/closing';
import { AVISO_COMUNIDAD } from '../_competencia/classroom';
import { AVISO_EQUIPO } from '../_competencia/equipo';
import { AVATARES, type AvatarOrigen } from '@/lib/origen-cuenta';
import { FUNNELS_SITIO, rutaFunnel } from './funnels-datos';
import { DEFS, defsVisibles, ordenCategoria, type Def } from '@/lib/integraciones-catalogo';
import { SIN_USO_TODAVIA, tarjetaDeRed, type RedConTarjeta } from '@/lib/zernio-redes';
import { CATALOGO_GRABADORES } from '@/lib/grabadores/catalogo';
import { EXTENSION_URL_TIENDA } from '@/lib/extension-tienda';
import { PROGRAMA_ACELERADOR } from '@/lib/planes-mako';
import { COMPETIDORES, rutaVs } from './competencia';

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
 * Dos van en una columna que NO es su lugar en la app, y lo dicen en su renglón: Equipo y el Calendario de contenido.
 */
// Sin una columna «MaKo» con sólo Ops Center (Martín, 12/11/2026, noche: «no tiene sentido que haya una opción de MaKo y que
// tenga Ops Center, tanto en la bottom bar como en producto»): Ops Center va primero en Today, que es donde vive en la app.
const COLUMNAS: readonly { rotulo: string; slugs: readonly string[] }[] = [
  // Second Brain (16/11/2026, su landing como Obsidian): después de Ops Center, donde ya iba sin landing (era SIN_LANDING, a /#brain).
  { rotulo: 'Today', slugs: ['mako', 'second-brain', 'dashboard', 'whatsapp', 'prioridades', 'email'] },
  // Closing (16/11/2026): después de Agenda, que es donde se agenda la llamada que después se analiza.
  // Classroom (16/11/2026, su landing como Circle): al final, como en la barra de la app (Sales › Classroom), lo que va después de cobrar.
  // Equipo (16/11/2026, su landing como Pipedrive): en la app NO es de una familia de la barra, es una sección de la «Configuración
  // del negocio» (SECCIONES_NEGOCIO_M de lib/movil-rutas.ts). Va en Sales porque es el equipo de VENTAS (setters y closers), después
  // de Closing, que es donde se ve la tasa de cierre de cada closer.
  { rotulo: 'Sales', slugs: ['crm', 'seguimiento', 'agenda', 'closing', 'equipo', 'cobranza', 'classroom'] },
  // Calendario de contenido (16/11/2026, su landing como Metricool): en la app, Calendar es de Sales (SECCIONES_MAS de
  // lib/movil-rutas.ts), y por eso la Agenda va arriba, en Sales. Esta landing va en Marketing porque vende la otra mitad de Calendar,
  // publicar tu contenido (como Ads Analyst y Funnels, que van acá por los anuncios): después del Marketing CoPilot, cuyo «Esta
  // semana» termina en «Programar la semana», que abre el Calendario.
  { rotulo: 'Marketing', slugs: ['ads', 'calendario', 'offer', 'competitor-spy', 'script', 'funnel'] },
  { rotulo: 'Create', slugs: ['video', 'ai-avatar', 'image', 'copywriting', 'web-generator'] },
];

export type MenuProducto = {
  grandes: (ItemFuncion & { bajada: string })[];
  columnas: { rotulo: string; items: ItemFuncion[] }[];
};

/**
 * Lo que va en el menú sin landing propia: lleva a SU tarjeta de la portada (el `ancla` de TARJETAS_PORTADA). Martín, 14/11/2026:
 * «en el menú Producto también va uno que sea Second Brain»; iba acá (a /#brain) hasta que tuvo su landing, /vsl/second-brain
 * (16/11/2026, en COLUMNAS). Hoy no queda ninguna; el mecanismo queda para la próxima función sin landing.
 */
const SIN_LANDING: readonly { columna: string; despuesDe: string; item: ItemFuncion }[] = [];

/** El menú «Producto»: todas las landings del registro (24 el 16/11/2026), cada una una sola vez, y lo de SIN_LANDING. Una landing
 *  nueva sin lugar va a la última columna. */
export function menuProducto(): MenuProducto {
  const grandes = GRANDES.flatMap((g) => { const l = landingDe(g.slug); return l ? [{ ...itemDe(l), bajada: g.bajada }] : []; });
  const columnas = COLUMNAS.map((c) => ({ rotulo: c.rotulo, items: c.slugs.flatMap((s) => { const l = landingDe(s); return l ? [itemDe(l)] : []; }) }));
  for (const x of SIN_LANDING) {
    const col = columnas.find((c) => c.rotulo === x.columna);
    if (!col) continue;
    const i = col.items.findIndex((it) => it.slug === x.despuesDe);
    col.items.splice(i + 1, 0, x.item);
  }
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

/** El orden del menú (llamada con Leila, 13/11/2026): Agencias, Coaches, Infoproductores, Inmobiliarias. Uno nuevo, al final. */
const ORDEN_INDUSTRIAS: readonly AvatarOrigen[] = ['agencias', 'coaches', 'infoproductores', 'inmobiliarias'];
const posIndustria = (a: AvatarOrigen) => { const i = ORDEN_INDUSTRIAS.indexOf(a); return i < 0 ? ORDEN_INDUSTRIAS.length : i; };

export const INDUSTRIAS: readonly ItemIndustria[] = [...AVATARES].sort((x, y) => posIndustria(x) - posIndustria(y)).flatMap((a) => {
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
  // /vsl/sitio es un redirect permanente a la raíz (app/vsl/sitio): el caso vive en la portada.
  href: '/#caso',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// La barra y el pie: los links fijos
// ─────────────────────────────────────────────────────────────────────────────

export const RUTA_PRECIOS = '/planes';
export const RUTA_COMPARACIONES = '/vsl/comparaciones';
export const RUTA_ENTRAR = '/login';
/** La landing del MaKo Accelerator: la misma que `RUTA_ACCELERATOR` de app/planes/Tarjetas.tsx (el test las compara). */
export const RUTA_ACCELERATOR_SITIO = '/accelerator';
/** Las secciones de la portada a las que lleva «Recursos» (sus `id`, en ./Portada.tsx). */
export const RUTA_PREGUNTAS = '/#preguntas';
export const RUTA_INTEGRACIONES = '/#integraciones';

// ─────────────────────────────────────────────────────────────────────────────
// «Recursos»: lo que otros SaaS ponen en su menú «Resources» y MaKo YA tiene (15/11/2026)
// ─────────────────────────────────────────────────────────────────────────────
// Martín, 15/11/2026: «en lugar de poner comparaciones en la top bar, pondría recursos o algo así, fíjate como lo tienen otras
// aplicaciones, y ahí pondría varias cosas, como por ejemplo la parte de MaKo Partners, la parte de agencia, las comparaciones.
// Pondría ahí también la documentación de API… las cosas que normalmente suelen entrar en esa parte».
// La investigación de ese día (10 sitios: HubSpot, GoHighLevel, ClickFunnels, Kajabi, Systeme.io, ActiveCampaign, Attio, beehiiv,
// Notion y Linear): 6 de 10 llevan «Resources» en la barra, antes de «Pricing»; 4 de los 7 menús son SÓLO TEXTO con rótulos (el
// molde de beehiiv: Learn · Compare · Connect). Lo que más se repite: ayuda y soporte (9/10), partners (9/10), la API (8/10), blog
// (8/10), comparaciones (7/10) y novedades (7/10).
// ⚠️ SÓLO LO QUE EXISTE: blog, centro de ayuda, novedades, tutoriales, comunidad y estado del servicio son costumbre y MaKo no
//    los tiene; no van hasta que existan. Cada link es una ruta de verdad (tests/sitio-recursos-y-pie.test.ts lo mira).

/**
 * Un renglón de «Recursos». `pie`: cómo se llama en la columna «Recursos» del pie (el mismo nombre si no se dice), o `false` si
 * en el pie ya está en otra columna (Soporte en Legal, el Accelerator en Empezar) o si el pie lleva sólo el índice (las «MaKo vs.»).
 * `conCuenta`: la página pide iniciar sesión, y sin cuenta el visitante termina en /login (le falta una versión pública, como
 * /mako-partners lo es de /partners). `externo`: sale de MaKo, y abre en otra pestaña.
 */
export type ItemRecurso = { nombre: string; href: string; pie?: string | false; conCuenta?: true; externo?: true };
// (`pie: false` también para lo que el pie ya tiene en Industrias: «MaKo para agencias» es «Agencias».)
export type GrupoRecursos = { rotulo: string; items: readonly ItemRecurso[] };

/** Cuántas «MaKo vs. X» van en el menú: las primeras de la comparación (COMPETIDORES, ./competencia.ts), no a mano. */
const VS_EN_EL_MENU = 3;

export const RECURSOS: readonly GrupoRecursos[] = [
  { rotulo: 'Programas', items: [
    // La landing pública del programa de referidos (la de /partners pide sesión).
    { nombre: 'MaKo Partners', href: '/mako-partners' },
    // La de sumarse como agencia (Agency Dashboard, app/agency): PIDE SESIÓN. Es la misma de «Industrias → Agencias», y en el pie
    // ya está ahí.
    { nombre: 'MaKo para agencias', href: '/agency', conCuenta: true, pie: false },
    { nombre: PROGRAMA_ACELERADOR.nombre, href: RUTA_ACCELERATOR_SITIO, pie: false },
  ] },
  { rotulo: 'Comparar', items: [
    ...COMPETIDORES.slice(0, VS_EN_EL_MENU).map((c): ItemRecurso => ({ nombre: `MaKo vs. ${c.nombre}`, href: rutaVs(c), pie: false })),
    { nombre: 'Todas las comparaciones', href: RUTA_COMPARACIONES, pie: 'Comparaciones' },
  ] },
  { rotulo: 'Conecta', items: [
    // La sección «Tus apps, conectadas» de la portada, no /vsl/integraciones: ésa es la landing vieja (con «Solo 5 cupos»).
    { nombre: 'Integraciones', href: RUTA_INTEGRACIONES },
    // La documentación es la tab de la API (app/api-mako): desde el 16/11/2026, SIN sesión es la referencia pública (con la barra y
    // el pie del sitio, sin tokens ni «Probar»): lib/rutas-publicas.ts → `LEIBLES_SIN_SESION`.
    { nombre: 'Documentación de la API', href: '/api-mako' },
    { nombre: 'Extensión de Chrome', href: EXTENSION_URL_TIENDA, externo: true },
    // El link único para instalar MaKo en el teléfono (app/app, pública): a cada dispositivo lo manda a lo suyo.
    { nombre: 'App para tu teléfono', href: '/app' },
  ] },
  { rotulo: 'Ayuda', items: [
    { nombre: 'Preguntas frecuentes', href: RUTA_PREGUNTAS },
    { nombre: 'Soporte', href: '/soporte', pie: false },
  ] },
];

/** La columna «Recursos» del pie: los renglones del menú, en el mismo orden, menos los que el pie ya tiene en otra columna. */
export function recursosDelPie(): LinkDelPie[] {
  return RECURSOS.flatMap((g) => g.items.filter((i) => i.pie !== false).map((i) => ({ nombre: i.pie || i.nombre, href: i.href, ...(i.externo ? { externo: true as const } : {}) })));
}

export type LinkDelPie = { nombre: string; href: string; externo?: true };
/** Una columna del pie. `sub`: un segundo rótulo en la misma columna (los Funnels debajo de Industrias, como en la barra). */
export type ColumnaDelPie = { titulo: string; links: LinkDelPie[]; sub?: { titulo: string; links: LinkDelPie[] } };

/**
 * Las columnas del pie (las de beehiiv: Company, Product, Solutions, Resources, Connect): Empezar, las familias, Industrias (con
 * los Funnels debajo, como en el menú de la barra), Recursos y Legal. Martín (12/11/2026): «no tiene sentido que pongas dos
 * secciones que se llamen MaKo» (la primera es «Empezar») y «términos, privacidad, uso aceptable, soporte y el email deberían
 * estar en una sección como la de Industrias».
 * 15/11/2026: «Recursos» como la barra; Comparaciones y MaKo Partners se mudaron ahí, y a «Empezar» entró el Accelerator. Los
 * Funnels pasaron a ir debajo de Industrias: con nueve columnas en un renglón el pie no entraba (a 1440 sumaban 1.318 px en
 * 1.184 de ancho; ya con ocho se pasaba a 1280 y a 1024 cortaba el correo).
 */
export function columnasDelPie(): ColumnaDelPie[] {
  const m = menuProducto();
  const grandes = GRANDES.flatMap((g) => { const l = landingDe(g.slug); return l ? [{ familia: g.familia, item: itemDe(l) }] : []; });
  const ops = grandes.find((g) => g.familia == null)?.item;
  return [
    { titulo: 'Empezar', links: [...(ops ? [{ nombre: ops.nombre, href: ops.href }] : []), { nombre: 'Precios', href: RUTA_PRECIOS }, { nombre: PROGRAMA_ACELERADOR.nombre, href: RUTA_ACCELERATOR_SITIO }, { nombre: 'Iniciar sesión', href: RUTA_ENTRAR }] },
    ...m.columnas.map((c) => ({
      titulo: c.rotulo,
      links: [...grandes.filter((g) => g.familia === c.rotulo).map((g) => g.item), ...c.items].map((i) => ({ nombre: i.nombre, href: i.href })),
    })),
    { titulo: 'Industrias', links: INDUSTRIAS.map((i) => ({ nombre: i.nombre, href: i.href })), sub: { titulo: 'Funnels', links: FUNNELS_SITIO.map((f) => ({ nombre: f.nombre, href: rutaFunnel(f.id) })) } },
    { titulo: 'Recursos', links: recursosDelPie() },
    // El email ya no va al final de Legal (16/11/2026): el pie tiene su renglón de CONTACTO, a la vista, con el email y el WhatsApp
    // de MaKo (app/vsl/_sitio/Pie.tsx). Martín: «que no solamente esté el email, sino que también esté el WhatsApp de MaKo».
    { titulo: 'Legal', links: [...LEGALES] },
  ];
}

/**
 * Los links legales del pie. Reembolsos entró el 15/11/2026: Stripe y Mercado Pago la piden visible ANTES del primer cobro
 * (lib/rutas-publicas.ts), y el pie viejo de la landing (app/vsl/Landing.tsx, `PieLegal`) la tenía; el del sitio la había perdido.
 */
export const LEGALES: readonly { nombre: string; href: string }[] = [
  { nombre: 'Términos', href: '/terminos' },
  { nombre: 'Privacidad', href: '/privacidad' },
  { nombre: 'Reembolsos', href: '/reembolsos' },
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
/**
 * Lo que dibuja una fila: el visual de su landing, uno de app/vsl/_detalle/feature-visuals.ts, una grabación de la app,
 * los referentes, o `brain`: el Second Brain DE VERDAD, el componente que corre adentro de la app (app/vsl/_sitio/BrainVivo.tsx).
 */
export type VisualTarjeta = 'hero' | 'gurus' | 'tableros' | 'avatar' | 'brain' | 'closing' | 'equipo' | { video: string; poster: string } | { falta: string };

/**
 * NADA INVENTADO (Martín, 12/11/2026, noche: «identifica la cantidad de cosas que hiciste inventándote cosas. Eso yo no lo quiero…
 * pon un placeholder con que aquí falta una animación»). Cada fila muestra la app de verdad (`video`: el componente real grabado;
 * `gurus`: las caricaturas; `hero` sólo donde el visual de su landing son fotos reales, AI Avatar) o `falta`: el recuadro que dice
 * qué animación va ahí, con las palabras de Martín. `slug` lleva a su landing; sin landing va sin link (Classroom y Brain tienen la
 * suya desde el 16/11/2026: /vsl/classroom y /vsl/second-brain).
 * `ancla`: el id de la fila, para lo que el menú «Producto» manda a la portada en vez de a una landing (SIN_LANDING).
 *
 * LO QUE ES DE MaKo Pro LO DICE LA FILA (16/11/2026; la regla de docs/relevo/brief-landings.md, «se dice Con MaKo Pro»): cada fila es
 * una promesa suelta, y quien la lee no tiene al lado la columna del plan. El aviso SALE DEL PLAN, no se tipea: `soloPro` /
 * `soloProEntre` (FUNCIONES_SOLO_PRO, sin lo que todavía no se vende: el avatar), AVISO_PRO_CLOSING (TABS_SOLO_PRO), AVISO_COMUNIDAD y
 * AVISO_EQUIPO (el tope de personas de lib/topes-plan.ts). Lo mide tests/vsl-landings-dicen-el-plan.test.ts, leyendo cada fila.
 *
 * EL ORDEN cuenta una venta High Ticket de punta a punta (Martín, 14/11/2026: «acomódalo como te parezca el orden»):
 *   1. Brain: MaKo conoce tu negocio (oferta, cliente, mensaje, funnel). Va primero porque todo lo de abajo lo usa.
 *   2. Referentes: la estrategia, con el método de los que ya lo hicieron, llevado a tu negocio.
 *   3-7. El contenido que atrae: mirar qué le funciona a la competencia (Spy) y replicarlo (guion, carruseles); editar el video;
 *        los anuncios UGC con tu cara (AI Avatar).
 *   8-9. Pautar (Ads) y la landing que recibe ese tráfico (Web Generator).
 *   10-12. El lead adentro: el CRM lo trackea, las automatizaciones lo siguen y tú le contestas desde la misma app.
 *   13. Los números de todo eso, en tableros.
 *   14. Y cuando compra, la entrega: su curso y su comunidad en MaKo.
 */
export const TARJETAS_PORTADA: readonly { slug?: string; rotulo?: string; ancla?: string; titulo: string; texto: string; visual: VisualTarjeta }[] = [
  // Martín (14/11/2026): «me falta una súper importante que sea el segundo cerebro… se tiene que ver el grafo»; se llama Brain.
  // El grafo REAL (app/second-brain/Grafo.tsx) con el negocio REAL de Alex Hormozi, como lo tiene Competitor Spy (C:/dev/bancos-portada/banco-cerebro).
  // Sin landing propia: va sin `slug` (FilaFuncion no dibuja una tarjeta cuyo slug no tiene landing) y el menú «Producto» lleva a `ancla`.
  // 14/11/2026: era una GRABACIÓN de ese grafo (cerebro.webm). Martín: «no quiero que el second brain sea un video o una animación…
  // que ahí se renderice un second brain real… que se pueda agarrar un grafo, que se pueda hacer zoom». Ahora es el componente.
  // 16/11/2026: con su landing (/vsl/second-brain, como Obsidian), que reusa este mismo BrainVivo en su ventana.
  { slug: 'second-brain', rotulo: 'Second Brain', ancla: 'brain', titulo: 'Second Brain: todo tu negocio, en un solo mapa.', texto: 'Tu oferta, tu cliente ideal, tus avatares, tu mensaje y tu funnel, conectados en un grafo. MaKo lo arma con los documentos que le subes y con lo que va aprendiendo, y sus chats lo leen para contestarte sobre tu negocio. Este de acá es de verdad: arrástralo, acércalo y toca un punto.', visual: 'brain' },
  { slug: 'copywriting', rotulo: 'Referentes', titulo: 'Chatea con los referentes del mercado.', texto: `Alex Hormozi, Iman Gadzhi, Vilma Núñez y muchos referentes más del marketing y las ventas: eliges con quién hablar en el chat de MaKo y te contesta con su método, llevado a tu negocio.${soloPro('chat-referentes')}`, visual: { video: '/vsl-assets/sitio/referentes.webm', poster: '/vsl-assets/sitio/referentes.jpg' } },
  { slug: 'competitor-spy', titulo: 'Mira todo lo que publica tu competencia.', texto: 'Pegas el link de un competidor y MaKo trae sus publicaciones, sus reels, sus videos de YouTube y sus anuncios, los ordena por formato y te muestra cuáles le dieron más vistas.', visual: { video: '/vsl-assets/sitio/spy.webm', poster: '/vsl-assets/sitio/spy.jpg' } },
  { slug: 'copywriting', titulo: 'Replica y adapta un guion de la competencia con IA.', texto: `Eliges un reel o un video que le funcionó a tu competencia, tocas «Replicar» y MaKo escribe tu guion con su misma estructura, adaptado a tu oferta.${soloPro('replicar-guion')}`, visual: { video: '/vsl-assets/sitio/copywriting.webm', poster: '/vsl-assets/sitio/copywriting.jpg' } },
  // Replicar un carrusel pasa por la IA del editor de imagen (lib/editores-ia-pro.ts, carruseles/replicar): es 'ia-editores'.
  { slug: 'image', rotulo: 'Carruseles', titulo: 'Replica los carruseles que funcionan.', texto: `Eliges uno de los carruseles que mejor les funcionan a las cuentas que sigues y MaKo arma el tuyo con el mismo diseño, con tus textos y tu marca, listo para editar.${soloPro('ia-editores')}`, visual: { video: '/vsl-assets/sitio/carruseles.webm', poster: '/vsl-assets/sitio/carruseles.jpg' } },
  // El equipo de agentes es la «Edición automática»: la IA del editor de video ('ia-editores').
  { slug: 'video', titulo: 'Edita tus videos con inteligencia artificial.', texto: `Subes el clip tal cual sale del celular y un equipo de agentes de MaKo lo edita a la vista: corta las pausas, lo subtitula, propone B-roll y deja el volumen listo.${soloPro('ia-editores')}`, visual: { video: '/vsl-assets/sitio/video.webm', poster: '/vsl-assets/sitio/video.jpg' } },
  { slug: 'ai-avatar', titulo: 'Anuncios de video estilo UGC con tu cara.', texto: 'Tu avatar de IA dice tu guion en videos que se ven grabados con el celular: más anuncios para Instagram, TikTok y Meta, sin coordinar creadores ni esperar entregas.', visual: 'avatar' },
  // El Calendario de contenido salió de la portada (Martín, 16/11/2026, ~18:40 UTC: «por ahora elimina la parte del calendario de
  // contenidos… puede permanecer en la landing»): su landing /vsl/calendario sigue, con su grabación.
  // 14/11/2026 (el audio de feedback que pasó Martín): «anuncios realmente requiere su sección aparte… no lo juntaría ni con YouTube ni con
  // Instagram». Esta fila habla SÓLO de los anuncios de Meta.
  // Lo aprueba en los dos planes (Essential propone: ads.recomendaciones_dia); el piloto automático es de Pro ('piloto-redes').
  { slug: 'ads', titulo: 'Gestiona tus anuncios, tu Instagram y tu YouTube con IA.', texto: `Sube el presupuesto de lo que vende, publica tus videos en Trial Reels y cambia tus miniaturas por las que funcionan mejor. Lo apruebas con un toque o lo dejas en piloto automático${soloProEntre('piloto-redes')}.`, visual: { video: '/vsl-assets/sitio/copilot.webm', poster: '/vsl-assets/sitio/copilot.jpg' } },
  { slug: 'web-generator', titulo: 'Replica una landing de tu competencia.', texto: `Pegas el link de una landing que ya vende y MaKo la replica sección por sección, con tus textos y tu oferta, conectada a tu CRM y a tu agenda.${soloPro('replicar-landing')}`, visual: { video: '/vsl-assets/sitio/replicar.webm', poster: '/vsl-assets/sitio/replicar.jpg' } },
  // La llamada con Leila (13/11/2026): «hoy es básica; que entre al detalle de un lead y se vea todo: de dónde vino, qué hizo en la
  // página y qué % del VSL vio». El tablero, la ficha REAL (LeadSheet) de un lead de ejemplo, su Origen y la pestaña Tracking.
  // «Todo lo que hizo cada lead» no decía qué resuelve (el mismo audio): «gestiona tus leads de forma automática».
  { slug: 'crm', titulo: 'El CRM trackea tus leads de forma automática.', texto: 'Arrastras un lead a su etapa y queda anotado. Y MaKo anota solo todo lo que hace: de qué anuncio vino, cuánto vio de tu VSL, su mapa de calor, el video de su visita y cada clic.', visual: { video: '/vsl-assets/sitio/crm-ficha.webm', poster: '/vsl-assets/sitio/crm-ficha.jpg' } },
  // Martín (14/11/2026, noche): el video muestra los dos casos que pidió — por WhatsApp, «vi que agendaste la reunión, ¿confirmas?»;
  // por Instagram, el DM a quien comenta la palabra en un Reel. El texto dice esos dos.
  // Las automatizaciones son de los dos planes; el setter con IA, de Pro ('setter-ia'): el aviso va en la frase del setter.
  { slug: 'seguimiento', titulo: 'Automatiza tu WhatsApp, Instagram y email.', texto: `Confirma por WhatsApp la reunión de quien agendó y manda tu guía por DM a quien comenta la palabra clave en tu Reel. Si te contestan, el setter con IA sigue la charla y tú solo cierras.${soloPro('setter-ia')}`, visual: { video: '/vsl-assets/sitio/automations.webm', poster: '/vsl-assets/sitio/automations.jpg' } },
  { slug: 'whatsapp', titulo: 'WhatsApp, Instagram, Messenger y email, desde MaKo.', texto: 'Contestas y mandas mensajes por los cuatro desde la misma app, con la ficha del CRM de cada contacto al lado y MaKo proponiéndote qué contestar.', visual: { video: '/vsl-assets/sitio/chats.webm', poster: '/vsl-assets/sitio/chats.jpg' } },
  // Closing (16/11/2026, Martín: «tenemos un análisis de llamada que literalmente te analiza todas las llamadas, te traduce todas, te las
  // transcribe… con el método SPIN, las objeciones… sirve muchísimo para los dueños de negocios»). Después de contestar el chat, la
  // llamada. «Traduce» es que el análisis sale en español: las citas quedan en su idioma.
  // ⚠️ SIN GRABACIÓN, CON EL RECUADRO: lo que se ve de Closing lo ESCRIBE el análisis (el puntaje con sus notas y citas, las objeciones,
  // el coaching), y la grabación que iba era de una llamada INVENTADA (la de «Paola Núñez con Ana», un 7.1 que MaKo nunca escribió). Va
  // El «antes y después» de dos llamadas REALES de Mauricio (16/11/2026, ./ClosingAntesDespues.tsx, sin nombres ni frases): un
  // componente, no una grabación, así que no pasa por el login. Antes iba el recuadro (FALTA_ANALISIS).
  // (app/_components/clips-portada.ts toma sólo las filas con `video`). El análisis es de MaKo Pro: el aviso sale del plan.
  { slug: 'closing', titulo: 'Analiza todas tus llamadas de venta con IA.', texto: `Cada llamada, transcrita y puntuada con el método SPIN: MaKo marca cada objeción con su frase y su minuto, y te deja el coaching y el seguimiento por WhatsApp, en español aunque la llamada sea en otro idioma.${AVISO_PRO_CLOSING}`, visual: 'closing' },
  { slug: 'dashboard', titulo: 'Tus números, en tableros.', texto: 'Tus anuncios de Meta, tu landing, tus leads del CRM, tus pagos y tus llamadas en una sola pantalla, con tableros listos para ventas, anuncios y llamadas.', visual: 'tableros' },
  // Equipo (16/11/2026, su landing como Pipedrive): después de los números, quién los hace. El video es la sección Equipo REAL
  // (app/equipo/EquipoView.tsx) de C:/dev/bancos-portada/banco-equipo-landing (grabar.mjs): se invita a una closer y entra a la lista.
  // MaKo Essential es de una sola persona ('equipo.usuarios', lib/topes-plan.ts) y la tasa de cierre de cada closer es de Closing (Pro):
  // las dos van en la frase que lleva el aviso (AVISO_EQUIPO, del tope).
  { slug: 'equipo', titulo: 'Tu equipo de ventas, cada uno con su rol.', texto: `Invitas a tus setters y closers con su correo, eliges su rol y MaKo les manda el acceso: cada uno entra solo a lo de su trabajo, y tú ves la tasa de cierre de cada closer.${AVISO_EQUIPO}`, visual: 'equipo' },
  // Martín (14/11/2026): «elimina toda la sección de lo que entrega lo que vendiste, que quede directamente la parte de tu comunidad
  // dentro de MaKo, no tu escuela, y que se vea». Sin apartados: la entrega quedó en esta fila sola, al final.
  // 16/11/2026: con su landing (/vsl/classroom, como Circle). El curso es de los dos planes; la comunidad, de Pro ('comunidad'): el aviso
  // es el de su landing (AVISO_COMUNIDAD).
  { slug: 'classroom', rotulo: 'Curso y comunidad', titulo: 'Tu curso y tu comunidad, alojados en MaKo.', texto: `Tus alumnos entran a tu curso y a tu comunidad en la misma app con la que vendes: sus clases por módulos, lo que avanza cada uno y un lugar para preguntar y compartir.${AVISO_COMUNIDAD}`, visual: { video: '/vsl-assets/sitio/comunidad.webm', poster: '/vsl-assets/sitio/comunidad.jpg' } },
];

/**
 * Los tableros de MaKo, para el carrusel de la fila «Tus números, en tableros». Cada uno es la ENTRADA de su componente
 * (app/dashboard/disenos/Hoja*.tsx, con los datos de ejemplo de su miniatura de «Nueva hoja»), grabada: public/vsl-assets/sitio/
 * tableros/<id>.webm y su último cuadro, <id>.jpg. Martín, 13/11/2026: «que sea como un carrusel… que automáticamente se vaya
 * desplazando, pero que el usuario también pueda ir cliqueando… cada dashboard tiene su propia animación de entrada».
 */
export const TABLEROS: readonly { id: string; nombre: string }[] = [
  // Martín (14/11/2026): «no pondría para nada que el primero sea velocidad de llamada, lo pondría de última».
  { id: 'cobranza', nombre: 'Cobranza' }, { id: 'vsl-pelago', nombre: 'VSL y YouTube' },
  { id: 'hooks-ondra', nombre: 'Hooks y retención' }, { id: 'inmobiliaria-torque', nombre: 'Inmobiliaria' }, { id: 'closing', nombre: 'Closing' },
  { id: 'cold-calling-corvane', nombre: 'Cold Calling' }, { id: 'comercial-selvar', nombre: 'Comercial' }, { id: 'marketing-kestrel', nombre: 'Marketing' },
  { id: 'general-orvel', nombre: 'General' }, { id: 'operacion-moorly', nombre: 'Operación' }, { id: 'focus-pane', nombre: 'Focus' },
  { id: 'focus-lumora', nombre: 'Mi día' }, { id: 'velocidad-tend', nombre: 'Velocidad de llamada' },
];

/**
 * AI Avatar en la portada: DOS videos de verdad, cada uno con la foto de la que salió (Martín, 13/11/2026: «poner mi personaje, el
 * de la noche, que es todo feo, y que se transformó en eso… que se vea literalmente el video que hicimos, que se reproduzca ahí. Y
 * lo mismo con el de Mauricio»). Martín: su foto de noche → su reel COMPLETO (C:/dev/reel-mentores/montaje/REEL-v7.mp4). Mauricio: su foto → su
 * anuncio con IA completo, el del auto (OneDrive/Escritorio/Mauricio/TERCER VIDEO DE IA/Anuncio de IA 1 - Final.mp4; el del QUINTO
 * había salido mal: Martín, 13/11/2026). En public/vsl-assets/sitio/avatar/.
 */
export const VIDEOS_AVATAR: readonly { id: string; nombre: string }[] = [
  { id: 'martin', nombre: 'Martín' }, { id: 'mauricio', nombre: 'Mauricio' },
];

/** La landing de una función (para sus tarjetas), o undefined si ya no existe. */
export const landingDeSlug = landingDe;

/** Las apps de la tira de arriba (la de los logos de beehiiv): las conocidas de una venta High Ticket, si están conectables. */
const TIRA: readonly string[] = ['meta', 'whatsapp', 'red-instagram', 'red-facebook', 'calendly', 'calcom', 'zoom', 'fathom', 'stripe', 'mercadopago', 'youtube', 'red-tiktok'];

/**
 * El logo ORIGINAL de cada app de la tira, flotando (Martín, 12/11/2026: «hay logos que están un poco raros todavía, como el de
 * Mercado Pago»). En public/vsl-assets/logos/integraciones/: el ícono que publica su sitio, o, donde era chico (Meta, WhatsApp,
 * Zoom), su logo de simple-icons 13.21.0 en el color de su marca. Mercado Pago, desde el 16/11/2026, su logo de VERDAD (el óvalo
 * celeste con la mano blanca y el borde azul oscuro, recortado de la captura que mandó Martín): `mercadopago.svg` envuelve el mismo
 * archivo que public/logos/mercadopago.png, el del checkout y el de «Tus apps, conectadas».
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
    // Creem rechazó a MaKo (5/11/2026): no se nombra en ninguna lista del sitio (el Cerebro, 14/11).
    'creem',
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
    { valor: String(integracionesVivas().length), texto: 'integraciones con las apps que ya usas' },
    ...(plantillas ? [{ valor: plantillas, texto: 'plantillas de Copywriting, cada una con su ejemplo' }] : []),
  ];
}

/**
 * Las preguntas: las de las landings de MaKo (PREGUNTAS de scripts/landings-mako-v2.mts, que ya revisó el Cerebro contra el
 * código), menos la del bloqueo del WhatsApp, que vende el ritmo de envío como protección. La de la permanencia, con la parte
 * que no depende de la prueba gratis.
 */
// Las preguntas frecuentes viven en ./preguntas.ts: las usan la portada, /planes y TODAS las landings (Martín, 14/11/2026).
export { PREGUNTAS_SITIO } from './preguntas';

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
 * era una sola app por función, de los `reemplaza` de lib/funciones-mako.ts, y eran 8). Un trabajo sin landing lleva a su fila de la
 * tabla (Classroom era el único: desde el 16/11/2026 tiene /vsl/classroom).
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
