// =============================================================================
// Las landings de cada FUNNEL de MaKo (una por funcionalidad y una por avatar), hechas desde la principal
// =============================================================================
// Pedido de Martín (23/10/2026, de sus audios): para el domingo 25/10, «todas las landings de cada funcionalidad
// o cada avatar para vender MaKo» — un dolor chico cada una —, hechas en Web Generator desde la principal, para
// el test A/B de anuncios. Cada una es la landing principal con su HERO y su «¿Qué es MaKo?» propios: el caso de
// Mauricio, la grilla, «¿Para quién es esto?», la beta y los testimonios quedan iguales (son la prueba).
//
// El copy: respuesta directa (un dolor, una promesa, el CTA de siempre) y sin prometer nada que MaKo no haga hoy.
// Lo que dice cada línea se ajusta en Web Generator (son documentos del ws de la plataforma: Martín los edita y
// los publica como cualquier landing; se sirven en hola-mako.com/vsl/<slug> y en hola-mako.site/<slug>).
// Su origen (avatar, funcionalidad) vive en lib/origen-cuenta.ts, por slug: lo lee el alta de la cuenta.
//
// Uso (después del deploy del bloque «Diseño editable»; escribe en PRODUCCIÓN con --subir):
//   node --conditions=react-server --import tsx scripts/landings-mako-funnels.mts --salida <dir>
//   node --conditions=react-server --import tsx scripts/landings-mako-funnels.mts --subir [--solo <slug>]
// Cada reemplazo tiene que encontrar su texto en la principal: si la principal cambió, el script lo dice y no sube.
// =============================================================================

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { documentoDeLaLanding, seccionesDeLaLanding, subir } from './landing-mako-a-web-generator.mts';
import { LANDINGS_MAKO } from '../lib/origen-cuenta';

type Copy = {
  /** El h1: antes, lo resaltado (el span azul del diseño) y después. */
  h1: [string, string, string];
  /** Las tres líneas del subtítulo. */
  sub: [string, string, string];
  /** La línea chica debajo del botón (sale dos veces: escritorio y celular). */
  bajoCta: string;
  /** El título de «¿Qué es MaKo?». */
  queEs: string;
  seoTitulo: string;
  seoDescripcion: string;
};

export const COPY: Record<string, Copy> = {
  'crear-landings': {
    h1: ['Tu landing de VSL lista ', 'en una tarde', ', sin programador'],
    sub: ['Le cuentas a la IA lo que vendes y la editas como un documento.', 'La publicas con tu dominio y mides quién ve tu VSL.', 'Y si ya tienes una, MaKo te dice qué arreglar.'],
    bajoCta: 'Diagnóstico gratuito de tu landing',
    queEs: '¿Qué es MaKo... y por qué tu landing lo necesita?',
    seoTitulo: 'MaKo — Tu landing de VSL, sin programador',
    seoDescripcion: 'Crea, publica y mide tu landing de VSL con IA, y sabe qué arreglar para que convierta. Agenda tu diagnóstico gratuito.',
  },
  automatizaciones: {
    h1: ['Responde cada DM y WhatsApp ', 'en segundos', ', sin ManyChat'],
    sub: ['Flujos que contestan, califican y agendan solos.', 'Cada conversación queda en la ficha del lead, en tu CRM.', 'Tú entras cuando el lead está listo para comprar.'],
    bajoCta: 'Diagnóstico gratuito de tus automatizaciones',
    queEs: '¿Qué es MaKo... y por qué tus chats lo necesitan?',
    seoTitulo: 'MaKo — Automatiza tus DMs y tu WhatsApp',
    seoDescripcion: 'Flujos que responden, califican y agendan a tus leads en Instagram y WhatsApp, conectados a tu CRM. Agenda tu diagnóstico.',
  },
  dashboards: {
    h1: ['Del anuncio al cobro, ', 'en un solo dashboard', ''],
    sub: ['Meta, tu landing, tus llamadas y tus cobros, juntos.', 'Ves qué anuncio trae clientes que pagan, no sólo clics.', 'Y MaKo te dice qué mover hoy.'],
    bajoCta: 'Diagnóstico gratuito de tus números',
    queEs: '¿Qué es MaKo... y por qué tus números lo necesitan?',
    seoTitulo: 'MaKo — Del anuncio al cobro, en un dashboard',
    seoDescripcion: 'Tus anuncios, tu landing, tus llamadas y tus cobros en una pantalla, y qué mover hoy para vender más. Agenda tu diagnóstico.',
  },
  contenidos: {
    h1: ['Todo tu contenido, ', 'en un solo lugar', ''],
    sub: ['Videos, imágenes, landings y anuncios se crean y se guardan en MaKo.', 'Planeas tus publicaciones en un calendario.', 'Y sabes qué pieza trajo ventas.'],
    bajoCta: 'Diagnóstico gratuito de tu contenido',
    queEs: '¿Qué es MaKo... y por qué tu contenido lo necesita?',
    seoTitulo: 'MaKo — Todo tu contenido en un solo lugar',
    seoDescripcion: 'Crea y guarda tus videos, imágenes, landings y anuncios, planea tus publicaciones y mide qué vende. Agenda tu diagnóstico.',
  },
  'avatares-ia': {
    h1: ['Anuncios en video con ', 'tu avatar de IA', ', sin grabarte cada vez'],
    sub: ['Escribes el guion y MaKo arma el video.', 'Lo editas ahí mismo y lo usas en tus anuncios.', 'Más creativos para testear, sin horas de grabación.'],
    bajoCta: 'Diagnóstico gratuito de tus creativos',
    queEs: '¿Qué es MaKo... y por qué tus anuncios lo necesitan?',
    seoTitulo: 'MaKo — Anuncios con tu avatar de IA',
    seoDescripcion: 'Crea anuncios en video con tu avatar de IA, edítalos en MaKo y testea más creativos sin grabarte cada vez. Agenda tu diagnóstico.',
  },
  inmobiliarias: {
    h1: ['Más cierres para tu ', 'inmobiliaria', ', sin perder un interesado'],
    sub: ['Tus anuncios, tu WhatsApp y tus asesores en una sola plataforma.', 'Cada interesado recibe respuesta y seguimiento al instante.', 'Y ves qué campaña trae las operaciones que cierran.'],
    bajoCta: 'Diagnóstico gratuito de tu embudo inmobiliario',
    queEs: '¿Qué es MaKo... y por qué tu inmobiliaria lo necesita?',
    seoTitulo: 'MaKo para inmobiliarias',
    seoDescripcion: 'Anuncios, WhatsApp y asesores en una sola plataforma: respuesta al instante a cada interesado y qué campaña cierra. Agenda tu diagnóstico.',
  },
  infoproductores: {
    h1: ['Sal de Skool y Hotmart: ', 'tu curso, tu comunidad y tus ventas', ' en MaKo'],
    sub: ['Tus alumnos entran a tu curso y a tu comunidad en un solo lugar.', 'Cobras con tu Stripe o tu Mercado Pago.', 'Y tu funnel de venta vive al lado de tu curso.'],
    bajoCta: 'Diagnóstico gratuito de tu migración',
    queEs: '¿Qué es MaKo... y por qué tu infoproducto lo necesita?',
    seoTitulo: 'MaKo para infoproductores',
    seoDescripcion: 'Tu curso, tu comunidad, tus cobros y tu funnel de venta en una sola plataforma. Deja Skool y Hotmart. Agenda tu diagnóstico.',
  },
  coaches: {
    h1: ['Llena tu agenda de ', 'llamadas que cierran', ', no de curiosos'],
    sub: ['Tus anuncios, tu VSL y tu agenda, conectados.', 'Sabes quién vio tu video antes de la llamada.', 'Y MaKo te dice qué objeción trabajar para cerrar más.'],
    bajoCta: 'Diagnóstico gratuito de tu funnel de coaching',
    queEs: '¿Qué es MaKo... y por qué tu coaching lo necesita?',
    seoTitulo: 'MaKo para coaches',
    seoDescripcion: 'Anuncios, VSL y agenda conectados: sabes quién vio tu video y qué objeción trabajar para cerrar más. Agenda tu diagnóstico.',
  },
};

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Reemplaza `de` por `a` en el HTML; si no aparece exactamente `veces` veces, falla (la principal cambió). */
function cambiar(html: string, de: string, a: string, veces = 1): string {
  const n = html.split(de).length - 1;
  if (n !== veces) throw new Error(`«${de.slice(0, 60)}» aparece ${n} veces (se esperaban ${veces})`);
  return html.split(de).join(a);
}

