// =============================================================================
// La landing principal de MaKo apunta a High Ticket, con sus 6 funcionalidades más fuertes (29/10/2026)
// =============================================================================
// Martín (29/10/2026 ~11:15, por el Cerebro), textual: «Actualiza la landing principal, que no apunte a "VSL Funnel" que
// apunte "High ticket", como en el título. Y revisa las tarjetas de las funcionalidades, hay muchas que están de más, solo
// quiero meter las más "hot"». Y la frase que ya había decidido en la llamada del 28/10: «El mejor SaaS para ventas High
// Ticket, de punta a punta».
//
// Es un cambio del DOCUMENTO (la #32 del ws de la plataforma, la que sirve hola-mako.com: lib/editor-landing/landing-mako.ts),
// no del código: cada reemplazo tiene que encontrar su texto exacto en la fila de hoy, y si la landing cambió desde que se
// escribió esto (otra versión, otro texto), el script lo dice y no escribe nada.
//   · Todo «VSL Funnel» pasa a la venta High Ticket: el titular, la línea debajo de los botones, la historia de Mauricio,
//     «¿Qué es MaKo?», el título de la grilla, «¿Para quién es esto?» y el título SEO. Al final no queda ninguno.
//   · La grilla deja SÓLO lo que vende un negocio high ticket y anda HOY en producción, a 3 columnas: primero 6 tarjetas;
//     después de que Martín las viera, las 9 del taller del Cerebro (`TARJETAS`), y se corre otra vez sobre la publicada.
//   · Y ~11:20: «no me gusta que esté con el fondo azul»: la sección de la Beta y los precios pasa al fondo claro (la hoja).
//     Los precios completos (✓ y ✗) y la tabla comparativa son del CÓDIGO (app/vsl/PreciosLanding.tsx, app/planes/).
//
// Uso (desde la raíz del repo; `--conditions=react-server` por el publicador):
//   node --conditions=react-server --import tsx scripts/landing-principal-high-ticket.mts --salida <carpeta>
//       → SÓLO LEE: la fila de hoy, la nueva (JSON) y la vista previa (HTML) en <carpeta>.
//   node --conditions=react-server --import tsx scripts/landing-principal-high-ticket.mts --salida <carpeta> --aplicar --version <n>
//       → PRODUCCIÓN: guarda la de hoy como un documento aparte («Landing principal — antes del 29/10», sin publicar),
//         escribe la nueva en la #32 y la publica. `--version` es la que se miró en la vista previa: si es otra, no escribe.
// =============================================================================

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const CLAVE_PRINCIPAL = 'web-generator.landing-principal';
/** El nombre del respaldo (`--respaldo`): el de la primera pasada es #73 «Landing principal — antes del 29/10». */
const TITULO_RESPALDO = 'Landing principal — antes del 29/10';
/** El título para buscadores tiene un tope de 60 letras (el saneo de la configuración recorta): sin «de punta a punta». */
const SEO_TITULO = 'MaKo — El mejor SaaS para ventas High Ticket';

type Nodo = { type: string; attrs?: Record<string, unknown>; content?: Nodo[] };
type Contenido = { v: number; paginas: { id: string; titulo: string; ruta: string; doc: Nodo }[] };
type Config = { sitio?: Record<string, unknown>; diseno?: { css?: string } & Record<string, unknown> } & Record<string, unknown>;
type Fila = { id: number; titulo: string; contenido: Contenido; config: Config; version: number; carpeta: string | null; publicado: { paginas: { html: string }[] } | null; slug: string | null };

