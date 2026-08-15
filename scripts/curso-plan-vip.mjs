// Plan de un curso leyendo la respuesta que la página YA pidió, en vez de clickear.
//
// ⚠️ El «-vip» del nombre miente por historia: sirve para las DOS áreas, /vip/ y
// /curso/. Los endpoints son los mismos con y sin prefijo, y están contemplados
// abajo en PATRONES.
//
// Por qué existe, además de curso-plan.mjs — dos motivos, uno por área:
//
//   · En /vip/ el sidebar está VIRTUALIZADO. Un curso de 249 clases tiene ~11 en el
//     DOM y cada click re-renderiza la lista, así que los nodos marcados se pierden
//     a mitad del recorrido. Enumerar clickeando no es lento: es incorrecto.
//
//   · En /curso/ hay cursos con SUBMÓDULOS (módulo → submódulo → clase). Ahí el DOM
//     rinde una parte y el resto no aparece por ningún camino: en «Vender Por FB E
//     IG ADS» (242 lecciones, 52 módulos en dos niveles) se leían 154, y las otras
//     88 no salieron ni clickeando con eventos reales, ni esperando 600 ms, ni
//     scrolleando los 9.700 px de la página, ni repitiendo rondas. La señal para
//     usar ESTE script y no el otro: `curso-plan.mjs` aborta diciendo cuántas
//     lecciones publica la página y cuántas detectó.
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
// Vuelca la respuesta CRUDA de la RPC antes de tocarla. Existe porque «Instituto de
// Comunicación» devolvió 316 filas para 160 lecciones y no había forma de mirar la
// fuente: para cuando el plan está escrito, lo que sobraba ya se descartó. Con esto
// se contesta en un minuto la única pregunta que importa —¿son la MISMA fila repetida
// o filas distintas?— en vez de deducirla del resultado.
const CRUDO = arg('crudo', '');

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
  // ⚠️ Las DOS áreas, no solo /vip/. El área pública usa los mismos endpoints sin
  // el prefijo (`get_course_lessons_secure`, `modules`, `courses`), y hasta que se
  // contemplaron acá, un curso de /curso/ con submódulos no había forma de leerlo:
  // «Vender Por FB E IG ADS» (242 lecciones, 52 módulos en dos niveles) rendía 154
  // por el DOM y las otras 88 no aparecían ni clickeando, ni esperando, ni
  // scrolleando. Por la respuesta que la página YA pidió, salen las 242 de una.
  const PATRONES = [
    [/get_(?:vip_)?(?:course_)?lessons_secure/, 'lessons'],
    [/\/(?:vip_)?modules\?/, 'modules'],
    [/\/(?:vip_)?courses\?/, 'course'],
  ];
  // Qué hace ÚTIL a una fila: es lo que separa la llamada buena de la anónima
  // cuando las dos vuelven 200 con un array lleno.
  //
  // Es una función y no un nombre de campo porque «tiene video» no vive siempre en
  // el mismo lugar: hay cursos con `video_id` y otros donde ese campo viene null en
  // el 100% de las filas y el id está dentro de `video_url`. Con el nombre fijo,
  // una respuesta perfecta puntuaba 0/242 y el aviso decía justo lo contrario de
  // lo que pasaba.
  const CAMPO_UTIL = {
    lessons: (x) => Boolean(String(x?.video_id ?? '').trim() || /\d{6,}/.test(String(x?.video_url ?? ''))),
  };
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
    const sirve = CAMPO_UTIL[clave];
    return sirve ? j.filter((x) => sirve(x)).length : j.length;
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
  if (CRUDO && L.length) {
    mkdirSync(CRUDO.replace(/[\\/][^\\/]*$/, ''), { recursive: true });
    writeFileSync(CRUDO, JSON.stringify({ lessons: datos.lessons, modules: datos.modules ?? null }, null, 1), 'utf8');
    console.log(`  crudo → ${CRUDO}  (${L.length} fila(s) de lección)`);
  }
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

  // Las dos áreas nombran distinto los MISMOS datos, y leer solo la variante /vip/
  // deja todo en null sin ningún error: en «Vender Por FB E IG ADS» las 242 clases
  // salieron sin módulo y sin video por esto. Cada dato se busca por sus dos
  // nombres posibles, en un solo lugar, para no repetir el `??` en cinco líneas.
  const modIdDe = (l) => l.vip_module_id ?? l.module_id ?? null;
  const ordenDe = (x) => x?.sort_order ?? x?.order ?? 0;
  // El id de Vimeo puede venir en su propio campo o SOLO dentro de la URL. Este
  // curso trae `video_id: null` en las 242 y `video_url: https://vimeo.com/<id>`,
  // así que mirar únicamente `video_id` concluía «ninguna clase tiene video».
  const videoIdDe = (l) => {
    const directo = String(l.video_id ?? '').trim();
    if (directo) return directo;
    const m = /(?:vimeo\.com|video)\/(\d{6,})/.exec(String(l.video_url ?? ''));
    return m ? m[1] : '';
  };

  // ── Lecciones HUÉRFANAS: cuelgan de un módulo que la API no devuelve ─────────
  //
  // «Instituto de Comunicación» devolvió 316 filas con 316 ids DISTINTOS para un curso
  // que la plataforma muestra con 158 lecciones. No era un JOIN duplicando ni la misma
  // fila repetida: son 158 filas que apuntan al MISMO video que otras 158 y cuelgan de
  // nueve `module_id` que no están en `modules` — una copia fantasma de la estructura
  // que la UI filtra al hacer el join y la API no. Confirmado por los contadores de la
  // propia página, que suman exactamente 158.
  //
  // ⚠️ El dedup por título+duración de más abajo ya daba 158, y ese es justamente el
  // problema: acertaba el número por una señal que NO es la causa. Un curso con dos
  // lecciones legítimamente homónimas y de igual duración habría perdido una, y un
  // curso fantasma con títulos distintos habría pasado entero. La causa es que la
  // lección no pertenece a ningún módulo vivo, y eso es lo que hay que mirar.
  //
  // El filtro va en POSITIVO —se queda con las que SÍ cuelgan de un módulo vivo— y
  // solo se aplica cuando hay módulos y cuando dejaría algo en pie: un curso sin
  // módulos, o uno donde ninguna lección matchea, se procesa entero como siempre.
  const vivas = mods.size ? L.filter((l) => { const m = modIdDe(l); return m != null && mods.has(m); }) : L;
  const huerfanas = L.length - vivas.length;
  if (huerfanas > 0 && vivas.length > 0) {
    console.log(`  ⚠ ${huerfanas} lección(es) cuelgan de un módulo que la API no devuelve: no se ven en la plataforma y quedan afuera.`);
    console.log(`     ${vivas.length} lección(es) en los ${mods.size} módulos vivos.`);
  } else if (huerfanas > 0) {
    console.log(`  ⚠ NINGUNA lección matchea un módulo devuelto: no filtro, proceso las ${L.length}.`);
  }
  const Lvivas = vivas.length > 0 ? vivas : L;

  // ── Orden global: módulo raíz → módulo hoja → orden de la clase ─────────────
  const clavesOrden = (l) => {
    const r = raizDe(modIdDe(l));
    const hoja = mods.get(modIdDe(l));
    return [ordenRaiz.get(r?.id) ?? 999, ordenDe(hoja), ordenDe(l)];
  };
  const ordenadas = [...Lvivas].sort((a, b) => {
    const A = clavesOrden(a), B = clavesOrden(b);
    return A[0] - B[0] || A[1] - B[1] || A[2] - B[2];
  });

  // ¿La duración de este curso sirve como señal? Se MIDE contra los datos que ya
  // están, no se asume (regla de AGENTS.md sobre umbrales).
  //
  // El caso que lo obliga: «100M money Models» publica duración en 33 de 35 clases,
  // y las 2 que traen «00:00» dieron HTTP 404 en Vimeo — o sea que el cero era el
  // aviso correcto. Pero «Vender Por FB E IG ADS» publica duración en 32 de 242: ahí
  // el cero no significa nada y aplicarlo marcaba 210 clases sanas como rotas.
  //
  // Con el 60% de corte, el primero entra (94%) y el segundo no (13%). El costo de
  // equivocarse es asimétrico —saltear una clase sana es peor que gastar reintentos
  // en una muerta—, así que el umbral se pone alto a propósito.
  const conDuracion = ordenadas.filter((l) => seg(l.duration) > 0).length;
  const duracionEsSeñal = ordenadas.length > 0 && conDuracion / ordenadas.length >= 0.6;
  if (!duracionEsSeñal && conDuracion < ordenadas.length) {
    console.log(`  (duración publicada en ${conDuracion}/${ordenadas.length}: no se usa para descartar)`);
  }

  const ancho = String(ordenadas.length).length; // 249 → 3 dígitos
  const clases = ordenadas.map((l, i) => {
    const n = i + 1;
    const r = raizDe(modIdDe(l));
    const hoja = mods.get(modIdDe(l));
    const s = seg(l.duration);
    const vid = videoIdDe(l);
    return {
      n,
      titulo: String(l.title ?? `Clase ${n}`).trim(),
      duracion: l.duration ?? '',
      segundos: s,
      modulo: r?.title ? `${ordenRaiz.get(r.id)}. ${r.title}` : null,
      submodulo: hoja && hoja.id !== r?.id ? hoja.title : null,
      plataforma: 'vimeo',
      videoId: vid || null,
      // ⚠️ La duración en cero SÍ delata un video muerto, pero solo cuando el curso
      // publica duraciones. Ver `duracionEsSeñal` arriba: el umbral no es un gusto,
      // es la diferencia entre saltear 2 clases muertas y saltear 210 sanas.
      sinFuente: !vid || (duracionEsSeñal && s === 0),
      // player.vimeo.com + Referer es lo que autentica un embed restringido por
      // dominio. La URL pública vimeo.com/<id> da 403.
      url: `https://player.vimeo.com/video/${vid}`,
      archivo: `${String(n).padStart(ancho, '0')} - ${limpio(l.title)}`,
    };
  });

  // ── Clases DUPLICADAS en el origen ──────────────────────────────────────────
  // ⚠️ Una plataforma puede tener el curso entero cargado DOS VECES. «Jaque Blue -
  // Creacion de Contenido» publica 40 lecciones que en realidad son 20: cada una
  // aparece con su nombre y otra vez con el sufijo « (1)» del archivo re-subido.
  // Cada copia tiene su propio `video_id`, así que ni los ids únicos ni los títulos
  // únicos lo detectan — el pipeline las bajó, las subió a Drive y las transcribió
  // todas, y el duplicado apareció recién en el portal, que es donde lo vio el dueño.
  //
  // La señal fuerte es la DURACIÓN idéntica sobre el mismo título base: dos videos
  // distintos no duran lo mismo al décimo de segundo. Sin duración no se descarta
  // nada —solo se avisa—, porque un curso puede tener legítimamente una «Parte (1)».
  const base = (t) => String(t ?? '').replace(/\s*\(\d+\)\s*$/, '').trim().toLowerCase();
  const porBase = new Map();
  for (const c of clases) {
    const k = base(c.titulo);
    if (!porBase.has(k)) porBase.set(k, []);
    porBase.get(k).push(c);
  }
  const duplicadas = [];
  for (const [, grupo] of porBase) {
    if (grupo.length < 2) continue;
    // Se conserva la de título más limpio (la que NO tiene el sufijo), y de ahí la
    // más corta; el resto se marca solo si comparte duración con la conservada.
    const orden = [...grupo].sort((a, b) => a.titulo.length - b.titulo.length);
    const queda = orden[0];
    for (const otra of orden.slice(1)) {
      const mismaDur = queda.segundos > 0 && otra.segundos === queda.segundos;
      duplicadas.push({ queda, otra, seguro: mismaDur });
    }
  }
  const aTirar = new Set(duplicadas.filter((d) => d.seguro).map((d) => d.otra.n));
  const dudosas = duplicadas.filter((d) => !d.seguro);

  if (duplicadas.length) {
    console.log(`\n  ⚠ ${duplicadas.length} lección(es) parecen DUPLICADAS en el origen:`);
    for (const d of duplicadas.slice(0, 6)) {
      console.log(`     «${d.otra.titulo.slice(0, 48)}» = «${d.queda.titulo.slice(0, 48)}»` +
        (d.seguro ? `  (misma duración ${d.queda.duracion || d.queda.segundos + 's'}) → se descarta` : '  (duración distinta) → SE CONSERVA, revisala'));
    }
    if (aTirar.size) console.log(`     ${aTirar.size} descartada(s) · ${clases.length - aTirar.size} clases reales`);
    if (dudosas.length) console.log(`     ⚠ ${dudosas.length} sin confirmar por duración: quedan las dos.`);
  }

  if (aTirar.size) {
    // Se renumera: `n` es el orden de la clase en el curso y tiene que quedar
    // contiguo, o el nombre de archivo miente sobre cuántas clases hay.
    const anchoN = String(clases.length - aTirar.size).length;
    const limpias = clases.filter((c) => !aTirar.has(c.n)).map((c, i) => ({
      ...c, n: i + 1,
      archivo: `${String(i + 1).padStart(anchoN, '0')} - ${limpio(c.titulo)}`,
    }));
    clases.length = 0;
    clases.push(...limpias);
  }

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
  // El mensaje replica la MISMA regla que usa curso-a-drive.mjs para nombrar la
  // carpeta: si el título ya nombra al autor, no se repite. Anunciar una carpeta
  // que después no se crea así es peor que no anunciar nada.
  if (AUTOR.trim()) {
    const sinTildes = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const carpeta = sinTildes(cursoTitulo).includes(sinTildes(AUTOR.trim()))
      ? limpio(cursoTitulo)
      : `${limpio(cursoTitulo)} - ${AUTOR.trim()}`;
    console.log(`  Autor   : ${AUTOR.trim()}  →  carpeta «${carpeta}»`);
  }
  else {
    console.log(`\n  ⚠ SIN AUTOR. La convención en Drive es «<Curso> - <Autor>» (36 de 39`);
    console.log(`    carpetas la cumplen). Volvé a correr con --autor "Nombre Apellido"`);
    console.log(`    o la carpeta va a quedar sin autor y desentonando con el resto.`);
  }
  console.log('');
  process.exit(sinVideo.length ? 3 : 0);
};

main().catch((e) => { console.error(`\n  ✖ ${e.message}\n`); process.exit(1); });
