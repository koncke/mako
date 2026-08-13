// Plan de un curso cuando el listado viene por API (área /vip/ de Cursos Élite).
//
// Por qué existe, además de curso-plan.mjs: en /vip/ el sidebar está VIRTUALIZADO.
// Un curso de 249 clases tiene ~11 en el DOM, y cada click re-renderiza la lista,
// así que los nodos marcados se pierden a mitad del recorrido. Enumerar clickeando
// es imposible ahí — no es lento, es incorrecto.
//
// La salida: la app pide la lista completa a un RPC de Supabase
// (`get_vip_lessons_secure`) en UNA llamada, con título, duración, orden, módulo y
// el id de Vimeo de cada clase. Se captura el cuerpo que el navegador YA recibió
// con Network.getResponseBody. No se le pega a la API por fuera del navegador: se
// lee lo que la propia página pidió con la sesión del usuario.
//
// Emite el MISMO plan.json que curso-plan.mjs, así que todo lo que viene después
// (bajar → audio → transcribir → drive → portal) no cambia.
//
//   node <abs>\scripts\curso-plan-vip.mjs
//   node <abs>\scripts\curso-plan-vip.mjs --segundos 25

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const PORT = Number(arg('port', 9333));
const SEGUNDOS = Number(arg('segundos', 20));
const RAIZ = arg('raiz', 'C:\\cursos');
// El autor NO viene en la API (vip_courses trae id, title, slug, description y
// nada más), pero SÍ es parte del nombre de la carpeta en Drive: la convención del
// dueño es «<Curso> - <Autor>», y la cumplen 36 de 39 carpetas. Sin esto la carpeta
// queda sin autor y desentona con todo el resto, así que si falta se avisa fuerte.
const AUTOR = arg('autor', '');

const slugDe = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 80);
const limpio = (s) => String(s).normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
  .replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 110) || 'sin-titulo';
const seg = (s) => {
  const p = String(s ?? '').split(':').map(Number);
  if (p.length === 3) return (p[0] * 3600 + p[1] * 60 + p[2]) || 0;
  if (p.length === 2) return (p[0] * 60 + p[1]) || 0;
  return 0;
};

class Cdp {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pend = new Map(); this.oye = [];
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pend.has(m.id)) {
        const { ok, no } = this.pend.get(m.id); this.pend.delete(m.id);
        m.error ? no(new Error(m.error.message)) : ok(m.result);
      } else if (m.method) for (const f of this.oye) f(m);
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
}