/** Las secciones de la principal con el hero y el «¿Qué es MaKo?» de este funnel. */
export function seccionesDeFunnel(base: { id: string; html: string }[], c: Copy): { id: string; html: string }[] {
  return base.map((s) => {
    let h = s.html;
    if (s.id === 'top') {
      h = cambiar(h, 'El mejor software para vender ', esc(c.h1[0]));
      h = cambiar(h, '>High Ticket<', '>' + esc(c.h1[1]) + '<');
      h = cambiar(h, ' con VSL Funnel</h1>', esc(c.h1[2]) + '</h1>');
      h = cambiar(h, 'Una sola plataforma para todo tu negocio: ', esc(c.sub[0]) + ' ');
      h = cambiar(h, 'Del primer clic en tu anuncio al cliente que paga. ', esc(c.sub[1]) + ' ');
      h = cambiar(h, 'Menos herramientas, menos adivinanza, más cierres.', esc(c.sub[2]));
      h = cambiar(h, 'Diagnóstico gratuito de tu VSL Funnel', esc(c.bajoCta), 2);
    }
    if (s.id === 'que-es') h = cambiar(h, '¿Qué es MaKo... y por qué tu VSL Funnel lo necesita?', esc(c.queEs));
    return { ...s, html: h };
  });
}

const args = process.argv.slice(2);
const arg = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const solo = arg('--solo');

const base = await seccionesDeLaLanding();
for (const [slug, c] of Object.entries(COPY)) {
  if (solo && slug !== solo) continue;
  if (!LANDINGS_MAKO[slug]) throw new Error(`${slug} no está en LANDINGS_MAKO (lib/origen-cuenta.ts)`);
  const doc = documentoDeLaLanding(seccionesDeFunnel(base, c));
  const origen = LANDINGS_MAKO[slug];
  doc.titulo = `Landing MaKo · ${origen.avatar ? 'avatar' : 'funcionalidad'}: ${slug}`;
  doc.config.sitio = { ...doc.config.sitio, seoTitulo: c.seoTitulo.slice(0, 60), seoDescripcion: c.seoDescripcion.slice(0, 160) };
  const dir = arg('--salida');
  if (dir) { writeFileSync(join(dir, `${slug}.json`), JSON.stringify(doc)); console.log(`${slug}: listo (${JSON.stringify(doc).length} bytes)`); }
  if (args.includes('--subir')) await subir(doc, undefined, slug, false);
}
