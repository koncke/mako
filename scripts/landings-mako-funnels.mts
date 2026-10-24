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
import { documentoDeLaLanding, seccionesDeLaLanding, subir } from './landing-mako-a-web-generator';
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
  /** No se sube con `--subir` (sí con `--incluir-pausadas`): lo que promete no está confirmado para clientes. */
  pausada?: boolean;
  /**
   * El VSL PROPIO de este funnel, cuando exista (el `src` del iframe de Panda). Mientras no esté, el hero va sin video
   * y el de la principal baja debajo con su rótulo (`heroSinVideo`).
   */
  video?: string;
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
  // Alineada con el guion de Ventas (docs/vsl/funcionalidad-automations.md, 23/10): vende el SEGUIMIENTO.
  automatizaciones: {
    h1: ['Escríbele a cada lead ', 'hasta que conteste', ', sin hacerlo a mano'],
    sub: ['Dibujas una vez cómo le escribes y MaKo hace el seguimiento.', 'Si contesta, lee qué dijo y le pasa tu calendario.', 'Sale de tu número, en tu horario, como si lo mandaras tú.'],
    bajoCta: 'Diagnóstico gratuito de tus automatizaciones',
    queEs: '¿Qué es MaKo... y por qué tu seguimiento lo necesita?',
    seoTitulo: 'MaKo — Seguimiento por WhatsApp hasta que contesten',
    seoDescripcion: 'Dibujas una vez cómo le escribes a un lead y MaKo hace el seguimiento por WhatsApp hasta que contesta. Agenda tu diagnóstico.',
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
    // Sin «calendario de publicaciones»: el Calendario de MaKo es de reuniones y tareas (Ventas, 23/10).
    sub: ['Videos, imágenes, landings y anuncios se crean y se guardan en MaKo.', 'Lo que creas queda a mano para tu próxima campaña.', 'Y sabes qué pieza trajo ventas.'],
    bajoCta: 'Diagnóstico gratuito de tu contenido',
    queEs: '¿Qué es MaKo... y por qué tu contenido lo necesita?',
    seoTitulo: 'MaKo — Todo tu contenido en un solo lugar',
    seoDescripcion: 'Crea y guarda tus videos, imágenes, landings y anuncios en un solo lugar y mide qué vende. Agenda tu diagnóstico.',
  },
  // EN PAUSA (Ventas, 23/10): AI Avatar era sólo del super admin el 17/10. No se sube (ni se pauta) hasta confirmar
  // que un cliente lo usa: `--incluir-pausadas` la sube igual.
  'avatares-ia': {
    pausada: true,
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

/** El `src` del VSL de la principal en el HTML (el de Panda): lo reemplaza el `video` propio de un funnel cuando exista. */
const VSL_PRINCIPAL = 'https://player-vz-dd4ad08b-375.tv.pandavideo.com/embed/?v=25c0684d-528e-4382-9796-d1ec74b79634&amp;color=%232F6FED';

/** Reemplaza `de` por `a` en el HTML; si no aparece exactamente `veces` veces, falla (la principal cambió). */
function cambiar(html: string, de: string, a: string, veces = 1): string {
  const n = html.split(de).length - 1;
  if (n !== veces) throw new Error(`«${de.slice(0, 60)}» aparece ${n} veces (se esperaban ${veces})`);
  return html.split(de).join(a);
}

/**
 * El hero de un funnel SIN el video de la principal (24/10/2026, Landings, antes del lanzamiento del 25/10). Las ocho
 * embebían el VSL de la principal, que habla de MaKo en general, al lado de un titular que promete el dolor de cada
 * ángulo: quien entraba por «inmobiliarias» veía al lado un video que hablaba de otra cosa, y para el test de anuncios
 * el video dominaba el primer pantallazo de las ocho por igual. Hasta que cada una tenga su VSL (docs/vsl/, `video`),
 * el hero queda con la promesa y su botón, centrado, y el VSL de la principal baja justo debajo, con un rótulo que dice
 * lo que es: «Así funciona MaKo». Cada reemplazo tiene que encontrar su texto: si la principal cambió, falla y no sube.
 */
export function heroSinVideo(h: string): string {
  const inicio = '\n      <div style="flex:1 1 auto;min-width:320px">\n        ';
  const i = h.indexOf(inicio);
  const cierre = '</iframe>\n        </div>\n      </div>';
  const j = i < 0 ? -1 : h.indexOf(cierre, i);
  if (i < 0 || j < 0 || h.indexOf(inicio, i + 1) >= 0) throw new Error('el hero de la principal cambió: no encuentro la columna del video');
  const reproductor = h.slice(i + inicio.length, j + '</iframe>\n        </div>'.length);
  if (!/<iframe [^>]*title="VSL MaKo"/.test(reproductor)) throw new Error('la columna del hero no trae el VSL');
  let out = h.slice(0, i) + h.slice(j + cierre.length);
  out = cambiar(out, '<div style="display:flex;flex-wrap:wrap;gap:40px;align-items:center">',
    '<div style="display:flex;flex-wrap:wrap;gap:40px;align-items:center;justify-content:center">');
  out = cambiar(out, '<div class="mk-hero-text" style="flex:0 1 452px;min-width:280px">',
    '<div class="mk-hero-text" style="flex:0 1 760px;min-width:280px;text-align:center">');
  // El botón (el de la columna y su copia del teléfono) se centra: con `display:flex` y un ancho tope no lo centra el texto.
  out = cambiar(out, 'width:100%;max-width:420px;padding:17px 30px;', 'width:100%;max-width:420px;margin:0 auto;padding:17px 30px;', 2);
  const fin = '\n  </section>';
  if (!out.endsWith(fin)) throw new Error('el hero de la principal cambió: no termina en </section>');
  return out + '\n  <section id="vsl-mako" style="max-width:880px;margin:0 auto;padding:48px 20px 0">'
    + '\n    <p style="margin:0 0 16px;text-align:center;font-size:14px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#5B6472">Así funciona MaKo</p>'
    + '\n    ' + reproductor
    + '\n  </section>';
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
      h = c.video ? cambiar(h, VSL_PRINCIPAL, c.video) : heroSinVideo(h);
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
  if (c.pausada && !args.includes('--incluir-pausadas') && !solo) { console.log(`${slug}: en pausa, no se sube`); continue; }
  if (!LANDINGS_MAKO[slug]) throw new Error(`${slug} no está en LANDINGS_MAKO (lib/origen-cuenta.ts)`);
  const doc = documentoDeLaLanding(seccionesDeFunnel(base, c));
  const origen = LANDINGS_MAKO[slug];
  doc.titulo = `Landing MaKo · ${origen.avatar ? 'avatar' : 'funcionalidad'}: ${slug}`;
  doc.config.sitio = { ...doc.config.sitio, seoTitulo: c.seoTitulo.slice(0, 60), seoDescripcion: c.seoDescripcion.slice(0, 160) };
  const dir = arg('--salida');
  if (dir) { writeFileSync(join(dir, `${slug}.json`), JSON.stringify(doc)); console.log(`${slug}: listo (${JSON.stringify(doc).length} bytes)`); }
  // ⚠️ Sin `--id`, `subir` INSERTA un documento nuevo (y la landing queda dos veces con el mismo slug): para cambiar una
  // que ya está arriba se pasa su documento, con `--solo` (24/10/2026: las ocho son los #33 a #40 del ws de la plataforma).
  if (args.includes('--subir')) {
    const id = arg('--id');
    if (!id && !args.includes('--nueva')) throw new Error(`${slug}: pasá --id <documento> (o --nueva si de verdad es una landing nueva)`);
    if (id && !solo) throw new Error('--id va con --solo: es el documento de UNA landing');
    await subir(doc, id, slug, false);
  }
}
