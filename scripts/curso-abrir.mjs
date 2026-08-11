// Busca un curso por nombre en el catálogo y lo abre en el Chrome dedicado.
//
// Existe porque el paso previo a todo el pipeline era «abrí la pestaña a mano», y
// eso no escala a 37 cursos. Y porque el sitio tiene MÁS DE UN patrón de URL:
// /curso/<slug> y /vip/course/<slug> conviven, así que buscar por link a ojo
// falla en la mitad de los casos.
//
// No adivina: si hay más de un match los lista y no navega. Un curso equivocado
// se descubre recién dos horas después, con 2 GB bajados.
//
//   node <abs>\scripts\curso-abrir.mjs --buscar "Juan Carrizo"
//   node <abs>\scripts\curso-abrir.mjs --buscar "ATV" --ir 2

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};

const PORT = Number(arg('port', 9333));
const BUSCAR = arg('buscar', '');
const IR = arg('ir', '');
const ORIGEN = arg('origen', 'https://cursoselite.com.mx');
// Las dos áreas conocidas del catálogo. Se escanean las dos: un curso puede estar
// en una y no en la otra, y el usuario no tiene por qué saber en cuál.
const CATALOGOS = (arg('catalogos', '/Catalog,/vip/') || '').split(',').filter(Boolean);

if (!BUSCAR) { console.error('\n  ✖ Falta --buscar "<nombre del curso>"\n'); process.exit(1); }

// Escapes explícitos, no diacríticos literales en el regex: un combining char
// suelto en el fuente sobrevive mal a copiar/pegar y a los encodings de Windows.
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const terminos = norm(BUSCAR).split(/\s+/).filter(Boolean);

class Cdp {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pend = new Map();
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pend.has(m.id)) {
        const { ok, no } = this.pend.get(m.id); this.pend.delete(m.id);
        m.error ? no(new Error(m.error.message)) : ok(m.result);
      }
    });
  }
  enviar(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((ok, no) => {
      this.pend.set(id, { ok, no });
      setTimeout(() => this.pend.has(id) && (this.pend.delete(id), no(new Error(`timeout ${method}`))), 30000);
    });
  }
}

// Corre EN la página: junta todo lo que parezca una tarjeta de curso con su link.
const COSECHAR = `(() => {
  const out = [];
  const vistos = new Set();
  for (const a of document.querySelectorAll('a[href]')) {
    const href = a.href;
    if (!/\\/(curso|course)\\//i.test(href)) continue;
    if (vistos.has(href)) continue;
    vistos.add(href);
    // El título puede estar en el <a> o en su contenedor (tarjeta con imagen).
    const propio = (a.innerText || '').replace(/\\s+/g, ' ').trim();
    const cont = a.closest('article,li,div');
    const texto = propio || ((cont && cont.innerText) || '').replace(/\\s+/g, ' ').trim();
    out.push({ href, texto: texto.slice(0, 160), alt: (a.querySelector('img')?.alt || '').slice(0, 120) });
  }
  return out;
})()`;

const main = async () => {
  let lista;
  try { lista = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json()); }
  catch { console.error(`\n  ✖ No hay CDP en ${PORT}. Corré curso-perfil.ps1.\n`); process.exit(1); }

  const pag = lista.find((t) => t.type === 'page' && !t.url.startsWith('devtools://'));
  if (!pag) { console.error('  ✖ No hay pestañas.\n'); process.exit(1); }

  const ws = new WebSocket(pag.webSocketDebuggerUrl);
  await new Promise((ok, no) => {
    ws.addEventListener('open', ok, { once: true });
    ws.addEventListener('error', () => no(new Error('no pude conectar a CDP')), { once: true });
  });
  const cdp = new Cdp(ws);
  await cdp.enviar('Runtime.enable');
  await cdp.enviar('Page.enable');

  const ev = async (expression) => {
    const { result } = await cdp.enviar('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return result?.value;
  };

  const todos = new Map();
  for (const ruta of CATALOGOS) {
    const url = ORIGEN + ruta;
    process.stdout.write(`  escaneando ${url} … `);
    await cdp.enviar('Page.navigate', { url });
    // Esperar a que aparezcan links de curso, en vez de dormir a ciegas.
    let n = 0;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 400));
      n = (await ev(`document.querySelectorAll('a[href*="/curso/"],a[href*="/course/"]').length`)) ?? 0;
      if (n > 0) break;
    }
    const items = (await ev(COSECHAR)) ?? [];
    for (const it of items) if (!todos.has(it.href)) todos.set(it.href, it);
    console.log(`${items.length} curso(s)`);
  }

  const candidatos = [...todos.values()].filter((it) => {
    const heno = norm(`${it.texto} ${it.alt} ${decodeURIComponent(it.href)}`);
    return terminos.every((t) => heno.includes(t));
  });

  console.log(`\n  Catálogo: ${todos.size} cursos · coinciden con "${BUSCAR}": ${candidatos.length}\n`);

  if (!candidatos.length) {
    console.log('  Sin coincidencias. Probá con menos palabras o con el nombre del autor.');
    console.log('  Una muestra de lo que hay:');
    for (const it of [...todos.values()].slice(0, 12)) console.log(`    · ${it.texto.slice(0, 90)}`);
    ws.close();
    process.exit(2);
  }

  candidatos.forEach((c, i) => {
    console.log(`  [${i + 1}] ${c.texto.slice(0, 110) || '(sin texto)'}`);
    console.log(`      ${c.href}`);
  });

  const elegido = candidatos.length === 1 ? candidatos[0] : (IR ? candidatos[Number(IR) - 1] : null);

  if (!elegido) {
    console.log(`\n  ⚠ Hay ${candidatos.length} coincidencias y no voy a adivinar.`);
    console.log(`    Elegí con --ir <n>. (Un curso equivocado se descubre con 2 GB bajados.)\n`);
    ws.close();
    process.exit(3);
  }

  console.log(`\n  → abriendo: ${elegido.href}`);
  await cdp.enviar('Page.navigate', { url: elegido.href });
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 400));
    const t = await ev('document.title');
    const listo = await ev(`document.querySelectorAll('button').length > 5`);
    if (listo) { console.log(`  ✓ cargado: ${t}`); break; }
  }
  console.log(`\n  Siguiente:  node <abs>\\scripts\\curso-plan.mjs\n`);
  ws.close();
  process.exit(0);
};

main().catch((e) => { console.error(`\n  ✖ ${e.message}\n`); process.exit(1); });
