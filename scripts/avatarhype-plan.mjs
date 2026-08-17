// Arma el plan.json de un curso de AVATAR HYPE ACADEMY (app.avatarhype.online), con
// el mismo formato que curso-plan-vip.mjs / hotmart-plan.mjs, para que el resto del
// pipeline (audio, transcripción, Drive, ficha) funcione sin cambios.
//
//   node <abs>\scripts\avatarhype-plan.mjs --curso ugc --titulo "Creativos UGC Realistas" \
//        --autor "Avatar Hype" --primera /academy/ugc/bienvenida
//
// ── Cómo se llega al video (verificado el 2026-08-16, no supuesto) ───────────
//   1. La lección se abre en `/academy/<curso>/<slug>`; el video NO está en el DOM.
//   2. Apretar el póster dispara `/api/video/<id>` → `{ url, kind:'iframe',
//      expiresAt, ttlSeconds: 3600 }`, un embed de Bunny Stream (librería 683445).
//   3. El embed pide `https://vz-e3242c91-fe8.b-cdn.net/<guid>/playlist.m3u8`, que es
//      HLS EN CLARO: 5 calidades hasta 1080p real, sin `EXT-X-KEY`, sin `.mpd` y sin
//      license server. Ese paso lo hace `avatarhype-bajar.mjs`, no éste.
//
// ⚠️ La única puerta es el REFERER: el manifiesto da 403 pelado y 200 con
//    `Referer: https://iframe.mediadelivery.net/`. Mismo patrón que Hotmart, y por eso
//    la bajada NO necesita navegador — sólo la resolución de qué video es cada lección.
//
// ⚠️ El token del embed dura 1 HORA (`ttlSeconds: 3600`). Este plan guarda el ID de la
//    lección y el GUID, nunca una URL firmada: un plan con URLs adentro nace vencido.
//
// ⚠️ UNA LECCIÓN NO ES UN VIDEO. Las del módulo «Formatos» vienen en PARTES
//    (`Producción 12:28` + `Edición 5:57`), cada una un archivo distinto, y se piden
//    con `/api/video/<id>?part=<n>`. Un plan con un `videoId` por lección perdería la
//    mitad del curso sin decir nada. Por eso `clases[]` sale APLANADO: una entrada por
//    ARCHIVO, que es lo que consume el pipeline, y `lecciones[]` conserva la unidad
//    pedagógica.
//
// ⚠️ Y hay un SEGUNDO sistema de video que este plan NO baja: los clips embebidos en
//    el documento de cada lección (MP4 de Bunny Storage, `/api/doc-media/…`). Son 95 en
//    el curso UGC. Se anotan en `documentos[]` para que la decisión de bajarlos o no sea
//    explícita, en vez de descubrirse cuando el documento quede con agujeros.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const PORT = Number(arg('port', 9333));
const CURSO = arg('curso', 'ugc');
const PRIMERA = arg('primera', `/academy/${arg('curso', 'ugc')}/bienvenida`);
const AUTOR = arg('autor', 'Avatar Hype');
const RAIZ = arg('raiz', 'C:\\cursos');
const TOPE = Number(arg('tope', 60));

const REFERER = 'https://iframe.mediadelivery.net/';
const BASE = 'https://app.avatarhype.online';

const slugDe = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 80);
const limpio = (s) => String(s).normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
  .replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 110) || 'sin-titulo';
const aSegundos = (t) => {
  const p = String(t ?? '').trim().split(':').map(Number);
  if (p.some((x) => !Number.isFinite(x))) return 0;
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : 0;
};