/** [sección, lo que dice hoy, lo que pasa a decir]. Cada uno tiene que aparecer UNA vez. */
const REEMPLAZOS: [string, string, string][] = [
  ['t02top', 'El mejor software para vender <span style="background:linear-gradient(transparent 55%,rgba(47,111,237,.2) 55%)">High Ticket</span> con VSL Funnel</h1>',
    'El mejor SaaS para ventas <span style="background:linear-gradient(transparent 55%,rgba(47,111,237,.2) 55%)">High Ticket</span>, de punta a punta</h1>'],
  ['t03historia', 'escalar su funnel pago, su VSL Funnel: ahí estaban', 'escalar su funnel pago: ahí estaban'],
  ['t03historia', 'No existe una pensada para un VSL Funnel: todas', 'No existe una pensada para vender High Ticket: todas'],
  ['t04quees', '¿Qué es MaKo... y por qué tu VSL Funnel lo necesita?', '¿Qué es MaKo... y por qué tu venta High Ticket lo necesita?'],
  ['t04quees', '</strong>: que tu VSL Funnel <span', '</strong>: que tu negocio High Ticket <span'],
  ['t04quees', 'Un VSL Funnel tiene muchas piezas', 'Una venta High Ticket tiene muchas piezas'],
  ['t04quees', 'En pocas palabras: tu VSL Funnel vende mucho, mucho más con MaKo.', 'En pocas palabras: tu negocio High Ticket vende mucho, mucho más con MaKo.'],
  ['t05comofunciona', '>Todo lo que tu VSL Funnel necesita, en una sola app</h2>', '>Tu equipo de ventas High Ticket, en una sola app</h2>'],
  ['t06paraquien', '>Ya corres un VSL Funnel, o vas a hacerlo en serio</div>', '>Ya vendes High Ticket, o vas a hacerlo en serio</div>'],
];
/** La línea chica debajo de los dos botones del hero (escritorio y celular): las DOS. */
const DEBAJO_DEL_BOTON: [string, string] = ['>Diagnóstico gratuito de tu VSL Funnel</p>', '>Diagnóstico gratuito de tu venta High Ticket</p>'];

/**
 * La hoja del diseño:
 *   · la grilla a 3 columnas: con 6 tarjetas, la de 4 deja una fila de 2 (las de tablet y celular no cambian);
 *   · SIN FONDO AZUL (Martín, 29/10 ~11:20: «no me gusta que esté con el fondo azul»): la sección de la Beta y los precios
 *     (#beta) vuelve al fondo claro que ya tenía en su HTML (#F5F7FA, el de las otras franjas), y el azul queda de acento
 *     en lo resaltado. Sale el «realce» que la pintaba de azul con el texto en blanco y amarillo.
 */
const CSS_HOJA: [string, string][] = [
  ['/* Grilla a 4 columnas (16 features quedan parejas).', '/* Grilla a 3 columnas (las 6 funcionalidades quedan parejas, 29/10).'],
  ['.gm-libre .mk-feature-grid { grid-template-columns: repeat(4, 1fr) !important; gap: 16px !important; }',
    '.gm-libre .mk-feature-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 16px !important; }'],
  ['/* ── Realce de la sección CTA (#beta) — fondo azul de marca + texto claro ── */\n.gm-libre #beta { background: linear-gradient(180deg,#2F6FED 0%,#2A63DE 100%) !important; border-top: 1px solid rgba(255,255,255,.12) !important; }',
    '/* ── La sección CTA (#beta), en el fondo claro de MaKo; el azul, sólo de acento (29/10) ── */\n.gm-libre #beta { background: #F5F7FA !important; border-top: 1px solid #EEF0F3 !important; }'],
  ['.gm-libre #beta h2 { margin-top: 0 !important; margin-bottom: 14px !important; color: #FFFFFF !important; }',
    '.gm-libre #beta h2 { margin-top: 0 !important; margin-bottom: 14px !important; }'],
  ['.gm-libre #beta [data-reveal]:first-child p { color: rgba(255,255,255,.88) !important; }\n', ''],
  ['.gm-libre #beta p strong { color: #FFD15C !important; font-weight: 700 !important; }', '.gm-libre #beta p strong { color: #2F6FED !important; font-weight: 700 !important; }'],
  ['font-weight: 500; color: rgba(255,255,255,.92); }', 'font-weight: 500; color: #3A4250; }'],
  ['.gm-libre .mk-beta-hl { font-weight: 700; color: #FFD15C; }', '.gm-libre .mk-beta-hl { font-weight: 700; color: #2F6FED; }'],
  ['box-shadow: 0 16px 40px -24px rgba(8,12,30,.5) !important;', 'box-shadow: 0 16px 40px -24px rgba(16,19,25,.18) !important;'],
  ['box-shadow: 0 22px 50px -24px rgba(8,12,30,.55) !important;', 'box-shadow: 0 22px 50px -24px rgba(16,19,25,.24) !important;'],
  ['font-size: 13.5px; color: rgba(255,255,255,.9); }', 'font-size: 13.5px; color: #5B6472; }'],
];