const main = async () => {
  let lista;
  try { lista = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json()); }
  catch { console.error(`\n  ✖ No hay CDP en ${PORT}. Corré curso-perfil.ps1.\n`); process.exit(1); }

  const t = lista.find((x) => x.type === 'page' && /\/watch/.test(x.url))
    ?? lista.find((x) => x.type === 'page' && /\/(curso|course)\//.test(x.url));
  if (!t) {
    console.error('\n  ✖ Necesito la pestaña del REPRODUCTOR abierta (…/watch).');
    console.error('    Abrí el curso con curso-abrir.mjs y entrá a ver una clase.\n');
    process.exit(1);
  }

  console.log(`\n  Pestaña: ${t.url}\n`);
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((ok, no) => {
    ws.addEventListener('open', ok, { once: true });
    ws.addEventListener('error', () => no(new Error('no pude conectar a CDP')), { once: true });
  });
  const cdp = new Cdp(ws);

  const capturado = new Map();
  const PATRONES = [
    [/get_vip_lessons_secure/, 'lessons'],
    [/vip_modules/, 'modules'],
    [/vip_courses\?/, 'course'],
  ];
  // El campo SIN EL CUAL la respuesta no sirve para nada. Es lo que separa la
  // llamada buena de la anónima cuando las dos vuelven 200 con un array lleno.
  const CAMPO_UTIL = { lessons: 'video_id' };
  cdp.oye.push((m) => {
    if (m.method !== 'Network.responseReceived') return;
    const url = m.params.response.url;
    const hit = PATRONES.find(([re]) => re.test(url));
    if (hit) capturado.set(m.params.requestId, hit[1]);
  });

  await cdp.enviar('Network.enable');
  await cdp.enviar('Page.enable');
  console.log(`  Recargando y capturando la lista (${SEGUNDOS}s)…`);
  await cdp.enviar('Page.reload', { ignoreCache: true });
  await new Promise((r) => setTimeout(r, SEGUNDOS * 1000));

  // El UA se lee del navegador ACÁ, con la pestaña todavía abierta. Dejarlo vacío
  // hacía que curso-bajar.mjs pasara --user-agent "" a yt-dlp, que es peor que no
  // pasarlo: algunos CDN invalidan el token con UA en blanco.
  let ua = '';
  try {
    const { result } = await cdp.enviar('Runtime.evaluate', { expression: 'navigator.userAgent', returnByValue: true });
    ua = result?.value ?? '';
  } catch { /* seguimos sin UA; abajo se avisa */ }

  // ⚠️ La página llama al MISMO endpoint más de una vez —antes y después de
  // resolver la sesión— y las respuestas no son equivalentes. Elegir «la más
  // grande» costó dos diagnósticos equivocados en «Inteligencia Viral 2026»: la
  // llamada anónima devolvía 92 filas SIN `video_id` y la buena 41 CON, así que
  // el capturador se quedaba con las 92 inservibles y el plan salía con 1/41
  // clases resolubles. Parecía un curso bloqueado; era esto.
  //
  // La regla que queda: se puntúa por UTILIDAD (cuántas filas traen el campo que
  // el pipeline necesita) y el tamaño solo desempata. Tamaño ≠ corrección.
  const utiles = (j, clave) => {
    if (!Array.isArray(j)) return j ? 1 : 0;
    const campo = CAMPO_UTIL[clave];
    return campo ? j.filter((x) => x?.[campo]).length : j.length;
  };
  const datos = {};
  const puntaje = {};
  for (const [rid, clave] of capturado) {
    try {
      const { body } = await cdp.enviar('Network.getResponseBody', { requestId: rid });
      const j = JSON.parse(body);
      const u = utiles(j, clave);
      const n = Array.isArray(j) ? j.length : 1;
      const prev = puntaje[clave];
      if (!prev || u > prev.u || (u === prev.u && n > prev.n)) { datos[clave] = j; puntaje[clave] = { u, n }; }
    } catch { /* el body puede no estar más en el buffer */ }
  }
  ws.close();

  for (const [clave, p] of Object.entries(puntaje)) {
    if (p.u < p.n) console.log(`  ⚠ ${clave}: me quedé con ${p.u}/${p.n} fila(s) útiles (${CAMPO_UTIL[clave] ?? 'sin campo clave'}).`);
  }

  const L = Array.isArray(datos.lessons) ? datos.lessons : [];
  if (!L.length) {
    console.error('\n  ✖ No capturé la lista de lecciones.');
    console.error('    Suele ser que la respuesta salió de caché y no se volvió a pedir.');
    console.error('    Reintentá con --segundos 30, o navegá a otra clase y volvé.\n');
    process.exit(1);
  }

  const cursoTitulo = (Array.isArray(datos.course) ? datos.course[0]?.title : datos.course?.title)
    ?? String(t.url).split('/').filter(Boolean).slice(-2, -1)[0];

  // ── Módulos: hay dos niveles (parent_module_id) ──────────────────────────────
  // El `grupo` del portal usa el módulo RAÍZ, no la hoja: con 50 hojas el hub queda
  // ilegible; con 13 raíces se navega. La hoja va al cardDesc, que es donde suma.
  const mods = new Map((datos.modules ?? []).map((m) => [m.id, m]));
  const raizDe = (id) => {
    let c = mods.get(id), visto = new Set();
    while (c?.parent_module_id && mods.has(c.parent_module_id) && !visto.has(c.id)) { visto.add(c.id); c = mods.get(c.parent_module_id); }
    return c ?? null;
  };
  const raices = [...mods.values()].filter((m) => !m.parent_module_id || !mods.has(m.parent_module_id))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const ordenRaiz = new Map(raices.map((m, i) => [m.id, i + 1]));

  // ── Orden global: módulo raíz → módulo hoja → orden de la clase ─────────────
  const clavesOrden = (l) => {
    const r = raizDe(l.vip_module_id);
    const hoja = mods.get(l.vip_module_id);
    return [ordenRaiz.get(r?.id) ?? 999, hoja?.sort_order ?? 0, l.sort_order ?? 0];
  };
  const ordenadas = [...L].sort((a, b) => {
    const A = clavesOrden(a), B = clavesOrden(b);
    return A[0] - B[0] || A[1] - B[1] || A[2] - B[2];
  });

  const ancho = String(ordenadas.length).length; // 249 → 3 dígitos
  const clases = ordenadas.map((l, i) => {
    const n = i + 1;
    const r = raizDe(l.vip_module_id);
    const hoja = mods.get(l.vip_module_id);
    const s = seg(l.duration);
    return {
      n,
      titulo: String(l.title ?? `Clase ${n}`).trim(),
      duracion: l.duration ?? '',
      segundos: s,
      modulo: r?.title ? `${ordenRaiz.get(r.id)}. ${r.title}` : null,
      submodulo: hoja && hoja.id !== r?.id ? hoja.title : null,
      plataforma: 'vimeo',
      videoId: String(l.video_id ?? '').trim() || null,
      // duration '00:00' es la señal de que el video NO EXISTE del otro lado.
      // Medido: las 2 clases de 249 con duración cero daban HTTP 404 en Vimeo, y
      // sin esta marca el descargador gasta 10 reintentos × ~300 fragmentos en
      // cada una (461 líneas de ERROR en el log) antes de rendirse.
      sinFuente: s === 0 || !String(l.video_id ?? '').trim(),
      // player.vimeo.com + Referer es lo que autentica un embed restringido por
      // dominio. La URL pública vimeo.com/<id> da 403.
      url: `https://player.vimeo.com/video/${String(l.video_id ?? '').trim()}`,
      archivo: `${String(n).padStart(ancho, '0')} - ${limpio(l.title)}`,
    };
  });

  const sinVideo = clases.filter((c) => c.sinFuente);
  const totalSeg = clases.reduce((a, c) => a + c.segundos, 0);
  const slug = slugDe(cursoTitulo);
  const dir = join(RAIZ, slug);
  mkdirSync(dir, { recursive: true });
  const destino = join(dir, 'plan.json');
  const salida = existsSync(destino) ? join(dir, 'plan.nuevo.json') : destino;

  writeFileSync(salida, JSON.stringify({
    curso: limpio(cursoTitulo),
    autor: AUTOR.trim(),
    slug,
    pagina: t.url,
    userAgent: ua,
    referer: new URL(t.url).origin + '/',
    fuente: 'api:get_vip_lessons_secure',
    clases,
    pdfs: [],
  }, null, 2), 'utf8');

  console.log(`\n  Curso   : ${cursoTitulo}`);
  console.log(`  Clases  : ${clases.length}${sinVideo.length ? ` · ⚠ ${sinVideo.length} sin video_id` : ''}`);
  console.log(`  Duración: ${(totalSeg / 3600).toFixed(1)} h · promedio ${(totalSeg / 60 / clases.length).toFixed(1)} min`);
  console.log(`  Módulos : ${raices.length} raíz · ${mods.size} en total`);
  console.log(`  → ${salida}`);
  if (salida !== destino) console.log(`\n  ⚠ Ya había un plan.json: lo dejé como plan.nuevo.json.`);

  console.log(`  UA      : ${ua ? ua.slice(0, 60) + '…' : '⚠ vacío (revisá antes de bajar)'}`);
  if (AUTOR.trim()) console.log(`  Autor   : ${AUTOR.trim()}  →  carpeta «${limpio(cursoTitulo)} - ${AUTOR.trim()}»`);
  else {
    console.log(`\n  ⚠ SIN AUTOR. La convención en Drive es «<Curso> - <Autor>» (36 de 39`);
    console.log(`    carpetas la cumplen). Volvé a correr con --autor "Nombre Apellido"`);
    console.log(`    o la carpeta va a quedar sin autor y desentonando con el resto.`);
  }
  console.log('');
  process.exit(sinVideo.length ? 3 : 0);
};

main().catch((e) => { console.error(`\n  ✖ ${e.message}\n`); process.exit(1); });