// ── CDP mínimo ───────────────────────────────────────────────────────────────
const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const tab = tabs.find((t) => t.type === 'page' && /app\.avatarhype\.online/i.test(t.url));
if (!tab) {
  console.error('\n  ✖ No hay una pestaña abierta en app.avatarhype.online.');
  console.error('    Abrila en el Chrome dedicado (el del puerto 9333) y logueate.\n');
  process.exit(1);
}
const sock = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((res, rej) => { sock.onopen = res; sock.onerror = () => rej(new Error('no pude conectar a CDP')); });
let id = 0; const pend = new Map(); let red = [];
sock.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); return; }
  if (d.method === 'Network.requestWillBeSent') red.push(d.params.request.url);
};
// ⚠️ CON TIMEOUT, SIEMPRE. Sin él, una respuesta de CDP que no llega deja el script
// colgado para siempre y sin imprimir una línea: parece que «tarda» y en realidad
// murió. Pasó — quince minutos sin una sola línea de salida y la pestaña sin moverse.
// Un comando que no contesta en 30 s no va a contestar; se devuelve null y el que
// llama decide, que es mejor que un proceso zombi esperando a nadie.
const cmd = (method, params = {}) => new Promise((r) => {
  const i = ++id;
  const reloj = setTimeout(() => { if (pend.has(i)) { pend.delete(i); console.error(`  ⚠ CDP sin respuesta: ${method}`); r(null); } }, 30000);
  pend.set(i, (res) => { clearTimeout(reloj); r(res); });
  sock.send(JSON.stringify({ id: i, method, params }));
});
const ev = async (e) => {
  const r = await cmd('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
  if (r?.exceptionDetails) return { __error: r.exceptionDetails.text ?? 'excepción' };
  return r?.result?.value;
};
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// ⚠️ LO QUE GOBIERNA EL RENDER ES `visibilityState`, NO EL FRENTE DE LA PESTAÑA.
// La app monta el contenido sólo con la pestaña VISIBLE; si no, se queda en «Cargando…»
// para siempre. `Page.bringToFront` la pone al frente DENTRO de su ventana, así que con
// la ventana minimizada o tapada `visibilityState` sigue en `hidden` y no renderiza
// igual — de ahí que el problema pareciera intermitente y costara tres intentos.
// `setFocusEmulationEnabled` lo arregla de verdad, y no le roba el escritorio a nadie
// durante los ~5 minutos que tarda un recorrido.
await cmd('Network.enable');
await cmd('Page.enable');
await cmd('Emulation.setFocusEmulationEnabled', { enabled: true });
await dormir(300);
if ((await ev('document.visibilityState')) !== 'visible') {
  console.error('\n  ✖ La pestaña sigue en `hidden` con el override puesto: nada va a renderizar.\n');
  process.exit(1);
}

// ── Los NOMBRES de los módulos ───────────────────────────────────────────────
// ⚠️ EL CÓDIGO DE UNA LECCIÓN NO ES EL NOMBRE DE SU MÓDULO. La primera versión de
// este script guardaba `modulo: codigo.split('.')[0]` — o sea «1», «3», «4»— y el
// portal los pintó tal cual: una grilla con módulos llamados «1», «3.1», «3.2». Se
// vio recién publicado, porque un plan con «1» adentro se lee perfecto en el JSON.
// Los nombres los publica la portada del curso («1 Onboarding», «3 Fundamentos del
// método»…), así que se leen de ahí y se mapean por el primer segmento del código.
const nombresDeModulo = async () => {
  await cmd('Emulation.setFocusEmulationEnabled', { enabled: true });
  await cmd('Page.navigate', { url: `${BASE}/academy/${CURSO}` });
  for (let i = 0; i < 30; i++) {
    await dormir(1000);
    const ok = await ev(`!/Cargando…/.test((document.body.innerText||'').slice(0, 300)) && /Los m[oó]dulos/i.test(document.body.innerText || '')`);
    if (ok === true) break;
  }
  const crudo = await ev(`(() => {
    const t = (document.body.innerText || '');
    const i = t.search(/Los m[oó]dulos/i);
    return i > -1 ? t.slice(i, i + 1200) : null;
  })()`);
  if (!crudo) return new Map();
  // Un renglón que es SOLO un número es el número del módulo; el de abajo, su nombre.
  const lineas = String(crudo).split('\n').map((l) => l.trim());
  const m = new Map();
  for (let i = 0; i < lineas.length - 1; i++) {
    if (/^\d{1,2}$/.test(lineas[i]) && lineas[i + 1] && !/^\d/.test(lineas[i + 1])) {
      m.set(lineas[i], lineas[i + 1]);
    }
  }
  return m;
};

const clickEn = async (sel) => {
  // Las coordenadas se leen del DOM en el momento: el panel es redimensionable (hay un
  // separador con `aria-valuenow`), así que un centro fijo apunta a otro lado.
  const c = await ev(`(() => {
    const b = document.querySelector(${JSON.stringify(sel)});
    if (!b) return null;
    b.scrollIntoView({ block: 'center' });
    const r = b.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);
  if (!c || (c.x === 0 && c.y === 0)) return false;
  // ⚠️ Un `.click()` de JS NO despierta al reproductor: se probó, y a los 6 s no había
  //    ni `<video>` ni una sola request. Tiene que ser un evento confiable.
  for (const type of ['mousePressed', 'mouseReleased']) {
    await cmd('Input.dispatchMouseEvent', { type, x: c.x, y: c.y, button: 'left', clickCount: 1, buttons: type === 'mousePressed' ? 1 : 0 });
  }
  return true;
};

const leer = () => ev(`(() => {
  const a = [...document.querySelectorAll('a')];
  const href = (re) => { const x = a.find((e) => re.test((e.innerText || '').trim())); return x ? x.getAttribute('href') : null; };
  const t = (document.body.innerText || '');
  const pos = t.match(/(\\d+)\\s*\\/\\s*(\\d+)/);
  const cab = t.match(/^\\s*([\\d.]+)\\s*·\\s*([^\\n]+?)\\s*(?:QUEDAN|$)/m);
  const chips = [...document.querySelectorAll('.ugc-part-chip')].map((c, i) => {
    const lab = c.getAttribute('aria-label') || '';
    const m = lab.match(/parte\\s*(\\d+)\\s*:\\s*(.+)$/i);
    const dur = (c.querySelector('span') || {}).textContent || '';
    return { parte: m ? Number(m[1]) : i + 1, nombre: (m ? m[2] : (c.innerText || '').trim()).trim(), duracion: dur.trim() };
  });
  return {
    ruta: location.pathname,
    n: pos ? Number(pos[1]) : null,
    total: pos ? Number(pos[2]) : null,
    codigo: cab ? cab[1] : null,
    titulo: cab ? cab[2].trim() : null,
    siguiente: href(/^Siguiente\\s*→/i),
    duracion: (document.querySelector('.ugc-vbar-dur') || {}).textContent?.trim() || null,
    portada: (document.querySelector('.ugc-vposter img') || {}).getAttribute?.('src') || null,
    chips,
    hayPoster: !!document.querySelector('.ugc-vposter'),
    bloqueada: /desbloquea|comprar|extensi[oó]n\\s*·\\s*7/i.test(t.slice(0, 1200)),
    proximamente: /pr[oó]ximamente/i.test(t.slice(0, 1200)),
  };
})()`);

const abrir = async (ruta) => {
  red = [];
  await cmd('Emulation.setFocusEmulationEnabled', { enabled: true });
  await cmd('Page.navigate', { url: BASE + ruta });
  // ⚠️ La espera va contra CONTENIDO de la lección, nunca contra «hay más de N links».
  //    El cascarón (barra lateral, «Siguiente →») renderiza igual mientras el cuerpo
  //    dice «Cargando…»: son 13 `<a>` sobre un body de 264 caracteres. Una espera por
  //    cantidad de links da verde sobre una página que no cargó, y entonces la lección
  //    se anota «sin video» — un dato falso con forma de dato bueno.
  for (let i = 0; i < 30; i++) {
    await dormir(1000);
    const ok = await ev(`(() => {
      if (location.pathname !== ${JSON.stringify(ruta.split('?')[0])}) return false;
      const t = (document.body.innerText || '');
      if (/Cargando…/.test(t)) return false;
      return /\\d+\\s*\\/\\s*\\d+/.test(t) || !!document.querySelector('.ugc-vcard');
    })()`);
    if (ok === true) return true;
  }
  return false;
};

// ── Recorrer la cadena ───────────────────────────────────────────────────────
// Se recorre por los `<a>` de Anterior/Siguiente que publica la app: ya traen el ORDEN,
// y el menú lateral no sirve (módulos plegables con el texto partido en nodos).
const MODULOS = await nombresDeModulo();
console.log(`\n  Curso  : ${CURSO}`);
console.log(`  Arranca: ${PRIMERA}`);
if (MODULOS.size) {
  console.log(`  Módulos: ${[...MODULOS].map(([n, t]) => `${n}=${t}`).join(' · ')}\n`);
} else {
  console.error('\n  ✖ No pude leer los nombres de los módulos de la portada del curso.');
  console.error('    Sin eso el portal muestra módulos llamados «1» y «3», que es lo que');
  console.error('    este chequeo existe para evitar. Revisá que /academy/' + CURSO + ' cargue.\n');
  process.exit(1);
}

const lecciones = []; const vistas = new Set();
let ruta = PRIMERA;
for (let k = 0; k < TOPE; k++) {
  if (vistas.has(ruta)) { console.log('  ⚠ La cadena volvió a una ruta ya vista: corto.'); break; }
  vistas.add(ruta);

  if (!(await abrir(ruta))) {
    console.error(`\n  ✖ ${ruta} NO RENDERIZÓ en 30 s.`);
    console.error('    Se corta a propósito: una lección que no renderiza se lee como «lección');
    console.error('    sin video», y ese dato falso es peor que no tener el dato.\n');
    sock.close(); process.exit(1);
  }
  const d = await leer();
  const slug = d.ruta.split('/').pop();

  // ⚠️ LOS CLIPS DEL DOCUMENTO SE LEEN ACÁ, ANTES DE TOCAR NADA. Se piden al CARGAR la
  //    página, y más abajo el bucle de partes vacía `red` en cada vuelta: leerlos
  //    después daba «0 clips» en lecciones que piden 28. Un bucket que se vacía y se
  //    lee después no devuelve «no había»: devuelve «ya no está».
  const docMedia = [...new Set(red.filter((u) => /\/api\/doc-media\//.test(u)))].map((u) => u.replace(BASE, ''));

  // ── El video de cada parte ──────────────────────────────────────────────
  // Se CLICKEA cada chip y se lee qué pide la red. No se deduce que la parte 2 sea
  // «el mismo id con ?part=2»: se verificó en UNA lección, y una regla verificada en
  // una muestra es una regla que todavía no se verificó.
  // ⚠️ «NO TIENE VIDEO» Y «NO PUDE RESOLVERLO» SON DOS PREGUNTAS, Y VAN EN DOS CAMPOS.
  //    Hay lecciones que son puro texto —`musica-efectos` y `agentes`, verificadas: sin
  //    `.ugc-vcard`, sin póster y sin duración—. Si las dos cosas caen en el mismo
  //    `sinFuente`, el informe pide «mirar a mano» dos lecciones que no tienen nada que
  //    mirar, y esconde las que sí fallaron entre ellas.
  const partes = [];
  const sinVideo = !d.hayPoster && !d.chips.length && !d.duracion;
  if (sinVideo) {
    lecciones.push({
      n: d.n ?? lecciones.length + 1, codigo: d.codigo, titulo: d.titulo, slug, ruta: d.ruta,
      duracion: null, portada: d.portada, bloqueada: d.bloqueada, proximamente: d.proximamente,
      sinVideo: true, partes: [], docMedia,
    });
    console.log(`  ${String(lecciones.length).padStart(2)}. ${(d.codigo ?? '—').padEnd(7)} ${String(d.titulo ?? slug).slice(0, 40).padEnd(40)} (solo texto)`);
    if (!d.siguiente) break;
    ruta = d.siguiente;
    continue;
  }
  const chips = d.chips.length ? d.chips : [{ parte: 1, nombre: null, duracion: d.duracion }];
  for (const ch of chips) {
    // ⚠️ EL PÓSTER DESAPARECE DESPUÉS DEL PRIMER PLAY: lo reemplaza el reproductor. Por
    //    eso el estado se vuelve a mirar en CADA vuelta en vez de reusar el `hayPoster`
    //    de la lectura inicial — con el valor viejo, en la parte 2 se clickeaba un botón
    //    que ya no existe y la parte quedaba sin `guid` sin que nada lo explicara.
    //    Y `red` se limpia ANTES del chip, no después: el cambio de parte dispara la
    //    request por sí solo, así que limpiar en el medio la tiraba.
    red = [];
    if (d.chips.length) {
      const sel = await ev(`(() => {
        const c = [...document.querySelectorAll('.ugc-part-chip')].find((x) => /parte\\s*${ch.parte}\\s*:/i.test(x.getAttribute('aria-label') || ''));
        if (!c) return null; c.setAttribute('data-plan', '${ch.parte}'); return '.ugc-part-chip[data-plan="${ch.parte}"]';
      })()`);
      if (sel) { await clickEn(sel); await dormir(1500); }
    }
    // Dos intentos: el primero apretando el póster si está; el segundo, si no salió
    // nada, volviendo a apretar lo que haya. Un reintento acotado es más barato que
    // una fila con `guid: null` que alguien tiene que resolver a mano después.
    let api = [], embed = [];
    for (let intento = 0; intento < 2 && !embed.length; intento++) {
      if ((await ev(`!!document.querySelector('.ugc-vposter')`)) === true) await clickEn('.ugc-vposter');
      for (let s = 0; s < 8 && !embed.length; s++) {
        await dormir(1000);
        api = [...new Set(red.filter((u) => /\/api\/video\//.test(u)))];
        embed = [...new Set(red.filter((u) => /iframe\.mediadelivery\.net\/embed\//.test(u)))];
      }
    }
    const m = api[0]?.match(/\/api\/video\/(\d+)/);
    const g = embed[0]?.match(/\/embed\/(\d+)\/([0-9a-f-]{36})/i);
    partes.push({
      parte: ch.parte,
      nombre: ch.nombre,
      duracion: ch.duracion || null,
      segundos: aSegundos(ch.duracion),
      // El ID de la lección y el GUID: lo estable. La URL firmada vive 1 hora.
      videoId: m ? Number(m[1]) : null,
      api: api[0] ? api[0].replace(BASE, '') : null,
      libreria: g ? g[1] : null,
      guid: g ? g[2] : null,
    });
  }

  lecciones.push({
    n: d.n ?? lecciones.length + 1,
    codigo: d.codigo,
    titulo: d.titulo,
    slug,
    ruta: d.ruta,
    duracion: d.duracion,
    portada: d.portada,
    bloqueada: d.bloqueada,
    proximamente: d.proximamente,
    partes,
    docMedia,
  });

  const sinResolver = partes.filter((p) => !p.guid).length;
  console.log(`  ${String(lecciones.length).padStart(2)}. ${(d.codigo ?? '—').padEnd(7)} ${String(d.titulo ?? slug).slice(0, 40).padEnd(40)} partes:${partes.length}${sinResolver ? ` ⚠ sin guid:${sinResolver}` : ''}${d.docMedia?.length ? '' : ''}`);

  if (!d.siguiente) break;
  ruta = d.siguiente;
}

// ── Aplanar a clases: UNA por ARCHIVO de video ───────────────────────────────
const clases = [];
for (const l of lecciones) {
  for (const p of l.partes) {
    const n = clases.length + 1;
    const sufijo = l.partes.length > 1 && p.nombre ? ` · ${p.nombre}` : '';
    clases.push({
      n,
      titulo: `${l.titulo ?? l.slug}${sufijo}`,
      duracion: p.duracion ?? '',
      segundos: p.segundos,
      // El NOMBRE del módulo, no su número: es lo que el portal pinta como título de
      // la sección. Si el código no mapea a ningún módulo conocido, va `null` y la
      // clase queda sin agrupar — nunca el número pelado, que es lo que se publicó.
      modulo: (l.codigo && MODULOS.get(l.codigo.split('.')[0])) || null,
      // El código (`4.1.1`) NO es un submódulo: es la numeración de la lección, y
      // usarlo como segundo nivel producía una sección por clase. La plataforma no
      // publica nombres de submódulo, así que no hay segundo nivel y no se inventa.
      submodulo: null,
      codigo: l.codigo,
      plataforma: 'avatarhype',
      slug: l.slug,
      videoId: p.videoId,
      parte: p.parte,
      guid: p.guid,
      libreria: p.libreria,
      sinFuente: !p.guid,
      bytesEsperados: null,
      archivo: `${String(n).padStart(2, '0')} - ${limpio(`${l.titulo ?? l.slug}${sufijo}`)}`,
    });
  }
}

const titulo = arg('titulo', '') || CURSO;
const slug = slugDe(titulo);
const base = join(RAIZ, slug);
mkdirSync(base, { recursive: true });
const salida = join(base, existsSync(join(base, 'plan.json')) ? 'plan.nuevo.json' : 'plan.json');

writeFileSync(salida, JSON.stringify({
  curso: titulo,
  autor: AUTOR,
  slug,
  fuente: 'avatarhype:academy',
  academy: { curso: CURSO, pagina: `${BASE}/academy/${CURSO}` },
  // El Referer que exige el manifiesto. Sin él, 403.
  referer: REFERER,
  clases,
  lecciones,
}, null, 2), 'utf8');

const horas = clases.reduce((t, c) => t + c.segundos, 0) / 3600;
const sinFuente = clases.filter((c) => c.sinFuente);
const soloTexto = lecciones.filter((l) => l.sinVideo);
console.log(`\n  Lecciones : ${lecciones.length}  (${soloTexto.length} sin video, solo texto)`);
console.log(`  Clases    : ${clases.length}  (una por archivo de video)`);
console.log(`  Duración  : ${horas.toFixed(1)} h`);
// El conteo de clips es un PISO, no un total: cargan por lazy-load y este script no
// baja la página. Se dice, porque un número sin esa aclaración se lee como completo.
console.log(`  Clips del documento: ${new Set(lecciones.flatMap((l) => l.docMedia)).size} o más (lazy-load; NO se bajan acá)`);
console.log(`  → ${salida}`);
if (soloTexto.length) console.log(`\n  Sin video (es su forma, no una falla): ${soloTexto.map((l) => l.slug).join(', ')}`);
if (sinFuente.length) {
  console.log(`\n  ⚠ ${sinFuente.length} con reproductor pero SIN guid resuelto — eso sí es una falla:`);
  for (const c of sinFuente.slice(0, 10)) console.log(`     · ${c.slug} (parte ${c.parte})`);
}
sock.close();