const ICONO_INSTAGRAM = '<path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M4 8a4 4 0 0 1 4 -4h8a4 4 0 0 1 4 4v8a4 4 0 0 1 -4 4h-8a4 4 0 0 1 -4 -4z"></path><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"></path><path d="M16.5 7.5v.01"></path>';
const ICONO_LANDING = '<path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M4 5a1 1 0 0 1 1 -1h14a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-14a1 1 0 0 1 -1 -1z"></path><path d="M4 8h16"></path><path d="M8 4v4"></path><path d="M9 13h6"></path><path d="M9 16h4"></path>';

const ICONO_TIJERA = '<path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M3 7a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"></path><path d="M3 17a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"></path><path d="M8.6 8.6l10.4 10.4"></path><path d="M8.6 15.4l10.4 -10.4"></path>';
const ICONO_GRUPO = '<path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M10 13a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"></path><path d="M8 21v-1a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v1"></path><path d="M15 5a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"></path><path d="M17 10h2a2 2 0 0 1 2 2v1"></path><path d="M5 5a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"></path><path d="M3 13v-1a2 2 0 0 1 2 -2h2"></path>';
const ICONO_OJO = '<path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"></path><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6"></path>';

/**
 * Las 9 tarjetas, 3 x 3 y en este orden, con el texto exacto del taller del Cerebro (29/10, después de que Martín viera las 6:
 * «Esas no son las funcionalidades más hot... ¿Y el scraper? ¿Y el Avatar con IA? ¿Y la edición?»): el inventario de lo que
 * anda HOY en producción, lo que vende en el rubro y tres jurados (docs/hallazgos-editor-landing.md, «Lo que la landing puede
 * vender»). El Avatar con IA NO entra todavía (sólo lo abre el super admin). `de` = la tarjeta de hoy que se reusa (su caja, su
 * ícono, su color); las que no existían salen de otra con su ícono, su color y su enlace.
 */
const TARJETAS: { de: string; titulo: string; bajada: string; nueva?: { feature: string; href: string; icono: string; fondo?: [string, string] } }[] = [
  { de: 'whatsapp', titulo: 'Tu setter en WhatsApp', bajada: 'Contesta a cada lead a cualquier hora, también audios, y le manda tu link para agendar.' },
  { de: 'crm', titulo: 'Tu editor de video', bajada: 'Pídele a MaKo que quite silencios y ruido, ponga subtítulos y haga los cortes.',
    nueva: { feature: 'video-editor', href: 'https://hola-mako.com/video-editor', icono: ICONO_TIJERA, fondo: ['background:#F1EDFE', 'color:#7C5CF5'] } },
  { de: 'crm', titulo: 'De tus grupos al CRM', bajada: 'Toca «Extraer»: los contactos de tus grupos de WhatsApp caen al CRM con nombre y perfil.',
    nueva: { feature: 'grupos', href: '#beta', icono: ICONO_GRUPO, fondo: ['background:#E3F6F3', 'color:#0F9B8E'] } },
  { de: 'crm', titulo: 'Tu diseñador de landings', bajada: 'Crea tu landing con IA o replica una que ya vende, y publícala en tu dominio.',
    nueva: { feature: 'landings', href: 'https://hola-mako.com/vsl/crear-landings', icono: ICONO_LANDING } },
  { de: 'crm', titulo: 'Comentan «QUIERO», reciben el DM', bajada: 'Si comentan tu palabra clave, MaKo responde en público, manda el DM y sigue la charla.',
    nueva: { feature: 'instagram', href: '#beta', icono: ICONO_INSTAGRAM, fondo: ['background:#FCE8F1', 'color:#D62976'] } },
  { de: 'closing', titulo: 'Tu analista de llamadas', bajada: 'Puntúa cada llamada de venta grabada, marca las objeciones y te deja las tareas.' },
  { de: 'ads', titulo: 'Tu media buyer con IA', bajada: 'Revisa tus anuncios de Meta cada día y te propone qué subir, pausar o prender, y por qué.' },
  { de: 'crm', titulo: 'Tu CRM se mueve solo', bajada: 'Los leads de Meta y tu agenda entran solos, cambian de etapa y su llamada queda guardada.' },
  { de: 'crm', titulo: 'Su visita, grabada', bajada: 'Mira en el CRM qué hizo ese lead en tu landing antes de llamarlo, y el mapa de calor.',
    nueva: { feature: 'visita', href: '#beta', icono: ICONO_OJO, fondo: ['background:#FDECEC', 'color:#E5484D'] } },
];

