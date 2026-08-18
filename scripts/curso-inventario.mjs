// =============================================================================
// curso-inventario — qué tiene CADA curso en la fuente, contra lo que tenemos
// =============================================================================
// Recorre los cursos uno por uno en el Chrome dedicado y le pregunta a la API de la
// plataforma qué hay de verdad: lecciones, módulos (los TRES niveles) y RECURSOS.
//
// Existe porque el pipeline vino contando de menos y nadie lo sabía. Dos agujeros
// medidos el 18/8/2026:
//
//   · `curso-plan-vip.mjs` no lee `resources` en ninguna línea. Todo curso enumerado
//     con él nace con `pdfs: []`, tenga el material que tenga.
//   · `curso-recursos-vip.mjs` exige una pestaña `/watch`, que es del área `/vip/`.
//     De 31 planes, 26 son de `/curso/`: para el 84% nunca pudo correr.
//
// Resultado: de 23 cursos del portal, 19 tienen CERO recursos. «Hackeando la Edición»
// tiene 28 en la fuente (16 .cube, 4 .txt, 4 .png, 3 .pdf, 1 .zip) y ninguno bajado.
//
// ⚠️ ES SECUENCIAL A PROPÓSITO. Hay UN Chrome con UNA sesión y CDP en un solo puerto:
// dos capturas a la vez se pisan la pestaña. No se paraleliza.
//
// ⚠️ RECORRE EL ÁRBOL HASTA EL FONDO. `modules` tiene tres niveles y 16 de los 28
// recursos de Guille cuelgan de NIETOS. Contar los hijos de un módulo contestaba
// «vacío» sobre un módulo lleno — el error que originó todo esto.
//
// No baja nada: solo mide. Escribe `C:\cursos\<slug>\inventario.json` por curso y una
// tabla al final.
//
//   node scripts/curso-inventario.mjs
//   node scripts/curso-inventario.mjs --solo hackeando-la-edicion
//   node scripts/curso-inventario.mjs --espera 12
// =============================================================================
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};

const PORT = Number(arg('port', 9333));
const RAIZ = arg('raiz', 'C:\\cursos');
const SOLO = arg('solo', '');
const ESPERA = Number(arg('espera', 10)) * 1000;   // tras navegar, antes de clickear
const CAPTURA = Number(arg('captura', 12)) * 1000; // tras desplegar, para que lleguen

// Los endpoints que importan, y qué son. El área /curso/ y el área /vip/ usan nombres
// distintos para lo mismo — están los dos porque el portal tiene cursos de las dos.
const CLAVES = [
  ['recursos', /\/rest\/v1\/(course_resources|vip_course_resources)\?/],
  ['modulos', /\/rest\/v1\/modules\?/],
  ['curso', /\/rest\/v1\/courses\?/],
  ['lecciones', /\/rest\/v1\/rpc\/get_(course|vip)_lessons_secure/],
];

class Cdp {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pend = new Map(); this.oye = [];
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pend.has(m.id)) {
        const { ok, no } = this.pend.get(m.id);
        this.pend.delete(m.id);
        m.error ? no(new Error(m.error.message)) : ok(m.result);
      } else if (m.method) { for (const f of this.oye) f(m); }
    });
  }
  enviar(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((ok, no) => {
      this.pend.set(id, { ok, no });
      setTimeout(() => this.pend.has(id) && (this.pend.delete(id), no(new Error(`timeout ${method}`))), 25000);
    });
  }
  al(f) { this.oye.push(f); }
}

