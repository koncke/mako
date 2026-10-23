// =============================================================================
// La landing de hola-mako.com → un documento de Web Generator («Diseño editable»)
// =============================================================================
// Pedido de Martín (23/10/2026): «Que tenga la landing principal de MaKo en el editable de web generator y que
// le pueda hacer cambios de allí y se apliquen. Revisa que no se dañe la landing».
//
// Arma el documento desde lo MISMO que dibujaba la app (app/vsl/landing-html.ts + aplicarContenidoLanding, en
// un DOM de jsdom: el contenido que antes se armaba en el navegador queda escrito una vez), lo parte en sus
// secciones (header, #top, #historia, #que-es, #como-funciona, #para-quien, #beta, #testimonios, footer) y
// deja en cada una lo que el script del diseño necesita (html-editable.ts, SCRIPT_DISENO): los carruseles con
// sus colores y tiempos, la red de MaKo, la agenda. Los enlaces y los medios de la app van ABSOLUTOS
// (https://hola-mako.com/…): la misma sección se sirve en hola-mako.com y en hola-mako.site.
//
// Uso (desde la raíz del repo; `--conditions=react-server` porque toca módulos server-only):
//   node --conditions=react-server --import tsx scripts/landing-mako-a-web-generator.mts --salida <archivo.json>
//   node --conditions=react-server --import tsx scripts/landing-mako-a-web-generator.mts --subir [--doc <id>]
// `--subir` escribe en PRODUCCIÓN (ws de la plataforma): crea el documento (o pisa el contenido de `--doc`),
// lo publica en hola-mako.site/<slug> y lo marca como la portada (app_settings `web-generator.landing-principal`).
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
import { createClient } from '@supabase/supabase-js';
import { LANDING_HTML } from '../app/vsl/landing-html';
import { cssDisenoDeLanding } from '../app/vsl/landing-contenido';
import { CONFIG_DEFAULT, type ConfigLanding } from '../lib/editor-landing/api-tipos';
import { NODO, ATTRS_TARJETA_DEFAULT, type JsonNodo, type LandingContenido } from '../lib/editor-landing/doc';
import { sanearHtmlEditable } from '../lib/editor-landing/html-editable-seguro';
import { PIXEL_META_MAKO } from '../lib/meta-pixel-mako';

const APP = 'https://hola-mako.com';
export const SLUG_PRINCIPAL = 'hola-mako';
const CALENDLY = 'https://calendly.com/koncke/asesoria';
/** Los carruseles de la landing: colores de los puntos y cada cuánto avanzan (lo que tenía Landing.tsx a mano). */
const CARRUSELES: Record<string, { on: string; off: string; ms: number }> = {
  case: { on: '#FFFFFF', off: 'rgba(255,255,255,.5)', ms: 6000 },
  qs: { on: '#2F6FED', off: 'rgba(255,255,255,.85)', ms: 5000 },
  sml: { on: '#2F6FED', off: 'rgba(255,255,255,.85)', ms: 5000 },
};

const absoluta = (v: string): string => (v.startsWith('/') && !v.startsWith('//') ? APP + v : v);

/**
 * Lo que corre ADENTRO del navegador: el contenido armado (`aplicarContenidoLanding`, empaquetado con esbuild
 * como `LC`), los atributos que lee el script del diseño y los enlaces absolutos. Devuelve las secciones.
 */