const cuenta = (s: string, buscar: string) => s.split(buscar).length - 1;
/**
 * Un reemplazo que tiene que aparecer UNA vez. Si ya no está y lo nuevo SÍ (la #32 ya publicada con este script, la v11), ya
 * se aplicó y se sigue; si no está ninguno de los dos, la landing cambió y no se toca nada.
 */
function reemplazarUnaVez(s: string, buscar: string, poner: string, donde: string, estricto = true): string {
  const n = cuenta(s, buscar);
  // Una landing de funnel (`--doc`) no tiene todo lo de la principal (su hero es propio): lo que no está, no se toca.
  if (n === 0 && (!estricto || poner === '' || cuenta(s, poner) >= 1)) return s;
  if (n !== 1) throw new Error(`${donde}: «${buscar.slice(0, 70)}» aparece ${n} veces (se esperaba 1): la landing cambió, no se toca nada`);
  return s.replace(buscar, () => poner);
}

/** La grilla de la sección: dónde empieza su contenido, dónde termina, y sus tarjetas por `data-feature`. */
function grilla(html: string): { ini: number; fin: number; tarjetas: Map<string, string> } {
  const abre = html.indexOf('<div data-reveal class="mk-feature-grid"');
  if (abre < 0 || html.indexOf('<div data-reveal class="mk-feature-grid"', abre + 1) >= 0) throw new Error('t05comofunciona: no hay UNA grilla de tarjetas');
  const ini = html.indexOf('>', abre) + 1;
  const re = /<div\b|<\/div>/g;
  re.lastIndex = ini;
  let prof = 1, fin = -1;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    prof += m[0] === '<div' ? 1 : -1;
    if (prof === 0) { fin = m.index; break; }
  }
  if (fin < 0) throw new Error('t05comofunciona: la grilla no cierra');
  const tarjetas = new Map<string, string>();
  const adentro = html.slice(ini, fin);
  for (const a of adentro.match(/<a\b[\s\S]*?<\/a>/g) ?? []) {
    const f = /data-feature="([^"]+)"/.exec(a)?.[1];
    if (!f) throw new Error('t05comofunciona: una tarjeta sin data-feature');
    tarjetas.set(f, a);
  }
  if (adentro.replace(/<a\b[\s\S]*?<\/a>/g, '').trim()) throw new Error('t05comofunciona: la grilla tiene algo más que tarjetas');
  return { ini, fin, tarjetas };
}

/** Dónde cierra el <div> cuyo contenido empieza en `ini` (contando los <div> de adentro). -1 si no cierra. */
function cierreDelDiv(html: string, ini: number): number {
  const re = /<div\b|<\/div>/g;
  re.lastIndex = ini;
  let prof = 1;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    prof += m[0] === '<div' ? 1 : -1;
    if (prof === 0) return m.index;
  }
  return -1;
}

/**
 * El mosaico de íconos de «¿Qué es MaKo?» con LOS MISMOS íconos (y colores) de las tarjetas de la grilla, 3 x 3 (el Cerebro,
 * 29/10: «que toda la venta diga lo mismo»; tenía 12, de funcionalidades que ya no están en la grilla).
 */
