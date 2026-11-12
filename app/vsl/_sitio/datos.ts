// =============================================================================
// Lo que dice el sitio de MaKo (la vista previa de /vsl/sitio y /vsl/comparaciones), en un solo lugar
// =============================================================================
// Referencia copiada: la portada de beehiiv (https://www.beehiiv.com/), su barra con los menús «Product» y «Solutions» y
// https://www.beehiiv.com/comparisons, leídas el 12/11/2026. El diseño (valores medidos) vive en ./estilos.ts y en
// docs/diseno/sitio-beehiiv.md; aquí va SÓLO el contenido, y casi todo sale de algo que ya existe:
//   · las funciones del menú «Producto» son las 19 landings de app/vsl/_competencia/registro.ts (su nombre, su ícono y su
//     ruta). Una landing nueva que no esté en ningún grupo entra sola en la columna de su lado (`menuProducto`);
//   · «Industrias» son los avatares de lib/origen-cuenta.ts (AVATARES), cada uno a su landing /vsl/mako-<avatar>, con la
//     bajada que esa landing dice en su `seo` (scripts/landings-mako-v2-funnels.mts);
//   · la tabla de comparaciones sale de los `reemplaza` de lib/funciones-mako.ts: si una función deja de reemplazar algo
//     (o vuelve Lead Magnet, que está archivado), la tabla y el número del titular cambian solos;
//   · las integraciones son las del catálogo (lib/integraciones-catalogo.ts) que un negocio ve y puede conectar hoy;
//   · los números se CUENTAN aquí abajo; ninguno se escribe a mano.
// Las agrupaciones (qué landing va en qué columna) siguen las familias de la barra de la app (app/_components/nav.ts:
// Today, Sales, Marketing, Create) y lo que dice cada landing. Lo que no tiene un lugar en la referencia no se inventa.
// Puro y sin `server-only`: lo leen las páginas y la foto de comparación.
// =============================================================================

import { LANDINGS_COMPETENCIA } from '../_competencia/registro';
import { CASO } from '../_competencia/marca';
import type { LandingCompetencia } from '../_competencia/tipos';
import { AVATARES, type AvatarOrigen } from '@/lib/origen-cuenta';
import { funcionesMako } from '@/lib/funciones-mako';
import { FAMILIAS } from '@/app/_components/nav';
import { DEFS, defsVisibles, ordenCategoria, type Def } from '@/lib/integraciones-catalogo';
import { SIN_USO_TODAVIA, tarjetaDeRed, type RedConTarjeta } from '@/lib/zernio-redes';
import { CATALOGO_GRABADORES } from '@/lib/grabadores/catalogo';

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
const GRANDES: readonly { slug: string; bajada: string; familia: string | null }[] = [
  { slug: 'mako', bajada: 'El chat que conoce tu negocio', familia: null },
  { slug: 'crm', bajada: 'Se llena y se mueve solo', familia: 'Sales' },
  { slug: 'seguimiento', bajada: 'Tu setter con IA', familia: 'Sales' },
  { slug: 'ads', bajada: 'Tu estrategia y tus anuncios', familia: 'Marketing' },
];

/**
 * Las columnas de «Producto» (las de beehiiv: Publish, Grow, Earn, Analyze, Connect): las familias de la barra de la app, con
 * las landings que caen en cada una. Ads Analyst (las hojas de tus anuncios) y Funnels (lo que Meta aprende de tu CRM) van en
 * Marketing porque hablan de tus anuncios; Cobranza (el plan de cuotas del CRM) y Agenda (Calendar) en Sales.
 */