function hornear(html: string, app: string, calendly: string, carruseles: Record<string, { on: string; off: string; ms: number }>) {
  const d = document;
  const root = d.createElement('div');
  root.className = 'vsl-root';
  root.innerHTML = '<div>' + html + '</div>';
  d.body.appendChild(root);
  (window as unknown as { LC: { aplicarContenidoLanding: (r: HTMLElement) => void } }).LC.aplicarContenidoLanding(root);
  for (const k of Object.keys(carruseles)) {
    const t = root.querySelector('[data-track="' + k + '"]');
    if (!t) throw new Error('no está el carrusel ' + k);
    const c = carruseles[k];
    t.setAttribute('data-dot-on', c.on); t.setAttribute('data-dot-off', c.off); t.setAttribute('data-intervalo', String(c.ms));
  }
  const red = root.querySelector('#mk-net-canvas');
  if (!red) throw new Error('no está la red de MaKo');
  red.setAttribute('data-animacion', 'mako-red');
  const agenda = root.querySelector('#cal-embed');
  if (!agenda) throw new Error('no está la agenda');
  agenda.setAttribute('data-calendly', calendly);
  const abs = (v: string) => (v.charAt(0) === '/' && v.charAt(1) !== '/' ? app + v : v);
  root.querySelectorAll('[src], [href], [poster]').forEach((el) => {
    ['src', 'href', 'poster'].forEach((a) => { const v = el.getAttribute(a); if (v) el.setAttribute(a, abs(v)); });
  });
  root.querySelectorAll('[style*="url("]').forEach((el) => {
    el.setAttribute('style', (el.getAttribute('style') || '').replace(/url\((['"]?)(\/[^/'")][^'")]*)\1\)/g, (_t, q, p) => 'url(' + q + app + p + q + ')'));
  });
  const mk = root.querySelector('.mk-root');
  if (!mk) throw new Error('no está .mk-root');
  return Array.from(mk.children).map((el, i) => ({ id: el.id || el.tagName.toLowerCase() || 's' + i, html: el.outerHTML }));
}