const RE_MOSAICO = /<div style="display:grid;grid-template-columns:repeat\([34],1fr\);gap:10px">/g;
function conMosaico(html: string, tarjetas: string[]): string {
  const abres = [...html.matchAll(RE_MOSAICO)];
  if (abres.length !== 1) throw new Error(`t04quees: hay ${abres.length} mosaicos de íconos (se esperaba 1)`);
  const ini = abres[0].index! + abres[0][0].length;
  const fin = cierreDelDiv(html, ini);
  const baldosa = fin < 0 ? null : /<div style="aspect-ratio:1;[^"]*">/.exec(html.slice(ini, fin))?.[0];
  if (!baldosa) throw new Error('t04quees: el mosaico no tiene la forma de siempre');
  const iconos = tarjetas.map((a) => {
    const svg = /<svg\b[\s\S]*?<\/svg>/.exec(a)?.[0];
    if (!svg) throw new Error('una tarjeta sin ícono');
    return svg.replace(/width="2[45]" height="2[45]"/, 'width="22" height="22"');
  });
  return html.slice(0, abres[0].index) + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">\n'
    + iconos.map((svg) => `          ${baldosa}${svg}</div>`).join('\n') + '\n        ' + html.slice(fin);
}

/** Una tarjeta con su título y su bajada (los dos <div> de sólo texto: el del ícono lleva el <svg>). */
function conTexto(a: string, titulo: string, bajada: string): string {
  const textos = [...a.matchAll(/(<div style="[^"]*">)([^<]*)(<\/div>)/g)];
  if (textos.length !== 2) throw new Error(`tarjeta ${/data-feature="([^"]+)"/.exec(a)?.[1]}: tiene ${textos.length} textos (se esperaban 2)`);
  let i = 0;
  return a.replace(/(<div style="[^"]*">)([^<]*)(<\/div>)/g, (_t, abre: string, _x: string, cierra: string) => abre + (i++ === 0 ? titulo : bajada) + cierra);
}

function nuevaTarjeta(base: string, n: NonNullable<(typeof TARJETAS)[number]['nueva']>): string {
  let a = base
    .replace(/href="[^"]*"/, `href="${n.href}"`)
    .replace(/data-feature="[^"]*"/, `data-feature="${n.feature}"`)
    .replace(/id="feat-[^"]*"/, `id="feat-${n.feature}"`)
    .replace(/(<svg\b[^>]*>)[\s\S]*?(<\/svg>)/, (_t, abre: string, cierra: string) => abre + n.icono + cierra);
  if (n.fondo) a = a.replace('background:#EAF1FE', n.fondo[0]).replace('color:#2F6FED', n.fondo[1]);
  return a;
}

/** La landing nueva a partir de la fila de hoy (puro). Tira si algo no está donde se esperaba. */
export function landingHighTicket(f: Pick<Fila, 'contenido' | 'config'>, o: { principal: boolean } = { principal: true }): { contenido: Contenido; config: Config } {
  const contenido = JSON.parse(JSON.stringify(f.contenido)) as Contenido;
  const config = JSON.parse(JSON.stringify(f.config)) as Config;
  if (contenido.paginas.length !== 1) throw new Error(`la landing tiene ${contenido.paginas.length} páginas (se esperaba 1)`);
  const secciones = new Map<string, Nodo>();
  for (const t of contenido.paginas[0].doc.content ?? []) {
    const e = t.content?.[0];
    if (t.type !== 'tarjeta' || e?.type !== 'htmlEditable' || t.content?.length !== 1) throw new Error(`la sección ${String(t.attrs?.id)} no es un «Diseño editable» solo`);
    secciones.set(String(t.attrs?.id), e);
  }
  const html = (id: string) => { const e = secciones.get(id); if (!e) throw new Error(`falta la sección ${id}`); return String(e.attrs?.html ?? ''); };
  const poner = (id: string, h: string) => { secciones.get(id)!.attrs!.html = h; };

  for (const [id, buscar, nuevo] of REEMPLAZOS) poner(id, reemplazarUnaVez(html(id), buscar, nuevo, id, o.principal));
  const top = html('t02top');
  const yaEsta = cuenta(top, DEBAJO_DEL_BOTON[0]) === 0 && cuenta(top, DEBAJO_DEL_BOTON[1]) === 2;
  if (!yaEsta && cuenta(top, DEBAJO_DEL_BOTON[0]) !== 2 && (o.principal || cuenta(top, DEBAJO_DEL_BOTON[0]) !== 0)) throw new Error(`t02top: la línea debajo del botón aparece ${cuenta(top, DEBAJO_DEL_BOTON[0])} veces (se esperaban 2)`);
  poner('t02top', top.split(DEBAJO_DEL_BOTON[0]).join(DEBAJO_DEL_BOTON[1]));

  const h5 = html('t05comofunciona');
  const g = grilla(h5);
  const nuevas = TARJETAS.map((t) => {
    const base = g.tarjetas.get(t.de);
    if (!base) throw new Error(`no está la tarjeta «${t.de}» de la que sale «${t.titulo}»`);
    return conTexto(t.nueva ? nuevaTarjeta(base, t.nueva) : base, t.titulo, t.bajada);
  });
  poner('t05comofunciona', h5.slice(0, g.ini) + '\n        ' + nuevas.join('') + '\n      ' + h5.slice(g.fin));
  poner('t04quees', conMosaico(html('t04quees'), nuevas));

  let css = String(config.diseno?.css ?? '');
  for (const [buscar, nuevo] of CSS_HOJA) css = reemplazarUnaVez(css, buscar, nuevo, 'la hoja del diseño', o.principal);
  config.diseno = { ...config.diseno, css };
  // El SEO es propio de cada landing de funnel; sólo la principal lleva el de la portada.
  if (o.principal) config.sitio = { ...config.sitio, seoTitulo: SEO_TITULO };

  const todo = JSON.stringify({ contenido, config });
  if (/VSL Funnel/i.test(todo)) throw new Error('quedó un «VSL Funnel»');
  return { contenido, config };
}

function cliente() {
  const env = Object.fromEntries(readFileSync(process.env.ENV_LOCAL ?? 'C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing/.env.local', 'utf8')
    .split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]));
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

async function main() {
  const args = process.argv.slice(2);
  const arg = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const salida = arg('--salida');
  if (!salida) throw new Error('falta --salida <carpeta>');
  mkdirSync(salida, { recursive: true });
  const db = cliente();
  const { data: wsFila } = await db.from('workspaces').select('id').eq('capa', 'superadmin').order('id').limit(1).maybeSingle();
  const ws = Number((wsFila as { id?: number } | null)?.id ?? 9);
  const { data: ajuste } = await db.from('app_settings').select('value').eq('workspace_id', ws).eq('key', CLAVE_PRINCIPAL).maybeSingle();
  // `--doc <id>`: una landing de cada funnel (#33–#40, el Cerebro 29/10: «que toda la venta diga lo mismo»), no la principal.
  const principal = !arg('--doc');
  const docId = principal ? Number((JSON.parse(String((ajuste as { value?: string } | null)?.value ?? '{}')) as { docId?: number }).docId) : Number(arg('--doc'));
  if (!docId) throw new Error(`el ws ${ws} no tiene landing principal (${CLAVE_PRINCIPAL})`);
  const { data, error } = await db.from('landing_docs').select('id, titulo, contenido, config, version, carpeta, publicado, slug').eq('workspace_id', ws).eq('id', docId).single();
  if (error || !data) throw new Error(`no pude leer la #${docId}: ${error?.message}`);
  const f = data as unknown as Fila;
  const { armarFoto } = await import('../lib/editor-landing/publicar');
  const { armarDocumento } = await import('../lib/editor-landing/pagina-publica');
  const urlBase = `https://hola-mako.site/${f.slug}`;

  // Lo de hoy: ¿el borrador es lo publicado? (si no, publicar el borrador publicaría también lo que no se ve hoy). El
  // publicador de hoy le agrega a cada sección su ancla vacía (`gm-ancla-seccion`), que la foto del 23/10 no tenía.
  const fotoHoy = armarFoto({ ...f } as never, [], null, urlBase, null);
  const sinAnclas = (h: string) => h.replace(/<span id="t-[^"]*" class="gm-ancla-seccion" aria-hidden="true"><\/span>/g, '');
  const borradorEsLoPublicado = sinAnclas(fotoHoy.paginas[0]?.html ?? '') === sinAnclas(f.publicado?.paginas[0]?.html ?? '-');

  const nueva = landingHighTicket(f, { principal });
  const foto = armarFoto({ ...f, ...nueva, version: f.version + 1 } as never, [], new Date().toISOString(), urlBase, null);
  const pagina = foto.paginas[0];
  const vista = armarDocumento({ html: pagina.html, config: nueva.config as never, css: foto.css, cssDiseno: foto.cssDiseno, fuentes: foto.fuentes, workspaceId: ws, modo: 'vista' as never, urlCanonica: urlBase, titulo: pagina.titulo, descripcion: pagina.descripcion });
  writeFileSync(join(salida, `doc-${docId}-v${f.version}.json`), JSON.stringify({ contenido: f.contenido, config: f.config }, null, 1));
  writeFileSync(join(salida, `doc-${docId}-nueva.json`), JSON.stringify(nueva, null, 1));
  writeFileSync(join(salida, 'vista-previa.html'), vista);
  console.log(JSON.stringify({ ws, docId, version: f.version, borradorEsLoPublicado, vslFunnelEnLaNueva: (JSON.stringify(foto).match(/VSL Funnel/gi) ?? []).length,
    titulo: pagina.titulo, tarjetas: TARJETAS.map((t) => t.titulo), salida }, null, 1));

  if (!args.includes('--aplicar')) return;
  if (Number(arg('--version')) !== f.version) throw new Error(`--version ${arg('--version')} no es la de hoy (${f.version}): mira la vista previa de nuevo`);
  if (!borradorEsLoPublicado) throw new Error('el borrador de hoy NO es lo publicado: publicarlo sacaría a la luz lo que no se ve. No escribo.');

  // 1) El respaldo: la de hoy, como un documento aparte y sin publicar (como «Duplicar»).
  const titulo = arg('--respaldo') ?? TITULO_RESPALDO;
  const { data: copia, error: e1 } = await db.from('landing_docs').insert({ workspace_id: ws, titulo, contenido: f.contenido, config: f.config ?? {}, carpeta: f.carpeta, creado_por_nombre: 'MaKo' }).select('id').single();
  if (e1 || !copia) throw new Error(`no pude guardar el respaldo: ${e1?.message}`);
  console.log(`respaldo: #${(copia as { id: number }).id} «${titulo}» (sin publicar)`);
  // 2) La nueva en la #32 (con la versión de hoy como guarda: si alguien la editó recién, no pisa).
  const version = f.version + 1;
  const { data: g1, error: e2 } = await db.from('landing_docs').update({ contenido: nueva.contenido, config: nueva.config, version }).eq('workspace_id', ws).eq('id', docId).eq('version', f.version).select('id');
  if (e2 || !(g1 ?? []).length) throw new Error(`no pude guardar la nueva: ${e2?.message ?? 'la versión cambió'}`);
  // 3) Publicarla (lo que hace «Publicar»: la foto, la versión publicada y su instantánea en el historial).
  const publicadoAt = new Date().toISOString();
  const fotoFinal = armarFoto({ ...f, ...nueva, version } as never, [], publicadoAt, urlBase, null);
  const { error: e3 } = await db.from('landing_docs').update({ publicado: fotoFinal, publicado_at: publicadoAt, publicado_version: version, sitio_activo: true }).eq('workspace_id', ws).eq('id', docId).eq('version', version);
  if (e3) throw new Error(`no pude publicar: ${e3.message}`);
  const { error: e4 } = await db.from('landing_doc_versiones').insert({ workspace_id: ws, doc_id: docId, titulo: f.titulo, contenido: nueva.contenido, config: nueva.config, motivo: 'Publicada', autor: 'MaKo' });
  if (e4) console.warn(`publicada, pero sin su instantánea en el historial: ${e4.message}`);
  console.log(`#${docId} v${version} publicada (${publicadoAt}). hola-mako.com la sirve cuando vence su caché (5 minutos).`);
}

if (process.argv[1]?.endsWith('landing-principal-high-ticket.mts')) main().catch((e) => { console.error(String(e?.message ?? e)); process.exit(1); });