const COLUMNAS: readonly { rotulo: string; slugs: readonly string[] }[] = [
  { rotulo: 'Today', slugs: ['dashboard', 'whatsapp', 'prioridades', 'email'] },
  { rotulo: 'Sales', slugs: ['agenda', 'cobranza'] },
  { rotulo: 'Marketing', slugs: ['offer', 'competitor-spy', 'script', 'funnel'] },
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

/** Las columnas del pie (las de beehiiv: Company, Product, Solutions, Resources, Connect): MaKo, sus familias e Industrias. */
export function columnasDelPie(): { titulo: string; links: { nombre: string; href: string }[] }[] {
  const m = menuProducto();
  const grandes = GRANDES.flatMap((g) => { const l = landingDe(g.slug); return l ? [{ familia: g.familia, item: itemDe(l) }] : []; });
  const ops = grandes.find((g) => g.familia == null)?.item;
  return [
    { titulo: 'MaKo', links: [...(ops ? [{ nombre: ops.nombre, href: ops.href }] : []), { nombre: 'Precios', href: RUTA_PRECIOS }, { nombre: 'Comparaciones', href: RUTA_COMPARACIONES }, { nombre: 'Entrar', href: RUTA_ENTRAR }] },
    ...m.columnas.map((c) => ({
      titulo: c.rotulo,
      links: [...grandes.filter((g) => g.familia === c.rotulo).map((g) => g.item), ...c.items].map((i) => ({ nombre: i.nombre, href: i.href })),
    })),
    { titulo: 'Industrias', links: INDUSTRIAS.map((i) => ({ nombre: i.nombre, href: i.href })) },
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
 * Las seis tarjetas de «Everything you need…» (las seis de beehiiv, en filas de 2 a 1 y de 1 a 2). El texto es una frase de
 * su landing (su hero o su metaDesc), y el visual el que ya tiene esa landing:
 *   · crm         → «La ficha se crea cuando entra el lead, se mueve de etapa cuando agenda…» (hero). Su visual de portada se
 *                   dibuja en un canvas; va el tablero de etapas de app/vsl/_detalle/feature-visuals.ts (`kanban` de pipeline).
 *   · seguimiento → su metaDesc. · ads → su hero. · video → su hero. · web-generator → su metaDesc. · whatsapp → su metaDesc.
 */
export const TARJETAS_PORTADA: readonly { slug: string; texto: string; visual: 'hero' | { grupo: string; tipo: string } }[] = [
  { slug: 'crm', texto: 'La ficha se crea cuando entra el lead y se mueve de etapa cuando agenda.', visual: { grupo: 'pipeline', tipo: 'kanban' } },
  { slug: 'seguimiento', texto: 'Un agente que contesta por WhatsApp, Instagram, Messenger y email.', visual: 'hero' },
  { slug: 'ads', texto: 'Cada día mira tus anuncios de Meta y te propone qué subir, pausar o probar.', visual: 'hero' },
  { slug: 'video', texto: 'Un editor como CapCut con MaKo al lado: quita las pausas y subtitula.', visual: 'hero' },
  { slug: 'web-generator', texto: 'Describes la landing que necesitas y MaKo la arma por secciones.', visual: 'hero' },
  { slug: 'whatsapp', texto: 'Una conversación por contacto, con su ficha del CRM al lado.', visual: 'hero' },
];

/** La landing de una función (para sus tarjetas), o undefined si ya no existe. */
export const landingDeSlug = landingDe;

/** Las apps de la tira de arriba (la de los logos de beehiiv): las conocidas de una venta High Ticket, si están conectables. */
const TIRA: readonly string[] = ['meta', 'whatsapp', 'red-instagram', 'red-facebook', 'calendly', 'calcom', 'zoom', 'fathom', 'stripe', 'mercadopago', 'youtube', 'red-tiktok'];

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
    { valor: String(filasDeComparacion().length), texto: 'apps que MaKo reemplaza' },
    { valor: String(integracionesVivas().length), texto: 'integraciones con las apps que ya usas' },
    ...(plantillas ? [{ valor: plantillas, texto: 'plantillas de Copywriting, cada una con su ejemplo' }] : []),
  ];
}

/**
 * Las preguntas: las de las landings de MaKo (PREGUNTAS de scripts/landings-mako-v2.mts, que ya revisó el Cerebro contra el
 * código), menos la del bloqueo del WhatsApp, que vende el ritmo de envío como protección. La de la permanencia, con la parte
 * que no depende de la prueba gratis.
 */
export const PREGUNTAS_SITIO: readonly { p: string; r: string }[] = [
  { p: '¿Necesito saber de tecnología o escribir prompts?', r: 'No. Le cuentas a MaKo qué vendes y a quién, y arma tu oferta, tus páginas y tus mensajes. Tú revisas y apruebas.' },
  { p: '¿La IA cierra la venta?', r: 'No. MaKo contesta, pregunta lo justo y agenda la llamada. La venta la cierras tú, y después MaKo te dice qué pasó en cada llamada.' },
  { p: '¿Qué pasa si la IA se equivoca?', r: 'Todas las conversaciones quedan en tu bandeja y puedes tomar cualquiera cuando quieras. Tú decides qué mensajes salen solos.' },
  { p: '¿Puedo usar mi número de WhatsApp actual?', r: 'Sí. Lo conectas escaneando un código QR, como WhatsApp Web, y sigues usando tu teléfono como siempre.' },
  { p: '¿Cuánto me sale la IA?', r: 'Lo que consuma tu clave de Claude, ChatGPT o Gemini, pagado directo a tu proveedor. MaKo no le pone recargo. Con Gemini puedes empezar gratis, con un tope por día.' },
  { p: '¿Mis datos entrenan a la IA?', r: 'MaKo no entrena modelos con tus datos. La IA es la tuya: lo que pide pasa por tu propia cuenta de Claude, ChatGPT o Gemini.' },
  { p: '¿En qué se diferencia de ChatGPT?', r: 'ChatGPT conversa contigo. MaKo trabaja dentro de tu negocio: tu CRM, tu WhatsApp, tus anuncios y tu agenda, con tu propia IA.' },
  { p: '¿Hay permanencia?', r: 'No. Pasas a otro plan o te das de baja cuando quieras.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Comparaciones: MaKo contra el stack que reemplaza
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cada función con `reemplaza` en lib/funciones-mako.ts: el trabajo (la fila), y la landing de MaKo de esa función (la tarjeta
 * «MaKo vs …»). Classroom no tiene landing todavía: su tarjeta lleva a su fila de la tabla. Lead Magnet está archivado
 * (lib/lead-magnets/archivado.ts) y por eso hoy no sale de `funcionesMako()`; si vuelve, ya tiene su trabajo.
 */
const TRABAJO: Readonly<Record<string, { trabajo: string; landing: string | null }>> = {
  graphics: { trabajo: 'Dashboards', landing: 'dashboard' },
  chats: { trabajo: 'Chats', landing: 'whatsapp' },
  'customer-success': { trabajo: 'Cursos y comunidad', landing: null },
  'landing-writer': { trabajo: 'Páginas de venta', landing: 'web-generator' },
  'ads-manager': { trabajo: 'Anuncios', landing: 'ads' },
  'video-editor': { trabajo: 'Video', landing: 'video' },
  'image-editor': { trabajo: 'Imágenes', landing: 'image' },
  copywriter: { trabajo: 'Textos', landing: 'copywriting' },
  'lead-magnet-generator': { trabajo: 'Lead magnets', landing: null },
};

export type FilaComparacion = {
  key: string;
  familia: string;
  /** El trabajo («Dashboards»): la primera columna. */
  trabajo: string;
  /** La app que hoy hace ese trabajo, tal como la nombra lib/funciones-mako.ts. */
  app: string;
  /** La función de MaKo que lo hace. */
  funcion: string;
  /** Su landing, o el ancla de su fila si no tiene. */
  href: string;
  ancla: string;
};

/** Las filas de la tabla, en el orden de las familias de la barra de la app. Sólo las funciones que ve un negocio. */
export function filasDeComparacion(): FilaComparacion[] {
  const orden = FAMILIAS.map((f) => f.label);
  const lugar = (fam: string) => { const i = orden.indexOf(fam); return i < 0 ? orden.length : i; };
  return funcionesMako()
    .filter((f) => !!f.reemplaza && !f.soloSuperAdmin)
    .map((f) => {
      const t = TRABAJO[f.key];
      const ancla = `fila-${f.key}`;
      return { key: f.key, familia: f.familia, trabajo: t?.trabajo ?? f.nombre, app: f.reemplaza as string, funcion: f.nombre, href: t?.landing ? `/vsl/${t.landing}` : `#${ancla}`, ancla };
    })
    .sort((a, b) => lugar(a.familia) - lugar(b.familia));
}

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