/** Las secciones de la landing, armadas en Chrome sin ventana y en silencio (el DOM real, el de quien la visita). */
export async function seccionesDeLaLanding(): Promise<{ id: string; html: string }[]> {
  const paquete = await build({ entryPoints: ['app/vsl/landing-contenido.ts'], bundle: true, format: 'iife', globalName: 'LC', write: false, platform: 'browser', target: 'es2020', logLevel: 'silent' });
  const codigo = paquete.outputFiles[0].text;
  const puerto = 9700 + Math.floor(Math.random() * 200);
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new', '--mute-audio', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${puerto}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'mk-landing-'))}`, 'about:blank',
  ], { stdio: 'ignore' });
  try {
    let t: { webSocketDebuggerUrl: string } | null = null;
    for (let i = 0; i < 80 && !t; i++) {
      try { const r = await fetch(`http://127.0.0.1:${puerto}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) t = await r.json(); } catch { /* todavía no */ }
      if (!t) await new Promise((r) => setTimeout(r, 250));
    }
    if (!t) throw new Error('Chrome no contestó');
    const ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r));
    let n = 0;
    const pend = new Map<number, (v: { result?: { result?: { value?: unknown }; exceptionDetails?: unknown } }) => void>();
    ws.addEventListener('message', (e) => { const m = JSON.parse(String(e.data)); pend.get(m.id)?.(m); pend.delete(m.id); });
    const evaluar = (expression: string) => new Promise<{ value?: unknown; error?: unknown }>((res) => {
      const id = ++n;
      pend.set(id, (m) => res({ value: m.result?.result?.value, error: m.result?.exceptionDetails }));
      ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
    });
    const r1 = await evaluar(codigo);
    if (r1.error) throw new Error('no cargó el contenido: ' + JSON.stringify(r1.error).slice(0, 400));
    // tsx le pone `__name` (keepNames) a las funciones: en la página no existe.
    const r2 = await evaluar(`var __name = (f) => f; (${hornear.toString()})(${JSON.stringify(LANDING_HTML)}, ${JSON.stringify(APP)}, ${JSON.stringify(CALENDLY)}, ${JSON.stringify(CARRUSELES)})`);
    if (r2.error || !Array.isArray(r2.value)) throw new Error('no se armaron las secciones: ' + JSON.stringify(r2.error).slice(0, 600));
    ws.close();
    return r2.value as { id: string; html: string }[];
  } finally {
    chrome.kill();
  }
}

export function documentoDeLaLanding(secciones: { id: string; html: string }[]): { titulo: string; contenido: LandingContenido; config: ConfigLanding } {
  const tarjetas: JsonNodo[] = secciones.map((s, i) => {
    const html = sanearHtmlEditable(s.html);
    if (!html) throw new Error(`la sección ${s.id} quedó vacía al sanear (¿pasa el tope?)`);
    const id = `t${String(i + 1).padStart(2, '0')}${s.id.replace(/[^a-z0-9]/gi, '').slice(0, 20)}`;
    return { type: NODO.tarjeta, attrs: { ...ATTRS_TARJETA_DEFAULT, id }, content: [{ type: NODO.htmlEditable, attrs: { id: `e${i + 1}`, html } }] };
  });
  return {
    titulo: 'Landing principal de MaKo',
    contenido: { v: 1, paginas: [{ id: 'pinicio', titulo: 'Inicio', ruta: '', doc: { type: 'doc', content: tarjetas } }] },
    config: {
      ...CONFIG_DEFAULT,
      sitio: {
        ...CONFIG_DEFAULT.sitio,
        nombre: 'MaKo',
        seoTitulo: 'MaKo — Software para vender High Ticket con VSL Funnel',
        seoDescripcion: 'Una sola plataforma para todo tu negocio: del primer clic en tu anuncio al cliente que paga. Menos herramientas, más cierres.',
        indexar: true,
        metaPixelId: PIXEL_META_MAKO,
        marcaMako: false,
      },
      pagina: { ...CONFIG_DEFAULT.pagina, animaciones: false },
      diseno: { css: cssDisenoDeLanding() },
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const arg = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const esPrincipal = import.meta.url === new URL(`file:///${process.argv[1]?.replace(/\\/g, '/').replace(/^\/+/, '')}`).href;

if (esPrincipal) {
  const doc = documentoDeLaLanding(await seccionesDeLaLanding());
  const salida = arg('--salida');
  if (salida) {
    writeFileSync(salida, JSON.stringify(doc));
    const n = doc.contenido.paginas[0].doc.content.length;
    console.log(`documento: ${n} secciones, ${JSON.stringify(doc).length} bytes, hoja ${doc.config.diseno?.css.length} → ${salida}`);
  }
  if (args.includes('--subir')) await subir(doc, arg('--doc'), arg('--slug') ?? SLUG_PRINCIPAL, args.includes('--principal') || !arg('--slug'));
}

/** Crea (o pisa) el documento en el ws de la plataforma, lo publica y, si es la principal, lo marca. */
export async function subir(doc: ReturnType<typeof documentoDeLaLanding>, docIdTexto: string | undefined, slug: string, principal: boolean): Promise<number> {
  const env = Object.fromEntries(readFileSync(process.env.ENV_LOCAL ?? 'C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing/.env.local', 'utf8')
    .split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]));
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: wsFila } = await db.from('workspaces').select('id').eq('capa', 'superadmin').order('id').limit(1).maybeSingle();
  const ws = Number((wsFila as { id?: number } | null)?.id ?? 9);
  const { armarFoto } = await import('../lib/editor-landing/publicar');

  let id = docIdTexto ? Number(docIdTexto) : null;
  let version = 1;
  if (id) {
    const { data: f, error } = await db.from('landing_docs').select('id, version').eq('workspace_id', ws).eq('id', id).single();
    if (error || !f) throw new Error(`no existe el documento ${id} en el ws ${ws}`);
    version = Number(f.version) + 1;
    const { error: e2 } = await db.from('landing_docs').update({ titulo: doc.titulo, contenido: doc.contenido, config: doc.config, version }).eq('workspace_id', ws).eq('id', id);
    if (e2) throw new Error(e2.message);
  } else {
    const { data: f, error } = await db.from('landing_docs').insert({ workspace_id: ws, titulo: doc.titulo, contenido: doc.contenido, config: doc.config, creado_por_nombre: 'MaKo' }).select('id, version').single();
    if (error || !f) throw new Error(`no pude crear el documento: ${error?.message}`);
    id = Number(f.id); version = Number(f.version);
  }
  const publicadoAt = new Date().toISOString();
  const foto = armarFoto({ id, titulo: doc.titulo, contenido: doc.contenido, config: doc.config, version } as never, [], publicadoAt, `https://hola-mako.site/${slug}`, null);
  const { error: e3 } = await db.from('landing_docs').update({ publicado: foto, publicado_at: publicadoAt, publicado_version: version, slug, sitio_activo: true }).eq('workspace_id', ws).eq('id', id);
  if (e3) throw new Error(`no pude publicar: ${e3.message}`);
  if (principal) {
    const { error: e4 } = await db.from('app_settings').upsert({ workspace_id: ws, key: 'web-generator.landing-principal', value: JSON.stringify({ docId: id }) }, { onConflict: 'workspace_id,key' });
    if (e4) throw new Error(`no pude marcarla como la portada: ${e4.message}`);
  }
  console.log(`ws ${ws}: documento #${id} v${version} publicado en hola-mako.site/${slug}${principal ? ' y marcado como la portada' : ''}`);
  return id;
}