// Abre todo lo que parezca módulo/submódulo. Varias rondas: abrir uno revela otros.
const ABRIR = `
(() => {
  let n = 0;
  for (const el of document.querySelectorAll('button, summary, [role="button"], [aria-expanded]')) {
    if (el.getAttribute('aria-expanded') === 'true') continue;
    const t = (el.textContent || '').slice(0, 90);
    const cerrado = el.getAttribute('aria-expanded') === 'false' || el.tagName === 'SUMMARY';
    if (!cerrado && !/m[oó]dulo|bonus|fase|secci[oó]n|recurso|material|lut|clase|semana/i.test(t)) continue;
    try { el.click(); n++; } catch (e) {}
  }
  return n;
})();
`;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Los cursos a recorrer: slug del portal + su página de origen, del plan.json. */
function catalogo() {
  const dirApp = join(process.cwd(), 'app', 'conocimientos');
  const slugs = readdirSync(dirApp)
    .filter((f) => /^curso-.*\.ts$/.test(f))
    .map((f) => f.replace(/^curso-/, '').replace(/\.ts$/, ''));
  const out = [];
  for (const slug of slugs) {
    // El plan puede estar con el slug o con el nombre largo «Curso - Autor».
    const cands = existsSync(RAIZ) ? readdirSync(RAIZ) : [];
    let pagina = '';
    for (const d of [slug, ...cands]) {
      const p = join(RAIZ, d, 'plan.json');
      if (!existsSync(p)) continue;
      try {
        const j = JSON.parse(readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
        if (j.slug === slug && j.pagina) { pagina = j.pagina; break; }
      } catch { /* plan roto: se ignora, queda sin página */ }
    }
    out.push({ slug, pagina });
  }
  return out;
}

/** Recorre `parent_module_id` hasta el fondo y devuelve el subárbol de cada raíz. */
function arbol(modulos, porModulo) {
  const hijos = new Map();
  for (const m of modulos) {
    const p = m.parent_module_id ?? m.legacy_parent_module_id ?? null;
    if (!p) continue;
    if (!hijos.has(p)) hijos.set(p, []);
    hijos.get(p).push(m);
  }
  const subtotal = (id, visto = new Set()) => {
    if (visto.has(id)) return 0;            // un ciclo en los ids colgaría el recorrido
    visto.add(id);
    let n = porModulo.get(id) ?? 0;
    for (const h of hijos.get(id) ?? []) n += subtotal(h.id, visto);
    return n;
  };
  const raices = modulos.filter((m) => !(m.parent_module_id ?? m.legacy_parent_module_id));
  return { raices, hijos, subtotal, niveles: profundidad(raices, hijos) };
}

function profundidad(raices, hijos) {
  let max = 1;
  const baja = (id, d, visto = new Set()) => {
    if (visto.has(id)) return;
    visto.add(id);
    if (d > max) max = d;
    for (const h of hijos.get(id) ?? []) baja(h.id, d + 1, visto);
  };
  for (const r of raices) baja(r.id, 1);
  return max;
}

const main = async () => {
  let lista;
  try { lista = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json()); }
  catch {
    console.error(`\n  ✖ No hay CDP en 127.0.0.1:${PORT}. Corré: powershell -File scripts/curso-perfil.ps1\n`);
    process.exit(1);
  }
  const paginas = lista.filter((t) => t.type === 'page' && !t.url.startsWith('devtools://'));
  const tab = paginas.find((t) => t.url.includes('cursoselite')) ?? paginas[0];
  if (!tab) { console.error('  ✖ No hay ninguna pestaña.'); process.exit(1); }

  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((ok, no) => {
    ws.addEventListener('open', ok, { once: true });
    ws.addEventListener('error', () => no(new Error('no pude conectar a CDP')), { once: true });
  });
  const cdp = new Cdp(ws);

  let capturando = null; // Map<requestId, {clave,url}>
  cdp.al((m) => {
    if (m.method !== 'Network.responseReceived' || !capturando) return;
    const url = m.params.response?.url ?? '';
    const clave = CLAVES.find(([, re]) => re.test(url))?.[0];
    if (clave) capturando.set(m.params.requestId, { clave, url });
  });

  await cdp.enviar('Network.enable', { maxTotalBufferSize: 96 * 1024 * 1024, maxResourceBufferSize: 48 * 1024 * 1024 });
  await cdp.enviar('Page.enable');
  await cdp.enviar('Runtime.enable');

  const cursos = catalogo().filter((c) => !SOLO || c.slug === SOLO);
  const filas = [];

  for (const [i, c] of cursos.entries()) {
    const cab = `[${i + 1}/${cursos.length}] ${c.slug}`;
    if (!c.pagina || !/cursoselite/.test(c.pagina)) {
      console.log(`${cab} — SALTEADO (${c.pagina ? 'otra plataforma' : 'sin página en el plan'})`);
      filas.push({ slug: c.slug, salteado: c.pagina || 'sin plan.json' });
      continue;
    }
    console.log(`${cab} → ${c.pagina}`);
    capturando = new Map();
    try {
      await cdp.enviar('Page.navigate', { url: c.pagina });
      await dormir(ESPERA);
      for (let r = 0; r < 4; r++) {
        const ev = await cdp.enviar('Runtime.evaluate', { expression: ABRIR, returnByValue: true }).catch(() => null);
        if (!Number(ev?.result?.value ?? 0)) break;
        await dormir(2200);
      }
      await dormir(CAPTURA);
    } catch (e) {
      console.log(`      ✖ ${e.message}`);
    }

    // Los cuerpos, DESPUÉS: pedirlos en el evento devuelve «No resource with given
    // identifier found» porque la respuesta todavía se está recibiendo.
    const datos = {};
    for (const [rid, info] of capturando) {
      let body = '';
      try {
        const r = await cdp.enviar('Network.getResponseBody', { requestId: rid });
        body = r.base64Encoded ? Buffer.from(r.body, 'base64').toString('utf8') : r.body;
      } catch { continue; }
      let j; try { j = JSON.parse(body); } catch { continue; }
      if (!Array.isArray(j) || !j.length) continue;
      // Puede haber varias respuestas de la misma clave (reintentos, paginado): gana la
      // más grande, que es la completa. Ojo: acá «más grande» sí es «más correcta»
      // porque son la MISMA consulta, no dos consultas distintas.
      if (!datos[info.clave] || j.length > datos[info.clave].length) datos[info.clave] = j;
    }
    capturando = null;

    const recursos = datos.recursos ?? [];
    const modulos = datos.modulos ?? [];
    const lecciones = datos.lecciones ?? [];
    const porModulo = new Map();
    for (const r of recursos) porModulo.set(r.module_id, (porModulo.get(r.module_id) ?? 0) + 1);
    const { raices, subtotal, niveles } = modulos.length ? arbol(modulos, porModulo) : { raices: [], subtotal: () => 0, niveles: 0 };

    const tipos = {};
    for (const r of recursos) tipos[r.file_type ?? '?'] = (tipos[r.file_type ?? '?'] ?? 0) + 1;

    const inv = {
      slug: c.slug, pagina: c.pagina, cuando: new Date().toISOString(),
      lecciones: lecciones.length,
      recursos: recursos.length,
      tipos,
      modulos: { total: modulos.length, raices: raices.length, niveles },
      // El árbol con el subtotal de cada raíz: es lo que hace visible que un módulo con
      // 0 propios tenga 16 abajo.
      arbolRaices: raices.map((m) => ({ titulo: m.title, propios: porModulo.get(m.id) ?? 0, subarbol: subtotal(m.id) })),
      recursosDetalle: recursos.map((r) => ({ titulo: r.title, tipo: r.file_type, bytes: r.file_size, modulo: r.module_id })),
    };
    const dir = join(RAIZ, c.slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'inventario.json'), JSON.stringify(inv, null, 1), 'utf8');

    console.log(`      lecciones=${inv.lecciones}  recursos=${inv.recursos}  modulos=${modulos.length} (${raices.length} raíz, ${niveles} nivel/es)  ${JSON.stringify(tipos)}`);
    filas.push(inv);
  }

  // ── Resumen ──
  console.log(`\n${'='.repeat(78)}\n  INVENTARIO DE LA FUENTE\n${'='.repeat(78)}`);
  console.log(`  ${'curso'.padEnd(38)} ${'lecc'.padStart(5)} ${'recursos'.padStart(9)} ${'niveles'.padStart(8)}`);
  let totR = 0, sin = 0;
  for (const f of filas) {
    if (f.salteado) { console.log(`  ${f.slug.padEnd(38)}     —         —        —   (${f.salteado})`); continue; }
    totR += f.recursos;
    if (!f.recursos) sin++;
    console.log(`  ${f.slug.padEnd(38)} ${String(f.lecciones).padStart(5)} ${String(f.recursos).padStart(9)} ${String(f.modulos.niveles).padStart(8)}`);
  }
  console.log(`\n  ${totR} recursos en la fuente · ${sin} curso(s) sin ninguno`);
  writeFileSync(join(RAIZ, 'inventario-resumen.json'), JSON.stringify(filas, null, 1), 'utf8');
  console.log(`  Resumen: ${join(RAIZ, 'inventario-resumen.json')}\n`);
  process.exit(0);
};

main().catch((e) => { console.error(`\n  ✖ ${e.message}\n`); process.exit(1); });
